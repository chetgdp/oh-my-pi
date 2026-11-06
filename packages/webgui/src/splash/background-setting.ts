/**
 * Stored app background setting. Kept apart from the background itself
 * (background.ts, a lazy chunk) so the Settings screen can show and
 * store it without pulling that chunk into the entry.
 */
import { browserWindow } from "../lib/dom";

/** Stored choice. Auto picks per device (see resolveBackgroundMode in background-mode.ts). */
export type BackgroundSetting = "auto" | "live" | "still" | "off";

export const BACKGROUND_SETTINGS: readonly BackgroundSetting[] = ["auto", "live", "still", "off"];
/** localStorage key; absent means "auto". */
export const BACKGROUND_KEY = "webgui.background";

export function parseBackgroundSetting(v: string | null | undefined): BackgroundSetting | null {
	return v === "auto" || v === "live" || v === "still" || v === "off" ? v : null;
}

export function readBackgroundSetting(): BackgroundSetting {
	try {
		return parseBackgroundSetting(browserWindow.localStorage.getItem(BACKGROUND_KEY)) ?? "auto";
	} catch {
		return "auto";
	}
}

const listeners = new Set<() => void>();

export function writeBackgroundSetting(s: BackgroundSetting): void {
	try {
		if (s === "auto") browserWindow.localStorage.removeItem(BACKGROUND_KEY);
		else browserWindow.localStorage.setItem(BACKGROUND_KEY, s);
	} catch {
		// Storage unavailable: the choice lasts until reload.
	}
	for (const l of listeners) l();
}

/** Changes from this page and from other tabs (storage event). */
export function subscribeBackgroundSetting(cb: () => void): () => void {
	const onStorage = (e: unknown) => {
		const key = e && typeof e === "object" && "key" in e ? e.key : undefined;
		if (key === BACKGROUND_KEY || key === null) cb();
	};
	listeners.add(cb);
	browserWindow.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(cb);
		browserWindow.removeEventListener("storage", onStorage);
	};
}
