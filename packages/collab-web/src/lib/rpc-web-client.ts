/**
 * Direct RPC WebSocket client for the OMP web GUI server.
 *
 * Connects to ws://<host>/ws and translates server messages into
 * an immutable GuestSnapshot compatible with useSyncExternalStore.
 * Unlike the collab GuestClient, this talks to a local daemon
 * running OMP in RPC mode - no relay, no encryption, no peer IDs.
 */

import type {
	AgentEvent,
	AgentSnapshot,
	AssistantMessage,
	CollabUiRequest,
	SessionEntry,
	SessionState,
	SubagentLifecyclePayload,
	SubagentProgressPayload,
	WireModel,
} from "@oh-my-pi/pi-wire";
import type { ActiveTool, GuestSnapshot, Notice, TranscriptResult } from "./client";
import type { SessionClient } from "./session-client";
import type { SessionsResponse, SessionPreviewData, WorkspaceItem } from "../server/protocol";
// -- Server message shapes (RPC wire, not collab frames) --

interface SyncMessage {
	type: "sync";
	seq: number;
	state: SessionState | null;
	entries: SessionEntry[];
	agents: AgentSnapshot[];
	models?: WireModel[];
	uiRequest?: CollabUiRequest;
}

interface EventMessage {
	type: "event";
	seq: number;
	event: AgentEvent;
}

interface EntryMessage {
	type: "entry";
	seq: number;
	entry: SessionEntry;
}

interface UiRequestMessage {
	type: "ui_request";
	seq: number;
	request: CollabUiRequest;
}

interface UiRequestEndMessage {
	type: "ui_request_end";
	seq: number;
	id: string;
}

interface SubagentMessage {
	type: "subagent";
	seq: number;
	kind: "lifecycle" | "progress" | "event";
	payload: any;
}

interface StateMessage {
	type: "state";
	seq: number;
	state: SessionState;
}

type ServerMessage =
	| SyncMessage
	| EventMessage
	| EntryMessage
	| UiRequestMessage
	| UiRequestEndMessage
	| SubagentMessage
	| StateMessage;

// -- Reconnect backoff --

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;
const BACKOFF_FACTOR = 2;

export class RpcWebClient implements SessionClient {
	readonly #wsUrl: string;
	readonly #listeners = new Set<() => void>();

	#ws: WebSocket | null = null;
	#lastSeq = 0;
	#reconnectAttempt = 0;
	#reconnectTimer: number | Timer | null = null;
	#pingTimer: number | Timer | null = null;
	#closed = false;
	// Snapshot fields
	#phase: GuestSnapshot["phase"] = "connecting";
	#entries: SessionEntry[] = [];
	#state: SessionState | null = null;
	#agents: readonly AgentSnapshot[] = [];
	#progress = new Map<string, SubagentProgressPayload>();
	#lifecycle = new Map<string, SubagentLifecyclePayload>();
	#stream: AssistantMessage | null = null;
	#streamDone = false;
	#activeTools = new Map<string, ActiveTool>();
	#working = false;
	#uiRequest: CollabUiRequest | null = null;
	#notices: Notice[] = [];
	#noticeId = 0;
	#snapshot: GuestSnapshot;

	// RPC-specific state
	#models: WireModel[] = [];

	constructor(wsUrl: string) {
		this.#wsUrl = wsUrl;
		this.#snapshot = this.#buildSnapshot();
		this.#connect();
	}

	// -- useSyncExternalStore contract --

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	getSnapshot(): GuestSnapshot {
		return this.#snapshot;
	}

	// -- Public accessors for RPC-specific state --

	getModels(): readonly WireModel[] {
		return this.#models;
	}

	// -- Command methods --

	sendPrompt(text: string, images?: unknown[]): void {
		const optimisticEntry: SessionEntry = {
			type: "message",
			id: `optimistic-${Date.now()}`,
			parentId: null,
			timestamp: new Date().toISOString(),
			message: {
				role: "user",
				content: [{ type: "text", text }],
				timestamp: Date.now(),
			},
		};
		this.#entries = [...this.#entries, optimisticEntry];
		this.#working = true;
		this.#commit();
		this.#send({ type: "prompt", text, images });
	}

	sendSteer(text: string): void {
		this.#send({ type: "steer", text });
	}

	sendFollowUp(text: string): void {
		this.#send({ type: "follow_up", text });
	}

	sendAbort(): void {
		this.#send({ type: "abort" });
	}

