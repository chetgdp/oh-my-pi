import { afterEach, describe, expect, it, jest } from "bun:test";
import { LazyModule } from "../src/lib/lazy-module";

const CHUNK_ERROR = "Failed to fetch dynamically imported module";

afterEach(() => {
	jest.useRealTimers();
});

describe("LazyModule", () => {
	it("does not cache a failed import; the next load imports again", async () => {
		let calls = 0;
		const mod = new LazyModule(async () => {
			calls++;
			if (calls === 1) throw new Error(CHUNK_ERROR);
			return { value: 42 };
		});
		await expect(mod.load()).rejects.toThrow(CHUNK_ERROR);
		expect(mod.value).toBeNull();
		expect(await mod.load()).toEqual({ value: 42 });
		expect(mod.value).toEqual({ value: 42 });
		expect(calls).toBe(2);
	});

	it("retries a failed request on its own and notifies subscribers", async () => {
		jest.useFakeTimers();
		let calls = 0;
		const loaded = Promise.withResolvers<void>();
		const mod = new LazyModule(async () => {
			calls++;
			if (calls === 1) throw new Error(CHUNK_ERROR);
			return "loaded";
		});
		let notified = 0;
		mod.subscribe(() => {
			notified++;
			loaded.resolve();
		});
		await mod.load().catch(() => {});
		expect(calls).toBe(1);
		jest.advanceTimersByTime(1000);
		await loaded.promise;
		expect(mod.snapshot()).toBe("loaded");
		expect(calls).toBe(2);
		expect(notified).toBe(1);
	});

	it("shares one in-flight import between callers", async () => {
		let calls = 0;
		const gate = Promise.withResolvers<number>();
		const mod = new LazyModule(() => {
			calls++;
			return gate.promise;
		});
		const all = Promise.all([mod.load(), mod.load(), mod.load()]);
		mod.request();
		gate.resolve(1);
		expect(await all).toEqual([1, 1, 1]);
		expect(calls).toBe(1);
	});
});
