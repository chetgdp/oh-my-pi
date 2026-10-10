/**
 * Kaomoji spinner, ported from giverny. Frame selection and rendering are pure
 * functions of (state, now, rng) so the clock and randomness are injectable;
 * the Chrome class owns the timer and the stderr writes.
 */

export interface KaomojiSet {
	readonly name: string;
	readonly frames: readonly string[];
	/** Milliseconds per frame. */
	readonly interval: number;
}

export const KAOMOJI: readonly KaomojiSet[] = [
	{ name: "thinking", frames: [" ლ(ಠ_ಠ ლ)", "ლ (ಠ_ಠლ )"], interval: 500 },
	{ name: "reading", frames: ["|･ω･)ノ", "|･ω･)ﾉ"], interval: 400 },
	{ name: "writing", frames: ["____φ(．．)", "___φ-(．．)"], interval: 500 },
	{
		name: "running",
		frames: [
			"┌( >_<)┘",
			"ε=└( >_<)┐",
			"ε=ε=┌( >_<)┘",
			"ε=ε=ε=└( >_<)┐",
			"ε=ε=ε=ε=┌( >_<)┘",
			"ε=ε=ε=ε=ε=└( >_<)┐",
			"ε=ε=ε=ε=ε=ε=┌( >_<)┘",
			"ε=ε=ε=ε=ε=ε=ε=└( >_<)┐",
			"              ┌(>_< )┘",
			"            └(>_< )┐=3",
			"          ┌(>_< )┘=3=3",
			"        └(>_< )┐=3=3=3",
			"      ┌(>_< )┘=3=3=3=3",
			"    └(>_< )┐=3=3=3=3=3",
			"  ┌(>_< )┘=3=3=3=3=3=3",
			"└(>_< )┐=3=3=3=3=3=3=3",
		],
		interval: 250,
	},
	{
		name: "searching",
		frames: [
			"( °_°)     ",
			"  ( °_°)   ",
			"    ( °_°) ",
			"     ( °_°)",
			"     (°_° )",
			"   (°_° )  ",
			" (°_° )    ",
			"(°_° )     ",
		],
		interval: 500,
	},
	{ name: "agent", frames: ["(・ω・)人(・ω・)", "(・ω・)八(・ω・)"], interval: 500 },
	{ name: "blinking", frames: ["( - _ - )", "( 。_ 。)", "( 0 _ 0 )", "( 。_ 。)"], interval: 500 },
];

export const TABLEFLIP: KaomojiSet = {
	name: "tableflip",
	frames: [
		"(╮°ー° )╮   ┳━━┳",
		" (╮°ー° )╮  ┳━━┳",
		"  (╮°ー° )╮ ┳━━┳",
		"   (╮°ー° )╮┳━━┳",
		"   ( ╮°ー°)╮┳━━┳",
		"   ( ╯°益°)╯彡┻━━┻",
		"           ┳━━┳ノ(°ー°ノ)",
	],
	interval: 1000,
};

/** A tantrum every this many ms of wall time. */
export const FLIP_EVERY_MS = 42_000;
const SWAP_MIN_MS = 10_000;
const SWAP_SPREAD_MS = 10_000;
/** Column where the elapsed/label metadata starts (after the widest face + gap). */
export const META_COL = 27;
/** Dumb mode prints one dot per this many ms. */
export const DUMB_DOT_MS = 2000;

const ORANGE = "\x1b[38;5;208m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/** Random source in [0, 1). */
export type Rng = () => number;

export interface SpinnerState {
	/** Wall time the spinner started; never reset across phases. */
	readonly startedAt: number;
	readonly set: KaomojiSet;
	/** When the current set (or flip) began; frame index derives from this. */
	readonly setStartedAt: number;
	/** Swap to a new random set this long after setStartedAt. */
	readonly swapAfterMs: number;
	readonly flipping: boolean;
	/** Elapsed ms (since startedAt) at which the next tantrum starts. */
	readonly nextFlipAtMs: number;
}

