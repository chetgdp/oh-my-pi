import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { RpcFrameEncoder } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-frame";
import { type MainDeps, run } from "../src/main";
import type { ProgramStatus } from "../src/program-status";
import { Chrome } from "../src/output";
import { readPaneState, setPaneBookmark, writePaneState } from "../src/pane-state";
import type { HostRow } from "../src/tty-ui";

type Frame = Record<string, unknown>;

/** Scripted host connection: receives parsed frames, answers through `send`. */
interface FakeConn {
	auth: Frame;
	frames: Frame[];
	send(frame: Frame): void;
	end(frame?: Frame): void;
}

/** Session state the fake host reports through get_state; tests mutate it to start or end a turn. */
interface FakeSession {
	streaming: boolean;
	leafId: string | null;
	/** Extra get_state fields. */
	state?: Frame;
	/** Approval mode RPCs; undefined models an older host without them. */
	approval?: { mode: string; forced: boolean };
}

const AGENT_BUSY = "Agent is already processing. Use steer() or followUp() to queue messages, or wait for completion.";

/**
 * Applies the rules the real host enforces before a test handler sees a frame
 * (rpc-server.ts validatePromptContext and the busy check). Returns false when
 * the host refused the frame itself.
 */
function applyHostRules(conn: FakeConn, frame: Frame, session: FakeSession): boolean {
	if (frame.type === "get_state") {
		conn.send({
			type: "response",
			id: frame.id,
			command: "get_state",
			success: true,
			data: { ...session.state, isStreaming: session.streaming, leafId: session.leafId },
		});
		return true;
	}
	if (frame.type === "get_approval_mode" || frame.type === "set_approval_mode") {
		const command = frame.type;
		const approval = session.approval;
		const fail = (error: string, code: string) =>
			conn.send({ type: "response", id: frame.id, command, success: false, error, code });
		if (!approval) fail(`Unknown command: ${command}`, "unknown_command");
		else if (command === "get_approval_mode") {
			conn.send({ type: "response", id: frame.id, command, success: true, data: approval });
		} else if (approval.forced) {
			fail("host runs with --yolo/--auto-approve; approval mode cannot change", "approval_mode_forced");
		} else if (!["always-ask", "always-ask-cached", "write", "yolo"].includes(String(frame.mode))) {
			fail(`invalid approval mode: ${String(frame.mode)}`, "invalid_approval_mode");
		} else {
			approval.mode = String(frame.mode);
			conn.send({ type: "response", id: frame.id, command, success: true, data: { mode: approval.mode } });
		}
		return false;
	}
	if (frame.type !== "prompt") return true;
	const refuse = (error: string) => {
		conn.send({ type: "response", id: frame.id, command: "prompt", success: false, error });
		return false;
	};
	if (frame.context !== undefined && frame.streamingBehavior !== undefined) {
		return refuse("context cannot be combined with streamingBehavior");
	}
	const slash = typeof frame.message === "string" && frame.message.startsWith("/");
	if (session.streaming && frame.streamingBehavior === undefined && !slash) return refuse(AGENT_BUSY);
	return true;
}

class FakeHost {
	readonly connections: FakeConn[] = [];
	readonly endpoint: string;
	readonly listening: Promise<void>;
	readonly #server: net.Server;

	constructor(
		readonly instanceId: string,
		root: string,
		registryDir: string,
		onAuth: (conn: FakeConn) => void,
		onFrame: (conn: FakeConn, frame: Frame) => void,
		readonly session: FakeSession,
	) {
		this.endpoint = path.join(root, `${instanceId}.sock`);
		this.#server = net.createServer(socket => {
			let buffer = "";
			let conn: FakeConn | null = null;
			socket.on("error", () => {});
			socket.on("data", chunk => {
				buffer += chunk.toString("utf8");
				for (let nl = buffer.indexOf("\n"); nl !== -1; nl = buffer.indexOf("\n")) {
					const frame = JSON.parse(buffer.slice(0, nl)) as Frame;
					buffer = buffer.slice(nl + 1);
					if (!conn) {
						conn = {
							auth: frame,
							frames: [],
							send: f => socket.write(`${JSON.stringify(f)}\n`),
							end: f => (f ? socket.end(`${JSON.stringify(f)}\n`) : socket.end()),
						};
						this.connections.push(conn);
						onAuth(conn);
					} else {
						conn.frames.push(frame);
						if (applyHostRules(conn, frame, this.session)) onFrame(conn, frame);
					}
				}
			});
		});
		const { promise, resolve } = Promise.withResolvers<void>();
		this.listening = promise;
		this.#server.listen(this.endpoint, resolve);
		fs.mkdirSync(registryDir, { recursive: true });
		fs.writeFileSync(
			path.join(registryDir, `${instanceId}.json`),
			JSON.stringify({
				version: 1,
				instanceId,
				pid: process.pid,
				endpoint: this.endpoint,
				token: `token-${instanceId}`,
				createdAt: Date.now(),
				sessionId: `session-${instanceId}`,
				sessionName: null,
				sessionFile: null,
				cwd: "/host/cwd",
				model: null,
				startedAt: Date.now(),
				kind: "host",
			}),
		);
	}

	close(): void {
		this.#server.close();
	}
}

const READY = { type: "ready", protocolVersion: 1 };
const PANE = "tmux.test.7";

let root: string;
let registryDir: string;
let paneDir: string;
let hosts: FakeHost[];

beforeEach(() => {
	// Short path: unix socket paths are capped near 104 bytes on macOS.
	root = fs.mkdtempSync("/tmp/omp-sh-");
	registryDir = path.join(root, "reg");
	paneDir = path.join(root, "panes");
	hosts = [];
});

afterEach(() => {
	for (const host of hosts) host.close();
	fs.rmSync(root, { recursive: true, force: true });
});

async function host(
	id: string,
	onAuth: (c: FakeConn) => void,
	onFrame: (c: FakeConn, f: Frame) => void = () => {},
	session: Partial<FakeSession> = {},
): Promise<FakeHost> {
	const created = new FakeHost(id, root, registryDir, onAuth, onFrame, {
		streaming: false,
		leafId: null,
		...session,
	});
	hosts.push(created);
	await created.listening;
	return created;
}

/** Prompt frames a connection received, skipping the get_state that precedes each prompt. */
const promptsOf = (h: FakeHost) => h.connections.at(-1)!.frames.filter(f => f.type === "prompt");

function deps(argv: string[], overrides: Partial<MainDeps> = {}) {
	const stdout: string[] = [];
	const commandOutput: string[] = [];
	const notices: string[] = [];
	const picks: HostRow[][] = [];
	const statuses: ProgramStatus[] = [];
	const value: MainDeps = {
		argv,
		stdin: null,
		cwd: "/pane/cwd",
		paneKey: PANE,
		paneDir,
		registryDir,
		pickHost: async rows => {
			picks.push(rows);
			return rows[0] ?? null;
		},
		pickApprovalMode: async () => {
			throw new Error("pickApprovalMode not expected");
		},
		answerUiRequest: async req => ({ type: "extension_ui_response", id: req.id, confirmed: true }),
		printNotice: text => notices.push(text),
		startHost: async () => {
			throw new Error("startHost not expected");
		},
		writeStdout: async text => {
			stdout.push(text);
		},
		writeCommandOutput: async text => {
			commandOutput.push(text);
		},
		chrome: new Chrome(false),
		interrupt: new AbortController().signal,
		forceExit: new AbortController().signal,
		reportStatus: status => statuses.push(status),
		...overrides,
	};
	return { value, stdout, commandOutput, notices, picks, statuses };
}

const assistant = (text: string) => ({ role: "assistant", content: [{ type: "text", text }] });

/** Host that runs one full turn, asking one confirm dialog in the middle. */
function turnHost(id: string): Promise<FakeHost> {
	return host(
		id,
		c => c.send(READY),
		(c, f) => {
			if (f.type === "prompt") {
				c.send({ type: "response", id: f.id, command: "prompt", success: true });
				c.send({ type: "agent_start" });
				c.send({ type: "tool_execution_start", toolCallId: "t1", toolName: "bash", args: { command: "ls" } });
				c.send({ type: "extension_ui_request", id: "ui-1", method: "confirm", title: "Run?", message: "ls" });
			} else if (f.type === "extension_ui_response") {
				c.send({ type: "message_end", message: assistant("interim") });
				c.send({ type: "message_end", message: assistant("final answer") });
				c.send({ type: "agent_end", messages: [assistant("interim"), assistant("final answer")] });
				c.send({
					type: "prompt_result",
					id: c.frames.find(frame => frame.type === "prompt")?.id,
					agentInvoked: true,
					status: "completed",
					sessionSettled: true,
				});
			}
		},
	);
}

/** Rewrites a fake host's registry entry as a TUI's. */
function asTui(h: FakeHost): FakeHost {
	const file = path.join(registryDir, `${h.instanceId}.json`);
	fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), kind: "tui" }));
	return h;
}

/** Rewrites a fake host's registry entry to serve `sessionId`. */
function withSessionId(h: FakeHost, sessionId: string): FakeHost {
	const file = path.join(registryDir, `${h.instanceId}.json`);
	fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), sessionId }));
	return h;
}

