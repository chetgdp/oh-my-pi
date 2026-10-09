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
