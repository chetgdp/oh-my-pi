import * as fs from "node:fs";
import type * as net from "node:net";
import * as path from "node:path";
import { getBaseConfigRoot } from "@oh-my-pi/pi-utils";
import { compressTask, mergeTask, SYSTEM_PROMPT, tooLongFeedback } from "./prompt";
import {
	byteLength,
	CVIEW_HIGH,
	CVIEW_LOW,
	clipEcho,
	headBytes,
	JOBS,
	NODE_BYTES,
	splitText,
	TRIES,
	VIEW_HIGH,
	VIEW_LOW,
} from "./sizes";
import { acquireLock, type OmemKind, type OmemMessage, releaseLock, Store } from "./store";
import { foldView, type NodeRef, nodeName, renderLine } from "./view";

export type OmemCompleteFn = (req: {
	view: string;
	task: string;
	retries: Array<{ reply: string; feedback: string }>;
	signal: AbortSignal;
}) => Promise<string>;

export interface OmemOpenOptions {
	dir: string;
	complete: OmemCompleteFn;
	onError?: (err: unknown, node: { l: number; i: number }) => void;
}

/** Default store dir: `OMP_OMEM_DIR`, else `~/.omp/omem` (profile-independent: one global chat). */
export function getOmemDir(): string {
	return process.env.OMP_OMEM_DIR || path.join(getBaseConfigRoot(), "omem");
}

const BLOCK_LINES = 4;

export class Omem {
	static readonly systemPrompt: string = SYSTEM_PROMPT;

	readonly #dir: string;
	readonly #store: Store;
	readonly #lock: net.Server;
	readonly #complete: OmemCompleteFn;
	readonly #onError: OmemOpenOptions["onError"];
	readonly #abort = new AbortController();
	#view: NodeRef[] = [];
	#cview: NodeRef[] = [];
	#draining = false;
	#closed = false;

	// Ready queues; the tree is never scanned for work after open.
	readonly #msgQueue: number[] = [];
	#msgHead = 0;
	readonly #mergeQueue: NodeRef[] = [];
	#mergeHead = 0;
	#failed: NodeRef[] = [];
	readonly #queued = new Set<string>();
	/** Message nodes started (or failed) and not yet built; gates later message nodes. */
	readonly #unbuiltMsgs = new Set<number>();
	readonly #running = new Set<Promise<void>>();
	/** Each returns true once it has resolved and can be dropped. */
	#waiters: Array<() => boolean> = [];

	private constructor(dir: string, store: Store, lock: net.Server, opts: OmemOpenOptions) {
		this.#dir = dir;
		this.#store = store;
		this.#lock = lock;
		this.#complete = opts.complete;
		this.#onError = opts.onError;
	}

	static async open(opts: OmemOpenOptions): Promise<Omem> {
		fs.mkdirSync(opts.dir, { recursive: true });
		const lock = await acquireLock(opts.dir);
		let store: Store;
		try {
			store = new Store(opts.dir);
		} catch (err) {
			await releaseLock(lock, opts.dir);
			throw err;
		}
		const omem = new Omem(opts.dir, store, lock, opts);
		omem.#load();
		return omem;
	}

	get count(): number {
		return this.#store.messages.length;
	}

	message(i: number): OmemMessage | undefined {
		return this.#store.messages[i];
	}

