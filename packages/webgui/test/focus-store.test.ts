import { describe, expect, test } from "bun:test";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { RpcSubagentMessagesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcWebClient } from "../src/lib/rpc-client";

interface Sent {
	type: string;
	[key: string]: unknown;
}

const rosterEntry = (id: string, over: Partial<AgentRosterEntry> = {}): AgentRosterEntry => ({
	id,
	displayName: "task",
	kind: "sub",
	status: "running",
	createdAt: 1,
	lastActivity: 1,
	...over,
});

/** Answers roster, transcript and control commands; everything else stays pending like an idle host. */
class FakeClient {
	state: RpcConnectionState = "ready";
	sessionState = null;
	sent: Sent[] = [];
	roster: AgentRosterEntry[] = [];
	chunks: RpcSubagentMessagesResult[] = [];
	reviveGate: Promise<void> | undefined;
	reviveError: Error | undefined;
	#events: Array<(e: RpcSessionEvent) => void> = [];

	history(): Promise<never> {
		return new Promise(() => {});
	}
	onEvent(fn: (e: RpcSessionEvent) => void): () => void {
		this.#events.push(fn);
		return () => {};
	}
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];
	onStateChange(fn: (s: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(fn);
		return () => {};
	}
	setState(state: RpcConnectionState): void {
		this.state = state;
		for (const fn of this.#stateListeners) fn(state);
	}
	onResync(): () => void {
		return () => {};
	}
	emit(event: unknown): void {
		for (const fn of this.#events) fn(event as RpcSessionEvent);
	}
	async request(cmd: Sent): Promise<unknown> {
		this.sent.push(cmd);
		switch (cmd.type) {
			case "get_agent_roster":
				return { success: true, data: { agents: this.roster } };
			case "get_subagent_messages": {
				const next = this.chunks.shift();
				if (!next) throw new Error("no transcript");
				return { success: true, data: next };
			}
			case "revive_agent":
				await this.reviveGate;
				if (this.reviveError) throw this.reviveError;
				return { success: true, data: { agentId: cmd.agentId } };
			case "set_subagent_subscription":
			case "set_agent_roster_subscription":
				return { success: true, data: {} };
			default:
				return new Promise(() => {});
		}
	}
	types(): string[] {
		return this.sent.map(s => s.type);
	}
}

function makeStore(client: FakeClient) {
	return createSessionStore(client as unknown as RpcWebClient);
}

async function settle(): Promise<void> {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

const userChunk = (id: string, text: string, over: Partial<RpcSubagentMessagesResult> = {}) =>
	({
		sessionFile: "/tmp/a.jsonl",
		fromByte: 0,
		nextByte: 10,
		reset: false,
		fileId: "1:1",
		sentinel: "s",
		entries: [
			{
				type: "message",
				id,
				parentId: null,
				timestamp: "2026-01-01T00:00:00Z",
				message: { role: "user", content: text, timestamp: 1 },
			},
		],
		messages: [],
		...over,
	}) as unknown as RpcSubagentMessagesResult;

const registryUpsert = (agent: AgentRosterEntry) => ({ type: "agent_registry", op: "upsert", agent });

describe("focus lifecycle", () => {
	test("focusing a live agent loads its transcript and narrows the event subscription to that id", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "task text")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		const snap = store.getSnapshot();
		expect(snap.focus?.agentId).toBe("A.B");
		expect(snap.focus?.ready).toBe(true);
		expect(snap.focus?.transcript.entries.map(e => e.id)).toEqual(["u1"]);
		expect(client.sent).toContainEqual({
			type: "set_subagent_subscription",
			level: "events",
			ids: ["A.B"],
		});
		expect(client.types()).not.toContain("revive_agent");
		store.dispose();
	});

	test("a parked agent is revived before the transcript and events start", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B", { status: "parked" })];
		client.chunks = [userChunk("u1", "x")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		const order = client.types();
		expect(order.indexOf("revive_agent")).toBeGreaterThan(-1);
		expect(order.indexOf("revive_agent")).toBeLessThan(order.indexOf("get_subagent_messages"));
		expect(order.indexOf("revive_agent")).toBeLessThan(order.lastIndexOf("set_subagent_subscription"));
		expect(store.getSnapshot().focus?.ready).toBe(true);
		store.dispose();
	});

	test("a deep-linked focus requested before the handshake resumes once the client is ready", async () => {
		const client = new FakeClient();
		client.state = "connecting";
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		expect(client.sent).toEqual([]);
		expect(store.getSnapshot().focusDetach).toBeNull();
		client.setState("ready");
		await settle();
		expect(store.getSnapshot().focus?.ready).toBe(true);
		expect(store.getSnapshot().focus?.transcript.entries.map(e => e.id)).toEqual(["u1"]);
		store.dispose();
	});

	test("focusing right after the hub closes leaves the roster subscription on", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		const store = makeStore(client);
		store.setHubOpen(true);
		await settle();
		// Hub Enter: the hub unmounts (release) and the route effect focuses in the same commit.
		store.setHubOpen(false);
		await store.focusAgent("A.B");
		await settle();
		const roster = client.sent.filter(s => s.type === "set_agent_roster_subscription").map(s => s.enabled);
		expect(roster.at(-1)).toBe(true);
		client.emit(registryUpsert(rosterEntry("A.B", { status: "aborted" })));
		expect(store.getSnapshot().focus).toBeNull();
		store.dispose();
	});

	test("a slower older focus request is dropped when a newer one won", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A", { status: "parked" }), rosterEntry("B")];
		client.chunks = [userChunk("b1", "for B")];
		const gate = Promise.withResolvers<void>();
		client.reviveGate = gate.promise;
		const store = makeStore(client);
		const first = store.focusAgent("A");
		await settle();
		client.reviveGate = undefined;
		await store.focusAgent("B");
		gate.resolve();
		await first;
		await settle();
		const snap = store.getSnapshot();
		expect(snap.focus?.agentId).toBe("B");
		expect(snap.focus?.transcript.entries.map(e => e.id)).toEqual(["b1"]);
		const subscriptions = client.sent.filter(s => s.type === "set_subagent_subscription" && s.level === "events");
		expect(subscriptions.map(s => s.ids)).toEqual([["B"]]);
		store.dispose();
	});

	test("unfocus during a pending revive cancels the late landing", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A", { status: "parked" })];
		const gate = Promise.withResolvers<void>();
		client.reviveGate = gate.promise;
		const store = makeStore(client);
		const pending = store.focusAgent("A");
		await settle();
		store.unfocus();
		gate.resolve();
		await pending;
		await settle();
		expect(store.getSnapshot().focus).toBeNull();
		expect(client.sent.some(s => s.type === "set_subagent_subscription" && s.level === "events")).toBe(false);
		store.dispose();
	});

	test("unfocus resets the subscription to progress and stops the view", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		store.unfocus();
		expect(store.getSnapshot().focus).toBeNull();
		expect(client.sent).toContainEqual({ type: "set_subagent_subscription", level: "progress" });
		// The roster subscription taken for focus is released when nothing else needs it.
		expect(client.sent).toContainEqual({ type: "set_agent_roster_subscription", enabled: false });
		store.dispose();
	});

	test("advisors, aborted and unknown agents cannot be focused and report why", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("adv", { kind: "main" }), rosterEntry("dead", { status: "aborted" })];
		const store = makeStore(client);
		for (const [id, message] of [
			["adv", "Agent adv is read-only; open it in the Agent Hub"],
			["dead", "Agent dead is aborted"],
			["nope", "Agent nope is gone"],
		] as const) {
			await store.focusAgent(id);
			const snap = store.getSnapshot();
			expect(snap.focus).toBeNull();
			expect(snap.focusDetach?.message).toBe(message);
		}
		store.dispose();
	});

	test("a failed revive returns to Main with the host error", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A", { status: "parked" })];
		client.reviveError = new Error("cannot revive");
		const store = makeStore(client);
		await store.focusAgent("A");
		const snap = store.getSnapshot();
		expect(snap.focus).toBeNull();
		expect(snap.focusDetach?.message).toBe("cannot revive");
		store.dispose();
	});
});

