import { afterAll, describe, expect, it } from "bun:test";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { shutdownLiveSession, handleShutdownRequest } from "../src/server/shutdown";

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
