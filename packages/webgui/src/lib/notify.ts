/**
 * Notification bus for transient UI messages, shown in the alert strip.
 * The store owns expiry: `info` clears after INFO_TTL_MS; `error` stays until dismissed.
 */

export interface Notice {
	id: number;
	kind: "error" | "info";
	message: string;
}

export const INFO_TTL_MS = 4000;
const MAX_NOTICES = 3;

let nextId = 1;
let notices: Notice[] = [];
const timers = new Map<number, Timer>();
const listeners = new Set<() => void>();

function emit(): void {
	for (const fn of listeners) fn();
}

function clearTimer(id: number): void {
	const timer = timers.get(id);
	if (timer === undefined) return;
	clearTimeout(timer);
	timers.delete(id);
}

export function notify(kind: Notice["kind"], message: string): void {
	if (notices.some(n => n.kind === kind && n.message === message)) return;
	if (notices.length >= MAX_NOTICES) {
		const dropped = notices.slice(0, notices.length - (MAX_NOTICES - 1));
		for (const n of dropped) clearTimer(n.id);
		notices = notices.slice(notices.length - (MAX_NOTICES - 1));
	}
	const id = nextId++;
	notices = [...notices, { id, kind, message }];
	if (kind === "info")
		timers.set(
			id,
			setTimeout(() => dismissNotice(id), INFO_TTL_MS),
		);
	emit();
}

export function subscribeNotices(fn: () => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

export function getNotices(): readonly Notice[] {
	return notices;
}

export function dismissNotice(id: number): void {
	clearTimer(id);
	if (!notices.some(n => n.id === id)) return;
	notices = notices.filter(n => n.id !== id);
	emit();
}

/** Drops every notice and timer; for tests. */
export function resetNotices(): void {
	for (const id of timers.keys()) clearTimer(id);
	notices = [];
	emit();
}
