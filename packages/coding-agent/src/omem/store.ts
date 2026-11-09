import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { isRecord } from "@oh-my-pi/pi-utils";
import * as logger from "@oh-my-pi/pi-utils/logger";
import type { NodeRef } from "./view";

export type OmemKind = "user" | "agent" | "tool" | "echo" | "note";
/** An image kept with its message; bytes live in the `images/` blob store under `hash`. */
export interface OmemImage {
	hash: string;
	mimeType: string;
}
/**
 * Where a `read` result came from. The result text as seen lives in the `blobs/` store
 * under `hash`; `target` may have changed since `at` (ISO time of the read).
 */
export interface OmemRef {
	source: "file" | "url" | "internal";
	/** Absolute path for files; the URL or internal URI as passed otherwise. */
	target: string;
	/** Selector from the call, e.g. `50-100`. */
	range?: string;
	hash: string;
	at: string;
	/** sha256 of the file's bytes when logged, for files up to a size bound; compared on zoom. */
	file?: string;
}
export interface OmemMessage {
	i: number;
	kind: OmemKind;
	text: string;
	size: number;
	date: string;
	images?: OmemImage[];
	/** Full echo text in the `blobs/` store when `text` was clipped. */
	blob?: string;
	/** Source of a `read` result; its full text is in `blobs/` under `ref.hash`. */
	ref?: OmemRef;
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
export function readDayFiles<T>(dir: string): T[] {
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
export class DayLog {
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

/** Index file header: magic `OMX1`, then the log kind (0 main, 1 tree). */
const IDX_MAGIC = 0x31584d4f;
const IDX_HEADER = 8;
/** u32 fields per slot: [offset, length, a, b]; main a=i b=size, tree a=l b=i. */
const SLOT = 4;
/** `a` of a slot that covers a corrupt line, so the tail scan does not see it again. */
const SKIP = 0xffffffff;
const NL = 0x0a;
const MAX_FDS = 16;
const MAX_NODE_TEXTS = 8192;
const MAX_MESSAGES = 256;

const LogKind = { Main: 0, Tree: 1 } as const;
type LogKind = (typeof LogKind)[keyof typeof LogKind];

function idxPath(log: string): string {
	return `${log.slice(0, -".jsonl".length)}.idx`;
}

function idxHeader(kind: LogKind): Buffer {
	const head = Buffer.alloc(IDX_HEADER);
	head.writeUInt32LE(IDX_MAGIC, 0);
	head.writeUInt32LE(kind, 4);
	return head;
}

function slotBytes(slots: Uint32Array): Buffer {
	return Buffer.from(slots.buffer, slots.byteOffset, slots.byteLength);
}

/** Byte just past the newline of the last slot, or 0. */
function slotsEnd(slots: Uint32Array): number {
	const n = slots.length;
	return n === 0 ? 0 : slots[n - SLOT] + slots[n - SLOT + 1] + 1;
}

/** The record's [a, b] slot fields, or undefined when the line is not a valid record of `kind`. */
function recordKeys(kind: LogKind, rec: unknown): [number, number] | undefined {
	if (!isRecord(rec) || !Number.isInteger(rec.i) || (rec.i as number) < 0 || typeof rec.text !== "string") {
		return undefined;
	}
	if (kind === LogKind.Main) {
		const size = typeof rec.size === "number" ? rec.size : Buffer.byteLength(rec.text);
		return [rec.i as number, size >>> 0];
	}
	if (!Number.isInteger(rec.l) || (rec.l as number) < 0) return undefined;
	return [rec.l as number, rec.i as number];
}

function parseLine(bytes: Buffer): unknown {
	try {
		return JSON.parse(bytes.toString("utf8"));
	} catch {
		return undefined;
	}
}

/** Bounded LRU: a hit moves the key to the young end. */
class Lru<K, V> {
	readonly #map = new Map<K, V>();
	constructor(readonly limit: number) {}
	get(key: K): V | undefined {
		const v = this.#map.get(key);
		if (v !== undefined) {
			this.#map.delete(key);
			this.#map.set(key, v);
		}
		return v;
	}
	set(key: K, v: V): void {
		this.#map.delete(key);
		this.#map.set(key, v);
		if (this.#map.size > this.limit) this.#map.delete(this.#map.keys().next().value as K);
	}
	clear(): void {
		this.#map.clear();
	}
}

/** Read fds for positioned reads, a few at a time; the oldest closes first. */
class FdCache {
	readonly #fds = new Map<string, number>();
	fd(file: string): number {
		let fd = this.#fds.get(file);
		if (fd !== undefined) {
			this.#fds.delete(file);
			this.#fds.set(file, fd);
			return fd;
		}
		fd = fs.openSync(file, "r");
		this.#fds.set(file, fd);
		if (this.#fds.size > MAX_FDS) {
			const [old, oldFd] = this.#fds.entries().next().value as [string, number];
			this.#fds.delete(old);
			fs.closeSync(oldFd);
		}
		return fd;
	}
	read(file: string, offset: number, length: number): Buffer {
		const buf = Buffer.allocUnsafe(length);
		const fd = this.fd(file);
		let got = 0;
		while (got < length) {
			const n = fs.readSync(fd, buf, got, length - got, offset + got);
			if (n === 0) break;
			got += n;
		}
		return got === length ? buf : buf.subarray(0, got);
	}
	close(): void {
		for (const fd of this.#fds.values()) fs.closeSync(fd);
		this.#fds.clear();
	}
}

/**
 * One day log (`*.jsonl`) and its derived index (`*.idx`) per day. The log is the
 * source of truth; the index holds one 16-byte slot per line, so open reads no log
 * text except lines written after the index (a crash between line and slot).
 */
class IndexedLog {
	readonly files: string[] = [];
	#fd: number | undefined;
	#idxFd: number | undefined;
	#day = "";
	#file = -1;
	#size = 0;
	constructor(
		readonly dir: string,
		readonly kind: LogKind,
		readonly reader: FdCache,
	) {}

	/** Calls `onSlot` for every valid line of every day file, in name then file order. */
	load(onSlot: (file: number, offset: number, length: number, a: number, b: number) => void): void {
		fs.mkdirSync(this.dir, { recursive: true });
		const names = fs
			.readdirSync(this.dir)
			.filter(n => n.endsWith(".jsonl"))
			.sort();
		for (const name of names) {
			const log = path.join(this.dir, name);
			const file = this.files.push(log) - 1;
			const slots = this.#slots(log);
			for (let s = 0; s < slots.length; s += SLOT) {
				if (slots[s + 2] !== SKIP) onSlot(file, slots[s], slots[s + 1], slots[s + 2], slots[s + 3]);
			}
		}
	}

	/** The log's slots: its index, revalidated, plus slots for any unindexed tail. */
	#slots(log: string): Uint32Array {
		const idx = idxPath(log);
		const logSize = fs.statSync(log).size;
		const why = { reason: "" };
		let slots = this.#readIndex(idx, log, logSize, why);
		let rebuild = false;
		if (!slots) {
			logger.warn("omem: rebuilding log index", { file: log, reason: why.reason });
			slots = new Uint32Array(0);
			rebuild = true;
		}
		const covered = slotsEnd(slots);
		const tail = covered < logSize ? this.#scan(log, covered, logSize) : new Uint32Array(0);
		if (rebuild) {
			const tmp = `${idx}.tmp`;
			fs.writeFileSync(tmp, Buffer.concat([idxHeader(this.kind), slotBytes(tail)]));
			fs.renameSync(tmp, idx);
			return tail;
		}
		if (tail.length === 0) return slots;
		fs.appendFileSync(idx, slotBytes(tail));
		const all = new Uint32Array(slots.length + tail.length);
		all.set(slots);
		all.set(tail, slots.length);
		return all;
	}

	#readIndex(idx: string, log: string, logSize: number, why: { reason: string }): Uint32Array | undefined {
		let raw: Buffer;
		try {
			raw = fs.readFileSync(idx);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
			why.reason = "missing";
			return undefined;
		}
		if (
			raw.length < IDX_HEADER ||
			(raw.length - IDX_HEADER) % (SLOT * 4) !== 0 ||
			raw.readUInt32LE(0) !== IDX_MAGIC ||
			raw.readUInt32LE(4) !== this.kind
		) {
			why.reason = "bad header or size";
			return undefined;
		}
		// Copied out of the read buffer: a pooled Buffer may not be 4-byte aligned. Slots are little-endian.
		const slots = new Uint32Array((raw.length - IDX_HEADER) / 4);
		slotBytes(slots).set(raw.subarray(IDX_HEADER));
		let end = 0;
		let first = -1;
		let last = -1;
		for (let s = 0; s < slots.length; s += SLOT) {
			if (slots[s] < end || slots[s + 1] === 0) {
				why.reason = "slots out of order";
				return undefined;
			}
			end = slots[s] + slots[s + 1] + 1;
			if (slots[s + 2] !== SKIP) {
				if (first < 0) first = s;
				last = s;
			}
		}
		if (end > logSize) {
			why.reason = "covers more than the log";
			return undefined;
		}
		for (const s of first < 0 ? [] : first === last ? [first] : [first, last]) {
			if (!this.#slotMatches(log, slots, s)) {
				why.reason = "slot does not match its line";
				return undefined;
			}
		}
		return slots;
	}

	/** The slot's bytes are a whole line holding the record the slot names. */
	#slotMatches(log: string, slots: Uint32Array, s: number): boolean {
		const off = slots[s];
		const len = slots[s + 1];
		const from = off === 0 ? 0 : off - 1;
		const bytes = this.reader.read(log, from, off - from + len + 1);
		if (bytes.length !== off - from + len + 1) return false;
		if ((off > 0 && bytes[0] !== NL) || bytes[bytes.length - 1] !== NL) return false;
		const line = bytes.subarray(off - from, off - from + len);
		const keys = recordKeys(this.kind, parseLine(line));
		return keys !== undefined && keys[0] === slots[s + 2] && keys[1] === slots[s + 3];
	}

	/**
	 * Slots for lines in bytes [from, size). A final line without its newline is a torn
	 * write: it is cut off so the next append starts on a clean line. A bad line is
	 * reported and gets a SKIP slot.
	 */
	#scan(log: string, from: number, size: number): Uint32Array {
		const bytes = this.reader.read(log, from, size - from);
		const end = bytes.lastIndexOf(NL) + 1;
		if (from + end < size) {
			fs.truncateSync(log, from + end);
		}
		const out: number[] = [];
		let lineNo = 0;
		for (let at = 0; at < end;) {
			const nl = bytes.indexOf(NL, at);
			lineNo++;
			if (nl > at) {
				const line = bytes.subarray(at, nl);
				const keys = recordKeys(this.kind, parseLine(line));
				if (keys) {
					out.push(from + at, nl - at, keys[0], keys[1]);
				} else {
					logger.warn("omem: skipped corrupt log line", { file: log, offset: from + at, line: lineNo });
					out.push(from + at, nl - at, SKIP, 0);
				}
			}
			at = nl + 1;
		}
		return Uint32Array.from(out);
	}

	/** Appends the line (fsync'd), then its slot; returns the line's file id, offset and length. */
	append(record: object, a: number, b: number): [number, number, number] {
		const day = new Date().toLocaleDateString("sv-SE");
		if (this.#fd === undefined || day !== this.#day) this.#open(day);
		const line = Buffer.from(`${JSON.stringify(record)}\n`);
		const off = this.#size;
		fs.writeSync(this.#fd!, line);
		fs.fsyncSync(this.#fd!);
		this.#size += line.length;
		const len = line.length - 1;
		fs.writeSync(this.#idxFd!, slotBytes(Uint32Array.of(off, len, a, b)));
		return [this.#file, off, len];
	}

	#open(day: string): void {
		this.close();
		const log = path.join(this.dir, `${day}.jsonl`);
		let file = this.files.indexOf(log);
		if (file < 0) file = this.files.push(log) - 1;
		this.#fd = fs.openSync(log, "a");
		this.#size = fs.fstatSync(this.#fd).size;
		this.#idxFd = fs.openSync(idxPath(log), "a");
		if (fs.fstatSync(this.#idxFd).size === 0) fs.writeSync(this.#idxFd, idxHeader(this.kind));
		this.#day = day;
		this.#file = file;
	}

	close(): void {
		if (this.#fd !== undefined) fs.closeSync(this.#fd);
		if (this.#idxFd !== undefined) fs.closeSync(this.#idxFd);
		this.#fd = undefined;
		this.#idxFd = undefined;
	}
}

/** Grows a Uint32Array to hold at least `need` entries. */
function grow(arr: Uint32Array, need: number): Uint32Array {
	if (need <= arr.length) return arr;
	const next = new Uint32Array(Math.max(need, arr.length * 2, 64));
	next.set(arr);
	return next;
}

/**
 * Messages and tree nodes, addressed through per-line metadata in typed arrays;
 * texts are read from the logs on demand through bounded caches.
 */
export class Store {
	/** Per message id: [file, offset, length, size]; length 0 means absent. */
	#msgs: Uint32Array = new Uint32Array(0);
	#count = 0;
	/** Per level, per node index: [file, offset, length]; length 0 means absent. */
	readonly #levels: Uint32Array[] = [];
	readonly #levelLen: number[] = [];
	readonly #reader = new FdCache();
	readonly #texts = new Lru<number, string>(MAX_NODE_TEXTS);
	readonly #messages = new Lru<number, OmemMessage>(MAX_MESSAGES);
	readonly #main: IndexedLog;
	readonly #tree: IndexedLog;
	readonly #viewFile: string;

	constructor(readonly dir: string) {
		const mainDir = path.join(dir, "main");
		this.#main = new IndexedLog(mainDir, LogKind.Main, this.#reader);
		this.#tree = new IndexedLog(path.join(dir, "tree"), LogKind.Tree, this.#reader);
		this.#viewFile = path.join(dir, "view.json");
		try {
			this.#main.load((file, off, len, i, size) => this.#setMessage(i, file, off, len, size));
			for (let i = 0; i < this.#count; i++) {
				if (this.#msgs[i * 4 + 2] === 0) {
					throw new Error(`omem log corrupt: message ${i} of ${this.#count} is missing from ${mainDir}`);
				}
			}
			this.#tree.load((file, off, len, l, i) => this.#setNode(l, i, file, off, len));
		} catch (err) {
			this.#reader.close();
			throw err;
		}
	}

	#setMessage(i: number, file: number, off: number, len: number, size: number): void {
		const m = grow(this.#msgs, (i + 1) * 4);
		this.#msgs = m;
		m[i * 4] = file;
		m[i * 4 + 1] = off;
		m[i * 4 + 2] = len;
		m[i * 4 + 3] = size;
		if (i >= this.#count) this.#count = i + 1;
	}

	#setNode(l: number, i: number, file: number, off: number, len: number): void {
		while (this.#levels.length <= l) {
			this.#levels.push(new Uint32Array(0));
			this.#levelLen.push(0);
		}
		const level = grow(this.#levels[l], (i + 1) * 3);
		this.#levels[l] = level;
		level[i * 3] = file;
		level[i * 3 + 1] = off;
		level[i * 3 + 2] = len;
		if (i >= this.#levelLen[l]) this.#levelLen[l] = i + 1;
	}

	/** Messages 0..count-1 all exist. */
	get count(): number {
		return this.#count;
	}

	/** Text bytes of message `i`. */
	size(i: number): number {
		return this.#msgs[i * 4 + 3];
	}

	message(i: number): OmemMessage | undefined {
		if (!Number.isInteger(i) || i < 0 || i >= this.#count) return undefined;
		let msg = this.#messages.get(i);
		if (msg === undefined) {
			const m = this.#msgs;
			msg = this.#readRecord(this.#main.files[m[i * 4]], m[i * 4 + 1], m[i * 4 + 2]) as unknown as OmemMessage;
			this.#messages.set(i, msg);
		}
		return msg;
	}

	get levelCount(): number {
		return this.#levels.length;
	}

	/** One past the highest node index logged at level `l`. */
	levelLength(l: number): number {
		return this.#levelLen[l] ?? 0;
	}

	hasNode(l: number, i: number): boolean {
		const level = this.#levels[l];
		return level !== undefined && i >= 0 && i * 3 + 2 < level.length && level[i * 3 + 2] !== 0;
	}

	node(l: number, i: number): string | undefined {
		if (!this.hasNode(l, i)) return undefined;
		const key = i * 64 + l;
		let text = this.#texts.get(key);
		if (text === undefined) {
			const level = this.#levels[l];
			const rec = this.#readRecord(this.#tree.files[level[i * 3]], level[i * 3 + 1], level[i * 3 + 2]);
			text = rec.text as string;
			this.#texts.set(key, text);
		}
		return text;
	}

	/** One positioned read of a line that the index or tail scan already parsed once. */
	#readRecord(file: string, off: number, len: number): Record<string, unknown> {
		const rec = parseLine(this.#reader.read(file, off, len));
		if (!isRecord(rec) || typeof rec.text !== "string") {
			throw new Error(`omem log changed under the store: ${file} at byte ${off}`);
		}
		return rec;
	}

	appendMessage(msg: OmemMessage): void {
		const [file, off, len] = this.#main.append(msg, msg.i, msg.size);
		this.#setMessage(msg.i, file, off, len, msg.size);
		this.#messages.set(msg.i, msg);
	}

	appendNode(rec: TreeRecord): void {
		const [file, off, len] = this.#tree.append(rec, rec.l, rec.i);
		this.#setNode(rec.l, rec.i, file, off, len);
		this.#texts.set(rec.i * 64 + rec.l, rec.text);
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
		this.#reader.close();
		this.#texts.clear();
		this.#messages.clear();
	}
}
