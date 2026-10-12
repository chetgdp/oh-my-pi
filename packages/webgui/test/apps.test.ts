import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	checkConfigFileSecurity,
	createAppContext,
	handleAppRequest,
	loadMountedApps,
	validateAppName,
	type AppMountConfig,
} from "../src/server/apps";
import { validateHostAndOrigin } from "../src/server/security";

describe("validateAppName", () => {
	it("accepts valid names", () => {
		expect(validateAppName("maska")).toBe(true);
		expect(validateAppName("app-1")).toBe(true);
		expect(validateAppName("my-cool-app-2026")).toBe(true);
		expect(validateAppName("a")).toBe(true);
	});

	it("rejects reserved names", () => {
		expect(validateAppName("api")).toBe(false);
		expect(validateAppName("ws")).toBe(false);
		expect(validateAppName("healthz")).toBe(false);
		expect(validateAppName("s")).toBe(false);
	});

	it("rejects invalid characters, uppercase, and length over 32", () => {
		expect(validateAppName("Maska")).toBe(false);
		expect(validateAppName("1app")).toBe(false);
		expect(validateAppName("-app")).toBe(false);
		expect(validateAppName("app_name")).toBe(false);
		expect(validateAppName("app.name")).toBe(false);
		expect(validateAppName("a".repeat(33))).toBe(false);
	});
});

