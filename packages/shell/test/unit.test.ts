import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { mergeStdin, parseArgv, parseExportArgs } from "../src/commands";
import { assistantText, finalAssistantText } from "../src/output";
import { clearPaneState, readPaneState, writePaneState } from "../src/pane-state";
import { subagentLabel, subagentRow } from "../src/subagents";
import { buildPromptRequest } from "../src/turn";

describe("parseExportArgs", () => {
	test("N, --html [path], and usage errors", () => {
		expect(parseArgv(["/export", "3"])).toEqual({ kind: "export", prompt: "3", all: false });
		expect(parseExportArgs(null)).toEqual({ html: false });
		expect(parseExportArgs("3")).toEqual({ html: false, turns: 3 });
		expect(parseExportArgs("--html")).toEqual({ html: true });
		expect(parseExportArgs("--html out.html")).toEqual({ html: true, path: "out.html" });
		for (const bad of ["0", "-2", "abc", "1.5", "2 3", "--html 3", "--html a b"])
			expect(parseExportArgs(bad)).toBeNull();
	});
});

describe("parseArgv", () => {
	test("chains: leading /l, /m <model> and mode flags, then the prompt", () => {
		expect(parseArgv(["/l", "/m", "opus-5.5", "fix", "it"])).toEqual({
			kind: "prompt",
			prompt: "fix it",
			all: false,
			steps: [{ kind: "last" }, { kind: "model", model: "opus-5.5" }],
		});
		expect(parseArgv(["--write", "/m", "x", "/l"]).steps).toEqual([
			{ kind: "mode", mode: "write" },
			{ kind: "model", model: "x" },
			{ kind: "last" },
		]);
		expect(parseArgv(["/l", "/f", "go"], "in")).toMatchObject({ prompt: "go\n\nin", followUp: true });
		expect(parseArgv(["/r", "--all", "/l", "/m", "a"])).toMatchObject({ kind: "resume", all: true, prompt: null });
		expect(parseArgv(["/l", "/m"]).usage).toBe(true);
		expect(parseArgv(["--ask", "/m", "/l"]).usage).toBe(true);
		// Single forms are unchanged.
		expect(parseArgv(["/m", "opus"])).toEqual({ kind: "prompt", prompt: "/model opus", all: false });
		expect(parseArgv(["/m"])).toEqual({ kind: "prompt", prompt: "/model", all: false });
		expect(parseArgv(["/l"])).toEqual({ kind: "last", prompt: null, all: false });
		expect(parseArgv(["--write", "x"])).toEqual({ kind: "prompt", prompt: "x", all: false, mode: "write" });
		expect(parseArgv(["/a", "/l"])).toEqual({ kind: "attach", prompt: null, all: false, last: true });
		expect(parseArgv(["why", "/m"]).steps).toBeUndefined();
	});

	test("/plan takes an optional prompt merged with stdin; /diff keeps its instruction apart from stdin", () => {
		expect(parseArgv(["/plan"])).toEqual({ kind: "plan", prompt: null, all: false });
		expect(parseArgv(["/plan", "add", "auth"], "spec\n")).toEqual({
			kind: "plan",
			prompt: "add auth\n\nspec",
			all: false,
		});
		expect(parseArgv(["/diff"], "log")).toEqual({ kind: "diff", prompt: null, all: false });
		expect(parseArgv(["/diff", "review", "it"])).toEqual({ kind: "diff", prompt: "review it", all: false });
	});

	test("/sub and /main take no arguments", () => {
		expect(parseArgv(["/sub"])).toEqual({ kind: "sub", prompt: null, all: false });
		expect(parseArgv(["/main"])).toEqual({ kind: "main", prompt: null, all: false });
	});

	test("leading command words match in any case; values and prompt text keep theirs", () => {
		expect(parseArgv(["/SUB"])).toEqual({ kind: "sub", prompt: null, all: false });
		expect(parseArgv(["/A", "--ID", "AbC", "/L"])).toEqual({
			kind: "attach",
			prompt: null,
			all: false,
			last: true,
			sessionId: "AbC",
		});
		expect(parseArgv(["/M", "Opus-5", "/L", "Fix", "/L"])).toMatchObject({
			prompt: "Fix /L",
			steps: [{ kind: "model", model: "Opus-5" }, { kind: "last" }],
		});
		expect(parseArgv(["Why", "/SUB"])).toEqual({ kind: "prompt", prompt: "Why /SUB", all: false });
	});

	test("plain prompt joins words", () => {
		expect(parseArgv(["fix", "the", "bug"])).toEqual({ kind: "prompt", prompt: "fix the bug", all: false });
	});
	test("/a, /r and /n with and without prompt", () => {
		expect(parseArgv(["/a"])).toEqual({ kind: "attach", prompt: null, all: false });
		expect(parseArgv(["/a", "hi", "there"])).toEqual({ kind: "attach", prompt: "hi there", all: false });
		expect(parseArgv(["/n"])).toEqual({ kind: "new", prompt: null, all: false });
		expect(parseArgv(["/n", "go"])).toEqual({ kind: "new", prompt: "go", all: false });
		expect(parseArgv(["/new", "explain", "this"])).toEqual({ kind: "new", prompt: "explain this", all: false });
		expect(parseArgv(["/n", "--omem", "/l"])).toEqual({
			kind: "new",
			prompt: null,
			all: false,
			last: true,
			omem: true,
		});
		expect(parseArgv(["/a", "--omem", "x"])).toEqual({ kind: "attach", prompt: "--omem x", all: false });
		expect(parseArgv(["/stop"])).toEqual({ kind: "stop", prompt: null, all: false });
		expect(parseArgv(["/stop", "--id", "01jx"])).toEqual({
			kind: "stop",
			prompt: null,
			all: false,
			sessionId: "01jx",
		});
		expect(parseArgv(["/stop", "now"]).usage).toBe(true);
		expect(parseArgv(["/r", "--all", "go"])).toEqual({ kind: "resume", prompt: "go", all: true });
		expect(parseArgv(["/r", "go", "--all"])).toEqual({ kind: "resume", prompt: "go --all", all: false });
		expect(parseArgv(["/a", "--all"])).toEqual({ kind: "attach", prompt: "--all", all: false });
	});
	test("other slash text is a host prompt", () => {
		expect(parseArgv(["/compact", "now"])).toEqual({ kind: "prompt", prompt: "/compact now", all: false });
	});
	test("/status and /st take no arguments", () => {
		expect(parseArgv(["/status", "x"], "data")).toEqual({ kind: "status", prompt: null, all: false });
		expect(parseArgv(["/st"])).toEqual({ kind: "status", prompt: null, all: false });
	});
	test("/last alone ignores piped stdin; trailing words make a chain with a prompt", () => {
		expect(parseArgv(["/last"], "data")).toEqual({ kind: "last", prompt: null, all: false });
		expect(parseArgv(["/last", "x"], "data")).toMatchObject({
			kind: "prompt",
			prompt: "x\n\ndata",
			steps: [{ kind: "last" }],
		});
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

describe("parseArgv mode flags", () => {
	test("first-word flags map to modes", () => {
		expect(parseArgv(["--ask"])).toEqual({ kind: "prompt", prompt: null, all: false, mode: "always-ask" });
		expect(parseArgv(["--ask-cached"]).mode).toBe("always-ask-cached");
		expect(parseArgv(["--write"]).mode).toBe("write");
		expect(parseArgv(["--yolo", "fix", "it"], "log")).toEqual({
			kind: "prompt",
			prompt: "fix it\n\nlog",
			all: false,
			mode: "yolo",
		});
	});

	test("a flag elsewhere is prompt text", () => {
		expect(parseArgv(["why", "--yolo"])).toEqual({ kind: "prompt", prompt: "why --yolo", all: false });
	});

	test("/perms", () => {
		expect(parseArgv(["/perms"])).toEqual({ kind: "perms", prompt: null, all: false });
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

describe("subagent rows", () => {
	test("one picker label per running subagent", () => {
		const row = subagentRow({
			id: "sub-1",
			agent: "task",
			status: "running",
			description: "flaky tests",
			progress: { durationMs: 125_000, toolCount: 3, tokens: 1200, currentTool: "grep" },
		});
		expect(row).toEqual({
			id: "sub-1",
			agent: "task",
			status: "running",
			elapsedMs: 125_000,
			toolCount: 3,
			tokens: 1200,
			currentTool: "grep",
			description: "flaky tests",
		});
		expect(row && subagentLabel(row)).toBe("sub-1  task  running  2m  3 tools  1,200 tok  grep  flaky tests");
		expect(subagentRow({ agent: "task" })).toBeNull();
	});
});
