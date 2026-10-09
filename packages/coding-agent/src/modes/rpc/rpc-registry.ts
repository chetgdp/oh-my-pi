/**
 * Runtime local RPC host registry.
 *
 * Each omp process with `rpc.serve` enabled publishes a JSON metadata file
 * describing how to connect. The socket server itself is started by T4;
 * this module only manages the on-disk registry and resolves the endpoint
 * path (including the sun_path fallback).
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { getBaseConfigRoot, isEnoent } from "@oh-my-pi/pi-utils";

export const RPC_HOST_REGISTRY_VERSION = 1;

export interface RpcHostSnapshot {
	sessionId: string | null;
	sessionName: string | null;
	sessionFile: string | null;
	cwd: string;
	model: string | null;
	startedAt: number;
}

/** `tui` = interactive omp with `rpc.serve`; `host` = headless `omp host`. */
export type RpcHostKind = "tui" | "host";

export interface RpcHostEntry extends RpcHostSnapshot {
	version: number;
	instanceId: string;
	pid: number;
	endpoint: string;
	token: string;
	createdAt: number;
	/** Absent in entries written before headless hosts existed; readers treat absent as `tui`. */
	kind?: RpcHostKind;
}

export interface RpcRegistryOptions {
	/** Override the default registry directory. */
	dir?: string;
	/** Kind recorded on published entries. Omitted = field absent (TUI back-compat). */
	kind?: RpcHostKind;
}

/** `sun_path` capacity: 104 bytes on macOS, 108 elsewhere. */
const SUN_PATH_LIMIT = process.platform === "darwin" ? 104 : 108;
const DEFAULT_SOCKET_FALLBACK_BASE = "/tmp";

export function rpcHostsRuntimeDir(): string {
	return path.join(getBaseConfigRoot(), "run", "rpc-hosts");
}

/**
 * Short owner-private socket directory for registries whose canonical path
 * would overflow `sun_path`, keyed by uid and the canonical registry directory.
 */
function socketFallbackDir(dir: string, base: string): string {
	const key = new Bun.CryptoHasher("sha256")
		.update(String(process.getuid?.() ?? 0))
		.update("\0")
		.update(dir)
		.digest("hex")
		.slice(0, 20);
	return path.join(base, `omp-rpc-${key}`);
}

function ensurePrivateDirSync(dir: string): void {
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	try {
		const stat = fs.statSync(dir);
		if ((stat.mode & 0o077) !== 0) fs.chmodSync(dir, 0o700);
	} catch {
		// Best-effort permission tightening.
	}
}

/**
 * Resolve the endpoint socket path. Falls back to a short `/tmp` directory
 * when the canonical path would exceed the `sun_path` limit.
 */
function resolveSocketEndpoint(dir: string, entryId: string): string {
	const canonical = path.join(dir, `${entryId}.sock`);
	if (Buffer.byteLength(canonical) < SUN_PATH_LIMIT) return canonical;
	const shortDir = socketFallbackDir(dir, DEFAULT_SOCKET_FALLBACK_BASE);
	ensurePrivateDirSync(shortDir);
	return path.join(shortDir, `${entryId}.sock`);
}

/** Timing-safe token comparison on equal-length buffers. */
export function tokenMatches(expected: string, actual: string): boolean {
	const a = Buffer.from(expected, "utf8");
	const b = Buffer.from(actual, "utf8");
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err: unknown) {
		// EPERM means the process exists but we lack permission to signal it.
		if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "EPERM") return true;
		return false;
	}
}

const INSTANCE_ID_PATTERN = /^[a-z0-9-]{8,64}$/;

function parseRpcHostEntry(text: string): RpcHostEntry | null {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof raw !== "object" || raw === null) return null;
	const o = raw as Record<string, unknown>;
	if (o.version !== RPC_HOST_REGISTRY_VERSION) return null;
	if (typeof o.instanceId !== "string" || !INSTANCE_ID_PATTERN.test(o.instanceId)) return null;
	if (typeof o.pid !== "number" || !Number.isInteger(o.pid) || o.pid <= 0) return null;
	if (typeof o.endpoint !== "string" || o.endpoint.length === 0) return null;
	if (typeof o.token !== "string" || o.token.length === 0) return null;
	if (typeof o.createdAt !== "number") return null;
	if (typeof o.cwd !== "string") return null;
	if (typeof o.startedAt !== "number") return null;
	if (o.sessionId !== null && typeof o.sessionId !== "string") return null;
	if (o.sessionName !== null && typeof o.sessionName !== "string") return null;
	// Absent in entries written by hosts older than 2026-09-26.
	if (o.sessionFile !== undefined && o.sessionFile !== null && typeof o.sessionFile !== "string") return null;
	if (o.model !== null && typeof o.model !== "string") return null;
	if (o.kind !== undefined && o.kind !== "tui" && o.kind !== "host") return null;
	return {
		version: o.version as number,
		instanceId: o.instanceId as string,
		pid: o.pid as number,
		endpoint: o.endpoint as string,
		token: o.token as string,
		createdAt: o.createdAt as number,
		sessionId: o.sessionId as string | null,
		sessionName: o.sessionName as string | null,
		sessionFile: (o.sessionFile as string | null | undefined) ?? null,
		cwd: o.cwd as string,
		model: o.model as string | null,
		startedAt: o.startedAt as number,
		...(o.kind !== undefined ? { kind: o.kind as RpcHostKind } : {}),
	};
}

