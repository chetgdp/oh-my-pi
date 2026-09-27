/**
 * Bridges the `rpc.serve` setting to the RPC socket server inside interactive
 * mode. Constructed alongside `CollabController`; start/stop follow the same
 * lifecycle pattern (start after collab auto-start, stop in #teardown).
 */
import { logger } from "@oh-my-pi/pi-utils";
import type { InteractiveModeContext } from "../types";
import { getRpcPlanCoordinator, type RpcPlanCoordinator } from "./rpc-plan";
import type { RpcHostSnapshot } from "./rpc-registry";
import { type RpcServeFn, type RpcSocketServer, startRpcSocketServer } from "./rpc-socket";

export interface RpcServeControllerOptions {
	registryDir?: string;
	startedAt?: number;
}

export class RpcServeController {
	#server: RpcSocketServer | undefined;
	#startedAt: number;
	#unsubscribers: Array<() => void> = [];
	readonly #ctx: InteractiveModeContext;
	readonly #planCoordinator: RpcPlanCoordinator;
	readonly #options?: RpcServeControllerOptions;

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
	#buildSnapshot(): RpcHostSnapshot {
		const sm = this.#ctx.sessionManager;
		return {
			sessionId: sm?.getSessionId() ?? null,
			sessionName: sm?.getSessionName() ?? null,
			cwd: sm?.getCwd?.() ?? process.cwd(),
			model: this.#ctx.session?.model?.id ?? null,
			startedAt: this.#startedAt,
		};
	}

	async start(serve: RpcServeFn, options?: RpcServeControllerOptions): Promise<void> {
		this.#startedAt = options?.startedAt ?? this.#options?.startedAt ?? Date.now();
		this.#clearSubscriptions();
		try {
			this.#server = await startRpcSocketServer(this.#ctx.session, {
				snapshot: this.#buildSnapshot(),
				subagentEventBus: this.#ctx.subagentEventBus,
				onShutdown: () => this.#ctx.shutdown(),
				registryDir: options?.registryDir ?? this.#options?.registryDir,
				serve,
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
				this.#unsubscribers.push(this.#ctx.session.registerSessionChangeCallback(() => this.update()));
			}
		} catch (error) {
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
		const server = this.#server;
		this.#planCoordinator.setTuiDelegate(undefined);
		if (!server) return;
		this.#server = undefined;
		await server.stop();
	}
}