describe("checkConfigFileSecurity", () => {
	it("passes for secure 0o600 config file", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apps-sec-"));
		try {
			const file = path.join(tmp, "apps.json");
			fs.writeFileSync(file, "[]", { mode: 0o600 });
			expect(() => checkConfigFileSecurity(file)).not.toThrow();
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("refuses group-writable or world-writable config file", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apps-sec-"));
		try {
			const file = path.join(tmp, "apps.json");
			fs.writeFileSync(file, "[]", { mode: 0o600 });
			fs.chmodSync(file, 0o666);
			expect(() => checkConfigFileSecurity(file)).toThrow(/group- or world-writable/);

			fs.chmodSync(file, 0o620);
			expect(() => checkConfigFileSecurity(file)).toThrow(/group- or world-writable/);

			fs.chmodSync(file, 0o602);
			expect(() => checkConfigFileSecurity(file)).toThrow(/group- or world-writable/);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});
});

describe("WebguiAppContext and containment escape", () => {
	it("resolveInRoot resolves normal subpaths and blocks escapes (../ and symlink)", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-"));
		const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "outside-"));
		try {
			fs.mkdirSync(path.join(tmp, "sub"), { recursive: true });
			fs.writeFileSync(path.join(tmp, "sub", "file.txt"), "hello");
			fs.writeFileSync(path.join(outsideDir, "secret.txt"), "shh");

			const symlinkPath = path.join(tmp, "evil-link");
			fs.symlinkSync(outsideDir, symlinkPath);

			const config: AppMountConfig = {
				name: "testapp",
				root: tmp,
				staticDir: tmp,
				apiModule: "/nonexistent",
			};
			const ctx = createAppContext(config, {});

			// Valid resolution
			const resolved = ctx.resolveInRoot("sub/file.txt");
			expect(resolved).toBe(fs.realpathSync(path.join(tmp, "sub", "file.txt")));

			// Dot-dot traversal escape
			expect(() => ctx.resolveInRoot("../outside")).toThrow(/escapes app root/);
			expect(() => ctx.resolveInRoot("../../etc/passwd")).toThrow(/escapes app root/);

			// Symlink escape
			expect(() => ctx.resolveInRoot("evil-link/secret.txt")).toThrow(/escapes app root/);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
			fs.rmSync(outsideDir, { recursive: true, force: true });
		}
	});

	it("launchSession enforces cwd inside root", async () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-"));
		const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "outside-"));
		try {
			const config: AppMountConfig = {
				name: "testapp",
				root: tmp,
				staticDir: tmp,
				apiModule: "/nonexistent",
			};
			const ctx = createAppContext(config, {});

			expect(ctx.launchSession({ cwd: outsideDir })).rejects.toThrow(/escapes app root/);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
			fs.rmSync(outsideDir, { recursive: true, force: true });
		}
	});

	it("listSessions returns sessions inside app root newest first, including live status", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-sessions-"));
		const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), "other-root-"));
		const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "sessions-dir-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-dir-"));

		let listener: Bun.UnixSocketListener<undefined> | undefined;
		try {
			const projDir = path.join(sessionsDir, "proj");
			fs.mkdirSync(projDir, { recursive: true });

			const s1File = path.join(projDir, "2026-10-05T10-00-00-000Z_sess1.jsonl");
			const s2File = path.join(projDir, "2026-10-05T12-00-00-000Z_sess2.jsonl");
			const sOtherFile = path.join(projDir, "2026-10-05T14-00-00-000Z_sessOther.jsonl");

			fs.writeFileSync(
				s1File,
				JSON.stringify({
					type: "session",
					version: 3,
					id: "sess1",
					timestamp: "2026-10-05T10:00:00.000Z",
					cwd: appRoot,
				}) + "\n",
			);
			fs.writeFileSync(
				s2File,
				JSON.stringify({
					type: "session",
					version: 3,
					id: "sess2",
					timestamp: "2026-10-05T12:00:00.000Z",
					cwd: appRoot,
				}) + "\n",
			);
			fs.writeFileSync(
				sOtherFile,
				JSON.stringify({
					type: "session",
					version: 3,
					id: "sessOther",
					timestamp: "2026-10-05T14:00:00.000Z",
					cwd: otherRoot,
				}) + "\n",
			);

			// Make sess2 live: a registry file plus a socket that accepts connections
			const endpoint = path.join(registryDir, "live1.sock");
			listener = Bun.listen({ unix: endpoint, socket: { data() {} } });
			fs.writeFileSync(
				path.join(registryDir, "live1.json"),
				JSON.stringify({
					version: 1,
					instanceId: "inst-live-2",
					pid: process.pid,
					endpoint,
					token: "tok",
					createdAt: Date.now(),
					sessionId: "sess2",
					sessionName: "sess2",
					sessionFile: s2File,
					cwd: appRoot,
					model: "mock-model",
					startedAt: 1791200000000,
				}),
			);

			const config: AppMountConfig = {
				name: "testapp",
				root: appRoot,
				staticDir: appRoot,
				apiModule: "/nonexistent",
			};
			const ctx = createAppContext(config, { sessionsDir, registryDir });

			const sessions = await ctx.listSessions();
			expect(sessions).toHaveLength(2);
			expect(sessions[0].sessionId).toBe("sess2");
			expect(sessions[0].live).toBe(true);
			expect(sessions[0].instanceId).toBe("inst-live-2");
			expect(sessions[1].sessionId).toBe("sess1");
			expect(sessions[1].live).toBe(false);
			expect(sessions[1].instanceId).toBeUndefined();
		} finally {
			listener?.stop(true);
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(otherRoot, { recursive: true, force: true });
			fs.rmSync(sessionsDir, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	});

	it("listSubagentResults returns top-level subagents only, skips nested child, checks containment and strict sessionId", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-subagents-"));
		const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "outside-root-subagents-"));
		const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "sessions-dir-subagents-"));

		try {
			const projDir = path.join(sessionsDir, "proj");
			fs.mkdirSync(projDir, { recursive: true });

			const sessionFile = path.join(projDir, "2026-10-05T10-00-00-000Z_valid-session.jsonl");
			fs.writeFileSync(
				sessionFile,
				JSON.stringify({
					type: "session",
					version: 3,
					id: "valid-session",
					timestamp: "2026-10-05T10:00:00.000Z",
					cwd: appRoot,
				}) + "\n",
			);

			const outsideSessionFile = path.join(projDir, "2026-10-05T10-00-00-000Z_outside-session.jsonl");
			fs.writeFileSync(
				outsideSessionFile,
				JSON.stringify({
					type: "session",
					version: 3,
					id: "outside-session",
					timestamp: "2026-10-05T10:00:00.000Z",
					cwd: outsideRoot,
				}) + "\n",
			);

			const subDir = path.join(projDir, "2026-10-05T10-00-00-000Z_valid-session");
			fs.mkdirSync(subDir, { recursive: true });

			// Subagent 1: top-level with .md output
			fs.writeFileSync(
				path.join(subDir, "ActorOne.jsonl"),
				JSON.stringify({ type: "session_init", task: "Session name: actor-001-1" }) + "\n",
			);
			fs.writeFileSync(path.join(subDir, "ActorOne.md"), '{"outcome": "met"}');

			// Subagent 2: top-level without .md output
			fs.writeFileSync(
				path.join(subDir, "ActorTwo.jsonl"),
				JSON.stringify({ type: "session_init", task: "Session name: actor-002-1" }) + "\n",
			);

			// Nested child in subdir (must be skipped)
			const nestedDir = path.join(subDir, "ActorOne");
			fs.mkdirSync(nestedDir, { recursive: true });
			fs.writeFileSync(
				path.join(nestedDir, "NestedVision.jsonl"),
				JSON.stringify({ type: "session_init", task: "Session name: actor-001-nested" }) + "\n",
			);
			fs.writeFileSync(path.join(nestedDir, "NestedVision.md"), "nested output");

			const config: AppMountConfig = {
				name: "testapp",
				root: appRoot,
				staticDir: appRoot,
				apiModule: "/nonexistent",
			};
			const ctx = createAppContext(config, { sessionsDir });

			// Strict sessionId check
			expect(ctx.listSubagentResults("../bad-session")).rejects.toThrow(/Invalid sessionId/);
			expect(ctx.listSubagentResults("bad/session")).rejects.toThrow(/Invalid sessionId/);
			expect(ctx.listSubagentResults("bad;rm")).rejects.toThrow(/Invalid sessionId/);

			// Escaping cwd check
			expect(ctx.listSubagentResults("outside-session")).rejects.toThrow(/escapes app root/);

			// Valid subagent results
			const results = await ctx.listSubagentResults("valid-session");
			expect(results).toHaveLength(2);

			const ids = results.map(r => r.id).sort();
			expect(ids).toEqual(["ActorOne", "ActorTwo"]);

			const a1 = results.find(r => r.id === "ActorOne")!;
			expect(a1.task).toBe("Session name: actor-001-1");
			expect(a1.output).toBe('{"outcome": "met"}');

			const a2 = results.find(r => r.id === "ActorTwo")!;
			expect(a2.task).toBe("Session name: actor-002-1");
			expect(a2.output).toBeUndefined();
		} finally {
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(outsideRoot, { recursive: true, force: true });
			fs.rmSync(sessionsDir, { recursive: true, force: true });
		}
	});
});

