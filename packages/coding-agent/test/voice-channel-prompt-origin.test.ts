/**
 * Wren speech follows the last prompt origin: a local TUI submit reclaims the
 * session's voice channel, while prompts arriving over RPC leave it alone.
 */
import { describe, expect, it, vi } from "bun:test";
import { PassThrough, Readable } from "node:stream";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { ImageContent } from "@oh-my-pi/pi-ai";
import { Settings } from "../src/config/settings";
import { InputController } from "../src/modes/controllers/input-controller";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import type { InteractiveModeContext } from "../src/modes/types";
import type { AgentSession } from "../src/session/agent-session";
import type { AgentSessionEvent } from "../src/session/agent-session-events";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";

function tuiContext(sm: SessionManager) {
	let editorText = "";
	const prompt = vi.fn(async () => {});
	const editor = {
		onSubmit: undefined as ((text: string) => Promise<void>) | undefined,
		pendingImages: [] as ImageContent[],
		pendingImageLinks: [] as (string | undefined)[],
		setText(text: string) {
			editorText = text;
		},
		getText: () => editorText,
		setCollapsedText(text: string) {
			editorText = text;
		},
		composerChips: () => [],
		addToHistory: vi.fn(),
		clearDraft() {
			editorText = "";
		},
		setActionKeys: vi.fn(),
		setCustomKeyHandler: vi.fn(),
		clearCustomKeyHandlers: vi.fn(),
	};
	const session = {
		isStreaming: false,
		isCompacting: false,
		isBashRunning: false,
		isEvalRunning: false,
		extensionRunner: undefined,
		settings: Settings.isolated({}),
		steer: vi.fn(async () => {}),
		prompt,
		queuedMessageCount: 0,
		customCommands: [],
		promptTemplates: [],
		getQueuedMessages: () => ({ steering: [], followUp: [] }),
	};
	const ctx = {
		editor,
		ui: { requestRender: vi.fn() },
		session,
		settings: session.settings,
		sessionManager: sm,
		compactionQueuedMessages: [],
		skillCommands: new Map(),
		fileSlashCommands: new Set<string>(),
		locallySubmittedUserSignatures: new Set<string>(),
		isKnownSlashCommand: () => false,
		recordLocalSubmission: () => () => {},
		withLocalSubmission: <T>(_text: string, fn: () => Promise<T>) => fn(),
		onInputCallback: undefined,
		updatePendingMessagesDisplay: vi.fn(),
		flushPendingBashComponents: vi.fn(),
		showError: vi.fn(),
		isBashMode: false,
		isPythonMode: false,
	} as unknown as InteractiveModeContext;
	return { ctx, editor, prompt };
}

function rpcSessionStub(sm: SessionManager, prompt: (text: string) => void): AgentSession {
	const listeners = new Set<(event: AgentSessionEvent) => void>();
	const stub = {
		sessionManager: sm,
		agent: { state: { streamMessage: null as AgentMessage | null, tools: [] } },
		subscribe(fn: (event: AgentSessionEvent) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		subscribeCommandMetadataChanged: () => () => {},
		setGoalModeState() {},
		getGoalModeState: () => undefined,
		goalRuntime: { clearAccounting() {} },
		registerPersistenceFailureCallback: () => () => {},
		setSlashCommands() {},
		isFastModeEnabled: () => false,
		isFastModeActive: () => false,
		getTodoPhases: () => [],
		messages: [],
		extensions: [],
		skills: [],
		skillsSettings: null,
		customCommands: [],
		mcpPromptCommands: [],
		get sessionId() {
			return sm.getSessionId();
		},
		model: "test-model",
		isStreaming: false,
		queuedMessageCount: 0,
		settings: Settings.isolated(),
		hasPendingAsyncWork: () => false,
		async waitForIdle() {},
		async prompt(text: string, options?: { onPromptAdmitted?: () => void }) {
			prompt(text);
			options?.onPromptAdmitted?.();
			return true;
		},
	};
	return stub as unknown as AgentSession;
}

describe("voice channel follows the prompt origin", () => {
	it("clears the channel when the user submits a prompt in the TUI", async () => {
		const sm = SessionManager.create("/tmp", "/tmp", new MemorySessionStorage());
		sm.setVoiceChannel("webgui-phone", {});
		const { ctx, editor, prompt } = tuiContext(sm);
		new InputController(ctx).setupEditorSubmitHandler();

		await editor.onSubmit?.("good morning");

		expect(prompt).toHaveBeenCalled();
		expect(sm.getVoiceChannel()).toBeUndefined();
	});

	it("keeps the channel when a prompt arrives over RPC", async () => {
		const sm = SessionManager.create("/tmp", "/tmp", new MemorySessionStorage());
		const seen: string[] = [];
		const input = new PassThrough();
		const output = new PassThrough();
		const responses = new Map<string, (frame: Record<string, unknown>) => void>();
		let buffer = "";
		output.on("data", (chunk: Buffer) => {
			buffer += chunk.toString("utf8");
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim()) continue;
				const frame = JSON.parse(line) as Record<string, unknown>;
				if (frame.type === "response" && typeof frame.id === "string") responses.get(frame.id)?.(frame);
			}
		});
		const server = serveRpc(
			rpcSessionStub(sm, text => seen.push(text)),
			{ input: Readable.toWeb(input) as ReadableStream<Uint8Array>, output },
			{ onShutdown: () => {}, onWriteFailure: () => {} },
		);
		const send = (id: string, cmd: Record<string, unknown>) => {
			const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
			responses.set(id, resolve);
			input.write(`${JSON.stringify({ ...cmd, id })}\n`);
			return promise;
		};
		try {
			await send("v", { type: "set_voice_channel", channel: "webgui-phone" });
			const reply = await send("p", { type: "prompt", message: "from the phone" });
			expect(reply).toMatchObject({ command: "prompt", success: true });
			expect(seen).toEqual(["from the phone"]);
			expect(sm.getVoiceChannel()).toBe("webgui-phone");
		} finally {
			input.end();
			server.close();
			await server.closed;
		}
	});
});
