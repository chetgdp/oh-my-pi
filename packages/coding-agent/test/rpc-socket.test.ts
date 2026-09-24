import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";
import type { RpcHostSnapshot } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { startRpcSocketServer } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-socket";
import { serveRpc } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-server";

// ---------------------------------------------------------------------------
// Stub session
// ---------------------------------------------------------------------------

function makeStubSession(): Record<string, unknown> {
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
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const snapshot: RpcHostSnapshot = {
	sessionId: "s1",
	sessionName: "test",
	cwd: "/tmp",
	model: "test-model",
	startedAt: Date.now(),
};

function readToken(dir: string): string {
	const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
	if (files.length === 0) throw new Error("no registry entry found");
	const entry = JSON.parse(fs.readFileSync(path.join(dir, files[0]!), "utf8"));
	return entry.token;
}

function connectAndAuth(endpoint: string, token: string): Promise<{ socket: net.Socket; data: string }> {
	const { promise, resolve, reject } = Promise.withResolvers<{
		socket: net.Socket;
		data: string;
	}>();
	const socket = net.connect(endpoint);
	socket.once("error", reject);
	socket.write(JSON.stringify({ type: "auth", token }) + "\n");
	let buf = "";
	socket.on("data", chunk => {
		buf += chunk.toString();
		if (buf.includes("\n")) {
			resolve({ socket, data: buf });
		}
	});
	return promise;
}

function sendCommand(socket: net.Socket, command: object): Promise<Record<string, unknown>> {
	const { promise, resolve, reject } = Promise.withResolvers<Record<string, unknown>>();
	const onData = (chunk: Buffer): void => {
		for (const line of chunk.toString().split("\n")) {
			if (!line) continue;
			try {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				if (parsed.type === "response") {
					socket.removeListener("data", onData);
					resolve(parsed);
					return;
				}
			} catch {
				/* partial line */
			}
		}
	};
	socket.on("data", onData);
	socket.once("error", reject);
	socket.write(JSON.stringify(command) + "\n");
	return promise;
}

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-socket-test-"));
});

afterEach(() => {
	removeSyncWithRetries(tmpDir);
});

