import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import type { NodeRef } from "./view";

export type OmemKind = "user" | "agent" | "tool" | "echo" | "work" | "note";
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
		for (const line of raw.slice(0, end).split("\n")) {
			if (!line) continue;
			try {
				out.push(JSON.parse(line) as T);
			} catch {
				// A torn line followed by later writes from an older version; it never committed.
			}
		}
	}
	return out;
}

/** Append-only day-split JSONL writer; every line is fsync'd before returning. */
class DayLog {
	#fd: number | undefined;
	#day = "";
	constructor(readonly dir: string) {}

	append(record: object, date: string): void {
		const day = date.slice(0, 10);
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
		for (const msg of readDayFiles<OmemMessage>(mainDir)) {
			if (msg.i !== this.messages.length) {
				throw new Error(`omem log corrupt: expected message ${this.messages.length}, found ${msg.i}`);
			}
			this.messages.push(msg);
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
		this.#main.append(msg, msg.date);
		this.messages.push(msg);
	}

	appendNode(rec: TreeRecord): void {
		this.#tree.append(rec, new Date().toISOString());
		this.#setNode(rec.l, rec.i, rec.text);
	}

	loadView(): NodeRef[] | undefined {
		let raw: string;
		try {
			raw = fs.readFileSync(this.#viewFile, "utf8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw err;
		}
		return (JSON.parse(raw) as [number, number][]).map(([l, i]) => ({ l, i }));
	}

	/** Write-then-rename so a crash leaves the previous view, never a torn one. */
	saveView(view: readonly NodeRef[]): void {
		const tmp = `${this.#viewFile}.tmp`;
		const fd = fs.openSync(tmp, "w");
		try {
			fs.writeSync(fd, JSON.stringify(view.map(n => [n.l, n.i])));
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
