import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Server } from "bun";
import { createServer } from "../src/server/index";
import { publishListeningHost } from "./listening-host";

const TAILNET = "tail1234.ts.net";

describe("tailnet trust and CORS", () => {
	let registryDir: string;
	let server: Server<unknown> | undefined;
	let savedTailnet: string | undefined;
	const closers: Array<{ close(): void }> = [];

	beforeEach(() => {
		registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "cors-test-"));
		savedTailnet = Bun.env.WEBGUI_TAILNET;
	});

	afterEach(() => {
		for (const c of closers) c.close();
		closers.length = 0;
		server?.stop(true);
		server = undefined;
		if (savedTailnet === undefined) delete Bun.env.WEBGUI_TAILNET;
		else Bun.env.WEBGUI_TAILNET = savedTailnet;
		fs.rmSync(registryDir, { recursive: true, force: true });
	});

	function start(tailnet: string | undefined): string {
		if (tailnet === undefined) delete Bun.env.WEBGUI_TAILNET;
		else Bun.env.WEBGUI_TAILNET = tailnet;
		const distDir = path.join(registryDir, "dist");
		server = createServer({ registryDir, host: "127.0.0.1", port: 0, distDir });
		return `http://127.0.0.1:${server.port}`;
	}

	it("allows a matching tailnet origin on GET and POST with CORS headers", async () => {
		const base = start(TAILNET);
		const origin = `https://mac.${TAILNET}`;
		const get = await fetch(`${base}/api/live`, { headers: { origin } });
		expect(get.status).toBe(200);
		expect(get.headers.get("access-control-allow-origin")).toBe(origin);
		expect(get.headers.get("vary")).toContain("Origin");
		expect(get.headers.get("access-control-allow-credentials")).toBeNull();

		const post = await fetch(`${base}/api/launch`, {
			method: "POST",
			headers: { origin: `${origin}:8443`, "content-type": "application/json" },
			body: "{}",
		});
		expect(post.status).not.toBe(403);
		expect(post.headers.get("access-control-allow-origin")).toBe(`${origin}:8443`);
	});

	it("refuses an origin from another tailnet", async () => {
		const base = start(TAILNET);
		const res = await fetch(`${base}/api/live`, { headers: { origin: "https://evil.tail9999.ts.net" } });
		expect(res.status).toBe(403);
		expect(res.headers.get("access-control-allow-origin")).toBeNull();
		const post = await fetch(`${base}/api/launch`, {
			method: "POST",
			headers: { origin: "https://evil.tail9999.ts.net" },
			body: "{}",
		});
		expect(post.status).toBe(403);
	});

	it("refuses bare *.ts.net when WEBGUI_TAILNET is set", async () => {
		const base = start(TAILNET);
		expect((await fetch(`${base}/api/live`, { headers: { origin: "https://x.ts.net" } })).status).toBe(403);
		expect((await fetch(`${base}/healthz`, { headers: { host: "x.ts.net" } })).status).toBe(403);
		expect((await fetch(`${base}/healthz`, { headers: { host: `mac.${TAILNET}` } })).status).toBe(200);
	});

	it("allows bare *.ts.net when WEBGUI_TAILNET is unset", async () => {
		const base = start(undefined);
		const res = await fetch(`${base}/api/live`, { headers: { origin: "https://x.ts.net" } });
		expect(res.status).toBe(200);
		expect(res.headers.get("access-control-allow-origin")).toBe("https://x.ts.net");
		expect((await fetch(`${base}/healthz`, { headers: { host: "x.ts.net" } })).status).toBe(200);
	});

	it("answers preflight with 204 for trusted and 403 for untrusted origins", async () => {
		const base = start(TAILNET);
		const origin = `https://phone.${TAILNET}`;
		const ok = await fetch(`${base}/api/launch`, {
			method: "OPTIONS",
			headers: { origin, "access-control-request-method": "POST" },
		});
		expect(ok.status).toBe(204);
		expect(ok.headers.get("access-control-allow-origin")).toBe(origin);
		expect(ok.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
		expect(ok.headers.get("access-control-allow-headers")).toBe("content-type");
		expect(ok.headers.get("access-control-max-age")).toBe("600");
		expect(ok.headers.get("vary")).toContain("Origin");

		const bad = await fetch(`${base}/api/launch`, {
			method: "OPTIONS",
			headers: { origin: "https://evil.example.com", "access-control-request-method": "POST" },
		});
		expect(bad.status).toBe(403);
		expect(bad.headers.get("access-control-allow-origin")).toBeNull();

		const badHost = await fetch(`${base}/api/launch`, {
			method: "OPTIONS",
			headers: { host: "evil.example.com", origin },
		});
		expect(badHost.status).toBe(403);
	});

	it("accepts a WebSocket upgrade from a trusted cross-origin page and refuses others", async () => {
		const base = start(TAILNET);
		const pub = await publishListeningHost(
			{ sessionId: "s1", sessionName: "S", sessionFile: null, cwd: "/tmp", model: "m", startedAt: Date.now() },
			{ dir: registryDir },
		);
		closers.push(pub);
		const wsUrl = `${base.replace("http", "ws")}/ws/${pub.entry.instanceId}`;

		const opened = await new Promise<boolean>(resolve => {
			const ws = new WebSocket(wsUrl, { headers: { origin: `https://mac.${TAILNET}` } });
			ws.onopen = () => {
				ws.close();
				resolve(true);
			};
			ws.onerror = () => resolve(false);
		});
		expect(opened).toBe(true);

		const refused = await new Promise<boolean>(resolve => {
			const ws = new WebSocket(wsUrl, { headers: { origin: "https://evil.tail9999.ts.net" } });
			ws.onopen = () => {
				ws.close();
				resolve(false);
			};
			ws.onerror = () => resolve(true);
		});
		expect(refused).toBe(true);
	});
});
