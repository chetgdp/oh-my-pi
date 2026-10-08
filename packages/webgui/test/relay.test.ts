import { describe, test, expect, afterAll } from "bun:test";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import * as zlib from "node:zlib";
import { COALESCE_MAX_BYTES, upgradeRelay, relayWebSocketHandler } from "../src/server/relay";
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

/** Relay wired to a raw upstream socket the test writes to, plus a WebSocket client recording frames. */
async function openRawRelay(query = ""): Promise<{
	upstream: net.Socket;
	authLine: string;
	frames: string[];
	binaryFrames: Uint8Array[];
	nextFrame: () => Promise<void>;
	closed: Promise<void>;
}> {
	const socketPath = tmpSocketPath();
	const { promise: socketReady, resolve: resolveSocket } = Promise.withResolvers<net.Socket>();
	let authLine = "";
	const server = net.createServer(socket => {
		socket.once("data", d => {
			authLine = d.toString().trim();
			resolveSocket(socket);
		});
	});
	server.listen(socketPath);
	await new Promise<void>(r => server.once("listening", r));
	const bunServer = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch(req, srv) {
			const result = upgradeRelay(req, new URL(req.url), srv, () => ({ endpoint: socketPath, token: "t" }));
			if (result === undefined) return undefined as unknown as Response;
			return result ?? new Response("not found", { status: 404 });
		},
		websocket: relayWebSocketHandler,
	});
	cleanups.push(() => {
		bunServer.stop(true);
		return new Promise<void>(r => server.close(() => r()));
	});
	const ws = new WebSocket(`ws://127.0.0.1:${bunServer.port}/ws/x${query}`);
	ws.binaryType = "arraybuffer";
	const frames: string[] = [];
	const binaryFrames: Uint8Array[] = [];
	let waiter: (() => void) | undefined;
	ws.onmessage = ev => {
		if (typeof ev.data === "string") frames.push(ev.data);
		else binaryFrames.push(new Uint8Array(ev.data as ArrayBuffer));
		waiter?.();
	};
	const { promise: closed, resolve: resolveClosed } = Promise.withResolvers<void>();
	ws.onclose = () => resolveClosed();
	const upstream = await socketReady;
	return {
		upstream,
		authLine,
		frames,
		binaryFrames,
		nextFrame: () =>
			new Promise<void>(r => {
				waiter = r;
			}),
		closed,
	};
}

