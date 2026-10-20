import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { dismissNotice, getNotices, INFO_TTL_MS, notify, resetNotices } from "../src/lib/notify";

describe("notify", () => {
	beforeEach(() => resetNotices());
	afterEach(() => {
		resetNotices();
		vi.useRealTimers();
	});

	it("info clears after its TTL; error stays until dismissed", () => {
		vi.useFakeTimers();
		notify("error", "boom");
		notify("info", "saved");
		expect(getNotices().map(n => n.message)).toEqual(["boom", "saved"]);
		vi.advanceTimersByTime(INFO_TTL_MS - 1);
		expect(getNotices()).toHaveLength(2);
		vi.advanceTimersByTime(1);
		expect(getNotices().map(n => n.message)).toEqual(["boom"]);
		vi.advanceTimersByTime(60_000);
		expect(getNotices().map(n => n.message)).toEqual(["boom"]);
		dismissNotice(getNotices()[0]!.id);
		expect(getNotices()).toEqual([]);
	});

	it("dedupes identical notices and keeps the newest three", () => {
		notify("error", "a");
		notify("error", "a");
		notify("error", "b");
		notify("error", "c");
		notify("error", "d");
		expect(getNotices().map(n => n.message)).toEqual(["b", "c", "d"]);
		expect(getNotices().at(-1)?.message).toBe("d");
	});
});
