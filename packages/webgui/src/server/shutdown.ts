import * as net from "node:net";
import { readLiveRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { DaemonOptions } from "./options";

interface RpcFrame {
	type: string;
	id?: string;
	error?: string;
	command?: string;
	success?: boolean;
	data?: unknown;
}

/**
 * One authenticated connection to a live omp instance. Error frames and
 * failed responses reject the pending request (or `ready` before auth).
 */
class RpcHostConnection {
	readonly ready: Promise<void>;
	readonly closed: Promise<void>;
	#socket: net.Socket;
	#buffer = "";
	#nextId = 0;
	#pending = new Map<string, { resolve: (f: RpcFrame) => void; reject: (e: Error) => void }>();
	#readyResolvers = Promise.withResolvers<void>();
	#closedResolvers = Promise.withResolvers<void>();
	#failure: Error | undefined;
	#isClosed = false;

	constructor(target: { endpoint: string; token: string }) {
		this.ready = this.#readyResolvers.promise;
		this.closed = this.#closedResolvers.promise;
		// Callers may never await ready/closed (e.g. after failure); avoid unhandled rejections.
		this.ready.catch(() => {});
		this.#socket = net.connect(target.endpoint);
		this.#socket.on("connect", () => {
			this.#socket.write(JSON.stringify({ type: "auth", token: target.token }) + "\n");
		});
		this.#socket.on("data", (chunk: Buffer) => {
			this.#buffer += chunk.toString();
			let newlineIdx: number;
			while ((newlineIdx = this.#buffer.indexOf("\n")) !== -1) {
				const line = this.#buffer.slice(0, newlineIdx);
				this.#buffer = this.#buffer.slice(newlineIdx + 1);
				this.#handleLine(line);
			}
		});
		this.#socket.on("close", () => {
			this.#isClosed = true;
			const err = this.#failure ?? new Error("connection closed");
			this.#readyResolvers.reject(err);
			for (const p of this.#pending.values()) p.reject(err);
			this.#pending.clear();
			this.#closedResolvers.resolve();
		});
		this.#socket.on("error", (err: Error) => {
			this.#fail(err);
		});
	}

	get isClosed(): boolean {
		return this.#isClosed;
	}

	/** First fatal error seen (error frame or socket error), if any. */
	get failure(): Error | undefined {
		return this.#failure;
	}

	send(command: Record<string, unknown>): void {
		this.#socket.write(JSON.stringify(command) + "\n");
	}

	request(command: { type: string } & Record<string, unknown>): Promise<RpcFrame> {
		const id = `webgui-${++this.#nextId}`;
		const { promise, resolve, reject } = Promise.withResolvers<RpcFrame>();
		if (this.#isClosed) {
			reject(this.#failure ?? new Error("connection closed"));
			return promise;
		}
		this.#pending.set(id, { resolve, reject });
		this.send({ ...command, id });
		return promise;
	}

	destroy(): void {
		this.#socket.destroy();
	}

	#fail(err: Error): void {
		this.#failure ??= err;
		this.#readyResolvers.reject(err);
		for (const p of this.#pending.values()) p.reject(err);
		this.#pending.clear();
		this.#socket.destroy();
	}

	#handleLine(line: string): void {
		let frame: RpcFrame;
		try {
			frame = JSON.parse(line);
		} catch {
			return;
		}
		if (frame.type === "error") {
			this.#fail(new Error(frame.error ?? "unknown error"));
			return;
		}
		if (frame.type === "ready") {
			this.#readyResolvers.resolve();
			return;
		}
		if (frame.type !== "response") return;
		if (frame.command === "shutdown" && frame.success === false) {
			this.#fail(new Error(frame.error ?? "shutdown failed"));
			return;
		}
		const pending = frame.id ? this.#pending.get(frame.id) : undefined;
		if (!pending) return;
		this.#pending.delete(frame.id!);
		if (frame.success === false) pending.reject(new Error(frame.error ?? `${frame.command} failed`));
		else pending.resolve(frame);
	}
}

async function waitForClose(conn: RpcHostConnection, timeoutMs: number): Promise<void> {
	// Timeout is not an error: omp may take a moment to tear down.
	const timer = Bun.sleep(timeoutMs);
	await Promise.race([conn.closed, timer]);
	if (!conn.isClosed) conn.destroy();
	if (conn.failure) throw conn.failure;
}

/**
 * Connect to a live omp instance over its Unix socket, authenticate,
 * send the shutdown command, and wait for the socket to close.
 *
 * Timeout is not an error: omp may take a moment to tear down.
 * If the server responds with an error frame, the returned promise rejects.
 */
