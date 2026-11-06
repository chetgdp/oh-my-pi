/**
 * Stored "World" setting: the hour the gate scene shows. Auto follows the
 * local clock; fixed pins an hour (0..24). The UI follows the scene, so this
 * is the theme control. `?hour=<0-24>` in the URL overrides the stored value
 * (fixed at that hour) until the user picks a value in Settings.
 */
import { localHour } from "../splash/sky";
import { browserWindow } from "./dom";

export type WorldSetting = { mode: "auto" } | { mode: "fixed"; hour: number };

/** localStorage key; absent means auto, else the fixed hour as a decimal string. */
export const WORLD_KEY = "webgui.world";
const HOUR_PARAM = "hour";

const AUTO: WorldSetting = { mode: "auto" };

/** Hour in 0..24 from a decimal string, or null. */
export function parseHour(v: string | null | undefined): number | null {
	if (v === null || v === undefined || v.trim() === "") return null;
	const h = Number(v);
	return Number.isFinite(h) && h >= 0 && h <= 24 ? h : null;
}

/** Stored value to a setting; anything unreadable is auto. */
export function parseWorldSetting(stored: string | null | undefined): WorldSetting {
	const h = parseHour(stored);
	return h === null ? AUTO : { mode: "fixed", hour: h };
}

/** The URL `?hour=` override wins over the stored value. */
export function resolveWorldSetting(stored: string | null | undefined, search: string): WorldSetting {
	const h = parseHour(new URLSearchParams(search).get(HOUR_PARAM));
	return h === null ? parseWorldSetting(stored) : { mode: "fixed", hour: h };
}

/** Scene hour for a setting: the local clock for auto. */
export function worldHour(s: WorldSetting): number {
	return s.mode === "auto" ? localHour() : s.hour;
}

/** "12:30" for 12.5; 24 shows as "24:00". */
export function formatWorldHour(h: number): string {
	const m = Math.round(h * 60);
	return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function stored(): string | null {
	try {
		return browserWindow.localStorage.getItem(WORLD_KEY);
	} catch {
		return null;
	}
}

export function readWorldSetting(): WorldSetting {
	return resolveWorldSetting(stored(), browserWindow.location.search);
}

const listeners = new Set<() => void>();

function notify(): void {
	for (const l of listeners) l();
}

export function writeWorldSetting(s: WorldSetting): void {
	try {
		if (s.mode === "auto") browserWindow.localStorage.removeItem(WORLD_KEY);
		else browserWindow.localStorage.setItem(WORLD_KEY, String(s.hour));
	} catch {
		// Storage unavailable: the URL override below still carries the choice for this page.
	}
	// An explicit choice replaces the URL override, else the override would keep winning.
	const loc = browserWindow.location;
	const params = new URLSearchParams(loc.search);
	if (params.has(HOUR_PARAM)) {
		params.delete(HOUR_PARAM);
		const q = params.toString();
		browserWindow.history.replaceState(
			browserWindow.history.state,
			"",
			`${loc.pathname}${q ? `?${q}` : ""}${loc.hash}`,
		);
	}
	notify();
}

/** Changes from this page and from other tabs (storage event). */
export function subscribeWorldSetting(cb: () => void): () => void {
	const onStorage = (e: unknown) => {
		const key = e && typeof e === "object" && "key" in e ? e.key : undefined;
		if (key === WORLD_KEY || key === null) cb();
	};
	listeners.add(cb);
	browserWindow.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(cb);
		browserWindow.removeEventListener("storage", onStorage);
	};
}
