import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import type { Server } from "bun";
import type { RelayData } from "../src/server/relay";
import { createServer } from "../src/server/index";
import {
	publishRpcHost,
	RPC_HOST_REGISTRY_VERSION,
	type RpcHostEntry,
	type RpcHostPublication,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { TmuxRunner } from "../src/server/tmux";

// ---------------------------------------------------------------------------
// Temp dirs
// ---------------------------------------------------------------------------

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "endpoints-test-"));
const registryDir = path.join(tmpBase, "registry");
const distDir = path.join(tmpBase, "dist");

fs.mkdirSync(registryDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), "<h1>test</h1>");

const FIXTURES_DIR = path.resolve(import.meta.dir, "fixtures/sessions");

// Full paths to fixture session files (the :id in /api/past/:id is a file path)
const SESSION_1_PATH = path.join(FIXTURES_DIR, "project-a", "2026-09-10T10-00-00-000Z_sess-001.jsonl");
const SESSION_3_PATH = path.join(FIXTURES_DIR, "project-b", "2026-09-12T08-00-00-000Z_sess-003.jsonl");

// ---------------------------------------------------------------------------
// Fake Unix socket server (contract C: auth line, then ready + echo)
// Closes the connection when it receives a "shutdown" command.
// ---------------------------------------------------------------------------

const fakeSocketPath = path.join(tmpBase, "fake.sock");
const receivedCommands: string[] = [];
let fakeSocketServer: net.Server;
let publication: RpcHostPublication;

function startFakeSocket(): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	fakeSocketServer = net.createServer(conn => {
		let buffer = "";
		let authenticated = false;

		conn.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			let nl: number;
			while ((nl = buffer.indexOf("\n")) !== -1) {
				const line = buffer.slice(0, nl);
				buffer = buffer.slice(nl + 1);

				if (!authenticated) {
					let msg: { type: string; token: string };
					try {
						msg = JSON.parse(line);
					} catch {
						conn.write(JSON.stringify({ type: "error", error: "bad json" }) + "\n");
						conn.destroy();
						return;
					}
					if (msg.type !== "auth" || msg.token !== publication.token) {
						conn.write(JSON.stringify({ type: "error", error: "unauthorized" }) + "\n");
						conn.destroy();
						return;
					}
					authenticated = true;
					conn.write(JSON.stringify({ type: "ready", version: 1 }) + "\n");
					continue;
				}

				// Track commands; close on shutdown
				try {
					const parsed = JSON.parse(line);
					if (parsed.type === "shutdown") {
						receivedCommands.push("shutdown");
						conn.end();
						return;
					}
					if (parsed.command) {
						receivedCommands.push(parsed.command);
					}
				} catch {
					// not json
				}
				// Echo authenticated lines back
				conn.write(line + "\n");
			}
		});
	});
	fakeSocketServer.listen(fakeSocketPath, resolve);
	return promise;
}

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

function publishLiveEntry(): void {
	publication = publishRpcHost(
		{
			sessionId: "test-session",
			sessionName: "Test Session",
			cwd: "/tmp/test-project",
			model: "test-model",
			startedAt: Date.now(),
		},
		{ dir: registryDir },
	);
	// Overwrite the endpoint to point at our fake socket
	const entryFiles = fs.readdirSync(registryDir).filter(f => f.endsWith(".json"));
	for (const f of entryFiles) {
		const p = path.join(registryDir, f);
		const entry: RpcHostEntry = JSON.parse(fs.readFileSync(p, "utf8"));
		if (entry.instanceId === publication.entry.instanceId) {
			entry.endpoint = fakeSocketPath;
			const tmp = p + ".tmp";
			fs.writeFileSync(tmp, JSON.stringify(entry), { mode: 0o600 });
			fs.renameSync(tmp, p);
			publication.entry.endpoint = fakeSocketPath;
			break;
		}
	}
}

