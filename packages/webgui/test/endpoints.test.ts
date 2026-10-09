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
import { writeFakeOmp } from "./fake-omp";

// ---------------------------------------------------------------------------
// Temp dirs
// ---------------------------------------------------------------------------

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "endpoints-test-"));
const registryDir = path.join(tmpBase, "registry");
const distDir = path.join(tmpBase, "dist");

fs.mkdirSync(registryDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), "<h1>test</h1>");

// A private copy: the delete test writes session files, and past.test.ts lists the shared fixtures in parallel.
const FIXTURES_DIR = path.join(tmpBase, "sessions");
fs.cpSync(path.resolve(import.meta.dir, "fixtures/sessions"), FIXTURES_DIR, { recursive: true });

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
					if (parsed.type === "export_html") {
						receivedCommands.push("export_html");
						if (parsed.outputPath) {
							fs.writeFileSync(parsed.outputPath, "<html><body>Fake Export</body></html>");
							conn.write(
								JSON.stringify({
									type: "response",
									command: "export_html",
									success: true,
									data: { path: parsed.outputPath },
								}) + "\n",
							);
							return;
						}
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
			sessionFile: null,
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
		sessionFile: null,
		cwd: "/tmp/dead",
		model: null,
		startedAt: Date.now() - 60_000,
	};
	const metaPath = path.join(registryDir, `${entryId}.json`);
	fs.writeFileSync(metaPath, JSON.stringify(entry), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Fake omp binary (`omp host start` contract)
// ---------------------------------------------------------------------------

const LAUNCHED = {
	instanceId: "launched-1",
	sessionId: "sess-new",
	endpoint: "/tmp/h.sock",
	pid: 999_999,
	reused: false,
};
const fakeOmp = writeFakeOmp(path.join(tmpBase, "bin"), { stdout: `${JSON.stringify(LAUNCHED)}\n` });

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
		ompBin: fakeOmp.bin,
	});
	baseUrl = `http://${server.hostname}:${server.port}`;
});

