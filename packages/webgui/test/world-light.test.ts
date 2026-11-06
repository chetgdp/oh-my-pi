import { describe, expect, it } from "bun:test";
import { nextInk, worldLightCss } from "../src/lib/world-light";

describe("worldLightCss", () => {
	it("writes the scene light as one :root rule", () => {
		const css = worldLightCss(
			{ zenith: [0.1, 0.2, 0.4], horizon: [0.5, 0.5, 0.5], key: [1, 0.9, 0.8], keyDir: -Math.PI / 2, luma: 0.73 },
			1,
		);
		expect(css).toBe(
			":root{--world-zenith:rgb(26 51 102);--world-horizon:rgb(128 128 128);--world-key:rgb(255 230 204);--world-key-dir:-1.571;--world-luma:0.730;--world-ink:1}",
		);
	});

	it("scales HDR colours into range and clamps luma", () => {
		const css = worldLightCss({ zenith: [0, 0, 0], horizon: [0, 0, 0], key: [4, 2, 1], keyDir: 0, luma: 3 }, 0);
		expect(css).toContain("--world-key:rgb(255 128 64)");
		expect(css).toContain("--world-luma:1.000");
	});

	it("falls back on non-finite values", () => {
		const css = worldLightCss(
			{ zenith: [0, 0, 0], horizon: [0, 0, 0], key: [0, 0, 0], keyDir: Number.NaN, luma: Number.NaN },
			0,
		);
		expect(css).toContain("--world-key-dir:-1.571");
		expect(css).toContain("--world-luma:0.200");
	});
});

describe("nextInk", () => {
	it("switches with hysteresis", () => {
		expect(nextInk(null, 0.37)).toBe(1);
		expect(nextInk(null, 0.35)).toBe(0);
		expect(nextInk(0, 0.37)).toBe(0);
		expect(nextInk(0, 0.4)).toBe(1);
		expect(nextInk(1, 0.35)).toBe(1);
		expect(nextInk(1, 0.3)).toBe(0);
	});
});
