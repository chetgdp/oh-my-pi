import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { navigate, parseRoute, replaceWithCanonicalHash, subscribeRoute, syncRouteHistory } from "../src/lib/route";
import type { Route } from "../src/lib/route";

/**
 * Faithful minimal session history: pushState truncates forward entries and
 * fires no event; go() traverses asynchronously and fires popstate, plus
 * hashchange when the fragment differs (as browsers do).
 */
class FakeHistory {
	entries: { hash: string; state: unknown }[];
	index = 0;
	readonly listeners = new Map<string, Set<(e: unknown) => void>>();

	constructor(hashes: string[]) {
		this.entries = hashes.map(hash => ({ hash, state: null }));
		this.index = this.entries.length - 1;
	}
	get hash(): string {
		return this.entries[this.index]!.hash;
	}
	get state(): unknown {
		return this.entries[this.index]!.state;
	}
	get length(): number {
		return this.entries.length;
	}
	pushState(state: unknown, _unused: string, url?: string): void {
		this.entries = this.entries.slice(0, this.index + 1);
		this.entries.push({ hash: url ?? this.hash, state: structuredClone(state) });
		this.index += 1;
	}
	replaceState(state: unknown, _unused: string, url?: string): void {
		this.entries[this.index] = { hash: url ?? this.hash, state: structuredClone(state) };
	}
	go(delta: number): void {
		queueMicrotask(() => {
			const next = this.index + delta;
			if (next < 0 || next >= this.entries.length) return;
			const before = this.hash;
			this.index = next;
			this.fire("popstate");
			if (this.hash !== before) this.fire("hashchange");
		});
	}
	back(): void {
		this.go(-1);
	}
	fire(type: string): void {
		for (const l of this.listeners.get(type) ?? []) l({ type });
	}
}

const g = globalThis as Record<string, unknown>;
const saved: Record<string, unknown> = {};
const KEYS = ["history", "location", "addEventListener", "removeEventListener"];
let h: FakeHistory;
let unsubscribe: (() => void) | undefined;
let notified = 0;

function install(from: string[] | FakeHistory): void {
	h = Array.isArray(from) ? new FakeHistory(from) : from;
	const fake = h;
	g.history = fake;
	g.location = {
		get hash() {
			return fake.hash;
		},
	};
	g.addEventListener = (type: string, l: (e: unknown) => void) => {
		let set = fake.listeners.get(type);
		if (!set) fake.listeners.set(type, (set = new Set()));
		set.add(l);
	};
	g.removeEventListener = (type: string, l: (e: unknown) => void) => {
		fake.listeners.get(type)?.delete(l);
	};
	syncRouteHistory();
	unsubscribe?.();
	unsubscribe = subscribeRoute(() => {
		notified += 1;
	});
}

/** Let queued traversals settle. */
async function settle(): Promise<void> {
	for (let i = 0; i < 3; i++) await Promise.resolve();
}

const MAIN: Route = { kind: "session", id: "s1", panel: null };
const agent = (a: string): Route => ({ kind: "session", id: "s1", panel: "agent", agent: a });

beforeEach(() => {
	for (const k of KEYS) saved[k] = g[k];
	notified = 0;
});

afterEach(() => {
	unsubscribe?.();
	unsubscribe = undefined;
	for (const k of KEYS) g[k] = saved[k];
});

describe("replaceWithCanonicalHash", () => {
	test("legacy models link becomes the plain session route in place", () => {
		install(["#/", "#/s/s1/models"]);
		replaceWithCanonicalHash();
		expect(h.hash).toBe("#/s/s1");
		expect(h.entries.length).toBe(2);
		expect(notified).toBe(1);
		replaceWithCanonicalHash();
		expect(notified).toBe(1);
	});
});

describe("hierarchical navigate", () => {
	test("back after returning to main lands on sessions, not the agent", async () => {
		install(["#/"]);
		navigate(MAIN);
		navigate(agent("a"));
		expect(h.hash).toBe("#/s/s1/agent/a");
		navigate(MAIN);
		await settle();
		expect(h.hash).toBe("#/s/s1");
		expect(h.index).toBe(1);
		h.back();
		await settle();
		expect(h.hash).toBe("#/");
		expect(notified).toBeGreaterThan(0);
	});

	test("sibling agent switch replaces instead of stacking", async () => {
		install(["#/"]);
		navigate(MAIN);
		navigate(agent("a"));
		navigate(agent("b"));
		expect(h.length).toBe(3);
		expect(h.hash).toBe("#/s/s1/agent/b");
		h.back();
		await settle();
		expect(h.hash).toBe("#/s/s1");
	});

	test("deep link to agent: up replaces, then back leaves the app", async () => {
		install(["#external", "#/s/s1/agent/a"]);
		navigate(MAIN);
		await settle();
		expect(h.hash).toBe("#/s/s1");
		expect(h.length).toBe(2);
		h.back();
		await settle();
		expect(h.hash).toBe("#external");
		expect(h.entries.some(e => e.hash.includes("/agent/"))).toBe(false);
	});

	test("reload mid-stack keeps the parent entry", async () => {
		install(["#/"]);
		navigate(MAIN);
		navigate(agent("a"));
		// Reload: same entries and states, fresh listeners and seeding.
		const fake = h;
		unsubscribe?.();
		fake.listeners.clear();
		install(fake);
		expect(h.hash).toBe("#/s/s1/agent/a");
		navigate(MAIN);
		await settle();
		expect(h.index).toBe(1);
		h.back();
		await settle();
		expect(h.hash).toBe("#/");
	});

	test("panel open pushes, close steps back", async () => {
		install(["#/s/s1"]);
		navigate({ kind: "session", id: "s1", panel: "hub" });
		expect(h.length).toBe(2);
		navigate({ kind: "session", id: "s1", panel: "hub", agent: "x" });
		expect(h.length).toBe(2);
		navigate(MAIN);
		await settle();
		expect(h.index).toBe(0);
		expect(h.hash).toBe("#/s/s1");
	});

	test("focused todos is a child of the focused agent; two levels up uses go(-2)", async () => {
		install(["#/"]);
		navigate(MAIN);
		navigate(agent("a"));
		navigate({ ...agent("a"), todos: true } as Route);
		expect(h.length).toBe(4);
		navigate(agent("a"));
		await settle();
		expect(h.index).toBe(2);
		navigate({ ...agent("a"), todos: true } as Route);
		navigate(MAIN);
		await settle();
		expect(h.index).toBe(1);
		expect(parseRoute(h.hash)).toEqual(MAIN);
	});

	test("navigating to the current route is a no-op", () => {
		install(["#/s/s1"]);
		navigate(MAIN);
		expect(h.length).toBe(1);
		expect(notified).toBe(0);
	});
});