	sendUiResponse(reqId: number, value?: any): void {
		this.#send({
			type: "ui_response",
			id: String(reqId),
			response: value,
		});
		if (this.#uiRequest?.reqId === reqId) {
			this.#uiRequest = null;
			this.#commit();
		}
	}

	sendAgentCmd(_cmd: "chat" | "kill" | "revive", _agentId: string, _text?: string): void {
		// RPC server does not support agent commands yet; no-op
	}
	setModel(provider: string, modelId: string): void {
		this.#send({ type: "set_model", provider, modelId });
	}

	setThinkingLevel(level: string): void {
		this.#send({ type: "set_thinking_level", level });
	}

	compact(): void {
		this.#send({ type: "compact" });
	}

	fetchTranscript(_agentId: string, _fromByte: number): Promise<TranscriptResult | null> {
		// RPC mode does not support transcript fetch yet
		return Promise.resolve(null);
	}

	// -- Session Management --

	newSession(): void {
		this.#send({ type: "new_session" });
		this.#pushNotice("info", "Creating new session…");
	}

	switchSession(sessionPath: string): void {
		this.#send({ type: "switch_session", sessionPath });
		this.#pushNotice("info", "Switching session…");
	}

	async listSessions(options?: { cwd?: string; all?: boolean }): Promise<SessionsResponse> {
		const base = this.#httpOrigin();
		const params = new URLSearchParams();
		if (options?.all) params.set("all", "true");
		if (options?.cwd) params.set("cwd", options.cwd);
		const qs = params.toString() ? `?${params.toString()}` : "";
		const res = await fetch(`${base}/api/sessions${qs}`);
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as {
				error?: string;
			};
			throw new Error(err.error || `Failed to list sessions: ${res.statusText}`);
		}
		return res.json() as Promise<SessionsResponse>;
	}

	async previewSession(sessionPath: string): Promise<SessionPreviewData> {
		const base = this.#httpOrigin();
		const res = await fetch(`${base}/api/sessions/preview?path=${encodeURIComponent(sessionPath)}`);
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as {
				error?: string;
			};
			throw new Error(err.error || `Failed to preview session: ${res.statusText}`);
		}
		return res.json() as Promise<SessionPreviewData>;
	}

	async listWorkspaces(): Promise<{
		currentCwd: string;
		workspaces: WorkspaceItem[];
	}> {
		const base = this.#httpOrigin();
		const res = await fetch(`${base}/api/workspaces`);
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as {
				error?: string;
			};
			throw new Error(err.error || `Failed to list workspaces: ${res.statusText}`);
		}
		return res.json() as Promise<{
			currentCwd: string;
			workspaces: WorkspaceItem[];
		}>;
	}

	async renameSession(sessionPath: string, newTitle: string): Promise<void> {
		const base = this.#httpOrigin();
		const res = await fetch(`${base}/api/sessions/rename`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ sessionPath, newTitle }),
		});
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(err.error || `Failed to rename session: ${res.statusText}`);
		}
	}

	async deleteSession(sessionPath: string): Promise<void> {
		const base = this.#httpOrigin();
		const res = await fetch(`${base}/api/sessions/delete`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ sessionPath }),
		});
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(err.error || `Failed to delete session: ${res.statusText}`);
		}
	}

	#httpOrigin(): string {
		try {
			const url = new URL(this.#wsUrl);
			const proto = url.protocol === "wss:" ? "https:" : "http:";
			return `${proto}//${url.host}`;
		} catch {
			return "";
		}
	}

	close(): void {
		this.#closed = true;
		clearTimeout(this.#reconnectTimer);
		this.#reconnectTimer = null;
		clearInterval(this.#pingTimer);
		this.#pingTimer = null;
		this.#ws?.close();
		this.#ws = null;
	}

	// -- Internal --

	#connect(): void {
		if (this.#closed) return;
		const ws = new WebSocket(this.#wsUrl);
		this.#ws = ws;

		ws.onopen = () => {
			this.#reconnectAttempt = 0;
			this.#send({ type: "attach", lastSeq: this.#lastSeq });
			this.#phase = "live";
			this.#commit();
			clearInterval(this.#pingTimer);
			this.#pingTimer = setInterval(() => {
				if (this.#ws?.readyState === WebSocket.OPEN) {
					this.#send({ type: "ping" });
				}
			}, 10_000);
		};

		ws.onmessage = ev => {
			if (typeof ev.data !== "string") return;
			let msg: ServerMessage;
			try {
				msg = JSON.parse(ev.data);
			} catch {
				return;
			}
			this.#handleMessage(msg);
		};

		ws.onclose = () => {
			clearInterval(this.#pingTimer);
			this.#pingTimer = null;
			if (this.#closed) return;
			this.#phase = "reconnecting";
			this.#commit();
			this.#scheduleReconnect();
		};
		ws.onerror = () => {
			// onclose fires after onerror; reconnect handled there
		};
	}

	#scheduleReconnect(): void {
		if (this.#closed) return;
		const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * BACKOFF_FACTOR ** this.#reconnectAttempt);
		this.#reconnectAttempt++;
		this.#reconnectTimer = setTimeout(() => {
			this.#reconnectTimer = null;
			this.#connect();
		}, delay);
	}

	#send(msg: Record<string, unknown>): void {
		if (this.#ws?.readyState === WebSocket.OPEN) {
			this.#ws.send(JSON.stringify(msg));
		}
	}

	#handleMessage(msg: ServerMessage): void {
		if ("seq" in msg && typeof msg.seq === "number") {
			this.#lastSeq = msg.seq;
		}

		switch (msg.type) {
			case "sync":
				this.#handleSync(msg);
				break;
			case "event":
				this.#handleEvent(msg.event);
				break;
			case "entry":
				this.#handleEntry(msg.entry);
				break;
			case "ui_request":
				this.#uiRequest = msg.request;
				this.#commit();
				break;
			case "ui_request_end":
				if (this.#uiRequest && String(this.#uiRequest.reqId) === msg.id) {
					this.#uiRequest = null;
					this.#commit();
				}
				break;
			case "subagent":
				this.#handleSubagent(msg);
				break;
			case "state":
				this.#state = msg.state;
				this.#working = msg.state.isStreaming || this.#activeTools.size > 0;
				this.#commit();
				break;
		}
	}

	#handleSync(msg: SyncMessage): void {
		this.#entries = msg.entries ?? [];
		this.#state = msg.state;
		this.#agents = msg.agents ?? [];
		if (msg.models) this.#models = msg.models;
		this.#uiRequest = msg.uiRequest ?? null;
		this.#stream = null;
		this.#streamDone = false;
		this.#activeTools = new Map();
		this.#working = msg.state?.isStreaming ?? false;
		this.#phase = "live";
		this.#commit();
	}

	#handleEvent(event: AgentEvent): void {
		switch (event.type) {
			case "message_start":
			case "message_update":
				if (event.message.role === "assistant") {
					this.#stream = event.message as AssistantMessage;
					this.#streamDone = false;
				}
				break;
			case "message_end":
				if (event.message.role === "assistant") {
					this.#stream = event.message as AssistantMessage;
					this.#streamDone = true;
				}
				break;
			case "tool_execution_start": {
				const tools = new Map(this.#activeTools);
				tools.set(event.toolCallId, {
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					args: event.args,
					intent: event.intent,
					startedAt: Date.now(),
				});
				this.#activeTools = tools;
				break;
			}
			case "tool_execution_update": {
				const tools = new Map(this.#activeTools);
				const existing = tools.get(event.toolCallId);
				if (existing) {
					tools.set(event.toolCallId, {
						...existing,
						partialResult: event.partialResult,
					});
					this.#activeTools = tools;
				}
				break;
			}
			case "tool_execution_end": {
				const tools = new Map(this.#activeTools);
				tools.delete(event.toolCallId);
				this.#activeTools = tools;
				break;
			}
			case "agent_start":
				this.#working = true;
				break;
			case "turn_end":
				this.#stream = null;
				this.#streamDone = false;
				break;
			case "agent_end":
				this.#working = false;
				this.#stream = null;
				this.#streamDone = false;
				this.#activeTools = new Map();
				break;
			default:
				break;
		}
		this.#commit();
	}

	#handleEntry(entry: SessionEntry): void {
		if (entry.type === "message" && entry.message.role === "user") {
			const optIdx = this.#entries.findIndex(
				e => "id" in e && typeof e.id === "string" && e.id.startsWith("optimistic-"),
			);
			if (optIdx >= 0) {
				this.#entries = [...this.#entries.slice(0, optIdx), entry, ...this.#entries.slice(optIdx + 1)];
				this.#commit();
				return;
			}
		}

		const idx = this.#entries.findIndex(e => "id" in e && "id" in entry && e.id === entry.id);
		if (idx >= 0) {
			this.#entries = [...this.#entries.slice(0, idx), entry, ...this.#entries.slice(idx + 1)];
		} else {
			this.#entries = [...this.#entries, entry];
		}

		if (entry.type === "message" && entry.message.role === "assistant") {
			this.#stream = null;
			this.#streamDone = false;
		}
		this.#commit();
	}

	#handleSubagent(msg: SubagentMessage): void {
		switch (msg.kind) {
			case "progress": {
				const next = new Map(this.#progress);
				const p = msg.payload as SubagentProgressPayload;
				next.set(p.progress.id, p);
				this.#progress = next;
				break;
			}
			case "lifecycle": {
				const next = new Map(this.#lifecycle);
				const l = msg.payload as SubagentLifecyclePayload;
				next.set(l.id, l);
				this.#lifecycle = next;
				break;
			}
			case "event":
				// Subagent events update the agents list if payload has it
				if (msg.payload?.agents) {
					this.#agents = msg.payload.agents;
				}
				break;
		}
		this.#commit();
	}

	#buildSnapshot(): GuestSnapshot {
		return {
			phase: this.#phase,
			endedReason: null,
			header: null,
			entries: this.#entries,
			state: this.#state,
			agents: this.#agents,
			progress: this.#progress,
			lifecycle: this.#lifecycle,
			stream: this.#stream,
			streamDone: this.#streamDone,
			activeTools: this.#activeTools,
			working: this.#working,
			readOnly: false,
			uiRequest: this.#uiRequest,
			notices: this.#notices,
		};
	}

	#pushNotice(level: Notice["level"], message: string): void {
		this.#notices = [...this.#notices.slice(-49), { id: ++this.#noticeId, level, message, at: Date.now() }];
	}

	#commit(): void {
		this.#snapshot = this.#buildSnapshot();
		for (const l of this.#listeners) l();
	}
}
