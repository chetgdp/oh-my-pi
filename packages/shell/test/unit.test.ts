import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { mergeStdin, parseArgv } from "../src/commands";
import { assistantText, finalAssistantText } from "../src/output";
import { clearPaneState, readPaneState, writePaneState } from "../src/pane-state";
import { type RpcHostEntry, resolveSessionId } from "../src/registry";
import { buildPromptRequest } from "../src/turn";

describe("parseArgv", () => {
	test("plain prompt joins words", () => {
		expect(parseArgv(["fix", "the", "bug"])).toEqual({ kind: "prompt", prompt: "fix the bug", all: false });
	});
	test("/a, /r and /n with and without prompt", () => {
		expect(parseArgv(["/a"])).toEqual({ kind: "attach", prompt: null, all: false });
		expect(parseArgv(["/a", "hi", "there"])).toEqual({ kind: "attach", prompt: "hi there", all: false });
		expect(parseArgv(["/n"])).toEqual({ kind: "new", prompt: null, all: false });
		expect(parseArgv(["/n", "go"])).toEqual({ kind: "new", prompt: "go", all: false });
		expect(parseArgv(["/r", "--all", "go"])).toEqual({ kind: "resume", prompt: "go", all: true });
		expect(parseArgv(["/r", "go", "--all"])).toEqual({ kind: "resume", prompt: "go --all", all: false });
		expect(parseArgv(["/a", "--all"])).toEqual({ kind: "attach", prompt: "--all", all: false });
	});
	test("other slash text is a host prompt", () => {
		expect(parseArgv(["/compact", "now"])).toEqual({ kind: "prompt", prompt: "/compact now", all: false });
	});
	test("/last ignores trailing words and piped stdin", () => {
		expect(parseArgv(["/last", "x"], "data")).toEqual({ kind: "last", prompt: null, all: false });
	});
	test("/l is /last; after /a, /r or /n it prints the last reply instead of prompting", () => {
		expect(parseArgv(["/l"])).toEqual({ kind: "last", prompt: null, all: false });
		expect(parseArgv(["/a", "/l"], "data")).toEqual({ kind: "attach", prompt: null, all: false, last: true });
		expect(parseArgv(["/r", "--all", "/last"])).toEqual({ kind: "resume", prompt: null, all: true, last: true });
		expect(parseArgv(["/a", "/lint"])).toEqual({ kind: "attach", prompt: "/lint", all: false });
	});
	test("/u expands to /usage, keeping arguments", () => {
		expect(parseArgv(["/u", "reset"])).toEqual({ kind: "prompt", prompt: "/usage reset", all: false });
		expect(parseArgv(["/a", "/u"])).toEqual({ kind: "attach", prompt: "/usage", all: false });
	});
	test("empty argv without stdin has no prompt", () => {
		expect(parseArgv([])).toEqual({ kind: "prompt", prompt: null, all: false });
	});
	test("stdin merges into any command", () => {
		expect(parseArgv(["what", "is", "this"], "data\n")).toEqual({
			kind: "prompt",
			prompt: "what is this\n\ndata",
			all: false,
		});
		expect(parseArgv(["/a"], "data")).toEqual({ kind: "attach", prompt: "data", all: false });
		expect(parseArgv([], "only stdin")).toEqual({ kind: "prompt", prompt: "only stdin", all: false });
	});
});

describe("mergeStdin", () => {
	test("blank stdin is ignored", () => {
		expect(mergeStdin("p", "  \n")).toBe("p");
		expect(mergeStdin("", null)).toBeNull();
	});
	test("trailing whitespace of stdin is trimmed, leading kept", () => {
		expect(mergeStdin("p", "  a\nb\n\n")).toBe("p\n\n  a\nb");
	});
});

describe("buildPromptRequest", () => {
	test("slash prompts pass verbatim without context", () => {
		expect(buildPromptRequest("/model", "/tmp")).toEqual({ message: "/model" });
	});
	test("plain prompts keep the text and carry the pane cwd as context", () => {
		expect(buildPromptRequest("hello", "/work/dir")).toEqual({
			message: "hello",
			context: { paneCwd: "/work/dir" },
		});
	});
});

