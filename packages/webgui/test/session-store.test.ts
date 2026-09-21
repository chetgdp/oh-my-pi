import { describe, expect, it } from "bun:test";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
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
	};
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

	it("onStateChange updates connection", () => {
		const client = new FakeClient();
		const store = createSessionStore(asClient(client));

		client.emitStateChange("closed");
		expect(store.getSnapshot().connection).toBe("closed");

		client.emitStateChange("connecting");
		expect(store.getSnapshot().connection).toBe("connecting");

		store.dispose();
	});

	it("onResync replaces transcript and sessionState", () => {
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
});
