import { describe, expect, test } from "bun:test";
import { PassThrough, Readable } from "node:stream";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import { USER_TODO_EDIT_CUSTOM_TYPE } from "../src/tools/todo";
import type { AgentSession } from "../src/session/agent-session";
import type { AgentSessionEvent } from "../src/session/agent-session-events";
import type { TodoPhase } from "@oh-my-pi/pi-tui/tools/todo";

function createHarness() {
	const storage = new MemorySessionStorage();
	const sessionManager = SessionManager.create("/tmp/test", "/tmp/test", storage);

	let currentPhases: TodoPhase[] = [];
	const listeners = new Set<(event: AgentSessionEvent) => void>();

	const session = {
		sessionManager,
		obfuscator: undefined,
		agent: { state: { streamMessage: null, tools: [] } },
		subscribe(fn: (event: AgentSessionEvent) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		emit(event: AgentSessionEvent) {
			for (const listener of listeners) {
				listener(event);
			}
		},
		subscribeCommandMetadataChanged() {
			return () => {};
		},
		registerPersistenceFailureCallback() {
			return () => {};
		},
		setSlashCommands() {},
		isFastModeEnabled: () => false,
		isFastModeActive: () => false,
		getTodoPhases: () => currentPhases,
		setTodoPhases: (phases: TodoPhase[]) => {
			currentPhases = phases;
		},
		get state() {
			return {
				sessionId: sessionManager.getSessionId(),
				cwd: sessionManager.getCwd(),
				model: "test-model",
				thinkingLevel: null,
				fastMode: false,
				fastModeModel: null,
				autonomyLevel: "default",
				steeringMode: "steer",
				followUpMode: "followUp",
				interruptMode: "interrupt",
			};
		},
		get messages() {
			return [];
		},
		get extensions() {
			return [];
		},
		get skills() {
			return [];
		},
		get skillsSettings() {
			return null;
		},
		get customCommands() {
			return [];
		},
		get mcpPromptCommands() {
			return [];
		},
		get sessionId() {
			return sessionManager.getSessionId();
		},
		get sessionName() {
			return "test";
		},
		get model() {
			return "test-model";
		},
		get thinkingLevel() {
			return null;
		},
		get isStreaming() {
			return false;
		},
		get isCompacting() {
			return false;
		},
		get steeringMode() {
			return "all" as const;
		},
		get followUpMode() {
			return "all" as const;
		},
		get interruptMode() {
			return "immediate" as const;
		},
		get sessionFile() {
			return undefined;
		},
		get autoCompactionEnabled() {
			return false;
		},
		get queuedMessageCount() {
			return 0;
		},
		get systemPrompt() {
			return "";
		},
		get availableModels() {
			return [];
		},
		get effectiveExtensionRoots() {
			return [];
		},
		get stats() {
			return {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheCreationTokens: 0,
				cost: 0,
				turns: 0,
				duration: 0,
			};
		},
		settings: {
			get hostTools() {
				return [];
			},
			onEffectiveChange() {
				return () => {};
			},
		},
	};

	const input = new PassThrough();
	const output = new PassThrough();
	const frames: Record<string, unknown>[] = [];
	const waiters: Array<{
		predicate: (f: Record<string, unknown>) => boolean;
		resolve: (f: Record<string, unknown>) => void;
	}> = [];

	let buffer = "";
	output.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			const parsed = JSON.parse(line) as Record<string, unknown>;
			frames.push(parsed);
			for (let i = waiters.length - 1; i >= 0; i--) {
				if (waiters[i].predicate(parsed)) {
					const [matched] = waiters.splice(i, 1);
					matched.resolve(parsed);
				}
			}
		}
	});

	const server = serveRpc(
		session as unknown as AgentSession,
		{ input: Readable.toWeb(input) as ReadableStream<Uint8Array>, output },
		{ onShutdown: () => {}, onWriteFailure: () => {} },
	);

	function sendCommand(cmd: Record<string, unknown>): Promise<Record<string, unknown>> {
		const id = (cmd.id as string) ?? `cmd_${Math.random().toString(36).slice(2)}`;
		const fullCmd = { ...cmd, id };
		const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
		waiters.push({ predicate: f => f.id === id, resolve });
		input.write(`${JSON.stringify(fullCmd)}\n`);
		return promise;
	}

	function waitForFrame(predicate: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
		const existing = frames.find(predicate);
		if (existing) return Promise.resolve(existing);
		const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
		waiters.push({ predicate, resolve });
		return promise;
	}

	function close() {
		input.end();
		server.close();
	}

	return { session, sessionManager, sendCommand, waitForFrame, close };
}

describe("RPC set_todos", () => {
	test("set_todos updates phases and persists custom entry to session branch", async () => {
		const harness = createHarness();
		try {
			const phases: TodoPhase[] = [
				{
					name: "Phase 1",
					tasks: [
						{ content: "Task A", status: "in_progress" },
						{ content: "Task B", status: "pending" },
					],
				},
			];

			const response = await harness.sendCommand({
				type: "set_todos",
				phases,
			});

			expect(response.success).toBe(true);
			const responseData = response.data;
			expect(responseData && typeof responseData === "object" && "todoPhases" in responseData).toBe(true);
			if (responseData && typeof responseData === "object" && "todoPhases" in responseData) {
				expect(responseData.todoPhases).toEqual(phases);
			}
			expect(harness.session.getTodoPhases()).toEqual(phases);

			// Branch persistence check
			const entries = harness.sessionManager.getBranch();
			const customEntry = entries.find(e => e.type === "custom" && e.customType === USER_TODO_EDIT_CUSTOM_TYPE);
			expect(customEntry).toBeDefined();
			if (customEntry && customEntry.type === "custom") {
				const entryData = customEntry.data;
				expect(entryData && typeof entryData === "object" && "phases" in entryData).toBe(true);
				if (entryData && typeof entryData === "object" && "phases" in entryData) {
					expect(entryData.phases).toEqual(phases);
				}
			}
		} finally {
			harness.close();
		}
	});

	test("set_todos in protocol v3 emits entry frame", async () => {
		const harness = createHarness();
		try {
			await harness.sendCommand({
				type: "negotiate_protocol",
				protocolVersion: 3,
			});

			const phases: TodoPhase[] = [
				{
					name: "Phase 2",
					tasks: [{ content: "Task C", status: "completed" }],
				},
			];

			const entryPromise = harness.waitForFrame(f => {
				if (f.type !== "entry" || !f.entry || typeof f.entry !== "object") return false;
				return "customType" in f.entry && f.entry.customType === USER_TODO_EDIT_CUSTOM_TYPE;
			});

			await harness.sendCommand({
				type: "set_todos",
				phases,
			});

			const entryFrame = await entryPromise;
			expect(entryFrame).toBeDefined();
			const entry = entryFrame.entry;
			expect(entry && typeof entry === "object" && "data" in entry).toBe(true);
			if (entry && typeof entry === "object" && "data" in entry) {
				const data = entry.data;
				expect(data && typeof data === "object" && "phases" in data).toBe(true);
				if (data && typeof data === "object" && "phases" in data) {
					expect(data.phases).toEqual(phases);
				}
			}
		} finally {
			harness.close();
		}
	});
});
