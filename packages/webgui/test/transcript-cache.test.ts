import {
	IDBKeyRange as FakeKeyRange,
	IDBObjectStore as FakeObjectStore,
	indexedDB as fakeIndexedDB,
} from "fake-indexeddb";
import { NativeEvent, win } from "./dom-setup";
import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createStore, get, set } from "idb-keyval";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import type { RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import { RpcCommandError } from "../src/lib/rpc-client";
import { createTranscriptCache } from "../src/lib/transcript-cache";
import { createSessionStore } from "../src/lib/session-store";
beforeEach(() => {
	win.localStorage.clear();
});
// fake-indexeddb setup as in drafts.test.ts (not fake-indexeddb/auto)
Object.assign(globalThis, { indexedDB: fakeIndexedDB, IDBKeyRange: FakeKeyRange, localStorage: win.localStorage });

let dbCounter = 0;
function uniqueDbName(): string {
	return `test-transcripts-${++dbCounter}`;
}

function makeEntry(id: string, parentId: string | null = null): SessionEntry {
	return {
		id,
		parentId,
		type: "message",
		timestamp: new Date().toISOString(),
		message: { role: "user", content: `msg ${id}` },
	} as unknown as SessionEntry;
}

class FakeRpcClient {
	state: RpcConnectionState = "ready";
	sessionState = {
		sessionId: "sess-1",
		sessionFile: "/tmp/session.json",
		sessionName: "Test Session",
		isStreaming: false,
	};

	#eventListeners: Array<(e: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];
	#resyncListeners: Array<(s: typeof this.sessionState) => void> = [];

	historyLog: Array<{ before?: string; after?: string; leafId?: string; limit?: number }> = [];
	historyResolvers: Array<{ resolve: (v: RpcV3HistoryResult) => void; reject: (e: Error) => void }> = [];

	history(
		opts: { before?: string; after?: string; leafId?: string; limit?: number } = {},
	): Promise<RpcV3HistoryResult> {
		this.historyLog.push(opts);
		const { promise, resolve, reject } = Promise.withResolvers<RpcV3HistoryResult>();
		this.historyResolvers.push({ resolve, reject });
		return promise;
	}

	resolveHistory(index: number, value: RpcV3HistoryResult): void {
		this.historyResolvers[index]?.resolve(value);
	}

	rejectHistory(index: number, err: Error): void {
		this.historyResolvers[index]?.reject(err);
	}
	requestLog: Array<{ type: string }> = [];
	requestResolvers: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];

	request(cmd: { type: string }): Promise<unknown> {
		this.requestLog.push({ type: cmd.type });
		if (cmd.type === "get_state") {
			return Promise.resolve({ data: this.sessionState });
		}
		const { promise, resolve, reject } = Promise.withResolvers<unknown>();
		this.requestResolvers.push({ resolve, reject });
		return promise;
	}

	resolveRequest(index: number, value: unknown): void {
		this.requestResolvers[index]?.resolve(value);
	}

	onEvent(fn: (e: RpcSessionEvent) => void): () => void {
		this.#eventListeners.push(fn);
		return () => {
			const idx = this.#eventListeners.indexOf(fn);
			if (idx !== -1) this.#eventListeners.splice(idx, 1);
		};
	}

	onStateChange(fn: (s: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(fn);
		return () => {
			const idx = this.#stateListeners.indexOf(fn);
			if (idx !== -1) this.#stateListeners.splice(idx, 1);
		};
	}

	onResync(fn: (s: typeof this.sessionState) => void): () => void {
		this.#resyncListeners.push(fn);
		return () => {
			const idx = this.#resyncListeners.indexOf(fn);
			if (idx !== -1) this.#resyncListeners.splice(idx, 1);
		};
	}

	emitEvent(event: RpcSessionEvent): void {
		for (const fn of this.#eventListeners.slice()) fn(event);
	}

	emitResync(state = this.sessionState): void {
		for (const fn of this.#resyncListeners.slice()) fn(state);
	}
}

async function flushAsync(): Promise<void> {
	// idb-keyval and fake-indexeddb dispatch operations via setTimeout/setImmediate/indexedDB transactions
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, 15);
	await promise;
}

describe("transcript cache unit & lifecycle", () => {
	it("trims entries to 200 max per session and evicts to 10 sessions max", async () => {
		const dbName = uniqueDbName();
		let simulatedTime = 1_000_000;
		const cache = createTranscriptCache({
			dbName,
			now: () => simulatedTime,
			listenLifecycle: false,
		});

		// 1. Verify entry trimming to 200
		const entries250 = Array.from({ length: 250 }, (_, i) => makeEntry(`e-${i}`, i > 0 ? `e-${i - 1}` : null));
		cache.saveSessionThrottled("sess-trim", {
			leafId: "e-249",
			entries: entries250,
			hasMore: false,
		});
		await cache.flush();

		const loadedTrimmed = await cache.loadSession("sess-trim");
		expect(loadedTrimmed).not.toBeNull();
		expect(loadedTrimmed!.entries.length).toBe(200);
		expect(loadedTrimmed!.entries[0].id).toBe("e-50");
		expect(loadedTrimmed!.entries[199].id).toBe("e-249");
		expect(loadedTrimmed!.hasMore).toBe(true); // Server said false, but trimming flipped it to true

		// 2. Verify session count capping at 10 (most recently saved kept)
		for (let s = 1; s <= 12; s++) {
			simulatedTime += 1000;
			cache.saveSessionThrottled(`sess-${s}`, {
				leafId: `leaf-${s}`,
				entries: [makeEntry(`e-${s}`)],
				hasMore: false,
			});
		}
		await cache.flush();

		// sess-trim and sess-1 should have been evicted (oldest savedAt)
		expect(await cache.loadSession("sess-trim")).toBeNull();
		expect(await cache.loadSession("sess-1")).toBeNull();
		// newer sessions exist
		expect(await cache.loadSession("sess-12")).not.toBeNull();
		expect(await cache.loadSession("sess-3")).not.toBeNull();
	});

	it("expires sessions older than 7 days", async () => {
		const dbName = uniqueDbName();
		let simulatedTime = 10_000_000;
		const cache = createTranscriptCache({
			dbName,
			now: () => simulatedTime,
			listenLifecycle: false,
		});

		cache.saveSessionThrottled("sess-expire", {
			leafId: "l1",
			entries: [makeEntry("e1")],
			hasMore: false,
		});
		await cache.flush();

		expect(await cache.loadSession("sess-expire")).not.toBeNull();

		// Advance time by 8 days
		simulatedTime += 8 * 24 * 60 * 60 * 1000;
		expect(await cache.loadSession("sess-expire")).toBeNull();
	});

	it("write localStorage index only after IDB record commits", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		cache.saveSessionThrottled("sess-atomic", {
			leafId: "l1",
			entries: [makeEntry("e1")],
			hasMore: false,
		});

		// Before flush: pending save exists, but index is not yet committed
		expect(cache.readIndex({ sessionId: "sess-atomic" })).toBeNull();

		await cache.flush();

		// After flush: IDB record and index both exist
		expect(cache.readIndex({ sessionId: "sess-atomic" })).toEqual({ sessionId: "sess-atomic", leafId: "l1" });
		expect(await cache.loadSession("sess-atomic")).not.toBeNull();
	});

	it("dropSession during flush cancels index write and removes record", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		cache.saveSessionThrottled("sess-race", {
			leafId: "l1",
			entries: [makeEntry("e1")],
			hasMore: false,
		});

		// Start flush and drop session concurrently
		const flushPromise = cache.flush();
		await cache.dropSession("sess-race");
		await flushPromise;

		// After flush completes, tombstone prevented index resurrection and record is deleted
		expect(cache.readIndex({ sessionId: "sess-race" })).toBeNull();
		expect(await cache.loadSession("sess-race")).toBeNull();
	});

	it("prunes index keys on missing session and bounds session by serialized size", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		// 1. Manually set index for non-existent session, loadSession prunes it
		cache.setIndex({ sessionId: "sess-missing", leafId: "l-missing" });
		expect(cache.readIndex({ sessionId: "sess-missing" })).not.toBeNull();
		expect(await cache.loadSession("sess-missing")).toBeNull();
		expect(cache.readIndex({ sessionId: "sess-missing" })).toBeNull();

		// 2. Transcripts exceeding ~2MB serialized are skipped
		const hugeString = "x".repeat(2 * 1024 * 1024 + 100);
		const hugeEntry = {
			id: "e-huge",
			parentId: null,
			type: "message",
			timestamp: new Date().toISOString(),
			message: { role: "user", content: hugeString },
		} as unknown as SessionEntry;

		cache.saveSessionThrottled("sess-huge", {
			leafId: "e-huge",
			entries: [hugeEntry],
			hasMore: false,
		});
		await cache.flush();

		expect(cache.readIndex({ sessionId: "sess-huge" })).toBeNull();
		expect(await cache.loadSession("sess-huge")).toBeNull();
	});
});

