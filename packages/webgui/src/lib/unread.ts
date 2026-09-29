import type { LiveSessionEntry } from "../server/live";
import { browserWindow } from "./dom";

const STORAGE_KEY = "webgui.seen";

type SeenMap = Record<string, number>;

function load(): SeenMap {
	try {
		const raw = browserWindow.localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
		const out: SeenMap = {};
		for (const [k, v] of Object.entries(parsed)) {
			if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
		}
		return out;
	} catch {
		return {};
	}
}

function save(map: SeenMap): void {
	try {
		browserWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch {
		// Storage unavailable or full: badges degrade to baseline-only.
	}
}

/** Record that the user has seen everything currently in the session. */
export function markSeen(sessionId: string | null, assistantCount: number | null): void {
	if (sessionId === null) return;
	if (assistantCount === null) return;
	const map = load();
	if (map[sessionId] === assistantCount) return;
	map[sessionId] = assistantCount;
	save(map);
}

/**
 * Unread assistant-message counts keyed by sessionId. First sighting sets the
 * baseline (no badge), the current session is continuously marked seen, and
 * stored entries for sessions no longer live are pruned.
 */
export function computeUnread(
	live: readonly LiveSessionEntry[],
	currentInstanceId: string | null,
): Map<string, number> {
	const map = load();
	const next: SeenMap = {};
	const result = new Map<string, number>();
	for (const entry of live) {
		const count = entry.assistantCount;
		const sessionId = entry.sessionId;
		if (sessionId === null) continue;
		const stored = map[sessionId];
		if (count === null) {
			if (stored !== undefined) next[sessionId] = stored;
			result.set(sessionId, 0);
			continue;
		}
		const seen = entry.instanceId === currentInstanceId || stored === undefined ? count : stored;
		next[sessionId] = seen;
		result.set(sessionId, Math.max(0, count - seen));
	}
	const before = Object.keys(map);
	const changed = before.length !== Object.keys(next).length || before.some(k => map[k] !== next[k]);
	if (changed) save(next);
	return result;
}

export function sortByActivity(live: readonly LiveSessionEntry[]): LiveSessionEntry[] {
	return [...live].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}
