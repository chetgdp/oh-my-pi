import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { CODE_NOWRAP_CLASS, CODE_WRAP_KEY, readCodeWrap, useCodeWrap, writeCodeWrap } from "../src/lib/code-wrap";

// Exception: react-dom/client must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

/** Bun lacks localStorage; a Map stands in per test. */
const g = globalThis as { localStorage?: unknown };
let previousStorage: unknown;
let store: Map<string, string>;

beforeEach(() => {
	previousStorage = g.localStorage;
	store = new Map();
	g.localStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
	};
	win.document.documentElement.classList.remove(CODE_NOWRAP_CLASS);
});

afterEach(() => {
	g.localStorage = previousStorage;
});

let toggle: () => void = () => {};
function Probe(): ReactNode {
	const [wrap, t] = useCodeWrap();
	toggle = t;
	return <span data-wrap={String(wrap)} />;
}

function mountProbe(): { el: HTMLElement; cleanup(): void } {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(<Probe />);
	});
	return {
		el: container as unknown as HTMLElement,
		cleanup() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

const rootHasNowrap = (): boolean => win.document.documentElement.classList.contains(CODE_NOWRAP_CLASS);

describe("code wrap preference", () => {
	test("defaults to wrap on with nothing stored", () => {
		expect(readCodeWrap()).toBe(true);
	});

	test("round-trips through storage; wrap on clears the key", () => {
		writeCodeWrap(false);
		expect(store.get(CODE_WRAP_KEY)).toBe("0");
		expect(readCodeWrap()).toBe(false);
		writeCodeWrap(true);
		expect(store.has(CODE_WRAP_KEY)).toBe(false);
		expect(readCodeWrap()).toBe(true);
	});

	test("defaults to wrap on when storage is unavailable", () => {
		g.localStorage = undefined;
		expect(readCodeWrap()).toBe(true);
	});

	test("hook mirrors the preference onto the root class and persists toggles", () => {
		const m = mountProbe();
		expect(m.el.querySelector("span")?.getAttribute("data-wrap")).toBe("true");
		expect(rootHasNowrap()).toBe(false);

		act(() => toggle());
		expect(m.el.querySelector("span")?.getAttribute("data-wrap")).toBe("false");
		expect(rootHasNowrap()).toBe(true);
		expect(store.get(CODE_WRAP_KEY)).toBe("0");

		act(() => toggle());
		expect(rootHasNowrap()).toBe(false);
		expect(store.has(CODE_WRAP_KEY)).toBe(false);
		m.cleanup();
	});

	test("hook restores a stored wrap-off preference on mount", () => {
		store.set(CODE_WRAP_KEY, "0");
		const m = mountProbe();
		expect(rootHasNowrap()).toBe(true);
		m.cleanup();
	});
});
