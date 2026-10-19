import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Omem, type OmemCompleteFn, OmemLockedError, OmemRefusalError } from "@oh-my-pi/pi-coding-agent/omem/index";

const dirs: string[] = [];
const opened: Omem[] = [];

function tmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omem-"));
	dirs.push(dir);
	return dir;
}

async function open(
	dir: string,
	complete: OmemCompleteFn,
	onError?: (err: unknown) => void,
	retryMs?: number,
): Promise<Omem> {
	const omem = await Omem.open({ dir, complete, onError, retryMs });
	opened.push(omem);
	return omem;
}

const neverCalled: OmemCompleteFn = () => Promise.reject(new Error("unexpected compaction"));

afterEach(async () => {
	for (const o of opened.splice(0)) await o.close();
	for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

interface Call {
	view: string;
	wholeBlocks: number;
	task: string;
	note?: string;
	resolve: (reply: string) => void;
	reject: (err: Error) => void;
}

/** Fake model whose calls stay pending until the test answers them. */
function manualModel(): { complete: OmemCompleteFn; calls: Call[] } {
	const calls: Call[] = [];
	const complete: OmemCompleteFn = req => {
		const { promise, resolve, reject } = Promise.withResolvers<string>();
		calls.push({ ...req, view: req.viewBlocks.join(""), resolve, reject });
		return promise;
	};
	return { complete, calls };
}

/** Drains pending microtasks so finished fake calls land and the compactor pumps. */
async function tick(): Promise<void> {
	for (let k = 0; k < 50; k++) await Promise.resolve();
}

describe("omem store", () => {
	it("logs short messages as their own nodes and renders the view", async () => {
		const dir = tmpDir();
		const omem = await open(dir, neverCalled);
		omem.append("user", "hello\nthere");
		omem.append("agent", "hi");
		expect(omem.count).toBe(2);
		expect(omem.renderView()).toBe("<chat>\n0+1|user: hello there\n1+1|agent: hi\n</chat>");
		expect(omem.viewBlocks().join("")).toBe(omem.renderView());
		expect(await omem.settle()).toBe(true);
		const day = fs.readdirSync(path.join(dir, "main"));
		expect(day).toHaveLength(1);
		expect(day[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);
	});

	it("cuts view blocks into 4 lines with joined === renderView", async () => {
		const omem = await open(tmpDir(), neverCalled);
		for (let i = 0; i < 10; i++) omem.append("user", `m${i}`);
		const blocks = omem.viewBlocks();
		expect(blocks.join("")).toBe(omem.renderView());
		expect(blocks).toHaveLength(4);
		expect(blocks[0].startsWith("<chat>\n0+1|")).toBe(true);
		expect(blocks[1].split("\n")).toHaveLength(5);
		expect(blocks[3]).toBe("</chat>");
		expect(omem.viewWholeBlocks()).toBe(2);
	});

	it("splits long text and clips echo head and tail", async () => {
		const { complete } = manualModel();
		const omem = await open(tmpDir(), complete);
		const long = "word ".repeat(13_000);
		const parts = omem.append("agent", long);
		expect(parts.length).toBe(3);
		expect(parts.map(p => p.text).join("")).toBe(long);
		const [echo] = omem.append("echo", `HEAD${"x".repeat(50_000)}TAIL`);
		expect(echo.text.startsWith("HEAD")).toBe(true);
		expect(echo.text.endsWith("TAIL")).toBe(true);
		expect(echo.text).toContain("chars clipped");
		expect(echo.text.length).toBeLessThan(30_100);
	});

	it("round-trips view.json without rebuilding", async () => {
		const dir = tmpDir();
		const model: OmemCompleteFn = async () => "s".repeat(400);
		let omem = await open(dir, model);
		for (let i = 0; i < 40; i++) {
			omem.append("user", `msg ${i} ${"y".repeat(450)}`);
			await omem.settle();
		}
		const refs = omem.viewRefs();
		const rendered = omem.renderView();
		await omem.close();
		opened.pop();
		expect(JSON.parse(fs.readFileSync(path.join(dir, "view.json"), "utf8")).view).toEqual(refs.map(n => [n.l, n.i]));
		omem = await open(dir, neverCalled);
		expect(omem.viewRefs()).toEqual(refs);
		expect(omem.renderView()).toBe(rendered);
		expect(omem.count).toBe(40);
	});

	it("skips a torn last line and keeps appending cleanly", async () => {
		const dir = tmpDir();
		let omem = await open(dir, neverCalled);
		omem.append("user", "one");
		omem.append("user", "two");
		await omem.close();
		opened.pop();
		const [file] = fs.readdirSync(path.join(dir, "main"));
		fs.appendFileSync(path.join(dir, "main", file), '{"i":2,"kind":"user","te');
		omem = await open(dir, neverCalled);
		expect(omem.count).toBe(2);
		omem.append("user", "three");
		await omem.close();
		opened.pop();
		const lines = fs
			.readFileSync(path.join(dir, "main", file), "utf8")
			.trimEnd()
			.split("\n");
		expect(lines.map(l => JSON.parse(l).text)).toEqual(["one", "two", "three"]);
		omem = await open(dir, neverCalled);
		expect(omem.message(2)?.text).toBe("three");
	});

	it("excludes a second writer and recovers a stale lock", async () => {
		const dir = tmpDir();
		const first = await open(dir, neverCalled);
		await expect(Omem.open({ dir, complete: neverCalled })).rejects.toBeInstanceOf(OmemLockedError);
		await first.close();
		opened.pop();
		fs.writeFileSync(path.join(dir, "lock"), "");
		const second = await open(dir, neverCalled);
		expect(second.count).toBe(0);
	});
});

describe("omem compactor", () => {
	it("starts message nodes in order, at most 8 unbuilt, then merges built halves", async () => {
		const { complete, calls } = manualModel();
		const omem = await open(tmpDir(), complete);
		for (let i = 0; i < 12; i++) omem.append("echo", `out ${i} ${"z".repeat(600)}`);
		await tick();
		expect(calls.map(c => c.task.match(/compress message (\d+)/)?.[1])).toEqual([
			"0",
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
		]);
		const summary = (n: number) => `sum${n} ${"q".repeat(300)}`;
		calls[1].resolve(summary(1));
		await tick();
		expect(calls).toHaveLength(9);
		expect(calls[8].task).toContain("compress message 8");
		calls[0].resolve(summary(0));
		await tick();
		// All 8 slots are busy again, so the ready merge of 0 and 1 waits; message nodes go first.
		expect(calls.slice(9).map(c => c.task.split("\n")[0])).toEqual([
			"Compaction: compress message 9 into one line of at most 512 bytes",
		]);
		// Message 9's view stops at the first unbuilt line (message 2).
		expect(calls[9].view).toBe(`<chat>\n0+1|${summary(0)}\n1+1|${summary(1)}\n</chat>`);
		for (let k = 2; k < 12; k++) {
			calls.find(c => c.task.includes(`compress message ${k} `))?.resolve(summary(k));
			await tick();
		}
		const merge = calls.find(c => c.task.includes("merge lines 0+1 and 1+1"));
		expect(merge?.task).toContain(`<input>\n${summary(0)}\n${summary(1)}\n</input>`);
		expect(merge?.task.split("<input>")[1]).not.toMatch(/\d+\+\d+/);
		expect(merge?.task).toContain("messages, 0 to 1, in more detail");
		expect(merge?.view).toBe(`<chat>\n0+1|${summary(0)}\n1+1|${summary(1)}\n</chat>`);
		expect(calls.some(c => c.task.includes("merge lines 0+2 and 2+2"))).toBe(false);
		expect(await omem.settle()).toBe(true);
	});

	it("retries an over-limit reply with one note on the latest line only, keeping the shortest of 5", async () => {
		const seen: Array<string | undefined> = [];
		const lengths = [900, 700, 800, 650, 750];
		const model: OmemCompleteFn = async req => {
			seen.push(req.note);
			return "a".repeat(lengths[seen.length - 1]);
		};
		const omem = await open(tmpDir(), model);
		omem.append("user", "b".repeat(600));
		expect(await omem.settle()).toBe(true);
		const note = (n: number) =>
			`Too long: your last line for this <input> was ${n} bytes,\nover the 512-byte limit. Write the whole line again, cutting just\nenough of the least valuable items to fit before this cut:\n${"a".repeat(512)}| ← LIMIT`;
		expect(seen).toEqual([undefined, note(900), note(700), note(800), note(650)]);
		expect(omem.renderView()).toBe(`<chat>\n0+1|${"a".repeat(650)}\n</chat>`);
	});

	it("stops retrying once the reply fits", async () => {
		let n = 0;
		const omem = await open(tmpDir(), async () => (++n === 1 ? "x".repeat(600) : "short"));
		omem.append("user", "c".repeat(600));
		expect(await omem.settle()).toBe(true);
		expect(n).toBe(2);
	});

	it("retries a failed node at the next message", async () => {
		let fail = true;
		const errors: unknown[] = [];
		const omem = await open(
			tmpDir(),
			async () => {
				if (fail) throw new Error("boom");
				return "ok";
			},
			err => errors.push(err),
		);
		omem.append("user", "d".repeat(600));
		await tick();
		expect(errors).toHaveLength(1);
		const abort = new AbortController();
		fail = true;
		const pending = omem.settle(abort.signal);
		await tick();
		abort.abort();
		expect(await pending).toBe(false);
		fail = false;
		omem.append("user", "next");
		expect(await omem.settle()).toBe(true);
		expect(omem.renderView()).toBe("<chat>\n0+1|ok\n1+1|user: next\n</chat>");
	});

	it("retries a transient failure on the timer while a settle waits", async () => {
		let n = 0;
		const errors: unknown[] = [];
		const omem = await open(
			tmpDir(),
			async () => {
				if (++n === 1) throw new Error("503");
				return "ok";
			},
			err => errors.push(err),
			20,
		);
		omem.append("user", "d".repeat(600));
		expect(await omem.settle()).toBe(true);
		expect(errors).toHaveLength(1);
		expect(omem.renderView()).toBe("<chat>\n0+1|ok\n</chat>");
	});

	it("builds a refused node from its clipped source", async () => {
		let n = 0;
		const omem = await open(tmpDir(), async () => {
			n++;
			throw new OmemRefusalError();
		});
		omem.append("user", `x\n${"é".repeat(400)}`);
		expect(await omem.settle()).toBe(true);
		expect(n).toBe(1);
		const line = omem.renderView().split("\n")[1];
		expect(line).toBe(`0+1|user: x ${"é".repeat(252)}`);
	});

	it("clips the source when every try is empty and sends no note for empty replies", async () => {
		const seen: Array<string | undefined> = [];
		const omem = await open(tmpDir(), async req => {
			seen.push(req.note);
			return "  ";
		});
		omem.append("user", "z".repeat(600));
		expect(await omem.settle()).toBe(true);
		expect(seen).toEqual([undefined, undefined, undefined, undefined, undefined]);
		expect(omem.renderView()).toBe(`<chat>\n0+1|user: ${"z".repeat(506)}\n</chat>`);
	});

	it("passes the compaction view as 4-line blocks with whole count", async () => {
		const { complete, calls } = manualModel();
		const omem = await open(tmpDir(), complete);
		for (let i = 0; i < 5; i++) omem.append("user", `m${i}`);
		omem.append("user", "y".repeat(600));
		await tick();
		expect(calls[0].wholeBlocks).toBe(1);
		expect(calls[0].view).toBe(omem.renderView().replace(/5\+1\|.*\n/, ""));
		calls[0].resolve("ok");
		expect(await omem.settle()).toBe(true);
	});

	it("keeps the chat view and compaction views inside their sawtooth bounds", async () => {
		let maxCView = 0;
		const model: OmemCompleteFn = async req => {
			maxCView = Math.max(maxCView, Buffer.byteLength(req.viewBlocks.join("")));
			return "s".repeat(480);
		};
		const omem = await open(tmpDir(), model);
		let max = 0;
		let drops = 0;
		let prev = 0;
		for (let i = 0; i < 900; i++) {
			omem.append("user", `m${i} ${"t".repeat(470)}`);
			expect(await omem.settle()).toBe(true);
			const bytes = Buffer.byteLength(omem.renderView());
			max = Math.max(max, bytes);
			if (bytes < prev) {
				expect(bytes).toBeLessThanOrEqual(64_000 + 20);
				drops++;
			}
			prev = bytes;
		}
		expect(max).toBeLessThanOrEqual(128_000 + 520);
		expect(max).toBeGreaterThan(120_000);
		expect(drops).toBeGreaterThan(0);
		expect(maxCView).toBeLessThanOrEqual(32_000 + 520);
	}, 30_000);
});

describe("omem zoom and date", () => {
	it("validates arguments and opens lines", async () => {
		const omem = await open(tmpDir(), neverCalled);
		for (let i = 0; i < 5; i++) omem.append("user", `u${i}`);
		expect(omem.zoom(0, 3)).toStartWith("Error:");
		expect(omem.zoom(0, 0)).toStartWith("Error:");
		expect(omem.zoom(1.5, 1)).toStartWith("Error:");
		expect(omem.zoom(2, 4)).toStartWith("Error:");
		expect(omem.zoom(-1, 1)).toStartWith("Error:");
		expect(omem.zoom(5, 1)).toStartWith("Error:");
		expect(omem.zoom(3, 1)).toBe("3+1 user:\nu3");
		expect(omem.zoom(0, 4)).toBe("0+2|user: u0\nuser: u1\n2+2|user: u2\nuser: u3".replace(/\n(?=user)/g, " "));
		expect(omem.zoom(4, 4)).toStartWith("Error: no line 4+4");
		expect(omem.date(2)).toBe(new Date(omem.message(2)?.date ?? "").toLocaleString("sv-SE"));
		expect(omem.date(9)).toStartWith("Error:");
		expect(omem.date(Number.NaN)).toStartWith("Error:");
	});

	it("has a constant system prompt naming omp and the agent kind", () => {
		expect(Omem.systemPrompt).toStartWith("You are omp, an AI agent");
		expect(Omem.systemPrompt).toContain("- agent: omp's replies");
		expect(Omem.systemPrompt).not.toContain("Unii");
		expect(Omem.systemPrompt).not.toContain("device");
	});
});