describe("focus live stream", () => {
	test("subagent_event frames for the focused id reach the transcript, other ids are ignored", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		const message = { role: "assistant", content: [{ type: "text", text: "hi" }], timestamp: 1 };
		client.emit({ type: "subagent_event", payload: { id: "A.C", event: { type: "message_start", message } } });
		expect(store.getSnapshot().focus?.transcript.live.size).toBe(0);
		client.emit({ type: "subagent_event", payload: { id: "A.B", event: { type: "message_start", message } } });
		expect(store.getSnapshot().focus?.transcript.live.size).toBe(1);
		// The main transcript is untouched by the focused agent's stream.
		expect(store.getSnapshot().transcript.live.size).toBe(0);
		store.dispose();
	});

	test("the user's echo is shown in the focused transcript, not Main's", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		store.echoUser("steer text");
		expect(store.getSnapshot().focus?.transcript.pendingUser.map(p => p.text)).toEqual(["steer text"]);
		expect(store.getSnapshot().transcript.pendingUser).toEqual([]);
		store.clearPendingUser();
		expect(store.getSnapshot().focus?.transcript.pendingUser).toEqual([]);
		store.dispose();
	});
});

describe("focus auto-detach", () => {
	async function focused(status: AgentRosterEntry["status"] = "running") {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B", { status })];
		client.chunks = [userChunk("u1", "x")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		return { client, store };
	}

	test.each([
		["parked", "Agent A.B is parked; returned to main session"],
		["aborted", "Agent A.B is aborted; returned to main session"],
	] as const)("a %s registry frame returns to Main", async (status, message) => {
		const { client, store } = await focused();
		client.emit(registryUpsert(rosterEntry("A.B", { status })));
		const snap = store.getSnapshot();
		expect(snap.focus).toBeNull();
		expect(snap.focusDetach?.message).toBe(message);
		expect(client.sent.at(-1)).toMatchObject({ type: "set_agent_roster_subscription", enabled: false });
		store.dispose();
	});

	test("a removed registry frame returns to Main", async () => {
		const { client, store } = await focused();
		client.emit({ type: "agent_registry", op: "removed", id: "A.B" });
		expect(store.getSnapshot().focusDetach?.message).toBe("Agent A.B is gone; returned to main session");
		store.dispose();
	});

	test("registry changes for other agents and a still-idle focused agent keep the view", async () => {
		const { client, store } = await focused();
		client.emit(registryUpsert(rosterEntry("A.C", { status: "parked" })));
		client.emit(registryUpsert(rosterEntry("A.B", { status: "idle" })));
		expect(store.getSnapshot().focus?.agentId).toBe("A.B");
		store.dispose();
	});

	test("progress frames marking the turn complete do not detach; only registry state does", async () => {
		const { client, store } = await focused();
		client.emit({
			type: "subagent_progress",
			payload: { agent: "task", progress: { id: "A.B", status: "completed" } },
		});
		expect(store.getSnapshot().focus?.agentId).toBe("A.B");
		store.dispose();
	});
});