describe("module load failure -> 503 and app routing", () => {
	it("returns 503 when apiModule fails to load, but static files still work", async () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "app-fail-"));
		try {
			const staticDir = path.join(tmp, "dist");
			fs.mkdirSync(staticDir, { recursive: true });
			fs.writeFileSync(path.join(staticDir, "index.html"), "<h1>App UI</h1>");

			const config: AppMountConfig = {
				name: "brokenapp",
				root: tmp,
				staticDir,
				apiModule: path.join(tmp, "missing-api-module.ts"),
			};

			const configFile = path.join(tmp, "apps.json");
			fs.writeFileSync(configFile, JSON.stringify([config]), { mode: 0o600 });

			const mounts = await loadMountedApps(configFile, {});
			expect(mounts.has("brokenapp")).toBe(true);
			const mounted = mounts.get("brokenapp")!;
			expect(mounted.loadError).toBeDefined();

			// Routing /api/brokenapp/something -> 503
			const apiReq = new Request("http://127.0.0.1/api/brokenapp/items");
			const apiRes = await handleAppRequest(apiReq, new URL(apiReq.url), mounts);
			expect(apiRes).not.toBeNull();
			expect(apiRes!.status).toBe(503);

			// Routing unknown app -> 404
			const unknownReq = new Request("http://127.0.0.1/api/otherapp/items");
			const unknownRes = await handleAppRequest(unknownReq, new URL(unknownReq.url), mounts);
			expect(unknownRes).not.toBeNull();
			expect(unknownRes!.status).toBe(404);

			// Static serving for brokenapp -> 200
			const staticReq = new Request("http://127.0.0.1/brokenapp/");
			const staticRes = await handleAppRequest(staticReq, new URL(staticReq.url), mounts);
			expect(staticRes).not.toBeNull();
			expect(staticRes!.status).toBe(200);
			expect(await staticRes!.text()).toBe("<h1>App UI</h1>");
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("routes successfully when apiModule loads correctly", async () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "app-ok-"));
		try {
			const staticDir = path.join(tmp, "dist");
			fs.mkdirSync(staticDir, { recursive: true });
			fs.writeFileSync(path.join(staticDir, "index.html"), "<h1>Healthy App</h1>");

			const apiFile = path.join(tmp, "api.ts");
			fs.writeFileSync(
				apiFile,
				`export default function createApp(ctx) {
					return {
						async fetch(req, subpath) {
							if (subpath === "/ping") return Response.json({ ok: true, app: ctx.name });
							return new Response("not found in app", { status: 404 });
						}
					};
				}`,
			);

			const config: AppMountConfig = {
				name: "healthyapp",
				root: tmp,
				staticDir,
				apiModule: apiFile,
			};

			const configFile = path.join(tmp, "apps.json");
			fs.writeFileSync(configFile, JSON.stringify([config]), { mode: 0o600 });

			const mounts = await loadMountedApps(configFile, {});
			expect(mounts.has("healthyapp")).toBe(true);

			const req = new Request("http://127.0.0.1/api/healthyapp/ping");
			const res = await handleAppRequest(req, new URL(req.url), mounts);
			expect(res).not.toBeNull();
			expect(res!.status).toBe(200);
			const data = (await res!.json()) as { ok: boolean; app: string };
			expect(data.ok).toBe(true);
			expect(data.app).toBe("healthyapp");
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});
});

