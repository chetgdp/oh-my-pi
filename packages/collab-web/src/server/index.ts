// OMP Web GUI server - serves the SPA and bridges WebSocket to RPC.

import { resolve, join } from "node:path";
import { RpcBridge, type WsData } from "./rpc-bridge";
import type { ClientMessage } from "./protocol";

const DEV_ORIGIN = process.env.OMP_DEV_ORIGIN;

function corsHeaders(): HeadersInit {
	if (!DEV_ORIGIN) return {};
	return {
		"access-control-allow-origin": DEV_ORIGIN,
		"access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
		"access-control-allow-headers": "content-type",
	};
}

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT) || 8081;
const DIST_DIR = resolve(import.meta.dir, "../../dist");

const bridge = new RpcBridge();

const devShell = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OMP</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/index.tsx"></script>
</body>
</html>`;

async function serveStatic(pathname: string): Promise<Response | null> {
	const safePath = pathname.replace(/\.\./g, "");
	const filePath = join(DIST_DIR, safePath);
	const file = Bun.file(filePath);
	if (await file.exists()) {
		return new Response(file);
	}
	return null;
}

async function serveIndex(): Promise<Response> {
	const indexFile = Bun.file(join(DIST_DIR, "index.html"));
	if (await indexFile.exists()) {
		return new Response(indexFile, {
			headers: { "content-type": "text/html; charset=utf-8" },
		});
	}
	return new Response(devShell, {
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders() },
	});
}

export const server = Bun.serve<WsData>({
	hostname: HOST,
	port: PORT,
	async fetch(req, serverInstance) {
		const url = new URL(req.url);

		// CORS preflight for dev mode
		if (DEV_ORIGIN && req.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}

		if (url.pathname === "/ws") {
			const ok = serverInstance.upgrade(req, {
				data: { id: crypto.randomUUID() },
			});
			if (ok) return undefined as unknown as Response;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		// API endpoints
		if (url.pathname === "/api/sessions" && req.method === "GET") {
			const all = url.searchParams.get("all") === "true";
			const cwd = url.searchParams.get("cwd") || undefined;
			try {
				const sessions = await bridge.listSessions({ cwd, all });
				return json({
					currentCwd: bridge.getCwd(),
					currentSessionFile: bridge.getCurrentSessionFile(),
					currentSessionId: bridge.getCurrentSessionId(),
					sessions,
				});
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return json({ error: msg }, 500);
			}
		}

		if (url.pathname === "/api/sessions/preview" && req.method === "GET") {
			const sessionPath = url.searchParams.get("path");
			if (!sessionPath) return json({ error: "Missing path parameter" }, 400);
			try {
				const preview = await bridge.previewSession(sessionPath);
				return json(preview);
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return json({ error: msg }, 500);
			}
		}

		if (url.pathname === "/api/workspaces" && req.method === "GET") {
			try {
				const workspaces = await bridge.listWorkspaces();
				return json({
					currentCwd: bridge.getCwd(),
					workspaces,
				});
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return json({ error: msg }, 500);
			}
		}

		if (url.pathname === "/api/sessions/new" && req.method === "POST") {
			try {
				await bridge.newSession();
				return json({ ok: true, state: bridge.getState() });
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return json({ error: msg }, 500);
			}
		}

		if (url.pathname === "/api/sessions/switch" && req.method === "POST") {
			try {
				const body = (await req.json().catch(() => ({}))) as {
					sessionPath?: string;
				};
				if (!body.sessionPath) {
					return json({ error: "Missing sessionPath in body" }, 400);
				}
				await bridge.switchSession(body.sessionPath);
				return json({ ok: true, state: bridge.getState() });
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return json({ error: msg }, 500);
			}
		}

		if (url.pathname === "/api/sessions/rename" && req.method === "POST") {
			try {
				const body = (await req.json().catch(() => ({}))) as {
					sessionPath?: string;
					newTitle?: string;
				};
				if (!body.sessionPath || !body.newTitle) {
					return json({ error: "Missing sessionPath or newTitle in body" }, 400);
				}
				await bridge.renameSession(body.sessionPath, body.newTitle);
				return json({ ok: true });
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return json({ error: msg }, 500);
			}
		}

		if (url.pathname === "/api/sessions/delete" && (req.method === "DELETE" || req.method === "POST")) {
			try {
				const body = (await req.json().catch(() => ({}))) as {
					sessionPath?: string;
				};
				if (!body.sessionPath) {
					return json({ error: "Missing sessionPath in body" }, 400);
				}
				await bridge.deleteSession(body.sessionPath);
				return json({ ok: true });
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return json({ error: msg }, 500);
			}
		}

		// Try static file
		if (url.pathname !== "/") {
			const resp = await serveStatic(url.pathname);
			if (resp) return resp;
		}

		return await serveIndex();
	},
	websocket: {
		idleTimeout: 255,
		sendPings: true,
		open(ws) {
			bridge.registerClient(ws);
		},
		message(ws, raw) {
			try {
				const msg: ClientMessage = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
				void bridge.handleMessage(ws, msg);
			} catch (err) {
				console.error("[ws] bad message:", err);
			}
		},
		close(ws) {
			bridge.unregisterClient(ws);
		},
	},
});

await bridge.start();
console.log(`OMP Web GUI running at http://${HOST}:${PORT}`);
