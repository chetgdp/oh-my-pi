import { listRpcHosts, readRpcHost, type RpcHostEntry } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { DaemonOptions } from "./options";
import { getTmuxPanes, readProcessTree, resolveSessionOrigin, type SessionOrigin, type TmuxPaneInfo } from "./tmux";

export type { SessionOrigin };

export type LiveSessionEntry = Omit<RpcHostEntry, "token" | "endpoint"> & {
	origin: SessionOrigin;
};

function stripSecrets(entry: RpcHostEntry, origin: SessionOrigin = "unknown"): LiveSessionEntry {
	const { token: _t, endpoint: _e, ...rest } = entry;
	return { ...rest, origin };
}

export async function listLiveSessions(opts: DaemonOptions): Promise<LiveSessionEntry[]> {
	const hosts = listRpcHosts({ dir: opts.registryDir });
	if (hosts.length === 0) {
		return [];
	}

	let panes: TmuxPaneInfo[] | null = null;
	let parentMap: Map<number, number> | undefined;

	if (opts.tmux) {
		panes = await getTmuxPanes(opts.tmux);
		if (panes && panes.length > 0) {
			const readTree = opts.processTreeReader ?? readProcessTree;
			parentMap = await readTree();
		}
	}

	return hosts.map(entry => {
		const origin = resolveSessionOrigin(entry.pid, panes, parentMap);
		return stripSecrets(entry, origin);
	});
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
	const sessions = await listLiveSessions(opts);
	return Response.json(sessions);
}
