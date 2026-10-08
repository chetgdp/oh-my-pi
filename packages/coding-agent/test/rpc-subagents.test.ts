import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ImageContent } from "@oh-my-pi/pi-ai";
import { RpcClient } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-client";
import {
	handleRpcSessionChange,
	type RpcSessionChangeCommand,
	type RpcSessionChangeResult,
	type RpcSessionChangeSession,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-mode";
import { RpcAgentRoster } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-agent-roster";
import { RpcSubagentRegistry, readRpcSubagentTranscript } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-subagents";
import type { RpcSubagentFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { type AgentProgress } from "@oh-my-pi/pi-tui/tools/task";
import {
	type SubagentEventPayload,
	type SubagentLifecyclePayload,
	type SubagentProgressPayload,
	TASK_SUBAGENT_EVENT_CHANNEL,
	TASK_SUBAGENT_LIFECYCLE_CHANNEL,
	TASK_SUBAGENT_PROGRESS_CHANNEL,
} from "@oh-my-pi/pi-coding-agent/task";
import { EventBus } from "@oh-my-pi/pi-coding-agent/utils/event-bus";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";

const tempPaths: string[] = [];

afterEach(() => {
	for (const tempPath of tempPaths.splice(0)) {
		removeSyncWithRetries(tempPath);
	}
});

function createProgress(overrides: Partial<AgentProgress> = {}): AgentProgress {
	return {
		index: 0,
		id: "SubagentA",
		agent: "task",
		agentSource: "bundled",
		status: "running",
		task: "Do work",
		assignment: "Implement work",
		description: "Worker",
		recentTools: [],
		recentOutput: [],
		toolCount: 0,
		requests: 0,
		tokens: 0,
		cost: 0,
		durationMs: 0,
		...overrides,
	};
}

function createRegistryWithSnapshot(): RpcSubagentRegistry {
	const eventBus = new EventBus();
	const registry = new RpcSubagentRegistry(eventBus, () => {});
	eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
		id: "SubagentA",
		index: 0,
		agent: "task",
		agentSource: "bundled",
		status: "started",
		sessionFile: "/tmp/subagent.jsonl",
	} satisfies SubagentLifecyclePayload);
	expect(registry.getSubagents()).toHaveLength(1);
	return registry;
}

type SessionChangeStubOptions = {
	newSession?: boolean;
	switchSession?: boolean;
	branch?: { selectedText: string; selectedImages: ImageContent[]; cancelled: boolean };
	fork?: boolean;
};

function createSessionChangeSession(options: SessionChangeStubOptions): RpcSessionChangeSession {
	return {
		newSession: async (_options?: unknown) => options.newSession ?? true,
		switchSession: async (_sessionPath: string) => options.switchSession ?? true,
		branch: async (_entryId: string) =>
			options.branch ?? { selectedText: "branched text", selectedImages: [], cancelled: false },
		fork: async (_entryId?: string) => options.fork ?? true,
	};
}

