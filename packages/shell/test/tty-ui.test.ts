import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import {
	answerUiRequest,
	cancelledResponse,
	confirmedResponse,
	decodeKey,
	formatAge,
	type HostRow,
	hostLabel,
	pickHost,
	renderHostPicker,
	renderList,
	shortenHome,
	stepLine,
	stepList,
	valueResponse,
} from "../src/tty-ui";

const key = (s: string) => {
	const b = new TextEncoder().encode(s);
	return decodeKey(b, b.length);
};

describe("decodeKey", () => {
	test("basic keys", () => {
		expect(key("\r")).toEqual({ kind: "enter" });
		expect(key("\n")).toEqual({ kind: "enter" });
		expect(key("\x1b")).toEqual({ kind: "escape" });
		expect(key("\x03")).toEqual({ kind: "escape" });
		expect(key("\x7f")).toEqual({ kind: "backspace" });
		expect(key("3")).toEqual({ kind: "digit", digit: 3 });
		expect(key("0")).toEqual({ kind: "char", char: "0" });
		expect(key("j")).toEqual({ kind: "char", char: "j" });
		expect(key("\x1b[A")).toEqual({ kind: "up" });
		expect(key("\x1bOB")).toEqual({ kind: "down" });
		expect(key("\x1b[C")).toEqual({ kind: "right" });
		expect(key("\x1b[D")).toEqual({ kind: "left" });
		expect(key("héllo")).toEqual({ kind: "char", char: "héllo" });
		expect(key("\x1b[1;5A")).toEqual({ kind: "other" });
		expect(decodeKey(new Uint8Array(4), 0)).toEqual({ kind: "other" });
		expect(decodeKey(new Uint8Array(4), -1)).toEqual({ kind: "other" });
	});
});

describe("stepList", () => {
	const s = { count: 3, selected: 0 };
	test("moves with wrap", () => {
		expect(stepList(s, key("\x1b[A"))).toEqual({ kind: "move", state: { count: 3, selected: 2 } });
		expect(stepList(s, key("j"))).toEqual({ kind: "move", state: { count: 3, selected: 1 } });
		expect(stepList({ count: 3, selected: 2 }, key("\x1b[B"))).toEqual({ kind: "move", state: s });
		expect(stepList({ count: 3, selected: 1 }, key("k"))).toEqual({ kind: "move", state: s });
	});
	test("pick and cancel", () => {
		expect(stepList({ count: 3, selected: 1 }, key("\r"))).toEqual({ kind: "pick", index: 1 });
		expect(stepList(s, key("2"))).toEqual({ kind: "pick", index: 1 });
		expect(stepList(s, key("9"))).toEqual({ kind: "move", state: s });
		expect(stepList(s, key("q"))).toEqual({ kind: "cancel" });
		expect(stepList(s, key("\x1b"))).toEqual({ kind: "cancel" });
		expect(stepList(s, key("\x03"))).toEqual({ kind: "cancel" });
		expect(stepList({ count: 0, selected: 0 }, key("\r"))).toEqual({ kind: "cancel" });
	});
});

describe("stepLine", () => {
	test("edits", () => {
		expect(stepLine("ab", key("c"))).toEqual({ kind: "edit", value: "abc" });
		expect(stepLine("ab", key("1"))).toEqual({ kind: "edit", value: "ab1" });
		expect(stepLine("ab", key("\x7f"))).toEqual({ kind: "edit", value: "a" });
		expect(stepLine("ab", key("\r"))).toEqual({ kind: "done" });
		expect(stepLine("ab", key("\x1b"))).toEqual({ kind: "cancel" });
	});
});

describe("render", () => {
	const row: HostRow = {
		instanceId: "i1",
		sessionId: "abcdef0123456789",
		cwd: "/home/u/proj",
		model: "opus",
		startedAt: 0,
	};
	test("labels", () => {
		expect(shortenHome("/home/u/proj", "/home/u")).toBe("~/proj");
		expect(shortenHome("/home/uu", "/home/u")).toBe("/home/uu");
		expect(formatAge(0, 90_000)).toBe("1m");
		expect(formatAge(0, 2 * 86_400_000)).toBe("2d");
		expect(hostLabel(row, 5000, "/home/u")).toBe("abcdef01  ~/proj  opus  5s");
		expect(hostLabel({ ...row, sessionName: "fix", model: undefined }, 0, "/home/u")).toBe("fix  ~/proj  0s");
	});
	test("list marks selection", () => {
		const lines = renderList("T", ["a", "b"], 1);
		expect(lines.length).toBe(4);
		expect(lines[1]).toBe("  1 a");
		expect(lines[2]).toContain("> 2 b");
		expect(renderHostPicker([row], 0, 0, "/home/u")[1]).toContain("abcdef01  ~/proj");
	});
});

describe("frames", () => {
	test("shapes", () => {
		expect(cancelledResponse("x")).toEqual({ type: "extension_ui_response", id: "x", cancelled: true });
		expect(valueResponse("x", "v")).toEqual({ type: "extension_ui_response", id: "x", value: "v" });
		expect(confirmedResponse("x", false)).toEqual({ type: "extension_ui_response", id: "x", confirmed: false });
	});
	test("cancel/unknown methods and empty inputs need no tty", async () => {
		expect(await answerUiRequest({ type: "extension_ui_request", id: "c", method: "cancel" })).toEqual(
			cancelledResponse("c"),
		);
		expect(await answerUiRequest({ id: "s", method: "select", options: [] })).toEqual(cancelledResponse("s"));
		expect(await pickHost([])).toBeNull();
	});
	test("no controlling tty returns null/cancelled", async () => {
		const mod = path.join(import.meta.dir, "../src/tty-ui.ts");
		const script = `
const m = await import(${JSON.stringify(mod)});
const row = { instanceId: "i", sessionId: "s", cwd: "/", startedAt: 0 };
const out = {
	pick: await m.pickHost([row]),
	select: await m.answerUiRequest({ id: 1, method: "select", options: ["a"] }),
	confirm: await m.answerUiRequest({ id: 2, method: "confirm", title: "ok?" }),
	input: await m.answerUiRequest({ id: 3, method: "input", title: "x" }),
};
process.stdout.write(JSON.stringify(out));`;
		const proc = Bun.spawn([process.execPath, "-e", script], {
			detached: true,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, EDITOR: "", VISUAL: "" },
		});
		const text = await new Response(proc.stdout).text();
		expect(await proc.exited).toBe(0);
		expect(JSON.parse(text)).toEqual({
			pick: null,
			select: cancelledResponse(1),
			confirm: cancelledResponse(2),
			input: cancelledResponse(3),
		});
	});
});
