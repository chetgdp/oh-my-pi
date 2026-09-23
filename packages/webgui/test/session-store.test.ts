import { describe, expect, it } from "bun:test";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import type {
	RpcSessionState,
	RpcModelBrowserResult,
	RpcModelRolesResult,
	RpcAgentsResult,
	RpcAgentInfo,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";

// -------------------------------------------------------------------
// Fake client implementing the surface createSessionStore uses
// -------------------------------------------------------------------

class FakeClient {
	state: RpcConnectionState = "ready";
	sessionState: RpcSessionState | null = null;
	messages: AgentMessage[] | null = [];

	#eventListeners: Array<(e: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];
	#resyncListeners: Array<(msgs: AgentMessage[], s: RpcSessionState) => void> = [];

	// Track requests issued by the store
	requestLog: Array<{ type: string }> = [];
	requestResolvers: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];

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

	onResync(fn: (msgs: AgentMessage[], s: RpcSessionState) => void): () => void {
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

	emitResync(msgs: AgentMessage[], s: RpcSessionState): void {
		for (const fn of this.#resyncListeners) fn(msgs, s);
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
	it("initializes snapshot from client messages", () => {
		const client = new FakeClient();
		client.messages = [{ role: "user", content: "hello" } as AgentMessage];
		client.sessionState = makeSessionState();

		const store = createSessionStore(asClient(client));
		const snap = store.getSnapshot();

		expect(snap.connection).toBe("ready");
		expect(snap.sessionState).toBe(client.sessionState);
		expect(snap.transcript.entries.length).toBe(1);
		expect(snap.streaming).toBe(false);
		expect(snap.stats).toBe(null);
		expect(snap.commands).toEqual([]);

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

	it("onResync replaces transcript and sessionState atomically", () => {
		const client = new FakeClient();
		client.messages = [{ role: "user", content: "old" } as AgentMessage];
		client.sessionState = makeSessionState({ sessionId: "old" });

		const store = createSessionStore(asClient(client));
		expect(store.getSnapshot().transcript.entries.length).toBe(1);

		const newState = makeSessionState({ sessionId: "new", isStreaming: true });
		client.emitResync(
			[
				{ role: "user", content: "a" } as AgentMessage,
				{
					role: "assistant",
					content: [{ type: "text", text: "b" }],
					model: "test",
					usage: { inputTokens: 0, outputTokens: 0, cost: { total: 0 } },
				} as unknown as AgentMessage,
			],
			newState,
		);

		const snap = store.getSnapshot();
		expect(snap.sessionState?.sessionId).toBe("new");
		expect(snap.transcript.entries.length).toBe(2);
		expect(snap.streaming).toBe(true);

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

	it("resync does not produce an intermediate empty transcript snapshot", () => {
		const client = new FakeClient();
		client.messages = [{ role: "user", content: "old" } as AgentMessage];
		client.sessionState = makeSessionState();

		const store = createSessionStore(asClient(client));

		// Record every snapshot emitted
		const snapshots: Array<{ entryCount: number }> = [];
		store.subscribe(() => {
			snapshots.push({ entryCount: store.getSnapshot().transcript.entries.length });
		});

		const newState = makeSessionState({ sessionId: "new" });
		client.emitResync(
			[
				{ role: "user", content: "a" } as AgentMessage,
				{
					role: "assistant",
					content: [{ type: "text", text: "b" }],
					model: "test",
					usage: { inputTokens: 0, outputTokens: 0, cost: { total: 0 } },
				} as unknown as AgentMessage,
			],
			newState,
		);

		// No snapshot should have 0 entries (the old had 1, the new has 2)
		for (const snap of snapshots) {
			expect(snap.entryCount).toBeGreaterThan(0);
		}
		// Final snapshot has the new transcript
		expect(store.getSnapshot().transcript.entries.length).toBe(2);

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

		await Promise.resolve();

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
		await Promise.resolve();

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
});
