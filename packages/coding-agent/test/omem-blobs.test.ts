import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Omem } from "@oh-my-pi/pi-coding-agent/omem/index";
import { TEXT_CHARS } from "@oh-my-pi/pi-coding-agent/omem/sizes";
import type { AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session-events";
import { OmemMode } from "@oh-my-pi/pi-coding-agent/session/omem-mode";

const dirs: string[] = [];
const opened: Omem[] = [];

function tmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omem-blob-"));
	dirs.push(dir);
	return dir;
}

async function setup(cwd?: string) {
	const dir = tmpDir();
	const omem = await Omem.open({ dir, complete: () => new Promise<string>(() => {}) });
	opened.push(omem);
	const mode = new OmemMode(omem, { renderState: () => "", cwd: cwd ? () => cwd : undefined });
	const zoomTool = mode.tools().find(tool => tool.name === "zoom")!;
	const zoom = async (id: number) => {
		const out = (await zoomTool.execute("z", { id, n: 1 }, undefined, undefined, undefined as never)) as {
			content: { type: string; text?: string }[];
		};
		return out.content[0].text!;
	};
	const run = (id: string, name: string, args: Record<string, unknown>, output: string) => {
		mode.observe({
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "toolCall", id, name, arguments: args }],
				stopReason: "toolUse",
				timestamp: 0,
			},
		} as unknown as AgentSessionEvent);
		mode.observe({
			type: "message_end",
			message: {
				role: "toolResult",
				toolCallId: id,
				toolName: name,
				content: [{ type: "text", text: output }],
				isError: false,
				timestamp: 0,
			},
		} as unknown as AgentSessionEvent);
		return omem.count - 1;
	};
	return { dir, omem, zoom, run };
}

afterEach(async () => {
	for (const o of opened.splice(0)) await o.close();
	for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const big = (seed: string) => Array.from({ length: 5000 }, (_, k) => `${seed} line ${k}`).join("\n");

describe("omem tool output blobs", () => {
	it("keeps a large file read whole and tracks the file", async () => {
		const work = tmpDir();
		const file = path.join(work, "notes.txt");
		const content = big("file");
		fs.writeFileSync(file, content);
		const { omem, zoom, run } = await setup(work);
		const id = run("r1", "read", { path: "notes.txt:1-5000" }, content);
		const msg = omem.message(id)!;
		expect(content.length).toBeGreaterThan(TEXT_CHARS);
		expect(msg.text.length).toBeLessThan(content.length);
		expect(msg.text).toContain("chars clipped");
		expect(msg.ref).toMatchObject({ source: "file", target: file, range: "1-5000" });
		expect(msg.text).toContain(`blob ${msg.ref!.hash.slice(0, 12)}`);
		let out = await zoom(id);
		expect(out).toBe(`${id}+1 echo:\n${content}\n[${msg.ref!.target} unchanged since ${msg.ref!.at}]`);
		fs.writeFileSync(file, `${content}\nmore`);
		out = await zoom(id);
		expect(out).toEndWith(`changed since ${msg.ref!.at}]`);
		expect(out).toContain(content);
		fs.rmSync(file);
		expect(await zoom(id)).toEndWith(`missing now (read at ${msg.ref!.at})]`);
	});

	it("keeps a URL read as fetched without refetching", async () => {
		const { omem, zoom, run } = await setup();
		const page = "small page body";
		const id = run("u1", "read", { path: "https://example.invalid/doc" }, page);
		const msg = omem.message(id)!;
		expect(msg.ref).toMatchObject({ source: "url", target: "https://example.invalid/doc" });
		expect(msg.text.startsWith(page)).toBe(true);
		expect(await zoom(id)).toBe(
			`${id}+1 echo:\n${page}\n[https://example.invalid/doc as fetched at ${msg.ref!.at}; use read to fetch the current version]`,
		);
	});

	it("stores a large bash echo, leaves a small one alone, and dedupes", async () => {
		const { dir, omem, zoom, run } = await setup();
		const output = big("bash");
		const a = run("b1", "bash", { cmd: "x" }, output);
		const b = run("b2", "bash", { cmd: "x" }, output);
		const small = run("b3", "bash", { cmd: "y" }, "ok");
		const msg = omem.message(a)!;
		expect(msg.blob).toMatch(/^[a-f0-9]{64}$/);
		expect(omem.message(b)!.blob).toBe(msg.blob!);
		expect(fs.readdirSync(path.join(dir, "blobs"))).toEqual([msg.blob!]);
		expect(msg.text).toContain(`[full output: blob ${msg.blob!.slice(0, 12)}]`);
		expect(await zoom(a)).toBe(`${a}+1 echo:\n${output}`);
		const s = omem.message(small)!;
		expect(s.blob).toBeUndefined();
		expect(s.ref).toBeUndefined();
		expect(s.text).toBe("ok");
		expect(await zoom(small)).toBe(`${small}+1 echo:\nok`);
	});

	it("loads old records without blob fields unchanged", async () => {
		const dir = tmpDir();
		fs.mkdirSync(path.join(dir, "main"), { recursive: true });
		const text = "old clipped\n[... 5 chars clipped ...]\nend";
		fs.writeFileSync(
			path.join(dir, "main", "2026-01-01.jsonl"),
			`${JSON.stringify({ i: 0, kind: "echo", text, size: Buffer.byteLength(text), date: "2026-01-01T00:00:00.000Z" })}\n`,
		);
		const omem = await Omem.open({ dir, complete: () => new Promise<string>(() => {}) });
		opened.push(omem);
		const zoomTool = new OmemMode(omem, { renderState: () => "" }).tools().find(t => t.name === "zoom")!;
		const out = (await zoomTool.execute("z", { id: 0, n: 1 }, undefined, undefined, undefined as never)) as {
			content: { text: string }[];
		};
		expect(out.content[0].text).toBe(`0+1 echo:\n${text}`);
	});

	it("reports a missing blob file", async () => {
		const { dir, omem, zoom, run } = await setup();
		const id = run("b1", "bash", { cmd: "x" }, big("gone"));
		const msg = omem.message(id)!;
		fs.rmSync(path.join(dir, "blobs", msg.blob!));
		expect(await zoom(id)).toBe(
			`${id}+1 echo:\n${msg.text}\n[blob ${msg.blob!.slice(0, 12)} missing from the blob store]`,
		);
	});
});