describe("attach by session id", () => {
	test("/a --id drives a TUI session like the web GUI: no attach_shell, prompt over the socket", async () => {
		const t = asTui(await turnHost("tui-aaaa"));
		await turnHost("host-bbbb");
		const d = deps(["/a", "--id", "session-tui-aaaa", "hello"]);
		expect(await run(d.value)).toBe(0);
		expect(d.picks).toEqual([]);
		expect(d.stdout.join("")).toBe("final answer\n");
		expect(String(promptsOf(t)[0]!.message).endsWith("hello")).toBe(true);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("tui-aaaa");
	});

	test("/a --id without a prompt binds a TUI without attach_shell", async () => {
		const t = asTui(await host("tui-aaaa", c => c.send(READY)));
		const d = deps(["/a", "--id", "session-tui"]);
		expect(await run(d.value)).toBe(0);
		expect(t.connections.flatMap(c => c.frames)).toEqual([]);
		expect(d.notices.at(-1)).toContain("[tui]");
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("tui-aaaa");
	});

	test("/a --id with an ambiguous prefix lists candidates without tokens and stays unattached", async () => {
		asTui(await turnHost("tui-aaaa"));
		await turnHost("host-bbbb");
		const d = deps(["/a", "--id", "session-"]);
		expect(await run(d.value)).toBe(1);
		const text = d.notices.join("\n");
		expect(text).toContain("ambiguous");
		// Each candidate is its own notice line; printNotice flattens newlines within one notice.
		expect(d.notices.filter(line => line.includes("session-tui-aaaa  [tui]"))).toHaveLength(1);
		expect(d.notices.filter(line => line.includes("session-host-bbbb  [host]"))).toHaveLength(1);
		expect(d.notices.some(line => line.includes("[tui]") && line.includes("[host]"))).toBe(false);
		expect(text).not.toContain("token-");
		expect(readPaneState(PANE, paneDir)).toBeNull();
	});

	test("/a --id with no match lists the live sessions", async () => {
		await turnHost("host-bbbb");
		const d = deps(["/a", "--id", "nope"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain('no live session id starts with "nope"');
		expect(d.notices.join("\n")).toContain("session-host-bbbb");
	});

	test("/a --id without a value is a usage error", async () => {
		const d = deps(["/a", "--id"]);
		expect(await run(d.value)).toBe(2);
	});

	test("the /a picker lists TUI sessions, marked by kind", async () => {
		asTui(await turnHost("tui-aaaa"));
		await turnHost("host-bbbb");
		const d = deps(["/a"], { pickHost: async rows => (d.picks.push(rows), null) });
		expect(await run(d.value)).toBe(1);
		const kinds = Object.fromEntries(d.picks[0]!.map(row => [row.instanceId, row.kind]));
		expect(kinds).toEqual({ "tui-aaaa": "tui", "host-bbbb": "host" });
	});
});

describe("one turn against a fake host", () => {
	test("ready -> prompt -> events -> prompt_result", async () => {
		const h = await turnHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["what", "is", "this"], { stdin: "piped\n" });
		expect(await run(d.value)).toBe(0);
		expect(d.stdout.join("")).toBe("final answer\n");
		// Probe connections carry no frames; the turn connection is the one that authed.
		const conn = h.connections.at(-1)!;
		expect(conn.auth).toEqual({
			type: "auth",
			token: "token-host-aaaa",
			surface: "shell",
			clientId: `shell-${PANE}`,
			attachment: PANE,
		});
		expect(conn.frames.map(f => f.type)).toEqual(["get_state", "prompt", "extension_ui_response"]);
		const prompt = conn.frames[1]!;
		expect(prompt.message).toBe("what is this\n\npiped");
		expect(prompt.context).toEqual({ paneCwd: "/pane/cwd" });
		expect(prompt.streamingBehavior).toBeUndefined();
		expect(conn.frames[2]).toEqual({ type: "extension_ui_response", id: "ui-1", confirmed: true });
		expect(d.statuses).toEqual([
			{ state: "working" },
			{ state: "blocked", kind: "permission", msg: "Run?" },
			{ state: "working" },
			{ state: "done" },
		]);
	});

	test("slash prompt is sent verbatim; command_output skips the renderer with escapes removed", async () => {
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type !== "prompt") return;
				c.send({ type: "command_output", text: "Messages  \x1b[38;2;95;102;115m█░\x1b[39m 5%\r\nsession stats" });
				c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/session"]);
		expect(await run(d.value)).toBe(0);
		expect(d.commandOutput.join("")).toBe("Messages  █░ 5%\nsession stats\n");
		expect(d.stdout).toEqual([]);
		expect(promptsOf(h)[0]!.message).toBe("/session");
		expect(promptsOf(h)[0]!.context).toBeUndefined();
		expect(d.statuses).toEqual([]);
	});

	test("/compact waits for background compaction, switches the spinner, and prints its result", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type === "prompt") {
					c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
				} else if (f.type === "get_state" && f.id === "shell-compact-state") {
					c.send({ type: "manual_compaction_start" });
					c.send({ type: "manual_compaction_end", result: { summary: "ok" }, aborted: false });
					c.send({ type: "command_output", text: "Compaction complete. Tokens: 5000 -> 1000 (saved 4000)." });
				}
			},
			{ state: { isCompacting: true } },
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/compact"]);
		expect(await run(d.value)).toBe(0);
		expect(d.commandOutput.join("")).toBe("Compaction complete. Tokens: 5000 -> 1000 (saved 4000).\n");
		expect(d.statuses).toEqual([{ state: "working" }, { state: "done" }]);
	});

	test("/compact with invalid args prints the usage error and exits without waiting", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type !== "prompt") return;
				c.send({ type: "command_output", text: "/compact snapcompact does not take focus instructions." });
				c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/compact", "snapcompact", "extra"]);
		expect(await run(d.value)).toBe(0);
		expect(d.commandOutput.join("")).toContain("does not take focus instructions");
		expect(d.statuses).toEqual([]);
	});

	test("/compact exits 1 when compaction fails", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type === "prompt") {
					c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
				} else if (f.type === "get_state" && f.id === "shell-compact-state") {
					c.send({ type: "manual_compaction_start" });
					c.send({ type: "manual_compaction_end", aborted: false, errorMessage: "nothing to compact" });
					c.send({ type: "command_output", text: "Compaction failed: nothing to compact" });
				}
			},
			{ state: { isCompacting: true } },
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/compact"]);
		expect(await run(d.value)).toBe(1);
		expect(d.commandOutput.join("")).toBe("Compaction failed: nothing to compact\n");
		expect(d.statuses).toEqual([{ state: "working" }, { state: "error", msg: "nothing to compact" }]);
	});

	test("/last prints the host's last assistant text without prompting", async () => {
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) =>
				c.send({
					type: "response",
					id: f.id,
					command: "get_last_assistant_text",
					success: true,
					data: { text: "# reply" },
				}),
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/last"]);
		expect(await run(d.value)).toBe(0);
		expect(d.stdout.join("")).toBe("# reply\n");
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_last_assistant_text"]);
	});

	test("/last with no reply yet exits 1 and leaves stdout empty", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) =>
				c.send({
					type: "response",
					id: f.id,
					command: "get_last_assistant_text",
					success: true,
					data: { text: null },
				}),
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/last"]);
		expect(await run(d.value)).toBe(1);
		expect(d.stdout).toEqual([]);
	});

	test("a refused prompt exits 1 with nothing on stdout", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type === "prompt") {
					c.send({ type: "response", id: f.id, command: "prompt", success: false, error: "no model" });
				}
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(1);
		expect(d.stdout).toEqual([]);
	});

	test("a turn starting between the state read and the prompt gets the prompt as a steer", async () => {
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				// The first get_state was answered idle; a subagent result wakes the agent right after.
				if (f.type === "get_state") h.session.streaming = true;
				if (f.type !== "prompt") return;
				c.send({ type: "response", id: f.id, command: "prompt", success: true });
				c.send({ type: "agent_end", messages: [assistant("steered reply")] });
				c.send({ type: "prompt_result", id: f.id, agentInvoked: true, status: "completed", sessionSettled: true });
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(0);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_state", "prompt", "get_state", "prompt"]);
		const [idle, steer] = promptsOf(h);
		expect(idle!.context).toEqual({ paneCwd: "/pane/cwd" });
		expect(steer).toEqual({ id: steer!.id, type: "prompt", message: "hi", streamingBehavior: "steer" });
		expect(steer!.id).not.toBe(idle!.id);
		expect(d.stdout.join("")).toBe("steered reply\n");
	});

	test("a dialog the host replays on connect is answered, not dropped by the state read", async () => {
		const h = await host(
			"host-aaaa",
			c => {
				c.send(READY);
				// A pane that detached while its turn waited on a confirm gets it back on reconnect.
				c.send({ type: "extension_ui_request", id: "ui-9", method: "confirm", title: "Run?", message: "rm" });
			},
			(c, f) => {
				if (f.type !== "prompt") return;
				c.send({ type: "response", id: f.id, command: "prompt", success: true });
				c.send({ type: "agent_end", messages: [assistant("done")] });
				c.send({ type: "prompt_result", id: f.id, agentInvoked: true, status: "completed", sessionSettled: true });
			},
			{ streaming: true },
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["go on"]);
		expect(await run(d.value)).toBe(0);
		expect(h.connections.at(-1)!.frames).toContainEqual({
			type: "extension_ui_response",
			id: "ui-9",
			confirmed: true,
		});
	});

	test("Ctrl-C during its own run detaches without aborting, bookmarks the leaf, and exits 130", async () => {
		const controller = new AbortController();
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type === "prompt") {
					c.send({ type: "response", id: f.id, command: "prompt", success: true });
					c.send({ type: "agent_start" });
				}
			},
			{ leafId: "leaf-7" },
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		// `working` is reported only after the client read agent_start.
		const d = deps(["long job"], {
			interrupt: controller.signal,
			reportStatus: s => s.state === "working" && controller.abort(),
		});
		expect(await run(d.value)).toBe(130);
		await Bun.sleep(50);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_state", "prompt", "get_state"]);
		expect(readPaneState(PANE, paneDir)?.bookmark).toBe("leaf-7");
	});

	test("a second Ctrl-C before the get_state reply exits 130 without a bookmark", async () => {
		const controller = new AbortController();
		const force = new AbortController();
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type === "prompt") {
					c.send({ type: "response", id: f.id, command: "prompt", success: true });
					c.send({ type: "agent_start" });
				} else if (f.type === "get_state" && c.frames.some(frame => frame.type === "prompt")) {
					force.abort();
				}
			},
			{ leafId: "leaf-7" },
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["long job"], {
			interrupt: controller.signal,
			forceExit: force.signal,
			reportStatus: s => s.state === "working" && controller.abort(),
		});
		expect(await run(d.value)).toBe(130);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_state", "prompt", "get_state"]);
		expect(readPaneState(PANE, paneDir)?.bookmark).toBeUndefined();
	});

	test("a prompt_result before background work settles keeps the client attached until session_settled", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type !== "prompt") return;
				c.send({ type: "response", id: f.id, command: "prompt", success: true });
				c.send({ type: "agent_start" });
				c.send({ type: "agent_end", messages: [assistant("spawned subagents")] });
				c.send({ type: "prompt_result", id: f.id, agentInvoked: true, status: "completed", sessionSettled: false });
				c.send({ type: "agent_start" });
				c.send({ type: "tool_execution_start", toolCallId: "t2", toolName: "read", args: { path: "a.ts" } });
				c.send({ type: "agent_end", messages: [assistant("subagents report: all good")] });
				c.send({ type: "session_settled" });
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["fan out"]);
		expect(await run(d.value)).toBe(0);
		// The first run's reply answers the prompt; a later wake must not replace it.
		expect(d.stdout).toEqual(["spawned subagents\n", "subagents report: all good\n"]);
		expect(d.statuses.at(-1)).toEqual({ state: "done" });
	});
});

