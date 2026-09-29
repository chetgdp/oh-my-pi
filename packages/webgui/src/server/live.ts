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
	/** Epoch ms: session file mtime, or `startedAt` when unavailable. */
	lastActivityAt: number;
	/** Assistant message entries in the session file; null when unreadable. */
	assistantCount: number | null;
};

function stripSecrets(
	entry: RpcHostEntry,
	origin: SessionOrigin,
	recap: LiveRecap | null,
	lastActivityAt: number,
	assistantCount: number | null,
): LiveSessionEntry {
	const { token: _t, endpoint: _e, sessionFile: _f, ...rest } = entry;
	return { ...rest, origin, recap, lastActivityAt, assistantCount };
}

interface CountCacheEntry {
	mtimeMs: number;
	size: number;
	/** Bytes consumed, always ending on a newline boundary. */
	offset: number;
	count: number;
}

const countCache = new Map<string, CountCacheEntry>();

function countAssistantLines(text: string): number {
	let count = 0;
	for (const line of text.split("\n")) {
		// Cheap pre-filter avoids JSON.parse on tool results and user turns.
		if (!line.includes('"assistant"')) continue;
		try {
			const parsed = JSON.parse(line) as { type?: string; message?: { role?: string } };
			if (parsed.type === "message" && parsed.message?.role === "assistant") count++;
		} catch {
			// Malformed line: not a countable entry.
		}
	}
	return count;
}

/**
 * Counts assistant message entries, rescanning only bytes appended since the
 * last call. A shrunken file forces a full rescan; unchanged (mtime, size)
 * never touches the disk.
 */
async function countAssistantMessages(file: string, mtimeMs: number, size: number): Promise<number | null> {
	const cached = countCache.get(file);
	if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return cached.count;
	const base = cached && size >= cached.offset ? cached : { offset: 0, count: 0 };
	try {
		const bytes = await Bun.file(file).slice(base.offset, size).bytes();
		// Only whole lines are consumed; a partially written tail is re-read next time.
		const end = bytes.lastIndexOf(0x0a) + 1;
		const count = base.count + countAssistantLines(new TextDecoder().decode(bytes.subarray(0, end)));
		countCache.set(file, { mtimeMs, size, offset: base.offset + end, count });
		return count;
	} catch {
		countCache.delete(file);
		return null;
	}
}

/**
 * The latest recap, only while no turn has run since it was written. Recaps
 * never touch the session JSONL, so a file write after the recap means newer
 * activity. Hosts that do not publish `sessionFile` get no recap.
 */
function freshRecap(entry: RpcHostEntry, mtimeMs: number | null): LiveRecap | null {
	if (!entry.sessionId || !entry.sessionFile || mtimeMs === null) return null;
	const recap = listSessionRecaps({ sessionIds: [entry.sessionId], limit: 1 })[0];
	if (!recap) return null;
	// `created_at` has whole-second resolution.
	if (Math.floor(mtimeMs / 1000) > recap.createdAt) return null;
	return { text: recap.recap, createdAt: recap.createdAt * 1000 };
}

async function buildLiveEntry(entry: RpcHostEntry, origin: SessionOrigin): Promise<LiveSessionEntry> {
	let mtimeMs: number | null = null;
	let size = 0;
	if (entry.sessionFile) {
		try {
			const st = await fs.stat(entry.sessionFile);
			mtimeMs = st.mtimeMs;
			size = st.size;
		} catch {
			// Fall through to startedAt / null count.
		}
	}
	const assistantCount =
		entry.sessionFile && mtimeMs !== null ? await countAssistantMessages(entry.sessionFile, mtimeMs, size) : null;
	return stripSecrets(entry, origin, freshRecap(entry, mtimeMs), mtimeMs ?? entry.startedAt, assistantCount);
}

export async function listLiveSessions(opts: DaemonOptions): Promise<LiveSessionEntry[]> {
	const hosts = listRpcHosts({ dir: opts.registryDir });
	if (hosts.length === 0) {
		countCache.clear();
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

	const entries = await Promise.all(
		hosts.map(entry => buildLiveEntry(entry, resolveSessionOrigin(entry.pid, panes, parentMap))),
	);
	const live = new Set(hosts.map(h => h.sessionFile));
	for (const key of countCache.keys()) {
		if (!live.has(key)) countCache.delete(key);
	}
	return entries.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
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