/** Decodes frames the way the browser does: one raw inflate stream across all of them, in order. */
async function inflateFrames(frames: Uint8Array[]): Promise<string> {
	const inflate = zlib.createInflateRaw();
	const out: Buffer[] = [];
	for (const frame of frames) {
		inflate.write(frame);
		await new Promise<void>(r => inflate.flush(zlib.constants.Z_SYNC_FLUSH, () => r()));
		let chunk: Buffer | null;
		while ((chunk = inflate.read() as Buffer | null) !== null) out.push(chunk);
	}
	inflate.destroy();
	return Buffer.concat(out).toString("utf8");
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

	test("a multi-byte character split across a chunk boundary arrives intact", async () => {
		const socketPath = tmpSocketPath();
		const { promise: socketReady, resolve: resolveSocket } = Promise.withResolvers<net.Socket>();

		const server = net.createServer(s => {
			let authed = false;
			let buf = "";
			s.on("data", (chunk: Buffer) => {
				if (!authed) {
					buf += chunk.toString();
					const idx = buf.indexOf("\n");
					if (idx !== -1) {
						authed = true;
						resolveSocket(s);
					}
				}
			});
		});
		server.listen(socketPath);
		await new Promise<void>(r => server.once("listening", r));

		const bunServer = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch(req, srv) {
				const url = new URL(req.url);
				const result = upgradeRelay(req, url, srv, id =>
					id === "test-utf8" ? { endpoint: socketPath, token: "tok" } : null,
				);
				if (result === undefined) return undefined as unknown as Response;
				if (result !== null) return result;
				return new Response("not found", { status: 404 });
			},
			websocket: relayWebSocketHandler,
		});
		cleanups.push(() => {
			bunServer.stop(true);
			return new Promise<void>(r => server.close(() => r()));
		});

		const ws = new WebSocket(`ws://127.0.0.1:${bunServer.port}/ws/test-utf8`);
		// Frames arrive verbatim, newline included; chunk boundaries are not preserved.
		let received = "";
		const { promise: messageReceived, resolve: resolveMessage } = Promise.withResolvers<string>();

		ws.addEventListener("message", ev => {
			received += typeof ev.data === "string" ? ev.data : ev.data.toString();
			if (received.endsWith("\n")) resolveMessage(received);
		});

		const upstreamSocket = await socketReady;

		const fullMsg = '{"text":"Hello 🎉 World — CJK 你好"}\n';
		const fullBuf = Buffer.from(fullMsg, "utf8");

		// Split right in the middle of the 4-byte emoji 🎉 (0xF0, 0x9F, 0x8E, 0x89)
		const emojiIdx = fullBuf.indexOf(Buffer.from("🎉"));
		expect(emojiIdx).toBeGreaterThan(0);

		const chunk1 = fullBuf.subarray(0, emojiIdx + 2);
		const chunk2 = fullBuf.subarray(emojiIdx + 2);

		upstreamSocket.write(chunk1);
		await new Promise(r => queueMicrotask(r));
		upstreamSocket.write(chunk2);

		const msg = await messageReceived;
		expect(msg).toBe(fullMsg);
		expect(msg).not.toContain("\uFFFD");
		ws.close();
	});

	test("server frames are deflate-compressed and round-trip intact", async () => {
		const socketPath = tmpSocketPath();
		const { promise: socketReady, resolve: resolveSocket } = Promise.withResolvers<net.Socket>();
		const server = net.createServer(socket => {
			socket.once("data", () => resolveSocket(socket));
		});
		server.listen(socketPath);
		await new Promise<void>(r => server.once("listening", r));

		const bunServer = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch(req, srv) {
				const result = upgradeRelay(req, new URL(req.url), srv, () => ({ endpoint: socketPath, token: "t" }));
				if (result === undefined) return undefined as unknown as Response;
				return result ?? new Response("not found", { status: 404 });
			},
			websocket: relayWebSocketHandler,
		});
		cleanups.push(() => {
			bunServer.stop(true);
			return new Promise<void>(r => server.close(() => r()));
		});

		// A raw TCP client exposes the RSV1 bit, which the WebSocket API hides.
		const client = net.connect(bunServer.port as number, "127.0.0.1");
		await new Promise<void>(r => client.once("connect", r));
		client.write(
			"GET /ws/x HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
				"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n" +
				"Sec-WebSocket-Extensions: permessage-deflate\r\n\r\n",
		);

		const inflater = zlib.createInflateRaw();
		const inflated: Buffer[] = [];
		inflater.on("data", (d: Buffer) => inflated.push(d));
		const inflate = (payload: Buffer) =>
			new Promise<string>(resolve => {
				inflated.length = 0;
				inflater.write(Buffer.concat([payload, Buffer.from([0, 0, 0xff, 0xff])]));
				inflater.flush(zlib.constants.Z_SYNC_FLUSH, () => resolve(Buffer.concat(inflated).toString("utf8")));
			});

		let headers = "";
		let buf = Buffer.alloc(0);
		let wireBytes = 0;
		let received = "";
		let compressedFrames = 0;
		const { promise: done, resolve: resolveDone } = Promise.withResolvers<void>();
		const { promise: handshake, resolve: resolveHandshake } = Promise.withResolvers<void>();
		const { promise: firstFrame, resolve: resolveFirstFrame } = Promise.withResolvers<void>();
		let queue = Promise.resolve();
		client.on("data", (chunk: Buffer) => {
			buf = Buffer.concat([buf, chunk]);
			if (!headers) {
				const end = buf.indexOf("\r\n\r\n");
				if (end < 0) return;
				headers = buf.subarray(0, end).toString();
				buf = buf.subarray(end + 4);
				resolveHandshake();
			}
			while (buf.length >= 2) {
				let len = buf[1] & 0x7f;
				let off = 2;
				if (len === 126) {
					if (buf.length < 4) return;
					len = buf.readUInt16BE(2);
					off = 4;
				} else if (len === 127) {
					if (buf.length < 10) return;
					len = Number(buf.readBigUInt64BE(2));
					off = 10;
				}
				if (buf.length < off + len) return;
				const rsv1 = (buf[0] & 0x40) !== 0;
				const payload = Buffer.from(buf.subarray(off, off + len));
				wireBytes += off + len;
				buf = buf.subarray(off + len);
				queue = queue.then(async () => {
					if (rsv1) compressedFrames++;
					received += rsv1 ? await inflate(payload) : payload.toString("utf8");
					resolveFirstFrame();
					if (received.endsWith("\n")) resolveDone();
				});
			}
		});

		const upstreamSocket = await socketReady;
		await handshake;
		expect(headers).toContain("permessage-deflate");

		const line = '{"type":"delta","text":"Hello 🎉 World — CJK 你好"}';
		const fullMsg = `${line.repeat(200)}\n`;
		const fullBuf = Buffer.from(fullMsg, "utf8");
		const split = fullBuf.indexOf(Buffer.from("🎉")) + 2;
		upstreamSocket.write(fullBuf.subarray(0, split));
		// The relay must have flushed the first half before the rest arrives, so the split really crosses chunks.
		await firstFrame;
		upstreamSocket.write(fullBuf.subarray(split));

		await done;
		expect(received).toBe(fullMsg);
		expect(compressedFrames).toBeGreaterThan(0);
		expect(wireBytes).toBeLessThan(fullBuf.length / 5);
		client.destroy();
		inflater.close();
	});
	test("small upstream writes within the window coalesce into one frame, in order", async () => {
		const { upstream, frames, nextFrame } = await openRawRelay();
		const lines = Array.from({ length: 10 }, (_, i) => `{"type":"delta","i":${i}}\n`);
		const first = nextFrame();
		for (const line of lines) {
			upstream.write(line);
			await Bun.sleep(1);
		}
		await first;
		await Bun.sleep(100);
		expect(frames).toEqual([lines.join("")]);
	});

	test("buffered bytes past the threshold flush without waiting for the window", async () => {
		const { upstream, frames } = await openRawRelay();
		const line = `{"type":"delta","text":"${"x".repeat(1000)}"}\n`;
		const payload = line.repeat(Math.ceil((COALESCE_MAX_BYTES * 4) / line.length));
		upstream.write(payload);
		const deadline = Date.now() + 2000;
		while (frames.join("").length < payload.length && Date.now() < deadline) await Bun.sleep(5);
		expect(frames.join("")).toBe(payload);
		expect(frames.length).toBeGreaterThan(1);
	});

	test("pending text is flushed before the upstream close propagates", async () => {
		const { upstream, frames, closed } = await openRawRelay();
		upstream.end('{"type":"last"}\n');
		await closed;
		expect(frames).toEqual(['{"type":"last"}\n']);
	});

	test("a valid commands hash is forwarded in the auth line; an invalid one is dropped", async () => {
		const ok = await openRawRelay("?commands=abc_DEF-123");
		expect(JSON.parse(ok.authLine)).toEqual({ type: "auth", token: "t", commandsHash: "abc_DEF-123" });
		const bad = await openRawRelay(`?commands=${encodeURIComponent('x"y')}`);
		expect(JSON.parse(bad.authLine)).toEqual({ type: "auth", token: "t" });
	});

	test("z=deflate-raw sends binary frames of one deflate stream that decode to the exact upstream bytes", async () => {
		const { upstream, frames, binaryFrames, closed } = await openRawRelay("?z=deflate-raw");
		const shared = Buffer.from(crypto.getRandomValues(new Uint8Array(1200))).toString("base64");
		const batches = Array.from({ length: 8 }, (_, i) => `{"type":"message_update","i":${i},"text":"${shared}"}\n`);
		const euro = Buffer.from('{"t":"\u20ac"}\n');
		const sent: Buffer[] = [];
		for (const batch of batches) {
			const buf = Buffer.from(batch);
			sent.push(buf);
			upstream.write(buf);
			await Bun.sleep(70);
		}
		// A multi-byte character split across upstream chunks that land in separate frames.
		sent.push(euro);
		upstream.write(euro.subarray(0, 7));
		await Bun.sleep(70);
		upstream.end(euro.subarray(7));
		await closed;

		expect(frames).toEqual([]);
		expect(binaryFrames.length).toBeGreaterThan(batches.length);
		expect(await inflateFrames(binaryFrames)).toBe(Buffer.concat(sent).toString("utf8"));
		const streamBytes = binaryFrames.reduce((n, f) => n + f.length, 0);
		const perMessageBytes = batches.reduce((n, b) => n + zlib.deflateRawSync(b).length, 0);
		expect(streamBytes).toBeLessThan(perMessageBytes / 3);
	});

	test("without z, or with an unknown z value, frames stay text", async () => {
		for (const query of ["", "?z=gzip", "?z=deflate-raw2"]) {
			const { upstream, frames, binaryFrames, closed } = await openRawRelay(query);
			upstream.end('{"type":"last"}\n');
			await closed;
			expect(binaryFrames).toEqual([]);
			expect(frames).toEqual(['{"type":"last"}\n']);
		}
	});
});
