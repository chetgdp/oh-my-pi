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
import { readSessionHeaderId } from "../../session/session-loader";
import { initializeExtensions } from "../runtime-init";
import {
	acquireSessionLock,
	findLiveSessionHost,
	type RpcHostSnapshot,
	type RpcRegistryOptions,
	releaseSessionLock,
} from "./rpc-registry";
import { type PendingExtensionRequest, RpcExtensionUIContext, type RpcSessionGuard, serveRpc } from "./rpc-server";
import { RpcGoalController } from "./rpc-goal";
import { getRpcPlanCoordinator } from "./rpc-plan";
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

	get outstandingCount(): number {
		return this.#outstanding.size;
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
		process.stderr.write(`Session ${lockedSessionId} is already hosted by another process\n`);
		process.exit(75);
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

	const planCoordinator = getRpcPlanCoordinator(session);
	await planCoordinator.restoreFromSession();

	const snapshot = (): RpcHostSnapshot => ({
		sessionId: session.sessionManager.getSessionId(),
		sessionName: session.sessionManager.getSessionName() ?? null,
		sessionFile: session.sessionManager.getSessionFile() ?? null,
		cwd: session.sessionManager.getCwd(),
		model: session.model?.id ?? null,
		startedAt,
	});

	const goalController = new RpcGoalController(session, undefined, {
		ownsSession: true,
		continuationAlways: true,
	});
	unsubscribers.push(session.subscribe(event => goalController.observe(event)));

	let lastBusyAt = Date.now();
	const sessionGuard: RpcSessionGuard = {
		async claim(targetSessionFile: string) {
			const targetId = await readSessionHeaderId(targetSessionFile);
			if (!targetId) return { ok: false };
			const ownInstanceId = live.server?.instanceId;
			const liveHolder = await findLiveSessionHost(targetSessionFile, registry, {
				excludeInstanceId: ownInstanceId,
			});
			if (liveHolder) {
				return {
					ok: false,
					holder: { instanceId: liveHolder.instanceId, sessionId: liveHolder.sessionId ?? "" },
				};
			}
			const acquired = acquireSessionLock(targetId, registry);
			if (!acquired) {
				// Lock held: brief retry to see if holder publishes to registry/socket
				for (let i = 0; i < 4; i++) {
					await Bun.sleep(50);
					const retryHolder = await findLiveSessionHost(targetSessionFile, registry, {
						excludeInstanceId: ownInstanceId,
					});
					if (retryHolder) {
						return {
							ok: false,
							holder: { instanceId: retryHolder.instanceId, sessionId: retryHolder.sessionId ?? "" },
						};
					}
				}
				return { ok: false };
			}
			return {
				ok: true,
				commit() {
					if (lockedSessionId && lockedSessionId !== targetId) {
						releaseSessionLock(lockedSessionId, registry);
					}
					lockedSessionId = targetId;
				},
				rollback() {
					releaseSessionLock(targetId, registry);
				},
			};
		},
	};

	const openConnection = (): RpcSocketConnectionRights => {
		let sink: FrameSink | undefined;
		return {
			ownsSession: true,
			goalController,
			sharedExtensionRequests: requests,
			sessionGuard,
			ready: output => {
				sink = output;
				requests.attach(output);
			},
			closed: () => {
				if (sink) requests.detach(sink);
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
				lockedSessionId = next;
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
				requests.outstandingCount > 0 ||
				session.getGoalModeState()?.goal.status === "active" ||
				planCoordinator.getPendingReview() !== null ||
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
