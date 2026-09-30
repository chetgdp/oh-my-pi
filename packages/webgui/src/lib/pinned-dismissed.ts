import { browserWindow } from "./dom";

const STORAGE_KEY = "webgui.pinnedDismissed";
/** Oldest sessions drop first; nothing else prunes entries for sessions that ended. */
const MAX_SESSIONS = 50;

type DismissedMap = Record<string, string[]>;

function load(): DismissedMap {
	try {
		const raw = browserWindow.localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
		const out: DismissedMap = {};
		for (const [k, v] of Object.entries(parsed)) {
			if (Array.isArray(v)) out[k] = v.filter((id): id is string => typeof id === "string");
		}
		return out;
	} catch {
		return {};
	}
}

/** Agent ids the user cleared from the pinned list of one session. */
export function loadDismissed(sessionKey: string): Set<string> {
	return new Set(load()[sessionKey] ?? []);
}

export function saveDismissed(sessionKey: string, ids: ReadonlySet<string>): void {
	const map = load();
	delete map[sessionKey];
	map[sessionKey] = [...ids];
	const keys = Object.keys(map);
	for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SESSIONS))) delete map[key];
	try {
		browserWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch {
		// Storage unavailable or full: dismissals last until reload.
	}
}
