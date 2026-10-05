import * as fs from "node:fs";
import * as path from "node:path";
import { pathIsWithin } from "@oh-my-pi/pi-utils";
import type { DaemonOptions } from "./options";
import type { WebguiApp, WebguiAppContext, WebguiAppFactory } from "./app-types";
import { launchSessionWith } from "./launch";
import { listLiveSessions } from "./live";
import { serveStatic } from "./static";

export interface MountedApp {
	config: AppMountConfig;
	context: WebguiAppContext;
	instance: WebguiApp | null;
	loadError?: Error;
}

export interface AppMountConfig {
	name: string;
	root: string;
	staticDir: string;
	apiModule: string;
}

const APP_NAME_RE = /^[a-z][a-z0-9-]{0,31}$/;
const RESERVED_NAMES: Record<string, true> = {
	api: true,
	ws: true,
	healthz: true,
	s: true,
};

export function validateAppName(name: string): boolean {
	return APP_NAME_RE.test(name) && !RESERVED_NAMES[name];
}

export function checkConfigFileSecurity(filePath: string): void {
	const stat = fs.statSync(filePath);
	if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
		throw new Error(`Config file ${filePath} must be owned by the daemon user (uid ${process.getuid()})`);
	}
	// Refuse if group or others have write permissions (0o022)
	if ((stat.mode & 0o022) !== 0) {
		throw new Error(
			`Config file ${filePath} must not be group- or world-writable (mode: ${(stat.mode & 0o777).toString(8)})`,
		);
	}
}

export function createAppContext(config: AppMountConfig, opts: DaemonOptions): WebguiAppContext {
	const realRoot = fs.realpathSync(config.root);

	return {
		name: config.name,
		root: realRoot,
		async launchSession(launchOpts: { cwd: string; initialPrompt?: string }): Promise<{ instanceId: string }> {
			const realCwd = fs.realpathSync(launchOpts.cwd);
			if (!pathIsWithin(realRoot, realCwd)) {
				throw new Error(`Session cwd ${launchOpts.cwd} escapes app root ${realRoot}`);
			}
			const result = await launchSessionWith(opts, { cwd: realCwd, initialPrompt: launchOpts.initialPrompt });
			if (!result.instanceId) {
				throw new Error("Failed to obtain instanceId for launched session");
			}
			return { instanceId: result.instanceId };
		},
		async listLiveSessions() {
			return listLiveSessions(opts);
		},
		resolveInRoot(rel: string): string {
			const candidate = path.resolve(realRoot, rel);
			let realCandidate: string;
			try {
				realCandidate = fs.realpathSync(candidate);
			} catch {
				// If the candidate doesn't exist, check realpath of its existing parent
				let existing = candidate;
				while (!fs.existsSync(existing)) {
					const parent = path.dirname(existing);
					if (parent === existing) break;
					existing = parent;
				}
				const realParent = fs.realpathSync(existing);
				if (!pathIsWithin(realRoot, realParent)) {
					throw new Error(`Path ${rel} escapes app root ${realRoot}`);
				}
				// Recompute relative to realParent
				const remainder = path.relative(existing, candidate);
				realCandidate = path.resolve(realParent, remainder);
			}
			if (!pathIsWithin(realRoot, realCandidate)) {
				throw new Error(`Path ${rel} escapes app root ${realRoot}`);
			}
			return realCandidate;
		},
	};
}

export async function loadMountedApps(
	appsConfigFile: string | undefined,
	opts: DaemonOptions,
): Promise<Map<string, MountedApp>> {
	const mounts = new Map<string, MountedApp>();
	if (!appsConfigFile || !fs.existsSync(appsConfigFile)) {
		return mounts;
	}

	try {
		checkConfigFileSecurity(appsConfigFile);
	} catch (err) {
		console.error("Refusing to load apps config due to insecure permissions:", err);
		return mounts;
	}

	let entries: unknown;
	try {
		const raw = fs.readFileSync(appsConfigFile, "utf8");
		entries = JSON.parse(raw);
	} catch (err) {
		console.error("Failed to parse apps config JSON:", err);
		return mounts;
	}

	if (!Array.isArray(entries)) {
		console.error("Apps config must be an array of app definitions");
		return mounts;
	}

	for (const entry of entries) {
		if (
			typeof entry !== "object" ||
			entry === null ||
			typeof entry.name !== "string" ||
			typeof entry.root !== "string" ||
			typeof entry.staticDir !== "string" ||
			typeof entry.apiModule !== "string"
		) {
			console.error("Invalid app config entry:", entry);
			continue;
		}

		const config: AppMountConfig = {
			name: entry.name,
			root: entry.root,
			staticDir: entry.staticDir,
			apiModule: entry.apiModule,
		};

		if (!validateAppName(config.name)) {
			console.error(`Invalid app name: ${config.name}`);
			continue;
		}

		if (mounts.has(config.name)) {
			console.error(`Duplicate app name in config: ${config.name}`);
			continue;
		}

		let context: WebguiAppContext;
		try {
			context = createAppContext(config, opts);
		} catch (err) {
			console.error(`Failed to initialize context for app ${config.name}:`, err);
			continue;
		}

		const mounted: MountedApp = {
			config,
			context,
			instance: null,
		};

		try {
			// Deliberate exception to no-inline-imports: dynamically loading user-configured
			// external plugin modules at startup per Seam 2 specification.
			const mod = (await import(config.apiModule)) as { default?: WebguiAppFactory };
			if (typeof mod.default !== "function") {
				throw new Error(`apiModule ${config.apiModule} does not default-export a WebguiAppFactory`);
			}
			const appInstance = await mod.default(context);
			if (!appInstance || typeof appInstance.fetch !== "function") {
				throw new Error(`WebguiAppFactory for ${config.name} did not return an object with a fetch method`);
			}
			mounted.instance = appInstance;
		} catch (err) {
			console.error(`Failed to load apiModule for app ${config.name}:`, err);
			mounted.loadError = err instanceof Error ? err : new Error(String(err));
		}

		mounts.set(config.name, mounted);
	}

	return mounts;
}

export async function handleAppRequest(
	req: Request,
	url: URL,
	mounts: Map<string, MountedApp>,
): Promise<Response | null> {
	const { pathname } = url;

	// Check /api/<name>/*
	if (pathname.startsWith("/api/")) {
		const remainder = pathname.slice("/api/".length);
		const slashIdx = remainder.indexOf("/");
		const appName = slashIdx === -1 ? remainder : remainder.slice(0, slashIdx);
		const subpath = slashIdx === -1 ? "/" : remainder.slice(slashIdx);

		if (RESERVED_NAMES[appName]) {
			return null;
		}

		const mounted = mounts.get(appName);
		if (!mounted) {
			return new Response("not found", { status: 404 });
		}

		if (mounted.loadError || !mounted.instance) {
			return new Response("service unavailable", { status: 503 });
		}

		return mounted.instance.fetch(req, subpath);
	}

	// Check /<name> and /<name>/* static routes
	const match = /^\/([a-z0-9-]+)(\/.*)?$/.exec(pathname);
	if (match) {
		const appName = match[1]!;
		if (!RESERVED_NAMES[appName]) {
			const mounted = mounts.get(appName);
			if (mounted) {
				// Strip /<name> prefix from URL for serveStatic
				const rest = match[2] || "/";
				const strippedUrl = new URL(url);
				strippedUrl.pathname = rest;
				const rewrittenReq = new Request(strippedUrl.toString(), req);
				return serveStatic(rewrittenReq, mounted.config.staticDir);
			}
		}
	}

	return null;
}
