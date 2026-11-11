import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
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
			data: { isStreaming: session.streaming, leafId: session.leafId },
		});
		return true;
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
		answerUiRequest: async req => ({ type: "extension_ui_response", id: req.id, confirmed: true }),
		printNotice: text => notices.push(text),
		startHost: async () => {
			throw new Error("startHost not expected");
		},
		writeStdout: async text => {
			stdout.push(text);
		},
		chrome: new Chrome(false),
		interrupt: new AbortController().signal,
		forceExit: new AbortController().signal,
		reportStatus: status => statuses.push(status),
		...overrides,
	};
	return { value, stdout, notices, picks, statuses };
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
		expect(text).toContain("session-tui-aaaa  [tui]");
		expect(text).toContain("session-host-bbbb  [host]");
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

	test("slash prompt is sent verbatim and agentInvoked:false prints command_output", async () => {
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type !== "prompt") return;
				c.send({ type: "command_output", text: "session stats" });
				c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/session"]);
		expect(await run(d.value)).toBe(0);
		expect(d.stdout.join("")).toBe("session stats\n");
		expect(promptsOf(h)[0]!.message).toBe("/session");
		expect(promptsOf(h)[0]!.context).toBeUndefined();
		expect(d.statuses).toEqual([]);
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
