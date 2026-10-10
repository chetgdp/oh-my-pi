/**
 * Interactive request routing for the headless session host: extension dialogs
 * (and the plan review) go to the current driver's connections.
 */
import { isRecord, Snowflake } from "@oh-my-pi/pi-utils";
import type { RpcConnectionIdentity, RpcHostDriver } from "./rpc-host-driver";
import type { RpcPlanCoordinator } from "./rpc-plan";
import type { PendingExtensionRequest, RpcSharedExtensionRequests } from "./rpc-server";

type FrameSink = (frame: object) => void;

interface HostConnection {
	identity: RpcConnectionIdentity;
	send: FrameSink;
}

interface OutstandingDialog {
	frame: object;
	/** Connections the dialog is currently shown on; only these may answer. */
	deliveredTo: Set<string>;
}

function cancelFrame(targetId: string): object {
	return { type: "extension_ui_request", id: Snowflake.next() as string, method: "cancel", targetId };
}

/**
 * Extension UI requests owned by the host process. Dialogs (requests awaiting
 * an answer: select/confirm/input/editor/ask, including tool approvals) go to
 * the driver's connections only (matched by `clientId`, so a reconnecting
 * driver gets them back); before any driver exists they go to every client.
 * Only a connection a dialog was delivered to may answer; the first answer wins
 * and the other recipients are told to close it. Dialogs wait while no eligible
 * client is connected and are replayed when one connects. When the driver
 * moves, connections that lost eligibility get a cancel and the new driver's
 * get the original request; the pending promise and its timeout are untouched.
 * Non-dialog frames (notify, status, widgets, errors, notices) go to everyone.
 * The host never answers a dialog itself.
 */
export class RpcHostExtensionRequests extends Map<string, PendingExtensionRequest> {
	readonly #driver: RpcHostDriver;
	readonly #connections = new Map<string, HostConnection>();
	readonly #outstanding = new Map<string, OutstandingDialog>();
	#plan: RpcPlanCoordinator | undefined;
	#unsubscribeDriver: (() => void) | undefined;

	constructor(driver: RpcHostDriver) {
		super();
		this.#driver = driver;
	}

	readonly broadcast: FrameSink = frame => {
		if (isRecord(frame) && frame.type === "extension_ui_request") {
			if (typeof frame.id === "string" && super.has(frame.id)) {
				const dialog: OutstandingDialog = { frame, deliveredTo: new Set() };
				this.#outstanding.set(frame.id, dialog);
				for (const connection of this.#connections.values()) this.#deliver(dialog, connection);
				return;
			}
			if (frame.method === "cancel" && typeof frame.targetId === "string") {
				const dialog = this.#outstanding.get(frame.targetId);
				if (dialog) {
					this.#outstanding.delete(frame.targetId);
					for (const connectionId of dialog.deliveredTo) this.#connections.get(connectionId)?.send(frame);
					return;
				}
			}
		}
		for (const connection of this.#connections.values()) connection.send(frame);
	};

	override delete(id: string): boolean {
		const dialog = this.#outstanding.get(id);
		if (dialog) {
			this.#outstanding.delete(id);
			for (const connectionId of dialog.deliveredTo) {
				this.#connections.get(connectionId)?.send(cancelFrame(id));
			}
		}
		return super.delete(id);
	}

	/**
	 * Start following driver changes and route `plan`'s review to the same
	 * audience as dialogs. Call after other driver listeners that must run first
	 * (the `driver_changed` broadcast precedes rerouted dialogs).
	 */
	bind(plan: RpcPlanCoordinator): void {
		this.#unsubscribeDriver?.();
		this.#unsubscribeDriver = this.#driver.onChange(() => {
			this.#reroute();
			plan.syncReviewAudience();
		});
		this.#plan = plan;
		plan.setReviewAudience(output => {
			for (const connection of this.#connections.values()) {
				if (connection.send === output) return this.#isEligible(connection.identity);
			}
			return false;
		});
	}

	/** `connectionId`'s view: only dialogs delivered to it are answerable. */
	viewFor(connectionId: string): RpcSharedExtensionRequests {
		return {
			get: id => (this.#outstanding.get(id)?.deliveredTo.has(connectionId) ? super.get(id) : undefined),
		};
	}

	attach(identity: RpcConnectionIdentity, send: FrameSink): void {
		const connection: HostConnection = { identity, send };
		this.#connections.set(identity.connectionId, connection);
		for (const dialog of this.#outstanding.values()) this.#deliver(dialog, connection);
		this.#plan?.syncReviewAudience();
	}

	detach(connectionId: string): void {
		this.#connections.delete(connectionId);
		for (const dialog of this.#outstanding.values()) dialog.deliveredTo.delete(connectionId);
	}

	/** Stop following driver changes. */
	dispose(): void {
		this.#unsubscribeDriver?.();
		this.#unsubscribeDriver = undefined;
	}

	#reroute(): void {
		for (const [id, dialog] of this.#outstanding) {
			for (const connectionId of dialog.deliveredTo) {
				const connection = this.#connections.get(connectionId);
				if (connection && this.#isEligible(connection.identity)) continue;
				dialog.deliveredTo.delete(connectionId);
				connection?.send(cancelFrame(id));
			}
			for (const connection of this.#connections.values()) this.#deliver(dialog, connection);
		}
	}

	#isEligible(identity: RpcConnectionIdentity): boolean {
		const driver = this.#driver.current;
		return !driver || driver.clientId === identity.clientId;
	}

	#deliver(dialog: OutstandingDialog, connection: HostConnection): void {
		const { connectionId } = connection.identity;
		if (dialog.deliveredTo.has(connectionId) || !this.#isEligible(connection.identity)) return;
		dialog.deliveredTo.add(connectionId);
		connection.send(dialog.frame);
	}
}
