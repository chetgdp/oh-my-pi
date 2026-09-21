import type { PastSessionSummary } from "../server/past";

export interface SessionGroup {
	label: string;
	/** Project cwd, or null for ungrouped. */
	cwd: string | null;
	sessions: PastSessionSummary[];
}

export interface DayGroup {
	dayLabel: string;
	projects: SessionGroup[];
}

/**
 * Display name for a session: name, else first user message truncated to
 * 60 chars, else a short id (last 8 chars).
 */
export function displayName(entry: PastSessionSummary): string {
	if (entry.name) return entry.name;
	if (entry.firstUserMessage) {
		const msg = entry.firstUserMessage;
		if (msg.length <= 60) return msg;
		return msg.slice(0, 57) + "...";
	}
	return entry.id.length > 8 ? entry.id.slice(-8) : entry.id;
}

/**
 * Shorten a cwd for display: replace home prefix with ~, show last
 * two path segments.
 */
export function shortCwd(cwd: string): string {
	let display = cwd;
	if (display.startsWith("/Users/")) {
		const parts = display.split("/");
		if (parts.length >= 3) {
			display = "~/" + parts.slice(3).join("/");
		}
	} else if (display.startsWith("/home/")) {
		const parts = display.split("/");
		if (parts.length >= 3) {
			display = "~/" + parts.slice(3).join("/");
		}
	}
	const segments = display.split("/").filter(Boolean);
	if (segments.length <= 2) return display;
	return segments.slice(-2).join("/");
}

function dayLabel(ts: number, now: number): string {
	const d = new Date(ts);
	const n = new Date(now);
	const dYear = d.getFullYear();
	const dMonth = d.getMonth();
	const dDay = d.getDate();
	const nYear = n.getFullYear();
	const nMonth = n.getMonth();
	const nDay = n.getDate();
	if (dYear === nYear && dMonth === nMonth && dDay === nDay) return "Today";
	const yesterday = new Date(nYear, nMonth, nDay - 1);
	if (dYear === yesterday.getFullYear() && dMonth === yesterday.getMonth() && dDay === yesterday.getDate()) {
		return "Yesterday";
	}
	const mm = String(dMonth + 1).padStart(2, "0");
	const dd = String(dDay).padStart(2, "0");
	return `${dYear}-${mm}-${dd}`;
}

/**
 * Group past sessions by day then by project cwd. Newest-first throughout.
 *
 * @param now - Override for testability; defaults to Date.now().
 */
export function groupPast(entries: readonly PastSessionSummary[], now?: number): DayGroup[] {
	const effectiveNow = now ?? Date.now();
	const sorted = [...entries].sort((a, b) => b.modifiedAt - a.modifiedAt);

	const dayMap = new Map<string, PastSessionSummary[]>();
	const dayOrder: string[] = [];
	for (const s of sorted) {
		const label = dayLabel(s.modifiedAt, effectiveNow);
		let bucket = dayMap.get(label);
		if (!bucket) {
			bucket = [];
			dayMap.set(label, bucket);
			dayOrder.push(label);
		}
		bucket.push(s);
	}

	const result: DayGroup[] = [];
	for (const dl of dayOrder) {
		const sessions = dayMap.get(dl)!;
		const cwdMap = new Map<string, PastSessionSummary[]>();
		const cwdOrder: string[] = [];
		for (const s of sessions) {
			const key = s.cwd || "";
			let bucket = cwdMap.get(key);
			if (!bucket) {
				bucket = [];
				cwdMap.set(key, bucket);
				cwdOrder.push(key);
			}
			bucket.push(s);
		}
		const projects: SessionGroup[] = cwdOrder.map(cwd => ({
			label: cwd ? shortCwd(cwd) : "Unknown",
			cwd: cwd || null,
			sessions: cwdMap.get(cwd)!,
		}));
		result.push({ dayLabel: dl, projects });
	}

	return result;
}
