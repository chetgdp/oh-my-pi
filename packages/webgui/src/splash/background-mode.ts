/**
 * App background (src/splash/background.ts): the mode the stored setting
 * resolves to on this device, the frame-rate guard of the live mode, and
 * the light throttle, still ordering and still refresh timer.
 * Pure logic, no DOM; unit-tested in test/splash-background.test.ts.
 */
import { type BackgroundSetting, parseBackgroundSetting } from "./background-setting";

/** What runs: the animated scene, one rendered image, or the plain theme colour. */
export type BackgroundMode = "live" | "still" | "off";

/** Narrowest window (CSS px) that gets the live scene under "auto". */
export const LIVE_MIN_WIDTH = 1024;

export interface DeviceTraits {
	/** `(pointer: fine)` matches: mouse or trackpad. */
	finePointer: boolean;
	/** Window width in CSS px. */
	width: number;
	/** `(prefers-reduced-motion: reduce)` matches. */
	reducedMotion: boolean;
}

/**
 * `?bg=` wins over everything (testing); then reduced motion turns the
 * scene off; then the stored setting; "auto" is live on a desktop-class
 * window (fine pointer, >= 1024 px) and a still image elsewhere. WebGL2
 * support is checked later: a scene that fails to load falls back to off.
 */
export function resolveBackgroundMode(
	setting: BackgroundSetting,
	urlParam: string | null,
	device: DeviceTraits,
): BackgroundMode {
	const forced = parseBackgroundSetting(urlParam);
	if (forced && forced !== "auto") return forced;
	if (device.reducedMotion) return "off";
	const s = forced ?? setting;
	if (s !== "auto") return s;
	return device.finePointer && device.width >= LIVE_MIN_WIDTH ? "live" : "still";
}

/** Live-mode quality steps, best first; the guard only moves down. */
export type GuardLevel = "full" | "half" | "fps30" | "still";
const LEVELS: readonly GuardLevel[] = ["full", "half", "fps30", "still"];

/** Window over which frame intervals are averaged before a decision (ms). */
export const GUARD_WINDOW_MS = 2000;
/** A gap this long (tab hidden, debugger, sleep) restarts the window instead of counting. */
export const GUARD_GAP_MS = 500;
/** Average interval allowed per requested interval: 1.5x, at least 25 ms (40 fps). */
const GUARD_SLACK = 1.5;
const GUARD_FLOOR_MS = 25;

/**
 * Steps the live background down when frames come late for a whole window:
 * half resolution, then 30 fps, then a still image. `sample()` takes the
 * interval between two drawn frames and the interval that was asked for
 * (0 = every display frame), so a deliberate low rate (idle, 30 fps) does
 * not count as slow.
 */
export class FrameGuard {
	#level = 0;
	#elapsed = 0;
	/** Sum of the per-frame budgets in the window, so a change of requested rate mid-window is fair. */
	#budget = 0;

