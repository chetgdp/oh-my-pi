import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useRef } from "react";
import { browserWindow } from "./dom";

/** Movement below this (px) with no flick velocity is a tap. */
export const SHEET_TAP_SLOP = 6;
/** Travel beyond this fraction of the sheet height commits (dismiss or open). */
export const SHEET_COMMIT_FRACTION = 0.3;
/** Release velocity (px/ms) in the gesture's direction that commits regardless of distance. */
export const SHEET_FLICK_VELOCITY = 0.5;
/** Velocity is measured over samples newer than this (ms). */
export const SHEET_VELOCITY_WINDOW = 100;
export const SHEET_COMMIT_MS = 200;
export const SHEET_REVERT_MS = 180;
const RUBBER_FACTOR = 0.3;
const RUBBER_MAX = 40;
const MIN_COMMIT_MS = 60;

/** "dismiss": an open top sheet dragged up. "open": a closed sheet pulled down from above. */
export type SheetDragMode = "dismiss" | "open";

export type SheetRelease =
	| { kind: "tap" }
	| { kind: "commit"; duration: number }
	| { kind: "revert"; duration: number };

/**
 * Sheet translateY for a finger travel `dy`. `travel` is the distance between the closed position
 * (sheet bottom on the anchor line) and open (translateY 0). Past open the travel is rubber-banded.
 */
export function sheetPosition(mode: SheetDragMode, dy: number, travel: number): number {
	const raw = mode === "dismiss" ? dy : dy - travel;
	return raw <= 0 ? raw : Math.min(raw * RUBBER_FACTOR, RUBBER_MAX);
}

/** Pure gesture math for a top sheet. Times in ms, y in px. */
export class SheetDragTracker {
	#startY = 0;
	#samples: { y: number; t: number }[] = [];
	#maxTravel = 0;

	start(y: number, t: number): void {
		this.#startY = y;
		this.#samples = [{ y, t }];
		this.#maxTravel = 0;
	}

