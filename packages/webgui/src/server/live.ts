import * as fs from "node:fs/promises";
import { listRpcHosts, readRpcHost, type RpcHostEntry } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { listSessionRecaps } from "@oh-my-pi/pi-coding-agent/session/session-index";
import type { DaemonOptions } from "./options";
import { getTmuxPanes, readProcessTree, resolveSessionOrigin, type SessionOrigin, type TmuxPaneInfo } from "./tmux";

export type { SessionOrigin };

export interface LiveRecap {
	text: string;
	/** Epoch milliseconds. */
	createdAt: number;
}

export type LiveSessionEntry = Omit<RpcHostEntry, "token" | "endpoint" | "sessionFile"> & {
	origin: SessionOrigin;
	recap: LiveRecap | null;
};

function stripSecrets(entry: RpcHostEntry, origin: SessionOrigin, recap: LiveRecap | null): LiveSessionEntry {
	const { token: _t, endpoint: _e, sessionFile: _f, ...rest } = entry;
	return { ...rest, origin, recap };
}

/**
 * The latest recap, only while no turn has run since it was written. Recaps
 * never touch the session JSONL, so a file write after the recap means newer
 * activity. Hosts that do not publish `sessionFile` get no recap.
 */
async function freshRecap(entry: RpcHostEntry): Promise<LiveRecap | null> {
	if (!entry.sessionId || !entry.sessionFile) return null;
	const recap = listSessionRecaps({ sessionIds: [entry.sessionId], limit: 1 })[0];
	if (!recap) return null;
	let mtimeMs: number;
	try {
		mtimeMs = (await fs.stat(entry.sessionFile)).mtimeMs;
	} catch {
		return null;
	}
	// `created_at` has whole-second resolution.
	if (Math.floor(mtimeMs / 1000) > recap.createdAt) return null;
	return { text: recap.recap, createdAt: recap.createdAt * 1000 };
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

	return Promise.all(
		hosts.map(async entry => {
			const origin = resolveSessionOrigin(entry.pid, panes, parentMap);
			return stripSecrets(entry, origin, await freshRecap(entry));
		}),
	);
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
