import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { isRecord } from "@oh-my-pi/pi-utils";
import * as logger from "@oh-my-pi/pi-utils/logger";
import type { NodeRef } from "./view";

export type OmemKind = "user" | "agent" | "tool" | "echo" | "note";
export interface OmemMessage {
	i: number;
	kind: OmemKind;
	text: string;
	size: number;
	date: string;
}
export interface TreeRecord {
	l: number;
	i: number;
	text: string;
	size: number;
}

export interface SavedView {
	view: NodeRef[];
	/** Compaction view; absent in view.json files written before it was saved. */
	cview?: NodeRef[];
	draining: boolean;
}
export class OmemLockedError extends Error {
	readonly dir: string;
	constructor(dir: string) {
		super(`omem store is locked by another process: ${dir}`);
		this.name = "OmemLockedError";
		this.dir = dir;
	}
}

/**
 * Lock held by listening on a unix socket: the kernel drops it when the process
 * dies, and a live owner answers connects, so a stale socket file is detectable.
 */
export async function acquireLock(dir: string): Promise<net.Server> {
	const sock = path.join(dir, "lock");
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			return await listen(sock);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
		}
		if (await answers(sock)) throw new OmemLockedError(dir);
		fs.rmSync(sock, { force: true });
	}
	throw new OmemLockedError(dir);
}

function listen(sock: string): Promise<net.Server> {
	const { promise, resolve, reject } = Promise.withResolvers<net.Server>();
	const server = net.createServer(conn => conn.end());
	server.once("error", reject);
	server.listen(sock, () => {
		server.off("error", reject);
		resolve(server);
	});
	return promise;
}

function answers(sock: string): Promise<boolean> {
	const { promise, resolve } = Promise.withResolvers<boolean>();
	const conn = net.connect(sock);
	conn.once("connect", () => {
		conn.destroy();
		resolve(true);
	});
	conn.once("error", () => resolve(false));
	return promise;
}

export function releaseLock(server: net.Server, dir: string): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	server.close(() => resolve());
	fs.rmSync(path.join(dir, "lock"), { force: true });
	return promise;
}

/**
 * Reads every `*.jsonl` in `dir` in name order. A final line without its newline
 * is a torn write: it is cut off so the next append starts on a clean line.
 * A bad line elsewhere is skipped and reported; callers index records by their ids.
 */
function readDayFiles<T>(dir: string): T[] {
	fs.mkdirSync(dir, { recursive: true });
	const out: T[] = [];
	const names = fs
		.readdirSync(dir)
		.filter(n => n.endsWith(".jsonl"))
		.sort();
	for (const name of names) {
		const file = path.join(dir, name);
		const raw = fs.readFileSync(file, "utf8");
		const end = raw.lastIndexOf("\n") + 1;
		if (end < raw.length) fs.truncateSync(file, Buffer.byteLength(raw.slice(0, end), "utf8"));
		const lines = raw.slice(0, end).split("\n");
		for (let k = 0; k < lines.length; k++) {
			const line = lines[k];
			if (!line) continue;
			let rec: unknown;
			try {
				rec = JSON.parse(line);
			} catch {
				rec = undefined;
			}
			if (isRecord(rec) && Number.isInteger(rec.i) && typeof rec.text === "string") {
				out.push(rec as T);
			} else {
				logger.warn("omem: skipped corrupt log line", { file, line: k + 1 });
			}
		}
	}
	return out;
}

/** Append-only day-split JSONL writer named by the user's local date; every line is fsync'd. */
class DayLog {
	#fd: number | undefined;
	#day = "";
	constructor(readonly dir: string) {}

	append(record: object): void {
		const day = new Date().toLocaleDateString("sv-SE");
		if (this.#fd === undefined || day !== this.#day) {
			this.close();
			this.#fd = fs.openSync(path.join(this.dir, `${day}.jsonl`), "a");
			this.#day = day;
		}
		fs.writeSync(this.#fd, `${JSON.stringify(record)}\n`);
		fs.fsyncSync(this.#fd);
	}

	close(): void {
		if (this.#fd !== undefined) fs.closeSync(this.#fd);
		this.#fd = undefined;
	}
}

export class Store {
	readonly messages: OmemMessage[] = [];
	/** levels[l][i] is the built text of node (l, i). */
	readonly levels: (string | undefined)[][] = [];
	readonly #main: DayLog;
	readonly #tree: DayLog;
	readonly #viewFile: string;

	constructor(readonly dir: string) {
		const mainDir = path.join(dir, "main");
		const treeDir = path.join(dir, "tree");
		for (const msg of readDayFiles<OmemMessage>(mainDir)) this.messages[msg.i] = msg;
		for (let i = 0; i < this.messages.length; i++) {
			if (this.messages[i] === undefined) {
				throw new Error(`omem log corrupt: message ${i} of ${this.messages.length} is missing from ${mainDir}`);
			}
		}
		for (const rec of readDayFiles<TreeRecord>(treeDir)) this.#setNode(rec.l, rec.i, rec.text);
		this.#main = new DayLog(mainDir);
		this.#tree = new DayLog(treeDir);
		this.#viewFile = path.join(dir, "view.json");
	}

	#setNode(l: number, i: number, text: string): void {
		while (this.levels.length <= l) this.levels.push([]);
		this.levels[l][i] = text;
	}

	node(l: number, i: number): string | undefined {
		return this.levels[l]?.[i];
	}

	appendMessage(msg: OmemMessage): void {
		this.#main.append(msg);
		this.messages.push(msg);
	}

	appendNode(rec: TreeRecord): void {
		this.#tree.append(rec);
		this.#setNode(rec.l, rec.i, rec.text);
	}

	/** Old view.json files hold only the chat view as an array; they still load. */
	loadView(): SavedView | undefined {
		let raw: string;
		try {
			raw = fs.readFileSync(this.#viewFile, "utf8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw err;
		}
		let data: unknown;
		try {
			data = JSON.parse(raw);
		} catch {
			return undefined;
		}
		const refs = (v: unknown): NodeRef[] | undefined =>
			Array.isArray(v) && v.every(p => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]))
				? (v as [number, number][]).map(([l, i]) => ({ l, i }))
				: undefined;
		if (Array.isArray(data)) {
			const view = refs(data);
			return view && { view, draining: false };
		}
		if (!isRecord(data)) return undefined;
		const view = refs(data.view);
		if (!view) return undefined;
		return { view, cview: refs(data.cview), draining: data.draining === true };
	}

	/** Write-then-rename so a crash leaves the previous view, never a torn one. */
	saveView(saved: SavedView): void {
		const pairs = (v: readonly NodeRef[]) => v.map(n => [n.l, n.i]);
		const tmp = `${this.#viewFile}.tmp`;
		const fd = fs.openSync(tmp, "w");
		try {
			fs.writeSync(
				fd,
				JSON.stringify({
					view: pairs(saved.view),
					cview: saved.cview && pairs(saved.cview),
					draining: saved.draining,
				}),
			);
			fs.fsyncSync(fd);
		} finally {
			fs.closeSync(fd);
		}
		fs.renameSync(tmp, this.#viewFile);
	}

	close(): void {
		this.#main.close();
		this.#tree.close();
	}
}
