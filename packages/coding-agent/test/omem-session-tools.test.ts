import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Writable } from "node:stream";
import { AgentBusyError } from "@oh-my-pi/pi-agent-core";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ToolDefinition } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import {
	resolveTmuxSession,
	type SessionToolsOptions,
	sessionTools,
	type TmuxRunner,
} from "@oh-my-pi/pi-coding-agent/omem/session-tools";
import { type RpcHostEntry, publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import {
	type RpcServeFn,
	type RpcSocketServer,
	startRpcSocketServer,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-socket";
import { TempDir } from "@oh-my-pi/pi-utils";

/** Host-side state the fake session reports and records. */
interface FakeState {
	streaming: boolean;
	settled: boolean;
	lastText: string | null;
	commands: Array<{ type: string; message?: string }>;
	/** Writers for every open connection, to push unsolicited frames. */
	outputs: Set<Writable>;
	onGetState?: () => void;
}

function fakeServe(state: FakeState): RpcServeFn {
	return ((_session: unknown, transport: { input: ReadableStream<Uint8Array>; output: Writable }) => {
		const { promise: closed, resolve } = Promise.withResolvers<void>();
		const write = (frame: object) => transport.output.write(`${JSON.stringify(frame)}\n`);
		state.outputs.add(transport.output);
		write({ type: "ready" });
		const reader = transport.input.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		void (async () => {
			for (;;) {
				const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let newline = buffer.indexOf("\n");
				while (newline !== -1) {
					const command = JSON.parse(buffer.slice(0, newline)) as { id: string; type: string; message?: string };
					buffer = buffer.slice(newline + 1);
					newline = buffer.indexOf("\n");
					state.commands.push({ type: command.type, message: command.message });
					const ok = (data?: object) =>
						write({ id: command.id, type: "response", command: command.type, success: true, data });
					switch (command.type) {
						case "get_state":
							ok({ sessionId: "remote", isStreaming: state.streaming, isSettled: state.settled });
							state.onGetState?.();
							break;
						case "prompt":
							if (state.streaming)
								write({
									id: command.id,
									type: "response",
									command: "prompt",
									success: false,
									error: new AgentBusyError().message,
								});
							else ok({ agentInvoked: true });
							break;
						case "follow_up":
							ok();
							break;
						case "get_last_assistant_text":
							ok({ text: state.lastText });
							break;
					}
				}
			}
			state.outputs.delete(transport.output);
			resolve();
		})();
		return { closed, close: () => void reader.cancel().catch(() => {}) };
	}) as unknown as RpcServeFn;
}

const servers: RpcSocketServer[] = [];
afterEach(async () => {
	for (const server of servers.splice(0)) await server.stop();
});

async function startFakeHost(registryDir: string, sessionId: string, state: Partial<FakeState> = {}) {
	const full: FakeState = {
		streaming: false,
		settled: true,
		lastText: null,
		commands: [],
		outputs: new Set(),
		...state,
	};
	const server = await startRpcSocketServer({} as never, {
		snapshot: { sessionId, sessionName: "remote", sessionFile: null, cwd: "/tmp", model: null, startedAt: 0 },
		onShutdown: () => {},
		registryDir,
		serve: fakeServe(full),
		kind: "host",
	});
	servers.push(server);
	return full;
}

function tools(registryDir: string, extra: Partial<SessionToolsOptions> = {}): Map<string, ToolDefinition> {
	const list = sessionTools({ settings: Settings.isolated(), registryDir, env: {}, ...extra });
	return new Map(list.map(tool => [tool.name, tool]));
}

async function run(tool: ToolDefinition | undefined, params: object, cwd = "/tmp"): Promise<string> {
	const ctx = { cwd, sessionManager: { getSessionId: () => "omem-self" } };
	const result = await tool!.execute("call", params as never, undefined, undefined, ctx as never);
	return result.content.map(part => ("text" in part ? part.text : "")).join("");
}

describe("omem session tools", () => {
	it("session_send starts a turn on an idle session", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		const state = await startFakeHost(dir.path(), "idle-1");
		const out = await run(tools(dir.path()).get("session_send"), { sessionId: "idle-1", text: "hello" });
		expect(out).toContain("started a turn");
		expect(state.commands).toEqual([{ type: "get_state" }, { type: "prompt", message: "hello" }]);
	});

	it("session_send queues a follow-up on a busy session", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		const state = await startFakeHost(dir.path(), "busy-1", { streaming: true, settled: false });
		const out = await run(tools(dir.path()).get("session_send"), { sessionId: "busy-1", text: "later" });
		expect(out).toContain("queued");
		expect(state.commands.map(c => c.type)).toEqual(["get_state", "follow_up"]);
	});

	it("unknown session id errors", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		await startFakeHost(dir.path(), "known");
		const out = await run(tools(dir.path()).get("session_send"), { sessionId: "nope", text: "x" });
		expect(out).toStartWith("Error: no live session nope");
	});

	it("a bad registry token errors without echoing the token", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		await startFakeHost(dir.path(), "guarded");
		const file = fs.readdirSync(dir.path()).find(name => name.endsWith(".json"))!;
		const entry = JSON.parse(fs.readFileSync(path.join(dir.path(), file), "utf8")) as RpcHostEntry;
		const forged = "forged-token-value";
		fs.writeFileSync(path.join(dir.path(), file), JSON.stringify({ ...entry, token: forged }), { mode: 0o600 });
		const out = await run(tools(dir.path()).get("session_read"), { sessionId: "guarded" });
		expect(out).toStartWith("Error:");
		expect(out).toContain("unauthorized");
		expect(out).not.toContain(forged);
		expect(out).not.toContain(entry.token);
	});

	it("session_read returns the last assistant text", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		await startFakeHost(dir.path(), "reader", { lastText: "the answer" });
		expect(await run(tools(dir.path()).get("session_read"), { sessionId: "reader" })).toBe("the answer");
	});

	it("session_read with wait returns once the session settles", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		const state = await startFakeHost(dir.path(), "worker", { streaming: true, settled: false, lastText: "partial" });
		const stateRead = Promise.withResolvers<void>();
		state.onGetState = stateRead.resolve;
		const reading = run(tools(dir.path()).get("session_read"), { sessionId: "worker", wait: true, timeoutSec: 10 });
		await stateRead.promise;
		state.streaming = false;
		state.settled = true;
		state.lastText = "done";
		for (const output of state.outputs) output.write(`${JSON.stringify({ type: "session_settled" })}\n`);
		expect(await reading).toBe("done");
	});

	// The wait limit is wall-clock time inside the tool; a short real limit is the behavior under test.
	it("session_read with wait reports a timeout", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		await startFakeHost(dir.path(), "slow", { streaming: true, settled: false, lastText: "partial" });
		const out = await run(tools(dir.path()).get("session_read"), { sessionId: "slow", wait: true, timeoutSec: 0.2 });
		expect(out).toStartWith("[not settled after 0.2s");
		expect(out).toEndWith("partial");
	});

	it("sessions_list reports state and no tokens", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		await startFakeHost(dir.path(), "a", { streaming: true, settled: false });
		await startFakeHost(dir.path(), "omem-self");
		const out = await run(tools(dir.path()).get("sessions_list"), {});
		const rows = out.split("\n").map(line => JSON.parse(line) as Record<string, unknown>);
		expect(rows.length).toBe(1);
		expect(rows[0]).toMatchObject({ sessionId: "a", kind: "host", state: "busy" });
		expect(Object.keys(rows[0]!)).not.toContain("token");
	});

	it("session_spawn opens a tmux window and returns the registered session", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		const calls: string[][] = [];
		const runTmux: TmuxRunner = async args => {
			calls.push(args);
			// The "TUI" registers under the pid tmux reports.
			publishRpcHost(
				{ sessionId: "spawned", sessionName: null, sessionFile: null, cwd: dir.path(), model: null, startedAt: 0 },
				{ dir: dir.path() },
			);
			return { exitCode: 0, stdout: `${process.pid}\n`, stderr: "" };
		};
		const out = await run(tools(dir.path(), { runTmux, ompCommand: ["omp-test"] }).get("session_spawn"), {
			cwd: dir.path(),
			name: "w1",
			tmuxSession: "work",
		});
		expect(out).toContain("Started session spawned in tmux work");
		expect(calls).toHaveLength(1);
		const args = calls[0]!;
		expect(args.slice(0, 7)).toEqual(["new-window", "-d", "-P", "-F", "#{pane_pid}", "-t", "work:"]);
		expect(args).toContain("omp-test");
		expect(args).not.toContain("--omem");
	});

	it("session_spawn errors when the session never registers", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		const runTmux: TmuxRunner = async () => ({ exitCode: 0, stdout: "999999\n", stderr: "" });
		const out = await run(
			tools(dir.path(), { runTmux, ompCommand: ["omp-test"], spawnTimeoutMs: 300 }).get("session_spawn"),
			{ cwd: dir.path(), tmuxSession: "work" },
		);
		expect(out).toStartWith("Error: session in tmux work (pid 999999) did not register");
	});

	it("session_spawn without tmux starts a headless host", async () => {
		using dir = TempDir.createSync("@omem-session-tools-");
		const starts: Array<{ cwd: string; prompt?: string }> = [];
		const out = await run(
			tools(dir.path(), {
				startHost: async options => {
					starts.push({ cwd: options.cwd, prompt: options.prompt });
					return { instanceId: "i", sessionId: "headless", endpoint: "e", pid: 1, reused: false };
				},
			}).get("session_spawn"),
			{ cwd: dir.path(), prompt: "go" },
		);
		expect(out).toContain("headless session headless");
		expect(starts).toEqual([{ cwd: dir.path(), prompt: "go" }]);
	});
});

describe("resolveTmuxSession", () => {
	const runTmux: TmuxRunner = async () => ({ exitCode: 0, stdout: "current\n", stderr: "" });

	it("prefers the argument, then the setting, then the current tmux session", async () => {
		expect(await resolveTmuxSession("arg", "setting", { TMUX: "x" }, runTmux)).toBe("arg");
		expect(await resolveTmuxSession(undefined, "setting", { TMUX: "x" }, runTmux)).toBe("setting");
		expect(await resolveTmuxSession(undefined, undefined, { TMUX: "x" }, runTmux)).toBe("current");
	});

	it("is undefined outside tmux or when tmux fails", async () => {
		expect(await resolveTmuxSession(undefined, undefined, {}, runTmux)).toBeUndefined();
		const failing: TmuxRunner = async () => ({ exitCode: 1, stdout: "", stderr: "no server" });
		expect(await resolveTmuxSession(undefined, undefined, { TMUX: "x" }, failing)).toBeUndefined();
	});
});
