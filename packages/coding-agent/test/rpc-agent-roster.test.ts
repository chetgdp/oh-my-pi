import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import { AgentLifecycleManager } from "../src/registry/agent-lifecycle";
import { AgentRegistry, type RegisterInput } from "../src/registry/agent-registry";
import type { AgentSession } from "../src/session/agent-session";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";
import { TASK_SUBAGENT_EVENT_CHANNEL, type SubagentEventPayload } from "../src/task";
import { EventBus } from "../src/utils/event-bus";

interface FakeAgent {
	prompts: Array<{ text: string; options: unknown }>;
	aborted: number;
	disposed: number;
}

function fakeAgentSession(): { session: AgentSession; state: FakeAgent } {
	const state: FakeAgent = { prompts: [], aborted: 0, disposed: 0 };
	const session = {
		isStreaming: false,
		async prompt(text: string, options: unknown) {
			state.prompts.push({ text, options });
		},
		async abort() {
			state.aborted++;
		},
		async dispose() {
			state.disposed++;
		},
	};
	return { session: session as unknown as AgentSession, state };
}

const tempDirs: string[] = [];
function tempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-rpc-roster-"));
	tempDirs.push(dir);
	return dir;
}

function register(input: Partial<RegisterInput> & Pick<RegisterInput, "id" | "kind">) {
	return AgentRegistry.global().register({
		displayName: input.id.slice(input.id.lastIndexOf(".") + 1),
		session: null,
		...input,
	});
}

type Frame = Record<string, unknown>;

interface Harness {
	bus: EventBus;
	frames: Frame[];
	send(cmd: Frame): Promise<Frame>;
	waitForFrame(predicate: (f: Frame) => boolean): Promise<Frame>;
	close(): void;
}

function createHarness(): Harness {
	const sessionManager = SessionManager.create("/tmp/test", "/tmp/test", new MemorySessionStorage());
	const session = {
		sessionManager,
		obfuscator: undefined,
		agent: { state: { streamMessage: null, tools: [] } },
		subscribe: () => () => {},
		subscribeCommandMetadataChanged: () => () => {},
		registerPersistenceFailureCallback: () => () => {},
		setSlashCommands() {},
		isFastModeEnabled: () => false,
		isFastModeActive: () => false,
		getTodoPhases: () => [],
		state: { sessionId: "s", cwd: "/tmp/test" },
		messages: [],
		extensions: [],
		skills: [],
		skillsSettings: null,
		customCommands: [],
		mcpPromptCommands: [],
		sessionId: "s",
		sessionName: "test",
		model: "test-model",
		thinkingLevel: null,
		isStreaming: false,
		isCompacting: false,
		steeringMode: "all",
		followUpMode: "all",
		interruptMode: "immediate",
		sessionFile: undefined,
		autoCompactionEnabled: false,
		queuedMessageCount: 0,
		systemPrompt: "",
		availableModels: [],
		effectiveExtensionRoots: [],
		settings: { hostTools: [], onEffectiveChange: () => () => {} },
	};

	const input = new PassThrough();
	const output = new PassThrough();
	const frames: Frame[] = [];
	const waiters: Array<{ predicate: (f: Frame) => boolean; resolve: (f: Frame) => void }> = [];
	let buffer = "";
	output.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			const parsed = JSON.parse(line) as Frame;
			frames.push(parsed);
			for (let i = waiters.length - 1; i >= 0; i--) {
				if (waiters[i].predicate(parsed)) waiters.splice(i, 1)[0].resolve(parsed);
			}
		}
	});

	const bus = new EventBus();
	const server = serveRpc(
		session as unknown as AgentSession,
		{ input: Readable.toWeb(input) as ReadableStream<Uint8Array>, output },
		{ onShutdown: () => {}, onWriteFailure: () => {}, subagentEventBus: bus },
	);

	let seq = 0;
	function send(cmd: Frame): Promise<Frame> {
		const id = `cmd_${seq++}`;
		const { promise, resolve } = Promise.withResolvers<Frame>();
		waiters.push({ predicate: f => f.type === "response" && f.id === id, resolve });
		input.write(`${JSON.stringify({ ...cmd, id })}\n`);
		return promise;
	}

	function waitForFrame(predicate: (f: Frame) => boolean): Promise<Frame> {
		const existing = frames.find(predicate);
		if (existing) return Promise.resolve(existing);
		const { promise, resolve } = Promise.withResolvers<Frame>();
		waiters.push({ predicate, resolve });
		return promise;
	}

	return {
		bus,
		frames,
		send,
		waitForFrame,
		close() {
			input.end();
			server.close();
		},
	};
}