describe("RPC subagent registry", () => {
	test("defaults subagent frame emission to off while tracking snapshots", () => {
		const frames: RpcSubagentFrame[] = [];
		const eventBus = new EventBus();
		const registry = new RpcSubagentRegistry(eventBus, frame => frames.push(frame));
		const lifecycle: SubagentLifecyclePayload = {
			id: "SubagentA",
			index: 0,
			agent: "task",
			agentSource: "bundled",
			description: "Worker",
			status: "started",
			sessionFile: "/tmp/subagent.jsonl",
			parentToolCallId: "toolu_parent",
		};
		const progressPayload: SubagentProgressPayload = {
			index: 0,
			agent: "task",
			agentSource: "bundled",
			task: "Do work",
			assignment: "Implement work",
			parentToolCallId: "toolu_parent",
			sessionFile: "/tmp/subagent.jsonl",
			progress: createProgress(),
		};
		const eventPayload: SubagentEventPayload = {
			id: "SubagentA",
			event: { type: "agent_start" },
		};

		expect(registry.getSubscriptionLevel()).toBe("off");
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, lifecycle);
		eventBus.emit(TASK_SUBAGENT_PROGRESS_CHANNEL, progressPayload);
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, eventPayload);

		expect(frames).toHaveLength(0);
		expect(registry.getSubagents()).toMatchObject([
			{
				id: "SubagentA",
				status: "running",
				sessionFile: "/tmp/subagent.jsonl",
			},
		]);
		registry.dispose();
	});

	test("emits progress frames after explicit progress subscription and snapshots tracked subagents", () => {
		const frames: RpcSubagentFrame[] = [];
		const eventBus = new EventBus();
		const registry = new RpcSubagentRegistry(eventBus, frame => frames.push(frame));
		registry.setSubscriptionLevel("progress");
		const lifecycle: SubagentLifecyclePayload = {
			id: "SubagentA",
			index: 0,
			agent: "task",
			agentSource: "bundled",
			description: "Worker",
			status: "started",
			sessionFile: "/tmp/subagent.jsonl",
			parentToolCallId: "toolu_parent",
		};
		const progressPayload: SubagentProgressPayload = {
			index: 0,
			agent: "task",
			agentSource: "bundled",
			task: "Do work",
			assignment: "Implement work",
			parentToolCallId: "toolu_parent",
			sessionFile: "/tmp/subagent.jsonl",
			progress: createProgress(),
		};

		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, lifecycle);
		eventBus.emit(TASK_SUBAGENT_PROGRESS_CHANNEL, progressPayload);

		expect(frames.map(frame => frame.type)).toEqual(["subagent_lifecycle", "subagent_progress"]);
		expect(registry.getSubagents()).toMatchObject([
			{
				id: "SubagentA",
				status: "running",
				task: "Do work",
				assignment: "Implement work",
				sessionFile: "/tmp/subagent.jsonl",
				parentToolCallId: "toolu_parent",
			},
		]);

		registry.dispose();
	});

	test("clears stale snapshots after successful RPC session changes", async () => {
		const cases: Array<{
			command: RpcSessionChangeCommand;
			session: RpcSessionChangeSession;
			expected: RpcSessionChangeResult;
		}> = [
			{
				command: { type: "new_session", parentSession: "/tmp/parent.jsonl" },
				session: createSessionChangeSession({ newSession: true }),
				expected: { type: "new_session", data: { cancelled: false } },
			},
			{
				command: { type: "switch_session", sessionPath: "/tmp/next.jsonl" },
				session: createSessionChangeSession({ switchSession: true }),
				expected: { type: "switch_session", data: { cancelled: false } },
			},
			{
				command: { type: "branch", entryId: "entry-1" },
				session: createSessionChangeSession({
					branch: { selectedText: "Branch text", selectedImages: [], cancelled: false },
				}),
				expected: { type: "branch", data: { text: "Branch text", cancelled: false } },
			},
			{
				command: { type: "fork", entryId: "entry-1" },
				session: createSessionChangeSession({ fork: true }),
				expected: { type: "fork", data: { cancelled: false } },
			},
		];

		for (const testCase of cases) {
			const registry = createRegistryWithSnapshot();
			try {
				const result = await handleRpcSessionChange(testCase.session, testCase.command, registry);

				expect(result).toEqual(testCase.expected);
				expect(registry.getSubagents()).toHaveLength(0);
				expect(() => registry.resolveSessionFile({ subagentId: "SubagentA" })).toThrow(
					/Unknown subagent or session file unavailable/,
				);
			} finally {
				registry.dispose();
			}
		}
	});

	test("keeps stale snapshots when RPC session changes are cancelled", async () => {
		const cases: Array<{
			command: RpcSessionChangeCommand;
			session: RpcSessionChangeSession;
			expected: RpcSessionChangeResult;
		}> = [
			{
				command: { type: "new_session", parentSession: "/tmp/parent.jsonl" },
				session: createSessionChangeSession({ newSession: false }),
				expected: { type: "new_session", data: { cancelled: true } },
			},
			{
				command: { type: "switch_session", sessionPath: "/tmp/next.jsonl" },
				session: createSessionChangeSession({ switchSession: false }),
				expected: { type: "switch_session", data: { cancelled: true } },
			},
			{
				command: { type: "branch", entryId: "entry-1" },
				session: createSessionChangeSession({ branch: { selectedText: "", selectedImages: [], cancelled: true } }),
				expected: { type: "branch", data: { text: "", cancelled: true } },
			},
			{
				command: { type: "fork" },
				session: createSessionChangeSession({ fork: false }),
				expected: { type: "fork", data: { cancelled: true } },
			},
		];

		for (const testCase of cases) {
			const registry = createRegistryWithSnapshot();
			try {
				const result = await handleRpcSessionChange(testCase.session, testCase.command, registry);

				expect(result).toEqual(testCase.expected);
				expect(registry.getSubagents()).toMatchObject([{ id: "SubagentA" }]);
				expect(registry.resolveSessionFile({ subagentId: "SubagentA" })).toBe("/tmp/subagent.jsonl");
			} finally {
				registry.dispose();
			}
		}
	});

	test("prunes terminal lifecycle snapshots while retaining transcript selectors", () => {
		const eventBus = new EventBus();
		const registry = new RpcSubagentRegistry(eventBus, () => {});
		const sessionFile = "/tmp/subagent.jsonl";
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
			id: "SubagentA",
			index: 0,
			agent: "task",
			agentSource: "bundled",
			status: "started",
			sessionFile,
		} satisfies SubagentLifecyclePayload);

		expect(registry.getSubagents()).toHaveLength(1);
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
			id: "SubagentA",
			index: 0,
			agent: "task",
			agentSource: "bundled",
			status: "completed",
			sessionFile,
		} satisfies SubagentLifecyclePayload);

		expect(registry.getSubagents()).toHaveLength(0);
		expect(registry.resolveSessionFile({ subagentId: "SubagentA" })).toBe(sessionFile);
		expect(registry.resolveSessionFile({ sessionFile })).toBe(sessionFile);
		registry.dispose();
	});

	test("a connection opened mid-run sees a revived subagent and its progress", () => {
		const eventBus = new EventBus();
		const sessionFile = "/tmp/revived.jsonl";
		const lifecycle = (status: SubagentLifecyclePayload["status"]): SubagentLifecyclePayload => ({
			id: "Revived",
			index: 0,
			agent: "task",
			agentSource: "bundled",
			status,
			parentToolCallId: "toolu_spawn",
			sessionFile,
		});
		const progressPayload: SubagentProgressPayload = {
			index: 0,
			agent: "task",
			agentSource: "bundled",
			task: "Second run",
			parentToolCallId: "toolu_spawn",
			sessionFile,
			progress: createProgress({ id: "Revived", task: "Second run" }),
		};
		const first = new RpcSubagentRegistry(eventBus, () => {});
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, lifecycle("started"));
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, lifecycle("completed"));
		// Parked, then woken by a peer message: the wake turn re-announces the same id.
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, lifecycle("started"));
		// The client reconnects while the second run is in flight.
		first.dispose();
		const frames: RpcSubagentFrame[] = [];
		const reconnected = new RpcSubagentRegistry(eventBus, frame => frames.push(frame));
		reconnected.setSubscriptionLevel("progress");

		expect(reconnected.getSubagents()).toMatchObject([
			{ id: "Revived", status: "running", parentToolCallId: "toolu_spawn" },
		]);
		eventBus.emit(TASK_SUBAGENT_PROGRESS_CHANNEL, progressPayload);
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, lifecycle("completed"));

		expect(frames.map(frame => frame.type)).toEqual(["subagent_progress", "subagent_lifecycle"]);
		expect(reconnected.getSubagents()).toEqual([]);
		expect(reconnected.resolveSessionFile({ subagentId: "Revived" })).toBe(sessionFile);
		reconnected.dispose();
	});

	test("a disposed connection stops receiving frames", () => {
		const eventBus = new EventBus();
		const frames: RpcSubagentFrame[] = [];
		const registry = new RpcSubagentRegistry(eventBus, frame => frames.push(frame));
		registry.setSubscriptionLevel("events");
		registry.dispose();
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
			id: "Late",
			index: 0,
			agent: "task",
			agentSource: "bundled",
			status: "started",
		} satisfies SubagentLifecyclePayload);
		expect(frames).toEqual([]);
	});

	test("omitPartial strips assistantMessageEvent.partial from relayed message_update only", () => {
		const eventBus = new EventBus();
		const plain: RpcSubagentFrame[] = [];
		const light: RpcSubagentFrame[] = [];
		const plainRegistry = new RpcSubagentRegistry(eventBus, frame => plain.push(frame));
		const lightRegistry = new RpcSubagentRegistry(eventBus, frame => light.push(frame));
		plainRegistry.setSubscriptionLevel("events");
		lightRegistry.setSubscriptionLevel("events", undefined, true);
		const message = { role: "assistant", content: [{ type: "text", text: "hi" }] };
		const update = {
			id: "SubagentA",
			event: {
				type: "message_update",
				message,
				assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hi", partial: message },
			},
		} as unknown as SubagentEventPayload;
		const start = { id: "SubagentA", event: { type: "message_start", message } } as unknown as SubagentEventPayload;
		const original = structuredClone(update);
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, start);
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, update);

		expect(plain.map(f => f.payload)).toEqual([start, update]);
		expect(light[0]?.payload).toBe(start);
		const stripped = {
			id: "SubagentA",
			event: {
				type: "message_update",
				message,
				assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hi" },
			},
		} as unknown as SubagentEventPayload;
		expect(light[1]?.payload).toEqual(stripped);
		// The shared payload other sinks see is untouched.
		expect(update).toEqual(original);
		plainRegistry.dispose();
		lightRegistry.dispose();
	});

	test("gates raw subagent events behind the events subscription level", () => {
		const frames: RpcSubagentFrame[] = [];
		const eventBus = new EventBus();
		const registry = new RpcSubagentRegistry(eventBus, frame => frames.push(frame));
		const eventPayload: SubagentEventPayload = {
			id: "SubagentA",
			event: { type: "agent_start" },
		};

		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, eventPayload);
		expect(frames).toHaveLength(0);

		registry.setSubscriptionLevel("events");
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, eventPayload);

		expect(frames).toHaveLength(1);
		expect(frames[0]).toEqual({ type: "subagent_event", payload: eventPayload });
		registry.setSubscriptionLevel("progress");
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, eventPayload);
		expect(frames).toHaveLength(1);
		registry.setSubscriptionLevel("events");
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, eventPayload);
		expect(frames).toHaveLength(2);
		registry.dispose();
		registry.setSubscriptionLevel("events");
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, eventPayload);
		expect(frames).toHaveLength(2);
	});

	test("subscribes the raw event channel only while some connection is at the events level", () => {
		class CountingBus extends EventBus {
			eventListeners = 0;
			override on(channel: string, handler: (data: unknown) => void): () => void {
				const off = super.on(channel, handler);
				if (channel !== TASK_SUBAGENT_EVENT_CHANNEL) return off;
				this.eventListeners++;
				let removed = false;
				return () => {
					if (!removed) this.eventListeners--;
					removed = true;
					return off();
				};
			}
		}
		const bus = new CountingBus();
		const first = new RpcSubagentRegistry(bus, () => {});
		const second = new RpcSubagentRegistry(bus, () => {});
		const roster = new RpcAgentRoster(
			() => {},
			first,
			() => undefined,
		);
		roster.setEnabled(true);
		first.setSubscriptionLevel("progress");
		second.setSubscriptionLevel("off");
		expect(bus.eventListeners).toBe(0);

		first.setSubscriptionLevel("events");
		second.setSubscriptionLevel("events");
		expect(bus.eventListeners).toBe(1);
		second.dispose();
		expect(bus.eventListeners).toBe(1);
		first.dispose();
		expect(bus.eventListeners).toBe(0);
		roster.setEnabled(false);
	});
});

