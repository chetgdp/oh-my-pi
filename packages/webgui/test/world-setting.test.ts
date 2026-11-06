import { describe, expect, it } from "bun:test";
import { formatWorldHour, parseHour, parseWorldSetting, resolveWorldSetting } from "../src/lib/world-setting";

describe("parseWorldSetting", () => {
	it("absent or unreadable is auto", () => {
		expect(parseWorldSetting(null)).toEqual({ mode: "auto" });
		expect(parseWorldSetting(undefined)).toEqual({ mode: "auto" });
		expect(parseWorldSetting("")).toEqual({ mode: "auto" });
		expect(parseWorldSetting("noon")).toEqual({ mode: "auto" });
		expect(parseWorldSetting("-1")).toEqual({ mode: "auto" });
		expect(parseWorldSetting("24.5")).toEqual({ mode: "auto" });
		expect(parseWorldSetting("NaN")).toEqual({ mode: "auto" });
	});

	it("an hour in 0..24 is fixed", () => {
		expect(parseWorldSetting("0")).toEqual({ mode: "fixed", hour: 0 });
		expect(parseWorldSetting("12.5")).toEqual({ mode: "fixed", hour: 12.5 });
		expect(parseWorldSetting("24")).toEqual({ mode: "fixed", hour: 24 });
	});
});

describe("resolveWorldSetting", () => {
	it("?hour= overrides the stored value", () => {
		expect(resolveWorldSetting("12.5", "?hour=23")).toEqual({ mode: "fixed", hour: 23 });
		expect(resolveWorldSetting(null, "?bg=live&hour=6.5")).toEqual({ mode: "fixed", hour: 6.5 });
	});

	it("an invalid or absent ?hour= falls back to the stored value", () => {
		expect(resolveWorldSetting("12.5", "?hour=25")).toEqual({ mode: "fixed", hour: 12.5 });
		expect(resolveWorldSetting("12.5", "?hour=")).toEqual({ mode: "fixed", hour: 12.5 });
		expect(resolveWorldSetting(null, "")).toEqual({ mode: "auto" });
		expect(resolveWorldSetting("7", "?bg=still")).toEqual({ mode: "fixed", hour: 7 });
	});
});

describe("parseHour / formatWorldHour", () => {
	it("parses decimal hours in range only", () => {
		expect(parseHour(" 3 ")).toBe(3);
		expect(parseHour("1e1")).toBe(10);
		expect(parseHour("x")).toBeNull();
	});

	it("formats as HH:MM", () => {
		expect(formatWorldHour(12.5)).toBe("12:30");
		expect(formatWorldHour(0)).toBe("00:00");
		expect(formatWorldHour(23.25)).toBe("23:15");
		expect(formatWorldHour(24)).toBe("24:00");
	});
});
