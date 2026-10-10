/**
 * Headless session host (`omp host run`): one AgentSession served only over the
 * registry socket. Socket clients get the rights the TUI has beside a served
 * session: extension UI, goal ownership, and shutdown.
 */
import { logger } from "@oh-my-pi/pi-utils";
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
import { RPC_HOST_ALREADY_HOSTED_STDERR_PREFIX } from "./rpc-host-launch";
import { type RpcConnectionIdentity, RpcHostDriver } from "./rpc-host-driver";
import { RpcHostExtensionRequests } from "./rpc-host-requests";
import { RpcExtensionUIContext, type RpcSessionGuard, serveRpc } from "./rpc-server";
import { RpcGoalController } from "./rpc-goal";
import { getRpcPlanCoordinator } from "./rpc-plan";
import {
	type RpcSocketConnectionRights,
	type RpcSocketRefusal,
	type RpcSocketServer,
	startRpcSocketServer,
} from "./rpc-socket";

export interface RpcHostOptions {
	registryDir?: string;
	/** First user prompt, sent once the socket is published. */
	prompt?: string;
	setToolUIContext?: (uiContext: ExtensionUIContext, hasUI: boolean) => void;
	subagentEventBus?: EventBus;
}

/**
 * Serve `session` as a headless host until RPC `shutdown`, extension shutdown,
 * a signal, or a crash. The caller already holds the session lock for the
 * startup session.
 */
export async function runRpcHost(session: AgentSession, options: RpcHostOptions): Promise<never> {
	// Terminal notifications would write BEL/OSC to a stdout nobody reads.
	process.env.PI_NOTIFICATIONS = "off";
	const registry: RpcRegistryOptions = { dir: options.registryDir };
	const startedAt = Date.now();

	let lockedSessionId: string | undefined = session.sessionManager.getSessionId();
	if (!acquireSessionLock(lockedSessionId, registry)) {
		process.stderr.write(`${RPC_HOST_ALREADY_HOSTED_STDERR_PREFIX}${lockedSessionId}\n`);
		process.exit(75);
	}
	const releaseLockOnExit = (): void => {
		if (lockedSessionId) releaseSessionLock(lockedSessionId, registry);
	};
	process.once("exit", releaseLockOnExit);

	const driver = new RpcHostDriver();
	const requests = new RpcHostExtensionRequests(driver);
	const uiContext = new RpcExtensionUIContext(requests, requests.broadcast);
	options.setToolUIContext?.(uiContext, true);

	// Bound after startup; teardown may run before (signal during extension init).
	const live: { server?: RpcSocketServer } = {};
	let shuttingDown: Promise<void> | undefined;
	const unsubscribers: Array<() => void> = [];
	// Every client learns who drives. Registered before dialog rerouting so a
	// client sees `driver_changed` before dialogs that move to it.
	unsubscribers.push(
		driver.onChange((_prev, next) => {
			requests.broadcast({ type: "driver_changed", driver: { surface: next.surface, clientId: next.clientId } });
		}),
	);
	// Shell pane attachment of the current driver, when a shell drives.
	let driverAttachment: string | undefined;
	// Attachments whose pane lost the driver to another client; the pane's next
	// connection is refused once with `attachment_detached`.
	const detachedAttachments = new Set<string>();
	const claimDriver = (identity: RpcConnectionIdentity): void => {
		if (driver.current?.connectionId === identity.connectionId) return;
		if (driverAttachment !== undefined && identity.attachment !== driverAttachment) {
			detachedAttachments.add(driverAttachment);
		}
		driverAttachment = identity.surface === "shell" ? identity.attachment : undefined;
		driver.set(identity);
	};

	// Order: refuse new connections (a resume racing this exit must not get a
	// dying host), tell connected clients, flush the session file, then unpublish
	// (registry entry + socket), and release the lock last so a resume never
	// races the final session write.
	const teardown = async (): Promise<void> => {
		void live.server?.stopAccepting();
		for (const unsubscribe of unsubscribers) unsubscribe();
		requests.broadcast({ type: "notice", level: "info", message: "Session host is shutting down", source: "host" });
		try {
			await session.dispose();
		} finally {
			try {
				await live.server?.stop();
			} catch (error) {
				logger.warn("Failed to stop RPC host socket", { error: String(error) });
			}
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
	// After the driver_changed listener: clients learn the new driver before
	// dialogs and the plan review move to it.
	requests.bind(planCoordinator);
	unsubscribers.push(() => requests.dispose());

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

	const openConnection = (identity: RpcConnectionIdentity): RpcSocketConnectionRights | RpcSocketRefusal => {
		if (identity.surface === "shell" && identity.attachment && detachedAttachments.delete(identity.attachment)) {
			return {
				refused: true,
				code: "attachment_detached",
				error: "Another client took over this session; the shell pane is detached",
				instanceId: live.server?.instanceId,
			};
		}
		return {
			ownsSession: true,
			goalController,
			sharedExtensionRequests: requests.viewFor(identity.connectionId),
			sessionGuard,
			driver: {
				claim: () => claimDriver(identity),
				current: () => {
					const current = driver.current;
					return current ? { surface: current.surface, clientId: current.clientId } : null;
				},
			},
			ready: output => requests.attach(identity, output),
			closed: () => requests.detach(identity.connectionId),
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
	if (shuttingDown) {
		// A signal arrived while the socket was starting; teardown already ran
		// without it, so withdraw it here before the process exits.
		await live.server.stop();
		return new Promise<never>(() => {});
	}

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

	if (options.prompt) {
		session.prompt(options.prompt).catch(error => {
			logger.error("RPC host initial prompt failed", { error: String(error) });
		});
	}

	// Lifetime is driven by shutdownAndExit; this never resolves.
	return new Promise<never>(() => {});
}
