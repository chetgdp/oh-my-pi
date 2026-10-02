import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getBaseConfigRoot } from "@oh-my-pi/pi-utils";
import { Snowflake } from "@oh-my-pi/pi-utils/snowflake";
import { AgentRegistry, MAIN_AGENT_ID } from "../src/registry/agent-registry";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import type { AgentSession } from "../src/session/agent-session";

interface RpcFrame {
	id?: string;
	type: string;
	command?: string;
	success?: boolean;
	data?: unknown;
	error?: string;
}

function makeStubSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	const listeners = new Set<(event: unknown) => void>();
	return {
		subscribe(fn: (event: unknown) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		subscribeCommandMetadataChanged() {
			return () => {};
		},
		registerPersistenceFailureCallback() {
			return () => {};
		},
		setSlashCommands() {},
		get state() {
			return {
				sessionId: "stub-session",
				cwd: "/tmp",
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
			return "stub-session";
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
		sessionManager: {
			onPersistenceError() {
				return () => {};
			},
			onPersistenceNotice() {
				return () => {};
			},
			getCwd() {
				return "/tmp";
			},
		},
		hasPendingAsyncWork() {
			return false;
		},
		async settleAsyncWork() {},
		exportToHtml: async (outputPath?: string) => outputPath || "/mock/main-export.html",
		...overrides,
	};
}

function createRpcHarness(opts: { transport?: "stdio" | "socket" } = {}) {
	const input = new PassThrough();
	const output = new PassThrough();
	const frames: RpcFrame[] = [];
	const waiters: Array<{ predicate: (f: RpcFrame) => boolean; resolve: (f: RpcFrame) => void }> = [];
	let buffer = "";

	output.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			const parsed = JSON.parse(line) as RpcFrame;
			frames.push(parsed);
			for (let i = waiters.length - 1; i >= 0; i--) {
				if (waiters[i].predicate(parsed)) waiters.splice(i, 1)[0].resolve(parsed);
			}
		}
	});

	const mockSession = makeStubSession();

	const server = serveRpc(
		mockSession as unknown as AgentSession,
		{ input: Readable.toWeb(input) as ReadableStream<Uint8Array>, output },
		{
			transport: opts.transport,
			onShutdown: () => {},
			onWriteFailure: () => {},
		},
	);

	let seq = 0;
	function send(cmd: Record<string, unknown>): Promise<RpcFrame> {
		const id = `cmd_${seq++}`;
		const { promise, resolve } = Promise.withResolvers<RpcFrame>();
		waiters.push({ predicate: f => f.type === "response" && f.id === id, resolve });
		input.write(`${JSON.stringify({ ...cmd, id })}\n`);
		return promise;
	}

	return {
		send,
		close() {
			input.end();
			server.close();
		},
	};
}

describe("RPC export_html", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = path.join(os.tmpdir(), `rpc-export-test-${Snowflake.next()}`);
		fs.mkdirSync(tempDir, { recursive: true });
		AgentRegistry.resetGlobalForTests();
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
		AgentRegistry.resetGlobalForTests();
	});

	it("exports main session when agentId is absent or Main", async () => {
		const harness = createRpcHarness();
		try {
			const res1 = await harness.send({ type: "export_html" });
			expect(res1.success).toBe(true);
			const data1 = res1.data as { path: string };
			expect(data1.path).toBe("/mock/main-export.html");

			const res2 = await harness.send({ type: "export_html", agentId: MAIN_AGENT_ID });
			expect(res2.success).toBe(true);
			const data2 = res2.data as { path: string };
			expect(data2.path).toBe("/mock/main-export.html");
		} finally {
			harness.close();
		}
	});

	it("exports live subagent via session.exportToHtml", async () => {
		const harness = createRpcHarness();
		let exportCalled = false;
		const mockSubSession = {
			exportToHtml: async (outputPath?: string) => {
				exportCalled = true;
				return outputPath || "/mock/sub-export.html";
			},
		};

		AgentRegistry.global().register({
			id: "live-agent-1",
			displayName: "Live Agent 1",
			kind: "sub",
			status: "idle",
			session: mockSubSession as unknown as AgentSession,
			sessionFile: "/path/to/sub.jsonl",
		});

		try {
			const res = await harness.send({ type: "export_html", agentId: "live-agent-1" });
			expect(res.success).toBe(true);
			expect(exportCalled).toBe(true);
			const data = res.data as { path: string };
			expect(data.path).toBe("/mock/sub-export.html");
		} finally {
			harness.close();
		}
	});

	it("exports parked subagent from sessionFile without reviving", async () => {
		const harness = createRpcHarness();
		const sessionFile = path.join(tempDir, "parked.jsonl");
		fs.writeFileSync(
			sessionFile,
			JSON.stringify({ type: "session", id: "parked-sess", timestamp: new Date().toISOString() }) + "\n",
		);

		AgentRegistry.global().register({
			id: "parked-agent-1",
			displayName: "Parked Agent 1",
			kind: "sub",
			status: "parked",
			session: null,
			sessionFile,
		});

		try {
			const outputPath = path.join(tempDir, "parked-out.html");
			const res = await harness.send({
				type: "export_html",
				agentId: "parked-agent-1",
				outputPath,
			});
			expect(res.success).toBe(true);
			const data = res.data as { path: string };
			expect(data.path).toBe(outputPath);
			expect(fs.existsSync(outputPath)).toBe(true);

			// Verify it was NOT revived
			const ref = AgentRegistry.global().get("parked-agent-1");
			expect(ref?.session).toBeNull();
			expect(ref?.status).toBe("parked");
		} finally {
			harness.close();
		}
	});

	it("returns error for unknown agentId", async () => {
		const harness = createRpcHarness();
		try {
			const res = await harness.send({ type: "export_html", agentId: "unknown-agent" });
			expect(res.success).toBe(false);
			expect(res.error).toContain("Unknown agent: unknown-agent");
		} finally {
			harness.close();
		}
	});

	it("enforces outputPath inside <configRoot>/run/exports/ over socket transport", async () => {
		const harness = createRpcHarness({ transport: "socket" });
		const exportsDir = path.join(getBaseConfigRoot(), "run", "exports");
		fs.mkdirSync(exportsDir, { recursive: true });

		try {
			// Disallowed location
			const badPath = path.join(tempDir, "evil.html");
			const resBad = await harness.send({ type: "export_html", outputPath: badPath });
			expect(resBad.success).toBe(false);
			expect(resBad.error).toContain("outputPath must resolve inside <configRoot>/run/exports/");

			// Allowed location
			const goodPath = path.join(exportsDir, "valid.html");
			const resGood = await harness.send({ type: "export_html", outputPath: goodPath });
			expect(resGood.success).toBe(true);
		} finally {
			harness.close();
		}
	});

	it("allows arbitrary outputPath over stdio transport", async () => {
		const harness = createRpcHarness({ transport: "stdio" });
		try {
			const anyPath = path.join(tempDir, "anywhere.html");
			const res = await harness.send({ type: "export_html", outputPath: anyPath });
			expect(res.success).toBe(true);
		} finally {
			harness.close();
		}
	});
});