function pick(rng: Rng): KaomojiSet {
	const set = KAOMOJI[Math.floor(rng() * KAOMOJI.length) % KAOMOJI.length];
	if (!set) throw new Error("kaomoji pool is empty");
	return set;
}

function swapWindow(rng: Rng): number {
	return SWAP_MIN_MS + rng() * SWAP_SPREAD_MS;
}

export function initialState(now: number, rng: Rng): SpinnerState {
	return {
		startedAt: now,
		set: pick(rng),
		setStartedAt: now,
		swapAfterMs: swapWindow(rng),
		flipping: false,
		nextFlipAtMs: FLIP_EVERY_MS,
	};
}

/** Next state at `now`: reshuffle after the swap window, start/end tantrums. */
export function advance(state: SpinnerState, now: number, rng: Rng): SpinnerState {
	const elapsed = now - state.startedAt;
	if (state.flipping) {
		if (now - state.setStartedAt < TABLEFLIP.frames.length * TABLEFLIP.interval) return state;
		return {
			...state,
			set: pick(rng),
			setStartedAt: now,
			swapAfterMs: swapWindow(rng),
			flipping: false,
			nextFlipAtMs: elapsed + FLIP_EVERY_MS,
		};
	}
	if (elapsed >= state.nextFlipAtMs) {
		return { ...state, set: TABLEFLIP, setStartedAt: now, flipping: true };
	}
	if (now - state.setStartedAt >= state.swapAfterMs) {
		return { ...state, set: pick(rng), setStartedAt: now, swapAfterMs: swapWindow(rng) };
	}
	return state;
}

export function currentFace(state: SpinnerState, now: number): string {
	const index = Math.floor(Math.max(0, now - state.setStartedAt) / state.set.interval);
	const frames = state.set.frames;
	// Tableflip plays once; advance() ends it after the last frame.
	const face = state.flipping ? frames[Math.min(index, frames.length - 1)] : frames[index % frames.length];
	if (face === undefined) throw new Error(`kaomoji set ${state.set.name} has no frames`);
	return face;
}

export function formatElapsed(ms: number): string {
	const total = Math.floor(Math.max(0, ms) / 1000);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return mins > 0 ? `${mins}m${secs.toString().padStart(2, "0")}s` : `${secs}s`;
}

/** Cut `text` to at most `width` terminal columns. */
function fitWidth(text: string, width: number): string {
	if (Bun.stringWidth(text) <= width) return text;
	let out = "";
	for (const ch of text) {
		if (Bun.stringWidth(out + ch) > width) break;
		out += ch;
	}
	return out;
}

/**
 * One spinner line (no leading \r, no trailing clear). Face always shows;
 * the elapsed time and label (omitted for "thinking", which the face conveys)
 * appear only when `columns` leaves room. Visible width never exceeds columns - 1.
 */
export function renderLine(state: SpinnerState, now: number, label: string, columns: number): string {
	const usable = Math.max(1, columns - 1);
	const face = fitWidth(currentFace(state, now), usable);
	const time = formatElapsed(now - state.startedAt).padStart(6, " ");
	const remaining = usable - META_COL;
	let meta = "";
	if (remaining >= time.length) {
		meta = time;
		if (label !== "thinking" && label.length > 0 && remaining >= meta.length + 3 + 1) {
			meta = fitWidth(`${meta} · ${label}`, remaining);
		}
	}
	if (meta.length === 0) return `${ORANGE}${face}${RESET}`;
	const pad = Math.max(1, META_COL - Bun.stringWidth(face));
	return `${ORANGE}${face}${RESET}${" ".repeat(pad)}${DIM}${meta}${RESET}`;
}

/** Dumb terminals (TERM=dumb): the face once, then a dot per DUMB_DOT_MS; append-only, no escapes. */
export function renderDumb(state: SpinnerState, now: number): string {
	const dots = Math.floor(Math.max(0, now - state.startedAt) / DUMB_DOT_MS);
	return `${state.set.frames[0] ?? ""}${" .".repeat(dots)}`;
}
