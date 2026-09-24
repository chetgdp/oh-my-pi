import { describe, expect, it } from "bun:test";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import { RpcCommandError } from "../src/lib/rpc-client";
import type { RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import type {
	RpcSessionState,
	RpcModelBrowserResult,
	RpcModelRolesResult,
	RpcAgentsResult,
	RpcAgentInfo,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";

// Store reload cycles chain through several awaits (doReload -> runHistoryCycle -> finally).
async function flush(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

function makeAssistantMessage(
	content: string | AssistantMessage["content"] = [],
	overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
	const normalizedContent: AssistantMessage["content"] =
		typeof content === "string" ? [{ type: "text", text: content }] : content;
	return {
		role: "assistant",
		content: normalizedContent,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
			},
		},
		stopReason: "stop",
		timestamp: Date.now(),
		...overrides,
	};
}

// -------------------------------------------------------------------
// Fake client implementing the surface createSessionStore uses
// -------------------------------------------------------------------

class FakeClient {
	state: RpcConnectionState = "ready";
	sessionState: RpcSessionState | null = null;

	#eventListeners: Array<(e: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];
	#resyncListeners: Array<(s: RpcSessionState) => void> = [];

	// Track requests issued by the store
	requestLog: Array<{ type: string }> = [];
	requestResolvers: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];
	historyLog: Array<{ before?: string; leafId?: string; limit?: number }> = [];
	historyResolvers: Array<{ resolve: (v: RpcV3HistoryResult) => void; reject: (e: Error) => void }> = [];

	history(opts: { before?: string; leafId?: string; limit?: number } = {}): Promise<RpcV3HistoryResult> {
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

	onEvent(fn: (e: RpcSessionEvent) => void): () => void {
		this.#eventListeners.push(fn);
		return () => {
			const i = this.#eventListeners.indexOf(fn);
			if (i !== -1) this.#eventListeners.splice(i, 1);
		};
	}

	onStateChange(fn: (s: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(fn);
		return () => {
			const i = this.#stateListeners.indexOf(fn);
			if (i !== -1) this.#stateListeners.splice(i, 1);
		};
	}

	onResync(fn: (s: RpcSessionState) => void): () => void {
		this.#resyncListeners.push(fn);
		return () => {
			const i = this.#resyncListeners.indexOf(fn);
			if (i !== -1) this.#resyncListeners.splice(i, 1);
		};
	}

	request(cmd: { type: string }): Promise<unknown> {
		this.requestLog.push({ type: cmd.type });
		const { promise, resolve, reject } = Promise.withResolvers<unknown>();
		this.requestResolvers.push({ resolve, reject });
		return promise;
	}

	emitEvent(event: RpcSessionEvent): void {
		for (const fn of this.#eventListeners) fn(event);
	}

	emitStateChange(s: RpcConnectionState): void {
		for (const fn of this.#stateListeners) fn(s);
	}

	emitResync(state: RpcSessionState): void {
		for (const fn of this.#resyncListeners) {
			fn(state);
		}
	}

	get eventListenerCount(): number {
		return this.#eventListeners.length;
	}
	get stateListenerCount(): number {
		return this.#stateListeners.length;
	}
	get resyncListenerCount(): number {
		return this.#resyncListeners.length;
	}

	/** Resolve the Nth pending request (0-indexed). */
	resolveRequest(index: number, value: unknown): void {
		this.requestResolvers[index]?.resolve(value);
	}
	rejectRequest(index: number, err: Error): void {
		this.requestResolvers[index]?.reject(err);
	}
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function makeSessionState(overrides?: Partial<RpcSessionState>): RpcSessionState {
	return {
		isStreaming: false,
		isCompacting: false,
		steeringMode: "all",
		followUpMode: "all",
		interruptMode: "immediate",
		sessionId: "test-session",
		autoCompactionEnabled: false,
		fastModeEnabled: false,
		fastModeActive: false,
		tokensPerSecond: null,
		messageCount: 0,
		queuedMessageCount: 0,
		todoPhases: [],
		thinkingLevel: undefined,
		...overrides,
	} as RpcSessionState;
}

function asClient(client: FakeClient): Parameters<typeof createSessionStore>[0] {
	return client as unknown as Parameters<typeof createSessionStore>[0];
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe("createSessionStore", () => {
	it("initializes snapshot with empty transcript and loads history on attach", async () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();

		const store = createSessionStore(asClient(client));
		const snap = store.getSnapshot();

		expect(snap.connection).toBe("ready");
		expect(snap.sessionState).toBe(client.sessionState);
		expect(snap.transcript.entries.length).toBe(0);
		expect(snap.streaming).toBe(false);
		expect(snap.stats).toBe(null);
		expect(snap.commands).toEqual([]);

		expect(client.historyLog).toHaveLength(1);
		client.resolveHistory(0, {
			leafId: "l1",
			entries: [
				{
					id: "e1",
					parentId: null,
					type: "message",
					timestamp: "t1",
					message: { role: "user", content: "hello" } as AgentMessage,
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();
		expect(store.getSnapshot().transcript.entries.length).toBe(1);

		store.dispose();
	});

	it("snapshot includes stats and commands fields", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));
		const snap = store.getSnapshot();
		expect(snap).toHaveProperty("stats");
		expect(snap).toHaveProperty("commands");
		store.dispose();
	});

	it("streaming event updates transcript and streaming", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState({ isStreaming: false });

		const store = createSessionStore(asClient(client));
		let notified = 0;
		store.subscribe(() => {
			notified++;
		});

		client.emitEvent({ type: "agent_start" } as unknown as RpcSessionEvent);

		const snap1 = store.getSnapshot();
		expect(snap1.transcript.working).toBe(true);
		expect(snap1.streaming).toBe(true);
		expect(notified).toBeGreaterThanOrEqual(1);

		client.emitEvent({ type: "agent_end" } as unknown as RpcSessionEvent);

		const snap2 = store.getSnapshot();
		expect(snap2.transcript.working).toBe(false);
		expect(snap2.streaming).toBe(false);

		store.dispose();
	});
	it("streaming initialized to true (mid-turn attach) clears on agent_end", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState({ isStreaming: true });

		const store = createSessionStore(asClient(client));
		expect(store.getSnapshot().streaming).toBe(true);

		client.emitEvent({ type: "agent_end" } as unknown as RpcSessionEvent);
		const snap = store.getSnapshot();
		expect(snap.transcript.working).toBe(false);
		expect(snap.sessionState?.isStreaming).toBe(false);
		expect(snap.streaming).toBe(false);

		store.dispose();
	});

	it("onStateChange updates connection", () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));

		client.emitStateChange("closed");
		expect(store.getSnapshot().connection).toBe("closed");

		client.emitStateChange("connecting");
		expect(store.getSnapshot().connection).toBe("connecting");

		store.dispose();
	});

	it("onResync replaces transcript and sessionState on reconnect", async () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState({ sessionId: "old" });

		const store = createSessionStore(asClient(client));
		client.resolveHistory(0, {
			leafId: "l1",
			entries: [
				{
					id: "e-old",
					parentId: null,
					type: "message",
					timestamp: "t1",
					message: { role: "user", content: "old" } as AgentMessage,
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();
		expect(store.getSnapshot().transcript.entries.length).toBe(1);

		const newState = makeSessionState({ sessionId: "new", isStreaming: true });
		client.emitResync(newState);
		await flush();

		const snap = store.getSnapshot();
		expect(snap.sessionState?.sessionId).toBe("new");

		expect(client.historyLog.length).toBeGreaterThan(1);
		client.resolveHistory(1, {
			leafId: "l2",
			entries: [
				{
					id: "e-new1",
					parentId: null,
					type: "message",
					timestamp: "t2",
					message: { role: "user", content: "a" } as AgentMessage,
				} as SessionEntry,
				{
					id: "e-new2",
					parentId: "e-new1",
					type: "message",
					timestamp: "t3",
					message: makeAssistantMessage("b"),
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();

		const finalSnap = store.getSnapshot();
		expect(finalSnap.transcript.entries.length).toBe(2);
		expect(finalSnap.streaming).toBe(true);

		store.dispose();
	});

	it("dispose unsubscribes and prevents further updates", () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));

		store.dispose();

		expect(client.eventListenerCount).toBe(0);
		expect(client.stateListenerCount).toBe(0);
		expect(client.resyncListenerCount).toBe(0);

		// After dispose, emitEvent has no client listener
		let notified = false;
		store.subscribe(() => {
			notified = true;
		});
		client.emitEvent({ type: "agent_start" } as unknown as RpcSessionEvent);
		expect(notified).toBe(false);
	});

	it("stats refresh is debounced: two rapid turn_end events produce one request", async () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const initialStatsCount = client.requestLog.filter(r => r.type === "get_session_stats").length;

		// Emit two turn_end events rapidly
		client.emitEvent({ type: "turn_end" } as unknown as RpcSessionEvent);
		client.emitEvent({ type: "turn_end" } as unknown as RpcSessionEvent);

		// No immediate stats request (only debounced)
		const afterEmitStatsCount = client.requestLog.filter(r => r.type === "get_session_stats").length;
		expect(afterEmitStatsCount).toBe(initialStatsCount);

		// Wait for debounce (500ms + margin)
		await new Promise(resolve => setTimeout(resolve, 600));

		const finalStatsCount = client.requestLog.filter(r => r.type === "get_session_stats").length;
		// Exactly one more stats request from the debounce
		expect(finalStatsCount).toBe(initialStatsCount + 1);

		store.dispose();
	});

	it("resync replaces transcript when history resolves without blank intermediate", async () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();

		const store = createSessionStore(asClient(client));
		client.resolveHistory(0, {
			leafId: "l1",
			entries: [
				{
					id: "e-old",
					parentId: null,
					type: "message",
					timestamp: "t1",
					message: { role: "user", content: "old" } as AgentMessage,
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();

		const snapshots: Array<{ entryCount: number }> = [];
		store.subscribe(() => {
			snapshots.push({ entryCount: store.getSnapshot().transcript.entries.length });
		});

		const newState = makeSessionState({ sessionId: "new" });
		client.emitResync(newState);
		await flush();

		client.resolveHistory(1, {
			leafId: "l2",
			entries: [
				{
					id: "e-new1",
					parentId: null,
					type: "message",
					timestamp: "t2",
					message: { role: "user", content: "a" } as AgentMessage,
				} as SessionEntry,
				{
					id: "e-new2",
					parentId: "e-new1",
					type: "message",
					timestamp: "t3",
					message: makeAssistantMessage("b"),
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();

		for (const snap of snapshots) {
			expect(snap.entryCount).toBeGreaterThan(0);
		}
		expect(store.getSnapshot().transcript.entries.length).toBe(2);

		store.dispose();
	});

	it("attach loads only the newest page; loadOlder fetches one older page on demand", async () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));

		// 1. Initial history request is the newest page (no before)
		expect(client.historyLog).toHaveLength(1);
		expect(client.historyLog[0]).toEqual({});

		// Resolve newest page with hasMore: true
		client.resolveHistory(0, {
			leafId: "leaf-1",
			entries: [
				{
					id: "e2",
					parentId: "e1",
					type: "message",
					timestamp: "2026-09-24T12:00:01Z",
					message: makeAssistantMessage("world"),
				} as SessionEntry,
			],
			hasMore: true,
			live: [],
		});
		await flush();

		// 2. Older pages wait for the transcript to ask; concurrent asks share one request.
		expect(client.historyLog).toHaveLength(1);
		const olderDone = store.loadOlder();
		void store.loadOlder();
		expect(client.historyLog).toHaveLength(2);
		expect(client.historyLog[1]).toEqual({ before: "e2", leafId: "leaf-1", limit: 50 });

		// Resolve older page with hasMore: false
		client.resolveHistory(1, {
			leafId: "leaf-1",
			entries: [
				{
					id: "e1",
					parentId: null,
					type: "message",
					timestamp: "2026-09-24T12:00:00Z",
					message: { role: "user", content: "hello" } as AgentMessage,
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();

		await olderDone;
		// 3. No more requests issued, even when asked again
		await store.loadOlder();
		expect(client.historyLog).toHaveLength(2);

		const entries = store.getSnapshot().transcript.entries;
		expect(entries).toHaveLength(2);
		expect(entries[0]!.id).toBe("e1");
		expect(entries[1]!.id).toBe("e2");

		store.dispose();
	});

	it("branch event triggers exactly one reload", async () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));

		// Complete initial attach
		client.resolveHistory(0, {
			leafId: "leaf-1",
			entries: [
				{
					id: "e1",
					parentId: null,
					type: "message",
					timestamp: "t1",
					message: { role: "user", content: "branch 1" } as AgentMessage,
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();
		expect(client.historyLog).toHaveLength(1);
		expect(store.getSnapshot().transcript.entries).toHaveLength(1);

		// Emit branch event
		client.emitEvent({ type: "branch", leafId: "leaf-2" } as unknown as RpcSessionEvent);
		await flush();

		// Triggers exactly one reload request (newest page)
		expect(client.historyLog).toHaveLength(2);
		expect(client.historyLog[1]).toEqual({});

		// Resolve the branch reload
		client.resolveHistory(1, {
			leafId: "leaf-2",
			entries: [
				{
					id: "e2",
					parentId: null,
					type: "message",
					timestamp: "t2",
					message: { role: "user", content: "branch 2" } as AgentMessage,
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();

		// No extra reload requested
		expect(client.historyLog).toHaveLength(2);
		expect(store.getSnapshot().transcript.entries[0]!.id).toBe("e2");

		store.dispose();
	});

	it("branch_changed error on older page restarts from newest", async () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));

		// 1. Initial newest page
		client.resolveHistory(0, {
			leafId: "leaf-1",
			entries: [
				{
					id: "e2",
					parentId: "e1",
					type: "message",
					timestamp: "t2",
					message: makeAssistantMessage("hi"),
				} as SessionEntry,
			],
			hasMore: true,
			live: [],
		});
		await flush();

		// 2. Older page requested
		void store.loadOlder();
		expect(client.historyLog).toHaveLength(2);
		expect(client.historyLog[1]).toEqual({ before: "e2", leafId: "leaf-1", limit: 50 });

		// Older page fails with branch_changed error
		client.rejectHistory(1, new RpcCommandError("history", "branch_changed", "branch_changed"));
		await flush();

		// 3. Store restarts from newest page
		expect(client.historyLog).toHaveLength(3);
		expect(client.historyLog[2]).toEqual({});

		// Resolve the restarted newest page
		client.resolveHistory(2, {
			leafId: "leaf-new",
			entries: [
				{
					id: "e-fresh",
					parentId: null,
					type: "message",
					timestamp: "t-fresh",
					message: { role: "user", content: "fresh start" } as AgentMessage,
				} as SessionEntry,
			],
			hasMore: false,
			live: [],
		});
		await flush();

		expect(store.getSnapshot().transcript.entries[0]!.id).toBe("e-fresh");
		store.dispose();
	});

	it("resync drops working, activeTools and entryKeys missed while disconnected", async () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));
		client.resolveHistory(0, { leafId: null, entries: [], hasMore: false, live: [] });
		await flush();

		client.emitEvent({ type: "agent_start" } as unknown as RpcSessionEvent);
		client.emitEvent({
			type: "tool_execution_start",
			toolCallId: "t1",
			toolName: "bash",
		} as unknown as RpcSessionEvent);
		client.emitEvent({
			type: "entry",
			sid: 1,
			entry: { id: "u1", parentId: null, type: "message", timestamp: "t", message: { role: "user", content: "x" } },
		} as unknown as RpcSessionEvent);
		expect(store.getSnapshot().transcript.working).toBe(true);

		client.emitResync(makeSessionState({ isStreaming: false }));
		await flush();
		client.resolveHistory(1, { leafId: "u1", entries: [], hasMore: false, live: [] });
		await flush();

		const t = store.getSnapshot().transcript;
		expect(t.working).toBe(false);
		expect(t.activeTools.size).toBe(0);
		expect(t.entryKeys.size).toBe(0);
		store.dispose();
	});

	it("available_commands_update event replaces commands", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		expect(store.getSnapshot().commands).toEqual([]);

		client.emitEvent({
			type: "available_commands_update",
			commands: [{ name: "test", source: "builtin" }],
		} as unknown as RpcSessionEvent);

		expect(store.getSnapshot().commands).toEqual([{ name: "test", source: "builtin" }]);

		store.dispose();
	});

	it("fetches stats and commands on attach", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const types = client.requestLog.map(r => r.type);
		expect(types).toContain("get_session_stats");
		expect(types).toContain("get_available_commands");

		store.dispose();
	});

	it("defers attach-time requests until the client is ready", () => {
		const client = new FakeClient();
		client.state = "connecting";
		const store = createSessionStore(asClient(client));

		expect(client.requestLog).toHaveLength(0);
		expect(client.historyLog).toHaveLength(0);

		client.state = "ready";
		client.emitStateChange("ready");
		const types = client.requestLog.map(r => r.type);
		expect(types).toContain("get_session_stats");
		expect(types).toContain("get_login_status");
		expect(client.historyLog).toHaveLength(1);

		client.emitStateChange("reconnecting");
		client.emitStateChange("ready");
		expect(client.requestLog.filter(r => r.type === "get_session_stats")).toHaveLength(1);

		store.dispose();
	});

	it("fetches model roles and agents on attach", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const types = client.requestLog.map(r => r.type);
		expect(types).toContain("get_model_roles");
		expect(types).toContain("get_agents");
		expect(types).toContain("get_model_browser");

		store.dispose();
	});

	it("refetches roles on config_update with modelRoles flag", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const before = client.requestLog.filter(r => r.type === "get_model_roles").length;

		client.emitEvent({
			type: "config_update",
			modelRoles: true,
		} as unknown as RpcSessionEvent);

		const after = client.requestLog.filter(r => r.type === "get_model_roles").length;
		expect(after).toBe(before + 1);

		store.dispose();
	});

	it("refetches agents on config_update with agents flag", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const before = client.requestLog.filter(r => r.type === "get_agents").length;

		client.emitEvent({
			type: "config_update",
			agents: true,
		} as unknown as RpcSessionEvent);

		const after = client.requestLog.filter(r => r.type === "get_agents").length;
		expect(after).toBe(before + 1);

		store.dispose();
	});

	it("refetches both roles and agents on config_update with model flag", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const rolesBefore = client.requestLog.filter(r => r.type === "get_model_roles").length;
		const agentsBefore = client.requestLog.filter(r => r.type === "get_agents").length;

		client.emitEvent({
			type: "config_update",
			model: {},
		} as unknown as RpcSessionEvent);

		expect(client.requestLog.filter(r => r.type === "get_model_roles").length).toBe(rolesBefore + 1);
		expect(client.requestLog.filter(r => r.type === "get_agents").length).toBe(agentsBefore + 1);

		store.dispose();
	});

	it("snapshot includes roles, agents, and browser fields", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));
		const snap = store.getSnapshot();
		expect(snap).toHaveProperty("roles");
		expect(snap).toHaveProperty("agents");
		expect(snap).toHaveProperty("browser");
		expect(snap.roles).toBe(null);
		expect(snap.agents).toBe(null);
		expect(snap.browser).toBe(null);
		store.dispose();
	});

	it("browser is populated from the attach-time fetch", async () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const browserIndex = client.requestLog.findIndex(r => r.type === "get_model_browser");
		expect(browserIndex).toBeGreaterThanOrEqual(0);

		const fakeBrowser: RpcModelBrowserResult = {
			models: [],
			mruOrder: [],
			providers: [],
			kinds: [],
		};

		client.resolveRequest(browserIndex, {
			type: "response",
			command: "get_model_browser",
			success: true,
			data: fakeBrowser,
		});

		await flush();

		expect(store.getSnapshot().browser).toBe(fakeBrowser);

		store.dispose();
	});

	it("config_update with models flag triggers exactly get_model_browser and get_model_roles requests and no get_agents", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const rolesBefore = client.requestLog.filter(r => r.type === "get_model_roles").length;
		const browserBefore = client.requestLog.filter(r => r.type === "get_model_browser").length;
		const agentsBefore = client.requestLog.filter(r => r.type === "get_agents").length;

		client.emitEvent({
			type: "config_update",
			models: true,
		} as unknown as RpcSessionEvent);

		expect(client.requestLog.filter(r => r.type === "get_model_browser").length).toBe(browserBefore + 1);
		expect(client.requestLog.filter(r => r.type === "get_model_roles").length).toBe(rolesBefore + 1);
		expect(client.requestLog.filter(r => r.type === "get_agents").length).toBe(agentsBefore);

		store.dispose();
	});

	it("refetches roles and browser on config_update with modelRoles flag", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const rolesBefore = client.requestLog.filter(r => r.type === "get_model_roles").length;
		const browserBefore = client.requestLog.filter(r => r.type === "get_model_browser").length;

		client.emitEvent({
			type: "config_update",
			modelRoles: true,
		} as unknown as RpcSessionEvent);

		expect(client.requestLog.filter(r => r.type === "get_model_roles").length).toBe(rolesBefore + 1);
		expect(client.requestLog.filter(r => r.type === "get_model_browser").length).toBe(browserBefore + 1);

		store.dispose();
	});

	it("refetches roles on model_changed", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const before = client.requestLog.filter(r => r.type === "get_model_roles").length;

		client.emitEvent({
			type: "model_changed",
		} as unknown as RpcSessionEvent);

		expect(client.requestLog.filter(r => r.type === "get_model_roles").length).toBe(before + 1);

		store.dispose();
	});

	it("applyAgent replaces only the matching agent", async () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const agentsIndex = client.requestLog.findIndex(r => r.type === "get_agents");
		const initialAgents: RpcAgentsResult = {
			defaultAgent: "coder",
			agents: [
				{
					name: "Coder",
					description: "Code assistant",
					custom: false,
					enabled: true,
				} as unknown as RpcAgentInfo,
				{
					name: "Reviewer",
					description: "Code reviewer",
					custom: false,
					enabled: true,
				} as unknown as RpcAgentInfo,
			],
		};
		client.resolveRequest(agentsIndex, {
			type: "response",
			command: "get_agents",
			success: true,
			data: initialAgents,
		});
		await flush();

		expect(store.getSnapshot().agents?.agents).toHaveLength(2);

		const updatedReviewer: RpcAgentInfo = {
			name: "Reviewer",
			description: "Code reviewer updated",
			custom: false,
			enabled: false,
			serviceTier: "fast",
		} as unknown as RpcAgentInfo;

		store.applyAgent(updatedReviewer);

		const snap = store.getSnapshot();
		expect(snap.agents?.agents).toEqual([initialAgents.agents[0], updatedReviewer]);

		store.dispose();
	});

	it("applyRoles updates roles immediately", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const fakeRoles: RpcModelRolesResult = {
			storage: "global",
			roles: [],
			cycleOrder: ["default"],
			modelTags: {},
		};

		store.applyRoles(fakeRoles);
		expect(store.getSnapshot().roles).toBe(fakeRoles);

		store.dispose();
	});

	it("applyBrowser updates browser immediately", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const fakeBrowser: RpcModelBrowserResult = {
			models: [],
			mruOrder: [],
			providers: [],
			kinds: [],
		};

		store.applyBrowser(fakeBrowser);
		expect(store.getSnapshot().browser).toBe(fakeBrowser);

		store.dispose();
	});

	it("refreshModelConfig refetches roles, agents, and browser", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const rolesBefore = client.requestLog.filter(r => r.type === "get_model_roles").length;
		const agentsBefore = client.requestLog.filter(r => r.type === "get_agents").length;
		const browserBefore = client.requestLog.filter(r => r.type === "get_model_browser").length;

		store.refreshModelConfig();

		expect(client.requestLog.filter(r => r.type === "get_model_roles").length).toBe(rolesBefore + 1);
		expect(client.requestLog.filter(r => r.type === "get_agents").length).toBe(agentsBefore + 1);
		expect(client.requestLog.filter(r => r.type === "get_model_browser").length).toBe(browserBefore + 1);

		store.dispose();
	});

	it("initial attach fetches get_login_status", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const count = client.requestLog.filter(r => r.type === "get_login_status").length;
		expect(count).toBe(1);

		store.dispose();
	});

	it("config_update with models: true refetches get_login_status", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const before = client.requestLog.filter(r => r.type === "get_login_status").length;

		client.emitEvent({
			type: "config_update",
			models: true,
		} as unknown as RpcSessionEvent);

		const after = client.requestLog.filter(r => r.type === "get_login_status").length;
		expect(after).toBe(before + 1);

		store.dispose();
	});

	it("login_event ignores events with loginId mismatch", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		store.beginLogin({ loginId: "login-1", providerId: "anthropic" });

		client.emitEvent({
			type: "login_event",
			loginId: "different-login-id",
			providerId: "anthropic",
			event: { kind: "progress", message: "Step ignored" },
		} as unknown as RpcSessionEvent);

		expect(store.getSnapshot().login?.progress).toEqual([]);

		store.dispose();
	});

	it("login_event applies auth and appends progress", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		store.beginLogin({ loginId: "login-1", providerId: "anthropic" });

		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: { kind: "auth", url: "https://auth.example.com", instructions: "Open URL" },
		} as unknown as RpcSessionEvent);

		let snap = store.getSnapshot();
		expect(snap.login?.url).toBe("https://auth.example.com");
		expect(snap.login?.instructions).toBe("Open URL");

		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: { kind: "progress", message: "Waiting for code..." },
		} as unknown as RpcSessionEvent);

		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: { kind: "progress", message: "Verifying..." },
		} as unknown as RpcSessionEvent);

		snap = store.getSnapshot();
		expect(snap.login?.progress).toEqual(["Waiting for code...", "Verifying..."]);

		store.dispose();
	});

	it("login_event replaces pending, done clears pending and sets result", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		store.beginLogin({ loginId: "login-1", providerId: "anthropic" });

		// 1. prompt sets pending
		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: {
				kind: "prompt",
				requestId: "req-1",
				message: "Enter username",
				secret: false,
				allowEmpty: false,
			},
		} as unknown as RpcSessionEvent);

		let snap = store.getSnapshot();
		expect(snap.login?.pending).toEqual({
			requestId: "req-1",
			kind: "prompt",
			message: "Enter username",
			placeholder: undefined,
			secret: false,
			allowEmpty: false,
		});

		// 2. manual_input replaces pending
		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: {
				kind: "manual_input",
				requestId: "req-2",
			},
		} as unknown as RpcSessionEvent);

		snap = store.getSnapshot();
		expect(snap.login?.pending).toEqual({
			requestId: "req-2",
			kind: "manual_input",
		});

		// 3. done sets result and clears pending
		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: {
				kind: "done",
				providerId: "anthropic",
				identity: "test-user@example.com",
			},
		} as unknown as RpcSessionEvent);

		snap = store.getSnapshot();
		expect(snap.login?.pending).toBeUndefined();
		expect(snap.login?.result).toEqual({
			kind: "done",
			identity: "test-user@example.com",
		});

		store.dispose();
	});

	it("login_event failed sets result and clears pending", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		store.beginLogin({ loginId: "login-1", providerId: "anthropic" });

		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: {
				kind: "prompt",
				requestId: "req-1",
				message: "Enter code",
			},
		} as unknown as RpcSessionEvent);

		client.emitEvent({
			type: "login_event",
			loginId: "login-1",
			providerId: "anthropic",
			event: {
				kind: "failed",
				error: "Invalid code",
				cancelled: false,
			},
		} as unknown as RpcSessionEvent);

		const snap = store.getSnapshot();
		expect(snap.login?.pending).toBeUndefined();
		expect(snap.login?.result).toEqual({
			kind: "failed",
			error: "Invalid code",
			cancelled: false,
		});

		store.dispose();
	});

	it("reconnect marks in-flight login without result as failed/cancelled", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		store.beginLogin({ loginId: "login-flight", providerId: "openai" });
		expect(store.getSnapshot().login?.result).toBeUndefined();

		// Trigger resync (reconnect)
		client.emitResync(makeSessionState());

		const snap = store.getSnapshot();
		expect(snap.login?.result).toEqual({
			kind: "failed",
			error: "Connection lost",
			cancelled: true,
		});
		expect(snap.login?.pending).toBeUndefined();

		store.dispose();
	});

	it("clearLogin resets login state to null", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		store.beginLogin({ loginId: "login-1", providerId: "anthropic" });
		expect(store.getSnapshot().login).not.toBeNull();

		store.clearLogin();
		expect(store.getSnapshot().login).toBeNull();

		store.dispose();
	});

	it("applyLoginStatus updates snapshot loginStatus", () => {
		const client = new FakeClient();
		client.sessionState = makeSessionState();
		const store = createSessionStore(asClient(client));

		const fakeStatus = {
			providers: [
				{
					id: "anthropic",
					name: "Anthropic",
					available: true,
					authenticated: true,
					accounts: [{ credentialId: 1, label: "user@example.com" }],
				},
			],
		};

		store.applyLoginStatus(fakeStatus);
		expect(store.getSnapshot().loginStatus).toBe(fakeStatus);

		store.dispose();
	});
});