describe("readRpcSubagentTranscript", () => {
	test("returns complete JSONL entries and byte cursor", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-rpc-subagent-transcript-"));
		tempPaths.push(dir);
		const sessionFile = path.join(dir, "session.jsonl");
		const headerLine = `${JSON.stringify({ type: "session", id: "s1", timestamp: "2026-06-09T00:00:00.000Z", cwd: dir })}\n`;
		const messageLine = `${JSON.stringify({
			type: "message",
			id: "m1",
			parentId: null,
			timestamp: "2026-06-09T00:00:00.000Z",
			message: { role: "user", content: [{ type: "text", text: "hello" }] },
		})}\n`;
		await Bun.write(sessionFile, `${headerLine}${messageLine}{"type":"message"`);

		const result = await readRpcSubagentTranscript(sessionFile);

		expect(result.entries).toHaveLength(2);
		expect(result.messages).toHaveLength(1);
		expect(result.nextByte).toBe(Buffer.byteLength(`${headerLine}${messageLine}`, "utf8"));
		expect(result.reset).toBe(false);
	});

	test("returns empty cursor result for missing transcript files", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-rpc-subagent-transcript-missing-"));
		tempPaths.push(dir);
		const sessionFile = path.join(dir, "missing.jsonl");

		const result = await readRpcSubagentTranscript(sessionFile, { fromByte: 42 });

		expect(result).toEqual({
			sessionFile,
			fromByte: 42,
			nextByte: 42,
			reset: false,
			fileId: "",
			sentinel: "",
			entries: [],
			messages: [],
		});
	});

	describe("rewrite detection", () => {
		const header = (id: string) =>
			`${JSON.stringify({ type: "session", id, timestamp: "2026-06-09T00:00:00.000Z", cwd: "/tmp" })}\n`;
		const line = (id: string, text: string) =>
			`${JSON.stringify({
				type: "message",
				id,
				parentId: null,
				timestamp: "2026-06-09T00:00:00.000Z",
				message: { role: "user", content: [{ type: "text", text }] },
			})}\n`;
		const tmpFile = () => {
			const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-rpc-subagent-rewrite-"));
			tempPaths.push(dir);
			return path.join(dir, "session.jsonl");
		};

		test("atomic rename rewrite with longer content resets", async () => {
			const sessionFile = tmpFile();
			await Bun.write(sessionFile, `${header("s1")}${line("m1", "old")}`);
			const first = await readRpcSubagentTranscript(sessionFile);
			const next = `${header("s2")}${line("n1", "brand new content that is much longer")}${line("n2", "more")}`;
			await Bun.write(`${sessionFile}.tmp`, next);
			fs.renameSync(`${sessionFile}.tmp`, sessionFile);

			const result = await readRpcSubagentTranscript(sessionFile, {
				fromByte: first.nextByte,
				fileId: first.fileId,
				sentinel: first.sentinel,
			});

			expect(result.reset).toBe(true);
			expect(result.fromByte).toBe(0);
			expect(result.entries).toHaveLength(3);
			expect(result.nextByte).toBe(Buffer.byteLength(next, "utf8"));
		});

		test("in-place rewrite of bytes before the cursor resets via sentinel", async () => {
			const sessionFile = tmpFile();
			await Bun.write(sessionFile, `${header("s1")}${line("m1", "aaaa")}`);
			const first = await readRpcSubagentTranscript(sessionFile);
			const next = `${header("s1")}${line("m1", "bbbb")}${line("m2", "tail")}`;
			const handle = fs.openSync(sessionFile, "r+");
			fs.writeSync(handle, next);
			fs.closeSync(handle);

			const result = await readRpcSubagentTranscript(sessionFile, {
				fromByte: first.nextByte,
				fileId: first.fileId,
				sentinel: first.sentinel,
			});

			expect(result.reset).toBe(true);
			expect(result.fromByte).toBe(0);
			expect(result.entries).toHaveLength(3);
		});

		test("plain append returns only new entries", async () => {
			const sessionFile = tmpFile();
			await Bun.write(sessionFile, `${header("s1")}${line("m1", "one")}`);
			const first = await readRpcSubagentTranscript(sessionFile);
			fs.appendFileSync(sessionFile, line("m2", "two"));

			const result = await readRpcSubagentTranscript(sessionFile, {
				fromByte: first.nextByte,
				fileId: first.fileId,
				sentinel: first.sentinel,
			});

			expect(result.reset).toBe(false);
			expect(result.fromByte).toBe(first.nextByte);
			expect(result.entries).toHaveLength(1);
		});
	});
});

