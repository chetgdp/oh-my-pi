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

import { browserWindow } from "../../lib/dom";

/**
 * Whether Enter submits the composer vs inserts a newline.
 *
 * Fine pointer (mouse/trackpad): Enter submits, Shift+Enter inserts newline.
 * Coarse pointer (touch): Enter inserts newline, the button submits.
 */
export function useComposerKeyboard(): { enterSubmits: boolean } {
	const mq = browserWindow.matchMedia("(pointer: fine)");
	return { enterSubmits: mq.matches };
}