describe("createSessionStore: final review regressions", () => {
	const entry = (id: string, parentId: string | null): SessionEntry =>
		({
			id,
			parentId,
			type: "message",
			timestamp: "t",
			message: { role: "user", content: id } as AgentMessage,
		}) as SessionEntry;

	it("halves the page limit when a history page exceeds the transport limit", async () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));
		const tooLarge = () => new Error("RPC response exceeded the transport limit");

		client.rejectHistory(0, tooLarge());
		await flush();
		expect(client.historyLog[1]).toEqual({ limit: 25 });
		client.rejectHistory(1, tooLarge());
		await flush();
		expect(client.historyLog[2]).toEqual({ limit: 12 });
		client.resolveHistory(2, { leafId: "a", entries: [entry("a", null)], hasMore: false, live: [] });
		await flush();
		expect(store.getSnapshot().transcript.entries.map(e => e.id)).toEqual(["a"]);

		store.dispose();
	});

	it("stops retrying at limit 1 and surfaces the error", async () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));
		client.resolveHistory(0, { leafId: "b", entries: [entry("b", "a")], hasMore: true, live: [] });
		await flush();

		const older = store.loadOlder();
		for (let i = 1; i < 20 && client.historyResolvers[i]; i++) {
			client.rejectHistory(i, new Error("RPC response exceeded the transport limit"));
			await flush();
		}
		await older;
		const limits = client.historyLog.slice(1).map(o => o.limit);
		expect(limits).toEqual([50, 25, 12, 6, 3, 1]);
		expect(store.getSnapshot().transcript.entries.map(e => e.id)).toEqual(["b"]);

		store.dispose();
	});

	it("branch keeps the current rows until the newest page replaces them", async () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));
		client.resolveHistory(0, { leafId: "a", entries: [entry("a", null)], hasMore: false, live: [] });
		await flush();

		client.emitEvent({ type: "branch", leafId: "c" });
		await flush();
		expect(store.getSnapshot().transcript.entries.map(e => e.id)).toEqual(["a"]);

		client.resolveHistory(1, { leafId: "c", entries: [entry("c", null)], hasMore: false, live: [] });
		await flush();
		expect(store.getSnapshot().transcript.entries.map(e => e.id)).toEqual(["c"]);

		store.dispose();
	});

	it("loadOlder does nothing while a reload is pending", async () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));
		client.resolveHistory(0, { leafId: "b", entries: [entry("b", "a")], hasMore: true, live: [] });
		await flush();
		client.emitEvent({ type: "branch", leafId: "x" });
		await store.loadOlder();
		expect(client.historyLog).toEqual([{}, {}]);

		store.dispose();
	});
});
