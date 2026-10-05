import { describe, expect, it } from "bun:test";
import { PassThrough, Readable } from "node:stream";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import type { AgentSession } from "../src/session/agent-session";
import type { AgentSessionEvent } from "../src/session/agent-session-events";
import { Settings } from "../src/config/settings";

function createHarness() {
	const storage = new MemorySessionStorage();
	const sm = SessionManager.create("/tmp/test-project", "/tmp/test-project", storage);
	const listeners = new Set<(event: AgentSessionEvent) => void>();
	let retried = false;

	const session = {
		sessionManager: sm,
		agent: {
			state: {
				streamMessage: null as AgentMessage | null,
				tools: [],
			},
		},
		subscribe(fn: (event: AgentSessionEvent) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		emit(event: AgentSessionEvent) {
			for (const l of listeners) l(event);
		},
		subscribeCommandMetadataChanged() {
			return () => {};
		},
		setGoalModeState() {},
		getGoalModeState: () => undefined,
		goalRuntime: { clearAccounting() {} },
		registerPersistenceFailureCallback() {
			return () => {};
		},
		setSlashCommands() {},
		isFastModeEnabled() {
			return false;
		},
		isFastModeActive() {
			return false;
		},
		getTodoPhases() {
			return [];
		},
		get state() {
			return {
				sessionId: sm.getSessionId(),
				cwd: sm.getCwd(),
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
			return sm.getSessionId();
		},
		get sessionName() {
			return sm.getSessionName();
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
		settings: Settings.isolated(),
		hasPendingAsyncWork() {
			return false;
		},
		async settleAsyncWork() {},
		async waitForIdle() {},
		async newSession() {
			await sm.newSession();
			return true;
		},
		async switchSession() {
			return true;
		},
		async branch(entryId: string) {
			sm.branch(entryId);
			return { selectedText: "", cancelled: false };
		},
		async setSessionName(name: string, source: "auto" | "user" = "user") {
			return sm.setSessionName(name, source);
		},
		async retry() {
			retried = true;
			return true;
		},
	};

	const input = new PassThrough();
	const output = new PassThrough();
	const frames: Array<Record<string, unknown>> = [];
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

	const sendCommand = async (cmd: Record<string, unknown>): Promise<Record<string, unknown>> => {
		const id = typeof cmd.id === "string" ? cmd.id : `cmd-${Date.now()}-${Math.random()}`;
		const payload = { ...cmd, id };
		const responsePromise = new Promise<Record<string, unknown>>(resolve => {
			waiters.push({
				predicate: f => f.type === "response" && f.id === id,
				resolve,
			});
		});
		input.write(`${JSON.stringify(payload)}\n`);
		return responsePromise;
	};

	const waitForFrame = (predicate: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> => {
		const existing = frames.find(predicate);
		if (existing) return Promise.resolve(existing);
		return new Promise<Record<string, unknown>>(resolve => {
			waiters.push({ predicate, resolve });
		});
	};

	return {
		session,
		sm,
		server,
		input,
		output,
		sendCommand,
		waitForFrame,
		frames,
		getRetried: () => retried,
		close: () => {
			server.close();
			input.end();
			output.end();
		},
	};
}

describe("RPC session controls", () => {
	it("pushes session_info_update frame when session name changes via set_session_name", async () => {
		const h = createHarness();
		try {
			await h.waitForFrame(f => f.type === "ready");

			const resp = await h.sendCommand({
				type: "set_session_name",
				id: "ren-1",
				name: "Brand New Title",
			});

			expect(resp.success).toBe(true);
			expect(h.sm.getSessionName()).toBe("Brand New Title");

			// Frame should have been emitted
			const infoUpdate = await h.waitForFrame(f => f.type === "session_info_update");
			expect(infoUpdate.title).toBe("Brand New Title");
			expect(infoUpdate.sessionId).toBe(h.sm.getSessionId());
		} finally {
			h.close();
		}
	});

	it("routes /retry through builtin slash command handling over RPC", async () => {
		const h = createHarness();
		try {
			await h.waitForFrame(f => f.type === "ready");

			const resp = await h.sendCommand({
				type: "prompt",
				id: "ret-1",
				message: "/retry",
			});

			expect(resp.success).toBe(true);
			expect(h.getRetried()).toBe(true);

			const outputFrame = await h.waitForFrame(f => f.type === "command_output");
			expect(outputFrame.text).toContain("Retrying the last failed turn");
		} finally {
			h.close();
		}
	});
});
