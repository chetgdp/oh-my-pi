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
import { buildNewWindowArgv } from "../src/server/tmux";

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

describe("launch argv escaping for fish shell", () => {
	it("safely escapes prompts containing quotes, $, ;, newlines, and backticks without injection", () => {
		const evilPrompt = `test 'single' and "double"; rm -rf / ; $EVIL \`whoami\` \n newline prompt`;
		const argv = buildNewWindowArgv("/tmp", [evilPrompt]);
		const shellCmd = argv[argv.length - 1];

		// The shellCmd ends with "; exit"
		expect(shellCmd.endsWith("; exit")).toBe(true);

		// Inside fish single quotes: ' becomes \', no unescaped single quotes can break out
		const commandBody = shellCmd.slice(0, -"; exit".length);
		expect(commandBody.startsWith("omp '")).toBe(true);
		expect(commandBody.endsWith("'")).toBe(true);

		// Verify that inside the quotes, every single quote is preceded by \
		const inner = commandBody.slice(5, -1);
		// Replace escaped quotes \' with placeholder and check if any raw ' remains
		const withoutEscaped = inner.replace(/\\'/g, "");
		expect(withoutEscaped.includes("'")).toBe(false);
	});
});
