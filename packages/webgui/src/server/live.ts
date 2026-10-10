import * as fs from "node:fs/promises";
import { listLiveRpcHosts, readLiveRpcHost, type RpcHostEntry } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { listSessionRecaps } from "@oh-my-pi/pi-coding-agent/session/session-index";
import type { DaemonOptions } from "./options";

/** `gui`: a headless host (`omp host start`); `cli`: an interactive TUI. */
export type SessionOrigin = "gui" | "cli";

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
 * Latest recap per session, only while no turn has run since it was written.
 * Recaps never touch the session JSONL, so a file write after the recap means
 * newer activity. Hosts that do not publish `sessionFile` get no recap.
 */
function latestRecaps(hosts: readonly RpcHostEntry[]): Map<string, { recap: string; createdAt: number }> {
	const ids = hosts.flatMap(h => (h.sessionId && h.sessionFile ? [h.sessionId] : []));
	const latest = new Map<string, { recap: string; createdAt: number }>();
	// One query for every host; rows arrive newest first, so the first per id wins.
	for (const row of listSessionRecaps({ sessionIds: ids })) {
		if (!latest.has(row.sessionId)) latest.set(row.sessionId, { recap: row.recap, createdAt: row.createdAt });
	}
	return latest;
}

function freshRecap(
	entry: RpcHostEntry,
	mtimeMs: number | null,
	recaps: Map<string, { recap: string; createdAt: number }>,
): LiveRecap | null {
	if (!entry.sessionId || !entry.sessionFile || mtimeMs === null) return null;
	const recap = recaps.get(entry.sessionId);
	if (!recap) return null;
	// `created_at` has whole-second resolution.
	if (Math.floor(mtimeMs / 1000) > recap.createdAt) return null;
	return { text: recap.recap, createdAt: recap.createdAt * 1000 };
}

async function buildLiveEntry(
	entry: RpcHostEntry,
	origin: SessionOrigin,
	recaps: Map<string, { recap: string; createdAt: number }>,
): Promise<LiveSessionEntry> {
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
	return stripSecrets(entry, origin, freshRecap(entry, mtimeMs, recaps), mtimeMs ?? entry.startedAt, assistantCount);
}

/** Polling tabs and apps share one scan per window; launch/shutdown invalidate it. */
const LIVE_CACHE_TTL_MS = 2_000;
const LIVE_PROBE_TIMEOUT_MS = 500;

interface LiveCacheEntry {
	at: number;
	generation: number;
	result: Promise<LiveSessionEntry[]>;
}

const liveCache = new WeakMap<DaemonOptions, LiveCacheEntry>();
let generation = 0;

/** Drops cached live lists; the next call rescans. */
export function invalidateLiveSessions(): void {
	generation++;
}

export function listLiveSessions(opts: DaemonOptions): Promise<LiveSessionEntry[]> {
	const now = Date.now();
	const hit = liveCache.get(opts);
	// In-flight promises are shared too, so concurrent callers dedupe onto one scan.
	if (hit && hit.generation === generation && now - hit.at < LIVE_CACHE_TTL_MS) return hit.result;
	const result = scanLiveSessions(opts);
	liveCache.set(opts, { at: now, generation, result });
	result.catch(() => {
		if (liveCache.get(opts)?.result === result) liveCache.delete(opts);
	});
	return result;
}

async function scanLiveSessions(opts: DaemonOptions): Promise<LiveSessionEntry[]> {
	const liveHosts = await listLiveRpcHosts({ dir: opts.registryDir }, LIVE_PROBE_TIMEOUT_MS);
	if (liveHosts.length === 0) {
		countCache.clear();
		return [];
	}

	const recaps = latestRecaps(liveHosts);
	const entries = await Promise.all(
		liveHosts.map(entry => buildLiveEntry(entry, entry.kind === "host" ? "gui" : "cli", recaps)),
	);
	const live = new Set(liveHosts.map(h => h.sessionFile));
	for (const key of countCache.keys()) {
		if (!live.has(key)) countCache.delete(key);
	}
	return entries.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

export async function resolveLiveEndpoint(
	instanceId: string,
	opts: DaemonOptions,
): Promise<{ endpoint: string; token: string } | null> {
	const entry = await readLiveRpcHost(instanceId, { dir: opts.registryDir });
	if (!entry) return null;
	return { endpoint: entry.endpoint, token: entry.token };
}

export async function handleLiveRequest(req: Request, url: URL, opts: DaemonOptions): Promise<Response | null> {
	if (req.method !== "GET" || url.pathname !== "/api/live") return null;
	const sessions = await listLiveSessions(opts);
	return Response.json(sessions);
}
