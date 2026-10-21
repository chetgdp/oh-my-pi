/**
 * Bridges the `rpc.serve` setting to the RPC socket server inside interactive
 * mode. Constructed alongside `CollabController`; start/stop follow the same
 * lifecycle pattern (start after collab auto-start, stop in #teardown).
 */
import { logger } from "@oh-my-pi/pi-utils";
import type { InteractiveModeContext } from "../types";
import { getRpcPlanCoordinator, type RpcPlanCoordinator } from "./rpc-plan";
import { cfgOmemEnabled } from "../../session/context-settings";
import { acquireSessionLock, releaseSessionLock, type RpcHostSnapshot, type RpcRegistryOptions } from "./rpc-registry";
import { RpcHostDriver } from "./rpc-host-driver";
import type { RpcHostExtensionRequests, RpcHostExtensionUIContext } from "./rpc-host-requests";
import { type RpcServeFn, type RpcSocketServer, startRpcSocketServer } from "./rpc-socket";

export interface RpcServeControllerOptions {
	registryDir?: string;
	startedAt?: number;
}

export class RpcServeController {
	#server: RpcSocketServer | undefined;
	#startedAt: number;
	#lockedSessionId: string | undefined;
	#registryDir: string | undefined;
	#unsubscribers: Array<() => void> = [];
	readonly #ctx: InteractiveModeContext;
	readonly #planCoordinator: RpcPlanCoordinator;
	readonly #options?: RpcServeControllerOptions;
	/**
	 * Dialogs the TUI mirrors to attached clients; no driver is ever set, so every client receives them.
	 * Created in `start` so rpc-server stays out of startup when `rpc.serve` is off.
	 */
	#dialogs: { requests: RpcHostExtensionRequests; ui: RpcHostExtensionUIContext } | undefined;
	constructor(ctx: InteractiveModeContext, options?: RpcServeControllerOptions) {
		this.#ctx = ctx;
		this.#options = options;
		this.#startedAt = options?.startedAt ?? Date.now();
		this.#planCoordinator = getRpcPlanCoordinator(ctx.session);
		this.#planCoordinator.setTuiDelegate({
			isPlanModeEnabled: () => this.#ctx.planModeEnabled,
			isPlanModePaused: () => this.#ctx.planModePaused,
			getPlanFilePath: () => this.#ctx.planModePlanFilePath,
			enterPlanMode: options => this.#ctx.enterPlanMode(options),
			exitPlanMode: options => this.#ctx.exitPlanMode(options),
			dismissPlanReview: () => this.#ctx.dismissPlanReview(),
			answerPlanReview: (action, feedback) => this.#ctx.answerPlanReview(action, feedback),
		});
	}

	/**
	 * UI context reaching every attached client while the socket is up, or undefined when it is not.
	 * Pending dialogs replay to clients that attach later; rich `ask` is used while every attached
	 * client opted in, and also with none attached yet (the web GUI, the client that attaches later, opts in).
	 */
	get dialogMirror(): RpcHostExtensionUIContext | undefined {
		return this.#server ? this.#dialogs?.ui : undefined;
	}
	#buildSnapshot(): RpcHostSnapshot {
		const sm = this.#ctx.sessionManager;
		return {
			sessionId: sm?.getSessionId() ?? null,
			sessionName: sm?.getSessionName() ?? null,
			sessionFile: sm?.getSessionFile?.() ?? null,
			cwd: sm?.getCwd?.() ?? process.cwd(),
			model: this.#ctx.session?.model?.id ?? null,
			startedAt: this.#startedAt,
			...(this.#ctx.session && cfgOmemEnabled.get(this.#ctx.session.settings) ? { omem: true as const } : {}),
		};
	}

	async start(serve: RpcServeFn, options?: RpcServeControllerOptions): Promise<void> {
		this.#startedAt = options?.startedAt ?? this.#options?.startedAt ?? Date.now();
		this.#registryDir = options?.registryDir ?? this.#options?.registryDir;
		this.#clearSubscriptions();

		const registry: RpcRegistryOptions = { dir: this.#registryDir };
		const currentSessionId = this.#ctx.sessionManager?.getSessionId();
		if (currentSessionId) {
			if (!acquireSessionLock(currentSessionId, registry)) {
				logger.warn("Session already hosted; not publishing RPC serve socket", { sessionId: currentSessionId });
				return;
			}
			this.#lockedSessionId = currentSessionId;
		}

		try {
			if (!this.#dialogs) {
				// Lazy like main.ts's serveRpc: rpc-host-requests pulls rpc-server into every interactive startup otherwise.
				const { RpcHostExtensionRequests, RpcHostExtensionUIContext } = await import("./rpc-host-requests");
				const requests = new RpcHostExtensionRequests(new RpcHostDriver());
				this.#dialogs = {
					requests,
					ui: new RpcHostExtensionUIContext(requests, { richAskWithoutRecipients: true }),
				};
			}
			const { requests } = this.#dialogs;
			this.#server = await startRpcSocketServer(this.#ctx.session, {
				snapshot: this.#buildSnapshot(),
				subagentEventBus: this.#ctx.subagentEventBus,
				onShutdown: () => this.#ctx.shutdown(),
				registryDir: this.#registryDir,
				serve,
				openConnection: identity => ({
					ownsSession: false,
					sharedExtensionRequests: requests.viewFor(identity.connectionId),
					ready: output => requests.attach(identity, output),
					closed: () => requests.detach(identity.connectionId),
				}),
			});
			if (this.#ctx.sessionManager?.onSessionNameChanged) {
				this.#unsubscribers.push(this.#ctx.sessionManager.onSessionNameChanged(() => this.update()));
			}
			if (this.#ctx.session?.subscribe) {
				this.#unsubscribers.push(
					this.#ctx.session.subscribe(event => {
						if (event.type === "model_changed") {
							this.update();
						}
					}),
				);
			}
			if (this.#ctx.session?.registerSessionChangeCallback) {
				this.#unsubscribers.push(
					this.#ctx.session.registerSessionChangeCallback(() => {
						const nextSessionId = this.#ctx.sessionManager?.getSessionId();
						if (nextSessionId && nextSessionId !== this.#lockedSessionId) {
							if (acquireSessionLock(nextSessionId, registry)) {
								if (this.#lockedSessionId) releaseSessionLock(this.#lockedSessionId, registry);
								this.#lockedSessionId = nextSessionId;
							} else {
								logger.warn("Switched to a session another host holds; keeping previous lock", {
									sessionId: nextSessionId,
								});
							}
						}
						this.update();
					}),
				);
			}
		} catch (error) {
			if (this.#lockedSessionId) {
				releaseSessionLock(this.#lockedSessionId, registry);
				this.#lockedSessionId = undefined;
			}
			logger.warn("Failed to start RPC serve socket", { error: String(error) });
		}
	}
	#clearSubscriptions(): void {
		for (const unsubscribe of this.#unsubscribers) {
			try {
				unsubscribe();
			} catch {
				/* best-effort */
			}
		}
		this.#unsubscribers = [];
	}

	update(): void {
		// Runs inside session-name and model-change callbacks; a failed registry write must not break those.
		try {
			this.#server?.update(this.#buildSnapshot());
		} catch (error) {
			logger.warn("Failed to update RPC host registry entry", { error: String(error) });
		}
	}

	async stop(): Promise<void> {
		this.#clearSubscriptions();
		if (this.#lockedSessionId) {
			releaseSessionLock(this.#lockedSessionId, { dir: this.#registryDir });
			this.#lockedSessionId = undefined;
		}
		const server = this.#server;
		this.#planCoordinator.setTuiDelegate(undefined);
		if (!server) return;
		this.#server = undefined;
		await server.stop();
	}
}
