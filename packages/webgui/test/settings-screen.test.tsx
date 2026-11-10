import "./dom-setup";
import { NativeEvent, win } from "./dom-setup";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { WORLD_KEY } from "../src/lib/world-setting";
import { BACKGROUND_KEY } from "../src/splash/background-setting";
import { UI_KEY } from "../src/lib/ui-setting";
import { THEME_KEY } from "../src/lib/theme-setting";

const g = globalThis as Record<string, unknown>;
g.localStorage = win.localStorage;
g.matchMedia = (q: string) => win.matchMedia(q);
g.innerWidth = 1440;
// Exception: react-dom/client and SettingsScreen must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { SettingsScreen } = await import("../src/components/settings/SettingsScreen");

interface Mounted {
	el: HTMLElement;
	cleanup(): void;
}

function mount(): Mounted {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => root.render(<SettingsScreen />));
	return {
		el: container as unknown as HTMLElement,
		cleanup() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

function button(el: HTMLElement, text: string): HTMLElement {
	const b = Array.from(el.querySelectorAll("button")).find(x => x.textContent?.trim() === text);
	if (!b) throw new Error(`no button ${text}`);
	return b as unknown as HTMLElement;
}

function slide(el: HTMLElement, value: number): void {
	const input = el.querySelector(".st-slider");
	if (!input) throw new Error("no slider");
	const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
	act(() => {
		setter?.call(input, String(value));
		input.dispatchEvent(
			new win.Event("input", { bubbles: true }) as unknown as Parameters<typeof input.dispatchEvent>[0],
		);
	});
}

function setUrl(search: string): void {
	win.happyDOM.setURL(`http://localhost/${search}#/settings`);
}

beforeEach(() => {
	win.localStorage.clear();
	// World and Background exist only under Clear
	win.localStorage.setItem(UI_KEY, "clear");
	setUrl("");
});

/** Bun's global event target; the background setting listens there for storage events. */
const eventTarget = globalThis as unknown as { dispatchEvent(e: unknown): boolean };

let m: Mounted | null = null;
afterEach(() => {
	m?.cleanup();
	m = null;
});

describe("SettingsScreen World", () => {
	it("follows the clock by default; the slider fixes the hour and labels it", () => {
		m = mount();
		const sw = m.el.querySelector('input[role="switch"]') as unknown as { checked: boolean };
		expect(sw.checked).toBe(true);
		slide(m.el, 18.25);
		expect(win.localStorage.getItem(WORLD_KEY)).toBe("18.25");
		expect(m.el.querySelector(".st-value")?.textContent).toBe("18:15");
		expect(sw.checked).toBe(false);
	});

	it("Day and Night presets set the slider", () => {
		m = mount();
		act(() => button(m!.el, "Day").click());
		expect(win.localStorage.getItem(WORLD_KEY)).toBe("12.5");
		expect(button(m.el, "Day").getAttribute("aria-pressed")).toBe("true");
		act(() => button(m!.el, "Night").click());
		expect(win.localStorage.getItem(WORLD_KEY)).toBe("23");
		expect((m.el.querySelector(".st-slider") as unknown as { value: string }).value).toBe("23");
	});

	it("a pick drops the ?hour= override from the URL", () => {
		setUrl("?hour=5&bg=live");
		m = mount();
		expect(m.el.querySelector(".st-value")?.textContent).toBe("05:00");
		act(() => button(m!.el, "Day").click());
		expect(win.location.search).toBe("?bg=live");
		expect(win.localStorage.getItem(WORLD_KEY)).toBe("12.5");
	});
});

describe("SettingsScreen Background", () => {
	it("mode buttons store the choice", () => {
		m = mount();
		expect(button(m.el, "Auto").getAttribute("aria-pressed")).toBe("true");
		act(() => button(m!.el, "Still").click());
		expect(win.localStorage.getItem(BACKGROUND_KEY)).toBe("still");
		expect(button(m.el, "Still").getAttribute("aria-pressed")).toBe("true");
		act(() => button(m!.el, "Auto").click());
		expect(win.localStorage.getItem(BACKGROUND_KEY)).toBeNull();
	});

	it("shows the running mode and why when ?bg= overrides the choice", () => {
		setUrl("?bg=off");
		win.localStorage.setItem(BACKGROUND_KEY, "live");
		m = mount();
		expect(m.el.textContent).toContain("Showing Off: set by ?bg= in the address.");
	});

	it("follows a change made in another tab", () => {
		m = mount();
		win.localStorage.setItem(BACKGROUND_KEY, "off");
		act(() => {
			eventTarget.dispatchEvent(Object.assign(new NativeEvent("storage"), { key: BACKGROUND_KEY }));
		});
		expect(button(m!.el, "Off").getAttribute("aria-pressed")).toBe("true");
	});
});

describe("SettingsScreen Interface", () => {
	it("Flat stores no key and hides the scene sections; Clear shows them", () => {
		m = mount();
		act(() => button(m!.el, "Flat").click());
		expect(win.localStorage.getItem(UI_KEY)).toBeNull();
		expect(button(m.el, "Flat").getAttribute("aria-pressed")).toBe("true");
		expect(m.el.textContent).not.toContain("World");
		expect(m.el.textContent).not.toContain("Background");
		act(() => button(m!.el, "Clear").click());
		expect(win.localStorage.getItem(UI_KEY)).toBe("clear");
		expect(m.el.textContent).toContain("World");
		expect(m.el.textContent).toContain("Background");
	});
});

describe("SettingsScreen Appearance", () => {
	const root = (): HTMLElement => win.document.documentElement as unknown as HTMLElement;
	afterEach(() => root().removeAttribute("data-theme"));

	it("shows only under Flat", () => {
		m = mount();
		expect(m.el.textContent).not.toContain("Appearance");
		act(() => button(m!.el, "Flat").click());
		expect(m.el.textContent).toContain("Appearance");
		act(() => button(m!.el, "Clear").click());
		expect(m.el.textContent).not.toContain("Appearance");
	});

	it("Light and Dark set data-theme and persist; System removes both", () => {
		win.localStorage.removeItem(UI_KEY);
		m = mount();
		expect(button(m.el, "System").getAttribute("aria-pressed")).toBe("true");
		act(() => button(m!.el, "Light").click());
		expect(root().getAttribute("data-theme")).toBe("light");
		expect(win.localStorage.getItem(THEME_KEY)).toBe("light");
		act(() => button(m!.el, "Dark").click());
		expect(root().getAttribute("data-theme")).toBe("dark");
		expect(win.localStorage.getItem(THEME_KEY)).toBe("dark");
		expect(button(m.el, "Dark").getAttribute("aria-pressed")).toBe("true");
		act(() => button(m!.el, "System").click());
		expect(root().hasAttribute("data-theme")).toBe(false);
		expect(win.localStorage.getItem(THEME_KEY)).toBeNull();
	});
});
