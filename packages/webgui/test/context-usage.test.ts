import { describe, expect, test } from "bun:test";
import { contextLevel, formatContextUsage } from "../src/lib/context-usage";

describe("formatContextUsage", () => {
	test("formats fractional percentages by rounding to nearest integer when >= 1%", () => {
		expect(formatContextUsage({ percent: 10.4, contextWindow: 1_000_000 })).toBe("10% / 1M");
		expect(formatContextUsage({ percent: 10.6, contextWindow: 1_000_000 })).toBe("11% / 1M");
		expect(formatContextUsage({ percent: 24.9, contextWindow: 200_000 })).toBe("25% / 200K");
		expect(formatContextUsage({ percent: 49.5, contextWindow: 128_000 })).toBe("50% / 128K");
	});

	test("shows one decimal place for percentages under 1%", () => {
		expect(formatContextUsage({ percent: 0.5, contextWindow: 1_000_000 })).toBe("0.5% / 1M");
		expect(formatContextUsage({ percent: 0.1, contextWindow: 200_000 })).toBe("0.1% / 200K");
		expect(formatContextUsage({ percent: 0.05, contextWindow: 1_000_000 })).toBe("0.1% / 1M");
		expect(formatContextUsage({ percent: 0.04, contextWindow: 1_000_000 })).toBe("0.0% / 1M");
	});

	test("formats 1M, 200K, and 128K context windows", () => {
		expect(formatContextUsage({ percent: 10, contextWindow: 1_000_000 })).toBe("10% / 1M");
		expect(formatContextUsage({ percent: 10, contextWindow: 200_000 })).toBe("10% / 200K");
		expect(formatContextUsage({ percent: 10, contextWindow: 128_000 })).toBe("10% / 128K");
	});

	test("returns null when contextWindow is missing, zero, or negative", () => {
		expect(formatContextUsage(undefined)).toBeNull();
		expect(formatContextUsage(null)).toBeNull();
		expect(formatContextUsage({ percent: 10 })).toBeNull();
		expect(formatContextUsage({ percent: 10, contextWindow: 0 })).toBeNull();
		expect(formatContextUsage({ percent: 10, contextWindow: -100 })).toBeNull();
	});

	test("falls back to computing percent from tokens and contextWindow if percent is missing", () => {
		expect(formatContextUsage({ tokens: 50_000, contextWindow: 200_000 })).toBe("25% / 200K");
		expect(formatContextUsage({ tokens: 1_000, contextWindow: 1_000_000 })).toBe("0.1% / 1M");
	});
});

describe("contextLevel", () => {
	test("evaluates threshold boundaries correctly", () => {
		expect(contextLevel(9.9)).toBe("normal");
		expect(contextLevel(10)).toBe("notice");
		expect(contextLevel(24.9)).toBe("notice");
		expect(contextLevel(25)).toBe("warning");
		expect(contextLevel(49.9)).toBe("warning");
		expect(contextLevel(50)).toBe("danger");
	});

	test("handles below-minimum and above-maximum percentages", () => {
		expect(contextLevel(0)).toBe("normal");
		expect(contextLevel(0.5)).toBe("normal");
		expect(contextLevel(75)).toBe("danger");
		expect(contextLevel(100)).toBe("danger");
	});
});
