import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentRegistryFrame } from "@oh-my-pi/pi-wire";
import { AgentLifecycleManager } from "../src/registry/agent-lifecycle";
import { AgentRegistry, type RegisterInput } from "../src/registry/agent-registry";
import type { AgentSession } from "../src/session/agent-session";
import {
	killRpcAgent,
	resolveRegistryAgentSessionFile,
	reviveRpcAgent,
	RpcAgentRoster,
	steerRpcAgent,
} from "../src/modes/rpc/rpc-agent-roster";
import { readRpcSubagentTranscript } from "../src/modes/rpc/rpc-subagents";

interface FakeSession {
	prompts: Array<{ text: string; options: unknown }>;
	aborted: number;
	disposed: number;
}

function fakeSession(): { session: AgentSession; state: FakeSession } {
	const state: FakeSession = { prompts: [], aborted: 0, disposed: 0 };
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

beforeEach(() => {
	AgentRegistry.resetGlobalForTests();
	AgentLifecycleManager.resetGlobalForTests();
});

afterEach(() => {
	AgentLifecycleManager.resetGlobalForTests();
	for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("RpcAgentRoster.getRoster", () => {
	test("lists nested ids with registry parents, parked and aborted agents, and hides advisors", async () => {
		register({ id: "Main", kind: "main", status: "running" });
		register({ id: "A", kind: "sub", parentId: "Main", status: "idle", session: fakeSession().session });
		register({ id: "A.B", kind: "sub", parentId: "A", status: "parked", sessionFile: "/tmp/a-b.jsonl" });
		register({ id: "A.B.C", kind: "sub", parentId: "A.B", status: "aborted" });
		register({ id: "Advisor1", kind: "advisor", parentId: "Main", status: "parked" });

		const roster = new RpcAgentRoster(
			() => {},
			undefined,
			() => undefined,
		);
		const agents = await roster.getRoster();
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
		const [entry] = await new RpcAgentRoster(
			() => {},
			undefined,
			() => undefined,
		).getRoster();
		expect(entry.agent).toBe("explore");
		expect(entry.modelRole).toBe("smol");
		expect(entry.resolvedModel).toBe("anthropic/x");
		expect(entry.metrics).toMatchObject({ tokens: 10, requests: 2, tools: 3, cost: 0.5, durationMs: 99 });
	});
});

describe("agent roster subscription", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});
	test("is off by default, then coalesces registry changes per id into one frame", () => {
		const frames: AgentRegistryFrame[] = [];
		const roster = new RpcAgentRoster(
			frame => frames.push(frame),
			undefined,
			() => undefined,
		);
		try {
			expect(roster.enabled).toBe(false);
			register({ id: "Quiet", kind: "sub", parentId: "Main", status: "running" });
			vi.advanceTimersByTime(250);
			expect(frames).toEqual([]);

			roster.setEnabled(true);
			const ref = register({ id: "A", kind: "sub", parentId: "Main", status: "running" });
			AgentRegistry.global().setStatus("A", "idle", ref);
			AgentRegistry.global().setStatus("A", "running", ref);
			vi.advanceTimersByTime(300);
			expect(frames).toHaveLength(1);
			const [frame] = frames;
			expect(frame.op).toBe("upsert");
			if (frame.op !== "upsert") throw new Error("unreachable");
			expect(frame.agent).toMatchObject({ id: "A", parentId: "Main", status: "running" });

			AgentRegistry.global().unregister("A");
			vi.advanceTimersByTime(300);
			expect(frames.at(-1)).toEqual({ type: "agent_registry", op: "removed", id: "A" });
		} finally {
			roster.dispose();
		}
	});

	test("emits nothing for advisors and stops after being disabled", async () => {
		const frames: AgentRegistryFrame[] = [];
		const roster = new RpcAgentRoster(
			frame => frames.push(frame),
			undefined,
			() => undefined,
		);
		try {
			roster.setEnabled(true);
			register({ id: "Adv", kind: "advisor", parentId: "Main", status: "parked" });
			vi.advanceTimersByTime(250);
			expect(frames).toEqual([]);

			roster.setEnabled(false);
			register({ id: "B", kind: "sub", parentId: "Main", status: "running" });
			vi.advanceTimersByTime(250);
			expect(frames).toEqual([]);
		} finally {
			roster.dispose();
		}
	});
});

describe("kill_agent / revive_agent / steer_agent", () => {
	test("reject unknown ids, Main, and advisors", async () => {
		register({ id: "Main", kind: "main", status: "running" });
		register({ id: "Adv", kind: "advisor", parentId: "Main", status: "parked", sessionFile: "/tmp/adv.jsonl" });
		for (const id of ["Nope", "Main", "Adv"]) {
			await expect(killRpcAgent(id)).rejects.toThrow();
			await expect(reviveRpcAgent(id)).rejects.toThrow();
			await expect(steerRpcAgent(id, "hi")).rejects.toThrow();
		}
	});

	test("revive and steer reject aborted agents", async () => {
		register({ id: "Dead", kind: "sub", parentId: "Main", status: "aborted" });
		await expect(reviveRpcAgent("Dead")).rejects.toThrow(/killed/);
		await expect(steerRpcAgent("Dead", "hi")).rejects.toThrow(/killed/);
	});

	test("steer prompts a live agent with steer behavior and rejects empty messages", async () => {
		const { session, state } = fakeSession();
		register({ id: "A", kind: "sub", parentId: "Main", status: "idle", session });
		await expect(steerRpcAgent("A", "   ")).rejects.toThrow(/message/);
		await steerRpcAgent("A", " look here ");
		expect(state.prompts).toEqual([{ text: "look here", options: { streamingBehavior: "steer" } }]);
	});

	test("revive returns the live session of a running agent", async () => {
		const { session } = fakeSession();
		register({ id: "A", kind: "sub", parentId: "Main", status: "idle", session });
		await reviveRpcAgent("A");
	});

	test("kill aborts a running session and leaves an aborted tombstone", async () => {
		const dir = tempDir();
		const { session, state } = fakeSession();
		const ref = register({
			id: "A",
			kind: "sub",
			parentId: "Main",
			status: "running",
			session,
			sessionFile: path.join(dir, "A.jsonl"),
		});
		await killRpcAgent("A");
		expect(state.aborted).toBe(1);
		expect(state.disposed).toBe(1);
		expect(ref.status).toBe("aborted");
		expect(AgentRegistry.global().get("A")?.status).toBe("aborted");
	});
});

describe("get_subagent_messages by registry id", () => {
	test("resolves a parked agent's transcript from the registry", async () => {
		const dir = tempDir();
		const file = path.join(dir, "A.jsonl");
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

		expect(resolveRegistryAgentSessionFile("A")).toBe(file);
		expect(resolveRegistryAgentSessionFile("NoFile")).toBeUndefined();
		expect(resolveRegistryAgentSessionFile("Missing")).toBeUndefined();
		const result = await readRpcSubagentTranscript(file);
		expect(result.messages).toHaveLength(1);
	});
});
