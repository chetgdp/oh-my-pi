/**
 * Headless session host (`omp host run`): one AgentSession served only over the
 * registry socket. Socket clients get the rights the TUI has beside a served
 * session: extension UI, goal ownership, and shutdown.
 */
import { isRecord, logger, Snowflake } from "@oh-my-pi/pi-utils";
import * as postmortem from "@oh-my-pi/pi-utils/postmortem";
import type { ExtensionUIContext } from "../../extensibility/extensions/types";
import type { AgentSession } from "../../session/agent-session";
import type { EventBus } from "../../utils/event-bus";
import { initializeExtensions } from "../runtime-init";
import { acquireSessionLock, type RpcHostSnapshot, type RpcRegistryOptions, releaseSessionLock } from "./rpc-registry";
import { type PendingExtensionRequest, RpcExtensionUIContext, serveRpc } from "./rpc-server";
import { isRpcSessionSettled } from "./rpc-session-settle";
import { type RpcSocketConnectionRights, type RpcSocketServer, startRpcSocketServer } from "./rpc-socket";
import { cfgRpcHostIdleTimeoutMs } from "./settings";

export interface RpcHostOptions {
	registryDir?: string;
	/** First user prompt, sent once the socket is published. */
	prompt?: string;
	setToolUIContext?: (uiContext: ExtensionUIContext, hasUI: boolean) => void;
	subagentEventBus?: EventBus;
}

type FrameSink = (frame: object) => void;

/**
 * Extension UI requests owned by the host process. Every connected client sees
 * each request; the first answer resolves it and the rest are told to close it.
 * Requests stay outstanding while no client is connected and are replayed to
 * each client that connects.
 */
class RpcHostExtensionRequests extends Map<string, PendingExtensionRequest> {
	readonly #clients = new Set<FrameSink>();
	readonly #outstanding = new Map<string, object>();

	get clientCount(): number {
		return this.#clients.size;
	}

