import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, it } from "bun:test";

// Exception: world-light binds browserDocument when lib/dom loads, so it must follow dom-setup
const { startClear, stopClear } = await import("../src/lib/world-light");

function styleCount(): number {
	return win.document.body.querySelectorAll("style").length;
}

describe("startClear / stopClear", () => {
	it("Flat after Clear leaves no clear styles; Clear again injects exactly one set", () => {
		const before = styleCount();
		const html = win.document.documentElement;
		startClear();
		startClear();
		expect(html.classList.contains("ui-clear")).toBe(true);
		expect(styleCount()).toBe(before + 2);
		stopClear();
		expect(html.classList.contains("ui-clear")).toBe(false);
		expect(styleCount()).toBe(before);
		startClear();
		expect(styleCount()).toBe(before + 2);
		stopClear();
	});
});