async function withServer(extra: { ompBin: string }, fn: (url: string) => Promise<void>): Promise<void> {
	const other = createServer({
		host: "127.0.0.1",
		port: 0,
		distDir,
		registryDir,
		sessionsDir: FIXTURES_DIR,
		...extra,
	});
	try {
		await fn(`http://${other.hostname}:${other.port}`);
	} finally {
		other.stop(true);
	}
}

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

		it("serves gzip over HTTP and answers 304 for a matching ETag", async () => {
			const res = await fetch(`${baseUrl}/api/past?all=true`, { headers: { "accept-encoding": "gzip" } });
			expect(res.status).toBe(200);
			expect(res.headers.get("vary")).toBe("Accept-Encoding");
			const body = (await res.json()) as { id: string }[];
			expect(body.map(s => s.id)).toContain("sess-001");
			const etag = res.headers.get("etag")!;
			const again = await fetch(`${baseUrl}/api/past?all=true`, { headers: { "if-none-match": etag } });
			expect(again.status).toBe(304);
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

	describe("DELETE /api/past/:id", () => {
		it("rejects traversal-shaped and invalid session ids with 400", async () => {
			// Client file path with extension (rejected with 400 because only session ID is accepted)
			const resExt = await fetch(`${baseUrl}/api/past/sess-001.jsonl`, { method: "DELETE" });
			expect(resExt.status).toBe(400);

			// Invalid characters / traversal segments that stay in /api/past/
			const resDotDot = await fetch(`${baseUrl}/api/past/sess..traversal`, { method: "DELETE" });
			expect(resDotDot.status).toBe(400);

			const resSpecial = await fetch(`${baseUrl}/api/past/sess$bad@id`, { method: "DELETE" });
			expect(resSpecial.status).toBe(400);

			// Normalizing traversal attempts resolving outside /api/past return 404 / 400
			const resEscape = await fetch(`${baseUrl}/api/past/%2e%2e%2fetc`, { method: "DELETE" });
			expect([400, 404]).toContain(resEscape.status);
		});
		it("returns 404 for unknown session id", async () => {
			const res = await fetch(`${baseUrl}/api/past/unknown-session-12345`, { method: "DELETE" });
			expect(res.status).toBe(404);
		});

		it("returns 409 for active live session id", async () => {
			const res = await fetch(`${baseUrl}/api/past/test-session`, { method: "DELETE" });
			expect(res.status).toBe(409);
			const body = (await res.json()) as { error: string };
			expect(body.error).toContain("active");
		});

		it("deletes a past session and its artifacts directory", async () => {
			const delSessionPath = path.join(FIXTURES_DIR, "project-a", "2026-09-20T10-00-00-000Z_sess-del.jsonl");
			const delArtifactsDir = path.join(FIXTURES_DIR, "project-a", "2026-09-20T10-00-00-000Z_sess-del");
			try {
				fs.writeFileSync(
					delSessionPath,
					JSON.stringify({
						type: "session",
						id: "sess-del",
						timestamp: "2026-09-20T10:00:00.000Z",
						cwd: "/tmp/fixture-project-a",
					}) + "\n",
				);
				fs.mkdirSync(delArtifactsDir, { recursive: true });
				fs.writeFileSync(path.join(delArtifactsDir, "data.txt"), "sample artifact");

				expect(fs.existsSync(delSessionPath)).toBe(true);
				expect(fs.existsSync(delArtifactsDir)).toBe(true);

				const res = await fetch(`${baseUrl}/api/past/sess-del`, { method: "DELETE" });
				expect(res.status).toBe(200);
				const body = (await res.json()) as { success: boolean };
				expect(body.success).toBe(true);

				expect(fs.existsSync(delSessionPath)).toBe(false);
				expect(fs.existsSync(delArtifactsDir)).toBe(false);
			} finally {
				if (fs.existsSync(delSessionPath)) fs.unlinkSync(delSessionPath);
				if (fs.existsSync(delArtifactsDir)) fs.rmSync(delArtifactsDir, { recursive: true, force: true });
			}
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

		it("runs omp host start --cwd and returns the host", async () => {
			const before = fakeOmp.calls().length;
			const res = await fetch(`${baseUrl}/api/launch`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ cwd: os.tmpdir() }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ instanceId: "launched-1", sessionId: "sess-new", reused: false });
			expect(fakeOmp.calls().slice(before)).toEqual([["host", "start", "--cwd", os.tmpdir()]]);
		});

		it("returns 502 with stderr when omp host start fails", async () => {
			const failing = writeFakeOmp(
				path.join(tmpBase, "bin"),
				{ stderr: "no model configured\n", exitCode: 1 },
				"omp-fail",
			);
			await withServer({ ompBin: failing.bin }, async url => {
				const res = await fetch(`${url}/api/launch`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ cwd: os.tmpdir() }),
				});
				expect(res.status).toBe(502);
				expect(((await res.json()) as { error: string }).error).toContain("no model configured");
			});
		});

		it("returns 500 when the omp binary is missing", async () => {
			await withServer({ ompBin: path.join(tmpBase, "no-such-omp") }, async url => {
				const res = await fetch(`${url}/api/launch`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ cwd: os.tmpdir() }),
				});
				expect(res.status).toBe(500);
				expect(((await res.json()) as { error: string }).error).toContain("no-such-omp");
			});
		});
	});

	describe("POST /api/past/:id/resume", () => {
		it("returns 404 for unknown session", async () => {
			const res = await fetch(`${baseUrl}/api/past/nonexistent/resume`, {
				method: "POST",
			});
			expect(res.status).toBe(404);
		});

		it("runs omp host start --resume <session path>", async () => {
			const before = fakeOmp.calls().length;
			const res = await fetch(`${baseUrl}/api/past/${encodeURIComponent(SESSION_1_PATH)}/resume`, {
				method: "POST",
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ instanceId: "launched-1", sessionId: "sess-new", reused: false });
			expect(fakeOmp.calls().slice(before)).toEqual([
				["host", "start", "--resume", fs.realpathSync(SESSION_1_PATH)],
			]);
		});

		it("returns 502 with stderr when the resume host fails", async () => {
			const failing = writeFakeOmp(
				path.join(tmpBase, "bin"),
				{ stderr: "session locked\n", exitCode: 2 },
				"omp-fail-resume",
			);
			await withServer({ ompBin: failing.bin }, async url => {
				const res = await fetch(`${url}/api/past/${encodeURIComponent(SESSION_1_PATH)}/resume`, { method: "POST" });
				expect(res.status).toBe(502);
				expect(((await res.json()) as { error: string }).error).toContain("session locked");
			});
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
	describe("POST /api/live/:instanceId/export", () => {
		it("returns 404 for unknown instance", async () => {
			const res = await fetch(`${baseUrl}/api/live/nonexistent/export`, {
				method: "POST",
			});
			expect(res.status).toBe(404);
		});

		it("returns 200 with text/html and cleans up temp export file", async () => {
			receivedCommands.length = 0;
			const res = await fetch(`${baseUrl}/api/live/${publication.entry.instanceId}/export`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ agentId: "scout-1" }),
			});
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("text/html");
			const disposition = res.headers.get("content-disposition") || "";
			expect(disposition).toContain("attachment; filename=");
			expect(disposition).toContain("scout-1");
			const html = await res.text();
			expect(html).toBe("<html><body>Fake Export</body></html>");
			expect(receivedCommands).toContain("export_html");
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

		it("negotiates permessage-deflate with server context takeover", async () => {
			const res = await fetch(`${baseUrl}/ws/${publication.entry.instanceId}`, {
				headers: {
					Upgrade: "websocket",
					Connection: "Upgrade",
					"Sec-WebSocket-Version": "13",
					"Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
					"Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits",
				},
			});
			const ext = res.headers.get("sec-websocket-extensions") ?? "";
			expect(res.status).toBe(101);
			expect(ext).toContain("permessage-deflate");
			// Without the server's sliding window, small per-token frames barely compress.
			expect(ext).not.toContain("server_no_context_takeover");
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

	describe("dev mode", () => {
		it("serves bundled HTML and API routes when WEBGUI_DEV=1", async () => {
			process.env.WEBGUI_DEV = "1";
			const devServer = createServer({
				host: "127.0.0.1",
				port: 0,
				distDir,
				registryDir,
				sessionsDir: FIXTURES_DIR,
				ompBin: fakeOmp.bin,
			});
			delete process.env.WEBGUI_DEV;

			try {
				const devUrl = `http://${devServer.hostname}:${devServer.port}`;
				const rootRes = await fetch(`${devUrl}/`);
				expect(rootRes.status).toBe(200);
				expect(rootRes.headers.get("content-type")).toContain("text/html");

				const apiRes = await fetch(`${devUrl}/api/live`);
				expect(apiRes.status).toBe(200);
				const body = (await apiRes.json()) as Record<string, unknown>[];
				expect(body.length).toBeGreaterThanOrEqual(1);
				expect(body.some(entry => entry.instanceId === publication.entry.instanceId)).toBe(true);

				const hzRes = await fetch(`${devUrl}/healthz`);
				expect(hzRes.status).toBe(200);
			} finally {
				devServer.stop(true);
			}
		});
	});
});