function writeDeadPidEntry(): void {
	const entryId = crypto.randomBytes(8).toString("hex");
	const entry: RpcHostEntry = {
		version: RPC_HOST_REGISTRY_VERSION,
		instanceId: "dead-instance-" + entryId,
		pid: 999999, // almost certainly dead
		endpoint: "/tmp/nonexistent.sock",
		token: crypto.randomBytes(32).toString("hex"),
		createdAt: Date.now() - 60_000,
		sessionId: null,
		sessionName: null,
		cwd: "/tmp/dead",
		model: null,
		startedAt: Date.now() - 60_000,
	};
	const metaPath = path.join(registryDir, `${entryId}.json`);
	fs.writeFileSync(metaPath, JSON.stringify(entry), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Fake tmux runner
// ---------------------------------------------------------------------------

const tmuxCalls: string[][] = [];

const fakeTmux: TmuxRunner = async argv => {
	tmuxCalls.push([...argv]);

	// Write a registry entry matching the launched cwd after 100ms so
	// pollForInstance discovers it. Real wall-clock delay is required here
	// because the poll loop uses real Bun.sleep intervals against the registry.
	const cwdIdx = argv.indexOf("-c");
	if (cwdIdx !== -1) {
		const launchCwd = argv[cwdIdx + 1]!;
		setTimeout(() => {
			const entryId = crypto.randomBytes(8).toString("hex");
			const entry: RpcHostEntry = {
				version: RPC_HOST_REGISTRY_VERSION,
				instanceId: "launched-" + entryId,
				pid: process.pid,
				endpoint: fakeSocketPath,
				token: publication.token,
				createdAt: Date.now(),
				sessionId: null,
				sessionName: null,
				cwd: launchCwd,
				model: null,
				startedAt: Date.now(),
			};
			const metaPath = path.join(registryDir, `${entryId}.json`);
			const tmp = metaPath + ".tmp";
			fs.writeFileSync(tmp, JSON.stringify(entry), { mode: 0o600 });
			fs.renameSync(tmp, metaPath);
		}, 100);
	}

	return { exitCode: 0, stdout: "@7\n", stderr: "" };
};

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

let server: Server<RelayData>;
let baseUrl: string;

beforeAll(async () => {
	await startFakeSocket();
	publishLiveEntry();
	writeDeadPidEntry();

	server = createServer({
		host: "127.0.0.1",
		port: 0,
		distDir,
		registryDir,
		sessionsDir: FIXTURES_DIR,
		tmux: fakeTmux,
	});
	baseUrl = `http://${server.hostname}:${server.port}`;
});

afterAll(async () => {
	server?.stop(true);
	fakeSocketServer?.close();
	publication?.close();
	fs.rmSync(tmpBase, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Poll a condition. Integration test against real sockets requires real time. */
function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	const deadline = Date.now() + timeoutMs;
	const check = (): void => {
		if (condition()) {
			resolve();
			return;
		}
		if (Date.now() > deadline) {
			reject(new Error("waitFor timed out"));
			return;
		}
		setTimeout(check, 20);
	};
	check();
	return promise;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("endpoints", () => {
	describe("GET /api/live", () => {
		it("returns the live entry without token or endpoint, excludes dead pid", async () => {
			const res = await fetch(`${baseUrl}/api/live`);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>[];
			expect(body.length).toBe(1);
			const entry = body[0]!;
			expect(entry.instanceId).toBe(publication.entry.instanceId);
			expect(entry.sessionName).toBe("Test Session");
			expect(entry).not.toHaveProperty("token");
			expect(entry).not.toHaveProperty("endpoint");
		});
	});

	describe("GET /api/past", () => {
		it("lists fixture sessions", async () => {
			const res = await fetch(`${baseUrl}/api/past?all=true`);
			expect(res.status).toBe(200);
			const body = (await res.json()) as { id: string }[];
			expect(body.length).toBeGreaterThanOrEqual(3);
			const ids = body.map(s => s.id);
			expect(ids).toContain("sess-001");
			expect(ids).toContain("sess-002");
			expect(ids).toContain("sess-003");
		});
	});

	describe("GET /api/past/:id", () => {
		it("returns preview for known session", async () => {
			const encoded = encodeURIComponent(SESSION_3_PATH);
			const res = await fetch(`${baseUrl}/api/past/${encoded}`);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body.id).toBe("sess-003");
		});

		it("returns 404 for unknown session", async () => {
			const res = await fetch(`${baseUrl}/api/past/nonexistent`);
			expect(res.status).toBe(404);
		});
	});

	describe("POST /api/launch", () => {
		it("returns 400 for missing cwd", async () => {
			const res = await fetch(`${baseUrl}/api/launch`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(400);
		});

		it("returns 400 for nonexistent cwd", async () => {
			const res = await fetch(`${baseUrl}/api/launch`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ cwd: "/nonexistent/path/xyz" }),
			});
			expect(res.status).toBe(400);
		});

		it("returns 200 with windowId and discovers instanceId", async () => {
			tmuxCalls.length = 0;
			const res = await fetch(`${baseUrl}/api/launch`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ cwd: os.tmpdir() }),
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { windowId: string; instanceId?: string };
			expect(body.windowId).toBe("@7");
			expect(body.instanceId).toBeDefined();
			// Verify tmux argv matches contract H
			expect(tmuxCalls.length).toBe(1);
			const argv = tmuxCalls[0]!;
			expect(argv).toContain("new-window");
			expect(argv).toContain("-c");
			expect(argv).toContain(os.tmpdir());
			expect(argv).toContain("fish");
			// Last arg is the fish command
			expect(argv[argv.length - 1]).toBe("omp");
		});
	});

	describe("POST /api/past/:id/resume", () => {
		it("returns 404 for unknown session", async () => {
			const res = await fetch(`${baseUrl}/api/past/nonexistent/resume`, {
				method: "POST",
			});
			expect(res.status).toBe(404);
		});

		it("returns 200 with --resume in argv for known session", async () => {
			tmuxCalls.length = 0;
			const encoded = encodeURIComponent(SESSION_1_PATH);
			const res = await fetch(`${baseUrl}/api/past/${encoded}/resume`, {
				method: "POST",
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { windowId: string };
			expect(body.windowId).toBe("@7");
			expect(tmuxCalls.length).toBe(1);
			const argv = tmuxCalls[0]!;
			const fishCmd = argv[argv.length - 1]!;
			expect(fishCmd).toContain("--resume");
			expect(fishCmd).toContain(SESSION_1_PATH);
		});
	});

	describe("POST /api/live/:instanceId/shutdown", () => {
		it("returns 404 for unknown instance", async () => {
			const res = await fetch(`${baseUrl}/api/live/nonexistent/shutdown`, {
				method: "POST",
			});
			expect(res.status).toBe(404);
		});

		it("returns 204 for known instance", async () => {
			receivedCommands.length = 0;
			const res = await fetch(`${baseUrl}/api/live/${publication.entry.instanceId}/shutdown`, { method: "POST" });
			expect(res.status).toBe(204);
			expect(receivedCommands).toContain("shutdown");
		});
	});

	describe("GET /ws/:instanceId", () => {
		it("returns 404 for unknown instance", async () => {
			const res = await fetch(`${baseUrl}/ws/nonexistent`, {
				headers: {
					Upgrade: "websocket",
					Connection: "Upgrade",
					"Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
					"Sec-WebSocket-Version": "13",
				},
			});
			expect(res.status).toBe(404);
		});

		it("receives ready frame and echoes data", async () => {
			const wsUrl = `ws://${server.hostname}:${server.port}/ws/${publication.entry.instanceId}`;
			const ws = new WebSocket(wsUrl);
			const messages: string[] = [];

			const { promise: opened, resolve: onOpen } = Promise.withResolvers<void>();
			const { promise: closed, resolve: onClose } = Promise.withResolvers<void>();

			ws.onopen = () => onOpen();
			ws.onclose = () => onClose();
			ws.onmessage = ev => {
				messages.push(String(ev.data));
			};

			await opened;

			// Wait for ready frame from the fake socket (real I/O, needs real time)
			await waitFor(() => messages.length >= 1, 3000);
			expect(messages[0]).toContain('"ready"');

			// Send a line and expect it echoed
			ws.send(JSON.stringify({ id: 99, command: "echo_test" }) + "\n");

			await waitFor(() => messages.length >= 2, 3000);
			expect(messages[1]).toContain("echo_test");

			ws.close();
			await closed;
		});
	});

	describe("static serving", () => {
		it("serves index.html at /", async () => {
			const res = await fetch(`${baseUrl}/`);
			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toContain("<h1>test</h1>");
		});

		it("rejects path traversal via symlink", async () => {
			// Create a symlink inside distDir pointing outside it
			const linkPath = path.join(distDir, "escape");
			try {
				fs.unlinkSync(linkPath);
			} catch {
				/* may not exist */
			}
			fs.symlinkSync("/etc/passwd", linkPath);
			const res = await fetch(`${baseUrl}/escape`);
			expect(res.status).toBe(404);
			fs.unlinkSync(linkPath);
		});
	});
});