describe("session store transcript cache integration", () => {
	it("cold attach with cache sends history {after: cachedLeaf} and applies delta", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		// Seed cache
		const initialEntries = [makeEntry("e1"), makeEntry("e2", "e1")];
		cache.saveSessionThrottled(
			"sess-1",
			{
				leafId: "e2",
				entries: initialEntries,
				hasMore: false,
			},
			"inst-1",
		);
		await cache.flush();

		const client = new FakeRpcClient();
		const store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});

		// First request should carry {after: 'e2'}
		expect(client.historyLog).toHaveLength(1);
		expect(client.historyLog[0]).toEqual({ after: "e2" });

		// Delta returns entries after e2
		const deltaEntries = [makeEntry("e3", "e2")];
		client.resolveHistory(0, {
			leafId: "e3",
			entries: deltaEntries,
			hasMore: false,
			live: [],
			after: "e2",
		});
		await flushAsync();

		const snap = store.getSnapshot();
		expect(snap.historyLoaded).toBe(true);
		expect(snap.transcript.entries.map(e => e.id)).toEqual(["e1", "e2", "e3"]);
		expect(snap.transcript.leafId).toBe("e3");
	});

	it("reconnect sends history {after: currentLeafId}", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		const client = new FakeRpcClient();
		const store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});

		// 1. Initial cold attach with no cache -> newest page
		expect(client.historyLog[0]).toEqual({});
		client.resolveHistory(0, {
			leafId: "e1",
			entries: [makeEntry("e1")],
			hasMore: false,
			live: [],
		});
		await flushAsync();

		expect(store.getSnapshot().transcript.leafId).toBe("e1");

		// 2. Reconnect triggers resync
		client.emitResync();
		await flushAsync();

		expect(client.historyLog).toHaveLength(2);
		expect(client.historyLog[1]).toEqual({ after: "e1" });

		// Resolve delta
		client.resolveHistory(1, {
			leafId: "e2",
			entries: [makeEntry("e2", "e1")],
			hasMore: false,
			live: [],
			after: "e1",
		});
		await flushAsync();

		expect(store.getSnapshot().transcript.entries.map(e => e.id)).toEqual(["e1", "e2"]);
	});

	it("result without after falls back to replace newest page", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		// Seed cache
		cache.saveSessionThrottled(
			"sess-1",
			{
				leafId: "e1",
				entries: [makeEntry("e1")],
				hasMore: false,
			},
			"inst-1",
		);
		await cache.flush();

		const client = new FakeRpcClient();
		const store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});

		expect(client.historyLog[0]).toEqual({ after: "e1" });

		// Host doesn't support after or returns full page without `after`
		client.resolveHistory(0, {
			leafId: "full-2",
			entries: [makeEntry("full-1"), makeEntry("full-2", "full-1")],
			hasMore: false,
			live: [],
		});
		await flushAsync();

		const snap = store.getSnapshot();
		expect(snap.transcript.entries.map(e => e.id)).toEqual(["full-1", "full-2"]);
		expect(snap.transcript.leafId).toBe("full-2");
	});

	it("branch frame and branch_changed error drop cache and refetch newest", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		const client = new FakeRpcClient();
		const store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});

		// 1. Initial page
		client.resolveHistory(0, {
			leafId: "e1",
			entries: [makeEntry("e1")],
			hasMore: true,
			live: [],
		});
		await flushAsync();
		await cache.flush();

		expect(await cache.loadSession("sess-1")).not.toBeNull();

		// 2. Branch frame arrives -> drops cache
		client.emitEvent({ type: "branch", leafId: "branch-leaf" } as unknown as RpcSessionEvent);
		await flushAsync();

		expect(await cache.loadSession("sess-1")).toBeNull();
		// Next history fetch is newest page without after
		expect(client.historyLog).toHaveLength(2);
		expect(client.historyLog[1]).toEqual({});

		client.resolveHistory(1, {
			leafId: "branch-leaf",
			entries: [makeEntry("branch-leaf")],
			hasMore: true,
			live: [],
		});
		await flushAsync();
		await cache.flush();

		// 3. Request older page, server responds branch_changed
		void store.loadOlder();
		expect(client.historyLog).toHaveLength(3);
		expect(client.historyLog[2]).toEqual({ before: "branch-leaf", leafId: "branch-leaf", limit: 50 });

		client.rejectHistory(2, new RpcCommandError("history", "branch_changed", "branch_changed"));
		await flushAsync();

		// Cache dropped and refetches newest
		expect(await cache.loadSession("sess-1")).toBeNull();
		expect(client.historyLog).toHaveLength(4);
		expect(client.historyLog[3]).toEqual({});
	});

	it("scroll loadOlder keeps working from cached entries (before = oldest cached id)", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		// Seed cache with 2 entries
		cache.saveSessionThrottled(
			"sess-1",
			{
				leafId: "e2",
				entries: [makeEntry("e1"), makeEntry("e2", "e1")],
				hasMore: true,
			},
			"inst-1",
		);
		await cache.flush();

		const client = new FakeRpcClient();
		const store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});

		// Delta resolves with 0 new entries
		client.resolveHistory(0, {
			leafId: "e2",
			entries: [],
			hasMore: false,
			live: [],
			after: "e2",
		});
		await flushAsync();

		expect(store.getSnapshot().transcript.entries.map(e => e.id)).toEqual(["e1", "e2"]);
		expect(store.getSnapshot().transcript.hasMore).toBe(true);

		// Now scroll up: loadOlder() should query before = 'e1' (oldest cached id)
		void store.loadOlder();
		expect(client.historyLog).toHaveLength(2);
		expect(client.historyLog[1]).toEqual({ before: "e1", leafId: "e2", limit: 50 });

		// Resolve older page
		client.resolveHistory(1, {
			leafId: "e2",
			entries: [makeEntry("e0")],
			hasMore: false,
			live: [],
		});
		await flushAsync();

		expect(store.getSnapshot().transcript.entries.map(e => e.id)).toEqual(["e0", "e1", "e2"]);
	});

	it("0: persists cache once get_state resolves when history resolved first", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		const client = new FakeRpcClient();
		// Make get_state pending initially
		const getStateDefer = Promise.withResolvers<unknown>();
		client.request = (cmd: { type: string }) => {
			client.requestLog.push({ type: cmd.type });
			if (cmd.type === "get_state") {
				return getStateDefer.promise;
			}
			const { promise, resolve, reject } = Promise.withResolvers<unknown>();
			client.requestResolvers.push({ resolve, reject });
			return promise;
		};

		const _store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});
		// History resolves first
		client.resolveHistory(0, {
			leafId: "e1",
			entries: [makeEntry("e1")],
			hasMore: false,
			live: [],
		});
		await flushAsync();

		// Before get_state resolves, sessionState is not known; persistCache must not save
		await cache.flush();
		expect(await cache.loadSession("sess-1")).toBeNull();

		// Now get_state resolves
		getStateDefer.resolve({ data: { sessionId: "sess-1", isStreaming: false } });
		await flushAsync();
		await cache.flush();

		// Cache is persisted once sessionId is known
		const loaded = await cache.loadSession("sess-1");
		expect(loaded).not.toBeNull();
		expect(loaded!.leafId).toBe("e1");
	});

	it("1: delta merge inserts delta after page.after preserving pre-existing newer frames", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		// Seed cache with [L]
		cache.saveSessionThrottled(
			"sess-1",
			{
				leafId: "L",
				entries: [makeEntry("L")],
				hasMore: false,
			},
			"inst-1",
		);
		await cache.flush();

		const client = new FakeRpcClient();
		const store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});

		// History request {after: 'L'} is sent
		expect(client.historyLog[0]).toEqual({ after: "L" });

		// Entry frame E3 arrives BEFORE history {after: 'L'} resolves
		client.emitEvent({
			type: "entry",
			entry: makeEntry("E3", "E2"),
		} as unknown as RpcSessionEvent);
		await flushAsync();

		// Transcript currently has [L, E3] (from cache load + early frame) or [E3]
		// Now history resolves with delta [E1, E2, E3]
		client.resolveHistory(0, {
			leafId: "E3",
			entries: [makeEntry("E1", "L"), makeEntry("E2", "E1"), makeEntry("E3", "E2")],
			hasMore: false,
			live: [],
			after: "L",
		});
		await flushAsync();

		const snap = store.getSnapshot();
		expect(snap.transcript.entries.map(e => e.id)).toEqual(["L", "E1", "E2", "E3"]);
		expect(snap.transcript.leafId).toBe("E3");
	});

	it("1: cold path seeds cache when in-memory entry is covered by delta", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		// Cache has [C1, C2]
		cache.saveSessionThrottled(
			"sess-1",
			{
				leafId: "C2",
				entries: [makeEntry("C1"), makeEntry("C2", "C1")],
				hasMore: false,
			},
			"inst-1",
		);
		await cache.flush();

		const client = new FakeRpcClient();
		const store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});

		// Frame E3 arrives before delta resolves
		client.emitEvent({
			type: "entry",
			entry: makeEntry("E3", "C2"),
		} as unknown as RpcSessionEvent);
		await flushAsync();

		// Delta arrives containing E3
		client.resolveHistory(0, {
			leafId: "E3",
			entries: [makeEntry("E3", "C2")],
			hasMore: false,
			live: [],
			after: "C2",
		});
		await flushAsync();

		const snap = store.getSnapshot();
		// Cached history [C1, C2] must NOT be discarded!
		expect(snap.transcript.entries.map(e => e.id)).toEqual(["C1", "C2", "E3"]);
	});

	it("2: does not persist cache while needsReload is true", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		const client = new FakeRpcClient();
		const _store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});
		client.resolveHistory(0, {
			leafId: "e1",
			entries: [makeEntry("e1")],
			hasMore: false,
			live: [],
		});
		await flushAsync();
		await cache.flush();
		expect(await cache.loadSession("sess-1")).not.toBeNull();

		// Branch event triggers needsReload
		client.emitEvent({ type: "branch", leafId: "b-leaf" } as unknown as RpcSessionEvent);
		await flushAsync();

		// An entry event arrives while reload is pending (needsReload is true)
		client.emitEvent({
			type: "entry",
			entry: makeEntry("stale-entry"),
		} as unknown as RpcSessionEvent);
		await flushAsync();
		await cache.flush();

		// Cache must remain dropped (not resurrected with stale entries)
		expect(await cache.loadSession("sess-1")).toBeNull();
	});

	it("4: races IDB load against 500ms timeout and falls through to newest page on hang", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });

		// Set index so cold attach tries to load
		cache.setIndex({ instanceId: "inst-hang", sessionId: "sess-hang", leafId: "l-hang" });
		// Simulate hanging loadSession (never resolves)
		const hangP = Promise.withResolvers<null>().promise;
		cache.loadSession = () => hangP;

		const client = new FakeRpcClient();
		const _store = createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-hang",
			cache,
		});
		// First request is after: l-hang
		expect(client.historyLog[0]).toEqual({ after: "l-hang" });

		client.resolveHistory(0, {
			leafId: "l-hang",
			entries: [],
			hasMore: false,
			live: [],
			after: "l-hang",
		});
		// Wait for the 500ms timeout race (wall-clock timer needed to test real 500ms race against hanging load)
		const { promise: delayP, resolve: resolveDelay } = Promise.withResolvers<void>();
		setTimeout(resolveDelay, 550);
		await delayP;
		await flushAsync();
		// Because IDB timed out, it fell back to fetchNewestPage!
		expect(client.historyLog).toHaveLength(2);
		expect(client.historyLog[1]).toEqual({});
	});

	async function expectNeverCachedOnColdLoad(dbName: string): Promise<void> {
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		const client = new FakeRpcClient();
		createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});
		expect(client.historyLog[0]).toEqual({});
		client.resolveHistory(0, { leafId: "e9", entries: [makeEntry("e9")], hasMore: false, live: [] });
		await flushAsync();
		await cache.flush();
		expect(await cache.loadSession("sess-1")).toBeNull();
		expect(cache.readIndex({ sessionId: "sess-1" })).toBeNull();
		expect(win.localStorage.getItem("webgui.transcriptIndex") ?? "").not.toContain("hunter2");
	}

	it("history page flagged secrets drops cache and blocks caching for later stores", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		cache.saveSessionThrottled("sess-1", { leafId: "e1", entries: [makeEntry("e1")], hasMore: false }, "inst-1");
		await cache.flush();

		const client = new FakeRpcClient();
		createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});
		expect(client.historyLog[0]).toEqual({ after: "e1" });
		client.resolveHistory(0, {
			leafId: "e2",
			entries: [makeEntry("e2", "e1")],
			hasMore: false,
			live: [],
			after: "e1",
			secrets: true,
		});
		await flushAsync();
		await cache.flush();
		expect(await cache.loadSession("sess-1")).toBeNull();
		expect(cache.readIndex({ instanceId: "inst-1" })).toBeNull();

		await expectNeverCachedOnColdLoad(dbName);
	});

	it("entry frame flagged secrets drops cache and blocks caching for later stores", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		const client = new FakeRpcClient();
		createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});
		client.resolveHistory(0, { leafId: "e1", entries: [makeEntry("e1")], hasMore: false, live: [] });
		await flushAsync();
		await cache.flush();
		expect(await cache.loadSession("sess-1")).not.toBeNull();

		client.emitEvent({ type: "entry", entry: makeEntry("e2", "e1"), secrets: true } as unknown as RpcSessionEvent);
		await flushAsync();
		await cache.flush();
		expect(await cache.loadSession("sess-1")).toBeNull();

		await expectNeverCachedOnColdLoad(dbName);
	});

	it("secrets flagged on the first page, before get_state names the session, still block caching", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		const client = new FakeRpcClient();
		const getStateDefer = Promise.withResolvers<unknown>();
		client.request = (cmd: { type: string }) => {
			client.requestLog.push({ type: cmd.type });
			if (cmd.type === "get_state") return getStateDefer.promise;
			const { promise, resolve, reject } = Promise.withResolvers<unknown>();
			client.requestResolvers.push({ resolve, reject });
			return promise;
		};
		createSessionStore(client as unknown as Parameters<typeof createSessionStore>[0], {
			instanceId: "inst-1",
			cache,
		});
		client.resolveHistory(0, {
			leafId: "e1",
			entries: [makeEntry("e1")],
			hasMore: false,
			live: [],
			secrets: true,
		});
		await flushAsync();
		getStateDefer.resolve({ data: { sessionId: "sess-1", isStreaming: false } });
		await flushAsync();
		await cache.flush();
		expect(await cache.loadSession("sess-1")).toBeNull();

		await expectNeverCachedOnColdLoad(dbName);
	});
});

