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
import * as path from "node:path";
import { getBaseConfigRoot, isEnoent } from "@oh-my-pi/pi-utils";

export const RPC_HOST_REGISTRY_VERSION = 1;

export interface RpcHostSnapshot {
	sessionId: string | null;
	sessionName: string | null;
	cwd: string;
	model: string | null;
	startedAt: number;
}

export interface RpcHostEntry extends RpcHostSnapshot {
	version: number;
	instanceId: string;
	pid: number;
	endpoint: string;
	token: string;
	createdAt: number;
}

export interface RpcRegistryOptions {
	/** Override the default registry directory. */
	dir?: string;
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
	if (o.model !== null && typeof o.model !== "string") return null;
	return {
		version: o.version as number,
		instanceId: o.instanceId as string,
		pid: o.pid as number,
		endpoint: o.endpoint as string,
		token: o.token as string,
		createdAt: o.createdAt as number,
		sessionId: o.sessionId as string | null,
		sessionName: o.sessionName as string | null,
		cwd: o.cwd as string,
		model: o.model as string | null,
		startedAt: o.startedAt as number,
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
