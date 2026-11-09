/**
 * Stored interface design: Flat (the original opaque React UI) or Clear (cheisms/clear-design.md).
 * Kept in the entry, apart from world-light.ts (lazy chunk), so main.tsx and the Settings screen
 * can read it without loading the clear stylesheets.
 */
import { browserWindow } from "./dom";

export type UiSetting = "flat" | "clear";

export const UI_SETTINGS: readonly UiSetting[] = ["flat", "clear"];
/** localStorage key; absent means "flat". */
export const UI_KEY = "webgui.ui";

export function parseUiSetting(v: string | null | undefined): UiSetting {
	return v === "clear" ? "clear" : "flat";
}

export function readUiSetting(): UiSetting {
	try {
		return parseUiSetting(browserWindow.localStorage.getItem(UI_KEY));
	} catch {
		return "flat";
	}
}

const listeners = new Set<() => void>();

export function writeUiSetting(s: UiSetting): void {
	try {
		if (s === "flat") browserWindow.localStorage.removeItem(UI_KEY);
		else browserWindow.localStorage.setItem(UI_KEY, s);
	} catch {
		// Storage unavailable: the choice lasts until reload.
	}
	for (const l of listeners) l();
}

/** Changes from this page and from other tabs (storage event). */
export function subscribeUiSetting(cb: () => void): () => void {
	const onStorage = (e: unknown) => {
		const key = e && typeof e === "object" && "key" in e ? e.key : undefined;
		if (key === UI_KEY || key === null) cb();
	};
	listeners.add(cb);
	browserWindow.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(cb);
		browserWindow.removeEventListener("storage", onStorage);
	};
}
