/**
 * Browser-side RPC client for the coding agent WebSocket relay.
 *
 * Speaks NDJSON over WebSocket. Protocol v2 chunked frames are reassembled
 * with a minimal browser-safe decoder (the server-side RpcFrameDecoder uses
 * Node Buffer/util which are unavailable here).
 */

import type {
	RpcServerCommand,
	RpcServerResponse,
	RpcServerSessionState,
	RpcChunkFrame,
	RpcServerSessionEventFrame,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3HistoryCommand, RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import { SUBAGENT_SUBSCRIBE_COMMAND } from "./subagent-model";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RpcConnectionState = "connecting" | "ready" | "reconnecting" | "closed" | "incompatible";

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
	/**
	 * Hash of the slash-command catalog the caller has cached, read at every (re)connect.
	 * Sent as `?commands=` so the host skips pushing an unchanged catalog.
	 */
	commandsHash?: () => string | undefined;
}

/**
 * Extract the success-response union member whose `command` field equals
 * the given command type string.
 */
export type RpcResponseFor<T extends RpcServerCommand["type"]> = Extract<
	RpcServerResponse,
	{ command: T; success: true }
>;

export type RpcSessionEvent = RpcServerSessionEventFrame;

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
	readonly command: string;

	constructor(command: string, message: string, code?: string) {
		super(`${command}: ${message}`);
		this.name = "RpcCommandError";
		this.command = command;
		this.code = code;
	}
}
export class RpcIncompatibleError extends Error {
	constructor(message = "This omp is too old, restart it") {
		super(message);
		this.name = "RpcIncompatibleError";
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
	resolve: (response: RpcServerResponse) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout> | undefined;
}

const DEDUPE_ALLOWLIST: Record<string, true> = {
	get_state: true,
	get_session_stats: true,
	get_subagents: true,
	get_plan_state: true,
	get_model_roles: true,
	get_model_browser: true,
	get_agents: true,
	get_login_status: true,
	get_available_commands: true,
};

function dedupeKey(command: Record<string, unknown>): string {
	const { id: _, ...params } = command;
	return JSON.stringify(params);
}
const SETTLED_ID_LIMIT = 256;

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
	#resyncListeners: Array<(state: RpcServerSessionState) => void> = [];
	#lateErrorListeners: Array<(error: RpcCommandError) => void> = [];
	#settledIds = new Set<string>();
	#dedupeInflight = new Map<string, Promise<RpcServerResponse>>();
	#sessionState: RpcServerSessionState | null = null;
	#intentionalClose = false;
	#reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	#reconnectAttempt = 0;
	#suspended = false;

	#sentCommandsHash: string | undefined;

	constructor(opts: RpcWebClientOptions) {
		this.#opts = opts;
	}

	/** Catalog hash the current socket presented; a host that matched it sends no `available_commands_update`. */
	get sentCommandsHash(): string | undefined {
		return this.#sentCommandsHash;
	}

	get state(): RpcConnectionState {
		return this.#state;
	}

	get sessionState(): RpcServerSessionState | null {
		return this.#sessionState;
	}

	get reconnectAttempt(): number {
		return this.#reconnectAttempt;
	}

	get attemptCount(): number {
		return this.#reconnectAttempt;
	}

	connect(): Promise<void> {
		if (this.#state === "incompatible") {
			return Promise.reject(new RpcIncompatibleError("Client is in incompatible state"));
		}
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
		if (this.#state === "incompatible") {
			return;
		}
		if (this.#state === "closed") {
			this.#intentionalClose = false;
			this.#reconnectAttempt = 0;
			this.#openSocket(true).catch(() => {});
		} else if (this.#state === "reconnecting") {
			this.#openSocket(true).catch(() => {});
		}
	}

	get suspended(): boolean {
		return this.#suspended;
	}