let harness: Harness;

/** Runs `mutate` under fake timers and fires the roster coalescing window, so no wall-clock wait is needed. */
function coalesceRosterFrames(mutate: () => void): void {
	vi.useFakeTimers();
	try {
		mutate();
		vi.advanceTimersByTime(300);
	} finally {
		vi.useRealTimers();
	}
}

beforeEach(() => {
	AgentRegistry.resetGlobalForTests();
	AgentLifecycleManager.resetGlobalForTests();
	harness = createHarness();
});

afterEach(() => {
	harness.close();
	AgentLifecycleManager.resetGlobalForTests();
	for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("get_agent_roster", () => {
	test("lists nested ids with registry parents, parked and aborted agents, and hides advisors", async () => {
		register({ id: "Main", kind: "main", status: "running" });
		register({ id: "A", kind: "sub", parentId: "Main", status: "idle", session: fakeAgentSession().session });
		register({ id: "A.B", kind: "sub", parentId: "A", status: "parked", sessionFile: "/tmp/a-b.jsonl" });
		register({ id: "A.B.C", kind: "sub", parentId: "A.B", status: "aborted" });
		register({ id: "Advisor1", kind: "advisor", parentId: "Main", status: "parked" });

		const response = await harness.send({ type: "get_agent_roster" });
		expect(response.success).toBe(true);
		const agents = (response.data as { agents: Array<Record<string, unknown>> }).agents;
		const byId = new Map(agents.map(agent => [agent.id, agent]));

		expect([...byId.keys()].sort()).toEqual(["A", "A.B", "A.B.C", "Main"]);
		expect(byId.get("Main")?.kind).toBe("main");
		expect(byId.get("A")?.parentId).toBe("Main");
		expect(byId.get("A.B")?.parentId).toBe("A");
		expect(byId.get("A.B.C")?.parentId).toBe("A.B");
		expect(byId.get("A.B")?.status).toBe("parked");
		expect(byId.get("A.B")?.sessionFile).toBe("/tmp/a-b.jsonl");
		expect(byId.get("A.B.C")?.status).toBe("aborted");
		expect(byId.get("A.B.C")?.sessionFile).toBeUndefined();
	});

	test("takes metrics from history when no live progress exists", async () => {
		register({
			id: "A",
			kind: "sub",
			parentId: "Main",
			status: "parked",
			history: {
				agent: "explore",
				modelRole: "smol",
				resolvedModel: "anthropic/x",
				metrics: { tokens: 10, requests: 2, tools: 3, cost: 0.5, durationMs: 99 },
			},
		});
		const response = await harness.send({ type: "get_agent_roster" });
		const [entry] = (response.data as { agents: Array<Record<string, unknown>> }).agents;
		expect(entry.agent).toBe("explore");
		expect(entry.modelRole).toBe("smol");
		expect(entry.resolvedModel).toBe("anthropic/x");
		expect(entry.metrics).toMatchObject({ tokens: 10, requests: 2, tools: 3, cost: 0.5, durationMs: 99 });
	});
});

describe("set_agent_roster_subscription", () => {
	test("is off by default, then streams coalesced upsert and removed frames until disabled", async () => {
		coalesceRosterFrames(() => register({ id: "Quiet", kind: "sub", parentId: "Main", status: "running" }));
		await harness.send({ type: "get_agent_roster" });
		expect(harness.frames.filter(f => f.type === "agent_registry")).toEqual([]);

		expect((await harness.send({ type: "set_agent_roster_subscription", enabled: "yes" })).success).toBe(false);
		const enabled = await harness.send({ type: "set_agent_roster_subscription", enabled: true });
		expect(enabled.data).toEqual({ enabled: true });

		coalesceRosterFrames(() => {
			const ref = register({ id: "A", kind: "sub", parentId: "Main", status: "running" });
			AgentRegistry.global().setStatus("A", "idle", ref);
			AgentRegistry.global().setStatus("A", "running", ref);
		});
		const upsert = await harness.waitForFrame(f => f.type === "agent_registry" && f.op === "upsert");
		expect(upsert.agent).toMatchObject({ id: "A", parentId: "Main", status: "running" });
		expect(harness.frames.filter(f => f.type === "agent_registry")).toHaveLength(1);

		coalesceRosterFrames(() => AgentRegistry.global().unregister("A"));
		const removed = await harness.waitForFrame(f => f.type === "agent_registry" && f.op === "removed");
		expect(removed).toEqual({ type: "agent_registry", op: "removed", id: "A" });

		coalesceRosterFrames(() => register({ id: "Adv", kind: "advisor", parentId: "Main", status: "parked" }));
		await harness.send({ type: "set_agent_roster_subscription", enabled: false });
		coalesceRosterFrames(() => register({ id: "B", kind: "sub", parentId: "Main", status: "running" }));
		await harness.send({ type: "get_agent_roster" });
		expect(harness.frames.filter(f => f.type === "agent_registry")).toHaveLength(2);
	});
});

describe("kill_agent / revive_agent / steer_agent / interrupt_agent", () => {
	test("reject unknown ids, Main, and advisors", async () => {
		register({ id: "Main", kind: "main", status: "running" });
		register({ id: "Adv", kind: "advisor", parentId: "Main", status: "parked", sessionFile: "/tmp/adv.jsonl" });
		for (const agentId of ["Nope", "Main", "Adv"]) {
			for (const type of ["kill_agent", "revive_agent", "steer_agent", "interrupt_agent"]) {
				const response = await harness.send({ type, agentId, message: "hi" });
				expect(response).toMatchObject({ command: type, success: false });
			}
		}
	});

	test("revive, steer, and interrupt reject aborted agents", async () => {
		register({ id: "Dead", kind: "sub", parentId: "Main", status: "aborted" });
		for (const type of ["revive_agent", "steer_agent", "interrupt_agent"]) {
			const response = await harness.send({ type, agentId: "Dead", message: "hi" });
			expect(response.success).toBe(false);
			expect(String(response.error)).toMatch(/killed/);
		}
	});

	test("steer prompts a live agent, honours mode, and rejects empty messages or unknown modes", async () => {
		const { session, state } = fakeAgentSession();
		register({ id: "A", kind: "sub", parentId: "Main", status: "idle", session });
		expect((await harness.send({ type: "steer_agent", agentId: "A", message: "   " })).success).toBe(false);
		expect((await harness.send({ type: "steer_agent", agentId: "A", message: "x", mode: "bogus" })).success).toBe(
			false,
		);
		expect(await harness.send({ type: "steer_agent", agentId: "A", message: " look here " })).toMatchObject({
			success: true,
			data: { agentId: "A" },
		});
		await harness.send({ type: "steer_agent", agentId: "A", message: "later", mode: "followUp" });
		expect(state.prompts).toEqual([
			{ text: "look here", options: { streamingBehavior: "steer" } },
			{ text: "later", options: { streamingBehavior: "followUp" } },
		]);
	});

	test("interrupt aborts the current turn of a live agent without releasing it", async () => {
		const { session, state } = fakeAgentSession();
		const ref = register({ id: "A", kind: "sub", parentId: "Main", status: "running", session });
		const response = await harness.send({ type: "interrupt_agent", agentId: "A" });
		expect(response).toMatchObject({ success: true, data: { agentId: "A" } });
		expect(state.aborted).toBe(1);
		expect(state.disposed).toBe(0);
		expect(ref.status).toBe("running");
	});

	test("interrupt rejects a parked agent with no live session", async () => {
		register({ id: "P", kind: "sub", parentId: "Main", status: "parked", sessionFile: "/tmp/p.jsonl" });
		const response = await harness.send({ type: "interrupt_agent", agentId: "P" });
		expect(response.success).toBe(false);
		expect(String(response.error)).toMatch(/not live/);
	});

	test("revive succeeds for a live agent", async () => {
		register({ id: "A", kind: "sub", parentId: "Main", status: "idle", session: fakeAgentSession().session });
		expect(await harness.send({ type: "revive_agent", agentId: "A" })).toMatchObject({ success: true });
	});

	test("kill aborts a running session and leaves an aborted tombstone", async () => {
		const { session, state } = fakeAgentSession();
		const ref = register({
			id: "A",
			kind: "sub",
			parentId: "Main",
			status: "running",
			session,
			sessionFile: path.join(tempDir(), "A.jsonl"),
		});
		expect(await harness.send({ type: "kill_agent", agentId: "A" })).toMatchObject({ success: true });
		expect(state.aborted).toBe(1);
		expect(state.disposed).toBe(1);
		expect(ref.status).toBe("aborted");
		expect(AgentRegistry.global().get("A")?.status).toBe("aborted");
	});
});

describe("get_subagent_messages by registry id", () => {
	test("resolves a parked agent's transcript from the registry and rejects unknown ids", async () => {
		const file = path.join(tempDir(), "A.jsonl");
		const entry = {
			type: "message",
			id: "1",
			parentId: null,
			timestamp: new Date().toISOString(),
			message: { role: "user", content: "hi" },
		};
		fs.writeFileSync(file, `${JSON.stringify(entry)}\n`);
		register({ id: "A", kind: "sub", parentId: "Main", status: "parked", sessionFile: file });
		register({ id: "NoFile", kind: "sub", parentId: "Main", status: "parked" });

		const ok = await harness.send({ type: "get_subagent_messages", subagentId: "A" });
		expect(ok.success).toBe(true);
		expect((ok.data as { messages: unknown[] }).messages).toHaveLength(1);
		expect((await harness.send({ type: "get_subagent_messages", subagentId: "NoFile" })).success).toBe(false);
		expect((await harness.send({ type: "get_subagent_messages", subagentId: "Missing" })).success).toBe(false);
	});
});

describe("set_subagent_subscription ids filter", () => {
	function emitEvent(id: string): void {
		harness.bus.emit(TASK_SUBAGENT_EVENT_CHANNEL, {
			id,
			event: { type: "agent_start" },
		} as SubagentEventPayload);
	}

	function eventIds(): string[] {
		return harness.frames.filter(f => f.type === "subagent_event").map(f => (f.payload as { id: string }).id);
	}

	test("forwards only listed ids, and omitted ids restores every agent", async () => {
		const set = await harness.send({ type: "set_subagent_subscription", level: "events", ids: ["A"] });
		expect(set.data).toEqual({ level: "events" });
		emitEvent("A");
		emitEvent("B");
		await harness.send({ type: "get_subagents" });
		expect(eventIds()).toEqual(["A"]);

		await harness.send({ type: "set_subagent_subscription", level: "events" });
		emitEvent("B");
		await harness.send({ type: "get_subagents" });
		expect(eventIds()).toEqual(["A", "B"]);
	});

	test("leaving events level drops the filter and rejects malformed ids", async () => {
		await harness.send({ type: "set_subagent_subscription", level: "events", ids: ["A"] });
		await harness.send({ type: "set_subagent_subscription", level: "progress" });
		await harness.send({ type: "set_subagent_subscription", level: "events" });
		emitEvent("B");
		await harness.send({ type: "get_subagents" });
		expect(eventIds()).toEqual(["B"]);

		const bad = await harness.send({ type: "set_subagent_subscription", level: "events", ids: [1] });
		expect(bad.success).toBe(false);
	});
});