	readonly broadcast: FrameSink = frame => {
		if (isRecord(frame) && frame.type === "extension_ui_request") {
			if (typeof frame.id === "string" && super.has(frame.id)) this.#outstanding.set(frame.id, frame);
			if (frame.method === "cancel" && typeof frame.targetId === "string") this.#outstanding.delete(frame.targetId);
		}
		for (const send of this.#clients) send(frame);
	};

	override delete(id: string): boolean {
		if (this.#outstanding.delete(id)) {
			this.broadcast({
				type: "extension_ui_request",
				id: Snowflake.next() as string,
				method: "cancel",
				targetId: id,
			});
		}
		return super.delete(id);
	}

	attach(send: FrameSink): void {
		this.#clients.add(send);
		for (const frame of this.#outstanding.values()) send(frame);
	}

	detach(send: FrameSink): void {
		this.#clients.delete(send);
	}
}

/**
 * Serve `session` as a headless host until RPC `shutdown`, SIGTERM, or the idle
 * timeout. The caller already holds the session lock for the startup session.
 */
export async function runRpcHost(session: AgentSession, options: RpcHostOptions): Promise<never> {
	// Terminal notifications would write BEL/OSC to a stdout nobody reads.
	process.env.PI_NOTIFICATIONS = "off";
	const registry: RpcRegistryOptions = { dir: options.registryDir };
	const startedAt = Date.now();

	let lockedSessionId: string | undefined = session.sessionManager.getSessionId();
	if (!acquireSessionLock(lockedSessionId, registry)) {
		throw new Error(`Session ${lockedSessionId} is already hosted by another process`);
	}
	const releaseLockOnExit = (): void => {
		if (lockedSessionId) releaseSessionLock(lockedSessionId, registry);
	};
	process.once("exit", releaseLockOnExit);

	const requests = new RpcHostExtensionRequests();
	const uiContext = new RpcExtensionUIContext(requests, requests.broadcast);
	options.setToolUIContext?.(uiContext, true);

	// Bound after startup; teardown may run before (signal during extension init).
	const live: { server?: RpcSocketServer; idleTimer?: NodeJS.Timeout } = {};
	let shuttingDown: Promise<void> | undefined;
	const unsubscribers: Array<() => void> = [];

	const teardown = async (): Promise<void> => {
		clearInterval(live.idleTimer);
		for (const unsubscribe of unsubscribers) unsubscribe();
		requests.broadcast({ type: "notice", level: "info", message: "Session host is shutting down", source: "host" });
		try {
			await live.server?.stop();
		} catch (error) {
			logger.warn("Failed to stop RPC host socket", { error: String(error) });
		}
		try {
			await session.dispose();
		} finally {
			releaseLockOnExit();
			process.off("exit", releaseLockOnExit);
		}
	};
	const shutdown = (): Promise<void> => {
		shuttingDown ??= teardown();
		return shuttingDown;
	};
	const shutdownAndExit = async (): Promise<never> => {
		let code = 0;
		try {
			await shutdown();
		} catch (error) {
			logger.error("RPC host shutdown failed", { error: String(error) });
			code = 1;
		}
		process.exit(code);
	};
	// Signals run postmortem cleanup, which awaits this before exiting.
	unsubscribers.push(postmortem.register("rpc-host", () => shutdown()));

	await initializeExtensions(session, {
		mode: "rpc",
		uiContext,
		onShutdown: () => void shutdownAndExit(),
		reportSendError: (action, error) => {
			logger.warn("Extension send failed", { action, error: error.message });
		},
		reportRuntimeError: error => {
			logger.warn("Extension runtime error", {
				extensionPath: error.extensionPath,
				event: error.event,
				error: error.error,
			});
			requests.broadcast({
				type: "extension_error",
				extensionPath: error.extensionPath,
				event: error.event,
				error: error.error,
			});
		},
	});

	const snapshot = (): RpcHostSnapshot => ({
		sessionId: session.sessionManager.getSessionId(),
		sessionName: session.sessionManager.getSessionName() ?? null,
		sessionFile: session.sessionManager.getSessionFile() ?? null,
		cwd: session.sessionManager.getCwd(),
		model: session.model?.id ?? null,
		startedAt,
	});

	// Goal lifecycle has one owner at a time; a second controller would double-schedule continuations.
	let goalOwner: object | undefined;
	let lastBusyAt = Date.now();
	const openConnection = (): RpcSocketConnectionRights => {
		const token = {};
		const ownsSession = goalOwner === undefined;
		if (ownsSession) goalOwner = token;
		let sink: FrameSink | undefined;
		return {
			ownsSession,
			sharedExtensionRequests: requests,
			ready: output => {
				sink = output;
				requests.attach(output);
			},
			closed: () => {
				if (sink) requests.detach(sink);
				if (goalOwner === token) goalOwner = undefined;
				lastBusyAt = Date.now();
			},
		};
	};

	live.server = await startRpcSocketServer(session, {
		snapshot: snapshot(),
		subagentEventBus: options.subagentEventBus,
		onShutdown: () => shutdownAndExit(),
		registryDir: options.registryDir,
		serve: serveRpc,
		kind: "host",
		openConnection,
	});

	const updateRegistry = (): void => {
		try {
			live.server?.update(snapshot());
		} catch (error) {
			logger.warn("Failed to update RPC host registry entry", { error: String(error) });
		}
	};
	unsubscribers.push(
		session.registerSessionChangeCallback(() => {
			const next = session.sessionManager.getSessionId();
			if (next !== lockedSessionId) {
				if (acquireSessionLock(next, registry)) {
					if (lockedSessionId) releaseSessionLock(lockedSessionId, registry);
					lockedSessionId = next;
				} else {
					logger.warn("Switched to a session another host holds; keeping the previous lock", {
						sessionId: next,
					});
				}
			}
			updateRegistry();
		}),
	);
	unsubscribers.push(session.sessionManager.onSessionNameChanged(updateRegistry));
	unsubscribers.push(
		session.subscribe(event => {
			if (event.type === "model_changed") updateRegistry();
		}),
	);

	const idleTimeoutMs = cfgRpcHostIdleTimeoutMs.get(session.settings);
	live.idleTimer = setInterval(
		() => {
			const busy =
				requests.clientCount > 0 ||
				goalOwner !== undefined ||
				!isRpcSessionSettled(session) ||
				session.isCompacting ||
				session.isRetrying;
			const now = Date.now();
			if (busy) {
				lastBusyAt = now;
				return;
			}
			if (now - lastBusyAt < idleTimeoutMs) return;
			logger.debug("RPC host idle timeout reached", { idleTimeoutMs });
			void shutdownAndExit();
		},
		Math.max(50, Math.min(5_000, Math.floor(idleTimeoutMs / 10))),
	);

	if (options.prompt) {
		session.prompt(options.prompt).catch(error => {
			logger.error("RPC host initial prompt failed", { error: String(error) });
		});
	}

	// Lifetime is driven by shutdownAndExit; this never resolves.
	return new Promise<never>(() => {});
}
