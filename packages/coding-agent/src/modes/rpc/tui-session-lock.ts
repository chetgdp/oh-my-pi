/**
 * The interactive TUI's ownership of the per-session lock. Whether or not
 * `rpc.serve` publishes a socket, the TUI holds the lock of the session it shows,
 * marks it with the `tui` holder sidecar, and moves both on every session change.
 * Opening a session a headless host holds takes it over: wait for the host's turn
 * to settle, ask it to shut down, then take the lock. Another TUI is never displaced.
 */
import { CancellableLoader } from "@oh-my-pi/pi-tui";
import { theme } from "@oh-my-pi/pi-tui/theme";
import { logger } from "@oh-my-pi/pi-utils";
import type { SessionSwitchGuard } from "../../session/agent-session";
import { readSessionHeaderId } from "../../session/session-loader";
import type { SessionManager } from "../../session/session-manager";
import type { InteractiveModeContext } from "../types";
import { type Frame, HostSocket } from "./rpc-client-socket";
import {
	acquireSessionLock,
	findLiveSessionHost,
	isSessionLockHeld,
	readSessionLockHolder,
	releaseSessionLock,
	removeSessionLockHolder,
	type RpcHostEntry,
	type RpcRegistryOptions,
	writeSessionLockHolder,
} from "./rpc-registry";

const POLL_MS = 100;
const REGISTRY_RECHECK_MS = 1_000;
const SHUTDOWN_RESPONSE_TIMEOUT_MS = 5_000;
/** How long a host gets to flush and exit after `shutdown`, or an unregistered holder to let go. */
export const DEFAULT_TAKEOVER_LOCK_TIMEOUT_MS = 30_000;

/** Another TUI holds the lock: this TUI opens the session without it, and upstream's session manager moves its writes to a copy and says so. */
export const TUI_HOLDER_SHARED = "session is open in another omp TUI";

export type TakeoverPhase =
	| { kind: "waiting-turn"; host: string }
	| { kind: "stopping"; host: string }
	| { kind: "waiting-lock" };

export type TakeoverResult = { ok: true } | { ok: false; reason: "cancelled" | "tui" | "timeout"; message: string };

export interface TakeoverOptions {
	registry?: RpcRegistryOptions;
	/** Aborting stops waiting; it never aborts the host's turn. */
	signal?: AbortSignal;
	onPhase?: (phase: TakeoverPhase) => void;
	lockTimeoutMs?: number;
}

function hostLabel(entry: RpcHostEntry): string {
	return entry.sessionName ? `"${entry.sessionName}" (pid ${entry.pid})` : `${entry.instanceId} (pid ${entry.pid})`;
}

/** Resolves on `promise`, or "aborted"/"timeout" first. */
async function raceSignal<T>(
	promise: Promise<T>,
	signal: AbortSignal | undefined,
	timeoutMs?: number,
): Promise<T | "aborted" | "timeout"> {
	if (signal?.aborted) return "aborted";
	const { promise: interrupted, resolve } = Promise.withResolvers<"aborted" | "timeout">();
	const onAbort = () => resolve("aborted");
	signal?.addEventListener("abort", onAbort, { once: true });
	const timer = timeoutMs === undefined ? undefined : setTimeout(() => resolve("timeout"), timeoutMs);
	try {
		return await Promise.race([promise, interrupted]);
	} finally {
		signal?.removeEventListener("abort", onAbort);
		clearTimeout(timer);
	}
}

let requestSeq = 0;

async function request(socket: HostSocket, command: Record<string, unknown>, signal?: AbortSignal) {
	const id = `tui-takeover-${++requestSeq}`;
	socket.send({ ...command, id });
	return raceSignal(socket.response(id), signal);
}

function isSettledState(response: Frame | null): boolean | undefined {
	if (!response || response.success !== true) return undefined;
	const data = response.data as Record<string, unknown> | undefined;
	if (!data) return undefined;
	// Hosts predating `isSettled` report only whether a turn streams.
	return typeof data.isSettled === "boolean" ? data.isSettled : data.isStreaming !== true;
}

/**
 * Wait until the host has no turn running or queued. Returns "closed" when the host
 * went away on its own, which the caller treats like a finished shutdown.
 */
async function waitHostSettled(
	socket: HostSocket,
	signal: AbortSignal | undefined,
	onBusy: () => void,
): Promise<"settled" | "closed" | "aborted"> {
	let busyReported = false;
	for (;;) {
		const state = await request(socket, { type: "get_state", light: true }, signal);
		if (state === "aborted") return "aborted";
		if (state === "timeout" || state === null) return "closed";
		if (isSettledState(state) !== false) return "settled";
		if (!busyReported) {
			busyReported = true;
			onBusy();
		}
		// Read events until the host announces it settled (or ends a turn), then re-check.
		for (;;) {
			const frame = await raceSignal(socket.next(), signal);
			if (frame === "aborted") return "aborted";
			if (frame === "timeout" || frame === null) return "closed";
			if (frame.type === "session_settled" || frame.type === "agent_end") break;
		}
	}
}