describe("prompt into a busy session", () => {
	/** Host already streaming: queues the prompt, then delivers it and yields without a new agent_start. */
	function busyHost(id: string, onQueued: (c: FakeConn, f: Frame) => void): Promise<FakeHost> {
		return host(
			id,
			c => c.send(READY),
			(c, f) => {
				if (f.type !== "prompt") return;
				c.send({ type: "response", id: f.id, command: "prompt", success: true });
				const queue = f.streamingBehavior === "followUp" ? "followUp" : "steering";
				c.send({
					type: "queue_update",
					steering: queue === "steering" ? [f.message] : [],
					followUp: queue === "followUp" ? [f.message] : [],
					liveSteered: 0,
				});
				onQueued(c, f);
			},
			{ streaming: true },
		);
	}

	const deliver = (c: FakeConn, f: Frame) => {
		c.send({ type: "queue_update", steering: [], followUp: [], liveSteered: 0 });
		c.send({ type: "agent_end", messages: [assistant("earlier"), assistant("after steer")] });
		c.send({ type: "prompt_result", id: f.id, agentInvoked: true, status: "completed", sessionSettled: true });
	};

	test("a plain prompt steers and prints the reply once the run yields", async () => {
		const h = await busyHost("host-aaaa", deliver);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["also", "check", "tests"]);
		expect(await run(d.value)).toBe(0);
		const [prompt] = promptsOf(h);
		// The host refuses context with streamingBehavior, so a steer goes without the pane cwd.
		expect(prompt).toMatchObject({ message: "also check tests", streamingBehavior: "steer" });
		expect(prompt!.context).toBeUndefined();
		expect(d.stdout.join("")).toBe("after steer\n");
		expect(d.statuses).toEqual([{ state: "working" }, { state: "done" }]);
	});

	test("/f queues a follow-up, also after /a", async () => {
		const h = await busyHost("host-aaaa", deliver);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/a", "/f", "then", "commit"]);
		expect(await run(d.value)).toBe(0);
		const prompt = promptsOf(h)[0]!;
		expect(prompt.streamingBehavior).toBe("followUp");
		expect(prompt.message).toBe("then commit");
	});

	test("Ctrl-C while queued detaches and leaves the queued message in place", async () => {
		const controller = new AbortController();
		const h = await busyHost("host-aaaa", () => {});
		writePaneState(PANE, "host-aaaa", paneDir);
		const force = new AbortController();
		// `working` is reported only after the client read the queue_update holding the prompt.
		const d = deps(["/f", "later"], {
			interrupt: controller.signal,
			forceExit: force.signal,
			// A double Ctrl-C keeps this about the queued message, not the bookmark.
			reportStatus: s => s.state === "working" && (force.abort(), controller.abort()),
		});
		expect(await run(d.value)).toBe(130);
		await Bun.sleep(50);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_state", "prompt"]);
	});
});

describe("replay after Ctrl-C", () => {
	const missed = [
		{ type: "model_change", id: "e1" },
		{ type: "message", id: "e2", message: { role: "user", content: "long job" } },
		{
			type: "message",
			id: "e3",
			message: {
				role: "assistant",
				content: [
					{ type: "text", text: "checking" },
					{ type: "toolCall", id: "t1", name: "bash", arguments: { command: "ls" } },
				],
			},
		},
		{
			type: "message",
			id: "e4",
			message: {
				role: "toolResult",
				toolCallId: "t1",
				toolName: "bash",
				content: [{ type: "text", text: "a.txt" }],
				isError: false,
			},
		},
		{ type: "message", id: "e5", message: assistant("missed answer") },
	];

	/** Answers get_entries (or refuses an unknown since), /last, and prompts with a one-line reply. */
	function replayHost(id: string, unknownSince = false): Promise<FakeHost> {
		return host(
			id,
			c => c.send(READY),
			(c, f) => {
				if (f.type === "get_entries") {
					if (unknownSince) {
						c.send({
							type: "response",
							id: f.id,
							command: "get_entries",
							success: false,
							error: "no such entry",
							code: "unknown_since",
						});
					} else {
						c.send({
							type: "response",
							id: f.id,
							command: "get_entries",
							success: true,
							data: { entries: missed, leafId: "e5" },
						});
					}
				} else if (f.type === "get_last_assistant_text") {
					c.send({
						type: "response",
						id: f.id,
						command: "get_last_assistant_text",
						success: true,
						data: { text: "last" },
					});
				} else if (f.type === "prompt") {
					c.send({ type: "response", id: f.id, command: "prompt", success: true });
					c.send({ type: "agent_start" });
					c.send({ type: "message_end", message: assistant("new answer") });
					c.send({
						type: "prompt_result",
						id: f.id,
						agentInvoked: true,
						status: "completed",
						sessionSettled: true,
					});
				}
			},
		);
	}

	function bookmark(instanceId: string, leafId: string): void {
		writePaneState(PANE, instanceId, paneDir);
		setPaneBookmark(PANE, instanceId, leafId, paneDir);
	}

	function chromeLines(): { chrome: Chrome; lines: string[] } {
		const lines: string[] = [];
		return { chrome: new Chrome({ tty: false, write: text => lines.push(text) }), lines };
	}

	test("the next prompt replays missed entries before prompting and clears the bookmark", async () => {
		const h = await replayHost("host-aaaa");
		bookmark("host-aaaa", "leaf-7");
		const { chrome, lines } = chromeLines();
		const d = deps(["next"], { chrome });
		expect(await run(d.value)).toBe(0);
		const frames = h.connections.at(-1)!.frames;
		expect(frames.map(f => f.type)).toEqual(["get_entries", "get_state", "prompt"]);
		expect(frames[0]!.since).toBe("leaf-7");
		expect(d.stdout.join("")).toBe("checking\nmissed answer\nnew answer\n");
		expect(lines.join("")).toContain("· bash ls\n");
		expect(lines.join("")).toContain("a.txt");
		expect(lines.join("")).not.toContain("long job");
		expect(readPaneState(PANE, paneDir)?.bookmark).toBeUndefined();
	});

	test("re-attaching to another process serving the same session replays the bookmark there", async () => {
		const h = withSessionId(await replayHost("host-bbbb"), "shared");
		writePaneState(PANE, "vanished", paneDir, "shared");
		setPaneBookmark(PANE, "vanished", "leaf-7", paneDir);
		const d = deps(["next"]);
		expect(await run(d.value)).toBe(0);
		expect(d.notices).toEqual(["re-attached to host-bbbb"]);
		const frames = h.connections.at(-1)!.frames;
		expect(frames.map(f => f.type)).toEqual(["get_entries", "get_state", "prompt"]);
		expect(frames[0]!.since).toBe("leaf-7");
		expect(readPaneState(PANE, paneDir)?.bookmark).toBeUndefined();
	});

	test("/last also replays first", async () => {
		const h = await replayHost("host-aaaa");
		bookmark("host-aaaa", "leaf-7");
		const d = deps(["/last"]);
		expect(await run(d.value)).toBe(0);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_entries", "get_last_assistant_text"]);
		expect(d.stdout.join("")).toBe("checking\nmissed answer\nlast\n");
		expect(readPaneState(PANE, paneDir)?.bookmark).toBeUndefined();
	});

	test("unknown_since clears the bookmark, says so once, and still runs the command", async () => {
		const h = await replayHost("host-aaaa", true);
		bookmark("host-aaaa", "gone");
		const { chrome, lines } = chromeLines();
		const d = deps(["next"], { chrome });
		expect(await run(d.value)).toBe(0);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_entries", "get_state", "prompt"]);
		expect(d.stdout.join("")).toBe("new answer\n");
		expect(lines.filter(line => line.includes("nothing to replay"))).toHaveLength(1);
		expect(readPaneState(PANE, paneDir)?.bookmark).toBeUndefined();
	});

	test("a bookmark for another instance is not replayed", async () => {
		const b = await replayHost("host-bbbb");
		bookmark("host-aaaa", "leaf-7");
		const d = deps(["/n", "next"], {
			startHost: async () => ({ instanceId: "host-bbbb" }),
		});
		expect(await run(d.value)).toBe(0);
		expect(b.connections.at(-1)!.frames.map(f => f.type)).toEqual(["get_state", "prompt"]);
		expect(readPaneState(PANE, paneDir)).toMatchObject({ instanceId: "host-bbbb" });
		expect(readPaneState(PANE, paneDir)?.bookmark).toBeUndefined();
	});

	test("setPaneBookmark ignores a pane attached elsewhere", () => {
		writePaneState(PANE, "host-aaaa", paneDir);
		setPaneBookmark(PANE, "host-bbbb", "leaf-7", paneDir);
		expect(readPaneState(PANE, paneDir)?.bookmark).toBeUndefined();
	});
});

