import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PassThrough, Readable } from "node:stream";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import type { AgentSession } from "../src/session/agent-session";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";
import type { AgentSessionEvent } from "../src/session/agent-session-events";

interface StubSession {
	readonly sessionManager: SessionManager;
	obfuscator?: { hasSecrets(): boolean; deobfuscate(text: string): string };
	readonly agent: {
		state: {
			streamMessage: AgentMessage | null;
			tools: unknown[];
		};
	};
	subscribe(fn: (event: AgentSessionEvent) => void): () => void;
	emit(event: AgentSessionEvent): void;
	setLiveStreamMessage(msg: AgentMessage | null): void;
	subscribeCommandMetadataChanged(): () => void;
	registerPersistenceFailureCallback(): () => void;
	setSlashCommands(): void;
	isFastModeEnabled(): boolean;
	isFastModeActive(): boolean;
	getTodoPhases(): unknown[];
	readonly state: Record<string, unknown>;
	readonly messages: unknown[];
	readonly extensions: unknown[];
	readonly skills: unknown[];
	readonly skillsSettings: null;
	readonly customCommands: unknown[];
	readonly mcpPromptCommands: unknown[];
	readonly sessionId: string;
	readonly sessionName: string;
	readonly model: string;
	readonly thinkingLevel: null;
	readonly isStreaming: boolean;
	readonly isCompacting: boolean;
	readonly steeringMode: "all";
	readonly followUpMode: "all";
	readonly interruptMode: "immediate";
	readonly sessionFile: undefined;
	readonly autoCompactionEnabled: boolean;
	readonly queuedMessageCount: number;
	readonly systemPrompt: string;
	readonly availableModels: unknown[];
	readonly effectiveExtensionRoots: unknown[];
	readonly stats: Record<string, unknown>;
	readonly settings: {
		readonly hostTools: unknown[];
		onEffectiveChange(): () => void;
	};
	newSession(): Promise<boolean>;
	switchSession(): Promise<boolean>;
	branch(entryId: string): Promise<{ selectedText: string; cancelled: boolean }>;
}

