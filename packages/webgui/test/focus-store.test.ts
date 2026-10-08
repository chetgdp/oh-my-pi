import { describe, expect, test, vi } from "bun:test";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { RpcServerSubagentMessagesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import { createSessionStore } from "../src/lib/session-store";
import type { TodoPhase } from "../src/lib/todo-model";
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
	chunks: RpcServerSubagentMessagesResult[] = [];
	reviveGate: Promise<void> | undefined;
	reviveError: Error | undefined;
	/** `snapshots` in the `set_subagent_subscription` events response; omitted like an older host when undefined. */
	snapshots: Record<string, unknown> | undefined;
	subscribeGate: Promise<void> | undefined;
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
			case "set_subagent_subscription": {
				if (cmd.level !== "events") return { success: true, data: {} };
				await this.subscribeGate;
				return { success: true, data: { level: "events", snapshots: this.snapshots } };
			}
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

const userChunk = (id: string, text: string, over: Partial<RpcServerSubagentMessagesResult> = {}) =>
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
	}) as unknown as RpcServerSubagentMessagesResult;

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
			omitPartial: true,
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

describe("focus in-flight snapshot", () => {
	const partial = { role: "assistant", content: [{ type: "text", text: "thinking so far" }], timestamp: 1 };
	const toolUpdate = (toolCallId: string, text: string) => ({
		type: "tool_execution_update",
		toolCallId,
		toolName: "bash",
		args: { command: "sleep 9" },
		partialResult: { content: [{ type: "text", text }] },
	});
	const toolStart = (toolCallId: string, command = "sleep 9") => ({
		type: "tool_execution_start",
		toolCallId,
		toolName: "bash",
		args: { command },
		intent: "Run command",
	});
	test("a snapshot makes the running tool card and partial message visible before any live frame", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		client.snapshots = { "A.B": { streamMessage: partial, activeToolUpdates: [toolUpdate("call-1", "line 1")] } };
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		const transcript = store.getSnapshot().focus?.transcript;
		expect(transcript?.live.size).toBe(1);
		const tool = transcript?.activeTools.get("call-1");
		expect(tool?.toolName).toBe("bash");
		expect(tool?.partialResult).toBe("line 1");
		store.dispose();
	});

	test("a later live update replaces the snapshot output, and a duplicate replay does not double it", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		client.snapshots = { "A.B": { streamMessage: partial, activeToolUpdates: [toolUpdate("call-1", "line 1")] } };
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		client.emit({ type: "subagent_event", payload: { id: "A.B", event: toolUpdate("call-1", "line 1\nline 2") } });
		client.emit({ type: "subagent_event", payload: { id: "A.B", event: toolUpdate("call-1", "line 1\nline 2") } });
		const transcript = store.getSnapshot().focus?.transcript;
		expect(transcript?.activeTools.size).toBe(1);
		expect(transcript?.activeTools.get("call-1")?.partialResult).toBe("line 1\nline 2");
		expect(transcript?.live.size).toBe(1);
		store.dispose();
	});

	test("a snapshot arriving after the live message_start replaces it instead of adding a second message", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		let release: () => void = () => {};
		client.subscribeGate = new Promise<void>(resolve => {
			release = resolve;
		});
		client.snapshots = { "A.B": { streamMessage: partial, activeToolUpdates: [] } };
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		client.emit({
			type: "subagent_event",
			payload: { id: "A.B", event: { type: "message_start", message: { ...partial, content: [] } } },
		});
		release();
		await settle();
		expect(store.getSnapshot().focus?.transcript.live.size).toBe(1);
		store.dispose();
	});

	test("a response that outlives its focus is ignored", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B"), rosterEntry("C")];
		client.chunks = [userChunk("u1", "x"), userChunk("u2", "y", { sentinel: "t" })];
		let release: () => void = () => {};
		client.subscribeGate = new Promise<void>(resolve => {
			release = resolve;
		});
		client.snapshots = { "A.B": { streamMessage: partial, activeToolUpdates: [toolUpdate("call-1", "stale")] } };
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		await store.focusAgent("C");
		await settle();
		release();
		await settle();
		const focus = store.getSnapshot().focus;
		expect(focus?.agentId).toBe("C");
		expect(focus?.transcript.activeTools.size).toBe(0);
		expect(focus?.transcript.live.size).toBe(0);
		store.dispose();
	});

	test("a response after leaving focus is ignored, and a host without snapshots leaves the view unchanged", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		let release: () => void = () => {};
		client.subscribeGate = new Promise<void>(resolve => {
			release = resolve;
		});
		client.snapshots = { "A.B": { streamMessage: partial, activeToolUpdates: [toolUpdate("call-1", "stale")] } };
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		await store.focusAgent("Main");
		release();
		await settle();
		expect(store.getSnapshot().focus).toBeNull();

		const legacy = new FakeClient();
		legacy.roster = [rosterEntry("A.B")];
		legacy.chunks = [userChunk("u1", "x")];
		const legacyStore = makeStore(legacy);
		await legacyStore.focusAgent("A.B");
		await settle();
		expect(legacyStore.getSnapshot().focus?.transcript.activeTools.size).toBe(0);
		store.dispose();
		legacyStore.dispose();
	});

	test("a snapshot with only a start makes the card running before any live frame", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		client.snapshots = {
			"A.B": {
				streamMessage: partial,
				activeToolStarts: [toolStart("call-silent", "sleep 30")],
				activeToolUpdates: [],
			},
		};
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		const transcript = store.getSnapshot().focus?.transcript;
		expect(transcript?.activeTools.size).toBe(1);
		const tool = transcript?.activeTools.get("call-silent");
		expect(tool?.toolName).toBe("bash");
		expect(tool?.args).toEqual({ command: "sleep 30" });
		expect(tool?.intent).toBe("Run command");
		expect(tool?.partialResult).toBeUndefined();
		store.dispose();
	});

	test("an old-host snapshot without activeToolStarts still works", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "x")];
		// Old host snapshot without activeToolStarts field
		client.snapshots = {
			"A.B": {
				streamMessage: partial,
				activeToolUpdates: [toolUpdate("call-1", "line 1")],
			},
		};
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		const transcript = store.getSnapshot().focus?.transcript;
		expect(transcript?.activeTools.size).toBe(1);
		expect(transcript?.activeTools.get("call-1")?.partialResult).toBe("line 1");
		store.dispose();
	});

	test("a snapshot start is ignored if the tool result was already loaded in the transcript", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		// Transcript already has the toolResult message for call-finished
		const chunk = {
			sessionFile: "/tmp/a.jsonl",
			fromByte: 0,
			nextByte: 20,
			reset: false,
			fileId: "1:1",
			sentinel: "s",
			entries: [
				{
					type: "message",
					id: "u1",
					parentId: null,
					timestamp: "2026-01-01T00:00:00Z",
					message: { role: "user", content: "hi", timestamp: 1 },
				},
				{
					type: "message",
					id: "tr1",
					parentId: "u1",
					timestamp: "2026-01-01T00:00:01Z",
					message: {
						role: "toolResult",
						toolCallId: "call-finished",
						toolName: "bash",
						content: [{ type: "text", text: "done" }],
						timestamp: 2,
					},
				},
			],
			messages: [],
		} as unknown as RpcServerSubagentMessagesResult;
		client.chunks = [chunk];
		client.snapshots = {
			"A.B": {
				streamMessage: null,
				activeToolStarts: [toolStart("call-finished")],
				activeToolUpdates: [],
			},
		};
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		const transcript = store.getSnapshot().focus?.transcript;
		// Should NOT be added to activeTools because result is already in entries
		expect(transcript?.activeTools.has("call-finished")).toBe(false);
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

describe("focus todos", () => {
	const todoEntry = (id: string, phases: unknown, over: Record<string, unknown> = {}) => ({
		type: "message",
		id,
		parentId: null,
		timestamp: "2026-01-01T00:00:00Z",
		message: {
			role: "toolResult",
			toolCallId: `c-${id}`,
			toolName: "todo",
			isError: false,
			content: [{ type: "text", text: "ok" }],
			details: { op: "replace", phases, ...over },
			timestamp: 1,
		},
	});
	const phases = (closed: number): TodoPhase[] => [
		{
			name: "P",
			tasks: [
				{ content: "a", status: closed > 0 ? "completed" : "pending" },
				{ content: "b", status: closed > 1 ? "completed" : "pending" },
			],
		},
	];
	const chunkWith = (entries: unknown[], fromByte: number, nextByte: number) =>
		userChunk("unused", "", { entries: entries as never, fromByte, nextByte });

	test("the focused agent's todos come from its polled entries and follow later results", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [chunkWith([todoEntry("t1", phases(1))], 0, 10)];
		const store = makeStore(client);
		expect(store.getSnapshot().focus).toBeNull();
		await store.focusAgent("A.B");
		await settle();
		expect(store.getSnapshot().focus?.todoPhases).toEqual(phases(1));

		// A finished todo call persists; the event-driven poll picks up the new entry.
		client.chunks = [chunkWith([todoEntry("t2", phases(2))], 10, 20)];
		client.emit({
			type: "subagent_event",
			payload: { id: "A.B", event: { type: "tool_execution_end", toolName: "todo", toolCallId: "c" } },
		});
		await new Promise(r => setTimeout(r, 200));
		await settle();
		expect(store.getSnapshot().focus?.todoPhases).toEqual(phases(2));
		store.dispose();
	});

	test("Main's todos are untouched by the focused list and unfocus drops it", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [chunkWith([todoEntry("t1", phases(1))], 0, 10)];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		expect(store.getSnapshot().focus?.todoPhases).toHaveLength(1);
		expect(store.getSnapshot().sessionState?.todoPhases).toBeUndefined();
		store.unfocus();
		expect(store.getSnapshot().focus).toBeNull();
		expect(client.types()).not.toContain("set_todos");
		store.dispose();
	});

	test("an agent without todo entries has an empty list", async () => {
		const client = new FakeClient();
		client.roster = [rosterEntry("A.B")];
		client.chunks = [userChunk("u1", "task text")];
		const store = makeStore(client);
		await store.focusAgent("A.B");
		await settle();
		expect(store.getSnapshot().focus?.todoPhases).toEqual([]);
		store.dispose();
	});
});

