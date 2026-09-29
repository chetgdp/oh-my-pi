import { win } from "./dom-setup";
import { beforeEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveSessionRow } from "../src/components/sessions/SessionRow";
import { computeUnread, markSeen, sortByActivity } from "../src/lib/unread";
import type { LiveSessionEntry } from "../src/server/live";

(globalThis as Record<string, unknown>).localStorage = win.localStorage;

function entry(id: string, assistantCount: number | null, lastActivityAt = 0): LiveSessionEntry {
	return {
		version: 1,
		instanceId: id,
		pid: 1,
		createdAt: 0,
		sessionId: `s-${id}`,
		sessionName: id,
		cwd: "/tmp",
		model: null,
		startedAt: 0,
		origin: "cli",
		recap: null,
		lastActivityAt,
		assistantCount,
	};
}

beforeEach(() => win.localStorage.clear());

describe("unread counts", () => {
	it("sets a baseline on first sighting without a badge", () => {
		expect(computeUnread([entry("a", 7)], null).get("s-a")).toBe(0);
	});

	it("counts new assistant messages after the baseline", () => {
		computeUnread([entry("a", 7)], null);
		expect(computeUnread([entry("a", 10)], null).get("s-a")).toBe(3);
	});

	it("clears after the session is opened", () => {
		computeUnread([entry("a", 2)], null);
		markSeen("s-a", 5);
		expect(computeUnread([entry("a", 5)], null).get("s-a")).toBe(0);
		expect(computeUnread([entry("a", 6)], null).get("s-a")).toBe(1);
	});

	it("keeps the current session marked seen", () => {
		computeUnread([entry("a", 2)], "a");
		expect(computeUnread([entry("a", 4)], "a").get("s-a")).toBe(0);
		expect(computeUnread([entry("a", 6)], null).get("s-a")).toBe(2);
	});

	it("shows nothing for a null count and never goes negative", () => {
		expect(computeUnread([entry("a", null)], null).get("s-a")).toBe(0);
		computeUnread([entry("b", 9)], null);
		expect(computeUnread([entry("b", 4)], null).get("s-b")).toBe(0);
	});

	it("prunes sessions that are no longer live", () => {
		computeUnread([entry("a", 1), entry("b", 1)], null);
		computeUnread([entry("a", 1)], null);
		expect(Object.keys(JSON.parse(win.localStorage.getItem("webgui.seen") ?? "{}"))).toEqual(["s-a"]);
	});
});

describe("sortByActivity", () => {
	it("orders by lastActivityAt descending without mutating input", () => {
		const input = [entry("a", 0, 1), entry("b", 0, 3), entry("c", 0, 2)];
		expect(sortByActivity(input).map(e => e.instanceId)).toEqual(["b", "c", "a"]);
		expect(input.map(e => e.instanceId)).toEqual(["a", "b", "c"]);
	});
});

describe("LiveSessionRow badge", () => {
	const render = (unread: number): string =>
		renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: entry("a", 0),
				current: false,
				unread,
				onAttach: () => {},
				onShutdown: () => {},
			}),
		);

	it("renders count, caps at 99+, and hides at zero", () => {
		expect(render(3)).toContain('aria-label="3 unread"');
		expect(render(150)).toContain(">99+<");
		expect(render(0)).not.toContain("ses-unread");
	});
});
