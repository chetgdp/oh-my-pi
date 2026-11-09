/**
 * Session-control tools for the omem main session: list, spawn, prompt, and read
 * other omp sessions over their RPC sockets (cheisms/omem.md, part 2).
 * Registry tokens authenticate the connection and never reach tool output.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import { AgentBusyError } from "@oh-my-pi/pi-agent-core";
import { $which, getBaseConfigRoot } from "@oh-my-pi/pi-utils";
import { $ } from "bun";
import type { Settings } from "../config/settings";
import type { ToolDefinition } from "../extensibility/extensions";
import { type Frame, HostSocket } from "../modes/rpc/rpc-client-socket";
import { type RpcHostStartOptions, type RpcHostStartResult, startRpcHost } from "../modes/rpc/rpc-host-launch";
import { listLiveRpcHosts, listRpcHosts, type RpcHostEntry } from "../modes/rpc/rpc-registry";
import sessionReadDescription from "../prompts/tools/session-read.md" with { type: "text" };
import sessionSendDescription from "../prompts/tools/session-send.md" with { type: "text" };
import sessionSpawnDescription from "../prompts/tools/session-spawn.md" with { type: "text" };
import sessionsListDescription from "../prompts/tools/sessions-list.md" with { type: "text" };
import { cfgOmemTmuxSession } from "../session/context-settings";
import { escapeTmuxArgument } from "../subprocess/terminal-launch/tmux";
import { resolveCliEntryCmd } from "../subprocess/worker-client";

export interface TmuxResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/** Runs `tmux <args>`; tests replace it. */
export type TmuxRunner = (args: string[]) => Promise<TmuxResult>;

export interface SessionToolsOptions {
	settings: Settings;
	/** Registry directory; defaults to `<configRoot>/run/rpc-hosts`. */
	registryDir?: string;
	/** Environment read for `$TMUX`; defaults to `process.env`. */
	env?: Record<string, string | undefined>;
	runTmux?: TmuxRunner;
	startHost?: (options: RpcHostStartOptions) => Promise<RpcHostStartResult>;
	/** Command that starts this omp; defaults to the running entry (binary or `bun cli.ts`). */
	ompCommand?: string[];
	/** How long `session_spawn` waits for the new TUI to register. */
	spawnTimeoutMs?: number;
}

const DEFAULT_SPAWN_TIMEOUT_MS = 30_000;
const SPAWN_POLL_MS = 250;
const DEFAULT_READ_TIMEOUT_SEC = 300;
const MAX_READ_TIMEOUT_SEC = 3_600;

class SessionControlError extends Error {}

const runTmuxDefault: TmuxRunner = async args => {
	const tmux = $which("tmux");
	if (!tmux) throw new SessionControlError("tmux is not on PATH");
	const result = await $`${tmux} ${args}`.quiet().nothrow();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
};

/** tmux target for a new session window: argument > `omem.tmuxSession` > the tmux session omp runs in > none. */
export async function resolveTmuxSession(
	arg: string | undefined,
	setting: string | undefined,
	env: Record<string, string | undefined>,
	runTmux: TmuxRunner,
): Promise<string | undefined> {
	if (arg) return arg;
	if (setting) return setting;
	if (!env.TMUX) return undefined;
	const result = await runTmux(["display-message", "-p", "#S"]);
	const name = result.stdout.trim();
	return result.exitCode === 0 && name ? name : undefined;
}

/** Settings overlay that turns on the RPC socket, so a spawned TUI registers. */
function rpcServeOverlay(): string {
	const file = path.join(getBaseConfigRoot(), "run", "omem-spawn.yml");
	fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	fs.writeFileSync(file, "rpc:\n  serve: true\n", { mode: 0o600 });
	return file;
}

