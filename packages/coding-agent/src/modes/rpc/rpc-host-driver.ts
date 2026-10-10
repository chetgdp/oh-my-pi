/**
 * Tracks which connected client currently drives a hosted session.
 *
 * The driver is the connection that most recently sent a driver-setting
 * command (prompt, steer, abort, session switch, ...). Interactive dialogs
 * route to the driver; the host broadcasts `driver_changed` on every change.
 */

export type RpcClientSurface = "tui" | "web" | "shell" | "unknown";

export interface RpcConnectionIdentity {
	connectionId: string;
	surface: RpcClientSurface;
	clientId: string;
	/** Shell pane key; only meaningful when surface is "shell". */
	attachment?: string;
}

export interface RpcDriver {
	surface: RpcClientSurface;
	clientId: string;
	connectionId: string;
}

export type RpcDriverListener = (prev: RpcDriver | null, next: RpcDriver) => void;

export class RpcHostDriver {
	#current: RpcDriver | null = null;
	#listeners = new Set<RpcDriverListener>();

	get current(): RpcDriver | null {
		return this.#current;
	}

	/** Make `identity` the driver. No-op when that connection already drives. */
	set(identity: RpcConnectionIdentity): void {
		const prev = this.#current;
		if (prev?.connectionId === identity.connectionId) return;
		const next: RpcDriver = {
			surface: identity.surface,
			clientId: identity.clientId,
			connectionId: identity.connectionId,
		};
		this.#current = next;
		for (const listener of this.#listeners) listener(prev, next);
	}

	onChange(listener: RpcDriverListener): () => void {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}
}

/** Commands whose sender becomes the driver. */
export const RPC_DRIVER_COMMANDS: Record<string, true> = {
	prompt: true,
	steer: true,
	follow_up: true,
	abort: true,
	abort_and_restore_queue: true,
	abort_and_prompt: true,
	new_session: true,
	switch_session: true,
	branch: true,
	fork: true,
	open_session: true,
};

const IDENTITY_TOKEN = /^[A-Za-z0-9._:-]{1,128}$/;

export function isRpcIdentityToken(value: unknown): value is string {
	return typeof value === "string" && IDENTITY_TOKEN.test(value);
}

export function parseRpcClientSurface(value: unknown): RpcClientSurface {
	return value === "tui" || value === "web" || value === "shell" ? value : "unknown";
}