	get level(): GuardLevel {
		return LEVELS[this.#level];
	}

	/** Restart the window (after a pause, a mode change or a resize). */
	reset(): void {
		this.#elapsed = 0;
		this.#budget = 0;
	}

	/** Returns the new level when this sample steps down, else null. */
	sample(intervalMs: number, requestedMs: number): GuardLevel | null {
		if (this.#level === LEVELS.length - 1) return null;
		if (intervalMs > GUARD_GAP_MS || intervalMs <= 0) {
			this.reset();
			return null;
		}
		this.#elapsed += intervalMs;
		this.#budget += Math.max(GUARD_FLOOR_MS, requestedMs * GUARD_SLACK);
		if (this.#elapsed < GUARD_WINDOW_MS) return null;
		const slow = this.#elapsed > this.#budget;
		this.reset();
		if (!slow) return null;
		this.#level++;
		return LEVELS[this.#level];
	}
}

/** Why the running mode differs from the stored choice, or null when it follows it. */
export type BackgroundOverride = "url" | "reduced-motion";

export function backgroundOverride(
	setting: BackgroundSetting,
	urlParam: string | null,
	device: DeviceTraits,
): BackgroundOverride | null {
	const forced = parseBackgroundSetting(urlParam);
	if (forced && forced !== "auto") return forced === setting ? null : "url";
	if (device.reducedMotion && setting !== "off") return "reduced-motion";
	return null;
}

/** onLight emits at most this often (ms) unless forced (World change, new image). */
export const LIGHT_INTERVAL_MS = 2000;
/** Clock drift (hours) below which a periodic light update is skipped. */
export const LIGHT_HOUR_EPS = 1 / 60;

/** Rate limit of periodic light updates: every {@link LIGHT_INTERVAL_MS} and only when the hour moved. */
export class LightThrottle {
	#at = Number.NEGATIVE_INFINITY;
	#hour = Number.NaN;

	/** True when an update at `now` for `hour` should go out; marks it sent. */
	take(now: number, hour: number, force: boolean): boolean {
		if (!force && (now - this.#at < LIGHT_INTERVAL_MS || Math.abs(hour - this.#hour) < LIGHT_HOUR_EPS)) return false;
		this.#at = now;
		this.#hour = hour;
		return true;
	}
}

/**
 * Orders still renders: each gets a number when it starts; a finished
 * render is shown only when it is newer than the one on screen, so an
 * older decode landing after a newer one is dropped.
 */
export class StillOrder {
	#next = 0;
	#shown = 0;

	begin(): number {
		return ++this.#next;
	}

	/** True when render `seq` should replace what is shown (and it now is). */
	accept(seq: number): boolean {
		if (seq <= this.#shown) return false;
		this.#shown = seq;
		return true;
	}

	/** Latest render started. */
	get latest(): number {
		return this.#next;
	}
}

export interface RefreshTimers<H> {
	now(): number;
	set(cb: () => void, ms: number): H;
	clear(handle: H): void;
}

/**
 * Periodic still refresh: while active (a still is showing and the page is
 * visible) `fire` runs {@link interval} ms after the last render; becoming
 * active again after longer than that fires at once. `rendered()` restarts
 * the period.
 */
export class StillRefresh<H> {
	#interval: number;
	#fire: () => void;
	#timers: RefreshTimers<H>;
	#handle: H | null = null;
	#active = false;
	#last: number;

	constructor(interval: number, fire: () => void, timers: RefreshTimers<H>) {
		this.#interval = interval;
		this.#fire = fire;
		this.#timers = timers;
		this.#last = timers.now();
	}

	get active(): boolean {
		return this.#active;
	}

	setActive(active: boolean): void {
		if (active === this.#active) return;
		this.#active = active;
		if (active) this.#arm();
		else this.#disarm();
	}

	/** A still was rendered (or a render ended): the period starts over. */
	rendered(): void {
		this.#last = this.#timers.now();
		if (this.#active) this.#arm();
	}

	#arm(): void {
		this.#disarm();
		const due = this.#last + this.#interval - this.#timers.now();
		if (due <= 0) {
			this.#fire();
			return;
		}
		this.#handle = this.#timers.set(() => {
			this.#handle = null;
			this.#fire();
		}, due);
	}

	#disarm(): void {
		if (this.#handle !== null) this.#timers.clear(this.#handle);
		this.#handle = null;
	}
}

/** Rethrows outside the current task, so the error reaches the console and error handlers. */
function rethrowLater(err: unknown): void {
	queueMicrotask(() => {
		throw err;
	});
}

/**
 * Calls every listener with `value`; a listener that throws does not stop
 * the others or the caller (the frame loop). Errors go to `onError`
 * (default: rethrown in a microtask).
 */
export function notifyAll<T>(
	listeners: Iterable<(value: T) => void>,
	value: T,
	onError: (err: unknown) => void = rethrowLater,
): void {
	for (const l of listeners) {
		try {
			l(value);
		} catch (err) {
			onError(err);
		}
	}
}
