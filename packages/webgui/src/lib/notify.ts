/**
 * Simple notification bus for transient UI messages.
 */

export interface Notice {
	id: number;
	kind: "error" | "info";
	message: string;
}

let nextId = 1;
let notices: Notice[] = [];
const listeners = new Set<() => void>();

function emit(): void {
	for (const fn of listeners) fn();
}

export function notify(kind: Notice["kind"], message: string): void {
	notices = [...notices, { id: nextId++, kind, message }];
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
	notices = notices.filter(n => n.id !== id);
	emit();
}
