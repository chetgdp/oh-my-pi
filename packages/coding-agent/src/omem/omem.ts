import * as fs from "node:fs";
import type * as net from "node:net";
import * as path from "node:path";
import { getBaseConfigRoot } from "@oh-my-pi/pi-utils";
import { compressTask, mergeTask, SYSTEM_PROMPT, tooLongNote } from "./prompt";
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
	WHOLE_BYTES,
} from "./sizes";
import { acquireLock, type OmemKind, type OmemMessage, releaseLock, Store } from "./store";
import { foldView, type NodeRef, nodeName, renderLine } from "./view";

export type OmemCompleteFn = (req: {
	/** Compaction view cut into 4-line blocks, `"<chat>\n"` in the first, `"</chat>"` last. */
	viewBlocks: string[];
	/** Count of leading whole 4-line blocks; the cache mark goes on index `wholeBlocks - 1`. */
	wholeBlocks: number;
	/** Step text, sent as its own unmarked block after the view. */
	task: string;
	/** After a too-long line: feedback on the latest one only, sent as an unmarked block after the task. */
	note?: string;
	signal: AbortSignal;
}) => Promise<string>;

/** Thrown by an {@link OmemCompleteFn} when the model refuses; the node falls back to its clipped source. */
export class OmemRefusalError extends Error {
	constructor(message = "omem compaction refused") {
		super(message);
		this.name = "OmemRefusalError";
	}
}

export interface OmemOpenOptions {
	dir: string;
	complete: OmemCompleteFn;
	onError?: (err: unknown, node: { l: number; i: number }) => void;
	/** Delay before failed nodes are retried; tests shorten it. */
	retryMs?: number;
}

