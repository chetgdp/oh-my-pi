import index from "../../index.html";
import type { Server } from "bun";
import type { RelayData } from "./relay";
import type { DaemonOptions } from "./options";
import { handleLiveRequest, invalidateLiveSessions, resolveLiveEndpoint } from "./live";
import { handlePastRequest, invalidatePastSessions } from "./past";
import { handleLaunchRequest } from "./launch";
import { handleShutdownRequest } from "./shutdown";
import { handleExportRequest } from "./export";
import { upgradeRelay, relayWebSocketHandler } from "./relay";
import { serveStatic } from "./static";
import { handleAppRequest, loadMountedApps } from "./apps";
import { validateHostAndOrigin } from "./security";
import { getBaseConfigRoot } from "@oh-my-pi/pi-utils";
import * as path from "node:path";

export async function handleRequest(
	req: Request,
	opts: DaemonOptions,
	server?: Server<RelayData>,
	distDir?: string,
): Promise<Response | undefined> {
	const sec = validateHostAndOrigin(req, { allowedHosts: opts.allowedHosts });
	if (!sec.valid) {
		return new Response(sec.reason ?? "forbidden", { status: sec.status ?? 403 });
	}

	const url = new URL(req.url);
	const { pathname } = url;
	if (req.method === "GET" && pathname === "/healthz") {
		return new Response("ok");
	}

	// API routes -- order matters: more specific patterns first.
	if (pathname === "/api/live") {
		return (await handleLiveRequest(req, url, opts)) ?? new Response("not found", { status: 404 });
	}

	if (pathname === "/api/launch" || (pathname.startsWith("/api/past/") && pathname.endsWith("/resume"))) {
		return (await handleLaunchRequest(req, url, opts)) ?? new Response("not found", { status: 404 });
	}

	if (pathname.startsWith("/api/past")) {
		return (await handlePastRequest(req, url, opts)) ?? new Response("not found", { status: 404 });
	}

	if (pathname.startsWith("/api/live/") && pathname.endsWith("/shutdown")) {
		const res = await handleShutdownRequest(req, url, opts);
		invalidateLiveSessions();
		invalidatePastSessions();
		return res ?? new Response("not found", { status: 404 });
	}

	if (pathname.startsWith("/api/live/") && pathname.endsWith("/export")) {
		return (await handleExportRequest(req, url, opts)) ?? new Response("not found", { status: 404 });
	}

	// App-mounted routes (/api/<name>/* and /<name>/*)
	if (opts.mounts && opts.mounts.size > 0) {
		const appRes = await handleAppRequest(req, url, opts.mounts);
		if (appRes !== null) {
			return appRes;
		}
	}
	// WebSocket relay
	if (pathname.startsWith("/ws/") && server) {
		const resolve = (id: string) => resolveLiveEndpoint(id, opts);
		const result = upgradeRelay(req, url, server, resolve);
		if (result === null) {
			// Path didn't match; fall through to static.
		} else {
			return result;
		}
	}

	// Static files / SPA fallback
	if (distDir && (req.method === "GET" || req.method === "HEAD")) {
		return serveStatic(req, distDir);
	}

	return new Response("not found", { status: 404 });
}

export function createServer(
	opts: DaemonOptions & {
		host: string;
		port: number;
		distDir: string;
	},
): Server<RelayData> {
	const isDev = process.env.WEBGUI_DEV === "1";

	if (isDev) {
		return Bun.serve({
			hostname: opts.host,
			port: opts.port,
			development: true,
			idleTimeout: 30,
			routes: {
				"/api/*": async (req, server) => {
					return (await handleRequest(req, opts, server)) ?? new Response("not found", { status: 404 });
				},
				"/ws/*": (req, server) => {
					return handleRequest(req, opts, server);
				},
				"/healthz": async (req, server) => {
					return (await handleRequest(req, opts, server)) ?? new Response("not found", { status: 404 });
				},
				"/*": index,
			},
			websocket: relayWebSocketHandler,
		});
	}

	return Bun.serve({
		hostname: opts.host,
		port: opts.port,
		idleTimeout: 30,
		fetch(req, server) {
			return handleRequest(req, opts, server, opts.distDir);
		},
		websocket: relayWebSocketHandler,
	});
}

export function defaultAppsConfigFile(): string {
	return path.join(getBaseConfigRoot(), "webgui", "apps.json");
}

export async function initServerOptions(
	opts: DaemonOptions & { host: string; port: number; distDir: string },
): Promise<DaemonOptions & { host: string; port: number; distDir: string }> {
	if (!opts.mounts) {
		const configFile = opts.appsConfigFile ?? defaultAppsConfigFile();
		opts.mounts = await loadMountedApps(configFile, opts);
	}
	return opts;
}

if (import.meta.main) {
	const host = process.env.HOST ?? "127.0.0.1";
	const port = Number(process.env.PORT ?? 42049);
	const distDir = new URL("../../dist", import.meta.url).pathname;
	const resolvedOpts = await initServerOptions({ host, port, distDir });
	const server = createServer(resolvedOpts);
	console.log(`webgui server listening on http://${server.hostname}:${server.port}`);
}
