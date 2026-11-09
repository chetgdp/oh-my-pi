import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { MAX_OPEN_ITEMS, Omem, type OmemCompleteFn } from "@oh-my-pi/pi-coding-agent/omem/index";
import { SYSTEM_PROMPT } from "@oh-my-pi/pi-coding-agent/omem/prompt";
import type { AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session-events";
import { OmemMode } from "@oh-my-pi/pi-coding-agent/session/omem-mode";

const dirs: string[] = [];
const opened: Omem[] = [];

function tmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omem-fix-"));
	dirs.push(dir);
	return dir;
}

async function open(dir: string, complete: OmemCompleteFn = () => new Promise<string>(() => {})): Promise<Omem> {
	const omem = await Omem.open({ dir, complete });
	opened.push(omem);
	return omem;
}

afterEach(async () => {
	for (const o of opened.splice(0)) await o.close();
	for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function logged(omem: Omem): string[] {
	const out: string[] = [];
	for (let i = 0; i < omem.count; i++) out.push(`${omem.message(i)!.kind}: ${omem.message(i)!.text}`);
	return out;
}

function assistant(content: unknown[], stopReason: string, errorMessage?: string): AgentSessionEvent {
	return {
		type: "message_end",
		message: { role: "assistant", content, stopReason, errorMessage, timestamp: 0 },
	} as unknown as AgentSessionEvent;
}

function result(toolCallId: string, text: string, isError: boolean): AgentSessionEvent {
	return {
		type: "message_end",
		message: {
			role: "toolResult",
			toolCallId,
			toolName: "bash",
			content: text ? [{ type: "text", text }] : [],
			isError,
			timestamp: 0,
		},
	} as unknown as AgentSessionEvent;
}

const end = (yielded?: boolean) => ({ type: "agent_end", messages: [], yielded }) as unknown as AgentSessionEvent;
const call = (id: string, cmd: string) => ({ type: "toolCall", id, name: "bash", arguments: { cmd } });

describe("omem outcome logging", () => {
	it("logs failed and empty results, cut replies, unanswered calls and a failed turn note", async () => {
		const omem = await open(tmpDir());
		const mode = new OmemMode(omem, { renderState: () => "" });
		mode.observe(
			assistant([{ type: "text", text: "running" }, call("a", "ls"), call("b", "x"), call("c", "y")], "toolUse"),
		);
		mode.observe(result("a", "boom", true));
		mode.observe(result("b", "", false));
		mode.observe(assistant([{ type: "text", text: "half a rep" }, call("d", "partial")], "error", "overloaded."));
		mode.observe(end(false));
		expect(logged(omem)).toHaveLength(7);
		mode.observe(end());
		expect(logged(omem)).toEqual([
			"agent: running",
			'tool: bash {"cmd":"ls"}',
			"echo: error: boom",
			'tool: bash {"cmd":"x"}',
			"echo: (no output)",
			'tool: bash {"cmd":"partial"}\n[cut off: overloaded.]',
			"agent: half a rep\n[cut off: overloaded.]",
			'tool: bash {"cmd":"y"}',
			"note: No reply: overloaded. Send a message to try again.",
		]);
	});

	it("marks a user-aborted reply as stopped and adds no failure note", async () => {
		const omem = await open(tmpDir());
		const mode = new OmemMode(omem, { renderState: () => "" });
		mode.observe(assistant([{ type: "text", text: "partial" }], "aborted"));
		mode.observe(end());
		expect(logged(omem)).toEqual(["agent: partial\n[cut off: stopped]"]);
	});
});

describe("omem system prompt", () => {
	it("describes only features omp has and ends with the fast-compaction paragraph", () => {
		expect(SYSTEM_PROMPT).not.toContain('zoom("Name")');
		expect(SYSTEM_PROMPT).not.toContain("- work:");
		expect(
			SYSTEM_PROMPT.endsWith("write the line as soon as you understand <input> well enough to compress it."),
		).toBe(true);
		expect(SYSTEM_PROMPT).toContain(
			"This is a small, mechanical job: fit one message, or two lines, into one line\nof at most 512 bytes",
		);
	});
});

describe("omem store fixes", () => {
	it("rejects a zoom past the end and lists the tree's roots", async () => {
		const omem = await open(tmpDir());
		for (const t of ["a", "b", "c"]) omem.append("user", t);
		const out = omem.zoom(0, 4);
		expect(out).toStartWith("Error:");
		expect(out).toContain("The tree's roots: 0+2, 2+1.");
		expect(omem.zoom(2, 2)).toStartWith("Error:");
		expect(omem.zoom(0, 2)).toBe("0+1|user: a\n1+1|user: b");
	});

	it("skips a corrupt mid-file line and indexes messages by id across day files", async () => {
		const dir = tmpDir();
		fs.mkdirSync(path.join(dir, "main"), { recursive: true });
		const m = (i: number) =>
			JSON.stringify({ i, kind: "user", text: `m${i}`, size: 2, date: "2026-01-01T00:00:00.000Z" });
		// A UTC-named old file sorts after the local-named file written later west of UTC.
		fs.writeFileSync(path.join(dir, "main", "2026-01-02.jsonl"), `${m(0)}\n{"i":1,"kin\n${m(1)}\n`);
		fs.writeFileSync(path.join(dir, "main", "2026-01-01.jsonl"), `${m(2)}\n`);
		const omem = await open(dir);
		expect(logged(omem)).toEqual(["user: m0", "user: m1", "user: m2"]);
	});

	it("fails clearly when a message id is missing", async () => {
		const dir = tmpDir();
		fs.mkdirSync(path.join(dir, "main"), { recursive: true });
		const m = (i: number) =>
			JSON.stringify({ i, kind: "user", text: `m${i}`, size: 2, date: "2026-01-01T00:00:00.000Z" });
		fs.writeFileSync(path.join(dir, "main", "2026-01-01.jsonl"), `${m(0)}\n${m(2)}\n`);
		await expect(Omem.open({ dir, complete: () => Promise.resolve("") })).rejects.toThrow(
			/message 1 of 3 is missing/,
		);
	});

	it("reports dates and names day files in local time", async () => {
		const tz = process.env.TZ;
		// UTC+14: local and UTC calendar dates differ for 14 hours of every day.
		process.env.TZ = "Pacific/Kiritimati";
		try {
			const dir = tmpDir();
			const omem = await open(dir);
			omem.append("user", "hi");
			const iso = omem.message(0)!.date;
			expect(omem.date(0)).toBe(new Date(iso).toLocaleString("sv-SE"));
			expect(omem.date(0)).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
			expect(fs.readdirSync(path.join(dir, "main"))).toEqual([`${new Date().toLocaleDateString("sv-SE")}.jsonl`]);
		} finally {
			if (tz === undefined) delete process.env.TZ;
			else process.env.TZ = tz;
		}
	});

	it("persists the compaction view and draining flag, and still loads an old view.json", async () => {
		const dir = tmpDir();
		let omem = await open(dir);
		for (const t of ["a", "b", "c"]) omem.append("user", t);
		await omem.close();
		const viewFile = path.join(dir, "view.json");
		fs.writeFileSync(
			viewFile,
			JSON.stringify({
				view: [
					[0, 0],
					[0, 1],
					[0, 2],
				],
				cview: [
					[1, 0],
					[0, 2],
				],
				draining: true,
			}),
		);
		omem = await open(dir);
		expect(JSON.parse(fs.readFileSync(viewFile, "utf8"))).toEqual({
			view: [
				[0, 0],
				[0, 1],
				[0, 2],
			],
			cview: [
				[1, 0],
				[0, 2],
			],
			draining: true,
		});
		await omem.close();

		fs.writeFileSync(
			viewFile,
			JSON.stringify([
				[1, 0],
				[0, 2],
			]),
		);
		omem = await open(dir);
		expect(omem.viewRefs()).toEqual([
			{ l: 1, i: 0 },
			{ l: 0, i: 2 },
		]);
	});

	it("ends the turn without logging when settle is aborted", async () => {
		const omem = await open(tmpDir());
		// Longer than one node: waits on a compaction call that never answers.
		omem.append("user", "x".repeat(2000));
		const before = omem.count;
		const mode = new OmemMode(omem, { renderState: () => "" });
		const abort = new AbortController();
		const turn = mode.transform([{ role: "user", content: "next", timestamp: 1 } as AgentMessage], abort.signal);
		abort.abort(new Error("stopped by user"));
		await expect(turn).rejects.toThrow("stopped by user");
		expect(omem.count).toBe(before);
	});
});

const HEAD = "Turn: the user's new message:\n\n";

function contentOf(message: AgentMessage | undefined): unknown {
	if (message?.role !== "user") throw new Error(`expected a user message, got ${message?.role}`);
	return message.content;
}

function textOf(message: AgentMessage | undefined): string {
	const content = contentOf(message);
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) throw new Error("unexpected content");
	return content.map(part => ("text" in part ? part.text : "")).join("");
}

describe("omem turn message", () => {
	it("sends an over-bound message's early pieces as view lines and only its last 128 KB whole", async () => {
		const omem = await open(tmpDir(), async () => "sum");
		const mode = new OmemMode(omem, { renderState: () => "" });
		// 200,000 bytes: pieces of 30,000 chars; the last four (110,000 bytes) fit the bound.
		const big = "w ".repeat(100_000);
		const prompt = { role: "user", content: big, timestamp: 1 } as AgentMessage;
		const out = await mode.transform([prompt]);
		expect(omem.count).toBe(7);
		expect(out).toHaveLength(2);
		expect(textOf(out[0])).toBe("<chat>\n0+1|sum\n1+1|sum\n2+1|sum\n</chat><items>\n</items>");
		expect(contentOf(out[1])).toBe(HEAD + big.slice(90_000));

		const again = await mode.transform([
			prompt,
			{ role: "assistant", content: [], timestamp: 2 } as unknown as AgentMessage,
		]);
		expect(omem.count).toBe(7);
		expect(again[1]).toBe(out[1]);
	});

	it("keeps an under-bound message whole, rendering the view before logging it", async () => {
		const omem = await open(tmpDir(), async () => "sum");
		const mode = new OmemMode(omem, { renderState: () => "" });
		const text = "v ".repeat(60_000);
		const out = await mode.transform([{ role: "user", content: text, timestamp: 1 } as AgentMessage]);
		expect(textOf(out[0])).toBe("<chat>\n</chat><items>\n</items>");
		expect(contentOf(out[1])).toBe(HEAD + text);
		expect(omem.count).toBe(4);
	});

	it("heads the turn's message in the request only; steers and the log get no head", async () => {
		const appended: string[] = [];
		const omem = {
			dir: tmpDir(),
			settle: async () => true,
			items: { render: () => "<items>\n</items>" },
			viewBlocks: () => ["<chat>\n", "</chat>"],
			viewWholeBlocks: () => 0,
			append: (_kind: string, line: string) => {
				appended.push(line);
				return [];
			},
		} as unknown as ConstructorParameters<typeof OmemMode>[0];
		const image = { type: "image", data: "x", mimeType: "image/png" };
		const out = await new OmemMode(omem, { renderState: () => "" }).transform([
			{ role: "user", content: [{ type: "text", text: "do it" }, image], timestamp: 1 } as AgentMessage,
			{ role: "user", content: "and this", timestamp: 2, steering: true } as AgentMessage,
		]);
		expect(contentOf(out[1])).toEqual([{ type: "text", text: `${HEAD}do it` }, image]);
		expect(contentOf(out[2])).toBe("and this");
		const hash = new Bun.CryptoHasher("sha256").update(Buffer.from("x", "base64")).digest("hex");
		expect(appended).toEqual([`do it\n[image ${hash.slice(0, 12)}]`, "and this"]);
	});
});

describe("omem images", () => {
	const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");
	const jpg = Buffer.from("ffd8ffe000104a464946", "hex").toString("base64");

	it("keeps user and tool-result images across a reopen and returns them from zoom(id, 1)", async () => {
		const dir = tmpDir();
		const first = await open(dir, async () => "sum");
		const mode = new OmemMode(first, { renderState: () => "" });
		await mode.transform([
			{
				role: "user",
				content: [
					{ type: "text", text: "look" },
					{ type: "image", data: png, mimeType: "image/png" },
				],
				timestamp: 1,
			} as AgentMessage,
		]);
		mode.observe(assistant([call("r", "shot.jpg")], "toolUse"));
		mode.observe({
			type: "message_end",
			message: {
				role: "toolResult",
				toolCallId: "r",
				toolName: "read",
				content: [{ type: "image", data: jpg, mimeType: "image/jpeg" }],
				isError: false,
				timestamp: 0,
			},
		} as AgentSessionEvent);
		await first.close();
		opened.splice(opened.indexOf(first), 1);

		const second = await open(dir);
		const zoom = new OmemMode(second, { renderState: () => "" }).tools().find(tool => tool.name === "zoom")!;
		const run = (id: number, n: number) =>
			zoom.execute("z", { id, n }, undefined, undefined, undefined as never) as Promise<{ content: unknown[] }>;
		const user = await run(0, 1);
		expect(user.content.slice(1)).toEqual([{ type: "image", data: png, mimeType: "image/png" }]);
		const echo = await run(second.count - 1, 1);
		expect(echo.content.slice(1)).toEqual([{ type: "image", data: jpg, mimeType: "image/jpeg" }]);
		// A merge zoom shows summaries only.
		expect((await run(0, 2)).content).toHaveLength(1);
	});

	it("names a missing image instead of failing the zoom", async () => {
		const dir = tmpDir();
		const omem = await open(dir);
		const mode = new OmemMode(omem, { renderState: () => "" });
		await mode.transform([
			{ role: "user", content: [{ type: "image", data: png, mimeType: "image/png" }], timestamp: 1 } as AgentMessage,
		]);
		fs.rmSync(path.join(dir, "images"), { recursive: true });
		const zoom = mode.tools().find(tool => tool.name === "zoom")!;
		const out = (await zoom.execute("z", { id: 0, n: 1 }, undefined, undefined, undefined as never)) as {
			content: { type: string; text?: string }[];
		};
		expect(out.content).toHaveLength(1);
		expect(out.content[0].text).toMatch(/missing from the image store/);
	});
});

describe("omem open items", () => {
	async function itemsTool(mode: OmemMode) {
		const tool = mode.tools().find(t => t.name === "items")!;
		return async (params: { op: string; id?: number; text?: string }) => {
			const out = (await tool.execute("i", params, undefined, undefined, undefined as never)) as {
				content: { text: string }[];
			};
			return out.content[0].text;
		};
	}

	it("survives a reopen with edits, closes and reopens replayed in order", async () => {
		const dir = tmpDir();
		const first = await open(dir, async () => "sum");
		const run = await itemsTool(new OmemMode(first, { renderState: () => "" }));
		await run({ op: "add", text: "back up the minecraft world" });
		await run({ op: "add", text: "fix splash shader" });
		await run({ op: "edit", id: 2, text: "fix splash shader on iOS" });
		await run({ op: "close", id: 1, text: "journal shows backup ran 2026-11-01" });
		await first.close();
		opened.splice(opened.indexOf(first), 1);

		const second = await open(dir, async () => "sum");
		expect(second.items.render()).toBe("<items>\n#2 (from message 0) fix splash shader on iOS\n</items>");
		expect(second.items.get(1)?.why).toBe("journal shows backup ran 2026-11-01");
		const run2 = await itemsTool(new OmemMode(second, { renderState: () => "" }));
		await run2({ op: "reopen", id: 1 });
		// A new item never reuses a closed item's number.
		await run2({ op: "add", text: "third" });
		expect(second.items.open().map(item => item.id)).toEqual([1, 2, 3]);
	});

	it("rejects a close without evidence, edits of closed items and adds past the cap", async () => {
		const omem = await open(tmpDir(), async () => "sum");
		const run = await itemsTool(new OmemMode(omem, { renderState: () => "" }));
		await run({ op: "add", text: "a" });
		expect(await run({ op: "close", id: 1 })).toMatch(/^Error: close needs text/);
		await run({ op: "close", id: 1, text: "user said done" });
		expect(await run({ op: "edit", id: 1, text: "b" })).toMatch(/^Error: item #1 is closed/);
		expect(await run({ op: "edit", id: 9, text: "b" })).toMatch(/^Error: no item #9/);
		for (let k = 0; k < MAX_OPEN_ITEMS; k++) await run({ op: "add", text: `t${k}` });
		expect(await run({ op: "add", text: "over" })).toMatch(/^Error: 30 items are open/);
		expect(await run({ op: "reopen", id: 1 })).toMatch(/^Error: 30 items are open/);
	});

	it("renders the list after the view and before per-turn state, with the cache mark on the view", async () => {
		const omem = await open(tmpDir(), async () => "sum");
		omem.items.change("add", { text: "open thing" }, 0);
		const mode = new OmemMode(omem, { renderState: () => "STATE" });
		const out = await mode.transform([{ role: "user", content: "hi", timestamp: 1 } as AgentMessage]);
		const parts = contentOf(out[0]) as { text: string }[];
		expect(parts.map(part => part.text)).toEqual([
			"<chat>\n",
			"</chat>",
			"<items>\n#1 (from message 0) open thing\n</items>",
			"STATE",
		]);
	});
});