export async function shutdownLiveSession(
	target: { endpoint: string; token: string },
	timeoutMs = 5_000,
): Promise<void> {
	const conn = new RpcHostConnection(target);
	const deadline = Date.now() + timeoutMs;
	const authed = await Promise.race([
		conn.ready.then(
			() => true,
			() => false,
		),
		Bun.sleep(timeoutMs).then(() => false),
	]);
	if (!authed) {
		conn.destroy();
		if (conn.failure) throw conn.failure;
		return;
	}
	conn.send({ type: "shutdown" });
	await waitForClose(conn, Math.max(0, deadline - Date.now()));
}

const IDLE_POLL_MS = 200;

/**
 * Single deadline timer that callers race against. `arm` replaces the pending
 * timer (at most one is alive); `clear` must run on every exit path.
 */
class Deadline {
	#timer: Timer | undefined;
	#expired = Promise.withResolvers<null>();
	#at = 0;

	arm(ms: number): void {
		this.clear();
		this.#expired = Promise.withResolvers<null>();
		this.#at = Date.now() + ms;
		const { resolve } = this.#expired;
		this.#timer = setTimeout(() => resolve(null), ms);
	}

	remaining(): number {
		return Math.max(0, this.#at - Date.now());
	}

	/** Resolves `{ v }` if `p` settles first, `null` if the deadline fires first. */
	race<T>(p: Promise<T>): Promise<{ v: T } | null> {
		return Promise.race([p.then(v => ({ v })), this.#expired.promise]);
	}

	clear(): void {
		clearTimeout(this.#timer);
	}
}

/**
 * Abort the running turn, wait until the session reports idle (or `idleTimeoutMs`
 * elapses), then shut it down and wait up to `closeTimeoutMs` for the socket to close.
 *
 * The host processes `abort`, `get_state`, and `shutdown` serially on one queue,
 * so a turn that ignores abort also delays the queued `shutdown`. The client
 * deadlines only bound this client's wait: `{ timedOut: true }` means the host
 * did not close in time and the caller must escalate (e.g. SIGTERM).
 *
 * Resolves `{ timedOut: false }` when the host closed the connection without a
 * transport failure (after our shutdown or on its own). Rejects on auth
 * rejection, socket errors, and protocol errors.
 */
export async function stopLiveSession(
	target: { endpoint: string; token: string },
	opts: { idleTimeoutMs?: number; closeTimeoutMs?: number } = {},
): Promise<{ timedOut: boolean }> {
	const idleTimeoutMs = opts.idleTimeoutMs ?? 10_000;
	const closeTimeoutMs = opts.closeTimeoutMs ?? 5_000;
	if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) {
		throw new RangeError(`idleTimeoutMs must be a finite number > 0, got ${idleTimeoutMs}`);
	}
	const conn = new RpcHostConnection(target);
	const deadline = new Deadline();
	const cleanlyClosed = () => conn.isClosed && !conn.failure;
	try {
		deadline.arm(idleTimeoutMs);
		let idleExpired = !(await deadline.race(conn.ready));
		if (!idleExpired) {
			const abortPromise = conn.request({ type: "abort" });
			abortPromise.catch(() => {});
			idleExpired = !(await deadline.race(abortPromise));
		}
		while (!idleExpired && deadline.remaining() > 0) {
			const statePromise = conn.request({ type: "get_state" });
			statePromise.catch(() => {});
			const res = await deadline.race(statePromise);
			if (!res) break;
			const data = res.v.data as { isStreaming?: boolean } | undefined;
			if (!data?.isStreaming) break;
			await deadline.race(new Promise<void>(r => setTimeout(r, Math.min(IDLE_POLL_MS, deadline.remaining()))));
		}
		if (conn.failure) throw conn.failure;
		if (cleanlyClosed()) return { timedOut: false };
		// If the idle phase expired this queues behind the hung abort; sent anyway
		// so the host still shuts down if the abort ever returns.
		conn.send({ type: "shutdown" });
		deadline.arm(closeTimeoutMs);
		const closed = await deadline.race(conn.closed);
		if (conn.failure) throw conn.failure;
		return { timedOut: !closed };
	} catch (err) {
		if (cleanlyClosed()) return { timedOut: false };
		throw conn.failure ?? err;
	} finally {
		deadline.clear();
		conn.destroy();
	}
}

/**
 * POST /api/live/:instanceId/shutdown
 *
 * Looks up the instance in the registry, connects, sends shutdown, returns 204.
 * Returns null when the URL does not match.
 */
export async function handleShutdownRequest(
	req: Request,
	url: URL,
	opts: DaemonOptions = {},
): Promise<Response | null> {
	if (req.method !== "POST") return null;

	const match = url.pathname.match(/^\/api\/live\/([^/]+)\/shutdown$/);
	if (!match) return null;

	const instanceId = match[1];
	const entry = await readLiveRpcHost(instanceId, { dir: opts.registryDir });
	if (!entry) {
		return new Response("not found", { status: 404 });
	}

	try {
		await shutdownLiveSession({ endpoint: entry.endpoint, token: entry.token });
		return new Response(null, { status: 204 });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return new Response(message, { status: 500 });
	}
}