describe("final text extraction", () => {
	const assistant = (...texts: string[]) => ({
		role: "assistant",
		content: texts.map(text => ({ type: "text", text })),
	});
	test("joins text blocks, skips non-text", () => {
		expect(
			assistantText({
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "x" },
					{ type: "text", text: "a" },
					{ type: "toolCall" },
					{ type: "text", text: "b" },
				],
			}),
		).toBe("ab");
	});
	test("non-assistant and empty messages yield null", () => {
		expect(assistantText({ role: "user", content: [{ type: "text", text: "a" }] })).toBeNull();
		expect(assistantText({ role: "assistant", content: [{ type: "toolCall" }] })).toBeNull();
		expect(assistantText(null)).toBeNull();
	});
	test("last assistant message with text wins", () => {
		const messages = [
			assistant("first"),
			{ role: "toolResult", content: [] },
			assistant("final"),
			{ role: "assistant", content: [] },
		];
		expect(finalAssistantText(messages)).toBe("final");
		expect(finalAssistantText([])).toBeNull();
	});
});

describe("pane state", () => {
	let dir: string | null = null;
	afterEach(() => {
		if (dir) fs.rmSync(dir, { recursive: true, force: true });
		dir = null;
	});
	test("round trip with private modes", () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-shell-pane-"));
		const paneDir = path.join(dir, "shell-panes");
		expect(readPaneState("tmux.abc.3", paneDir)).toBeNull();
		writePaneState("tmux.abc.3", "inst-1", paneDir);
		expect(readPaneState("tmux.abc.3", paneDir)).toEqual({
			version: 1,
			instanceId: "inst-1",
			clientId: "shell-tmux.abc.3",
		});
		expect(fs.statSync(paneDir).mode & 0o777).toBe(0o700);
		expect(fs.statSync(path.join(paneDir, "tmux.abc.3.json")).mode & 0o777).toBe(0o600);
		writePaneState("tmux.abc.3", "inst-2", paneDir);
		expect(readPaneState("tmux.abc.3", paneDir)?.instanceId).toBe("inst-2");
		clearPaneState("tmux.abc.3", paneDir);
		expect(readPaneState("tmux.abc.3", paneDir)).toBeNull();
	});
	test("malformed file reads as unattached", () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-shell-pane-"));
		fs.writeFileSync(path.join(dir, "k.json"), "{nope");
		expect(readPaneState("k", dir)).toBeNull();
		fs.writeFileSync(path.join(dir, "k.json"), JSON.stringify({ version: 2, instanceId: "a", clientId: "b" }));
		expect(readPaneState("k", dir)).toBeNull();
	});
});

describe("resolveSessionId", () => {
	const entry = (sessionId: string, kind?: "tui" | "host"): RpcHostEntry =>
		({
			instanceId: `inst-${sessionId}`,
			pid: 1,
			endpoint: "/sock",
			token: "secret-token",
			sessionId,
			sessionName: null,
			sessionFile: null,
			cwd: "/w",
			model: null,
			startedAt: 0,
			...(kind ? { kind } : {}),
		}) as RpcHostEntry;
	const entries = [entry("abc123", "host"), entry("abc456"), entry("abc")];

	test("exact id wins over a prefix of others", () => {
		const match = resolveSessionId(entries, "abc");
		expect(match.ok && match.entry.instanceId).toBe("inst-abc");
	});
	test("unique prefix resolves; entries without kind are TUIs", () => {
		const match = resolveSessionId(entries, "abc4");
		expect(match.ok && match.entry.instanceId).toBe("inst-abc456");
	});
	test("ambiguous prefix lists candidates by kind, never tokens", () => {
		const match = resolveSessionId(entries, "abc1".slice(0, 2));
		expect(match.ok).toBe(false);
		if (match.ok) return;
		expect(match.error).toContain("ambiguous");
		expect(match.error).toContain("abc123  [host]");
		expect(match.error).toContain("abc456  [tui]");
		expect(match.error).not.toContain("secret-token");
		expect(match.error).not.toContain("/sock");
	});
	test("no match names the query and the live sessions", () => {
		const match = resolveSessionId(entries, "zz");
		expect(match.ok).toBe(false);
		if (!match.ok) expect(match.error).toContain('no live session id starts with "zz"');
		const none = resolveSessionId([], "zz");
		if (!none.ok) expect(none.error).toContain("no live sessions");
	});
});

describe("parseArgv --id", () => {
	test("/a --id takes the next word as the session id", () => {
		expect(parseArgv(["/a", "--id", "abc", "do", "it"])).toEqual({
			kind: "attach",
			prompt: "do it",
			all: false,
			sessionId: "abc",
		});
		expect(parseArgv(["/r", "--id", "abc", "/l"])).toEqual({
			kind: "resume",
			prompt: null,
			all: false,
			last: true,
			sessionId: "abc",
		});
		expect(parseArgv(["/a", "--id"]).sessionId).toBe("");
		expect(parseArgv(["--id", "x"]).sessionId).toBeUndefined();
	});
});