function text(body: string) {
	return { content: [{ type: "text" as const, text: body }], details: undefined };
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function sessionTools(options: SessionToolsOptions): ToolDefinition[] {
	const registry = { dir: options.registryDir };
	const env = options.env ?? process.env;
	const runTmux = options.runTmux ?? runTmuxDefault;
	const startHost = options.startHost ?? startRpcHost;
	const clientId = `omem-${process.pid}`;

	async function findSession(id: string): Promise<RpcHostEntry> {
		const live = await listLiveRpcHosts(registry);
		const entry = live.find(host => host.sessionId === id || host.instanceId === id);
		if (!entry) throw new SessionControlError(`no live session ${id}`);
		return entry;
	}

	async function connect(entry: RpcHostEntry): Promise<HostSocket> {
		const opened = await HostSocket.open(entry.endpoint, {
			type: "auth",
			token: entry.token,
			surface: "unknown",
			clientId,
		});
		if (!opened.ok) throw new SessionControlError(`cannot connect to session: ${opened.error}`);
		return opened.socket;
	}

	let requestSeq = 0;
	async function request(socket: HostSocket, command: Record<string, unknown>): Promise<Frame> {
		const id = `omem-${++requestSeq}`;
		socket.send({ ...command, id });
		const response = await socket.response(id);
		if (response === null) throw new SessionControlError("session closed the connection");
		return response;
	}

	async function getState(socket: HostSocket): Promise<{ isStreaming: boolean; isSettled: boolean }> {
		const response = await request(socket, { type: "get_state" });
		const data = response.data as Record<string, unknown> | undefined;
		if (response.success !== true || !data) throw new SessionControlError(`get_state failed: ${response.error}`);
		return { isStreaming: data.isStreaming === true, isSettled: data.isSettled === true };
	}

	async function send(entry: RpcHostEntry, message: string): Promise<string> {
		const socket = await connect(entry);
		try {
			const state = await getState(socket);
			if (!state.isStreaming) {
				const response = await request(socket, { type: "prompt", message });
				if (response.success === true) return "started a turn";
				// The session became busy between get_state and prompt: queue instead.
				if (response.error !== new AgentBusyError().message)
					throw new SessionControlError(`prompt failed: ${response.error}`);
			}
			const response = await request(socket, { type: "follow_up", message });
			if (response.success !== true) throw new SessionControlError(`follow_up failed: ${response.error}`);
			return "queued as a follow-up (session is busy)";
		} finally {
			socket.close();
		}
	}

	/** True once settled, false on timeout. */
	async function waitSettled(socket: HostSocket, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
		if ((await getState(socket)).isSettled) return true;
		const deadline = Date.now() + timeoutMs;
		for (;;) {
			const remaining = deadline - Date.now();
			if (remaining <= 0 || signal?.aborted) return false;
			const { promise, resolve } = Promise.withResolvers<Frame | null | "timeout">();
			const timer = setTimeout(() => resolve("timeout"), remaining);
			const onAbort = () => resolve("timeout");
			signal?.addEventListener("abort", onAbort, { once: true });
			socket.next().then(resolve);
			const frame = await promise;
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			if (frame === "timeout") return false;
			if (frame === null) throw new SessionControlError("session closed the connection");
			if (frame.type === "session_settled") return true;
			if (frame.type === "agent_end" && (await getState(socket)).isSettled) return true;
		}
	}

	const listSchema = type({});
	const sessionsList: ToolDefinition<typeof listSchema> = {
		name: "sessions_list",
		label: "Sessions",
		description: sessionsListDescription,
		parameters: listSchema,
		approval: "read",
		async execute(_id, _params, _signal, _onUpdate, ctx) {
			const own = ctx.sessionManager.getSessionId();
			const hosts = (await listLiveRpcHosts(registry)).filter(host => host.sessionId !== own);
			if (hosts.length === 0) return text("No other live sessions.");
			const lines = await Promise.all(
				hosts.map(async host => {
					let state: string;
					try {
						const socket = await connect(host);
						try {
							const s = await getState(socket);
							state = s.isSettled ? "settled" : s.isStreaming ? "busy" : "idle";
						} finally {
							socket.close();
						}
					} catch (error) {
						state = `unknown (${errorMessage(error)})`;
					}
					return JSON.stringify({
						sessionId: host.sessionId ?? host.instanceId,
						sessionName: host.sessionName,
						cwd: host.cwd,
						kind: host.kind ?? "tui",
						pid: host.pid,
						state,
					});
				}),
			);
			return text(lines.join("\n"));
		},
	};

	const spawnSchema = type({
		cwd: type("string").describe("working directory of the new session"),
		"name?": type("string").describe("tmux window name"),
		"prompt?": type("string").describe("first message to send"),
		"tmuxSession?": type("string").describe("tmux session for the window; overrides the setting"),
	});
	const sessionSpawn: ToolDefinition<typeof spawnSchema> = {
		name: "session_spawn",
		label: "Spawn Session",
		description: sessionSpawnDescription,
		parameters: spawnSchema,
		approval: "exec",
		async execute(_id, params, signal, _onUpdate, ctx) {
			const cwd = path.resolve(ctx.cwd, params.cwd);
			if (!fs.statSync(cwd, { throwIfNoEntry: false })?.isDirectory())
				return text(`Error: ${cwd} is not a directory`);
			try {
				const tmuxSession = await resolveTmuxSession(
					params.tmuxSession,
					cfgOmemTmuxSession.get(options.settings),
					env,
					runTmux,
				);
				if (tmuxSession === undefined) {
					const host = await startHost({ cwd, prompt: params.prompt, registryDir: options.registryDir });
					const sent = params.prompt ? "; prompt sent" : "";
					return text(`Started headless session ${host.sessionId || host.instanceId} (pid ${host.pid})${sent}`);
				}
				const omp = [...(options.ompCommand ?? resolveCliEntryCmd()), "--config", rpcServeOverlay()];
				const args = ["new-window", "-d", "-P", "-F", "#{pane_pid}", "-t", escapeTmuxArgument(`${tmuxSession}:`)];
				if (params.name) args.push("-n", escapeTmuxArgument(params.name.replaceAll("#", "##")));
				args.push("-c", escapeTmuxArgument(cwd.replaceAll("#", "##")), "--", ...omp.map(escapeTmuxArgument));
				const result = await runTmux(args);
				const pid = Number.parseInt(result.stdout.trim(), 10);
				if (result.exitCode !== 0 || !Number.isInteger(pid))
					return text(`Error: tmux new-window failed: ${result.stderr.trim() || result.stdout.trim()}`);
				const deadline = Date.now() + (options.spawnTimeoutMs ?? DEFAULT_SPAWN_TIMEOUT_MS);
				let entry: RpcHostEntry | undefined;
				while (!entry) {
					entry = listRpcHosts(registry).find(host => host.pid === pid);
					if (entry) break;
					if (Date.now() >= deadline || signal?.aborted)
						return text(
							`Error: session in tmux ${tmuxSession} (pid ${pid}) did not register within ${Math.round((options.spawnTimeoutMs ?? DEFAULT_SPAWN_TIMEOUT_MS) / 1000)}s`,
						);
					await Bun.sleep(SPAWN_POLL_MS);
				}
				const sessionId = entry.sessionId ?? entry.instanceId;
				const sent = params.prompt ? `; prompt ${await send(entry, params.prompt)}` : "";
				return text(`Started session ${sessionId} in tmux ${tmuxSession} (pid ${pid})${sent}`);
			} catch (error) {
				return text(`Error: ${errorMessage(error)}`);
			}
		},
	};

	const sendSchema = type({
		sessionId: type("string").describe("id from sessions_list or session_spawn"),
		text: type("string").describe("user message"),
	});
	const sessionSend: ToolDefinition<typeof sendSchema> = {
		name: "session_send",
		label: "Send to Session",
		description: sessionSendDescription,
		parameters: sendSchema,
		approval: "exec",
		async execute(_id, params) {
			try {
				return text(`Session ${params.sessionId}: ${await send(await findSession(params.sessionId), params.text)}`);
			} catch (error) {
				return text(`Error: ${errorMessage(error)}`);
			}
		},
	};

	const readSchema = type({
		sessionId: type("string").describe("id from sessions_list or session_spawn"),
		"wait?": type("boolean").describe("wait until the session settles first"),
		"timeoutSec?": type("number").describe(`wait limit in seconds, default ${DEFAULT_READ_TIMEOUT_SEC}`),
	});
	const sessionRead: ToolDefinition<typeof readSchema> = {
		name: "session_read",
		label: "Read Session",
		description: sessionReadDescription,
		parameters: readSchema,
		approval: "read",
		async execute(_id, params, signal) {
			try {
				const socket = await connect(await findSession(params.sessionId));
				try {
					let note = "";
					if (params.wait) {
						const timeoutSec = Math.min(
							Math.max(params.timeoutSec ?? DEFAULT_READ_TIMEOUT_SEC, 0),
							MAX_READ_TIMEOUT_SEC,
						);
						if (!(await waitSettled(socket, timeoutSec * 1000, signal)))
							note = `[not settled after ${timeoutSec}s; last text so far]\n`;
					}
					const response = await request(socket, { type: "get_last_assistant_text" });
					if (response.success !== true) return text(`Error: ${response.error}`);
					const data = response.data as { text?: string | null } | undefined;
					return text(`${note}${data?.text ?? "(no assistant text yet)"}`);
				} finally {
					socket.close();
				}
			} catch (error) {
				return text(`Error: ${errorMessage(error)}`);
			}
		},
	};

	return [sessionsList, sessionSpawn, sessionSend, sessionRead] as unknown as ToolDefinition[];
}