	/** Records a sample; returns the finger travel since start (positive = down). */
	move(y: number, t: number): number {
		this.#samples.push({ y, t });
		const cutoff = t - SHEET_VELOCITY_WINDOW;
		while (this.#samples.length > 2 && this.#samples[0]!.t < cutoff) this.#samples.shift();
		const dy = y - this.#startY;
		this.#maxTravel = Math.max(this.#maxTravel, Math.abs(dy));
		return dy;
	}

	/** True once the pointer travelled past the tap slop; the trailing click must then be ignored. */
	get dragged(): boolean {
		return this.#maxTravel >= SHEET_TAP_SLOP;
	}

	/** `height` is the travel distance between closed and open. */
	release(mode: SheetDragMode, y: number, t: number, height: number): SheetRelease {
		const dy = this.move(y, t);
		const first = this.#samples[0]!;
		const dt = t - first.t;
		// Signed so that positive always points toward committing.
		const sign = mode === "dismiss" ? -1 : 1;
		const velocity = dt > 0 ? (sign * (y - first.y)) / dt : 0;
		const flick = velocity > SHEET_FLICK_VELOCITY;
		if (!this.dragged && !flick) return { kind: "tap" };
		if (flick || sign * dy > height * SHEET_COMMIT_FRACTION) {
			const pos = sheetPosition(mode, dy, height);
			const remaining = mode === "dismiss" ? height + pos : -pos;
			const duration =
				height > 0 ? Math.max(MIN_COMMIT_MS, Math.round((SHEET_COMMIT_MS * Math.max(0, remaining)) / height)) : 0;
			return { kind: "commit", duration };
		}
		return { kind: "revert", duration: SHEET_REVERT_MS };
	}
}

export function prefersReducedMotion(): boolean {
	if (typeof browserWindow.matchMedia !== "function") return false;
	return browserWindow.matchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export interface SheetDragOptions {
	mode: SheetDragMode;
	sheetRef: RefObject<HTMLElement | null>;
	scrimRef: RefObject<HTMLElement | null>;
	/**
	 * Viewport y of the line the sheet retracts to (the top bar's bottom edge). The closed sheet's
	 * bottom sits on it, and the sheet is clipped above it. Read once per gesture.
	 */
	anchor: () => number;
	/** Pointer down: "open" mode mounts the sheet off-screen here so its height is measurable. */
	onStart?: () => void;
	/** Commit animation finished (sheet dismissed / fully open). */
	onCommit: () => void;
	/** Revert animation finished, or the gesture was a tap ("open" mode unmounts here). */
	onRevert?: () => void;
	/** Clock for gesture timing; defaults to performance.now. */
	now?: () => number;
}

export interface SheetDragHandlers {
	onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
	onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
	onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
	onPointerCancel: () => void;
	onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => void;
	/** Leaving before the drag captured the pointer: its pointerup would never arrive here. */
	onPointerLeave: () => void;
	/** Returns true (and resets) when the click following a drag must be swallowed. */
	consumeDragClick: () => boolean;
}

const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Drag gesture for a top sheet. Writes transform/opacity straight to the
 * elements (rAF-batched) so a drag costs no React renders.
 */
export function useSheetDrag(opts: SheetDragOptions): SheetDragHandlers {
	const optsRef = useRef(opts);
	optsRef.current = opts;
	const tracker = useRef(new SheetDragTracker());
	const pointer = useRef<number | null>(null);
	const pendingDy = useRef<number | null>(null);
	/** Travel distance (sheet height minus anchor) and anchor, read once per gesture after mount. */
	const travel = useRef(0);
	const anchor = useRef(0);
	const frame = useRef<number | null>(null);
	const timer = useRef<Timer | undefined>(undefined);
	const swallowClick = useRef(false);

	const clock = (): number => (optsRef.current.now ?? (() => performance.now()))();
	const measure = (): number => {
		if (travel.current === 0) {
			anchor.current = optsRef.current.anchor();
			const h = optsRef.current.sheetRef.current?.offsetHeight ?? 0;
			travel.current = Math.max(1, h - anchor.current);
		}
		return travel.current;
	};

	const paint = (pos: number, duration: number): void => {
		const sheet = optsRef.current.sheetRef.current;
		const scrim = optsRef.current.scrimRef.current;
		const t = measure();
		const a = anchor.current;
		const transition = duration > 0 ? `${duration}ms ${EASE_OUT}` : "";
		if (sheet) {
			sheet.style.transition = transition && `transform ${transition}`;
			sheet.style.transform = `translateY(${pos}px)`;
			// Hide whatever lies over the top bar: the sheet emerges from (retracts into) the anchor line.
			sheet.style.clipPath = `inset(${Math.max(0, a - pos)}px 0 0 0)`;
		}
		if (scrim) {
			scrim.style.transition = transition && `opacity ${transition}`;
			scrim.style.opacity = String(Math.min(1, Math.max(0, 1 + pos / t)));
			scrim.style.clipPath = `inset(${a}px 0 0 0)`;
		}
	};

	const clearStyles = (): void => {
		for (const el of [optsRef.current.sheetRef.current, optsRef.current.scrimRef.current]) {
			if (!el) continue;
			el.style.transition = "";
			el.style.transform = "";
			el.style.opacity = "";
			el.style.clipPath = "";
		}
	};

	const cancelFrame = (): void => {
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		pendingDy.current = null;
	};

	useEffect(
		() => () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			clearTimeout(timer.current);
		},
		[],
	);

	const settle = (pos: number, duration: number, then: () => void): void => {
		cancelFrame();
		clearTimeout(timer.current);
		const d = prefersReducedMotion() ? 0 : duration;
		paint(pos, d);
		if (d === 0) {
			then();
			return;
		}
		timer.current = setTimeout(() => {
			timer.current = undefined;
			then();
		}, d);
	};

	const revert = (): void => {
		const { mode, onRevert } = optsRef.current;
		settle(mode === "dismiss" ? 0 : -measure(), SHEET_REVERT_MS, () => {
			if (mode === "dismiss") clearStyles();
			onRevert?.();
		});
	};

	const endPointer = (): boolean => {
		const active = pointer.current !== null;
		pointer.current = null;
		return active;
	};

	return {
		onPointerDown: e => {
			if (pointer.current !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
			clearTimeout(timer.current);
			pointer.current = e.pointerId;
			swallowClick.current = false;
			travel.current = 0;
			tracker.current.start(e.clientY, clock());
			const sheet = optsRef.current.sheetRef.current;
			if (sheet) sheet.style.transition = "";
			optsRef.current.onStart?.();
		},
		onPointerMove: e => {
			if (e.pointerId !== pointer.current) return;
			const wasDragging = tracker.current.dragged;
			const dy = tracker.current.move(e.clientY, clock());
			// Capture only once this is a drag: capturing at pointerdown retargets pointerup, and with a
			// mouse the click then lands on the capturing ancestor instead of the pressed button.
			if (!wasDragging && tracker.current.dragged) e.currentTarget.setPointerCapture?.(e.pointerId);
			pendingDy.current = dy;
			if (frame.current !== null) return;
			frame.current = requestAnimationFrame(() => {
				frame.current = null;
				const pending = pendingDy.current;
				pendingDy.current = null;
				if (pending !== null) paint(sheetPosition(optsRef.current.mode, pending, measure()), 0);
			});
		},
		onPointerUp: e => {
			if (e.pointerId !== pointer.current) return;
			endPointer();
			e.currentTarget.releasePointerCapture?.(e.pointerId);
			const { mode } = optsRef.current;
			const t = measure();
			const r = tracker.current.release(mode, e.clientY, clock(), t);
			if (r.kind === "tap") {
				cancelFrame();
				if (mode === "dismiss") clearStyles();
				optsRef.current.onRevert?.();
				return;
			}
			swallowClick.current = true;
			if (r.kind === "revert") {
				revert();
				return;
			}
			if (mode === "dismiss") {
				// Styles stay put: the sheet unmounts off-screen instead of flashing back.
				settle(-t, r.duration, () => optsRef.current.onCommit());
				return;
			}
			// Inline styles stay until the owner re-renders open; clearing here would show the
			// closed (pulling) CSS for a frame before React commits.
			settle(0, r.duration, () => optsRef.current.onCommit());
		},
		onPointerCancel: () => {
			if (!endPointer()) return;
			swallowClick.current = tracker.current.dragged;
			revert();
		},
		onPointerLeave: () => {
			if (tracker.current.dragged || !endPointer()) return;
			revert();
		},
		onLostPointerCapture: e => {
			// Only our own capture counts. Taking capture ends a touch's implicit capture on the pressed
			// child, whose lostpointercapture bubbles up here mid-drag.
			if (e.target !== e.currentTarget || !endPointer()) return;
			swallowClick.current = tracker.current.dragged;
			revert();
		},
		consumeDragClick: () => {
			const swallow = swallowClick.current;
			swallowClick.current = false;
			return swallow;
		},
	};
}
