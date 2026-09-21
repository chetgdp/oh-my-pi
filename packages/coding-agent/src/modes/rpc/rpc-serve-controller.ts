/**
 * Bridges the `rpc.serve` setting to the RPC socket server inside interactive
 * mode. Constructed alongside `CollabController`; start/stop follow the same
 * lifecycle pattern (start after collab auto-start, stop in #teardown).
 */
import { logger } from "@oh-my-pi/pi-utils";
import type { InteractiveModeContext } from "../types";
import type { RpcHostSnapshot } from "./rpc-registry";
import { type RpcServeFn, type RpcSocketServer, startRpcSocketServer } from "./rpc-socket";

export class RpcServeController {
	#server: RpcSocketServer | undefined;
	readonly #ctx: InteractiveModeContext;

	constructor(ctx: InteractiveModeContext) {
		this.#ctx = ctx;
	}

	#buildSnapshot(): RpcHostSnapshot {
		const sm = this.#ctx.sessionManager;
		return {
			sessionId: sm.getSessionId() ?? null,
			sessionName: sm.getSessionName() ?? null,
			cwd: process.cwd(),
			model: this.#ctx.session.model?.id ?? null,
			startedAt: Date.now(),
		};
	}

	async start(serve: RpcServeFn): Promise<void> {
		try {
			this.#server = await startRpcSocketServer(this.#ctx.session, {
				snapshot: this.#buildSnapshot(),
				subagentEventBus: this.#ctx.subagentEventBus,
				onShutdown: () => this.#ctx.shutdown(),
				serve,
			});
		} catch (error) {
			logger.warn("Failed to start RPC serve socket", { error: String(error) });
		}
	}

	update(): void {
		this.#server?.update(this.#buildSnapshot());
	}

	async stop(): Promise<void> {
		const server = this.#server;
		if (!server) return;
		this.#server = undefined;
		await server.stop();
	}
}
