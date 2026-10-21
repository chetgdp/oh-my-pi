import { useCallback, useEffect, useState } from "react";
import { browserWindow } from "./dom";

/** Present ("0") only when the user turned wrap off; absence means wrap on. */
export const CODE_WRAP_KEY = "webgui.codeWrap";
/** Root class that switches code blocks, fences and diffs to horizontal scroll. */
export const CODE_NOWRAP_CLASS = "code-nowrap";

export function readCodeWrap(): boolean {
	try {
		return browserWindow.localStorage.getItem(CODE_WRAP_KEY) !== "0";
	} catch {
		return true;
	}
}

export function writeCodeWrap(wrap: boolean): void {
	try {
		if (wrap) browserWindow.localStorage.removeItem(CODE_WRAP_KEY);
		else browserWindow.localStorage.setItem(CODE_WRAP_KEY, "0");
	} catch {
		// Storage unavailable: the choice lasts until reload.
	}
}

/** Global code wrap preference: persisted, mirrored onto the root element. */
export function useCodeWrap(): [boolean, () => void] {
	const [wrap, setWrap] = useState(readCodeWrap);
	useEffect(() => {
		browserWindow.document.documentElement.classList.toggle(CODE_NOWRAP_CLASS, !wrap);
	}, [wrap]);
	const toggle = useCallback(() => {
		setWrap(prev => {
			writeCodeWrap(!prev);
			return !prev;
		});
	}, []);
	return [wrap, toggle];
}
