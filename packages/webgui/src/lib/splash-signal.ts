import { useEffect } from "react";

/** One-shot "app has something to show" signal that ends the cold-start splash. */

let ready = false;
const listeners = new Set<() => void>();

export function signalAppReady(): void {
	if (ready) return;
	ready = true;
	const pending = [...listeners];
	listeners.clear();
	for (const cb of pending) cb();
}

/** Fires immediately when already signalled; returns an unsubscribe. */
export function onAppReady(cb: () => void): () => void {
	if (ready) {
		cb();
		return () => {};
	}
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}

/** Signals once `ready` turns true (e.g. a deep-linked session reaching connection === "ready"). */
export function useSignalAppReadyWhen(ready: boolean): void {
	useEffect(() => {
		if (ready) signalAppReady();
	}, [ready]);
}

/** Test-only reset of the module state. */
export function resetAppReadyForTest(): void {
	ready = false;
	listeners.clear();
}