/** Host answering plan RPCs from `plan`, and running prompts like `turnHost` without dialogs. */
function planHost(id: string, plan: { enabled: boolean; paused: boolean }): Promise<FakeHost> {
	return host(
		id,
		c => c.send(READY),
		(c, f) => {
			if (f.type === "get_plan_state") {
				c.send({
					type: "response",
					id: f.id,
					command: "get_plan_state",
					success: true,
					data: { state: { available: true, ...plan }, review: null },
				});
			} else if (f.type === "set_plan_mode") {
				plan.enabled = f.enabled === true;
				plan.paused = false;
				const state = { available: true, ...plan, ...(plan.enabled ? { planFilePath: "local://PLAN.md" } : {}) };
				c.send({ type: "response", id: f.id, command: "set_plan_mode", success: true, data: { state } });
			} else if (f.type === "prompt") {
				c.send({ type: "response", id: f.id, command: "prompt", success: true });
				c.send({ type: "agent_start" });
				c.send({ type: "agent_end", messages: [assistant("the plan")] });
				c.send({ type: "prompt_result", id: f.id, agentInvoked: true, status: "completed", sessionSettled: true });
			}
		},
	);
}

describe("/plan", () => {
	test("toggles plan mode on, then off, printing the state and sending no prompt", async () => {
		const plan = { enabled: false, paused: false };
		const h = await planHost("host-aaaa", plan);
		writePaneState(PANE, "host-aaaa", paneDir);
		const on = deps(["/plan"]);
		expect(await run(on.value)).toBe(0);
		expect(h.connections.at(-1)!.frames).toEqual([
			{ id: "shell-plan-state", type: "get_plan_state" },
			{ id: "shell-plan-set", type: "set_plan_mode", enabled: true },
		]);
		expect(on.notices).toEqual(["plan mode: on (local://PLAN.md)"]);
		const off = deps(["/plan"]);
		expect(await run(off.value)).toBe(0);
		expect(h.connections.at(-1)!.frames[1]).toEqual({ id: "shell-plan-set", type: "set_plan_mode", enabled: false });
		expect(off.notices).toEqual(["plan mode: off"]);
		expect(off.stdout).toEqual([]);
	});

	test("with a prompt, enables plan mode and then sends the prompt as a turn", async () => {
		const h = await planHost("host-aaaa", { enabled: false, paused: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/plan", "add", "auth"]);
		expect(await run(d.value)).toBe(0);
		const frames = h.connections.at(-1)!.frames;
		expect(frames.map(f => f.type)).toEqual(["get_plan_state", "set_plan_mode", "get_state", "prompt"]);
		expect(frames[3]).toMatchObject({ message: "add auth", context: { paneCwd: "/pane/cwd" } });
		expect(d.notices[0]).toBe("plan mode: on (local://PLAN.md)");
		expect(d.stdout.join("")).toBe("the plan\n");
	});

	test("a paused plan mode without a prompt is cleared, not re-entered", async () => {
		const h = await planHost("host-aaaa", { enabled: false, paused: true });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/plan"]);
		expect(await run(d.value)).toBe(0);
		expect(h.connections.at(-1)!.frames[1]).toMatchObject({ type: "set_plan_mode", enabled: false });
	});
});

/** Host with approval mode RPCs that runs prompts like `planHost`. */
function permsHost(approval: { mode: string; forced: boolean } | undefined): Promise<FakeHost> {
	return host(
		"host-aaaa",
		c => c.send(READY),
		(c, f) => {
			if (f.type !== "prompt") return;
			c.send({ type: "response", id: f.id, command: "prompt", success: true });
			c.send({ type: "agent_start" });
			c.send({ type: "agent_end", messages: [assistant("ok")] });
			c.send({ type: "prompt_result", id: f.id, agentInvoked: true, status: "completed", sessionSettled: true });
		},
		{ approval },
	);
}

describe("approval mode", () => {
	const types = (h: FakeHost) => h.connections.at(-1)!.frames.map(f => f.type);

	test("/perms: picker preselects the current mode, the choice is set", async () => {
		const h = await permsHost({ mode: "write", forced: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const offered: string[] = [];
		const d = deps(["/perms"], {
			pickApprovalMode: async current => {
				offered.push(current);
				return "yolo";
			},
		});
		expect(await run(d.value)).toBe(0);
		expect(offered).toEqual(["write"]);
		expect(h.connections.at(-1)!.frames).toEqual([
			{ id: "shell-approval-get", type: "get_approval_mode" },
			{ id: "shell-approval-set", type: "set_approval_mode", mode: "yolo" },
		]);
		expect(d.notices).toEqual(["perms: yolo"]);
	});

	test("/perms cancelled: no set, exit 0", async () => {
		const h = await permsHost({ mode: "write", forced: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/perms"], { pickApprovalMode: async () => null });
		expect(await run(d.value)).toBe(0);
		expect(types(h)).toEqual(["get_approval_mode"]);
		expect(d.notices).toEqual([]);
	});

	test("/perms without a tty: notice, exit 1", async () => {
		const h = await permsHost({ mode: "write", forced: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/perms"], { pickApprovalMode: async () => "no-tty" });
		expect(await run(d.value)).toBe(1);
		expect(types(h)).toEqual(["get_approval_mode"]);
		expect(d.notices[0]).toContain("no tty");
	});

	test("/perms on a forced host: notice, no picker, exit 1", async () => {
		const h = await permsHost({ mode: "yolo", forced: true });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/perms"]);
		expect(await run(d.value)).toBe(1);
		expect(types(h)).toEqual(["get_approval_mode"]);
		expect(d.notices).toEqual(["omp-shell: host runs with --yolo/--auto-approve; approval mode cannot change"]);
	});

	test.each([
		["--ask", "always-ask"],
		["--ask-cached", "always-ask-cached"],
		["--write", "write"],
		["--yolo", "yolo"],
	])("%s alone sets %s, no turn", async (flag, mode) => {
		const h = await permsHost({ mode: "always-ask", forced: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps([flag]);
		expect(await run(d.value)).toBe(0);
		expect(h.connections.at(-1)!.frames).toEqual([{ id: "shell-approval-set", type: "set_approval_mode", mode }]);
		expect(d.notices).toEqual([`perms: ${mode}`]);
		expect(d.stdout).toEqual([]);
	});

	test("flag then text: set, then the prompt", async () => {
		const h = await permsHost({ mode: "always-ask", forced: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["--write", "fix", "it"], { stdin: "log" });
		expect(await run(d.value)).toBe(0);
		expect(types(h)).toEqual(["set_approval_mode", "get_state", "prompt"]);
		expect(promptsOf(h)[0]).toMatchObject({ message: "fix it\n\nlog" });
		expect(d.stdout.join("")).toBe("ok\n");
	});

	test("host error: message printed, exit 1, no prompt", async () => {
		const forced = await permsHost({ mode: "yolo", forced: true });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["--ask", "hi"]);
		expect(await run(d.value)).toBe(1);
		expect(types(forced)).toEqual(["set_approval_mode"]);
		expect(d.notices).toEqual(["omp-shell: host runs with --yolo/--auto-approve; approval mode cannot change"]);
	});

	test("older host without the command: exit 1, no prompt", async () => {
		const h = await permsHost(undefined);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["--yolo", "hi"]);
		expect(await run(d.value)).toBe(1);
		expect(types(h)).toEqual(["set_approval_mode"]);
		expect(d.notices).toEqual(["omp-shell: Unknown command: set_approval_mode"]);
	});

	test("a flag after the first word is prompt text", async () => {
		const h = await permsHost({ mode: "always-ask", forced: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["why", "--yolo"]);
		expect(await run(d.value)).toBe(0);
		expect(types(h)).toEqual(["get_state", "prompt"]);
		expect(promptsOf(h)[0]).toMatchObject({ message: "why --yolo" });
	});

	test("/status: perms row, marked when forced", async () => {
		await permsHost({ mode: "yolo", forced: true });
		writePaneState(PANE, "host-aaaa", paneDir, "session-host-aaaa");
		const d = deps(["/status"], { agentDir: root });
		expect(await run(d.value)).toBe(0);
		expect(d.notices.at(-1)).toBe("  perms       yolo (forced by --yolo)");
	});
});

describe("/diff", () => {
	const git = (cwd: string, ...args: string[]) => {
		const result = Bun.spawnSync(["git", ...args], { cwd, env: { ...Bun.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
		if (result.exitCode !== 0) throw new Error(result.stderr.toString());
	};
	const repo = () => {
		const dir = path.join(root, "repo");
		fs.mkdirSync(dir);
		git(dir, "init", "-q");
		fs.writeFileSync(path.join(dir, "a.txt"), "one\n");
		git(dir, "add", "a.txt");
		git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
		return dir;
	};

	test("no uncommitted changes: notice, exit 1, no host contact", async () => {
		const h = await turnHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/diff"], { cwd: repo() });
		expect(await run(d.value)).toBe(1);
		expect(d.notices).toEqual(["omp-shell: no uncommitted changes"]);
		expect(h.connections.flatMap(c => c.frames)).toEqual([]);
	});

	test("outside a repository: notice, exit 1", async () => {
		const d = deps(["/diff"], { cwd: root });
		expect(await run(d.value)).toBe(1);
		expect(d.notices[0]).toContain("is not in a repository");
	});

	test("prompt is the instruction, then the diff, then piped stdin", async () => {
		const dir = repo();
		fs.writeFileSync(path.join(dir, "a.txt"), "two\n");
		const h = await turnHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/diff", "review", "this"], { cwd: dir, stdin: "extra notes\n" });
		expect(await run(d.value)).toBe(0);
		const message = String(promptsOf(h)[0]!.message);
		expect(message).toStartWith("review this\n\n");
		expect(message).toContain("-one\n+two");
		expect(message).toEndWith("\n\nextra notes");
		const plain = deps(["/diff"], { cwd: dir });
		expect(await run(plain.value)).toBe(0);
		expect(String(promptsOf(h)[0]!.message)).toStartWith("summarize this diff\n\ndiff --git");
	});
});

describe("/export", () => {
	const user = (id: string, parentId: string | null, text: string) => ({
		type: "message",
		id,
		parentId,
		message: { role: "user", content: [{ type: "text", text }] },
	});
	const reply = (id: string, parentId: string, text: string, tool?: string) => ({
		type: "message",
		id,
		parentId,
		message: {
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "hidden" },
				{ type: "text", text },
				...(tool ? [{ type: "toolCall", name: "bash", arguments: { command: tool } }] : []),
			],
		},
	});
	// Turns u1, u2, u3 on the active branch, plus a dead branch off u1.
	const entries = [
		user("u1", null, "first"),
		reply("a1", "u1", "one", "ls"),
		{
			type: "message",
			id: "r1",
			parentId: "a1",
			message: { role: "toolResult", toolName: "bash", content: [{ type: "text", text: "out" }] },
		},
		user("dead", "r1", "abandoned"),
		{ type: "compaction", id: "c1", parentId: "r1", summary: "s" },
		user("u2", "c1", "second"),
		reply("a2", "u2", "two"),
		user("u3", "a2", "third"),
		reply("a3", "u3", "three"),
	];
	/** Speaks the host's v2 framing after `negotiate_protocol`, through the real encoder. */
	const exportHost = (id: string, served: unknown[] = entries, protocol: { v2: boolean } = { v2: true }) => {
		const encoder = new RpcFrameEncoder();
		return host(
			id,
			c => c.send(READY),
			(c, f) => {
				const reply = (frame: Frame) => {
					for (const line of encoder.encodeFrames(frame)) c.send(JSON.parse(line) as Frame);
				};
				if (f.type === "negotiate_protocol") {
					if (!protocol.v2) {
						reply({
							type: "response",
							id: f.id,
							command: "negotiate_protocol",
							success: false,
							error: "Unknown command",
						});
						return;
					}
					reply({
						type: "response",
						id: f.id,
						command: "negotiate_protocol",
						success: true,
						data: { protocolVersion: 2 },
					});
					encoder.setProtocolVersion(2);
				} else if (f.type === "get_entries") {
					reply({
						type: "response",
						id: f.id,
						command: "get_entries",
						success: true,
						data: { entries: served, leafId: "a3" },
					});
				} else if (f.type === "prompt") {
					c.send({ type: "command_output", text: `Session exported to: ${String(f.message).slice(8)}` });
					c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
				}
			},
		);
	};

	test("a get_entries over 2 MiB arrives in v2 chunks and /export 2 prints the last two turns", async () => {
		const big = entries.map(e => (e.id === "a1" ? reply("a1", "u1", "x".repeat(3 * 1024 * 1024), "ls") : e));
		const h = await exportHost("host-aaaa", big);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/export", "2"]);
		expect(await run(d.value)).toBe(0);
		expect(d.commandOutput.join("")).toBe("> second\n\ntwo\n\n> third\n\nthree\n");
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["negotiate_protocol", "get_entries"]);
	});

	test("a host refusing protocol v2 gets a notice and exit 1, no get_entries", async () => {
		const h = await exportHost("host-aaaa", entries, { v2: false });
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/export"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices).toEqual(["omp-shell: Unknown command"]);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["negotiate_protocol"]);
	});

	test("a transcript over 64 MiB reports the size limit", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type === "negotiate_protocol") {
					c.send({
						type: "response",
						id: f.id,
						command: "negotiate_protocol",
						success: true,
						data: { protocolVersion: 2 },
					});
				} else if (f.type === "get_entries") {
					c.send({
						type: "response",
						id: f.id,
						command: "get_entries",
						success: false,
						error: "RPC response exceeded the transport limit",
					});
				}
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/export"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices).toEqual(["omp-shell: transcript too large to export (over 64 MiB)"]);
	});

	test("prints the active branch: prompt, text, tool line; no thinking, results or dead branches", async () => {
		const h = await exportHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/export"]);
		expect(await run(d.value)).toBe(0);
		expect(h.connections.at(-1)!.frames).toEqual([
			{ id: "shell-export-protocol", type: "negotiate_protocol", protocolVersion: 2 },
			{ id: "shell-export", type: "get_entries" },
		]);
		expect(d.commandOutput.join("")).toBe(
			"> first\n\none\n\n· bash ls\n\n_[earlier context compacted]_\n\n> second\n\ntwo\n\n> third\n\nthree\n",
		);
		expect(d.stdout).toEqual([]);
	});

	test("/export 2 prints exactly the last two turns; N past the start prints all", async () => {
		await exportHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const two = deps(["/export", "2"]);
		expect(await run(two.value)).toBe(0);
		expect(two.commandOutput.join("")).toBe("> second\n\ntwo\n\n> third\n\nthree\n");
		const all = deps(["/export", "9"]);
		const full = deps(["/export"]);
		expect(await run(all.value)).toBe(0);
		expect(await run(full.value)).toBe(0);
		expect(all.commandOutput).toEqual(full.commandOutput);
	});

	test("bad N and --html with N are usage errors with no frames", async () => {
		const h = await exportHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		for (const argv of [
			["/export", "0"],
			["/export", "-1"],
			["/export", "x"],
		]) {
			const d = deps(argv);
			expect(await run(d.value)).toBe(1);
			expect(d.notices[0]).toStartWith("usage: ? /export");
		}
		for (const argv of [
			["/export", "--html", "3"],
			["/export", "5", "--html", "out.html"],
		]) {
			const d = deps(argv);
			expect(await run(d.value)).toBe(1);
			expect(d.notices[0]).toContain("--html always exports the whole session");
		}
		expect(h.connections.flatMap(c => c.frames)).toEqual([]);
	});

	test("--html sends the host /export with the path resolved against the pane cwd and prints its reply", async () => {
		const h = await exportHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/export", "--html", "out/s.html"]);
		expect(await run(d.value)).toBe(0);
		expect(promptsOf(h)[0]).toMatchObject({ type: "prompt", message: "/export /pane/cwd/out/s.html" });
		expect(promptsOf(h)[0]!.context).toBeUndefined();
		expect(d.commandOutput.join("")).toBe("Session exported to: /pane/cwd/out/s.html\n");
	});
});

/** Host for chains: last reply, `/model` as a builtin, prompts as one turn; records `/model` in order. */
function chainHost(id: string): Promise<FakeHost> {
	return host(
		id,
		c => c.send(READY),
		(c, f) => {
			if (f.type === "get_last_assistant_text") {
				c.send({
					type: "response",
					id: f.id,
					command: "get_last_assistant_text",
					success: true,
					data: { text: "earlier reply" },
				});
			} else if (f.type === "prompt" && String(f.message).startsWith("/model ")) {
				const model = String(f.message).slice(7);
				if (model === "nope") {
					// A failed builtin: accepted, then a prompt_result error carrying its output.
					const text = `Unknown model: ${model}. Use ...`;
					c.send({ type: "command_output", text });
					c.send({ type: "response", id: f.id, command: "prompt", success: true });
					c.send({
						type: "prompt_result",
						id: f.id,
						agentInvoked: false,
						status: "error",
						error: { message: text, retryable: false },
						sessionSettled: true,
					});
				} else {
					c.send({ type: "command_output", text: `Model set to p/${model}.` });
					c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
				}
			} else if (f.type === "prompt") {
				c.send({ type: "response", id: f.id, command: "prompt", success: true });
				c.send({ type: "agent_start" });
				c.send({ type: "agent_end", messages: [assistant("did it")] });
				c.send({ type: "prompt_result", id: f.id, agentInvoked: true, status: "completed", sessionSettled: true });
			}
		},
		{ approval: { mode: "yolo", forced: false } },
	);
}

describe("command chaining", () => {
	const shape = (h: FakeHost) =>
		h.connections.at(-1)!.frames.map(f => (f.type === "prompt" ? `prompt:${String(f.message)}` : String(f.type)));

	test("/l /m opus-5.5 do x: last reply, model switch, then the prompt, on one connection", async () => {
		const h = await chainHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/l", "/m", "opus-5.5", "do", "x"]);
		expect(await run(d.value)).toBe(0);
		expect(shape(h)).toEqual([
			"get_last_assistant_text",
			"get_state",
			"prompt:/model opus-5.5",
			"get_state",
			"prompt:do x",
		]);
		expect(d.stdout.join("")).toBe("earlier reply\ndid it\n");
		expect(d.commandOutput).toEqual([]);
		expect(d.notices).toContain("Model set to p/opus-5.5.");
	});

	test("--write /m x /l: steps run left to right, no prompt", async () => {
		const h = await chainHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["--write", "/m", "x", "/l"]);
		expect(await run(d.value)).toBe(0);
		expect(shape(h)).toEqual(["set_approval_mode", "get_state", "prompt:/model x", "get_last_assistant_text"]);
		expect(d.notices).toContain("perms: write");
		expect(d.stdout.join("")).toBe("earlier reply\n");
	});

	test("a failing /m stops the chain: exit 1, no prompt", async () => {
		const h = await chainHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/m", "nope", "/l", "do", "x"]);
		expect(await run(d.value)).toBe(1);
		expect(shape(h)).toEqual(["get_state", "prompt:/model nope"]);
		expect(d.stdout).toEqual([]);
	});

	test("/m without a model at the end of a chain is a usage error with no frames", async () => {
		const h = await chainHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/l", "/m"]);
		expect(await run(d.value)).toBe(2);
		expect(h.connections.flatMap(c => c.frames)).toEqual([]);
	});

	test("/a picks once, then runs the chain and the prompt", async () => {
		const h = await chainHost("host-aaaa");
		const d = deps(["/a", "/m", "opus", "go"]);
		expect(await run(d.value)).toBe(0);
		expect(d.picks).toHaveLength(1);
		expect(shape(h)).toEqual(["get_state", "prompt:/model opus", "get_state", "prompt:go"]);
	});

	test("single forms keep their behaviour", async () => {
		const h = await chainHost("host-aaaa");
		writePaneState(PANE, "host-aaaa", paneDir);
		const cases: Array<[string[], string[]]> = [
			[["/m"], ["get_state", "prompt:/model"]],
			[
				["/m", "opus"],
				["get_state", "prompt:/model opus"],
			],
			[["/l"], ["get_last_assistant_text"]],
			[["--write"], ["set_approval_mode"]],
			[
				["--write", "text"],
				["set_approval_mode", "get_state", "prompt:text"],
			],
			[
				["why", "/m"],
				["get_state", "prompt:why /m"],
			],
			[
				["/etc/hosts", "is", "broken"],
				["get_state", "prompt:/etc/hosts is broken"],
			],
		];
		for (const [argv, frames] of cases) {
			const d = deps(argv);
			expect(await run(d.value)).toBe(0);
			expect(shape(h)).toEqual(frames);
		}
		const single = deps(["/m", "opus"]);
		expect(await run(single.value)).toBe(0);
		expect(single.commandOutput).toEqual(["Model set to p/opus.\n"]);
		const bad = deps(["/m", "nope"]);
		expect(await run(bad.value)).toBe(1);
		expect(bad.commandOutput).toEqual(["Unknown model: nope. Use ...\n"]);
		expect(bad.stdout).toEqual([]);
	});
});

describe("/output", () => {
	test("sets shell.toolLines in the global config, keeping other keys, and shows it", async () => {
		const file = path.join(root, "config.yml");
		fs.writeFileSync(file, "rpc:\n  serve: true\nshell:\n  render: glow\n");
		const set = deps(["/output", "12"], { agentDir: root, paneKey: null });
		expect(await run(set.value)).toBe(0);
		expect(Bun.YAML.parse(fs.readFileSync(file, "utf8"))).toEqual({
			rpc: { serve: true },
			shell: { render: "glow", toolLines: 12 },
		});
		const show = deps(["/output"], { agentDir: root });
		expect(await run(show.value)).toBe(0);
		expect(show.notices[0]).toStartWith("tool result lines: 12");
	});

	test("rejects a value that is neither a count nor all, leaving the config untouched", async () => {
		const file = path.join(root, "config.yml");
		fs.writeFileSync(file, "shell:\n  toolLines: all\n");
		const d = deps(["/output", "-3"], { agentDir: root });
		expect(await run(d.value)).toBe(2);
		expect(d.notices[0]).toContain('not "-3"');
		expect(fs.readFileSync(file, "utf8")).toBe("shell:\n  toolLines: all\n");
	});
});

describe("/status", () => {
	test("unattached pane: settings and pane rows, no picker, exit 0", async () => {
		await turnHost("host-bbbb");
		const d = deps(["/status"], { agentDir: root });
		expect(await run(d.value)).toBe(0);
		expect(d.picks).toEqual([]);
		expect(d.notices).toEqual([
			"shell",
			`  config      ${path.join(root, "config.yml")}`,
			"  toolLines   default",
			"  render      unset",
			"  status      on",
			"pane",
			`  key         ${PANE}`,
			"session",
			"  none        no session attached (? /a to pick one)",
		]);
	});

	test("no pane: notes it and exits 0", async () => {
		const d = deps(["/st"], { agentDir: root, paneKey: null });
		expect(await run(d.value)).toBe(0);
		expect(d.notices.slice(-4)).toEqual([
			"pane",
			"  key         none (no tmux pane or tty identifies this shell)",
			"session",
			"  none        no session attached (? /a to pick one)",
		]);
	});

	test("attached: one get_state, session rows, no prompt", async () => {
		fs.writeFileSync(
			path.join(root, "config.yml"),
			"shell:\n  render: glow\n  toolLines: 4\nterminal:\n  programStatus: false\n",
		);
		const h = await host("host-aaaa", c => c.send(READY), undefined, {
			streaming: true,
			state: {
				sessionId: "session-host-aaaa",
				sessionName: "fix build",
				sessionFile: "/s/a.jsonl",
				model: { provider: "anthropic", id: "claude-x" },
				thinkingLevel: "high",
				contextUsage: { tokens: 12345, contextWindow: 200000, percent: 6.17 },
				messageCount: 9,
				queuedMessageCount: 0,
				isCompacting: false,
				isSettled: false,
				todoPhases: [
					{
						name: "p",
						tasks: [
							{ content: "a", status: "completed" },
							{ content: "b", status: "in_progress" },
						],
					},
				],
			},
		});
		writePaneState(PANE, "host-aaaa", paneDir, "session-host-aaaa");
		setPaneBookmark(PANE, "host-aaaa", "leaf-3", paneDir);
		const d = deps(["/status"], { agentDir: root });
		expect(await run(d.value)).toBe(0);
		expect(d.notices).toEqual([
			"shell",
			`  config      ${path.join(root, "config.yml")}`,
			"  toolLines   4",
			"  render      glow",
			"  status      off",
			"pane",
			`  key         ${PANE}`,
			"  attached    host-aaaa (host)",
			"  session     session-host-aaaa",
			"  bookmark    pending",
			"session",
			"  name        fix build",
			"  model       anthropic/claude-x (thinking high)",
			"  cwd         /host/cwd",
			"  file        /s/a.jsonl",
			"  context     12,345 / 200,000 tokens (6%)",
			"  messages    9",
			"  todos       1/2 done (now: b)",
			"  state       busy (running)",
		]);
		expect(h.connections.at(-1)!.frames).toEqual([
			{ id: "status", type: "get_state", light: true },
			{ id: "shell-approval-get", type: "get_approval_mode" },
		]);
		expect(readPaneState(PANE, paneDir)?.bookmark).toBe("leaf-3");
	});

	test("color: true styles headers, labels and values, resetting each run", async () => {
		await host("host-aaaa", c => c.send(READY), undefined, {
			state: { contextUsage: { tokens: 90, contextWindow: 100, percent: 90 }, isSettled: true },
		});
		writePaneState(PANE, "host-aaaa", paneDir, "session-host-aaaa");
		const settled = deps(["/status"], { agentDir: root, color: true });
		expect(await run(settled.value)).toBe(0);
		expect(settled.notices).toContain("\x1b[1mshell\x1b[0m");
		expect(settled.notices).toContain("  \x1b[2mtoolLines\x1b[0m   default");
		expect(settled.notices).toContain("  \x1b[2mbookmark\x1b[0m    \x1b[2mnone\x1b[0m");
		expect(settled.notices).toContain("  \x1b[2mcontext\x1b[0m     \x1b[31m90 / 100 tokens (90%)\x1b[0m");
		expect(settled.notices).toContain("  \x1b[2mstate\x1b[0m       \x1b[32msettled\x1b[0m");
		hosts[0]!.session.streaming = true;
		const busy = deps(["/status"], { agentDir: root, color: true });
		expect(await run(busy.value)).toBe(0);
		expect(busy.notices).toContain("  \x1b[2mstate\x1b[0m       \x1b[33mbusy (running)\x1b[0m");
	});

	test("color: false prints no escapes", async () => {
		await host("host-aaaa", c => c.send(READY), undefined, { streaming: true });
		writePaneState(PANE, "host-aaaa", paneDir, "session-host-aaaa");
		const d = deps(["/status"], { agentDir: root, color: false });
		expect(await run(d.value)).toBe(0);
		expect(d.notices.some(row => row.includes("\x1b"))).toBe(false);
		expect(d.notices).toContain("  state       busy (running)");
	});

	test("attached instance gone: settings printed, notice, exit 1", async () => {
		writePaneState(PANE, "host-dead", paneDir, "session-x");
		const d = deps(["/status"], { agentDir: root });
		expect(await run(d.value)).toBe(1);
		expect(d.notices[0]).toBe("shell");
		expect(d.notices.at(-1)).toBe("omp-shell: attached instance host-dead is not running");
		expect(d.picks).toEqual([]);
	});
});

describe("attachment", () => {
	test("no attachment, no live hosts: notice, exit 1", async () => {
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices).toEqual(["no session attached", "no live sessions (? /n to start one)"]);
	});

	test("no attachment: picker, prompt goes to picked host, pane bound", async () => {
		const b = await turnHost("host-bbbb");
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(0);
		expect(d.stdout.join("")).toBe("final answer\n");
		expect(String(promptsOf(b)[0]!.message).endsWith("hi")).toBe(true);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-bbbb");
		expect(d.notices).toEqual(["no session attached", "attached to host-bbbb"]);
	});

	test("attached host gone, picker cancelled: exit 1, nothing sent, binding unchanged", async () => {
		const b = await turnHost("host-bbbb");
		writePaneState(PANE, "vanished", paneDir);
		const d = deps(["hi"], { pickHost: async () => null });
		expect(await run(d.value)).toBe(1);
		expect(d.notices).toContain("no session attached");
		expect(b.connections).toEqual([]);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("vanished");
	});

	test("attached host gone, same session served elsewhere: re-attach notice, prompt goes there, pane rebound", async () => {
		const t = withSessionId(asTui(await turnHost("tui-cccc")), "shared");
		const other = await turnHost("host-bbbb");
		writePaneState(PANE, "vanished", paneDir, "shared");
		const d = deps(["hi"], {
			pickHost: async () => {
				throw new Error("picker not expected");
			},
		});
		expect(await run(d.value)).toBe(0);
		expect(d.notices).toEqual(["re-attached to tui-cccc [tui]"]);
		expect(d.stdout.join("")).toContain("final answer\n");
		expect(String(promptsOf(t)[0]!.message).endsWith("hi")).toBe(true);
		expect(other.connections).toEqual([]);
		const state = readPaneState(PANE, paneDir);
		expect(state?.instanceId).toBe("tui-cccc");
		expect(state?.sessionId).toBe("shared");
	});

	test("attached host gone, no live process serves its session: notice and picker as before", async () => {
		const b = await turnHost("host-bbbb");
		writePaneState(PANE, "vanished", paneDir, "shared");
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(0);
		expect(d.notices).toEqual(["no session attached", "attached to host-bbbb"]);
		expect(d.picks).toHaveLength(1);
		expect(String(promptsOf(b)[0]!.message).endsWith("hi")).toBe(true);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-bbbb");
	});

	test("pane state written without a session id falls back to the picker", async () => {
		const b = withSessionId(await turnHost("host-bbbb"), "shared");
		fs.mkdirSync(paneDir, { recursive: true });
		fs.writeFileSync(
			path.join(paneDir, `${PANE}.json`),
			JSON.stringify({ version: 1, instanceId: "vanished", clientId: `shell-${PANE}` }),
		);
		const d = deps(["hi"], { pickHost: async () => null });
		expect(await run(d.value)).toBe(1);
		expect(d.notices).toEqual(["no session attached"]);
		expect(d.picks).toHaveLength(0);
		expect(b.connections).toEqual([]);
	});

	test("attachment_detached: notice, picker, held prompt goes to picked host", async () => {
		const a = await host("host-aaaa", c =>
			c.end({ type: "error", error: "detached", code: "attachment_detached", instanceId: "host-aaaa" }),
		);
		const b = await turnHost("host-bbbb");
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["held", "prompt"], {
			pickHost: async rows => rows.find(row => row.instanceId === "host-bbbb") ?? null,
		});
		expect(await run(d.value)).toBe(0);
		expect(d.notices).toContain("pane detached from host-aaaa");
		expect(d.stdout.join("")).toBe("final answer\n");
		expect(a.connections.at(-1)!.frames).toEqual([]);
		expect(String(promptsOf(b)[0]!.message).endsWith("held prompt")).toBe(true);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-bbbb");
	});

	test("/a without prompt attaches and registers the pane with attach_shell", async () => {
		const b = await host(
			"host-bbbb",
			c => c.send(READY),
			(c, f) => c.send({ type: "response", id: f.id, command: f.type, success: true }),
		);
		const d = deps(["/a"]);
		expect(await run(d.value)).toBe(0);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-bbbb");
		const sent = b.connections.flatMap(c => c.frames);
		expect(sent).toEqual([{ id: "attach", type: "attach_shell" }]);
		expect(b.connections.find(c => c.frames.length > 0)?.auth.attachment).toBe(PANE);
	});

	test("/a /l registers the pane, then prints the last reply without prompting", async () => {
		const b = await host(
			"host-bbbb",
			c => c.send(READY),
			(c, f) => c.send({ type: "response", id: f.id, command: f.type, success: true, data: { text: "# reply" } }),
		);
		const d = deps(["/a", "/l"]);
		expect(await run(d.value)).toBe(0);
		expect(d.stdout.join("")).toBe("# reply\n");
		expect(b.connections.flatMap(c => c.frames).map(f => f.type)).toEqual([
			"attach_shell",
			"get_last_assistant_text",
		]);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-bbbb");
	});

	test("/a on the host that detached this pane attaches with one pick", async () => {
		// The host refuses a detached pane's next connection once, then accepts it.
		let refused = false;
		const a = await host(
			"host-aaaa",
			c => {
				if (refused) return c.send(READY);
				refused = true;
				c.end({ type: "error", error: "detached", code: "attachment_detached", instanceId: "host-aaaa" });
			},
			(c, f) => c.send({ type: "response", id: f.id, command: f.type, success: true }),
		);
		const d = deps(["/a"]);
		expect(await run(d.value)).toBe(0);
		expect(d.picks).toHaveLength(1);
		expect(d.notices).toContain("attached to host-aaaa");
		expect(a.connections.flatMap(c => c.frames)).toEqual([{ id: "attach", type: "attach_shell" }]);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-aaaa");
	});

	test("/a fails loudly when the host refuses attach_shell", async () => {
		await host(
			"host-bbbb",
			c => c.send(READY),
			(c, f) => c.send({ type: "response", id: f.id, command: f.type, success: false, error: "not a host" }),
		);
		const d = deps(["/a"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("not a host");
		expect(readPaneState(PANE, paneDir)).toBeNull();
	});

	test("/a on an outdated host names the cause and leaves the pane unattached", async () => {
		await host(
			"host-bbbb",
			c => c.send(READY),
			(c, f) =>
				c.send({
					type: "response",
					id: f.id,
					command: f.type,
					success: false,
					error: "Unknown command: attach_shell",
				}),
		);
		const d = deps(["/a"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("restart it with a current omp");
		expect(readPaneState(PANE, paneDir)).toBeNull();
	});

	test("/n starts a host in the pane cwd, attaches, and prompts it", async () => {
		const started: string[] = [];
		await turnHost("host-nnnn");
		const d = deps(["/n", "go"], {
			startHost: async cwd => {
				started.push(cwd);
				return { instanceId: "host-nnnn" };
			},
		});
		expect(await run(d.value)).toBe(0);
		expect(started).toEqual(["/pane/cwd"]);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-nnnn");
		expect(d.stdout.join("")).toBe("final answer\n");
	});

	test("/n --omem starts the host in omem mode and prompts it", async () => {
		const started: Array<boolean | undefined> = [];
		await turnHost("host-omem");
		const d = deps(["/n", "--omem", "go"], {
			startHost: async (_cwd, _resume, omem) => {
				started.push(omem);
				return { instanceId: "host-omem" };
			},
		});
		expect(await run(d.value)).toBe(0);
		expect(started).toEqual([true]);
		expect(d.stdout.join("")).toBe("final answer\n");
	});
});

describe("/r past sessions", () => {
	/** One session file under `<root>/sessions/<project>/`, with a first prompt so it is not a 0-turn stub. */
	function writeSession(project: string, id: string, cwd: string, prompt: string, modified: Date): string {
		const file = path.join(root, "sessions", project, `${id}.jsonl`);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const at = modified.toISOString();
		const lines = [
			{ type: "session", version: 3, id, timestamp: at, cwd },
			{
				type: "message",
				id: "m1",
				parentId: null,
				timestamp: at,
				message: { role: "user", content: prompt, timestamp: modified.getTime() },
			},
		];
		fs.writeFileSync(file, `${lines.map(line => JSON.stringify(line)).join("\n")}\n`);
		fs.utimesSync(file, modified, modified);
		return file;
	}

	test("/r --all lists past sessions newest first and resumes the picked one in its own cwd", async () => {
		writeSession("-a", "old", "/proj/a", "older work", new Date("2026-01-01"));
		const newer = writeSession("-b", "new", "/proj/b", "newer work", new Date("2026-02-01"));
		await turnHost("host-rrrr");
		const calls: Array<[string, string | undefined]> = [];
		const d = deps(["/r", "--all", "go"], {
			sessionsRoot: path.join(root, "sessions"),
			startHost: async (cwd, resume) => {
				calls.push([cwd, resume]);
				return { instanceId: "host-rrrr" };
			},
		});
		expect(await run(d.value)).toBe(0);
		expect(d.picks[0]?.map(row => row.sessionName)).toEqual(["newer work", "older work"]);
		expect(calls).toEqual([["/proj/b", newer]]);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-rrrr");
		expect(d.stdout.join("")).toBe("final answer\n");
	});

	test("/r on a session held by a TUI that does not answer says so and leaves the pane unattached", async () => {
		writeSession("-a", "held", "/proj/a", "tui work", new Date("2026-01-01"));
		fs.mkdirSync(registryDir, { recursive: true });
		fs.writeFileSync(
			path.join(registryDir, "tui-entry0.json"),
			JSON.stringify({
				version: 1,
				instanceId: "tui-entry0",
				pid: process.pid,
				endpoint: "/nonexistent",
				token: "t",
				createdAt: 0,
				sessionId: "held",
				sessionName: null,
				sessionFile: null,
				cwd: "/proj/a",
				model: null,
				startedAt: 0,
				kind: "tui",
			}),
		);
		const d = deps(["/r", "--all"], {
			sessionsRoot: path.join(root, "sessions"),
			startHost: async () => ({ instanceId: "tui-entry0" }),
		});
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("TUI holding that session does not answer");
		expect(readPaneState(PANE, paneDir)).toBeNull();
	});

	test("/r on a session held by a live TUI drives that TUI", async () => {
		writeSession("-a", "held", "/proj/a", "tui work", new Date("2026-01-01"));
		const t = asTui(await turnHost("tui-held"));
		const d = deps(["/r", "--all", "go"], {
			sessionsRoot: path.join(root, "sessions"),
			startHost: async () => ({ instanceId: "tui-held" }),
		});
		expect(await run(d.value)).toBe(0);
		expect(String(promptsOf(t)[0]!.message).endsWith("go")).toBe(true);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("tui-held");
	});

	test("/r --id resumes a past session by id prefix in its own cwd", async () => {
		writeSession("-a", "aaa111", "/proj/a", "first", new Date("2026-01-01"));
		const file = writeSession("-b", "bbb222", "/proj/b", "second", new Date("2026-02-01"));
		await turnHost("host-rrrr");
		const calls: Array<[string, string | undefined]> = [];
		const d = deps(["/r", "--id", "bbb", "go"], {
			sessionsRoot: path.join(root, "sessions"),
			startHost: async (cwd, resume) => {
				calls.push([cwd, resume]);
				return { instanceId: "host-rrrr" };
			},
		});
		expect(await run(d.value)).toBe(0);
		expect(d.picks).toEqual([]);
		expect(calls).toEqual([["/proj/b", file]]);
	});

	test("/r --id with an ambiguous past id lists the candidates", async () => {
		writeSession("-a", "abc1", "/proj/a", "first", new Date("2026-01-01"));
		writeSession("-b", "abc2", "/proj/b", "second", new Date("2026-02-01"));
		const d = deps(["/r", "--id", "abc"], { sessionsRoot: path.join(root, "sessions") });
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("ambiguous");
		expect(d.notices.join("\n")).toContain("abc1");
		expect(d.notices.join("\n")).toContain("abc2");
	});

	test("/r --id on a live session attaches to it without starting a host", async () => {
		const t = asTui(await turnHost("tui-live"));
		const d = deps(["/r", "--id", "session-tui", "hi"], { sessionsRoot: path.join(root, "sessions") });
		expect(await run(d.value)).toBe(0);
		expect(String(promptsOf(t)[0]!.message).endsWith("hi")).toBe(true);
	});

	test("/r with no sessions in the pane cwd points at --all", async () => {
		const d = deps(["/r"], { sessionsRoot: path.join(root, "sessions") });
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("? /r --all");
	});
});

describe("/stop", () => {
	/** Host that answers abort and shutdown, then removes its registry entry like an exiting host. */
	function stoppableHost(id: string): Promise<FakeHost> {
		return host(
			id,
			c => c.send(READY),
			(c, f) => {
				if (f.type !== "abort" && f.type !== "shutdown") return;
				c.send({ type: "response", id: f.id, command: f.type, success: true });
				if (f.type === "shutdown") fs.rmSync(path.join(registryDir, `${id}.json`), { force: true });
			},
		);
	}

	test("the picker lists the pane's session first and marked; picking another leaves the pane bound", async () => {
		const own = await stoppableHost("host-own0");
		const other = await stoppableHost("host-oth0");
		writePaneState(PANE, own.instanceId, paneDir, `session-${own.instanceId}`);
		const d = deps(["/stop"], { pickHost: async rows => (d.picks.push(rows), rows[1] ?? null) });
		expect(await run(d.value)).toBe(0);
		expect(d.picks[0]!.map(row => [row.instanceId, row.attached])).toEqual([
			["host-own0", true],
			["host-oth0", undefined],
		]);
		expect(other.connections.at(-1)!.frames.map(f => f.type)).toEqual(["abort", "shutdown"]);
		expect(own.connections).toHaveLength(0);
		expect(readPaneState(PANE, paneDir)?.instanceId).toBe("host-own0");
	});

	test("stopping the pane's own session clears the pane binding", async () => {
		const own = await stoppableHost("host-own1");
		writePaneState(PANE, own.instanceId, paneDir, `session-${own.instanceId}`);
		const d = deps(["/stop"]);
		expect(await run(d.value)).toBe(0);
		expect(readPaneState(PANE, paneDir)).toBeNull();
		expect(d.notices.join("\n")).toContain("stopped host-own1");
	});

	test("--id stops that session without a picker; an unknown id exits 1 and stops nothing", async () => {
		const target = await stoppableHost("host-idid");
		const miss = deps(["/stop", "--id", "nope"]);
		expect(await run(miss.value)).toBe(1);
		expect(target.connections).toHaveLength(0);
		const d = deps(["/stop", "--id", "session-host-idid"]);
		expect(await run(d.value)).toBe(0);
		expect(d.picks).toHaveLength(0);
		expect(target.connections.at(-1)!.frames.map(f => f.type)).toEqual(["abort", "shutdown"]);
	});
});