const RETRY_MS = 60_000;

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
	readonly #retryMs: number;
	#retryTimer: NodeJS.Timeout | undefined;
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
		this.#retryMs = opts.retryMs ?? RETRY_MS;
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

	/** Refs that tile messages 0..covered-1 in order, else undefined. */
	#covered(refs: readonly NodeRef[] | undefined): number | undefined {
		if (!refs) return undefined;
		let covered = 0;
		for (const n of refs) {
			if (n.i * 2 ** n.l !== covered) return undefined;
			covered += 2 ** n.l;
		}
		return covered <= this.count ? covered : undefined;
	}

	#load(): void {
		const T = this.count;
		const saved = this.#store.loadView();
		const covered = this.#covered(saved?.view);
		const valid = covered !== undefined;
		// No usable view.json (first run or corrupt): the only time the view is built from the log.
		this.#view = valid && saved ? saved.view : [];
		// Messages logged after the last view save (crash in between) get their lines now.
		for (let i = covered ?? 0; i < T; i++) this.#view.push({ l: 0, i });
		if (!valid) {
			foldView(this.#view, T, VIEW_LOW, this.#bytes(this.#view), this.#canMerge, this.#lineSize);
		}
		this.#draining = valid && saved ? saved.draining : false;

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
		const ccovered = valid ? this.#covered(saved?.cview) : undefined;
		if (ccovered !== undefined && saved?.cview) {
			this.#cview = saved.cview;
			for (let i = ccovered; i < T; i++) this.#cview.push({ l: 0, i });
		} else {
			this.#resetCView();
		}
		this.#saveView();
		this.#pump();
	}

	#saveView(): void {
		this.#store.saveView({ view: this.#view, cview: this.#cview, draining: this.#draining });
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
		this.#saveView();
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

	/** View lines covering only messages before `end`. */
	#viewTo(end: number): NodeRef[] {
		return end >= this.count ? this.#view : this.#view.filter(n => (n.i + 1) * 2 ** n.l <= end);
	}

	/**
	 * The view up to message `end`, cut for cache marks: `["<chat>\n" + lines 0-3, lines 4-7, ..., partial
	 * block?, "</chat>"]`. The first `viewWholeBlocks(end)` entries are whole 4-line blocks.
	 */
	viewBlocks(end = this.count): string[] {
		const view = this.#viewTo(end);
		const blocks: string[] = [];
		for (let k = 0; k < view.length; k += BLOCK_LINES) {
			let block = "";
			for (const n of view.slice(k, k + BLOCK_LINES)) {
				block += `${renderLine(n.l, n.i, this.#store.node(n.l, n.i))}\n`;
			}
			blocks.push(block);
		}
		if (blocks.length === 0) blocks.push("");
		blocks[0] = `<chat>\n${blocks[0]}`;
		blocks.push("</chat>");
		return blocks;
	}

	viewWholeBlocks(end = this.count): number {
		return Math.floor(this.#viewTo(end).length / BLOCK_LINES);
	}

	/**
	 * The first message, from `first` on, from which the rest go whole in a turn: at most WHOLE_BYTES
	 * counted from the end, the last message always. Earlier ones reach the turn as view lines.
	 */
	wholeFrom(first: number): number {
		let size = 0;
		for (let k = this.count; k > first; k--) {
			size += this.#store.messages[k - 1].size;
			if (k < this.count && size > WHOLE_BYTES) return k;
		}
		return first;
	}

	/** Snapshot of the chat view as [l, i] refs (tests, debugging). */
	viewRefs(): NodeRef[] {
		return this.#view.map(n => ({ ...n }));
	}

	/** View nodes a settle still waits for. */
	pendingNodes(): number {
		let n = 0;
		for (const ref of this.#view) if (!this.#built(ref.l, ref.i)) n++;
		return n;
	}

	#allBuilt(end: number): boolean {
		return this.#viewTo(end).every(n => this.#built(n.l, n.i));
	}

	/** Resolves true once every view line before message `end` is built; false if aborted or closed. */
	settle(signal?: AbortSignal, end = Number.POSITIVE_INFINITY): Promise<boolean> {
		if (this.#closed) return Promise.resolve(false);
		// A turn waiting here is the next message arriving, so failed nodes get their retry now.
		this.#retryFailed();
		this.#pump();
		if (this.#allBuilt(end)) return Promise.resolve(true);
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
			if (!this.#allBuilt(end)) return false;
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
		if (
			!Number.isInteger(n) ||
			n < 1 ||
			!Number.isInteger(Math.log2(n)) ||
			!Number.isInteger(id) ||
			id < 0 ||
			id % n !== 0 ||
			id + n > this.count
		) {
			const roots: string[] = [];
			for (let l = 30, at = 0; l >= 0; l--) {
				if (at + 2 ** l <= this.count) {
					roots.push(nodeName(l, at / 2 ** l));
					at += 2 ** l;
				}
			}
			return `Error: no line ${id}+${n}: n is a power of 2, id a multiple of n, and id+n at most the chat's ${this.count} messages. The tree's roots: ${roots.join(", ") || "none"}.`;
		}
		if (n === 1) {
			const msg = this.#store.messages[id];
			return `${id}+1 ${msg.kind}:\n${msg.text}`;
		}
		const l = Math.log2(n) - 1;
		const k = (id / n) * 2;
		return `${renderLine(l, k, this.#store.node(l, k))}\n${renderLine(l, k + 1, this.#store.node(l, k + 1))}`;
	}

	/** Local time, `YYYY-MM-DD HH:MM:SS`. */
	date(id: number): string {
		if (!Number.isInteger(id) || id < 0 || id >= this.count) {
			return `Error: no message ${id}; the chat has ${this.count} messages.`;
		}
		return new Date(this.#store.messages[id].date).toLocaleString("sv-SE");
	}

	async close(): Promise<void> {
		if (this.#closed) return;
		this.#closed = true;
		clearTimeout(this.#retryTimer);
		this.#abort.abort();
		await Promise.allSettled(this.#running);
		this.#notify();
		this.#store.close();
		await releaseLock(this.#lock, this.#dir);
	}

	// ---- compactor ----

	#source(l: number, i: number): string {
		if (l === 0) {
			const msg = this.#store.messages[i];
			return `${msg.kind}: ${msg.text}`;
		}
		return `${this.#store.node(l - 1, 2 * i)}\n${this.#store.node(l - 1, 2 * i + 1)}`;
	}

	#messageReady(i: number): void {
		const source = this.#source(0, i);
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
		const joined = this.#source(l, i);
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

	/** Failed nodes retry on a timer too, so a waiting settle resolves without new messages. */
	#scheduleRetry(): void {
		if (this.#closed || this.#retryTimer !== undefined) return;
		this.#retryTimer = setTimeout(() => {
			this.#retryTimer = undefined;
			this.#retryFailed();
			this.#pump();
		}, this.#retryMs);
		this.#retryTimer.unref?.();
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

	/** Compaction view blocks of lines that end by message `end`, stopping at the first unbuilt one. */
	#compactionView(end: number): { viewBlocks: string[]; wholeBlocks: number } {
		const lines: string[] = [];
		for (const n of this.#cview) {
			if ((n.i + 1) * 2 ** n.l > end) break;
			const text = this.#store.node(n.l, n.i);
			if (text === undefined) break;
			lines.push(renderLine(n.l, n.i, text));
		}
		const viewBlocks: string[] = [];
		for (let k = 0; k < lines.length; k += BLOCK_LINES) {
			viewBlocks.push(
				lines
					.slice(k, k + BLOCK_LINES)
					.map(s => `${s}\n`)
					.join(""),
			);
		}
		if (viewBlocks.length === 0) viewBlocks.push("");
		viewBlocks[0] = `<chat>\n${viewBlocks[0]}`;
		viewBlocks.push("</chat>");
		return { viewBlocks, wholeBlocks: Math.floor(lines.length / BLOCK_LINES) };
	}

	async #build(ref: NodeRef): Promise<void> {
		const { l, i } = ref;
		const signal = this.#abort.signal;
		const source = this.#source(l, i);
		let view: { viewBlocks: string[]; wholeBlocks: number };
		let task: string;
		if (l === 0) {
			view = this.#compactionView(i);
			task = compressTask(i, source);
		} else {
			const n = 2 ** l;
			view = this.#compactionView((i + 1) * n);
			// Input lines carry no id heads: a compaction call holds no ids the model could copy.
			task = mergeTask(
				nodeName(l - 1, 2 * i),
				nodeName(l - 1, 2 * i + 1),
				i * n,
				(i + 1) * n - 1,
				flat(this.#store.node(l - 1, 2 * i) ?? ""),
				flat(this.#store.node(l - 1, 2 * i + 1) ?? ""),
			);
		}
		let best: string | undefined;
		try {
			let note: string | undefined;
			for (let t = 0; t < TRIES; t++) {
				if (signal.aborted) return;
				// close() must not hang on a model call that ignores its signal.
				const { promise: aborted, reject } = Promise.withResolvers<never>();
				const onAbort = () => reject(signal.reason);
				signal.addEventListener("abort", onAbort, { once: true });
				let raw: string;
				try {
					raw = await Promise.race([this.#complete({ ...view, task, note, signal }), aborted]);
				} finally {
					signal.removeEventListener("abort", onAbort);
				}
				const reply = raw.trim();
				if (!reply) continue;
				const size = byteLength(reply);
				if (best === undefined || size < byteLength(best)) best = reply;
				if (size <= NODE_BYTES) break;
				note = tooLongNote(size, headBytes(reply, NODE_BYTES));
			}
		} catch (err) {
			if (signal.aborted) return;
			if (!(err instanceof OmemRefusalError) && best === undefined) {
				this.#failed.push(ref);
				this.#scheduleRetry();
				this.#onError?.(err, { l, i });
				return;
			}
			if (best === undefined) this.#onError?.(err, { l, i });
		}
		if (this.#closed) return;
		// Refusals and empty replies are the input's doing, so retrying cannot help: keep its head.
		const text = best ?? headBytes(flat(source), NODE_BYTES);
		this.#store.appendNode({ l, i, text, size: byteLength(text) });
		this.#queued.delete(`${l}:${i}`);
		if (l === 0) this.#unbuiltMsgs.delete(i);
		this.#onBuilt(l, i);
		this.#notify();
	}
}

function flat(text: string): string {
	return text.replace(/\r?\n/g, " ");
}
