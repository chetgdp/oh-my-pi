import { describe, expect, it } from "bun:test";
import type { ToolLines } from "../src/config";
import { Chrome } from "../src/output";

function capture(tty: boolean, columns = 80) {
	const writes: string[] = [];
	const chrome = new Chrome({ tty, dumb: false, columns: () => columns, write: text => writes.push(text) });
	return { chrome, out: () => writes.join("") };
}

const result = (text: string) => ({ content: [{ type: "text", text }] });

describe("Chrome.toolResult", () => {
	it("cuts the middle: head lines, the hidden count, then the last line, plain when not a tty", () => {
		const { chrome, out } = capture(false);
		const lines = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`);
		chrome.toolResult(result(`${lines.join("\n")}\n`), false);
		expect(out()).toBe(
			`${lines
				.slice(0, 8)
				.map(l => `  ${l}\n`)
				.join("")}  … 3 more lines\n  line 12\n`,
		);
	});

	it("colours errors red and normal output dim on a tty", () => {
		const { chrome, out } = capture(true);
		chrome.toolResult(result("boom"), true);
		chrome.toolResult(result("/Users/che"), false);
		expect(out()).toBe("\x1b[31m  boom\x1b[0m\n\x1b[2m  /Users/che\x1b[0m\n");
	});

	it("strips control bytes and cuts wide lines to the terminal width", () => {
		const { chrome, out } = capture(false, 30);
		chrome.toolResult(result(`\x1b[2Jevil\ttab ${"x".repeat(60)}`), false);
		const line = out().trimEnd();
		expect(line).not.toContain("\x1b");
		expect(line.startsWith("  [2Jevil    tab x")).toBe(true);
		expect(Bun.stringWidth(line)).toBeLessThanOrEqual(29);
		expect(line.endsWith("…")).toBe(true);
	});

	it("prints nothing for a result without text", () => {
		const { chrome, out } = capture(false);
		chrome.toolResult({ content: [{ type: "image", data: "" }] }, false);
		chrome.toolResult(result("   \n"), false);
		expect(out()).toBe("");
	});

	it("shows an edit result's diff in place of its text, + green and - red on a tty", () => {
		const edit = {
			content: [{ type: "text", text: "[a.ts#1A2B]\n2:new" }],
			details: { diff: " 1|keep\n-2|old\n+2|new" },
		};
		const tty = capture(true);
		tty.chrome.toolResult(edit, false);
		expect(tty.out()).toBe("\x1b[2m   1|keep\x1b[0m\n\x1b[31m  -2|old\x1b[0m\n\x1b[32m  +2|new\x1b[0m\n");
		const piped = capture(false);
		piped.chrome.toolResult(edit, false);
		expect(piped.out()).toBe("   1|keep\n  -2|old\n  +2|new\n");
	});

	it("a failed edit shows its error text, not the diff", () => {
		const { chrome, out } = capture(true);
		chrome.toolResult({ content: [{ type: "text", text: "no match" }], details: { diff: "-1|x" } }, true);
		expect(out()).toBe("\x1b[31m  no match\x1b[0m\n");
	});

	it("default mode uses the TUI's per-tool size; N and all override it for every tool", () => {
		const lines = Array.from({ length: 60 }, (_, i) => `l${i + 1}`);
		const shown = (toolLines: ToolLines, toolName: string, diff = false) => {
			const writes: string[] = [];
			const chrome = new Chrome({ tty: false, toolLines, write: t => writes.push(t) });
			const text = lines.join("\n");
			chrome.toolResult(diff ? { content: [], details: { diff: text } } : result(text), false, toolName);
			return writes.join("").split("\n").filter(Boolean).length;
		};
		// Head plus the "… more" line plus the last line.
		expect(shown("default", "bash")).toBe(10 + 2);
		expect(shown("default", "grep")).toBe(3 + 2);
		expect(shown("default", "edit", true)).toBe(40 + 2);
		expect(shown("default", "read")).toBe(0);
		expect(shown("default", "some_mcp_tool")).toBe(8 + 2);
		expect(shown(2, "edit", true)).toBe(2 + 2);
		expect(shown(0, "bash")).toBe(0);
		expect(shown("all", "read")).toBe(60);
	});

	it("prints one spare line instead of a '1 more line' marker", () => {
		const writes: string[] = [];
		new Chrome({ tty: false, toolLines: 2, write: t => writes.push(t) }).toolResult(result("a\nb\nc"), false);
		expect(writes.join("")).toBe("  a\n  b\n  c\n");
	});
});
