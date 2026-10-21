/** One shared 1 Hz tick for every running-job elapsed label; the interval runs only while a label is mounted. */
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let now = Date.now();
let timer: Timer | undefined;

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	if (timer === undefined) {
		now = Date.now();
		timer = setInterval(() => {
			now = Date.now();
			for (const l of listeners) l();
		}, 1000);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && timer !== undefined) {
			clearInterval(timer);
			timer = undefined;
		}
	};
}

export function useJobClock(): number {
	return useSyncExternalStore(
		subscribe,
		() => now,
		() => now,
	);
}

/** `2m 14s`, `1h 03m`, `9s`. */
export function formatJobDuration(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
