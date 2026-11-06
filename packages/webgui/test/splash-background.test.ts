import { describe, expect, it } from "bun:test";
import {
	backgroundOverride,
	FrameGuard,
	GUARD_GAP_MS,
	GUARD_WINDOW_MS,
	LIGHT_HOUR_EPS,
	LIGHT_INTERVAL_MS,
	LightThrottle,
	LIVE_MIN_WIDTH,
	notifyAll,
	resolveBackgroundMode,
	StillOrder,
	StillRefresh,
} from "../src/splash/background-mode";
import { parseBackgroundSetting } from "../src/splash/background-setting";

const desktop = { finePointer: true, width: 1440, reducedMotion: false };
const phone = { finePointer: false, width: 390, reducedMotion: false };

describe("resolveBackgroundMode", () => {
	it("auto is live on a desktop-class window and still elsewhere", () => {
		expect(resolveBackgroundMode("auto", null, desktop)).toBe("live");
		expect(resolveBackgroundMode("auto", null, phone)).toBe("still");
		expect(resolveBackgroundMode("auto", null, { ...desktop, width: LIVE_MIN_WIDTH - 1 })).toBe("still");
		expect(resolveBackgroundMode("auto", null, { ...desktop, width: LIVE_MIN_WIDTH })).toBe("live");
		// touch laptop or tablet with a wide window: coarse pointer stays still
		expect(resolveBackgroundMode("auto", null, { ...phone, width: 1440 })).toBe("still");
	});

	it("an explicit setting wins over the device", () => {
		expect(resolveBackgroundMode("live", null, phone)).toBe("live");
		expect(resolveBackgroundMode("still", null, desktop)).toBe("still");
		expect(resolveBackgroundMode("off", null, desktop)).toBe("off");
	});

	it("reduced motion turns it off unless the URL forces a mode", () => {
		const rm = { ...desktop, reducedMotion: true };
		expect(resolveBackgroundMode("auto", null, rm)).toBe("off");
		expect(resolveBackgroundMode("live", null, rm)).toBe("off");
		expect(resolveBackgroundMode("auto", "still", rm)).toBe("still");
		expect(resolveBackgroundMode("auto", "auto", rm)).toBe("off");
	});

	it("?bg= overrides the setting; unknown values are ignored", () => {
		expect(resolveBackgroundMode("off", "live", phone)).toBe("live");
		expect(resolveBackgroundMode("live", "off", desktop)).toBe("off");
		expect(resolveBackgroundMode("off", "auto", desktop)).toBe("live");
		expect(resolveBackgroundMode("still", "bogus", desktop)).toBe("still");
	});

	it("parses stored settings strictly", () => {
		expect(parseBackgroundSetting("live")).toBe("live");
		expect(parseBackgroundSetting("LIVE")).toBeNull();
		expect(parseBackgroundSetting(null)).toBeNull();
	});
});

/** Feed `ms` worth of frames at `interval`; returns every step reported. */
function run(g: FrameGuard, interval: number, ms: number, requested = 0): string[] {
	const steps: string[] = [];
	for (let t = 0; t < ms; t += interval) {
		const s = g.sample(interval, requested);
		if (s) steps.push(s);
	}
	return steps;
}

describe("FrameGuard", () => {
	it("stays at full at 60 and 120 fps", () => {
		const g = new FrameGuard();
		expect(run(g, 1000 / 60, 10_000)).toEqual([]);
		expect(run(g, 1000 / 120, 10_000)).toEqual([]);
		expect(g.level).toBe("full");
	});

	it("steps half, fps30, still: one step per slow window, then stops", () => {
		const g = new FrameGuard();
		expect(run(g, 40, GUARD_WINDOW_MS)).toEqual(["half"]);
		expect(run(g, 40, GUARD_WINDOW_MS)).toEqual(["fps30"]);
		// at the requested 30 fps the budget is 50 ms: 40 ms frames are fine now
		expect(run(g, 40, GUARD_WINDOW_MS * 3, 1000 / 30)).toEqual([]);
		expect(run(g, 70, GUARD_WINDOW_MS, 1000 / 30)).toEqual(["still"]);
		expect(g.level).toBe("still");
		expect(run(g, 200, GUARD_WINDOW_MS * 3, 1000 / 30)).toEqual([]);
	});

	it("needs a whole slow window: a short hitch does not step", () => {
		const g = new FrameGuard();
		expect(run(g, 16.7, 1500)).toEqual([]);
		expect(run(g, 60, 300)).toEqual([]);
		expect(run(g, 16.7, 1500)).toEqual([]);
		expect(g.level).toBe("full");
	});

	it("a deliberate low rate (idle) is not slow", () => {
		const g = new FrameGuard();
		expect(run(g, 100, GUARD_WINDOW_MS * 5, 100)).toEqual([]);
		expect(g.level).toBe("full");
	});

	it("a gap (hidden tab, sleep) restarts the window", () => {
		const g = new FrameGuard();
		run(g, 40, GUARD_WINDOW_MS - 100);
		expect(g.sample(GUARD_GAP_MS + 1, 0)).toBeNull();
		expect(run(g, 16.7, GUARD_WINDOW_MS)).toEqual([]);
		expect(g.level).toBe("full");
	});

	it("reset() drops the partial window", () => {
		const g = new FrameGuard();
		run(g, 40, GUARD_WINDOW_MS - 100);
		g.reset();
		expect(run(g, 16.7, GUARD_WINDOW_MS)).toEqual([]);
	});
});

