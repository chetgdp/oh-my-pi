import * as fs from "node:fs";
import * as path from "node:path";

import { $which } from "@oh-my-pi/pi-utils";

import { invalidatePastSessions, loadPastSessionPreview } from "./past";
import { invalidateLiveSessions } from "./live";
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
// Host process
// ---------------------------------------------------------------------------

/** Above the host's own 20 s readiness wait, so its error text reaches us. */
const HOST_START_TIMEOUT_MS = 25_000;

export interface LaunchResult {
	instanceId: string;
	sessionId: string;
	reused: boolean;
}

function resolveOmpBin(opts: DaemonOptions): string {
	const configured = opts.ompBin ?? process.env.WEBGUI_OMP_BIN;
	if (configured) return configured;
	const found = $which("omp");
	if (!found) {
		throw new LaunchError("omp not found on PATH; set WEBGUI_OMP_BIN to the omp binary", 500);
	}
	return found;
}

function parseHostStartOutput(stdout: string): LaunchResult {
	const line = stdout
		.split("\n")
		.map(l => l.trim())
		.findLast(l => l.length > 0);
	let parsed: unknown;
	try {
		parsed = line ? JSON.parse(line) : undefined;
	} catch {
		parsed = undefined;
	}
	const r = parsed as Partial<LaunchResult> | undefined;
	if (!r || typeof r.instanceId !== "string" || typeof r.sessionId !== "string") {
		throw new LaunchError("omp host start printed no host description", 502);
	}
	return { instanceId: r.instanceId, sessionId: r.sessionId, reused: r.reused === true };
}

async function runHostStart(opts: DaemonOptions, args: string[]): Promise<LaunchResult> {
	const bin = resolveOmpBin(opts);
	let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
	try {
		proc = Bun.spawn([bin, "host", "start", ...args], {
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			timeout: HOST_START_TIMEOUT_MS,
			killSignal: "SIGKILL",
		});
	} catch (err) {
		throw new LaunchError(`cannot run ${bin}: ${err instanceof Error ? err.message : String(err)}`, 500);
	}
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	invalidateLiveSessions();
	invalidatePastSessions();
	if (exitCode !== 0) {
		const detail = stderr.trim() || (proc.signalCode ? `killed by ${proc.signalCode}` : `exit ${exitCode}`);
		throw new LaunchError(`omp host start failed: ${detail}`, 502);
	}
	return parseHostStartOutput(stdout);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function launchSession(
	opts: DaemonOptions,
	body: { cwd: string; initialPrompt?: string },
): Promise<LaunchResult> {
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
	const args = ["--cwd", cwd];
	if (body.initialPrompt !== undefined) args.push("--prompt", body.initialPrompt);
	return runHostStart(opts, args);
}

export async function resumeSession(opts: DaemonOptions, id: string): Promise<LaunchResult> {
	const preview = await loadPastSessionPreview(id, {
		sessionsDir: opts.sessionsDir,
	});
	if (!preview) {
		throw new LaunchError("session not found", 404);
	}
	return runHostStart(opts, ["--resume", preview.path]);
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