/**
 * Atomically write the entry file via temp+rename. Mode 0600.
 */
function writeEntrySync(metaPath: string, entry: RpcHostEntry): void {
	const tmpPath = `${metaPath}.tmp`;
	fs.rmSync(tmpPath, { force: true });
	const fd = fs.openSync(tmpPath, "wx", 0o600);
	try {
		fs.writeFileSync(fd, JSON.stringify(entry), "utf8");
		fs.closeSync(fd);
		fs.renameSync(tmpPath, metaPath);
	} catch (err) {
		try {
			fs.closeSync(fd);
		} catch {
			/* Already closed or invalid. */
		}
		fs.rmSync(tmpPath, { force: true });
		throw err;
	}
}

export interface RpcHostPublication {
	entry: RpcHostEntry;
	endpoint: string;
	token: string;
	update(snapshot: RpcHostSnapshot): void;
	close(): void;
}

/**
 * Publish an RPC host to the local registry.
 *
 * Writes a `<entryId>.json` file (mode 0600) to the registry directory.
 * Does not open a socket server (T4 does that). The returned `endpoint`
 * is the path the server should bind to.
 */
export function publishRpcHost(snapshot: RpcHostSnapshot, opts?: RpcRegistryOptions): RpcHostPublication {
	const dir = opts?.dir ?? rpcHostsRuntimeDir();
	ensurePrivateDirSync(dir);

	const instanceId = crypto.randomBytes(8).toString("hex");
	const entryId = crypto.randomBytes(8).toString("hex");
	const token = crypto.randomBytes(32).toString("hex");
	const endpoint = resolveSocketEndpoint(dir, entryId);
	const metaPath = path.join(dir, `${entryId}.json`);

	const entry: RpcHostEntry = {
		version: RPC_HOST_REGISTRY_VERSION,
		instanceId,
		pid: process.pid,
		endpoint,
		token,
		createdAt: Date.now(),
		...snapshot,
		...(opts?.kind ? { kind: opts.kind } : {}),
	};

	writeEntrySync(metaPath, entry);

	// The socket file is owned by the server, but a crash skips its stop();
	// the endpoint lives beside the metadata so it is removed on the same path.
	const removeSync = (): void => {
		for (const target of [metaPath, endpoint]) {
			try {
				fs.rmSync(target, { force: true });
			} catch {
				/* Best-effort. */
			}
		}
	};

	process.once("exit", removeSync);

	let closed = false;
	return {
		entry,
		endpoint,
		token,
		update(newSnapshot: RpcHostSnapshot): void {
			if (closed) return;
			Object.assign(entry, newSnapshot);
			writeEntrySync(metaPath, entry);
		},
		close(): void {
			if (closed) return;
			closed = true;
			process.off("exit", removeSync);
			removeSync();
		},
	};
}

/**
 * Read a single RPC host entry by instanceId.
 */
export function readRpcHost(instanceId: string, opts?: RpcRegistryOptions): RpcHostEntry | null {
	const dir = opts?.dir ?? rpcHostsRuntimeDir();
	let names: string[];
	try {
		names = fs.readdirSync(dir);
	} catch (err) {
		if (isEnoent(err)) return null;
		throw err;
	}
	for (const name of names) {
		if (!name.endsWith(".json")) continue;
		try {
			const text = fs.readFileSync(path.join(dir, name), "utf8");
			const entry = parseRpcHostEntry(text);
			if (entry && entry.instanceId === instanceId) return entry;
		} catch {
			continue;
		}
	}
	return null;
}

/**
 * List live RPC hosts. Drops malformed, version-mismatched, and dead-pid
 * entries (deleting dead ones best-effort). Sorted by startedAt then pid.
 */