describe("focus poll visibility", () => {
	test("pauses the focused-agent poll while the page is hidden and polls once on return", async () => {
		vi.useFakeTimers();
		try {
			let hidden = false;
			const visibilityListeners = new Set<() => void>();
			const page = {
				get hidden() {
					return hidden;
				},
				addEventListener: (_t: "visibilitychange", fn: () => void) => visibilityListeners.add(fn),
				removeEventListener: (_t: "visibilitychange", fn: () => void) => visibilityListeners.delete(fn),
			};
			const setHidden = (next: boolean) => {
				hidden = next;
				for (const fn of visibilityListeners) fn();
			};
			const client = new FakeClient();
			client.roster = [rosterEntry("A.B")];
			client.chunks = [userChunk("u1", "task text")];
			const store = createSessionStore(client as unknown as RpcWebClient, { page });
			await store.focusAgent("A.B");
			await settle();
			const polls = () => client.types().filter(t => t === "get_subagent_messages").length;
			const afterFocus = polls();
			expect(afterFocus).toBe(1);

			setHidden(true);
			vi.advanceTimersByTime(30_000);
			await settle();
			expect(polls()).toBe(afterFocus);

			setHidden(false);
			await settle();
			expect(polls()).toBe(afterFocus + 1);
			vi.advanceTimersByTime(3_000);
			await settle();
			expect(polls()).toBe(afterFocus + 2);
			store.dispose();
		} finally {
			vi.useRealTimers();
		}
	});
});
