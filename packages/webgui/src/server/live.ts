import { listRpcHosts, readRpcHost, type RpcHostEntry } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { DaemonOptions } from "./options.ts";

export type LiveSessionEntry = Omit<RpcHostEntry, "token" | "endpoint">;

function stripSecrets(entry: RpcHostEntry): LiveSessionEntry {
	const { token: _t, endpoint: _e, ...rest } = entry;
	return rest;
}

export function listLiveSessions(opts: DaemonOptions): LiveSessionEntry[] {
	return listRpcHosts({ dir: opts.registryDir }).map(stripSecrets);
}

export function resolveLiveEndpoint(
	instanceId: string,
	opts: DaemonOptions,
): { endpoint: string; token: string } | null {
	const entry = readRpcHost(instanceId, { dir: opts.registryDir });
	if (!entry) return null;
	return { endpoint: entry.endpoint, token: entry.token };
}

export async function handleLiveRequest(req: Request, url: URL, opts: DaemonOptions): Promise<Response | null> {
	if (req.method !== "GET" || url.pathname !== "/api/live") return null;
	const sessions = listLiveSessions(opts);
	return Response.json(sessions);
}
