import { describe, test, expect, afterAll } from "bun:test";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { upgradeRelay, relayWebSocketHandler } from "../src/server/relay";
import type { RelayTarget } from "../src/server/relay";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temp Unix socket path. */
function tmpSocketPath(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-test-"));
	return path.join(dir, "test.sock");
}

/**
 * Fake upstream server: reads auth line, replies with ready, then echoes
 * every subsequent line back.
 */
function createFakeUpstream(socketPath: string): {
	server: net.Server;
	receivedAuth: Promise<string>;
	close: () => Promise<void>;
} {
	let resolveAuth: (v: string) => void;
	const receivedAuth = new Promise<string>(r => {
		resolveAuth = r;
	});

	const server = net.createServer(socket => {
		let first = true;
		let buffer = "";
		socket.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			let idx: number;
			while ((idx = buffer.indexOf("\n")) !== -1) {
				const line = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 1);
				if (first) {
					first = false;
					resolveAuth!(line);
					socket.write('{"type":"ready"}\n');
				} else {
					// Echo line back
					socket.write(line + "\n");
				}
			}
		});
	});

	server.listen(socketPath);

	return {
		server,
		receivedAuth,
		close: () =>
			new Promise<void>(resolve => {
				server.close(() => resolve());
				// Destroy existing connections
				server.emit("close");
			}),
	};
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const cleanups: Array<() => Promise<void> | void> = [];
afterAll(async () => {
	for (const fn of cleanups.reverse()) {
		await fn();
	}
});

describe("relay", () => {
	test("round-trip: ready, echo, and auth token verification", async () => {
		const socketPath = tmpSocketPath();
		const upstream = createFakeUpstream(socketPath);
		cleanups.push(() => upstream.close());

		// Wait for the server to be listening
		await new Promise<void>(r => upstream.server.once("listening", r));

		const TOKEN = "deadbeef1234";

		const targets: Record<string, RelayTarget> = {
			abc: { endpoint: socketPath, token: TOKEN },
		};

		const bunServer = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch(req, server) {
				const url = new URL(req.url);
				const result = upgradeRelay(req, url, server, id => targets[id] ?? null);
				if (result === undefined) return undefined as unknown as Response;
				if (result !== null) return result;
				return new Response("not found", { status: 404 });
			},
			websocket: relayWebSocketHandler,
		});
		cleanups.push(() => {
			bunServer.stop(true);
			return Promise.resolve();
		});

		// --- Test unknown id returns 404 ---
		const res404 = await fetch(`http://127.0.0.1:${bunServer.port}/ws/unknown`);
		expect(res404.status).toBe(404);

		// --- Test non-matching path returns null (falls through to 404) ---
		const resOther = await fetch(`http://127.0.0.1:${bunServer.port}/api/live`);
		expect(resOther.status).toBe(404);

		// --- Test WebSocket relay ---
		const ws = new WebSocket(`ws://127.0.0.1:${bunServer.port}/ws/abc`);

		const messages: string[] = [];
		const { promise: wsOpen, resolve: resolveOpen } = Promise.withResolvers<void>();
		const { promise: gotReady, resolve: resolveReady } = Promise.withResolvers<void>();
		const { promise: gotEcho, resolve: resolveEcho } = Promise.withResolvers<void>();

		ws.addEventListener("open", () => resolveOpen());
		ws.addEventListener("message", ev => {
			const text = typeof ev.data === "string" ? ev.data : ev.data.toString();
			messages.push(text);
			if (text.includes('"ready"')) resolveReady();
			if (text.includes('"ping"')) resolveEcho();
		});

		await wsOpen;
		await gotReady;
		expect(messages[0]).toContain('"ready"');

		// Send a ping through the relay
		ws.send('{"type":"ping"}\n');
		await gotEcho;
		expect(messages[1]).toContain('"ping"');

		// Verify the auth token the upstream received
		const authLine = await upstream.receivedAuth;
		const authObj = JSON.parse(authLine);
		expect(authObj.type).toBe("auth");
		expect(authObj.token).toBe(TOKEN);

		ws.close();
	});

	test("upstream close propagates to WS", async () => {
		const socketPath = tmpSocketPath();

		// Simple upstream that closes after auth
		const server = net.createServer(socket => {
			let buf = "";
			socket.on("data", (chunk: Buffer) => {
				buf += chunk.toString();
				if (buf.includes("\n")) {
					socket.write('{"type":"ready"}\n');
					// Close upstream after a short delay
					setTimeout(() => socket.destroy(), 50);
				}
			});
		});
		server.listen(socketPath);
		await new Promise<void>(r => server.once("listening", r));
		cleanups.push(
			() =>
				new Promise<void>(r => {
					server.close(() => r());
				}),
		);

		const targets: Record<string, RelayTarget> = {
			xyz: { endpoint: socketPath, token: "tok" },
		};

		const bunServer = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch(req, server) {
				const url = new URL(req.url);
				const result = upgradeRelay(req, url, server, id => targets[id] ?? null);
				if (result === undefined) return undefined as unknown as Response;
				if (result !== null) return result;
				return new Response("not found", { status: 404 });
			},
			websocket: relayWebSocketHandler,
		});
		cleanups.push(() => {
			bunServer.stop(true);
			return Promise.resolve();
		});

		const ws = new WebSocket(`ws://127.0.0.1:${bunServer.port}/ws/xyz`);
		const { promise: wsClosed, resolve: resolveClosed } = Promise.withResolvers<void>();
		ws.addEventListener("close", () => resolveClosed());
		ws.addEventListener("open", () => {
			/* wait for upstream close */
		});

		// Should close within a reasonable timeout
		const timeout = setTimeout(() => {
			throw new Error("WS did not close after upstream destroyed");
		}, 5000);
		await wsClosed;
		clearTimeout(timeout);
	});
});
