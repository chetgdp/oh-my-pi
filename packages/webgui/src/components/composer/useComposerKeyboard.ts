/**
 * Pure decision: should this keyboard event submit the composer?
 *
 * Composing (IME active) → false; non-Enter → false;
 * Shift+Enter → false (insert newline); otherwise defers to `fine`.
 */
export function enterSubmits(event: { key: string; shiftKey: boolean; isComposing: boolean }, fine: boolean): boolean {
	if (event.isComposing) return false;
	if (event.key !== "Enter") return false;
	if (event.shiftKey) return false;
	return fine;
}

export interface HistoryKeyOptions {
	key: string;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	isComposing: boolean;
	slashOpen: boolean;
	text: string;
	selectionStart: number;
	selectionEnd: number;
}

/**
 * Pure decision: should this keyboard event navigate prompt history?
 * Returns "up", "down", or null.
 */
export function historyNavDirection(opts: HistoryKeyOptions): "up" | "down" | null {
	if (opts.isComposing) return null;
	if (opts.altKey || opts.ctrlKey || opts.metaKey || opts.shiftKey) return null;
	if (opts.slashOpen) return null;

	if (opts.key === "ArrowUp") {
		const clamped = Math.max(0, Math.min(opts.selectionStart, opts.text.length));
		if (opts.text.lastIndexOf("\n", clamped - 1) === -1) {
			return "up";
		}
	} else if (opts.key === "ArrowDown") {
		const clamped = Math.max(0, Math.min(opts.selectionEnd, opts.text.length));
		if (opts.text.indexOf("\n", clamped) === -1) {
			return "down";
		}
	}

	return null;
}

import { browserWindow } from "../../lib/dom";

/**
 * Whether Enter submits the composer vs inserts a newline.
 *
 * Fine pointer (mouse/trackpad): Enter submits, Shift+Enter inserts newline.
 * Coarse pointer (touch): Enter inserts newline, the button submits.
 */
export function useComposerKeyboard(): { enterSubmits: boolean } {
	if (typeof browserWindow.matchMedia !== "function") {
		return { enterSubmits: true };
	}
	const mq = browserWindow.matchMedia("(pointer: fine)");
	return { enterSubmits: mq?.matches ?? true };
}