describe("backgroundOverride", () => {
	it("names the URL or reduced motion when they change the stored choice", () => {
		expect(backgroundOverride("auto", null, desktop)).toBeNull();
		expect(backgroundOverride("live", "still", desktop)).toBe("url");
		expect(backgroundOverride("still", "still", desktop)).toBeNull();
		expect(backgroundOverride("live", "auto", { ...desktop, reducedMotion: true })).toBe("reduced-motion");
		expect(backgroundOverride("off", null, { ...desktop, reducedMotion: true })).toBeNull();
	});
});

describe("LightThrottle", () => {
	it("passes every LIGHT_INTERVAL_MS only when the hour moved by LIGHT_HOUR_EPS", () => {
		const t = new LightThrottle();
		expect(t.take(0, 10, false)).toBe(true);
		expect(t.take(LIGHT_INTERVAL_MS - 1, 11, false)).toBe(false);
		expect(t.take(LIGHT_INTERVAL_MS, 10 + LIGHT_HOUR_EPS / 2, false)).toBe(false);
		expect(t.take(LIGHT_INTERVAL_MS, 10 + LIGHT_HOUR_EPS, false)).toBe(true);
	});

	it("force (World change) always passes and restarts the interval", () => {
		const t = new LightThrottle();
		t.take(0, 10, false);
		expect(t.take(1, 10, true)).toBe(true);
		expect(t.take(1 + LIGHT_INTERVAL_MS - 1, 12, false)).toBe(false);
		expect(t.take(1 + LIGHT_INTERVAL_MS, 12, false)).toBe(true);
	});
});

describe("StillOrder", () => {
	it("drops a decode that lands after a newer one", () => {
		const o = new StillOrder();
		const older = o.begin();
		const newer = o.begin();
		expect(o.accept(newer)).toBe(true);
		expect(o.accept(older)).toBe(false);
		expect(o.latest).toBe(newer);
	});

	it("shows an older render when the newer one has not finished", () => {
		const o = new StillOrder();
		const older = o.begin();
		const newer = o.begin();
		expect(o.accept(older)).toBe(true);
		expect(o.accept(newer)).toBe(true);
	});
});

describe("StillRefresh", () => {
	const MIN = 60_000;
	function fakeTimers() {
		let now = 0;
		let seq = 0;
		const pending = new Map<number, { at: number; cb: () => void }>();
		return {
			timers: {
				now: () => now,
				set: (cb: () => void, ms: number) => {
					pending.set(++seq, { at: now + ms, cb });
					return seq;
				},
				clear: (h: number) => {
					pending.delete(h);
				},
			},
			advance(ms: number) {
				const end = now + ms;
				for (;;) {
					const next = [...pending.entries()].sort((a, b) => a[1].at - b[1].at)[0];
					if (!next || next[1].at > end) break;
					pending.delete(next[0]);
					now = next[1].at;
					next[1].cb();
				}
				now = end;
			},
			get pending() {
				return pending.size;
			},
		};
	}

	it("fires every period while visible", () => {
		const f = fakeTimers();
		let fired = 0;
		const r = new StillRefresh(
			15 * MIN,
			() => {
				fired++;
				r.rendered();
			},
			f.timers,
		);
		r.setActive(true);
		f.advance(15 * MIN - 1);
		expect(fired).toBe(0);
		f.advance(1);
		expect(fired).toBe(1);
		f.advance(15 * MIN);
		expect(fired).toBe(2);
	});

	it("does not fire while hidden, and fires at once on return when overdue", () => {
		const f = fakeTimers();
		let fired = 0;
		const r = new StillRefresh(15 * MIN, () => fired++, f.timers);
		r.setActive(true);
		f.advance(5 * MIN);
		r.setActive(false);
		expect(f.pending).toBe(0);
		f.advance(60 * MIN);
		expect(fired).toBe(0);
		r.setActive(true);
		expect(fired).toBe(1);
	});

	it("resumes the remaining time on a short hide; a mode change (inactive) clears the timer", () => {
		const f = fakeTimers();
		let fired = 0;
		const r = new StillRefresh(15 * MIN, () => fired++, f.timers);
		r.setActive(true);
		f.advance(10 * MIN);
		r.setActive(false);
		f.advance(2 * MIN);
		r.setActive(true);
		f.advance(3 * MIN - 1);
		expect(fired).toBe(0);
		f.advance(1);
		expect(fired).toBe(1);
		r.rendered();
		r.setActive(false);
		expect(f.pending).toBe(0);
		f.advance(60 * MIN);
		expect(fired).toBe(1);
	});
});

describe("notifyAll", () => {
	it("a throwing subscriber does not stop the others or later emits", () => {
		const got: number[] = [];
		const errors: unknown[] = [];
		const listeners = [
			(v: number) => {
				throw new Error(`boom ${v}`);
			},
			(v: number) => {
				got.push(v);
			},
		];
		notifyAll(listeners, 1, e => errors.push(e));
		notifyAll(listeners, 2, e => errors.push(e));
		expect(got).toEqual([1, 2]);
		expect(errors.length).toBe(2);
	});
});
