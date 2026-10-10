import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { type MainDeps, run } from "../src/main";
import { Chrome } from "../src/output";
import { readPaneState, writePaneState } from "../src/pane-state";
import type { HostRow } from "../src/tty-ui";

type Frame = Record<string, unknown>;

/** Scripted host connection: receives parsed frames, answers through `send`. */
interface FakeConn {
	auth: Frame;
	frames: Frame[];
	send(frame: Frame): void;
	end(frame?: Frame): void;
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
						onFrame(conn, frame);
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
): Promise<FakeHost> {
	const created = new FakeHost(id, root, registryDir, onAuth, onFrame);
	hosts.push(created);
	await created.listening;
	return created;
}

function deps(argv: string[], overrides: Partial<MainDeps> = {}) {
	const stdout: string[] = [];
	const notices: string[] = [];
	const picks: HostRow[][] = [];
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
		writeStdout: text => stdout.push(text),
		chrome: new Chrome(false),
		interrupt: new AbortController().signal,
		...overrides,
	};
	return { value, stdout, notices, picks };
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
					id: c.frames[0]?.id,
					agentInvoked: true,
					status: "completed",
					sessionSettled: true,
				});
			}
		},
	);
}

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
		const prompt = conn.frames[0]!;
		expect(prompt.type).toBe("prompt");
		expect(prompt.message).toBe("what is this\n\npiped");
		expect(prompt.context).toEqual({ paneCwd: "/pane/cwd" });
		expect(conn.frames[1]).toEqual({ type: "extension_ui_response", id: "ui-1", confirmed: true });
	});

	test("slash prompt is sent verbatim and agentInvoked:false prints command_output", async () => {
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				c.send({ type: "command_output", text: "session stats" });
				c.send({ type: "response", id: f.id, command: "prompt", success: true, data: { agentInvoked: false } });
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["/session"]);
		expect(await run(d.value)).toBe(0);
		expect(d.stdout.join("")).toBe("session stats\n");
		expect(h.connections.at(-1)!.frames[0]!.message).toBe("/session");
		expect(h.connections.at(-1)!.frames[0]!.context).toBeUndefined();
	});

	test("busy refusal exits 1 with nothing on stdout", async () => {
		await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => c.send({ type: "response", id: f.id, command: "prompt", success: false, error: "Agent is busy" }),
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(1);
		expect(d.stdout).toEqual([]);
	});

	test("interrupt sends abort and exits 130", async () => {
		const controller = new AbortController();
		const h = await host(
			"host-aaaa",
			c => c.send(READY),
			(c, f) => {
				if (f.type === "prompt") {
					c.send({ type: "response", id: f.id, command: "prompt", success: true });
					controller.abort();
				}
			},
		);
		writePaneState(PANE, "host-aaaa", paneDir);
		const d = deps(["long job"], { interrupt: controller.signal });
		expect(await run(d.value)).toBe(130);
		await Bun.sleep(50);
		expect(h.connections.at(-1)!.frames.map(f => f.type)).toEqual(["prompt", "abort"]);
	});
});

describe("attachment", () => {
	test("no attachment: notice, exit 1, nothing sent", async () => {
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("no session attached");
	});

	test("attached host gone: no session attached", async () => {
		writePaneState(PANE, "vanished", paneDir);
		const d = deps(["hi"]);
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("no session attached");
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
		expect(String(b.connections.at(-1)!.frames[0]!.message).endsWith("held prompt")).toBe(true);
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

	test("/r on a session held by a TUI says so and leaves the pane unattached", async () => {
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
		expect(d.notices.join("\n")).toContain("open in a TUI");
		expect(readPaneState(PANE, paneDir)).toBeNull();
	});

	test("/r with no sessions in the pane cwd points at --all", async () => {
		const d = deps(["/r"], { sessionsRoot: path.join(root, "sessions") });
		expect(await run(d.value)).toBe(1);
		expect(d.notices.join("\n")).toContain("? /r --all");
	});
});
