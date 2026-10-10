import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { Chrome } from "../src/output";
import {
	advance,
	currentFace,
	DUMB_DOT_MS,
	FLIP_EVERY_MS,
	formatElapsed,
	initialState,
	KAOMOJI,
	renderDumb,
	renderLine,
	type SpinnerState,
	TABLEFLIP,
} from "../src/spinner";

const zero = () => 0;
const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

function setNamed(name: string) {
	const set = KAOMOJI.find(s => s.name === name);
	if (!set) throw new Error(name);
	return set;
}

describe("spinner frames", () => {
	it("advances one frame per interval and wraps", () => {
		const state = initialState(0, zero);
		const set = state.set;
		expect(currentFace(state, 0)).toBe(set.frames[0]!);
		expect(currentFace(state, set.interval - 1)).toBe(set.frames[0]!);
		expect(currentFace(state, set.interval)).toBe(set.frames[1]!);
		expect(currentFace(state, set.interval * set.frames.length)).toBe(set.frames[0]!);
	});

	it("reshuffles only after the swap window", () => {
		const state = initialState(0, zero); // first set, 10s window
		expect(state.swapAfterMs).toBe(10_000);
		const rng = () => 0.99; // last set
		expect(advance(state, 9_999, rng)).toBe(state);
		const swapped = advance(state, 10_000, rng);
		expect(swapped.set).toBe(KAOMOJI[KAOMOJI.length - 1]!);
		expect(swapped.setStartedAt).toBe(10_000);
		expect(swapped.swapAfterMs).toBeCloseTo(19_900);
		expect(currentFace(swapped, 10_000)).toBe(swapped.set.frames[0]!);
	});

	it("throws a table on long waits and returns to the pool", () => {
		let state: SpinnerState = { ...initialState(0, zero), swapAfterMs: Number.POSITIVE_INFINITY };
		state = advance(state, FLIP_EVERY_MS - 1, zero);
		expect(state.flipping).toBe(false);
		state = advance(state, FLIP_EVERY_MS, zero);
		expect(state.flipping).toBe(true);
		expect(currentFace(state, FLIP_EVERY_MS)).toBe(TABLEFLIP.frames[0]!);
		const flipEnd = FLIP_EVERY_MS + TABLEFLIP.frames.length * TABLEFLIP.interval;
		expect(currentFace(state, flipEnd - 1)).toBe(TABLEFLIP.frames.at(-1)!);
		expect(advance(state, flipEnd - 1, zero)).toBe(state);
		const calm = advance(state, flipEnd, () => 0.5);
		expect(calm.flipping).toBe(false);
		expect(calm.set).not.toBe(TABLEFLIP);
		expect(calm.nextFlipAtMs).toBe(flipEnd + FLIP_EVERY_MS);
	});
});

describe("renderLine", () => {
	it("shows elapsed time and the tool label, but no label for thinking", () => {
		const state = initialState(0, zero);
		const tool = stripAnsi(renderLine(state, 65_000, "bash", 80));
		expect(tool).toContain("1m05s · bash");
		const thinking = stripAnsi(renderLine(state, 3_000, "thinking", 80));
		expect(thinking).toContain("3s");
		expect(thinking).not.toContain("thinking");
	});

	it("never exceeds the terminal width", () => {
		const state = { ...initialState(0, zero), set: setNamed("running") };
		for (const columns of [1, 5, 10, 27, 30, 34, 40, 80]) {
			for (let now = 0; now < 4_000; now += 250) {
				const line = stripAnsi(renderLine(state, now, "a-very-long-tool-name-indeed", columns));
				expect(Bun.stringWidth(line)).toBeLessThan(Math.max(2, columns));
			}
		}
	});

	it("drops metadata when narrow", () => {
		const state = initialState(0, zero);
		expect(stripAnsi(renderLine(state, 5_000, "bash", 20))).toBe(state.set.frames[0]!);
	});
});

describe("dumb mode", () => {
	it("prints the face then a dot per interval", () => {
		const state = initialState(0, zero);
		const face = state.set.frames[0]!;
		expect(renderDumb(state, 0)).toBe(face);
		expect(renderDumb(state, DUMB_DOT_MS * 3)).toBe(`${face} . . .`);
		expect(renderDumb(state, 1_000)).not.toContain("\x1b");
	});
});

describe("Chrome", () => {
	const stdout = spyOn(process.stdout, "write");
	afterEach(() => stdout.mockClear());

	function make(dumb: boolean) {
		let now = 0;
		const writes: string[] = [];
		const chrome = new Chrome({
			tty: true,
			dumb,
			now: () => now,
			rng: zero,
			columns: () => 80,
			write: text => writes.push(text),
		});
		return { chrome, writes, setNow: (t: number) => (now = t) };
	}

	it("defers the first frame, clears before chrome lines and on stop, never touches stdout", () => {
		const { chrome, writes, setNow } = make(false);
		chrome.start();
		chrome.tick();
		expect(writes).toEqual([]);
		setNow(1_000);
		chrome.tick();
		expect(writes).toHaveLength(1);
		expect(writes[0]!.startsWith("\r")).toBe(true);
		chrome.tool("bash", { command: "ls" });
		expect(writes.slice(1)).toEqual(["\r\x1b[2K", "· bash ls\n"]);
		setNow(2_000);
		chrome.tick();
		expect(stripAnsi(writes.at(-1)!)).toContain("· bash");
		chrome.stop();
		expect(writes.at(-1)).toBe("\r\x1b[2K");
		expect(stdout).not.toHaveBeenCalled();
	});

	it("dumb mode appends dots without escapes", () => {
		const { chrome, writes, setNow } = make(true);
		chrome.start();
		setNow(1_000);
		chrome.tick();
		setNow(DUMB_DOT_MS * 2);
		chrome.tick();
		chrome.stop();
		expect(writes.join("")).toBe(`${KAOMOJI[0]!.frames[0]} . .\n`);
		expect(writes.join("")).not.toContain("\x1b");
	});

	it("draws nothing without a tty", () => {
		const writes: string[] = [];
		const chrome = new Chrome({ tty: false, write: text => writes.push(text) });
		chrome.start();
		chrome.tick();
		chrome.stop();
		expect(writes).toEqual([]);
	});

	it("formats elapsed", () => {
		expect(formatElapsed(59_999)).toBe("59s");
		expect(formatElapsed(600_000)).toBe("10m00s");
	});
});