function createStubSession(sessionManager: SessionManager): StubSession {
	const listeners = new Set<(event: AgentSessionEvent) => void>();
	let liveStreamMessage: AgentMessage | null = null;

	return {
		sessionManager,
		obfuscator: undefined,
		agent: {
			state: {
				get streamMessage(): AgentMessage | null {
					return liveStreamMessage;
				},
				set streamMessage(msg: AgentMessage | null) {
					liveStreamMessage = msg;
				},
				tools: [],
			},
		},
		subscribe(fn: (event: AgentSessionEvent) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		emit(event: AgentSessionEvent) {
			for (const listener of listeners) {
				listener(event);
			}
		},
		setLiveStreamMessage(msg: AgentMessage | null) {
			liveStreamMessage = msg;
		},
		subscribeCommandMetadataChanged() {
			return () => {};
		},
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
			return liveStreamMessage !== null;
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
		async newSession() {
			await sessionManager.newSession();
			return true;
		},
		async switchSession() {
			return true;
		},
		async branch(entryId: string) {
			sessionManager.branch(entryId);
			return { selectedText: "", cancelled: false };
		},
	};
}

interface TestHarness {
	session: StubSession;
	sessionManager: SessionManager;
	sendCommand(cmd: Record<string, unknown>): Promise<Record<string, unknown>>;
	readFrames(): Record<string, unknown>[];
	waitForFrame(predicate: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>>;
	close(): void;
}

function createHarness(): TestHarness {
	const storage = new MemorySessionStorage();
	const sessionManager = SessionManager.create("/tmp/test", "/tmp/test", storage);
	const session = createStubSession(sessionManager);

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

	// Cast stub session to AgentSession through unknown
	const server = serveRpc(
		session as unknown as AgentSession,
		{ input: Readable.toWeb(input) as ReadableStream<Uint8Array>, output },
		{
			onShutdown: () => {},
			onWriteFailure: () => {},
		},
	);
	return {
		session,
		sessionManager,
		async sendCommand(cmd: Record<string, unknown>) {
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
		},
		readFrames() {
			return [...frames];
		},
		waitForFrame(predicate: (f: Record<string, unknown>) => boolean) {
			const existing = frames.find(predicate);
			if (existing) return Promise.resolve(existing);
			return new Promise<Record<string, unknown>>(resolve => {
				waiters.push({
					predicate,
					resolve,
				});
			});
		},
		close() {
			server.close();
			input.end();
			output.end();
		},
	};
}

describe("RPC protocol v3", () => {
	let harness: TestHarness;

	beforeEach(() => {
		harness = createHarness();
	});

	afterEach(() => {
		harness.close();
	});

	test("ready frame advertises protocol versions [1, 2, 3] and negotiate accepts 3", async () => {
		const ready = await harness.waitForFrame(f => f.type === "ready");
		expect(ready.supportedProtocolVersions).toEqual([1, 2, 3]);

		const res = await harness.sendCommand({
			type: "negotiate_protocol",
			protocolVersion: 3,
		});
		expect(res.success).toBe(true);
		expect(res.data).toEqual({ protocolVersion: 3 });
	});

	test("v3 streaming turn produces msg_start/block_start/delta/msg_end/entry{sid} and suppresses message_update", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });

		const assistantMessage: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "Hello world" }],
			timestamp: Date.now(),
			api: "test",
			provider: "test",
			model: "test-model",
			usage: {
				input: 1,
				output: 2,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 3,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
		};

		harness.session.emit({
			type: "message_start",
			message: assistantMessage,
		});
		harness.session.emit({
			type: "message_update",
			message: assistantMessage,
			assistantMessageEvent: { type: "text_start", contentIndex: 0, partial: assistantMessage },
		});
		harness.session.emit({
			type: "message_update",
			message: assistantMessage,
			assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "Hello ", partial: assistantMessage },
		});
		harness.session.emit({
			type: "message_update",
			message: assistantMessage,
			assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "world", partial: assistantMessage },
		});
		harness.session.emit({
			type: "message_update",
			message: assistantMessage,
			assistantMessageEvent: {
				type: "text_end",
				contentIndex: 0,
				content: "Hello world",
				partial: assistantMessage,
			},
		});
		harness.session.emit({
			type: "message_end",
			message: assistantMessage,
		});

		// Append entry into session manager
		harness.sessionManager.appendMessage(assistantMessage);

		await harness.waitForFrame(f => f.type === "entry");

		const frames = harness.readFrames();

		// Verify no message_start / message_update / message_end were sent to client
		expect(frames.some(f => f.type === "message_start")).toBe(false);
		expect(frames.some(f => f.type === "message_update")).toBe(false);
		expect(frames.some(f => f.type === "message_end")).toBe(false);

		// Verify v3 events
		const msgStart = frames.find(f => f.type === "msg_start");
		expect(msgStart).toBeDefined();
		const sid = typeof msgStart?.sid === "number" ? msgStart.sid : -1;
		expect(sid > 0).toBe(true);

		const blockStart = frames.find(f => f.type === "block_start");
		expect(blockStart).toMatchObject({
			type: "block_start",
			sid,
			block: 0,
			start: { type: "text" },
		});

		const deltas = frames.filter(f => f.type === "delta");
		expect(deltas.length).toBe(2);
		expect(deltas[0]).toMatchObject({ type: "delta", sid, block: 0, text: "Hello " });
		expect(deltas[1]).toMatchObject({ type: "delta", sid, block: 0, text: "world" });

		const blockEnd = frames.find(f => f.type === "block_end");
		expect(blockEnd).toMatchObject({
			type: "block_end",
			sid,
			block: 0,
			content: { type: "text", text: "Hello world" },
		});

		const msgEnd = frames.find(f => f.type === "msg_end");
		expect(msgEnd).toMatchObject({ type: "msg_end", sid });

		const entryFrame = frames.find(f => f.type === "entry");
		expect(entryFrame).toBeDefined();
		expect(entryFrame?.sid).toBe(sid);
		const entryObj = entryFrame?.entry;
		expect(entryObj && typeof entryObj === "object" && "type" in entryObj && entryObj.type).toBe("message");
	});

	test("v3 streaming assistant with fresh partial objects produces one sid and block_start per block", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });

		const isRole = (msg: unknown, role: string): boolean =>
			typeof msg === "object" && msg !== null && "role" in msg && msg.role === role;
		const isEntryRole = (entry: unknown, role: string): boolean =>
			typeof entry === "object" && entry !== null && "message" in entry && isRole(entry.message, role);

		// Non-streamed user message turn first
		const userMsg: AgentMessage = {
			role: "user",
			content: [{ type: "text", text: "what is 2+2?" }],
			timestamp: 1000,
		};
		harness.session.emit({ type: "message_start", message: userMsg });
		harness.session.emit({ type: "message_end", message: userMsg });
		harness.sessionManager.appendMessage(userMsg);

		await harness.waitForFrame(f => f.type === "entry" && isEntryRole(f.entry, "user"));

		const userFrames = harness.readFrames();
		const userMsgStart = userFrames.find(f => f.type === "msg_start" && isRole(f.message, "user"));
		const userMsgEnd = userFrames.find(f => f.type === "msg_end" && isRole(f.message, "user"));
		const userEntry = userFrames.find(f => f.type === "entry" && isEntryRole(f.entry, "user"));

		expect(userMsgStart).toBeUndefined();
		expect(userMsgEnd).toBeUndefined();
		expect(userEntry).toBeDefined();
		expect(userEntry?.sid).toBeUndefined();

		// Assistant streaming turn with FRESH snapshot objects each time (simulating agent-loop)
		const makeAssistantSnapshot = (content: AssistantMessage["content"]): AssistantMessage => ({
			role: "assistant",
			content: JSON.parse(JSON.stringify(content)),
			timestamp: 2000,
			api: "test",
			provider: "test",
			model: "test-model",
			usage: {
				input: 10,
				output: 20,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 30,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
		});

		// 1. message_start with initial snapshot (empty content)
		const snap1 = makeAssistantSnapshot([]);
		harness.session.emit({
			type: "message_start",
			message: snap1,
		});

		// 2. thinking_start (block 0) with fresh snapshot
		const snap2 = makeAssistantSnapshot([{ type: "thinking", thinking: "" }]);
		harness.session.emit({
			type: "message_update",
			message: snap2,
			assistantMessageEvent: {
				type: "thinking_start",
				contentIndex: 0,
				partial: snap2,
			},
		});

		// 3. thinking_delta with fresh snapshot
		const snap3 = makeAssistantSnapshot([{ type: "thinking", thinking: "Let me " }]);
		harness.session.emit({
			type: "message_update",
			message: snap3,
			assistantMessageEvent: {
				type: "thinking_delta",
				contentIndex: 0,
				delta: "Let me ",
				partial: snap3,
			},
		});

		// 4. thinking_delta with fresh snapshot
		const snap4 = makeAssistantSnapshot([{ type: "thinking", thinking: "Let me think" }]);
		harness.session.emit({
			type: "message_update",
			message: snap4,
			assistantMessageEvent: {
				type: "thinking_delta",
				contentIndex: 0,
				delta: "think",
				partial: snap4,
			},
		});

		// 5. thinking_end with fresh snapshot
		const snap5 = makeAssistantSnapshot([{ type: "thinking", thinking: "Let me think" }]);
		harness.session.emit({
			type: "message_update",
			message: snap5,
			assistantMessageEvent: {
				type: "thinking_end",
				contentIndex: 0,
				content: "Let me think",
				partial: snap5,
			},
		});

		// 6. text_start (block 1) with fresh snapshot
		const snap6 = makeAssistantSnapshot([
			{ type: "thinking", thinking: "Let me think" },
			{ type: "text", text: "" },
		]);
		harness.session.emit({
			type: "message_update",
			message: snap6,
			assistantMessageEvent: {
				type: "text_start",
				contentIndex: 1,
				partial: snap6,
			},
		});

		// 7. text_delta with fresh snapshot
		const snap7 = makeAssistantSnapshot([
			{ type: "thinking", thinking: "Let me think" },
			{ type: "text", text: "4" },
		]);
		harness.session.emit({
			type: "message_update",
			message: snap7,
			assistantMessageEvent: {
				type: "text_delta",
				contentIndex: 1,
				delta: "4",
				partial: snap7,
			},
		});

		// 8. text_end with fresh snapshot
		const snap8 = makeAssistantSnapshot([
			{ type: "thinking", thinking: "Let me think" },
			{ type: "text", text: "4" },
		]);
		harness.session.emit({
			type: "message_update",
			message: snap8,
			assistantMessageEvent: {
				type: "text_end",
				contentIndex: 1,
				content: "4",
				partial: snap8,
			},
		});

		// 9. message_end with final snapshot
		const snapFinal = makeAssistantSnapshot([
			{ type: "thinking", thinking: "Let me think" },
			{ type: "text", text: "4" },
		]);
		harness.session.emit({
			type: "message_end",
			message: snapFinal,
		});

		// 10. Persist entry
		harness.sessionManager.appendMessage(snapFinal);

		await harness.waitForFrame(f => f.type === "entry" && (f.entry as any).message?.role === "assistant");

		const allFrames = harness.readFrames();
		const assistantFrames = allFrames.filter(
			f =>
				(f.type === "msg_start" && isRole(f.message, "assistant")) ||
				(f.type === "msg_end" && isRole(f.message, "assistant")) ||
				(f.type === "entry" && isEntryRole(f.entry, "assistant")) ||
				f.type === "block_start" ||
				f.type === "delta" ||
				f.type === "block_end",
		);

		// Assert exactly one msg_start for assistant
		const msgStarts = allFrames.filter(f => f.type === "msg_start" && isRole(f.message, "assistant"));
		expect(msgStarts.length).toBe(1);
		const assistantSid = msgStarts[0].sid as number;
		expect(typeof assistantSid).toBe("number");

		// Assert all assistant frames share the exact same sid
		for (const frame of assistantFrames) {
			expect(frame.sid).toBe(assistantSid);
		}

		// Assert block_start for thinking (block 0) and text (block 1)
		const blockStarts = allFrames.filter(f => f.type === "block_start");
		expect(blockStarts.length).toBe(2);
		expect(blockStarts[0]).toMatchObject({
			type: "block_start",
			sid: assistantSid,
			block: 0,
			start: { type: "thinking" },
		});
		expect(blockStarts[1]).toMatchObject({
			type: "block_start",
			sid: assistantSid,
			block: 1,
			start: { type: "text" },
		});

		// Assert deltas come after their respective block_start
		const block0StartIndex = allFrames.indexOf(blockStarts[0]);
		const block1StartIndex = allFrames.indexOf(blockStarts[1]);
		const deltas = allFrames.filter(f => f.type === "delta");
		expect(deltas.length).toBe(3);
		expect(deltas[0]).toMatchObject({ type: "delta", sid: assistantSid, block: 0, text: "Let me " });
		expect(deltas[1]).toMatchObject({ type: "delta", sid: assistantSid, block: 0, text: "think" });
		expect(deltas[2]).toMatchObject({ type: "delta", sid: assistantSid, block: 1, text: "4" });

		expect(allFrames.indexOf(deltas[0])).toBeGreaterThan(block0StartIndex);
		expect(allFrames.indexOf(deltas[1])).toBeGreaterThan(block0StartIndex);
		expect(allFrames.indexOf(deltas[2])).toBeGreaterThan(block1StartIndex);

		// Assert block_ends
		const blockEnds = allFrames.filter(f => f.type === "block_end");
		expect(blockEnds.length).toBe(2);
		expect(blockEnds[0]).toMatchObject({ type: "block_end", sid: assistantSid, block: 0 });
		expect(blockEnds[1]).toMatchObject({ type: "block_end", sid: assistantSid, block: 1 });

		// Assert msg_end
		const msgEnds = allFrames.filter(f => f.type === "msg_end" && isRole(f.message, "assistant"));
		expect(msgEnds.length).toBe(1);
		expect(msgEnds[0].sid).toBe(assistantSid);

		// Assert entry
		const assistantEntry = allFrames.find(f => f.type === "entry" && isEntryRole(f.entry, "assistant"));
		expect(assistantEntry).toBeDefined();
		expect(assistantEntry?.sid).toBe(assistantSid);
	});

	test("v3 delta synthesizes block_start if provider omitted text_start", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });

		const msg: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "direct delta" }],
			timestamp: Date.now(),
			api: "test",
			provider: "test",
			model: "test-model",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
		};

		harness.session.emit({ type: "message_start", message: { ...msg, content: [] } });
		// No text_start emitted! Directly emit text_delta
		harness.session.emit({
			type: "message_update",
			message: { ...msg },
			assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "direct delta", partial: msg },
		});
		harness.session.emit({
			type: "message_end",
			message: { ...msg },
		});
		harness.sessionManager.appendMessage(msg);

		await harness.waitForFrame(f => f.type === "entry");

		const frames = harness.readFrames();
		const blockStart = frames.find(f => f.type === "block_start");
		const delta = frames.find(f => f.type === "delta");
		expect(blockStart).toBeDefined();
		expect(delta).toBeDefined();
		expect(frames.indexOf(blockStart!)).toBeLessThan(frames.indexOf(delta!));
		expect(blockStart).toMatchObject({ block: 0, start: { type: "text" } });
	});

	test("v2 connection still receives message_update and does not receive v3 events", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 2 });

		const assistantMessage: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "v2 text" }],
			timestamp: Date.now(),
			api: "test",
			provider: "test",
			model: "test-model",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
		};

		harness.session.emit({
			type: "message_start",
			message: assistantMessage,
		});
		harness.session.emit({
			type: "message_update",
			message: assistantMessage,
			assistantMessageEvent: { type: "text_start", contentIndex: 0, partial: assistantMessage },
		});
		harness.session.emit({
			type: "message_end",
			message: assistantMessage,
		});

		await harness.waitForFrame(f => f.type === "message_end");

		const frames = harness.readFrames();
		expect(frames.some(f => f.type === "message_start")).toBe(true);
		expect(frames.some(f => f.type === "message_update")).toBe(true);
		expect(frames.some(f => f.type === "message_end")).toBe(true);

		// Must NOT have v3 events
		expect(frames.some(f => f.type === "msg_start")).toBe(false);
		expect(frames.some(f => f.type === "block_start")).toBe(false);
		expect(frames.some(f => f.type === "delta")).toBe(false);
		expect(frames.some(f => f.type === "msg_end")).toBe(false);
	});

	test("history newest page + older page boundaries + hasMore and live message", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });

		// Append 5 entries
		const ids: string[] = [];
		for (let i = 1; i <= 5; i++) {
			const id = harness.sessionManager.appendCustomEntry("test", { index: i });
			ids.push(id);
		}

		// Newest page with limit 2
		const resNewest = await harness.sendCommand({
			type: "history",
			limit: 2,
		});
		expect(resNewest.success).toBe(true);
		const dataNewest = resNewest.data as {
			leafId: string;
			entries: Array<{ id: string }>;
			hasMore: boolean;
			live: unknown[];
		};
		expect(dataNewest.leafId).toBe(ids[4]);
		expect(dataNewest.entries.length).toBe(2);
		expect(dataNewest.entries[0].id).toBe(ids[3]);
		expect(dataNewest.entries[1].id).toBe(ids[4]);
		expect(dataNewest.hasMore).toBe(true);
		expect(dataNewest.live).toEqual([]);

		// Older page before id[3] with limit 2
		const resOlder = await harness.sendCommand({
			type: "history",
			before: ids[3],
			limit: 2,
		});
		expect(resOlder.success).toBe(true);
		const dataOlder = resOlder.data as { entries: Array<{ id: string }>; hasMore: boolean; live: unknown[] };
		expect(dataOlder.entries.length).toBe(2);
		expect(dataOlder.entries[0].id).toBe(ids[1]);
		expect(dataOlder.entries[1].id).toBe(ids[2]);
		expect(dataOlder.hasMore).toBe(true);
		expect(dataOlder.live).toEqual([]);

		// Oldest page before id[1]
		const resOldest = await harness.sendCommand({
			type: "history",
			before: ids[1],
			limit: 2,
		});
		expect(resOldest.success).toBe(true);
		const dataOldest = resOldest.data as { entries: Array<{ id: string }>; hasMore: boolean };
		expect(dataOldest.entries.length).toBe(1);
		expect(dataOldest.entries[0].id).toBe(ids[0]);
		expect(dataOldest.hasMore).toBe(false);

		// Live assistant message streaming
		const liveMsg: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "streaming now" }],
			timestamp: Date.now(),
			api: "test",
			provider: "test",
			model: "test-model",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
		};
		harness.session.setLiveStreamMessage(liveMsg);

		const resWithLive = await harness.sendCommand({ type: "history", limit: 10 });
		expect(resWithLive.success).toBe(true);
		const dataWithLive = resWithLive.data as { live: Array<{ sid: number; message: AgentMessage }> };
		expect(dataWithLive.live.length).toBe(1);
		expect(dataWithLive.live[0].message).toMatchObject({ role: "assistant" });
		expect(typeof dataWithLive.live[0].sid).toBe("number");
	});

	test("branch_changed error on mismatched leafId or unknown before", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });

		harness.sessionManager.appendCustomEntry("test", {});

		const resWrongLeaf = await harness.sendCommand({
			type: "history",
			leafId: "wrong-leaf-id",
		});
		expect(resWrongLeaf.success).toBe(false);
		expect(resWrongLeaf.error).toBe("branch_changed");

		const resUnknownBefore = await harness.sendCommand({
			type: "history",
			before: "non-existent-before",
		});
		expect(resUnknownBefore.success).toBe(false);
		expect(resUnknownBefore.error).toBe("branch_changed");
	});

	test("branch frame emitted after leaf move (branch, resetLeaf, compaction)", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });

		const id1 = harness.sessionManager.appendCustomEntry("test", { n: 1 });
		const id2 = harness.sessionManager.appendCustomEntry("test", { n: 2 });
		void id2;

		// Move leaf to id1 via branch()
		harness.sessionManager.branch(id1);
		const branchFrame1 = await harness.waitForFrame(f => f.type === "branch" && f.leafId === id1);
		expect(branchFrame1).toBeDefined();

		// Reset leaf
		harness.sessionManager.resetLeaf();
		const branchFrame2 = await harness.waitForFrame(f => f.type === "branch" && f.leafId === null);
		expect(branchFrame2).toBeDefined();

		// Compaction
		const compactionId = harness.sessionManager.appendCompaction("summary", "short", id1, 100);
		const branchFrame3 = await harness.waitForFrame(f => f.type === "branch" && f.leafId === compactionId);
		expect(branchFrame3).toBeDefined();
	});

	test("tool_output emits only suffix of text output", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });

		harness.session.emit({
			type: "tool_execution_start",
			toolCallId: "tc-bash",
			toolName: "bash",
			args: { command: "curl" },
		});

		harness.session.emit({
			type: "tool_execution_update",
			toolCallId: "tc-bash",
			toolName: "bash",
			args: { command: "curl" },
			partialResult: "Downloading...",
		});

		harness.session.emit({
			type: "tool_execution_update",
			toolCallId: "tc-bash",
			toolName: "bash",
			args: { command: "curl" },
			partialResult: "Downloading... 50%",
		});

		harness.session.emit({
			type: "tool_execution_update",
			toolCallId: "tc-bash",
			toolName: "bash",
			args: { command: "curl" },
			partialResult: "Downloading... 50% 100%",
		});

		await harness.waitForFrame(f => f.type === "tool_output" && f.text === " 100%");

		const outputs = harness.readFrames().filter(f => f.type === "tool_output");
		expect(outputs.length).toBe(3);
		expect(outputs[0]).toMatchObject({ type: "tool_output", toolCallId: "tc-bash", text: "Downloading..." });
		expect(outputs[1]).toMatchObject({ type: "tool_output", toolCallId: "tc-bash", text: " 50%" });
		expect(outputs[2]).toMatchObject({ type: "tool_output", toolCallId: "tc-bash", text: " 100%" });

		// A rewrite with no overlap resends the whole text and resumes streaming from it.
		harness.session.emit({
			type: "tool_execution_update",
			toolCallId: "tc-bash",
			toolName: "bash",
			args: { command: "curl" },
			partialResult: "Restart",
		});
		harness.session.emit({
			type: "tool_execution_update",
			toolCallId: "tc-bash",
			toolName: "bash",
			args: { command: "curl" },
			partialResult: "Restart ok",
		});
		await harness.waitForFrame(f => f.type === "tool_output" && f.text === " ok");
		const laterOutputs = harness.readFrames().filter(f => f.type === "tool_output");
		expect(laterOutputs.slice(3)).toEqual([
			{ type: "tool_output", toolCallId: "tc-bash", text: "Restart", replace: true },
			{ type: "tool_output", toolCallId: "tc-bash", text: " ok" },
		]);
	});

	test("tool_output continues across a rolling window that trims the head", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const head = "h".repeat(100);
		const body = Array.from({ length: 400 }, (_, i) => `line${i}\n`).join("");
		const emit = (partialResult: string) =>
			harness.session.emit({
				type: "tool_execution_update",
				toolCallId: "tc-roll",
				toolName: "bash",
				args: { command: "yes" },
				partialResult,
			});
		emit(head + body);
		emit(`${body}tail1\n`);
		emit(`${body.slice(50)}tail1\ntail2\n`);
		await harness.waitForFrame(f => f.type === "tool_output" && f.text === "tail2\n");
		const texts = harness
			.readFrames()
			.filter(f => f.type === "tool_output")
			.map(f => f.text);
		expect(texts).toEqual([head + body, "tail1\n", "tail2\n"]);
	});

	test("non-assistant messages are not streamed; their entries carry no sid", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const custom = {
			role: "custom",
			customType: "note",
			content: "hi",
			display: true,
			timestamp: Date.now(),
		} as unknown as AgentMessage;
		const user: AgentMessage = { role: "user", content: [{ type: "text", text: "q" }], timestamp: Date.now() };
		harness.session.emit({ type: "message_start", message: custom });
		harness.session.emit({ type: "message_end", message: custom });
		harness.session.emit({ type: "message_start", message: user });
		harness.session.emit({ type: "message_end", message: user });
		const userId = harness.sessionManager.appendMessage(user);
		const entry = await harness.waitForFrame(f => f.type === "entry");
		expect((entry.entry as { id: string }).id).toBe(userId);
		expect(entry.sid).toBeUndefined();
		const frames = harness.readFrames();
		expect(frames.some(f => f.type === "msg_start" || f.type === "msg_end")).toBe(false);
		expect(frames.some(f => f.type === "message_start" || f.type === "message_end")).toBe(false);
	});

	test("createBranchedSession sends a branch frame and later entries still arrive", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const id1 = harness.sessionManager.appendCustomEntry("test", { n: 1 });
		harness.sessionManager.appendCustomEntry("test", { n: 2 });
		harness.sessionManager.createBranchedSession(id1);
		await harness.waitForFrame(f => f.type === "branch" && f.leafId === id1);
		const id3 = harness.sessionManager.appendCustomEntry("test", { n: 3 });
		const entry = await harness.waitForFrame(f => f.type === "entry" && (f.entry as { id: string }).id === id3);
		expect(entry).toBeDefined();
	});

	test("appendMessageToBranch at the active leaf moves the browser back and keeps later entries flowing", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const leaf = harness.sessionManager.appendCustomEntry("test", { n: 1 });
		const user: AgentMessage = { role: "user", content: [{ type: "text", text: "bg" }], timestamp: Date.now() };
		harness.sessionManager.appendMessageToBranch(user, leaf);
		await harness.waitForFrame(f => f.type === "branch" && f.leafId === leaf);
		const next = harness.sessionManager.appendCustomEntry("test", { n: 2 });
		await harness.waitForFrame(f => f.type === "entry" && (f.entry as { id: string }).id === next);
	});

	test("history leafId/before on the current path succeed after appends; off-path is branch_changed", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const a = harness.sessionManager.appendCustomEntry("test", { n: 1 });
		const b = harness.sessionManager.appendCustomEntry("test", { n: 2 });
		harness.sessionManager.appendCustomEntry("test", { n: 3 });
		const advanced = await harness.sendCommand({ type: "history", leafId: b, before: b });
		expect(advanced.success).toBe(true);
		expect((advanced.data as { entries: Array<{ id: string }> }).entries.map(e => e.id)).toEqual([a]);

		harness.sessionManager.branch(a);
		const offPath = await harness.sendCommand({ type: "history", leafId: b, before: b });
		expect(offPath.success).toBe(false);
		expect(offPath.error).toBe("branch_changed");
	});

	test("history response is written before any entry recorded after its snapshot", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		harness.sessionManager.appendCustomEntry("test", { n: 1 });
		const manager = harness.sessionManager;
		const original = manager.getBranch.bind(manager);
		let lateId: string | undefined;
		manager.getBranch = ((...args: Parameters<SessionManager["getBranch"]>) => {
			const branch = original(...args);
			queueMicrotask(() => {
				lateId = manager.appendCustomEntry("test", { n: 2 });
			});
			return branch;
		}) as SessionManager["getBranch"];
		const res = await harness.sendCommand({ type: "history", id: "h-sync" });
		manager.getBranch = original;
		expect(res.success).toBe(true);
		const frames = harness.readFrames();
		const responseIndex = frames.findIndex(f => f.type === "response" && f.id === "h-sync");
		await harness.waitForFrame(f => f.type === "entry" && (f.entry as { id: string }).id === lateId);
		const entryIndex = harness
			.readFrames()
			.findIndex(f => f.type === "entry" && (f.entry as { id: string }).id === lateId);
		expect(responseIndex).toBeGreaterThanOrEqual(0);
		expect(entryIndex).toBeGreaterThan(responseIndex);
	});

	test("new_session sends exactly one branch frame", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		harness.sessionManager.appendCustomEntry("test", { n: 1 });
		const res = await harness.sendCommand({ type: "new_session" });
		expect(res.success).toBe(true);
		expect(harness.readFrames().filter(f => f.type === "branch")).toEqual([{ type: "branch", leafId: null }]);
	});

	const assistant = (
		content: AssistantMessage["content"],
		extra: Partial<AssistantMessage> = {},
	): AssistantMessage => ({
		role: "assistant",
		content,
		timestamp: Date.now(),
		api: "test",
		provider: "test",
		model: "test-model",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		...extra,
	});

	test("mid-stream attach continues the partial block instead of restarting it", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const partial = assistant([{ type: "text", text: "already streamed" }]);
		harness.session.setLiveStreamMessage(partial);
		const res = await harness.sendCommand({ type: "history" });
		const live = (res.data as { live: Array<{ sid: number }> }).live;
		expect(live.length).toBe(1);
		const next = assistant([{ type: "text", text: "already streamed more" }]);
		harness.session.emit({
			type: "message_update",
			message: next,
			assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: " more", partial: next },
		} as AgentSessionEvent);
		const delta = await harness.waitForFrame(f => f.type === "delta");
		expect(delta).toEqual({ type: "delta", sid: live[0].sid, block: 0, text: " more" });
		expect(harness.readFrames().some(f => f.type === "block_start" || f.type === "msg_start")).toBe(false);
	});

	test("prompt to a busy session gets exactly one error response, not an ack then an error", async () => {
		harness.session.setLiveStreamMessage(assistant([{ type: "text", text: "working" }]));
		const res = await harness.sendCommand({ id: "busy-1", type: "prompt", message: "hello" });
		expect(res.success).toBe(false);
		expect(String(res.error)).toContain("already processing");
		// A later command's response flushes any background prompt report.
		await harness.sendCommand({ type: "get_state" });
		expect(harness.readFrames().filter(f => f.type === "response" && f.id === "busy-1")).toHaveLength(1);
	});

	test("update without a prior message_start sends the partial once, without a duplicate delta", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const partialMsg = assistant([{ type: "text", text: "abc" }]);
		harness.session.emit({
			type: "message_update",
			message: partialMsg,
			assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "c", partial: partialMsg },
		} as AgentSessionEvent);
		const next = assistant([{ type: "text", text: "abcd" }]);
		harness.session.emit({
			type: "message_update",
			message: next,
			assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "d", partial: next },
		} as AgentSessionEvent);
		await harness.waitForFrame(f => f.type === "delta");
		const types = harness
			.readFrames()
			.filter(f => f.type === "msg_start" || f.type === "delta" || f.type === "block_start")
			.map(f => (f.type === "delta" ? `delta:${f.text}` : f.type));
		expect(types).toEqual(["msg_start", "delta:d"]);
	});

	test("message_start whose message already holds streamed text sends that text once", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const filled = assistant([{ type: "text", text: "FRAMES of" }]);
		harness.session.emit({ type: "message_start", message: filled });
		harness.session.emit({
			type: "message_update",
			message: filled,
			assistantMessageEvent: { type: "text_start", contentIndex: 0, partial: filled },
		} as AgentSessionEvent);
		harness.session.emit({
			type: "message_update",
			message: filled,
			assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "FRAMES of", partial: filled },
		} as AgentSessionEvent);
		await harness.waitForFrame(f => f.type === "delta");
		let text = "";
		for (const f of harness.readFrames()) {
			if (f.type === "msg_start") {
				for (const block of (f.message as AssistantMessage).content) if (block.type === "text") text += block.text;
			} else if (f.type === "delta") {
				text += f.text as string;
			}
		}
		expect(text).toBe("FRAMES of");
	});

	test("secrets are restored in block_end, msg_end, entry and history", async () => {
		harness.session.obfuscator = {
			hasSecrets: () => true,
			deobfuscate: text => text.replaceAll("#S#", "hunter2"),
		};
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const msg = assistant([
			{ type: "text", text: "pw #S#" },
			{ type: "toolCall", id: "t1", name: "bash", arguments: { command: "echo #S#" } },
		]);
		harness.session.emit({ type: "message_start", message: msg });
		harness.session.emit({
			type: "message_update",
			message: msg,
			assistantMessageEvent: { type: "text_end", contentIndex: 0, content: "pw #S#", partial: msg },
		} as AgentSessionEvent);
		harness.session.emit({ type: "message_end", message: msg });
		harness.sessionManager.appendMessage(msg);
		const entry = await harness.waitForFrame(f => f.type === "entry");
		const frames = harness.readFrames();
		const start = frames.find(f => f.type === "msg_start") as { message: AssistantMessage };
		const blockEnd = frames.find(f => f.type === "block_end") as { content: unknown };
		const end = frames.find(f => f.type === "msg_end") as { sid: number; message: AssistantMessage };
		const saved = (entry.entry as { message: AssistantMessage }).message;
		expect(start.message.content).toEqual([]);
		expect(end.message.content).toEqual(saved.content);
		expect(blockEnd.content).toEqual({ type: "text", text: "pw hunter2" });
		expect(saved.content[1]).toMatchObject({ arguments: { command: "echo hunter2" } });
		expect(entry.sid).toBe(end.sid as number);

		harness.sessionManager.appendCompaction("sum #S#", "short #S#", harness.sessionManager.getLeafId()!, 1);
		const res = await harness.sendCommand({ type: "history" });
		const entries = (res.data as { entries: Array<Record<string, unknown>> }).entries;
		expect((entries[0].message as AssistantMessage).content[0]).toEqual({ type: "text", text: "pw hunter2" });
		expect(entries[1]).toMatchObject({ type: "compaction", summary: "sum hunter2", shortSummary: "short hunter2" });
		// The persisted form keeps placeholders.
		const stored = harness.sessionManager.getBranch()[0] as { message: AssistantMessage };
		expect(stored.message.content[0]).toEqual({ type: "text", text: "pw #S#" });
	});

	test("agent_end and turn_end carry no message payloads on v3", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const msg = assistant([{ type: "text", text: "x" }]);
		harness.session.emit({ type: "turn_end", message: msg, toolResults: [] });
		harness.session.emit({ type: "agent_end", messages: [msg], isTerminal: true });
		await harness.waitForFrame(f => f.type === "agent_end");
		const frames = harness.readFrames().filter(f => f.type === "agent_end" || f.type === "turn_end");
		expect(frames).toEqual([{ type: "turn_end" }, { type: "agent_end", isTerminal: true }]);
	});

	test("tool updates after tool_execution_end are dropped", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const update = (partialResult: string) =>
			harness.session.emit({
				type: "tool_execution_update",
				toolCallId: "tc-bg",
				toolName: "bash",
				args: {},
				partialResult,
			});
		update("a");
		harness.session.emit({
			type: "tool_execution_end",
			toolCallId: "tc-bg",
			toolName: "bash",
			result: { content: [] },
			isError: false,
		} as AgentSessionEvent);
		update("ab");
		harness.sessionManager.appendCustomEntry("test", { n: 1 });
		await harness.waitForFrame(f => f.type === "entry");
		expect(
			harness
				.readFrames()
				.filter(f => f.type === "tool_output")
				.map(f => f.text),
		).toEqual(["a"]);
	});

	test("an assistant entry saved after a leaf move still resolves its sid", async () => {
		await harness.sendCommand({ type: "negotiate_protocol", protocolVersion: 3 });
		const root = harness.sessionManager.appendCustomEntry("test", { n: 1 });
		harness.sessionManager.appendCustomEntry("test", { n: 2 });
		const msg = assistant([{ type: "text", text: "hi" }]);
		harness.session.emit({ type: "message_start", message: msg });
		harness.session.emit({ type: "message_end", message: msg });
		harness.sessionManager.branch(root);
		await harness.waitForFrame(f => f.type === "branch");
		harness.sessionManager.appendMessage(msg);
		const end = await harness.waitForFrame(f => f.type === "msg_end");
		const entry = await harness.waitForFrame(
			f => f.type === "entry" && (f.entry as { type: string }).type === "message",
		);
		expect(entry.sid).toBe(end.sid as number);
	});
});
