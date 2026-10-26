/**
 * `set_voice_channel` routes wren speech: the session's channel reaches each
 * bash command as `WREN_CHANNEL` (read per command, never left in the
 * persistent shell), and a client's disconnect clears only its own value.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { PassThrough, Readable } from "node:stream";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { AsyncJobManager } from "../src/async";
import { Settings } from "../src/config/settings";
import { releaseShellSessions } from "../src/exec/bash-executor";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import type { AgentSession } from "../src/session/agent-session";
import type { AgentSessionEvent } from "../src/session/agent-session-events";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";
import { BashTool } from "../src/tools/bash";

function sessionStub(sm: SessionManager): AgentSession {
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
	};
	return stub as unknown as AgentSession;
}

interface Connection {
	send(cmd: Record<string, unknown>): Promise<Record<string, unknown>>;
	disconnect(): Promise<void>;
}

function connect(session: AgentSession): Connection {
	const input = new PassThrough();
	const output = new PassThrough();
	const waiters = new Map<string, (frame: Record<string, unknown>) => void>();
	let buffer = "";
	output.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			const frame = JSON.parse(line) as Record<string, unknown>;
			if (frame.type === "response" && typeof frame.id === "string") waiters.get(frame.id)?.(frame);
		}
	});
	const server = serveRpc(
		session,
		{ input: Readable.toWeb(input) as ReadableStream<Uint8Array>, output },
		{ onShutdown: () => {}, onWriteFailure: () => {} },
	);
	let next = 0;
	return {
		send(cmd) {
			const id = `voice-${next++}`;
			const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
			waiters.set(id, resolve);
			input.write(`${JSON.stringify({ ...cmd, id })}\n`);
			return promise;
		},
		async disconnect() {
			input.end();
			server.close();
			await server.closed;
		},
	};
}

describe.skipIf(process.platform === "win32")("set_voice_channel", () => {
	let cwd: string;
	let manager: AsyncJobManager;
	let sm: SessionManager;
	let bash: BashTool;

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "omp-voice-channel-"));
		manager = new AsyncJobManager({});
		sm = SessionManager.create(cwd, cwd, new MemorySessionStorage());
		bash = new BashTool({
			cwd,
			hasUI: false,
			getSessionFile: () => null,
			getSessionId: () => cwd,
			getSessionSpawns: () => "*",
			asyncJobManager: manager,
			settings: Settings.isolated(),
			getVoiceChannel: () => sm.getVoiceChannel(),
		});
	});

	afterEach(async () => {
		await manager.dispose();
		releaseShellSessions(cwd);
		await fs.rm(cwd, { recursive: true, force: true });
	});

	async function wrenChannelSeenByBash(): Promise<string> {
		const result = await bash.execute("voice", {
			command: "printf '<%s>' \"$(printenv WREN_CHANNEL || echo unset)\"",
		});
		return result.content.find(block => block.type === "text")?.text ?? "";
	}

	it("exports the channel to the next bash command and drops it once cleared", async () => {
		const client = connect(sessionStub(sm));
		try {
			const set = await client.send({ type: "set_voice_channel", channel: "webgui-abc" });
			expect(set).toMatchObject({ command: "set_voice_channel", success: true });
			expect(await wrenChannelSeenByBash()).toBe("<webgui-abc>");

			await client.send({ type: "set_voice_channel", channel: null });
			expect(await wrenChannelSeenByBash()).toBe("<unset>");
		} finally {
			await client.disconnect();
		}
	});

	it("clears the channel when the client that set it disconnects", async () => {
		const client = connect(sessionStub(sm));
		await client.send({ type: "set_voice_channel", channel: "webgui-abc" });
		await client.disconnect();
		expect(sm.getVoiceChannel()).toBeUndefined();
		expect(await wrenChannelSeenByBash()).toBe("<unset>");
	});

	it("keeps a later client's channel when the earlier setter disconnects", async () => {
		const session = sessionStub(sm);
		const first = connect(session);
		const second = connect(session);
		try {
			await first.send({ type: "set_voice_channel", channel: "webgui-first" });
			await second.send({ type: "set_voice_channel", channel: "webgui-second" });
			await first.disconnect();
			expect(await wrenChannelSeenByBash()).toBe("<webgui-second>");
		} finally {
			await second.disconnect();
		}
	});
});