	#built(l: number, i: number): boolean {
		return this.#store.node(l, i) !== undefined;
	}

	#lineSize = (l: number, i: number): number => byteLength(renderLine(l, i, this.#store.node(l, i))) + 1;
	#canMerge = (l: number, i: number): boolean => this.#built(l, i);

	#bytes(view: readonly NodeRef[]): number {
		let total = 0;
		for (const n of view) total += this.#lineSize(n.l, n.i);
		return total;
	}

	#load(): void {
		const T = this.count;
		const saved = this.#store.loadView();
		let covered = 0;
		let valid = saved !== undefined;
		for (const n of saved ?? []) {
			if (n.i * 2 ** n.l !== covered) valid = false;
			covered += 2 ** n.l;
		}
		if (valid && saved && covered <= T) {
			this.#view = saved;
		} else {
			// No usable view.json (first run or corrupt): the only time the view is built from the log.
			this.#view = [];
			covered = 0;
		}
		// Messages logged after the last view save (crash in between) get their lines now.
		for (let i = covered; i < T; i++) this.#view.push({ l: 0, i });
		if (!valid) {
			foldView(this.#view, T, VIEW_LOW, this.#bytes(this.#view), this.#canMerge, this.#lineSize);
		}

		for (let i = 0; i < T; i++) {
			if (!this.#built(0, i)) this.#messageReady(i);
		}
		const levels = this.#store.levels;
		for (let l = 0; l < levels.length; l++) {
			const level = levels[l];
			for (let k = 0; 2 * k + 1 < level.length; k++) {
				if (level[2 * k] !== undefined && level[2 * k + 1] !== undefined && !this.#built(l + 1, k)) {
					this.#mergeReady(l + 1, k);
				}
			}
		}
		this.#resetCView();
		this.#store.saveView(this.#view);
		this.#pump();
	}

	append(kind: OmemKind, text: string): OmemMessage[] {
		if (this.#closed) throw new Error("omem is closed");
		const pieces = kind === "echo" ? [clipEcho(text)] : splitText(text);
		const date = new Date().toISOString();
		const out: OmemMessage[] = [];
		for (const piece of pieces) {
			const msg: OmemMessage = { i: this.count, kind, text: piece, size: byteLength(piece), date };
			this.#store.appendMessage(msg);
			out.push(msg);
			this.#view.push({ l: 0, i: msg.i });
			this.#cview.push({ l: 0, i: msg.i });
			this.#messageReady(msg.i);
		}
		this.#sawtooth();
		this.#store.saveView(this.#view);
		this.#retryFailed();
		this.#pump();
		this.#notify();
		return out;
	}

	/** Chat view: grows a line per message; past VIEW_HIGH one batch merges it to VIEW_LOW. */
	#sawtooth(): void {
		let total = this.#bytes(this.#view);
		if (total > VIEW_HIGH) this.#draining = true;
		if (this.#draining) {
			const before = this.#view.length;
			total = foldView(this.#view, this.count, VIEW_LOW, total, this.#canMerge, this.#lineSize);
			if (total <= VIEW_LOW) this.#draining = false;
			if (this.#view.length !== before) {
				this.#resetCView();
				return;
			}
		}
		const ctotal = this.#bytes(this.#cview);
		if (ctotal > CVIEW_HIGH) {
			foldView(this.#cview, this.count, CVIEW_LOW, ctotal, this.#canMerge, this.#lineSize);
		}
	}

	#resetCView(): void {
		this.#cview = this.#view.slice();
		foldView(this.#cview, this.count, CVIEW_LOW, this.#bytes(this.#cview), this.#canMerge, this.#lineSize);
	}

	#render(lines: string[]): string {
		return `<chat>\n${lines.map(s => `${s}\n`).join("")}</chat>`;
	}

	renderView(): string {
		return this.#render(this.#view.map(n => renderLine(n.l, n.i, this.#store.node(n.l, n.i))));
	}

	/**
	 * The view cut for cache marks: `["<chat>\n" + lines 0-3, lines 4-7, ..., partial block?, "</chat>"]`.
	 * The first `viewWholeBlocks()` entries are whole 4-line blocks.
	 */
	viewBlocks(): string[] {
		const blocks: string[] = [];
		for (let k = 0; k < this.#view.length; k += BLOCK_LINES) {
			let block = "";
			for (const n of this.#view.slice(k, k + BLOCK_LINES)) {
				block += `${renderLine(n.l, n.i, this.#store.node(n.l, n.i))}\n`;
			}
			blocks.push(block);
		}
		if (blocks.length === 0) blocks.push("");
		blocks[0] = `<chat>\n${blocks[0]}`;
		blocks.push("</chat>");
		return blocks;
	}

	viewWholeBlocks(): number {
		return Math.floor(this.#view.length / BLOCK_LINES);
	}

	/** Snapshot of the chat view as [l, i] refs (tests, debugging). */
	viewRefs(): NodeRef[] {
		return this.#view.map(n => ({ ...n }));
	}

	#allBuilt(): boolean {
		return this.#view.every(n => this.#built(n.l, n.i));
	}

	settle(signal?: AbortSignal): Promise<boolean> {
		if (this.#closed) return Promise.resolve(false);
		// A turn waiting here is the next message arriving, so failed nodes get their retry now.
		this.#retryFailed();
		this.#pump();
		if (this.#allBuilt()) return Promise.resolve(true);
		if (signal?.aborted) return Promise.resolve(false);
		const { promise, resolve } = Promise.withResolvers<boolean>();
		const onAbort = () => {
			this.#waiters = this.#waiters.filter(w => w !== check);
			resolve(false);
		};
		const check = () => {
			if (this.#closed) {
				signal?.removeEventListener("abort", onAbort);
				resolve(false);
				return true;
			}
			if (!this.#allBuilt()) return false;
			signal?.removeEventListener("abort", onAbort);
			resolve(true);
			return true;
		};
		signal?.addEventListener("abort", onAbort, { once: true });
		this.#waiters.push(check);
		return promise;
	}

	#notify(): void {
		if (this.#waiters.length === 0) return;
		this.#waiters = this.#waiters.filter(check => !check());
	}

	zoom(id: number, n: number): string {
		if (!Number.isInteger(n) || n < 1 || !Number.isInteger(Math.log2(n))) {
			return `Error: n must be a power of 2 (1, 2, 4, ...), got ${n}.`;
		}
		if (!Number.isInteger(id) || id < 0 || id % n !== 0) {
			return `Error: id must be a non-negative multiple of n=${n}, got ${id}.`;
		}
		if (id >= this.count) return `Error: no message ${id}; the chat has ${this.count} messages.`;
		if (n === 1) {
			const msg = this.#store.messages[id];
			return `${id}+1 ${msg.kind}:\n${msg.text}`;
		}
		const l = Math.log2(n) - 1;
		const k = (id / n) * 2;
		const lines = [renderLine(l, k, this.#store.node(l, k))];
		if (id + n / 2 < this.count) lines.push(renderLine(l, k + 1, this.#store.node(l, k + 1)));
		return lines.join("\n");
	}

	date(id: number): string {
		if (!Number.isInteger(id) || id < 0 || id >= this.count) {
			return `Error: no message ${id}; the chat has ${this.count} messages.`;
		}
		return this.#store.messages[id].date;
	}

	async close(): Promise<void> {
		if (this.#closed) return;
		this.#closed = true;
		this.#abort.abort();
		await Promise.allSettled(this.#running);
		this.#notify();
		this.#store.close();
		await releaseLock(this.#lock, this.#dir);
	}

	// ---- compactor ----

	#messageReady(i: number): void {
		const msg = this.#store.messages[i];
		const source = `${msg.kind}: ${msg.text}`;
		if (byteLength(source) <= NODE_BYTES) {
			this.#store.appendNode({ l: 0, i, text: source, size: byteLength(source) });
			this.#onBuilt(0, i);
			return;
		}
		if (this.#queued.has(`0:${i}`)) return;
		this.#queued.add(`0:${i}`);
		this.#msgQueue.push(i);
	}

	#mergeReady(l: number, i: number): void {
		if (this.#queued.has(`${l}:${i}`)) return;
		const joined = `${this.#store.node(l - 1, 2 * i)}\n${this.#store.node(l - 1, 2 * i + 1)}`;
		if (byteLength(joined) <= NODE_BYTES) {
			this.#store.appendNode({ l, i, text: joined, size: byteLength(joined) });
			this.#onBuilt(l, i);
			return;
		}
		this.#queued.add(`${l}:${i}`);
		this.#mergeQueue.push({ l, i });
	}

	#onBuilt(l: number, i: number): void {
		if (this.#built(l, i ^ 1) && !this.#built(l + 1, i >> 1)) this.#mergeReady(l + 1, i >> 1);
	}

	#retryFailed(): void {
		const failed = this.#failed;
		this.#failed = [];
		for (const ref of failed) this.#start(ref);
	}

	#pump(): void {
		while (!this.#closed && this.#running.size < JOBS) {
			if (this.#msgHead < this.#msgQueue.length && this.#unbuiltMsgs.size < JOBS) {
				const i = this.#msgQueue[this.#msgHead++];
				this.#unbuiltMsgs.add(i);
				this.#start({ l: 0, i });
			} else if (this.#mergeHead < this.#mergeQueue.length) {
				this.#start(this.#mergeQueue[this.#mergeHead++]);
			} else {
				break;
			}
		}
		if (this.#msgHead === this.#msgQueue.length) {
			this.#msgQueue.length = 0;
			this.#msgHead = 0;
		}
		if (this.#mergeHead === this.#mergeQueue.length) {
			this.#mergeQueue.length = 0;
			this.#mergeHead = 0;
		}
	}

	#start(ref: NodeRef): void {
		if (this.#closed) return;
		const job = this.#build(ref).finally(() => {
			this.#running.delete(job);
			this.#pump();
		});
		this.#running.add(job);
	}

	/** Compaction view lines that end by message `end`, stopping at the first unbuilt one. */
	#compactionView(end: number): string {
		const lines: string[] = [];
		for (const n of this.#cview) {
			if ((n.i + 1) * 2 ** n.l > end) break;
			const text = this.#store.node(n.l, n.i);
			if (text === undefined) break;
			lines.push(renderLine(n.l, n.i, text));
		}
		return this.#render(lines);
	}

	async #build(ref: NodeRef): Promise<void> {
		const { l, i } = ref;
		const signal = this.#abort.signal;
		let view: string;
		let task: string;
		if (l === 0) {
			const msg = this.#store.messages[i];
			view = this.#compactionView(i);
			task = compressTask(i, `${msg.kind}: ${msg.text}`);
		} else {
			const n = 2 ** l;
			const a = { l: l - 1, i: 2 * i };
			const b = { l: l - 1, i: 2 * i + 1 };
			view = this.#compactionView((i + 1) * n);
			task = mergeTask(
				nodeName(a.l, a.i),
				nodeName(b.l, b.i),
				i * n,
				(i + 1) * n - 1,
				renderLine(a.l, a.i, this.#store.node(a.l, a.i)),
				renderLine(b.l, b.i, this.#store.node(b.l, b.i)),
			);
		}
		let best: string | undefined;
		try {
			const retries: Array<{ reply: string; feedback: string }> = [];
			for (let t = 0; t < TRIES; t++) {
				if (signal.aborted) return;
				// close() must not hang on a model call that ignores its signal.
				const { promise: aborted, reject } = Promise.withResolvers<never>();
				const onAbort = () => reject(signal.reason);
				signal.addEventListener("abort", onAbort, { once: true });
				let raw: string;
				try {
					raw = await Promise.race([this.#complete({ view, task, retries: retries.slice(), signal }), aborted]);
				} finally {
					signal.removeEventListener("abort", onAbort);
				}
				const reply = raw.trim();
				const size = byteLength(reply);
				if (reply && (best === undefined || size < byteLength(best))) best = reply;
				if (reply && size <= NODE_BYTES) break;
				retries.push({ reply, feedback: tooLongFeedback(size, headBytes(reply, NODE_BYTES)) });
			}
			if (best === undefined) throw new Error(`omem compaction of ${nodeName(l, i)} returned no text`);
		} catch (err) {
			if (signal.aborted) return;
			this.#failed.push(ref);
			this.#onError?.(err, { l, i });
			return;
		}
		if (this.#closed) return;
		this.#store.appendNode({ l, i, text: best, size: byteLength(best) });
		this.#queued.delete(`${l}:${i}`);
		if (l === 0) this.#unbuiltMsgs.delete(i);
		this.#onBuilt(l, i);
		this.#notify();
	}
}
