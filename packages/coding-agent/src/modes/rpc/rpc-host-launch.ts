/**
 * Launcher side of `omp host start`: reuses a live host for the session or
 * spawns a detached `omp host run` child and waits until its socket answers.
 * Kept free of session/server imports so the parent stays a cheap CLI process.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "@oh-my-pi/pi-utils";
import type { Subprocess } from "bun";
import { resolveCliEntryCmd } from "../../subprocess/worker-client";
import {
	findLiveSessionHost,
	isSessionLockHeld,
	listRpcHosts,
	probeRpcHost,
	type RpcHostEntry,
	type RpcRegistryOptions,
	rpcHostsRuntimeDir,
} from "./rpc-registry";

/** Exit code of a host child that found its session already locked by a live host. */
export const RPC_HOST_EXIT_ALREADY_HOSTED = 75;
/** Stderr line prefix (followed by the session id) a host child writes before exiting with {@link RPC_HOST_EXIT_ALREADY_HOSTED}. */
export const RPC_HOST_ALREADY_HOSTED_STDERR_PREFIX = "omp host: session already hosted: ";

const READY_POLL_MS = 50;
const DEFAULT_READY_TIMEOUT_MS = 20_000;
const STDERR_TAIL_BYTES = 4096;

/** Options the hidden `omp host run` child hands to the RPC branch of the root command. */
export interface RpcHostRunOptions {
	registryDir?: string;
	prompt?: string;
}

let hostRun: RpcHostRunOptions | undefined;

/** Marks this process as a headless host child; read by the root command's RPC branch. */
export function setRpcHostRun(options: RpcHostRunOptions): void {
	hostRun = options;
}

export function getRpcHostRun(): RpcHostRunOptions | undefined {
	return hostRun;
}

export interface RpcHostStartOptions {
	/** Absolute working directory for the session. */
	cwd: string;
	/** Session file path or sessionId to resume. */
	resume?: string;
	/** First user prompt the host sends once ready. */
	prompt?: string;
	registryDir?: string;
	timeoutMs?: number;
}

export interface RpcHostStartResult {
	instanceId: string;
	sessionId: string;
	endpoint: string;
	pid: number;
	reused: boolean;
}

function toResult(entry: RpcHostEntry, reused: boolean): RpcHostStartResult {
	return {
		instanceId: entry.instanceId,
		sessionId: entry.sessionId ?? "",
		endpoint: entry.endpoint,
		pid: entry.pid,
		reused,
	};
}

function readStderrTail(file: string): string {
	try {
		const text = fs.readFileSync(file, "utf8");
		return text.slice(-STDERR_TAIL_BYTES).trim();
	} catch {
		return "";
	}
}

/** Session id a host child reported before exiting with {@link RPC_HOST_EXIT_ALREADY_HOSTED}. */
function readAlreadyHostedSessionId(file: string): string | undefined {
	for (const line of readStderrTail(file).split("\n")) {
		if (line.startsWith(RPC_HOST_ALREADY_HOSTED_STDERR_PREFIX)) {
			return line.slice(RPC_HOST_ALREADY_HOSTED_STDERR_PREFIX.length).trim() || undefined;
		}
	}
	return undefined;
}

/**
 * Start (or reuse) a headless host. Resolves once the host's registry entry
 * exists and its socket accepts a connection; rejects with a human-readable
 * error otherwise, after killing a child that never became ready.
 */
export async function startRpcHost(options: RpcHostStartOptions): Promise<RpcHostStartResult> {
	const registry: RpcRegistryOptions = { dir: options.registryDir };
	const registryDir = options.registryDir ?? rpcHostsRuntimeDir();
	if (options.resume) {
		const live = await findLiveSessionHost(options.resume, registry, { cwd: options.cwd });
		if (live) return toResult(live, true);
	}

	fs.mkdirSync(registryDir, { recursive: true, mode: 0o700 });
	const argv = [...resolveCliEntryCmd(), "host", "run", "--cwd", options.cwd];
	if (options.resume) argv.push("--resume", options.resume);
	if (options.prompt !== undefined) argv.push("--prompt", options.prompt);
	if (options.registryDir) argv.push("--registry-dir", options.registryDir);

	const timeoutMs = options.timeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;
	for (let attempt = 0; ; attempt++) {
		// The child's stderr goes to a private file, not our pipes: the host outlives
		// this process, and a closed pipe would turn its later writes into EPIPE.
		const stderrFile = path.join(registryDir, `host-${process.pid}-${Date.now()}-${attempt}.stderr.log`);
		const stderrFd = fs.openSync(stderrFile, "w", 0o600);
		let child: Subprocess;
		try {
			child = Bun.spawn(argv, {
				cwd: options.cwd,
				env: process.env,
				stdio: ["ignore", "ignore", stderrFd],
				// New session and process group: no controlling terminal, and the
				// caller's terminal signals (Ctrl-C, hangup) never reach the host.
				detached: true,
			});
		} finally {
			fs.closeSync(stderrFd);
		}
		child.unref();

		const fail = (message: string): never => {
			const tail = readStderrTail(stderrFile);
			fs.rmSync(stderrFile, { force: true });
			throw new Error(tail ? `${message}\n${tail}` : message);
		};

		let exited = false;
		while (Date.now() < deadline) {
			const own = listRpcHosts(registry).find(entry => entry.pid === child.pid);
			if (own && (await probeRpcHost(own))) {
				fs.rmSync(stderrFile, { force: true });
				return toResult(own, false);
			}
			exited = await Promise.race([child.exited.then(() => true), Bun.sleep(READY_POLL_MS).then(() => false)]);
			if (exited || child.exitCode !== null || child.signalCode !== null) {
				exited = true;
				break;
			}
		}

		if (!exited) {
			if (child.exitCode === null) {
				try {
					child.kill("SIGKILL");
				} catch (error) {
					logger.warn("Failed to kill unready omp host", { pid: child.pid, error: String(error) });
				}
			}
			return fail(`omp host did not become ready within ${timeoutMs}ms`);
		}
		if (child.exitCode !== RPC_HOST_EXIT_ALREADY_HOSTED || !options.resume) {
			return fail(`omp host exited before becoming ready (${child.signalCode ?? `exit code ${child.exitCode}`})`);
		}

		// The lock holder is either a live host (answer with it) or one that is
		// shutting down (it refuses connections while it flushes the session):
		// wait for its lock to go away, then spawn again.
		const sessionId = readAlreadyHostedSessionId(stderrFile);
		fs.rmSync(stderrFile, { force: true });
		while (Date.now() < deadline) {
			const live = await findLiveSessionHost(options.resume, registry, { cwd: options.cwd });
			if (live) return toResult(live, true);
			if (sessionId && !isSessionLockHeld(sessionId, registry)) break;
			await Bun.sleep(READY_POLL_MS);
		}
		if (Date.now() >= deadline) {
			throw new Error(`omp host session is held by another process that did not exit within ${timeoutMs}ms`);
		}
	}
}
