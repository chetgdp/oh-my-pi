import { describe, expect, it } from "bun:test";
import { displayName, groupPast, shortCwd } from "../src/lib/session-groups";
import type { PastSessionSummary } from "../src/server/past";

function makePast(overrides: Partial<PastSessionSummary> & { id: string }): PastSessionSummary {
	return {
		path: `/sessions/${overrides.id}.json`,
		cwd: "/Users/dev/project",
		name: null,
		createdAt: 1000,
		modifiedAt: 1000,
		messageCount: 5,
		firstUserMessage: null,
		...overrides,
	};
}

describe("displayName", () => {
	it("returns name when present", () => {
		expect(displayName(makePast({ id: "a", name: "My Session" }))).toBe("My Session");
	});

	it("returns firstUserMessage truncated to 60 chars", () => {
		const short = "Hello world";
		expect(displayName(makePast({ id: "a", firstUserMessage: short }))).toBe(short);

		const long = "A".repeat(80);
		const result = displayName(makePast({ id: "a", firstUserMessage: long }));
		expect(result.length).toBe(60);
		expect(result).toBe("A".repeat(57) + "...");
	});

	it("returns short id when no name or message", () => {
		expect(displayName(makePast({ id: "abcdef1234567890" }))).toBe("34567890");
	});

	it("returns full id when id is 8 chars or fewer", () => {
		expect(displayName(makePast({ id: "short" }))).toBe("short");
	});
});

describe("shortCwd", () => {
	it("replaces /Users/ prefix with ~ and shows last two segments", () => {
		expect(shortCwd("/Users/dev/projects/myapp")).toBe("projects/myapp");
	});

	it("replaces /home/ prefix with ~ and shows last two segments", () => {
		expect(shortCwd("/home/dev/projects/myapp")).toBe("projects/myapp");
	});

	it("shows last two segments for deep paths", () => {
		expect(shortCwd("/opt/data/a/b/c")).toBe("b/c");
	});

	it("returns short paths unchanged", () => {
		expect(shortCwd("/tmp")).toBe("/tmp");
		expect(shortCwd("~/foo")).toBe("~/foo");
	});
});

describe("groupPast", () => {
	const NOW = new Date(2026, 8, 21, 14, 0, 0).getTime();

	it("groups sessions into Today", () => {
		const today = new Date(2026, 8, 21, 10, 0, 0).getTime();
		const entries = [makePast({ id: "a", modifiedAt: today })];
		const groups = groupPast(entries, NOW);
		expect(groups.length).toBe(1);
		expect(groups[0].dayLabel).toBe("Today");
		expect(groups[0].projects[0].sessions.length).toBe(1);
	});

	it("groups sessions into Yesterday", () => {
		const yesterday = new Date(2026, 8, 20, 23, 59, 0).getTime();
		const entries = [makePast({ id: "a", modifiedAt: yesterday })];
		const groups = groupPast(entries, NOW);
		expect(groups.length).toBe(1);
		expect(groups[0].dayLabel).toBe("Yesterday");
	});

	it("uses date string for older sessions", () => {
		const old = new Date(2026, 8, 15, 12, 0, 0).getTime();
		const entries = [makePast({ id: "a", modifiedAt: old })];
		const groups = groupPast(entries, NOW);
		expect(groups[0].dayLabel).toBe("2026-09-15");
	});

	it("midnight boundary: 00:01 today vs 23:59 yesterday", () => {
		const justAfterMidnight = new Date(2026, 8, 21, 0, 1, 0).getTime();
		const justBeforeMidnight = new Date(2026, 8, 20, 23, 59, 0).getTime();
		const entries = [
			makePast({ id: "a", modifiedAt: justAfterMidnight }),
			makePast({ id: "b", modifiedAt: justBeforeMidnight }),
		];
		const groups = groupPast(entries, NOW);
		expect(groups.length).toBe(2);
		expect(groups[0].dayLabel).toBe("Today");
		expect(groups[1].dayLabel).toBe("Yesterday");
	});

	it("groups by cwd within a day", () => {
		const ts = new Date(2026, 8, 21, 10, 0, 0).getTime();
		const entries = [
			makePast({ id: "a", modifiedAt: ts, cwd: "/Users/dev/alpha" }),
			makePast({ id: "b", modifiedAt: ts - 1000, cwd: "/Users/dev/beta" }),
			makePast({ id: "c", modifiedAt: ts - 2000, cwd: "/Users/dev/alpha" }),
		];
		const groups = groupPast(entries, NOW);
		expect(groups.length).toBe(1);
		expect(groups[0].projects.length).toBe(2);
		expect(groups[0].projects[0].sessions.length).toBe(2);
		expect(groups[0].projects[1].sessions.length).toBe(1);
	});

	it("handles missing cwd gracefully", () => {
		const ts = new Date(2026, 8, 21, 10, 0, 0).getTime();
		const entries = [makePast({ id: "a", modifiedAt: ts, cwd: "" })];
		const groups = groupPast(entries, NOW);
		expect(groups[0].projects[0].label).toBe("Unknown");
		expect(groups[0].projects[0].cwd).toBe(null);
	});

	it("orders newest day first", () => {
		const today = new Date(2026, 8, 21, 10, 0, 0).getTime();
		const old = new Date(2026, 8, 10, 10, 0, 0).getTime();
		const entries = [makePast({ id: "old", modifiedAt: old }), makePast({ id: "new", modifiedAt: today })];
		const groups = groupPast(entries, NOW);
		expect(groups[0].dayLabel).toBe("Today");
	});

	it("returns empty for empty input", () => {
		expect(groupPast([], NOW)).toEqual([]);
	});
});