describe("transcript cache index and eviction", () => {
	it("deletes orphan IDB records that no index entry references", async () => {
		const dbName = uniqueDbName();
		const store = createStore(dbName, "transcripts");
		await set("orphan", { leafId: null, entries: [], hasMore: false, savedAt: Date.now() }, store);
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		cache.saveSessionThrottled("sess-a", { leafId: "e1", entries: [makeEntry("e1")], hasMore: false });
		await cache.flush();
		expect(await get("orphan", store)).toBeUndefined();
		expect(await get("sess-a", store)).toBeDefined();
	});

	it("tolerates an index without savedAt and keeps its records", async () => {
		const dbName = uniqueDbName();
		const store = createStore(dbName, "transcripts");
		await set("sess-old", { leafId: "o1", entries: [makeEntry("o1")], hasMore: false, savedAt: Date.now() }, store);
		win.localStorage.setItem(
			"webgui.transcriptIndex",
			JSON.stringify({ byInstance: {}, bySession: { "sess-old": "o1" }, noCache: [] }),
		);
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		expect(cache.readIndex({ sessionId: "sess-old" })).toEqual({ sessionId: "sess-old", leafId: "o1" });
		cache.saveSessionThrottled("sess-new", { leafId: "n1", entries: [makeEntry("n1")], hasMore: false });
		await cache.flush();
		expect(await get("sess-old", store)).toBeDefined();
		const payload = JSON.parse(win.localStorage.getItem("webgui.transcriptIndex") ?? "{}");
		expect(typeof payload.savedAt["sess-old"]).toBe("number");
		expect(typeof payload.savedAt["sess-new"]).toBe("number");
	});

	it("steady-state flush neither reads full records nor re-parses the index", async () => {
		const dbName = uniqueDbName();
		const cache = createTranscriptCache({ dbName, listenLifecycle: false });
		const entriesList = [makeEntry("e1")];
		cache.saveSessionThrottled("sess-a", { leafId: "e1", entries: entriesList, hasMore: false });
		await cache.flush();
		const getItem = spyOn(win.localStorage, "getItem");
		const getAll = spyOn(FakeObjectStore.prototype, "getAll");
		const openCursor = spyOn(FakeObjectStore.prototype, "openCursor");
		const getAllKeys = spyOn(FakeObjectStore.prototype, "getAllKeys");
		try {
			cache.saveSessionThrottled("sess-a", {
				leafId: "e2",
				entries: [...entriesList, makeEntry("e2")],
				hasMore: false,
			});
			await cache.flush();
			expect(getItem).not.toHaveBeenCalled();
			expect(getAll).not.toHaveBeenCalled();
			expect(openCursor).not.toHaveBeenCalled();
			expect(getAllKeys).not.toHaveBeenCalled();
			expect(cache.readIndex({ sessionId: "sess-a" })?.leafId).toBe("e2");
		} finally {
			getItem.mockRestore();
			getAll.mockRestore();
			openCursor.mockRestore();
			getAllKeys.mockRestore();
		}
	});

	it("re-reads the index after a storage event from another tab", () => {
		const cache = createTranscriptCache({ dbName: uniqueDbName(), listenLifecycle: false });
		expect(cache.readIndex({ sessionId: "sess-x" })).toBeNull();
		win.localStorage.setItem(
			"webgui.transcriptIndex",
			JSON.stringify({ byInstance: {}, bySession: { "sess-x": "x1" }, noCache: [], savedAt: {} }),
		);
		(globalThis as unknown as EventTarget).dispatchEvent(
			Object.assign(new NativeEvent("storage"), { key: "webgui.transcriptIndex" }),
		);
		expect(cache.readIndex({ sessionId: "sess-x" })?.leafId).toBe("x1");
	});

	it("enforces the 2MB serialized cap exactly at the boundary", async () => {
		const dbName = uniqueDbName();
		const store = createStore(dbName, "transcripts");
		const cache = createTranscriptCache({ dbName, now: () => 1_000, listenLifecycle: false });
		const big = (id: string, len: number): SessionEntry =>
			({
				id,
				parentId: null,
				type: "message",
				timestamp: "t",
				message: { role: "user", content: "z".repeat(len) },
			}) as unknown as SessionEntry;
		const probe = [big("a", 10), big("b", 10)];
		const overhead = JSON.stringify({ leafId: "b", entries: probe, hasMore: false, savedAt: 1_000 }).length - 20;
		const fit = [big("a", 10), big("b", 2 * 1024 * 1024 - overhead - 10)];
		cache.saveSessionThrottled("fits", { leafId: "b", entries: fit, hasMore: false });
		cache.saveSessionThrottled("over", { leafId: "b", entries: [big("a", 11), fit[1]], hasMore: false });
		await cache.flush();
		expect(JSON.stringify(await get("fits", store)).length).toBe(2 * 1024 * 1024);
		expect(await get("over", store)).toBeUndefined();
	});
});