/** Poll until the lock frees. "host" means a registered host appeared meanwhile. */
async function waitLockFree(
	sessionId: string,
	options: TakeoverOptions,
	deadline: number,
	watchRegistry: boolean,
): Promise<"free" | "timeout" | "aborted" | "host"> {
	let nextRegistryCheck = Date.now() + REGISTRY_RECHECK_MS;
	for (;;) {
		if (options.signal?.aborted) return "aborted";
		if (!isSessionLockHeld(sessionId, options.registry)) return "free";
		if (Date.now() >= deadline) return "timeout";
		if (watchRegistry && Date.now() >= nextRegistryCheck) {
			nextRegistryCheck = Date.now() + REGISTRY_RECHECK_MS;
			if (await findLiveSessionHost(sessionId, options.registry)) return "host";
		}
		if ((await raceSignal(Bun.sleep(POLL_MS), options.signal)) === "aborted") return "aborted";
	}
}

/** Ask a registered host to finish its turn and exit. Returns once it has been told to shut down. */
async function stopHost(entry: RpcHostEntry, options: TakeoverOptions): Promise<"stopped" | "aborted"> {
	const host = hostLabel(entry);
	const opened = await HostSocket.open(entry.endpoint, {
		type: "auth",
		token: entry.token,
		surface: "unknown",
		clientId: `tui-takeover-${process.pid}`,
	});
	// A host that refuses or vanished is handled by waiting on its lock.
	if (!opened.ok) {
		logger.warn("Session takeover: could not connect to host", { instanceId: entry.instanceId, error: opened.error });
		return "stopped";
	}
	const socket = opened.socket;
	try {
		const settled = await waitHostSettled(socket, options.signal, () =>
			options.onPhase?.({ kind: "waiting-turn", host }),
		);
		if (settled === "aborted") return "aborted";
		if (settled === "closed") return "stopped";
		if (options.signal?.aborted) return "aborted";
		options.onPhase?.({ kind: "stopping", host });
		const id = `tui-takeover-${++requestSeq}`;
		socket.send({ id, type: "shutdown" });
		// The host may close the connection without answering; its lock is what counts.
		await raceSignal(socket.response(id), undefined, SHUTDOWN_RESPONSE_TIMEOUT_MS);
		return "stopped";
	} finally {
		socket.close();
	}
}

/**
 * Take the session lock for this process, displacing a headless host that holds it.
 * On success the caller owns the lock (and writes the holder sidecar).
 */
export async function takeOverSessionLock(sessionId: string, options: TakeoverOptions = {}): Promise<TakeoverResult> {
	const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_TAKEOVER_LOCK_TIMEOUT_MS;
	const cancelled: TakeoverResult = { ok: false, reason: "cancelled", message: "stopped waiting for the session" };
	for (;;) {
		if (options.signal?.aborted) return cancelled;
		if (acquireSessionLock(sessionId, options.registry)) return { ok: true };
		const holder = readSessionLockHolder(sessionId, options.registry);
		if (holder === undefined) {
			// Freed between our attempt and the read; retry after a beat rather than spin.
			await Bun.sleep(POLL_MS);
			continue;
		}
		if (holder === "tui") return { ok: false, reason: "tui", message: TUI_HOLDER_SHARED };

		const entry = await findLiveSessionHost(sessionId, options.registry);
		if (entry) {
			if ((await stopHost(entry, options)) === "aborted") return cancelled;
			const freed = await waitLockFree(sessionId, options, Date.now() + lockTimeoutMs, false);
			if (freed === "aborted") return cancelled;
			if (freed === "timeout") {
				return {
					ok: false,
					reason: "timeout",
					message: `omp host ${hostLabel(entry)} did not exit within ${Math.round(lockTimeoutMs / 1000)}s`,
				};
			}
			continue;
		}

		// Holder without a live registry entry: a host starting up or shutting down.
		options.onPhase?.({ kind: "waiting-lock" });
		const freed = await waitLockFree(sessionId, options, Date.now() + lockTimeoutMs, true);
		if (freed === "aborted") return cancelled;
		if (freed === "timeout") {
			return {
				ok: false,
				reason: "timeout",
				message: `another process held the session and did not release it within ${Math.round(lockTimeoutMs / 1000)}s`,
			};
		}
	}
}

/** Owner of the TUI's session lock and its `tui` holder sidecar. */
export class TuiSessionLock {
	#registry: RpcRegistryOptions | undefined;
	#sessionId: string | undefined;
	/** Lock taken for a switch target before the switch commits. */
	#pending: string | undefined;