	/**
	 * Drops the socket without scheduling a reconnect so a backgrounded page stops
	 * receiving the event stream; `resume()` reattaches through the resync path.
	 * Refused while requests are in flight, since closing would reject them.
	 */
	suspend(): boolean {
		if (this.#state !== "ready" || !this.#ws || this.#pending.size > 0) return false;
		const ws = this.#ws;
		this.#suspended = true;
		// Detach first so the socket's own close event is ignored as stale.
		this.#ws = null;
		this.#lineBuffer = "";
		this.#dedupeInflight.clear();
		this.#setState("reconnecting");
		ws.close();
		return true;
	}

	resume(): void {
		if (!this.#suspended) return;
		this.#reconnectAttempt = 0;
		this.#openSocket(true).catch(() => {});
	}

	#openSocket(isReconnect: boolean): Promise<void> {
		if (!isReconnect || this.#sessionState === null) {
			this.#setState("connecting");
		}
		const { promise, resolve, reject } = Promise.withResolvers<void>();

		const commandsHash = this.#opts.commandsHash?.();
		this.#sentCommandsHash = commandsHash;
		const url = commandsHash
			? `${this.#opts.url}${this.#opts.url.includes("?") ? "&" : "?"}commands=${encodeURIComponent(commandsHash)}`
			: this.#opts.url;
		const ws: RpcSocketLike = this.#opts.createSocket ? this.#opts.createSocket(url) : new WebSocket(url);

		this.#suspended = false;
		this.#ws = ws;
		this.#lineBuffer = "";
		this.#frameDecoder = new BrowserFrameDecoder();

		let readyReceived = false;

		ws.addEventListener("message", ev => {
			if (this.#ws !== ws) return;
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
						this.#runAttachSequence(parsed, isReconnect).then(resolve, err => {
							if (this.#state === "incompatible") {
								if (isReconnect) {
									resolve();
								} else {
									reject(err);
								}
								return;
							}
							if (this.#opts.reconnect?.enabled) {
								this.#scheduleReconnect();
								resolve();
							} else {
								this.#cleanup();
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
			if (this.#state === "incompatible" || this.#ws !== ws) return;
			if (!readyReceived) {
				if (this.#opts.reconnect?.enabled) {
					this.#scheduleReconnect();
					resolve();
				} else {
					this.#cleanup();
					reject(new Error("WebSocket error before ready"));
				}
			}
		});

		ws.addEventListener("close", () => {
			if (this.#state === "incompatible" || this.#ws !== ws) return;
			if (!readyReceived) {
				if (this.#opts.reconnect?.enabled) {
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

	request<T extends RpcServerCommand["type"]>(
		command: Extract<RpcServerCommand, { type: T }>,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	): Promise<RpcResponseFor<T>> {
		if (this.#state === "closed" || !this.#ws) {
			return Promise.reject(new RpcClientClosedError());
		}

		if (DEDUPE_ALLOWLIST[command.type]) {
			const key = dedupeKey(command as unknown as Record<string, unknown>);
			const inflight = this.#dedupeInflight.get(key);
			if (inflight) return inflight as Promise<RpcResponseFor<T>>;

			const result = this.#sendRequest<T>(command, timeoutMs);
			this.#dedupeInflight.set(key, result as Promise<RpcServerResponse>);
			const cleanup = () => {
				this.#dedupeInflight.delete(key);
			};
			result.then(cleanup, cleanup);
			return result;
		}

		return this.#sendRequest(command, timeoutMs);
	}

	#sendRequest<T extends RpcServerCommand["type"]>(
		command: Extract<RpcServerCommand, { type: T }>,
		timeoutMs: number,
	): Promise<RpcResponseFor<T>> {
		const id = String(++this.#requestId);
		const payload = { ...command, id };
		this.#ws!.send(JSON.stringify(payload) + "\n");

		const { promise, resolve, reject } = Promise.withResolvers<RpcResponseFor<T>>();

		const timer =
			timeoutMs > 0
				? setTimeout(() => {
						this.#pending.delete(id);
						reject(new RpcTimeoutError(command.type));
					}, timeoutMs)
				: undefined;

		this.#pending.set(id, {
			resolve: resolve as (r: RpcServerResponse) => void,
			reject,
			timer,
		});

		return promise;
	}
	history(
		opts: { before?: string; after?: string; leafId?: string; limit?: number } = {},
	): Promise<RpcV3HistoryResult> {
		const command: RpcV3HistoryCommand = {
			type: "history",
			...(opts.before !== undefined ? { before: opts.before } : {}),
			...(opts.after !== undefined ? { after: opts.after } : {}),
			...(opts.leafId !== undefined ? { leafId: opts.leafId } : {}),
			...(opts.limit !== undefined ? { limit: opts.limit } : {}),
		};
		return this.request(command as unknown as Extract<RpcServerCommand, { type: "history" }>).then(resp => {
			const historyResp = resp as unknown as { data: RpcV3HistoryResult };
			return historyResp.data;
		});
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

	onResync(listener: (state: RpcServerSessionState) => void): () => void {
		this.#resyncListeners.push(listener);
		return () => {
			const idx = this.#resyncListeners.indexOf(listener);
			if (idx !== -1) this.#resyncListeners.splice(idx, 1);
		};
	}

	/** Error responses that arrive after their request already settled. */
	onLateError(listener: (error: RpcCommandError) => void): () => void {
		this.#lateErrorListeners.push(listener);
		return () => {
			const idx = this.#lateErrorListeners.indexOf(listener);
			if (idx !== -1) this.#lateErrorListeners.splice(idx, 1);
		};
	}

	#rememberSettled(id: string): void {
		this.#settledIds.add(id);
		if (this.#settledIds.size > SETTLED_ID_LIMIT) {
			const oldest = this.#settledIds.values().next().value;
			if (oldest !== undefined) this.#settledIds.delete(oldest);
		}
	}

	async #runAttachSequence(readyFrame: unknown, isReconnect: boolean): Promise<void> {
		const ready = readyFrame as { supportedProtocolVersions?: number[] } | undefined;
		const supportsV3 = Array.isArray(ready?.supportedProtocolVersions) && ready.supportedProtocolVersions.includes(3);

		if (!supportsV3) {
			const err = new RpcIncompatibleError("Host does not support protocol version 3");
			this.#handleIncompatible(err);
			throw err;
		}

		try {
			await this.request({
				type: "negotiate_protocol",
				protocolVersion: 3,
				// Tool results are read from the toolResult `entry`; this skips the copy in `tool_execution_end`.
				capabilities: ["tool_result_in_entry"],
			} as Extract<RpcServerCommand, { type: "negotiate_protocol" }>);
		} catch (err) {
			if (err instanceof RpcCommandError) {
				const error = new RpcIncompatibleError(err.message);
				this.#handleIncompatible(error);
				throw error;
			}
			throw err;
		}

		this.#setState("ready");

		// The UI never reads systemPrompt or dumpTools (about 40KB), so skip them on every attach.
		const stateResp = await this.request({
			type: "get_state",
			light: true,
		} as Extract<RpcServerCommand, { type: "get_state" }>);
		const typedStateResp = stateResp as { data: RpcServerSessionState };
		this.#sessionState = typedStateResp.data;

		// Subscribe to subagent frames (ignore errors -- server may not support it)
		this.request(SUBAGENT_SUBSCRIBE_COMMAND).catch(() => {});

		if (isReconnect) {
			this.#reconnectAttempt = 0;
			for (const listener of this.#resyncListeners) {
				listener(this.#sessionState);
			}
		}
	}

	#handleIncompatible(err: Error): void {
		if (this.#reconnectTimer !== undefined) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = undefined;
		}
		this.#setState("incompatible");
		if (this.#ws) {
			this.#ws.close();
			this.#ws = null;
		}
		for (const entry of this.#pending.values()) {
			clearTimeout(entry.timer);
			entry.reject(err);
		}
		this.#pending.clear();
		this.#dedupeInflight.clear();
	}

	#dispatchFrame(frame: object): void {
		const record = frame as Record<string, unknown>;
		if (record.type === "response") {
			const resp = frame as RpcServerResponse;
			const id = resp.id;
			if (id != null) {
				const entry = this.#pending.get(id);
				if (entry) {
					this.#pending.delete(id);
					if (entry.timer) clearTimeout(entry.timer);
					this.#rememberSettled(id);
					if (resp.success === false) {
						entry.reject(new RpcCommandError(resp.command, resp.error, resp.code));
					} else {
						entry.resolve(resp);
					}
					return;
				}
				// The host can answer a request twice (e.g. `prompt` acks, then its
				// background run fails); dropping the second frame loses the message.
				if (resp.success === false && this.#settledIds.has(id)) {
					const err = new RpcCommandError(resp.command, resp.error, resp.code);
					for (const listener of this.#lateErrorListeners) listener(err);
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
		if (this.#state !== "incompatible") {
			this.#setState("closed");
		}

		const err = new RpcClientClosedError();
		for (const entry of this.#pending.values()) {
			if (entry.timer) clearTimeout(entry.timer);
			entry.reject(err);
		}
		this.#pending.clear();
		this.#dedupeInflight.clear();
	}

	#handleUnexpectedClose(): void {
		if (this.#state === "incompatible") return;
		// Reject pending requests
		const err = new RpcClientClosedError();
		for (const entry of this.#pending.values()) {
			if (entry.timer) clearTimeout(entry.timer);
			entry.reject(err);
		}
		this.#pending.clear();
		this.#dedupeInflight.clear();
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

		if (this.#sessionState !== null) {
			this.#setState("reconnecting");
		} else {
			this.#setState("connecting");
		}
		this.#scheduleReconnect();
	}
	#scheduleReconnect(): void {
		if (this.#state === "incompatible") return;
		if (this.#intentionalClose) {
			this.#setState("closed");
			return;
		}
		// A socket drop mid-attach reaches here twice (close handler and the failed attach); keep one timer.
		if (this.#reconnectTimer !== undefined) return;
		const rc = this.#opts.reconnect!;
		const base = rc.baseDelayMs ?? 500;
		const max = rc.maxDelayMs ?? 15_000;
		const delay = Math.min(max, base * 2 ** this.#reconnectAttempt) * (0.5 + Math.random() * 0.5);
		this.#reconnectAttempt++;
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = undefined;
			if (this.#intentionalClose || this.#state === "incompatible") {
				return;
			}
			this.#openSocket(true).catch(() => {});
		}, delay);
	}
}
