import {
	listRpcHosts,
	probeRpcHost,
	type RpcHostEntry,
	readRpcHost,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { HostRow } from "./tty-ui";

export type { RpcHostEntry };

/** Entry kind; registry entries written before `kind` existed are TUIs. */
export function hostKind(entry: RpcHostEntry): "tui" | "host" {
	return entry.kind ?? "tui";
}

/** Live sessions whose pid and socket both answer: headless hosts and TUIs serving RPC. */
export async function listLiveHosts(dir?: string): Promise<RpcHostEntry[]> {
	const hosts = listRpcHosts(dir === undefined ? undefined : { dir });
	const alive = await Promise.all(hosts.map(entry => probeRpcHost(entry)));
	return hosts.filter((_, index) => alive[index]);
}

/** The attached session if its entry exists and it still answers. */
export async function readLiveHost(instanceId: string, dir?: string): Promise<RpcHostEntry | null> {
	const entry = readRpcHost(instanceId, dir === undefined ? undefined : { dir });
	if (!entry) return null;
	return (await probeRpcHost(entry)) ? entry : null;
}

export type SessionMatch = { ok: true; entry: RpcHostEntry } | { ok: false; error: string };

/**
 * Resolves a session id (or a unique prefix of one) among live entries. An
 * exact match wins over prefixes; none or several is an error naming the
 * candidates (session id, kind, name, cwd; never tokens or endpoints).
 */
export function resolveSessionId(entries: readonly RpcHostEntry[], query: string): SessionMatch {
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
			return `  ${entry.sessionId ?? "?"}  [${hostKind(entry)}]${name}  ${entry.cwd}`;
		})
		.join("\n");
}

export function hostRow(entry: RpcHostEntry): HostRow {
	return {
		instanceId: entry.instanceId,
		sessionId: entry.sessionId ?? "",
		...(entry.sessionName ? { sessionName: entry.sessionName } : {}),
		cwd: entry.cwd,
		...(entry.model ? { model: entry.model } : {}),
		startedAt: entry.startedAt,
		kind: hostKind(entry),
	};
}