	constructor(registry?: RpcRegistryOptions) {
		this.#registry = registry;
	}

	get sessionId(): string | undefined {
		return this.#sessionId;
	}

	get registry(): RpcRegistryOptions | undefined {
		return this.#registry;
	}

	/** Take `sessionId`'s lock without waiting, marking it as TUI-held. False if another live process holds it. */
	tryAcquire(sessionId: string): boolean {
		if (sessionId === this.#sessionId || sessionId === this.#pending) return true;
		if (!acquireSessionLock(sessionId, this.#registry)) return false;
		this.#markHeld(sessionId);
		return true;
	}

	/** Like {@link tryAcquire}, displacing a headless host holder (see {@link takeOverSessionLock}). */
	async acquire(sessionId: string, options: Omit<TakeoverOptions, "registry"> = {}): Promise<TakeoverResult> {
		if (sessionId === this.#sessionId || sessionId === this.#pending) return { ok: true };
		const result = await takeOverSessionLock(sessionId, { ...options, registry: this.#registry });
		if (result.ok) this.#markHeld(sessionId);
		return result;
	}

	/** Make `sessionId` (already locked by {@link tryAcquire}/{@link acquire}) the current one, releasing the previous. */
	adopt(sessionId: string): void {
		if (sessionId === this.#sessionId) return;
		const previous = this.#sessionId;
		this.#sessionId = sessionId;
		if (this.#pending === sessionId) this.#pending = undefined;
		if (previous) this.#drop(previous);
	}

	/** Lock taken for a switch that did not commit. */
	dropPending(): void {
		const pending = this.#pending;
		this.#pending = undefined;
		if (pending && pending !== this.#sessionId) this.#drop(pending);
	}

	/** Track an acquired-but-not-adopted lock so a cancelled switch can release it. */
	setPending(sessionId: string): void {
		if (sessionId !== this.#sessionId) this.#pending = sessionId;
	}

	/**
	 * Move the lock to `sessionId` (a fresh session from new/fork/branch, or one already locked as pending).
	 * When another process holds `sessionId`, the lock on the session this TUI left is released anyway,
	 * since this TUI no longer writes it.
	 */
	follow(sessionId: string): boolean {
		if (sessionId === this.#sessionId) return true;
		if (sessionId !== this.#pending && !this.tryAcquire(sessionId)) {
			const previous = this.#sessionId;
			this.#sessionId = undefined;
			if (previous) this.#drop(previous);
			return false;
		}
		this.adopt(sessionId);
		return true;
	}

	release(): void {
		this.dropPending();
		const current = this.#sessionId;
		this.#sessionId = undefined;
		if (current) this.#drop(current);
	}

	#markHeld(sessionId: string): void {
		try {
			writeSessionLockHolder(sessionId, this.#registry);
		} catch (error) {
			logger.warn("Failed to write session lock holder marker", { sessionId, error: String(error) });
		}
	}

	#drop(sessionId: string): void {
		try {
			removeSessionLockHolder(sessionId, this.#registry);
		} catch (error) {
			logger.warn("Failed to remove session lock holder marker", { sessionId, error: String(error) });
		}
		releaseSessionLock(sessionId, this.#registry);
	}
}

/** The interactive process's single lock owner. */
export const tuiSessionLock = new TuiSessionLock();

function phaseMessage(phase: TakeoverPhase): string {
	switch (phase.kind) {
		case "waiting-turn":
			return `Waiting for omp host ${phase.host} to finish its turn…`;
		case "stopping":
			return `Stopping omp host ${phase.host}…`;
		case "waiting-lock":
			return "Waiting for another process to release the session…";
	}
}

/** Outcome of {@link claimStartupSession}; `cancelled` is the user's choice, not an error. */
export type StartupClaim =
	| { kind: "open" }
	| { kind: "cancelled"; message: string }
	| { kind: "refused"; message: string };

/**
 * Startup claim, before the TUI exists and before the session is built: progress goes
 * to stderr and Esc (or Ctrl+C) gives up. `sessionManager` has already parsed the file
 * to learn the session id; after a takeover it is re-read, because the previous holder
 * kept appending (its turn's reply, its exit marker) while we waited.
 */
export async function claimStartupSession(
	sessionManager: SessionManager,
	lock = tuiSessionLock,
): Promise<StartupClaim> {
	const sessionId = sessionManager.getSessionId();
	if (lock.tryAcquire(sessionId)) {
		lock.adopt(sessionId);
		return { kind: "open" };
	}
	const controller = new AbortController();
	const stdin = process.stdin;
	const canListen = stdin.isTTY === true;
	const wasRaw = canListen ? stdin.isRaw : false;
	const onData = (data: Buffer | string) => {
		const text = typeof data === "string" ? data : data.toString("utf8");
		if (text === "\x1b" || text.includes("\x03")) controller.abort();
	};
	let shown = false;
	const show = (message: string) => {
		shown = true;
		process.stderr.write(`\r\x1b[2K${message} (Esc to cancel)`);
	};
	if (canListen) {
		stdin.setRawMode(true);
		stdin.on("data", onData);
		stdin.resume();
	}
	let result: TakeoverResult;
	try {
		result = await lock.acquire(sessionId, {
			signal: controller.signal,
			onPhase: phase => show(phaseMessage(phase)),
		});
	} finally {
		if (canListen) {
			stdin.off("data", onData);
			stdin.setRawMode(wasRaw);
			stdin.pause();
		}
		if (shown) process.stderr.write("\r\x1b[2K");
	}
	if (result.ok) {
		lock.adopt(sessionId);
		const file = sessionManager.getSessionFile();
		if (file) await sessionManager.setSessionFile(file);
		return { kind: "open" };
	}
	if (result.reason === "cancelled") {
		return {
			kind: "cancelled",
			message: "Cancelled: the session is still held by its omp host (its turn was not interrupted).",
		};
	}
	if (result.reason === "tui") return { kind: "open" };
	return { kind: "refused", message: result.message };
}

/**
 * Wire the lock into interactive mode: follow every session change, and route
 * `switchSession` through a takeover with a cancellable waiting indicator.
 * Returns the detach function; the lock itself is released by {@link TuiSessionLock.release}.
 */
export function attachTuiSessionLock(ctx: InteractiveModeContext, lock = tuiSessionLock): () => void {
	const current = ctx.sessionManager.getSessionId();
	// Without the lock (another TUI holds it) upstream's session manager moves this TUI's writes to a copy and warns.
	if (current && !lock.follow(current)) {
		logger.warn("Session is held by another omp process; opening without the lock", { sessionId: current });
	}
	const unsubscribe = ctx.session.registerSessionChangeCallback(() => {
		const next = ctx.sessionManager.getSessionId();
		if (!next || lock.follow(next)) return;
		logger.warn("Session changed to one another process holds", { sessionId: next });
	});
	const guard: SessionSwitchGuard = {
		before: async target => {
			const targetId = await readSessionHeaderId(target);
			if (!targetId || targetId === lock.sessionId) return true;
			if (lock.tryAcquire(targetId)) {
				lock.setPending(targetId);
				return true;
			}
			const result = await acquireWithLoader(ctx, lock, targetId);
			if (result.ok) {
				lock.setPending(targetId);
				return true;
			}
			// Another TUI: open it anyway, as upstream does; `after` releases the lock on the session left behind.
			if (result.reason === "tui") return true;
			// Cancel returns to the caller (the /resume picker stays open for another choice);
			// a timeout throws so the picker's existing error path closes it and shows why.
			if (result.reason === "cancelled") {
				ctx.showStatus("Switch cancelled; staying in the current session (the host's turn was not interrupted).");
				return false;
			}
			throw new Error(`Cannot open session: ${result.message}`);
		},
		after: switched => {
			if (switched) {
				const next = ctx.sessionManager.getSessionId();
				if (next) lock.follow(next);
			}
			lock.dropPending();
		},
	};
	ctx.session.setSessionSwitchGuard(guard);
	return () => {
		unsubscribe();
		ctx.session.setSessionSwitchGuard(undefined);
	};
}

async function acquireWithLoader(
	ctx: InteractiveModeContext,
	lock: TuiSessionLock,
	sessionId: string,
): Promise<TakeoverResult> {
	const loader = new CancellableLoader(
		ctx.ui,
		s => theme.fg("accent", s),
		s => theme.fg("muted", s),
		"Checking who holds the session… (Esc to stay here)",
	);
	// A picker (the fullscreen /resume selector) may still be up while the switch runs;
	// the loader goes above it so it stays visible and its Esc reaches the loader.
	const overlay = ctx.ui.hasOverlay() ? ctx.ui.showOverlay(loader, { anchor: "center", width: "90%" }) : undefined;
	if (!overlay) {
		ctx.editorContainer.clear();
		ctx.editorContainer.addChild(loader);
		ctx.ui.setFocus(loader);
	}
	ctx.ui.requestRender();
	try {
		return await lock.acquire(sessionId, {
			signal: loader.signal,
			onPhase: phase => {
				loader.setMessage(`${phaseMessage(phase)} (Esc to stay here)`);
				ctx.ui.requestRender();
			},
		});
	} finally {
		loader.dispose();
		if (overlay) {
			overlay.hide();
		} else {
			ctx.editorContainer.clear();
			ctx.editorContainer.addChild(ctx.editor);
			ctx.ui.setFocus(ctx.editor);
		}
		ctx.ui.requestRender();
	}
}
