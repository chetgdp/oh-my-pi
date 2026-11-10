/**
 * Stored Flat-mode appearance: System (follow prefers-color-scheme), Light or Dark.
 * Applied as `data-theme` on <html>; index.html sets it before paint from the same key.
 * Clear remaps tokens itself, so the attribute is only written while the interface is Flat.
 */
import { browserWindow } from "./dom";
import { readUiSetting, subscribeUiSetting } from "./ui-setting";

export type ThemeSetting = "system" | "light" | "dark";

export const THEME_SETTINGS: readonly ThemeSetting[] = ["system", "light", "dark"];
/** localStorage key; absent or invalid means "system". Read by the inline script in index.html. */
export const THEME_KEY = "webgui.theme";

export function parseThemeSetting(v: string | null | undefined): ThemeSetting {
	return v === "light" || v === "dark" ? v : "system";
}

export function readThemeSetting(): ThemeSetting {
	try {
		return parseThemeSetting(browserWindow.localStorage.getItem(THEME_KEY));
	} catch {
		return "system";
	}
}

const listeners = new Set<() => void>();

export function writeThemeSetting(s: ThemeSetting): void {
	try {
		if (s === "system") browserWindow.localStorage.removeItem(THEME_KEY);
		else browserWindow.localStorage.setItem(THEME_KEY, s);
	} catch {
		// Storage unavailable: the choice lasts until reload.
	}
	applyThemeSetting();
	for (const l of listeners) l();
}

/** Changes from this page and from other tabs (storage event). */
export function subscribeThemeSetting(cb: () => void): () => void {
	const onStorage = (e: unknown) => {
		const key = e && typeof e === "object" && "key" in e ? e.key : undefined;
		if (key === THEME_KEY || key === null) cb();
	};
	listeners.add(cb);
	browserWindow.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(cb);
		browserWindow.removeEventListener("storage", onStorage);
	};
}

export function applyThemeSetting(): void {
	const root = browserWindow.document.documentElement;
	const theme = readUiSetting() === "flat" ? readThemeSetting() : "system";
	if (theme === "system") delete root.dataset.theme;
	else root.dataset.theme = theme;
}

/** Keeps `data-theme` current across theme and interface changes, including other tabs. */
export function startThemeSync(): void {
	applyThemeSetting();
	subscribeThemeSetting(applyThemeSetting);
	subscribeUiSetting(applyThemeSetting);
}
