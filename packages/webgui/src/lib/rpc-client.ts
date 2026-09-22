/**
 * Browser-side RPC client for the coding agent WebSocket relay.
 *
 * Speaks NDJSON over WebSocket. Protocol v2 chunked frames are reassembled
 * with a minimal browser-safe decoder (the server-side RpcFrameDecoder uses
 * Node Buffer/util which are unavailable here).
 */

import type {
	RpcCommand,
	RpcResponse,
	RpcSessionState,
	RpcChunkFrame,
	RpcSessionEventFrame,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { SUBAGENT_SUBSCRIBE_COMMAND } from "./subagent-model";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RpcConnectionState = "connecting" | "ready" | "reconnecting" | "closed";

/** Minimal WebSocket-compatible interface used by the client. */
export interface RpcSocketLike {
	send(data: string): void;
	close(code?: number, reason?: string): void;
	addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
}

export interface RpcWebClientOptions {
	url: string;
	/** Injection seam for tests -- returns a WebSocket-compatible object. */
	createSocket?: (url: string) => RpcSocketLike;
	/** When enabled, automatically reconnect on unexpected socket close. */
	reconnect?: {
		enabled: boolean;
		/** Base delay in ms before first reconnect attempt. Default 500. */
		baseDelayMs?: number;
		/** Maximum delay in ms. Default 15000. */
		maxDelayMs?: number;
	};
}

/**
 * Extract the success-response union member whose `command` field equals
 * the given command type string.
 */
export type RpcResponseFor<T extends RpcCommand["type"]> = Extract<RpcResponse, { command: T; success: true }>;

export type RpcSessionEvent = RpcSessionEventFrame;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RpcClientClosedError extends Error {
	constructor() {
		super("RPC client closed");
		this.name = "RpcClientClosedError";
	}
}

export class RpcCommandError extends Error {
	readonly code: string | undefined;

	constructor(command: string, message: string, code?: string) {
		super(`${command}: ${message}`);
		this.name = "RpcCommandError";
		this.code = code;
	}
}

export class RpcTimeoutError extends Error {
	constructor(command: string) {
		super(`${command}: timed out`);
		this.name = "RpcTimeoutError";
	}
}

// ---------------------------------------------------------------------------
// Minimal browser-safe v2 chunk reassembly
//
// The canonical RpcFrameDecoder in coding-agent uses Node Buffer. We
// replicate only the reassembly logic using browser APIs (atob, TextDecoder,
// Uint8Array).
// ---------------------------------------------------------------------------

const MAX_RPC_FRAME_BYTES = 1024 * 1024;
const MAX_RPC_REASSEMBLED_BYTES = 64 * 1024 * 1024;
const RPC_CHUNK_PAYLOAD_BYTES = 256 * 1024;

function isRpcChunkFrame(value: unknown): value is RpcChunkFrame {
	return typeof value === "object" && value !== null && (value as Record<string, unknown>).type === "rpc_chunk";
}

interface PendingChunks {
	chunkId: string;
	count: number;
	byteLength: number;
	nextIndex: number;
	chunks: Uint8Array[];
	receivedBytes: number;
}

function isSafeInt(n: unknown): boolean {
	return Number.isSafeInteger(n);
}

class BrowserFrameDecoder {
	#pending: PendingChunks | undefined;

	push(value: unknown): object | undefined {
		if (!isRpcChunkFrame(value)) {
			if (this.#pending) throw new Error("rpc chunk sequence interrupted");
			if (typeof value !== "object" || value === null) throw new Error("rpc frame must be an object");
			return value as object;
		}
		const { chunkId, index, count, byteLength, data } = value;
		if (
			typeof chunkId !== "string" ||
			chunkId.length === 0 ||
			!isSafeInt(index) ||
			!isSafeInt(count) ||
			!isSafeInt(byteLength) ||
			index < 0 ||
			count < 2 ||
			count > Math.ceil(MAX_RPC_REASSEMBLED_BYTES / RPC_CHUNK_PAYLOAD_BYTES) ||
			index >= count ||
			byteLength < MAX_RPC_FRAME_BYTES ||
			byteLength > MAX_RPC_REASSEMBLED_BYTES
		)
			throw new Error("invalid rpc chunk metadata");

		const binary = atob(data);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}

		if (bytes.byteLength > RPC_CHUNK_PAYLOAD_BYTES) throw new Error("rpc chunk payload exceeds the transport limit");

		if (!this.#pending) {
			if (index !== 0) throw new Error("rpc chunk sequence must start at index 0");
			this.#pending = {
				chunkId,
				count,
				byteLength,
				nextIndex: 0,
				chunks: [],
				receivedBytes: 0,
			};
		}
		const pending = this.#pending;
		if (
			pending.chunkId !== chunkId ||
			pending.count !== count ||
			pending.byteLength !== byteLength ||
			pending.nextIndex !== index
		)
			throw new Error("rpc chunk sequence mismatch");

		pending.chunks.push(bytes);
		pending.receivedBytes += bytes.byteLength;
		pending.nextIndex++;
		if (pending.receivedBytes > pending.byteLength) throw new Error("rpc chunk sequence exceeds declared length");
		if (pending.nextIndex < pending.count) return undefined;
		if (pending.receivedBytes !== pending.byteLength) throw new Error("rpc chunk sequence length mismatch");

		this.#pending = undefined;
		const merged = new Uint8Array(pending.receivedBytes);
		let offset = 0;
		for (const chunk of pending.chunks) {
			merged.set(chunk, offset);
			offset += chunk.byteLength;
		}
		const decoded = new TextDecoder("utf-8", { fatal: true }).decode(merged);
		const frame: unknown = JSON.parse(decoded);
		if (typeof frame !== "object" || frame === null) throw new Error("rpc frame must be an object");
		return frame as object;
	}
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// RpcWebClient
// ---------------------------------------------------------------------------

interface PendingRequest {
	resolve: (response: RpcResponse) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout> | undefined;
}

export class RpcWebClient {
	#opts: RpcWebClientOptions;
	#state: RpcConnectionState = "closed";
	#ws: RpcSocketLike | null = null;
	#lineBuffer = "";
	#frameDecoder = new BrowserFrameDecoder();
	#requestId = 0;
	#pending = new Map<string, PendingRequest>();
	#eventListeners: Array<(event: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(state: RpcConnectionState) => void> = [];
	#resyncListeners: Array<(messages: AgentMessage[], state: RpcSessionState) => void> = [];
	#sessionState: RpcSessionState | null = null;
	#messages: AgentMessage[] | null = null;
	#intentionalClose = false;
	#reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	#reconnectAttempt = 0;

	constructor(opts: RpcWebClientOptions) {
		this.#opts = opts;
	}

	get state(): RpcConnectionState {
		return this.#state;
	}

	get sessionState(): RpcSessionState | null {
		return this.#sessionState;
	}

	get messages(): AgentMessage[] | null {
		return this.#messages;
	}

	connect(): Promise<void> {
		if (this.#state !== "closed") {
			return Promise.reject(new Error("already connected or connecting"));
		}
		this.#intentionalClose = false;
		this.#reconnectAttempt = 0;
		return this.#openSocket(false);
	}
	reconnectNow(): void {
		if (this.#reconnectTimer !== undefined) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = undefined;
		}
		if (this.#state === "closed") {
			this.#intentionalClose = false;
			this.#reconnectAttempt = 0;
			void this.#openSocket(true);
		} else if (this.#state === "reconnecting") {
			void this.#openSocket(true);
		}
	}

	#openSocket(isReconnect: boolean): Promise<void> {
		if (!isReconnect) {
			this.#setState("connecting");
		}
		const { promise, resolve, reject } = Promise.withResolvers<void>();

		const ws: RpcSocketLike = this.#opts.createSocket
			? this.#opts.createSocket(this.#opts.url)
			: new WebSocket(this.#opts.url);

		this.#ws = ws;
		this.#lineBuffer = "";
		this.#frameDecoder = new BrowserFrameDecoder();

		let readyReceived = false;

		ws.addEventListener("message", ev => {
			const text = typeof ev.data === "string" ? ev.data : String(ev.data);
			this.#lineBuffer += text;

			const lines = this.#lineBuffer.split("\n");
			this.#lineBuffer = lines.pop()!;

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.length === 0) continue;
				let parsed: unknown;
				try {
					parsed = JSON.parse(trimmed);
				} catch {
					continue;
				}

				if (!readyReceived) {
					if (
						typeof parsed === "object" &&
						parsed !== null &&
						(parsed as Record<string, unknown>).type === "ready"
					) {
						readyReceived = true;
						this.#runAttachSequence(isReconnect).then(resolve, err => {
							if (isReconnect) {
								// Attach failed on reconnect -- schedule another attempt
								this.#scheduleReconnect();
								resolve();
							} else {
								reject(err);
							}
						});
					}
					continue;
				}

				let frame: object | undefined;
				try {
					frame = this.#frameDecoder.push(parsed);
				} catch {
					continue;
				}
				if (frame) this.#dispatchFrame(frame);
			}
		});

		ws.addEventListener("error", () => {
			if (!readyReceived) {
				if (isReconnect) {
					this.#scheduleReconnect();
					resolve();
				} else {
					this.#cleanup();
					reject(new Error("WebSocket error before ready"));
				}
			}
		});

		ws.addEventListener("close", () => {
			if (!readyReceived) {
				if (isReconnect) {
					this.#scheduleReconnect();
					resolve();
				} else {
					this.#cleanup();
					reject(new Error("WebSocket closed before ready"));
				}
			} else {
				this.#handleUnexpectedClose();
			}
		});

		return promise;
	}

	close(): void {
		this.#intentionalClose = true;
		if (this.#reconnectTimer !== undefined) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = undefined;
		}
		if (this.#ws) {
			this.#ws.close();
		}
		this.#cleanup();
	}

	request<T extends RpcCommand["type"]>(
		command: Extract<RpcCommand, { type: T }>,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	): Promise<RpcResponseFor<T>> {
		if (this.#state === "closed" || !this.#ws) {
			return Promise.reject(new RpcClientClosedError());
		}
		const id = String(++this.#requestId);
		const payload = { ...command, id };
		this.#ws.send(JSON.stringify(payload) + "\n");

		const { promise, resolve, reject } = Promise.withResolvers<RpcResponseFor<T>>();

		const timer =
			timeoutMs > 0
				? setTimeout(() => {
						this.#pending.delete(id);
						reject(new RpcTimeoutError(command.type));
					}, timeoutMs)
				: undefined;

		this.#pending.set(id, {
			resolve: resolve as (r: RpcResponse) => void,
			reject,
			timer,
		});

		return promise;
	}

	onEvent(listener: (event: RpcSessionEvent) => void): () => void {
		this.#eventListeners.push(listener);
		return () => {
			const idx = this.#eventListeners.indexOf(listener);
			if (idx !== -1) this.#eventListeners.splice(idx, 1);
		};
	}

	onStateChange(listener: (state: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(listener);
		return () => {
			const idx = this.#stateListeners.indexOf(listener);
			if (idx !== -1) this.#stateListeners.splice(idx, 1);
		};
	}

	onResync(listener: (messages: AgentMessage[], state: RpcSessionState) => void): () => void {
		this.#resyncListeners.push(listener);
		return () => {
			const idx = this.#resyncListeners.indexOf(listener);
			if (idx !== -1) this.#resyncListeners.splice(idx, 1);
		};
	}

	async #runAttachSequence(isReconnect: boolean): Promise<void> {
		this.#setState("ready");

		await this.request({
			type: "negotiate_protocol",
			protocolVersion: 2,
		} as Extract<RpcCommand, { type: "negotiate_protocol" }>);

		const stateResp = await this.request({
			type: "get_state",
		} as Extract<RpcCommand, { type: "get_state" }>);
		this.#sessionState = (stateResp as { data: RpcSessionState }).data;

		const msgsResp = await this.request({
			type: "get_messages",
		} as Extract<RpcCommand, { type: "get_messages" }>);
		this.#messages = (msgsResp as { data: { messages: AgentMessage[] } }).data.messages;

		// Subscribe to subagent frames (ignore errors -- server may not support it)
		this.request(SUBAGENT_SUBSCRIBE_COMMAND).catch(() => {});

		if (isReconnect) {
			this.#reconnectAttempt = 0;
			for (const listener of this.#resyncListeners) {
				listener(this.#messages, this.#sessionState);
			}
		}
	}

	#dispatchFrame(frame: object): void {
		const record = frame as Record<string, unknown>;
		if (record.type === "response") {
			const resp = frame as RpcResponse;
			const id = resp.id;
			if (id != null) {
				const entry = this.#pending.get(id);
				if (entry) {
					this.#pending.delete(id);
					if (entry.timer) clearTimeout(entry.timer);
					if (resp.success === false) {
						entry.reject(new RpcCommandError(resp.command, resp.error, resp.code));
					} else {
						entry.resolve(resp);
					}
					return;
				}
			}
			return;
		}

		// Subsequent ready frames are informational
		if (record.type === "ready") return;

		for (const listener of this.#eventListeners) {
			listener(frame as RpcSessionEvent);
		}
	}

	#setState(state: RpcConnectionState): void {
		if (this.#state === state) return;
		this.#state = state;
		for (const listener of this.#stateListeners) {
			listener(state);
		}
	}

	#cleanup(): void {
		this.#ws = null;
		this.#lineBuffer = "";
		this.#setState("closed");

		const err = new RpcClientClosedError();
		for (const entry of this.#pending.values()) {
			if (entry.timer) clearTimeout(entry.timer);
			entry.reject(err);
		}
		this.#pending.clear();
	}

	#handleUnexpectedClose(): void {
		// Reject pending requests
		const err = new RpcClientClosedError();
		for (const entry of this.#pending.values()) {
			if (entry.timer) clearTimeout(entry.timer);
			entry.reject(err);
		}
		this.#pending.clear();
		this.#ws = null;
		this.#lineBuffer = "";

		if (this.#intentionalClose) {
			this.#setState("closed");
			return;
		}

		const rc = this.#opts.reconnect;
		if (!rc || !rc.enabled) {
			this.#setState("closed");
			return;
		}

		this.#setState("reconnecting");
		this.#scheduleReconnect();
	}

	#scheduleReconnect(): void {
		if (this.#intentionalClose) {
			this.#setState("closed");
			return;
		}
		const rc = this.#opts.reconnect!;
		const base = rc.baseDelayMs ?? 500;
		const max = rc.maxDelayMs ?? 15_000;
		const delay = Math.min(max, base * 2 ** this.#reconnectAttempt) * (0.5 + Math.random() * 0.5);
		this.#reconnectAttempt++;
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = undefined;
			if (this.#intentionalClose) {
				this.#setState("closed");
				return;
			}
			this.#openSocket(true);
		}, delay);
	}
}