describe("security hardening: host and origin validation", () => {
	it("allows local host and same-origin / no-origin GET requests", () => {
		const req = new Request("http://127.0.0.1:42049/api/live", {
			headers: { host: "127.0.0.1:42049" },
		});
		expect(validateHostAndOrigin(req).valid).toBe(true);

		const reqLocalhost = new Request("http://localhost:42049/api/live", {
			headers: { host: "localhost:42049" },
		});
		expect(validateHostAndOrigin(reqLocalhost).valid).toBe(true);
	});

	it("rejects foreign Host header (DNS rebinding prevention)", () => {
		const req = new Request("http://evil.com/api/live", {
			headers: { host: "evil.com" },
		});
		const res = validateHostAndOrigin(req);
		expect(res.valid).toBe(false);
		expect(res.status).toBe(403);
	});

	it("accepts the tailscale serve host and its same-origin WS upgrade", () => {
		const req = new Request("https://pq9.example.ts.net:42049/ws/abc", {
			headers: {
				host: "pq9.example.ts.net:42049",
				upgrade: "websocket",
				origin: "https://pq9.example.ts.net:42049",
			},
		});
		expect(validateHostAndOrigin(req).valid).toBe(true);
		const ipv6 = new Request("http://[::1]:42049/", { headers: { host: "[::1]:42049" } });
		expect(validateHostAndOrigin(ipv6).valid).toBe(true);
	});

	it("rejects cross-origin POST or non-GET requests", () => {
		const req = new Request("http://127.0.0.1:42049/api/launch", {
			method: "POST",
			headers: {
				host: "127.0.0.1:42049",
				origin: "http://attacker.com",
			},
		});
		const res = validateHostAndOrigin(req);
		expect(res.valid).toBe(false);
		expect(res.status).toBe(403);
		expect(res.reason).toBe("cross-origin request rejected");
	});

	it("rejects cross-origin WebSocket upgrades", () => {
		const req = new Request("http://127.0.0.1:42049/ws/instance123", {
			headers: {
				host: "127.0.0.1:42049",
				upgrade: "websocket",
				origin: "http://evil.org",
			},
		});
		const res = validateHostAndOrigin(req);
		expect(res.valid).toBe(false);
		expect(res.status).toBe(403);
	});

	it("allows same-origin WebSocket upgrade and POST requests", () => {
		const reqWs = new Request("http://127.0.0.1:42049/ws/instance123", {
			headers: {
				host: "127.0.0.1:42049",
				upgrade: "websocket",
				origin: "http://127.0.0.1:42049",
			},
		});
		expect(validateHostAndOrigin(reqWs).valid).toBe(true);

		const reqPost = new Request("http://127.0.0.1:42049/api/launch", {
			method: "POST",
			headers: {
				host: "127.0.0.1:42049",
				origin: "http://localhost:42049",
			},
		});
		expect(validateHostAndOrigin(reqPost).valid).toBe(true);
	});
});