describe("RPC socket server", () => {
	test("two clients each get ready and independent responses", async () => {
		const srv = await startRpcSocketServer(makeStubSession() as never, {
			snapshot,
			onShutdown: () => {},
			registryDir: tmpDir,
			serve: serveRpc,
		});

		try {
			const token = readToken(tmpDir);
			const c1 = await connectAndAuth(srv.endpoint, token);
			const c2 = await connectAndAuth(srv.endpoint, token);

			expect(c1.data).toContain('"type":"ready"');
			expect(c2.data).toContain('"type":"ready"');

			const r1 = await sendCommand(c1.socket, {
				id: "n1",
				type: "negotiate_protocol",
				protocolVersion: 2,
			});
			const r2 = await sendCommand(c2.socket, {
				id: "n2",
				type: "negotiate_protocol",
				protocolVersion: 2,
			});
			expect(r1.id).toBe("n1");
			expect(r2.id).toBe("n2");
			expect(r1.success).toBe(true);
			expect(r2.success).toBe(true);

			c1.socket.destroy();
			c2.socket.destroy();
		} finally {
			await srv.stop();
		}
	}, 15_000);

	test("wrong token gets error frame and socket closes", async () => {
		const srv = await startRpcSocketServer(makeStubSession() as never, {
			snapshot,
			onShutdown: () => {},
			registryDir: tmpDir,
			serve: serveRpc,
		});

		try {
			const { promise: closed, resolve: resolveClosed } = Promise.withResolvers<string>();
			const socket = net.connect(srv.endpoint);
			socket.once("error", () => {});
			let buf = "";
			socket.on("data", chunk => {
				buf += chunk.toString();
			});
			socket.on("close", () => resolveClosed(buf));
			socket.write(JSON.stringify({ type: "auth", token: "bad-token" }) + "\n");

			const result = await closed;
			expect(result).toContain('"type":"error"');
			expect(result).toContain('"unauthorized"');
		} finally {
			await srv.stop();
		}
	}, 10_000);

	test("auth line over 4096 bytes closes connection", async () => {
		const srv = await startRpcSocketServer(makeStubSession() as never, {
			snapshot,
			onShutdown: () => {},
			registryDir: tmpDir,
			serve: serveRpc,
		});

		try {
			const { promise: closed, resolve: resolveClosed } = Promise.withResolvers<string>();
			const socket = net.connect(srv.endpoint);
			socket.once("error", () => {});
			let buf = "";
			socket.on("data", chunk => {
				buf += chunk.toString();
			});
			socket.on("close", () => resolveClosed(buf));
			socket.write("x".repeat(5000) + "\n");

			const result = await closed;
			expect(result).toContain('"type":"error"');
			expect(result).toContain("auth line too long");
		} finally {
			await srv.stop();
		}
	}, 10_000);

	test("one client disconnecting leaves the other responsive", async () => {
		const srv = await startRpcSocketServer(makeStubSession() as never, {
			snapshot,
			onShutdown: () => {},
			registryDir: tmpDir,
			serve: serveRpc,
		});

		try {
			const token = readToken(tmpDir);
			const c1 = await connectAndAuth(srv.endpoint, token);
			const c2 = await connectAndAuth(srv.endpoint, token);

			const c1Closed = Promise.withResolvers<void>();
			c1.socket.once("close", () => c1Closed.resolve());
			c1.socket.destroy();
			await c1Closed.promise;

			const r2 = await sendCommand(c2.socket, {
				id: "alive",
				type: "negotiate_protocol",
				protocolVersion: 2,
			});
			expect(r2.id).toBe("alive");
			expect(r2.success).toBe(true);

			c2.socket.destroy();
		} finally {
			await srv.stop();
		}
	}, 15_000);

	test("stop() closes all sockets and removes registry + socket files", async () => {
		const srv = await startRpcSocketServer(makeStubSession() as never, {
			snapshot,
			onShutdown: () => {},
			registryDir: tmpDir,
			serve: serveRpc,
		});

		const token = readToken(tmpDir);
		const c1 = await connectAndAuth(srv.endpoint, token);
		const c2 = await connectAndAuth(srv.endpoint, token);

		const c1Closed = Promise.withResolvers<void>();
		const c2Closed = Promise.withResolvers<void>();
		c1.socket.once("close", () => c1Closed.resolve());
		c2.socket.once("close", () => c2Closed.resolve());

		const endpointPath = srv.endpoint;

		await srv.stop();

		await c1Closed.promise;
		await c2Closed.promise;

		expect(fs.existsSync(endpointPath)).toBe(false);

		const remaining = fs.readdirSync(tmpDir).filter(f => f.endsWith(".json"));
		expect(remaining.length).toBe(0);
	}, 15_000);

	test("client disconnect does not cause unhandled rejection", async () => {
		const rejections: unknown[] = [];
		const onRejection = (reason: unknown) => rejections.push(reason);
		process.on("unhandledRejection", onRejection);

		const srv = await startRpcSocketServer(makeStubSession() as never, {
			snapshot,
			onShutdown: () => {},
			registryDir: tmpDir,
			serve: serveRpc,
		});

		try {
			const token = readToken(tmpDir);
			const c1 = await connectAndAuth(srv.endpoint, token);

			// Abruptly destroy the socket (simulates browser close / attach script exit)
			const closed = Promise.withResolvers<void>();
			c1.socket.once("close", () => closed.resolve());
			c1.socket.destroy();
			await closed.promise;

			// Flush event-loop microtasks so any unhandled rejection surfaces
			for (let i = 0; i < 4; i++) await new Promise<void>(r => setImmediate(r));

			// A second client can still connect (server not crashed)
			const c2 = await connectAndAuth(srv.endpoint, token);
			expect(c2.data).toContain('"type":"ready"');
			c2.socket.destroy();

			expect(rejections).toEqual([]);
		} finally {
			process.off("unhandledRejection", onRejection);
			await srv.stop();
		}
	}, 15_000);

	test("client sending shutdown invokes onShutdown and returns success", async () => {
		const shutdownTriggered = Promise.withResolvers<void>();
		const srv = await startRpcSocketServer(makeStubSession() as never, {
			snapshot,
			onShutdown: () => {
				shutdownTriggered.resolve();
			},
			registryDir: tmpDir,
			serve: serveRpc,
		});

		try {
			const token = readToken(tmpDir);
			const c = await connectAndAuth(srv.endpoint, token);

			const resp = await sendCommand(c.socket, {
				id: "sd1",
				type: "shutdown",
			});

			expect(resp.id).toBe("sd1");
			expect(resp.success).toBe(true);

			await shutdownTriggered.promise;

			c.socket.destroy();
		} finally {
			await srv.stop();
		}
	}, 15_000);
});
