import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Omem } from "@oh-my-pi/pi-coding-agent/omem/index";
import { type OmemMessage, readDayFiles, Store } from "@oh-my-pi/pi-coding-agent/omem/store";

const dirs: string[] = [];
const stores: Store[] = [];

function tmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omem-idx-"));
	dirs.push(dir);
	fs.mkdirSync(path.join(dir, "main"), { recursive: true });
	fs.mkdirSync(path.join(dir, "tree"), { recursive: true });
	return dir;
}

function open(dir: string): Store {
	const store = new Store(dir);
	stores.push(store);
	return store;
}

function closeAll(): void {
	for (const s of stores.splice(0)) s.close();
}

afterEach(() => {
	closeAll();
	for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const m = (i: number, text = `m${i}`, extra: object = {}) =>
	`${JSON.stringify({ i, kind: "user", text, size: Buffer.byteLength(text), date: "2026-01-01T00:00:00.000Z", ...extra })}\n`;
const t = (l: number, i: number, text = `n${l}.${i}`) =>
	`${JSON.stringify({ l, i, text, size: Buffer.byteLength(text) })}\n`;

const mainLog = (dir: string, day: string) => path.join(dir, "main", `${day}.jsonl`);
const mainIdx = (dir: string, day: string) => path.join(dir, "main", `${day}.idx`);

/** What the pre-index store returned: every line parsed, later ids win. */
function oldMessages(dir: string): OmemMessage[] {
	const out: OmemMessage[] = [];
	for (const msg of readDayFiles<OmemMessage>(path.join(dir, "main"))) out[msg.i] = msg;
	return out;
}

function expectSame(store: Store, dir: string): void {
	const want = oldMessages(dir);
	expect(store.count).toBe(want.length);
	for (let i = 0; i < want.length; i++) {
		expect(store.message(i)).toEqual(want[i]);
		expect(store.size(i)).toBe(want[i].size);
	}
}

function seed(dir: string): void {
	let a = "";
	for (let i = 0; i < 50; i++) a += m(i, `msg ${i} ünïcødé ${"x".repeat(i)}`);
	fs.writeFileSync(mainLog(dir, "2026-01-01"), a);
	fs.writeFileSync(
		mainLog(dir, "2026-01-02"),
		m(50, "with image", { images: [{ hash: "abc", mimeType: "image/png" }] }) + m(51),
	);
	let tr = "";
	for (let i = 0; i < 52; i++) tr += t(0, i);
	for (let i = 0; i < 26; i++) tr += t(1, i);
	fs.writeFileSync(path.join(dir, "tree", "2026-01-01.jsonl"), tr);
}

describe("omem log index", () => {
	it("returns the same messages and nodes as the full parse, before and after the index exists", () => {
		const dir = tmpDir();
		seed(dir);
		let store = open(dir);
		expectSame(store, dir);
		expect(fs.existsSync(mainIdx(dir, "2026-01-01"))).toBe(true);
		expect(fs.existsSync(path.join(dir, "tree", "2026-01-01.idx"))).toBe(true);
		expect(store.message(50)?.images).toEqual([{ hash: "abc", mimeType: "image/png" }]);
		closeAll();
		store = open(dir);
		expectSame(store, dir);
		expect(store.node(1, 25)).toBe("n1.25");
		expect(store.node(0, 51)).toBe("n0.51");
		expect(store.hasNode(1, 26)).toBe(false);
		expect(store.node(2, 0)).toBeUndefined();
		expect(store.levelCount).toBe(2);
		expect(store.levelLength(1)).toBe(26);
	});

	it("rebuilds a missing index", () => {
		const dir = tmpDir();
		seed(dir);
		open(dir);
		closeAll();
		const before = fs.readFileSync(mainIdx(dir, "2026-01-01"));
		fs.rmSync(mainIdx(dir, "2026-01-01"));
		expectSame(open(dir), dir);
		expect(fs.readFileSync(mainIdx(dir, "2026-01-01"))).toEqual(before);
	});

	it("recovers an index behind its log through the tail scan", () => {
		const dir = tmpDir();
		seed(dir);
		open(dir);
		closeAll();
		const idx = mainIdx(dir, "2026-01-02");
		const full = fs.readFileSync(idx);
		// Crash after the last line was fsync'd but before its slot was written; one more line unindexed.
		fs.truncateSync(idx, full.length - 16);
		fs.appendFileSync(mainLog(dir, "2026-01-02"), m(52, "after crash"));
		const store = open(dir);
		expectSame(store, dir);
		expect(store.message(52)?.text).toBe("after crash");
		expect(fs.statSync(idx).size).toBe(full.length + 16);
	});

	it("cuts a torn last line off, whether or not the index exists", () => {
		const dir = tmpDir();
		seed(dir);
		open(dir);
		closeAll();
		const log = mainLog(dir, "2026-01-02");
		const size = fs.statSync(log).size;
		fs.appendFileSync(log, '{"i":52,"kind":"us');
		let store = open(dir);
		expect(fs.statSync(log).size).toBe(size);
		expect(store.count).toBe(52);
		closeAll();
		fs.appendFileSync(log, '{"i":52,"kind":"us');
		fs.rmSync(mainIdx(dir, "2026-01-02"));
		store = open(dir);
		expect(fs.statSync(log).size).toBe(size);
		expectSame(store, dir);
	});

	it("skips a corrupt mid-file line in the tail and keeps skipping it on reopen", () => {
		const dir = tmpDir();
		seed(dir);
		open(dir);
		closeAll();
		fs.appendFileSync(mainLog(dir, "2026-01-02"), `{"i":52,"kin\n${m(52)}`);
		expectSame(open(dir), dir);
		closeAll();
		expectSame(open(dir), dir);
	});

	it("lets a later line with the same id win", () => {
		const dir = tmpDir();
		fs.writeFileSync(mainLog(dir, "2026-01-01"), m(0, "old") + m(1) + m(0, "new"));
		fs.writeFileSync(path.join(dir, "tree", "2026-01-01.jsonl"), t(0, 0, "old") + t(0, 0, "new"));
		let store = open(dir);
		expect(store.message(0)?.text).toBe("new");
		expect(store.node(0, 0)).toBe("new");
		closeAll();
		store = open(dir);
		expect(store.message(0)?.text).toBe("new");
		expect(store.node(0, 0)).toBe("new");
	});

	it("rebuilds a truncated, garbage or mismatching index", () => {
		const dir = tmpDir();
		seed(dir);
		open(dir);
		closeAll();
		const idx = mainIdx(dir, "2026-01-01");
		const good = fs.readFileSync(idx);
		const damaged: Buffer[] = [
			good.subarray(0, good.length - 5),
			Buffer.from("not an index at all"),
			Buffer.alloc(good.length),
		];
		// Right shape, wrong record: the last slot names id 7 instead of 49.
		const swapped = Buffer.from(good);
		swapped.writeUInt32LE(7, swapped.length - 8);
		damaged.push(swapped);
		for (const bytes of damaged) {
			fs.writeFileSync(idx, bytes);
			expectSame(open(dir), dir);
			closeAll();
			expect(fs.readFileSync(idx)).toEqual(good);
		}
		// A log shorter than its index covers (edited by hand) is rebuilt too.
		fs.writeFileSync(mainLog(dir, "2026-01-01"), m(0) + m(1));
		fs.writeFileSync(mainLog(dir, "2026-01-02"), "");
		const store = open(dir);
		expect(store.count).toBe(2);
		expectSame(store, dir);
	});

	it("still fails clearly when an id is missing", () => {
		const dir = tmpDir();
		fs.writeFileSync(mainLog(dir, "2026-01-01"), m(0) + m(2));
		expect(() => open(dir)).toThrow(/message 1 of 3 is missing/);
		// A later open reads the index the failed open wrote and fails the same way.
		expect(() => open(dir)).toThrow(/message 1 of 3 is missing/);
	});

	it("reads old messages from disk after many appends, and reopens to the same state", async () => {
		const dir = tmpDir();
		let omem = await Omem.open({ dir, complete: () => Promise.reject(new Error("unexpected")) });
		for (let i = 0; i < 600; i++) omem.append("user", `message number ${i}`);
		// Past the message cache: id 0 comes back through a positioned read.
		expect(omem.zoom(0, 1)).toBe("0+1 user:\nmessage number 0");
		const view = omem.renderView();
		const zoom = omem.zoom(256, 256);
		await omem.close();
		omem = await Omem.open({ dir, complete: () => Promise.reject(new Error("unexpected")) });
		try {
			expect(omem.count).toBe(600);
			expect(omem.renderView()).toBe(view);
			expect(omem.zoom(256, 256)).toBe(zoom);
			expect(omem.zoom(0, 1)).toBe("0+1 user:\nmessage number 0");
			expect(omem.message(599)?.text).toBe("message number 599");
			omem.append("user", "after reopen");
			expect(omem.zoom(600, 1)).toBe("600+1 user:\nafter reopen");
		} finally {
			await omem.close();
		}
		const store = open(dir);
		expectSame(store, dir);
		expect(store.node(0, 600)).toBe("user: after reopen");
	});
});