export function listRpcHosts(opts?: RpcRegistryOptions): RpcHostEntry[] {
	const dir = opts?.dir ?? rpcHostsRuntimeDir();
	let names: string[];
	try {
		names = fs.readdirSync(dir);
	} catch (err) {
		if (isEnoent(err)) return [];
		throw err;
	}

	const live: RpcHostEntry[] = [];
	for (const name of names) {
		if (!name.endsWith(".json")) continue;
		const filePath = path.join(dir, name);
		let text: string;
		try {
			text = fs.readFileSync(filePath, "utf8");
		} catch {
			continue;
		}
		const entry = parseRpcHostEntry(text);
		if (!entry) {
			try {
				fs.rmSync(filePath, { force: true });
			} catch {
				/* Best-effort. */
			}
			continue;
		}
		if (!pidAlive(entry.pid)) {
			try {
				fs.rmSync(filePath, { force: true });
			} catch {
				/* Best-effort. */
			}
			try {
				const fallback = socketFallbackDir(dir, DEFAULT_SOCKET_FALLBACK_BASE);
				if (entry.endpoint.startsWith(dir + path.sep) || entry.endpoint.startsWith(fallback + path.sep)) {
					fs.rmSync(entry.endpoint, { force: true });
				}
			} catch {
				/* Best-effort. */
			}
			continue;
		}
		live.push(entry);
	}

	live.sort((a, b) => a.startedAt - b.startedAt || a.pid - b.pid);
	return live;
}

/**
 * True iff the entry's socket accepts a connection within `timeoutMs`.
 * A registry file alone can outlive its server (SIGKILL, pid reuse).
 */
export async function probeRpcHost(entry: RpcHostEntry, timeoutMs = 1_000): Promise<boolean> {
	const { promise, resolve } = Promise.withResolvers<boolean>();
	const socket = net.connect(entry.endpoint);
	const timer = setTimeout(() => resolve(false), timeoutMs);
	socket.once("connect", () => resolve(true));
	socket.once("error", () => resolve(false));
	try {
		return await promise;
	} finally {
		clearTimeout(timer);
		socket.destroy();
	}
}

/** Path of the per-session host lock file. */
export function rpcSessionLockPath(sessionId: string, opts?: RpcRegistryOptions): string {
	const key = new Bun.CryptoHasher("sha256").update(sessionId).digest("hex").slice(0, 32);
	return path.join(opts?.dir ?? rpcHostsRuntimeDir(), `session-${key}.lock`);
}

function readLockPid(lockPath: string): number {
	return Number.parseInt(fs.readFileSync(lockPath, "utf8"), 10);
}

/**
 * Take the exclusive per-session host lock (O_EXCL file holding our pid).
 * A lock whose pid is dead is taken over. Returns false if a live process holds it.
 */
export function acquireSessionLock(sessionId: string, opts?: RpcRegistryOptions): boolean {
	ensurePrivateDirSync(opts?.dir ?? rpcHostsRuntimeDir());
	const lockPath = rpcSessionLockPath(sessionId, opts);
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			const fd = fs.openSync(lockPath, "wx", 0o600);
			try {
				fs.writeFileSync(fd, String(process.pid), "utf8");
			} finally {
				fs.closeSync(fd);
			}
			return true;
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
		}
		let holder: number;
		try {
			holder = readLockPid(lockPath);
		} catch (err) {
			if (isEnoent(err)) continue;
			throw err;
		}
		if (holder === process.pid) return true;
		// An empty lock may be mid-write by its creator; only a dead pid is provably stale.
		if (!Number.isInteger(holder) || holder <= 0 || pidAlive(holder)) return false;
		// Move the stale file aside atomically; if a contender replaced it with a live
		// lock between our read and rename, put that one back and yield to it.
		const claim = `${lockPath}.${process.pid}.stale`;
		try {
			fs.renameSync(lockPath, claim);
		} catch (err) {
			if (isEnoent(err)) continue;
			throw err;
		}
		let claimed = Number.NaN;
		try {
			claimed = readLockPid(claim);
		} catch {
			/* Treat unreadable as stale. */
		}
		if (claimed !== holder) {
			fs.renameSync(claim, lockPath);
			return false;
		}
		fs.rmSync(claim, { force: true });
	}
	return false;
}

/** Release the per-session lock if this process holds it. */
export function releaseSessionLock(sessionId: string, opts?: RpcRegistryOptions): void {
	const lockPath = rpcSessionLockPath(sessionId, opts);
	try {
		if (readLockPid(lockPath) === process.pid) fs.rmSync(lockPath, { force: true });
	} catch {
		/* Absent or unreadable: nothing of ours to release. */
	}
}
