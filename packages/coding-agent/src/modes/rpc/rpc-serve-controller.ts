/**
 * Bridges the `rpc.serve` setting to the RPC socket server inside interactive
 * mode. Constructed alongside `CollabController`; start/stop follow the same
 * lifecycle pattern (start after collab auto-start, stop in #teardown).
 */
import { logger } from "@oh-my-pi/pi-utils";
import type { InteractiveModeContext } from "../types";
import { getRpcPlanCoordinator, type RpcPlanCoordinator } from "./rpc-plan";
import { cfgOmemEnabled } from "../../session/context-settings";
import { isSessionLockOwnedByThisProcess, type RpcHostSnapshot } from "./rpc-registry";
import { RpcHostDriver } from "./rpc-host-driver";
import type { RpcHostExtensionRequests, RpcHostExtensionUIContext } from "./rpc-host-requests";
import { type RpcServeFn, type RpcSocketServer, startRpcSocketServer } from "./rpc-socket";

export interface RpcServeControllerOptions {
	registryDir?: string;
	startedAt?: number;
}

export class RpcServeController {
	#server: RpcSocketServer | undefined;
	#serve: RpcServeFn | undefined;
	/** Serializes publish/unpublish so back-to-back session changes cannot race two socket servers. */
	#sync: Promise<void> = Promise.resolve();
	#startedAt: number;
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
		this.#serve = serve;
		this.#clearSubscriptions();
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
			this.#unsubscribers.push(this.#ctx.session.registerSessionChangeCallback(() => void this.#syncPublished()));
		}
		await this.#syncPublished();
	}

	/** Resolves once the registry entry reflects the latest session change (publish/unpublish finished). */
	whenSynced(): Promise<void> {
		return this.#sync;
	}

	/**
	 * The TUI's session lock (tui-session-lock.ts) decides who writes the session. The registry entry
	 * tells the shell and webgui where to connect, so it exists only while this process holds the lock
	 * of its current session: a TUI on a session another TUI holds writes to a copy and must not be listed.
	 */
	#syncPublished(): Promise<void> {
		this.#sync = this.#sync.then(async () => {
			if (!this.#serve) return;
			const sessionId = this.#ctx.sessionManager?.getSessionId();
			const owned = !!sessionId && isSessionLockOwnedByThisProcess(sessionId, { dir: this.#registryDir });
			if (!owned) {
				if (this.#server) {
					logger.warn("Session held by another process; unpublishing RPC serve socket", { sessionId });
					await this.#unpublish();
				}
				return;
			}
			if (this.#server) {
				this.update();
				return;
			}
			await this.#publish(this.#serve);
		});
		return this.#sync;
	}

	async #publish(serve: RpcServeFn): Promise<void> {
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
		} catch (error) {
			logger.warn("Failed to start RPC serve socket", { error: String(error) });
		}
	}

	async #unpublish(): Promise<void> {
		const server = this.#server;
		this.#server = undefined;
		await server?.stop();
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
		this.#serve = undefined;
		this.#planCoordinator.setTuiDelegate(undefined);
		await this.#sync;
		await this.#unpublish();
	}
}
