import { afterAll, describe, expect, it } from "bun:test";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { shutdownLiveSession, handleShutdownRequest, stopLiveSession } from "../src/server/shutdown";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shutdown-test-"));
	return dir;
}

/** Fake Unix-socket server that records received lines. */
function createFakeServer(
	socketPath: string,
	opts: { token: string; errorOnAuth?: boolean },
): { server: net.Server; lines: string[]; ready: Promise<void> } {
	const lines: string[] = [];
	const { promise: ready, resolve: onReady } = Promise.withResolvers<void>();

	const server = net.createServer(conn => {
		let buf = "";
		conn.on("data", chunk => {
			buf += chunk.toString();
			let idx: number;
			while ((idx = buf.indexOf("\n")) !== -1) {
				const line = buf.slice(0, idx);
				buf = buf.slice(idx + 1);
				lines.push(line);
				handleLine(conn, line);
			}
		});
	});

	function handleLine(conn: net.Socket, line: string): void {
		let frame: { type: string; token?: string };
		try {
			frame = JSON.parse(line);
		} catch {
			return;
		}

		if (frame.type === "auth") {
			if (opts.errorOnAuth) {
				conn.write(JSON.stringify({ type: "error", error: "unauthorized" }) + "\n");
				conn.end();
				return;
			}
			// Respond with ready
			conn.write(JSON.stringify({ type: "ready", protocolVersion: 1, sessionState: {} }) + "\n");
		}

		if (frame.type === "shutdown") {
			conn.end();
		}
	}

	server.listen(socketPath, () => onReady());
	return { server, lines, ready };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("shutdownLiveSession", () => {
	const sockets: string[] = [];
	const servers: net.Server[] = [];

	afterAll(() => {
		for (const s of servers) s.close();
		for (const p of sockets) {
			try {
				fs.unlinkSync(p);
			} catch {}
		}
	});

	it("sends auth then shutdown and resolves when server closes", async () => {
		const dir = tmpDir();
		const socketPath = path.join(dir, "test.sock");
		sockets.push(socketPath);

		const token = "deadbeef1234";
		const fake = createFakeServer(socketPath, { token });
		servers.push(fake.server);
		await fake.ready;

		await shutdownLiveSession({ endpoint: socketPath, token }, 5_000);

		expect(fake.lines.length).toBe(2);
		const authFrame = JSON.parse(fake.lines[0]);
		expect(authFrame.type).toBe("auth");
		expect(authFrame.token).toBe(token);
		const shutdownFrame = JSON.parse(fake.lines[1]);
		expect(shutdownFrame.type).toBe("shutdown");
	});

	it("throws when server responds with an error frame", async () => {
		const dir = tmpDir();
		const socketPath = path.join(dir, "err.sock");
		sockets.push(socketPath);

		const fake = createFakeServer(socketPath, { token: "x", errorOnAuth: true });
		servers.push(fake.server);
		await fake.ready;

		await expect(shutdownLiveSession({ endpoint: socketPath, token: "x" }, 5_000)).rejects.toThrow("unauthorized");
	});
});

describe("handleShutdownRequest", () => {
	it("returns null for non-matching paths", async () => {
		const req = new Request("http://localhost/api/live", { method: "POST" });
		const url = new URL(req.url);
		const resp = await handleShutdownRequest(req, url);
		expect(resp).toBeNull();
	});

	it("returns 404 for unknown instanceId", async () => {
		const dir = tmpDir();
		const req = new Request("http://localhost/api/live/nonexistent/shutdown", { method: "POST" });
		const url = new URL(req.url);
		const resp = await handleShutdownRequest(req, url, { registryDir: dir });
		expect(resp).not.toBeNull();
		expect(resp!.status).toBe(404);
	});

	it("returns 204 for a known entry via publishRpcHost", async () => {
		const registryDir = tmpDir();
		const socketDir = tmpDir();
		const socketPath = path.join(socketDir, "live.sock");

		// Publish a registry entry pointing at our fake socket
		const pub = publishRpcHost(
			{
				sessionId: "s1",
				sessionName: "test",
				sessionFile: null,
				cwd: "/tmp",
				model: "test-model",
				startedAt: Date.now(),
			},
			{ dir: registryDir },
		);

		// Overwrite the endpoint in the entry file to our socket path
		// Read the entry file and patch endpoint
		const files = fs.readdirSync(registryDir).filter(f => f.endsWith(".json"));
		expect(files.length).toBe(1);
		const entryPath = path.join(registryDir, files[0]);
		const entry = JSON.parse(fs.readFileSync(entryPath, "utf-8"));
		const instanceId = entry.instanceId;
		entry.endpoint = socketPath;
		fs.writeFileSync(entryPath, JSON.stringify(entry), { mode: 0o600 });

		// Start fake server
		const fake = createFakeServer(socketPath, { token: entry.token });
		await fake.ready;

		try {
			const req = new Request(`http://localhost/api/live/${instanceId}/shutdown`, { method: "POST" });
			const url = new URL(req.url);
			const resp = await handleShutdownRequest(req, url, { registryDir });
			expect(resp).not.toBeNull();
			expect(resp!.status).toBe(204);

			// Verify the fake received auth and shutdown
			expect(fake.lines.length).toBe(2);
			expect(JSON.parse(fake.lines[0]).type).toBe("auth");
			expect(JSON.parse(fake.lines[1]).type).toBe("shutdown");
		} finally {
			fake.server.close();
			pub.close();
			try {
				fs.unlinkSync(socketPath);
			} catch {}
		}
	});
});

/** Fake host that answers abort/get_state like the RPC server. */
function createStopServer(
	socketPath: string,
	opts: {
		streamingPolls?: number;
		silentAbort?: boolean;
		errorOnAbort?: boolean;
		/** Model the host's serial queue: abort never settles, so later frames are never processed. */
		hungAbort?: boolean;
		/** Host is already tearing down: closes the connection when abort arrives. */
		closeOnAbort?: boolean;
		rejectAuth?: boolean;
	},
): { server: net.Server; lines: string[]; ready: Promise<void> } {
	const lines: string[] = [];
	const { promise: ready, resolve: onReady } = Promise.withResolvers<void>();
	let polls = 0;
	const server = net.createServer(conn => {
		let buf = "";
		conn.on("data", chunk => {
			buf += chunk.toString();
			let idx: number;
			while ((idx = buf.indexOf("\n")) !== -1) {
				const line = buf.slice(0, idx);
				buf = buf.slice(idx + 1);
				lines.push(line);
				const frame = JSON.parse(line) as { type: string; id?: string };
				const reply = (o: object) => conn.write(JSON.stringify(o) + "\n");
				if (opts.hungAbort && lines.slice(0, -1).some(l => l.includes('"abort"'))) continue;
				if (frame.type === "auth") {
					if (opts.rejectAuth) {
						reply({ type: "error", error: "invalid token" });
						conn.end();
					} else reply({ type: "ready", protocolVersion: 1, sessionState: {} });
				} else if (frame.type === "abort") {
					if (opts.closeOnAbort) conn.end();
					else if (opts.errorOnAbort) reply({ type: "error", error: "boom" });
					else if (!opts.silentAbort && !opts.hungAbort)
						reply({ id: frame.id, type: "response", command: "abort", success: true });
				} else if (frame.type === "get_state") {
					const isStreaming = polls++ < (opts.streamingPolls ?? 0);
					reply({ id: frame.id, type: "response", command: "get_state", success: true, data: { isStreaming } });
				} else if (frame.type === "shutdown") conn.end();
			}
		});
	});
	server.listen(socketPath, () => onReady());
	return { server, lines, ready };
}

describe("stopLiveSession", () => {
	const cleanups: (() => void)[] = [];
	afterAll(() => {
		for (const c of cleanups) c();
	});

	async function setup(opts: Parameters<typeof createStopServer>[1]) {
		const socketPath = path.join(tmpDir(), "stop.sock");
		const fake = createStopServer(socketPath, opts);
		cleanups.push(() => fake.server.close());
		await fake.ready;
		return { socketPath, types: () => fake.lines.map(l => JSON.parse(l).type as string) };
	}

	it("sends abort, waits for idle, then shutdown", async () => {
		const { socketPath, types } = await setup({ streamingPolls: 2 });
		const result = await stopLiveSession({ endpoint: socketPath, token: "t" }, { idleTimeoutMs: 5_000 });
		expect(result).toEqual({ timedOut: false });
		expect(types()).toEqual(["auth", "abort", "get_state", "get_state", "get_state", "shutdown"]);
	});

	it("proceeds to shutdown when the idle wait times out", async () => {
		const { socketPath, types } = await setup({ silentAbort: true });
		const start = Date.now();
		const result = await stopLiveSession({ endpoint: socketPath, token: "t" }, { idleTimeoutMs: 300 });
		expect(result).toEqual({ timedOut: false });
		expect(Date.now() - start).toBeLessThan(2_000);
		expect(types()).toEqual(["auth", "abort", "shutdown"]);
	});

	it("reports timedOut when a hung abort blocks the queued shutdown", async () => {
		const { socketPath, types } = await setup({ hungAbort: true });
		const start = Date.now();
		const result = await stopLiveSession(
			{ endpoint: socketPath, token: "t" },
			{ idleTimeoutMs: 200, closeTimeoutMs: 200 },
		);
		expect(result).toEqual({ timedOut: true });
		expect(Date.now() - start).toBeLessThan(1_000);
		expect(types()).toEqual(["auth", "abort", "shutdown"]);
	});

	it("resolves timedOut false when the host closes cleanly mid-stop", async () => {
		const { socketPath, types } = await setup({ closeOnAbort: true });
		const result = await stopLiveSession({ endpoint: socketPath, token: "t" }, { idleTimeoutMs: 2_000 });
		expect(result).toEqual({ timedOut: false });
		expect(types()).toEqual(["auth", "abort"]);
	});

	it("rejects when the host rejects auth", async () => {
		const { socketPath, types } = await setup({ rejectAuth: true });
		await expect(stopLiveSession({ endpoint: socketPath, token: "bad" }, { idleTimeoutMs: 2_000 })).rejects.toThrow(
			"invalid token",
		);
		expect(types()).toEqual(["auth"]);
	});

	it("rejects when the socket does not exist", async () => {
		const socketPath = path.join(tmpDir(), "missing.sock");
		await expect(stopLiveSession({ endpoint: socketPath, token: "t" }, { idleTimeoutMs: 2_000 })).rejects.toThrow();
	});

	it("throws RangeError for a non-positive or non-finite idleTimeoutMs", async () => {
		const target = { endpoint: "/nonexistent.sock", token: "t" };
		await expect(stopLiveSession(target, { idleTimeoutMs: 0 })).rejects.toBeInstanceOf(RangeError);
		await expect(stopLiveSession(target, { idleTimeoutMs: Number.NaN })).rejects.toBeInstanceOf(RangeError);
	});

	it("rejects on a server error frame without sending shutdown", async () => {
		const { socketPath, types } = await setup({ errorOnAbort: true });
		await expect(stopLiveSession({ endpoint: socketPath, token: "t" }, { idleTimeoutMs: 2_000 })).rejects.toThrow(
			"boom",
		);
		expect(types()).not.toContain("shutdown");
	});
});