describe("RpcClient subagent frames", () => {
	test("dispatches subagent frames and session-specific events", async () => {
		const scriptPath = path.join(os.tmpdir(), `omp-rpc-subagent-client-${Date.now()}.js`);
		tempPaths.push(scriptPath);
		await Bun.write(
			scriptPath,
			`
let buffer = "";
function write(frame) {
	process.stdout.write(JSON.stringify(frame) + "\\n");
}
const progress = {
	index: 0,
	id: "SubagentA",
	agent: "task",
	agentSource: "bundled",
	status: "running",
	task: "Do work",
	assignment: "Implement work",
	recentTools: [],
	recentOutput: [],
	toolCount: 0,
	tokens: 0,
	cost: 0,
	durationMs: 0
};
write({ type: "ready" });
process.stdin.on("data", chunk => {
	buffer += chunk.toString("utf8");
	let index = buffer.indexOf("\\n");
	while (index !== -1) {
		const line = buffer.slice(0, index).trim();
		buffer = buffer.slice(index + 1);
		if (line) handle(JSON.parse(line));
		index = buffer.indexOf("\\n");
	}
});
function handle(frame) {
	if (frame.type === "set_subagent_subscription") {
		write({ id: frame.id, type: "response", command: "set_subagent_subscription", success: true, data: { level: frame.level } });
		return;
	}
	if (frame.type === "get_subagents") {
		write({ id: frame.id, type: "response", command: "get_subagents", success: true, data: { subagents: [{ id: "SubagentA", index: 0, agent: "task", agentSource: "bundled", status: "running", lastUpdate: 1 }] } });
		return;
	}
	if (frame.type === "get_subagent_messages") {
		write({ id: frame.id, type: "response", command: "get_subagent_messages", success: true, data: { sessionFile: frame.sessionFile || "/tmp/subagent.jsonl", fromByte: frame.fromByte || 0, nextByte: 0, reset: false, entries: [], messages: [] } });
		return;
	}
	if (frame.type === "prompt") {
		write({ id: frame.id, type: "response", command: "prompt", success: true });
		write({ type: "notice", level: "info", message: "subagent test" });
		write({ type: "subagent_lifecycle", payload: { id: "SubagentA", index: 0, agent: "task", agentSource: "bundled", status: "started", sessionFile: "/tmp/subagent.jsonl" } });
		write({ type: "subagent_progress", payload: { index: 0, agent: "task", agentSource: "bundled", task: "Do work", assignment: "Implement work", sessionFile: "/tmp/subagent.jsonl", progress } });
		write({ type: "subagent_event", payload: { id: "SubagentA", event: { type: "agent_start" } } });
		write({ type: "agent_end", messages: [] });
		write({ type: "prompt_result", id: frame.id, agentInvoked: true, status: "completed" });
	}
}
`,
		);

		using client = new RpcClient({ cliPath: scriptPath });
		const lifecycleIds: string[] = [];
		const progressTasks: string[] = [];
		const rawEventTypes: string[] = [];
		const sessionEventTypes: string[] = [];
		client.onSubagentLifecycle(payload => lifecycleIds.push(payload.id));
		client.onSubagentProgress(payload => progressTasks.push(payload.task));
		client.onSubagentEvent(payload => rawEventTypes.push(payload.event.type));
		client.onSessionEvent(event => sessionEventTypes.push(event.type));

		await client.start();
		// Plain await, not `.resolves`: on Windows Bun's in-place promise wait never services the child pipe.
		expect(await client.setSubagentSubscription("events")).toBe("events");
		await client.promptAndWait("Trigger subagent frames");
		expect(await client.getSubagents()).toHaveLength(1);
		expect(await client.getSubagentMessages({ sessionFile: "/tmp/subagent.jsonl" })).toMatchObject({
			sessionFile: "/tmp/subagent.jsonl",
		});

		expect(lifecycleIds).toEqual(["SubagentA"]);
		expect(progressTasks).toEqual(["Do work"]);
		expect(rawEventTypes).toEqual(["agent_start"]);
		expect(sessionEventTypes).toContain("notice");
	});

	test("forwards nested subagent frames published on the shared observability bus", () => {
		const frames: RpcSubagentFrame[] = [];
		const eventBus = new EventBus();
		const registry = new RpcSubagentRegistry(eventBus, frame => frames.push(frame));
		registry.setSubscriptionLevel("events");
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
			id: "Kid",
			agent: "task",
			agentSource: "bundled",
			status: "started",
			parentToolCallId: "call-1",
			index: 1,
		} satisfies SubagentLifecyclePayload);
		eventBus.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
			id: "Kid.Grandkid",
			agent: "task",
			agentSource: "bundled",
			status: "started",
			parentToolCallId: "call-2",
			index: 2,
		} satisfies SubagentLifecyclePayload);
		eventBus.emit(TASK_SUBAGENT_EVENT_CHANNEL, {
			id: "Kid.Grandkid",
			event: { type: "agent_start" } as SubagentEventPayload["event"],
		} satisfies SubagentEventPayload);
		expect(frames.map(frame => frame.type)).toEqual(["subagent_lifecycle", "subagent_lifecycle", "subagent_event"]);
		expect((frames[1] as { payload: SubagentLifecyclePayload }).payload.id).toBe("Kid.Grandkid");
		expect((frames[2] as { payload: SubagentEventPayload }).payload.id).toBe("Kid.Grandkid");
		registry.dispose();
	});

	test("scopes observability to each root session — another tree's bus stays invisible", () => {
		const busA = new EventBus();
		const busB = new EventBus();
		const framesA: RpcSubagentFrame[] = [];
		const framesB: RpcSubagentFrame[] = [];
		const registryA = new RpcSubagentRegistry(busA, frame => framesA.push(frame));
		const registryB = new RpcSubagentRegistry(busB, frame => framesB.push(frame));
		registryA.setSubscriptionLevel("events");
		registryB.setSubscriptionLevel("events");
		busB.emit(TASK_SUBAGENT_LIFECYCLE_CHANNEL, {
			id: "Kid",
			agent: "task",
			agentSource: "bundled",
			status: "started",
			index: 1,
		} satisfies SubagentLifecyclePayload);
		expect(framesA).toEqual([]);
		expect(framesB).toHaveLength(1);
		registryA.dispose();
		registryB.dispose();
	});
});
