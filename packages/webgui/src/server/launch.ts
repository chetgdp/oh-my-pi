import * as fs from "node:fs";
import * as path from "node:path";

import { listRpcHosts } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";

import { invalidatePastSessions, loadPastSessionPreview } from "./past";
import { invalidateLiveSessions } from "./live";
import { newWindow } from "./tmux";
import type { DaemonOptions } from "./options";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class LaunchError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "LaunchError";
	}
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_POLL_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 250;

/**
 * Poll the registry for a newly appeared host matching `cwd` that was
 * created after `since`. Returns the instanceId if found within the
 * timeout, or undefined.
 */
async function pollForInstance(
	registryDir: string | undefined,
	cwd: string,
	since: number,
	timeoutMs: number,
): Promise<string | undefined> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await Bun.sleep(POLL_INTERVAL_MS);
		const hosts = listRpcHosts(registryDir ? { dir: registryDir } : undefined);
		for (const h of hosts) {
			if (h.cwd === cwd && h.createdAt > since) {
				return h.instanceId;
			}
		}
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function launchSessionWith(
	opts: DaemonOptions,
	body: { cwd: string; initialPrompt?: string },
	internal: { pollTimeoutMs?: number } = {},
): Promise<{ windowId: string; instanceId?: string }> {
	const { cwd } = body;
	if (!path.isAbsolute(cwd)) {
		throw new LaunchError("cwd must be an absolute path", 400);
	}
	try {
		const stat = fs.statSync(cwd);
		if (!stat.isDirectory()) {
			throw new LaunchError("cwd is not a directory", 400);
		}
	} catch (err) {
		if (err instanceof LaunchError) throw err;
		throw new LaunchError("cwd does not exist", 400);
	}

	if (!opts.tmux) {
		throw new LaunchError("no tmux runner configured", 500);
	}
	const launchTime = Date.now();
	const ompArgs = body.initialPrompt !== undefined ? [body.initialPrompt] : [];
	const windowId = await newWindow(opts.tmux, cwd, ompArgs);

	const instanceId = await pollForInstance(
		opts.registryDir,
		cwd,
		launchTime,
		internal.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
	);
	invalidateLiveSessions();
	invalidatePastSessions();

	return instanceId ? { windowId, instanceId } : { windowId };
}

export async function launchSession(
	opts: DaemonOptions,
	body: { cwd: string; initialPrompt?: string },
): Promise<{ windowId: string; instanceId?: string }> {
	return launchSessionWith(opts, body);
}

export async function resumeSessionWith(
	opts: DaemonOptions,
	id: string,
	internal: { pollTimeoutMs?: number } = {},
): Promise<{ windowId: string; instanceId?: string }> {
	const preview = await loadPastSessionPreview(id, {
		sessionsDir: opts.sessionsDir,
	});
	if (!preview) {
		throw new LaunchError("session not found", 404);
	}

	const cwd = preview.cwd || "/";
	if (!opts.tmux) {
		throw new LaunchError("no tmux runner configured", 500);
	}
	const launchTime = Date.now();
	const windowId = await newWindow(opts.tmux, cwd, ["--resume", preview.path]);

	const instanceId = await pollForInstance(
		opts.registryDir,
		cwd,
		launchTime,
		internal.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
	);
	invalidateLiveSessions();
	invalidatePastSessions();

	return instanceId ? { windowId, instanceId } : { windowId };
}

export async function resumeSession(
	opts: DaemonOptions,
	id: string,
): Promise<{ windowId: string; instanceId?: string }> {
	return resumeSessionWith(opts, id);
}

// ---------------------------------------------------------------------------
// HTTP route handler
// ---------------------------------------------------------------------------

const RESUME_PATTERN = /^\/api\/past\/([^/]+)\/resume$/;

export async function handleLaunchRequest(req: Request, url: URL, opts: DaemonOptions): Promise<Response | null> {
	const json = (body: unknown, status: number) =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});

	// POST /api/launch
	if (req.method === "POST" && url.pathname === "/api/launch") {
		let body: { cwd: string };
		try {
			const raw: unknown = await req.json();
			if (!raw || typeof raw !== "object" || typeof (raw as Record<string, unknown>).cwd !== "string") {
				return json({ error: "missing cwd" }, 400);
			}
			body = raw as { cwd: string };
		} catch {
			return json({ error: "invalid JSON" }, 400);
		}
		try {
			return json(await launchSession(opts, body), 200);
		} catch (err) {
			if (err instanceof LaunchError) {
				return json({ error: err.message }, err.status);
			}
			throw err;
		}
	}

	// POST /api/past/:id/resume
	const resumeMatch = url.pathname.match(RESUME_PATTERN);
	if (req.method === "POST" && resumeMatch) {
		const id = decodeURIComponent(resumeMatch[1]);
		try {
			return json(await resumeSession(opts, id), 200);
		} catch (err) {
			if (err instanceof LaunchError) {
				return json({ error: err.message }, err.status);
			}
			throw err;
		}
	}

	return null;
}
