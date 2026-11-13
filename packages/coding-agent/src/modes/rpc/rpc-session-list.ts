/**
 * Live session listing and stop, shared by `omp host list|stop` and the omem
 * `sessions_list` / `session_stop` tools. Registry tokens authenticate the
 * connection and never reach the returned rows or messages.
 */
import { HostSocket } from "./rpc-client-socket";
import { listLiveRpcHosts, listRpcHosts, type RpcHostEntry, type RpcRegistryOptions } from "./rpc-registry";

const STOP_POLL_MS = 100;

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM: the pid exists but belongs to another user.
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

export interface LiveSessionRow {
	sessionId: string;
	sessionName: string | null | undefined;
	cwd: string;
	kind: string;
	pid: number;
	/** `settled`, `busy`, `idle`, or `unknown (<reason>)` when the probe failed. */
	state: string;
}

async function probeState(entry: RpcHostEntry, clientId: string): Promise<string> {
	try {
		const opened = await HostSocket.open(entry.endpoint, {
			type: "auth",
			token: entry.token,
			surface: "unknown",
			clientId,
		});
		if (!opened.ok) return `unknown (cannot connect to session: ${opened.error})`;
		const socket = opened.socket;
		try {
			socket.send({ type: "get_state", id: "state" });
			const response = await socket.response("state");
			if (response === null) return "unknown (session closed the connection)";
			const data = response.data as Record<string, unknown> | undefined;
			if (response.success !== true || !data) return `unknown (get_state failed: ${response.error})`;
			return data.isSettled === true ? "settled" : data.isStreaming === true ? "busy" : "idle";
		} finally {
			socket.close();
		}
	} catch (error) {
		return `unknown (${error instanceof Error ? error.message : String(error)})`;
	}
}

/** A live session's registry entry (holds the token; never print it) and its printable row. */
export interface LiveSession {
	entry: RpcHostEntry;
	row: LiveSessionRow;
}

/** Live registry entries with their turn state; `excludeSessionId` drops the caller's own session. */
export async function listLiveSessions(
	registry: RpcRegistryOptions,
	clientId: string,
	excludeSessionId?: string,
): Promise<LiveSession[]> {
	const hosts = (await listLiveRpcHosts(registry)).filter(
		host => excludeSessionId === undefined || host.sessionId !== excludeSessionId,
	);
	return Promise.all(
		hosts.map(async host => ({
			entry: host,
			row: {
				sessionId: host.sessionId ?? host.instanceId,
				sessionName: host.sessionName,
				cwd: host.cwd,
				kind: host.kind ?? "tui",
				pid: host.pid,
				state: await probeState(host, clientId),
			},
		})),
	);
}

export type SessionMatch = { ok: true; entry: RpcHostEntry } | { ok: false; error: string };

/**
 * Resolves a session id (or a unique prefix of one) among live entries. An
 * exact match wins over prefixes; none or several is an error naming the
 * candidates one per line (session id, kind, name, cwd; never tokens or endpoints).
 */
export function resolveLiveSession(entries: readonly RpcHostEntry[], query: string): SessionMatch {
	const exact = entries.filter(entry => entry.sessionId === query);
	const matches = exact.length > 0 ? exact : entries.filter(entry => entry.sessionId?.startsWith(query));
	if (matches.length === 1) return { ok: true, entry: matches[0]! };
	if (matches.length === 0) {
		const listed = entries.length > 0 ? `; live sessions:\n${candidates(entries)}` : "; no live sessions";
		return { ok: false, error: `no live session id starts with "${query}"${listed}` };
	}
	return { ok: false, error: `session id "${query}" is ambiguous:\n${candidates(matches)}` };
}

function candidates(entries: readonly RpcHostEntry[]): string {
	return entries
		.map(entry => {
			const name = entry.sessionName ? `  ${entry.sessionName}` : "";
			return `  ${entry.sessionId ?? "?"}  [${entry.kind ?? "tui"}]${name}  ${entry.cwd}`;
		})
		.join("\n");
}

/**
 * Abort the session's turn, then ask the process to shut down (a host exits, a
 * TUI closes). Done when its registry entry is gone; false if it is still
 * published after `timeoutMs`. Throws when the connection or abort fails.
 */
export async function stopRpcSession(
	registry: RpcRegistryOptions,
	entry: RpcHostEntry,
	clientId: string,
	timeoutMs: number,
): Promise<boolean> {
	const opened = await HostSocket.open(entry.endpoint, {
		type: "auth",
		token: entry.token,
		surface: "unknown",
		clientId,
	});
	if (!opened.ok) throw new Error(`cannot connect to session: ${opened.error}`);
	const socket = opened.socket;
	try {
		socket.send({ type: "abort", id: "abort" });
		const aborted = await socket.response("abort");
		if (aborted === null) throw new Error("session closed the connection");
		if (aborted.success !== true) throw new Error(`abort failed: ${aborted.error}`);
		socket.send({ type: "shutdown", id: "shutdown" });
		// A process that exits at once may close the socket before its reply arrives.
		const shutdown = await socket.response("shutdown");
		if (shutdown !== null && shutdown.success !== true) throw new Error(`shutdown failed: ${shutdown.error}`);
	} finally {
		socket.close();
	}
	// A crashed process can leave its registry file behind; an exited pid also counts as stopped.
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (!processExists(entry.pid)) return true;
		if (!listRpcHosts(registry).some(host => host.instanceId === entry.instanceId)) return true;
		if (Date.now() >= deadline) return false;
		await Bun.sleep(STOP_POLL_MS);
	}
}