describe("createAppContext.stopSession", () => {
	it("rejects unknown instances and instances outside the app root", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-stop-"));
		const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), "other-root-stop-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-dir-stop-"));
		const endpoint = path.join(registryDir, "outside.sock");
		let received = "";
		const listener = Bun.listen({
			unix: endpoint,
			socket: {
				data(_s, chunk) {
					received += chunk.toString();
				},
			},
		});
		try {
			fs.writeFileSync(
				path.join(registryDir, "outside.json"),
				JSON.stringify({
					version: 1,
					instanceId: "inst-outside",
					pid: process.pid,
					endpoint,
					token: "tok",
					createdAt: Date.now(),
					sessionId: "sx",
					sessionName: "sx",
					sessionFile: null,
					cwd: otherRoot,
					model: "mock-model",
					startedAt: Date.now(),
				}),
			);
			const config: AppMountConfig = {
				name: "testapp",
				root: appRoot,
				staticDir: appRoot,
				apiModule: "/nonexistent",
			};
			const ctx = createAppContext(config, { registryDir });

			await expect(ctx.stopSession("inst-missing")).rejects.toThrow("not found");
			await expect(ctx.stopSession("inst-outside")).rejects.toThrow("escapes app root");
			expect(received).not.toContain("abort");
			expect(received).not.toContain("shutdown");
		} finally {
			listener.stop(true);
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(otherRoot, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	});

	// Child-process fake host: publishes its own registry entry, serves the
	// socket, removes the entry on shutdown (unless hung) and on SIGTERM.
	const HOST_SCRIPT = `
const net = require("node:net");
const fs = require("node:fs");
const [dir, id, cwd, mode] = process.argv.slice(2);
const endpoint = dir + "/" + id + ".sock";
const jsonPath = dir + "/" + id + ".json";
const cleanup = () => { try { fs.rmSync(jsonPath, { force: true }); fs.rmSync(endpoint, { force: true }); } catch {} };
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
const server = net.createServer(conn => {
	let buf = "";
	conn.on("data", chunk => {
		buf += chunk.toString();
		let i;
		while ((i = buf.indexOf("\\n")) !== -1) {
			const f = JSON.parse(buf.slice(0, i));
			buf = buf.slice(i + 1);
			if (f.type === "auth") conn.write(JSON.stringify({ type: "ready", protocolVersion: 1, sessionState: {} }) + "\\n");
			if (mode === "reuse" && f.type === "abort") {
				// Simulate pid reuse: the entry now names another live process (our parent).
				const e = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
				fs.writeFileSync(jsonPath, JSON.stringify({ ...e, pid: process.ppid }));
			}
			if (mode !== "ok") continue; // serialized queue blocked behind a hung abort
			if (f.type === "abort" || f.type === "get_state")
				conn.write(JSON.stringify({ type: "response", id: f.id, command: f.type, success: true, data: { isStreaming: false } }) + "\\n");
			if (f.type === "shutdown") { cleanup(); server.close(); conn.end(() => process.exit(0)); }
		}
	});
});
server.listen(endpoint, () => {
	fs.writeFileSync(jsonPath, JSON.stringify({ version: 1, instanceId: id, pid: process.pid, endpoint, token: "tok",
		createdAt: Date.now(), sessionId: "s", sessionName: "s", sessionFile: null, cwd, model: "m", startedAt: Date.now() }));
	console.log("ready");
});
`;

	async function spawnHost(registryDir: string, id: string, cwd: string, mode: "ok" | "hung" | "reuse") {
		const scriptPath = path.join(registryDir, "host.cjs");
		await Bun.write(scriptPath, HOST_SCRIPT);
		const proc = Bun.spawn([process.execPath, scriptPath, registryDir, id, cwd, mode], {
			stdout: "pipe",
			stderr: "inherit",
		});
		const reader = proc.stdout.getReader();
		let out = "";
		while (!out.includes("ready")) {
			const { value, done } = await reader.read();
			if (done) throw new Error("fake host exited before ready");
			out += new TextDecoder().decode(value);
		}
		reader.releaseLock();
		return proc;
	}

	function makeCtx(appRoot: string, registryDir: string) {
		const config: AppMountConfig = { name: "testapp", root: appRoot, staticDir: appRoot, apiModule: "/nonexistent" };
		return createAppContext(config, { registryDir });
	}

	function alive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	it("stops a responsive host and the registry entry disappears", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-stop-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-stop-"));
		const proc = await spawnHost(registryDir, "inst-okay", appRoot, "ok");
		try {
			const ctx = makeCtx(appRoot, registryDir);
			expect(await ctx.stopSession("inst-okay", { timeoutMs: 2_000 })).toEqual({ stopped: true });
			expect(fs.existsSync(path.join(registryDir, "inst-okay.json"))).toBe(false);
			await proc.exited;
		} finally {
			proc.kill();
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	});

	it("escalates to SIGTERM when the host never answers abort", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-stop-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-stop-"));
		const proc = await spawnHost(registryDir, "inst-hung", appRoot, "hung");
		try {
			const ctx = makeCtx(appRoot, registryDir);
			expect(await ctx.stopSession("inst-hung", { timeoutMs: 300 })).toEqual({ stopped: true });
			expect(await proc.exited).toBe(0);
			expect(proc.signalCode).toBeNull(); // exited via its SIGTERM handler
			expect(fs.existsSync(path.join(registryDir, "inst-hung.json"))).toBe(false);
		} finally {
			proc.kill(9);
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	}, 20_000);

	it("does not signal when the registry entry's pid changed (pid reuse guard)", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-stop-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-stop-"));
		const proc = await spawnHost(registryDir, "inst-reuse", appRoot, "reuse");
		try {
			const ctx = makeCtx(appRoot, registryDir);
			const pending = ctx.stopSession("inst-reuse", { timeoutMs: 300 });
			expect(await pending).toEqual({ stopped: false });
			expect(alive(proc.pid)).toBe(true);
		} finally {
			proc.kill(9);
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	}, 20_000);

	it("rejects non-positive timeoutMs before contacting the host", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-stop-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-stop-"));
		const proc = await spawnHost(registryDir, "inst-range", appRoot, "ok");
		try {
			const ctx = makeCtx(appRoot, registryDir);
			await expect(ctx.stopSession("inst-range", { timeoutMs: 0 })).rejects.toBeInstanceOf(RangeError);
			await expect(ctx.stopSession("inst-range", { timeoutMs: Number.NaN })).rejects.toBeInstanceOf(RangeError);
			expect(alive(proc.pid)).toBe(true);
			expect(fs.existsSync(path.join(registryDir, "inst-range.json"))).toBe(true);
		} finally {
			proc.kill(9);
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	});

	it("reports a deleted instance cwd as no longer existing", async () => {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-root-stop-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-stop-"));
		const goneCwd = path.join(appRoot, "gone");
		fs.mkdirSync(goneCwd);
		const proc = await spawnHost(registryDir, "inst-gone", goneCwd, "ok");
		try {
			fs.rmSync(goneCwd, { recursive: true });
			const ctx = makeCtx(appRoot, registryDir);
			await expect(ctx.stopSession("inst-gone")).rejects.toThrow("no longer exists");
			expect(alive(proc.pid)).toBe(true);
		} finally {
			proc.kill(9);
			fs.rmSync(appRoot, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	});
});
