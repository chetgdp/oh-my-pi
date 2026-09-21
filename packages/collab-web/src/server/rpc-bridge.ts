// Bridge between browser WebSocket clients and the OMP RPC agent.
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

import { resolve } from "node:path";
import { RpcClient } from "../../../coding-agent/src/modes/rpc/rpc-client";
import type { RpcSessionState } from "../../../coding-agent/src/modes/rpc/rpc-types";
import type { AgentSessionEvent } from "../../../coding-agent/src/session/agent-session-events";
import type { ModelInfo } from "../../../coding-agent/src/modes/rpc/rpc-client";
import { SessionManager } from "../../../coding-agent/src/session/session-manager";
import { loadSessionFile } from "../../../coding-agent/src/session/session-loader";
import type { ServerWebSocket } from "bun";
import type {
	ServerMessage,
	ClientMessage,
	SessionListItem,
	SessionPreviewData,
	SessionPreviewTurn,
	SessionPreviewBranch,
	WorkspaceItem,
} from "./protocol";
import { SequencedRingBuffer } from "./ring-buffer";

function extractHeader(file: { entries: unknown[] }): { id?: string; cwd?: string; title?: string } | undefined {
	const h = file.entries.find((e: unknown) => (e as Record<string, unknown>).type === "session");
	return h as { id?: string; cwd?: string; title?: string } | undefined;
}

export interface WsData {
	id: string;
}

export class RpcBridge {
	readonly #rpc: RpcClient;
	readonly #ring = new SequencedRingBuffer<ServerMessage>(5_000);
	readonly #clients = new Map<string, ServerWebSocket<WsData>>();

	#cwd: string;
	#entries: unknown[] = [];
	#state: RpcSessionState | null = null;
	#agents: unknown[] = [];
	#models: ModelInfo[] = [];
	constructor() {
		const cliPath = process.env.OMP_CLI_PATH || resolve(import.meta.dir, "../../../coding-agent/src/cli.ts");
		this.#rpc = new RpcClient({
			command: args => ["bun", cliPath, ...args.map(a => (a === "rpc" ? "rpc-ui" : a))],
			cwd: process.cwd(),
		});
		this.#cwd = process.cwd();
	}

	async start(): Promise<void> {
		this.#rpc.onSessionEvent((event: AgentSessionEvent) => {
			this.#broadcast({ type: "event", seq: 0, event });
			this.#accumulate(event);
		});

		this.#rpc.onSubagentLifecycle(payload => {
			this.#broadcast({
				type: "subagent",
				seq: 0,
				kind: "lifecycle",
				payload,
			});
		});

		this.#rpc.onSubagentProgress(payload => {
			this.#broadcast({
				type: "subagent",
				seq: 0,
				kind: "progress",
				payload,
			});
		});

		this.#rpc.onSubagentEvent(payload => {
			this.#broadcast({
				type: "subagent",
				seq: 0,
				kind: "event",
				payload,
			});
		});

		await this.#rpc.start();
		await this.#rpc.setSubagentSubscription("events");

		const [state, models] = await Promise.all([this.#rpc.getState(), this.#rpc.getAvailableModels()]);
		this.#state = state;
		this.#models = models;

		try {
			const messages = await this.#rpc.getMessages();
			this.#entries = messages.map(toSessionEntry).filter(Boolean);
		} catch {
			// Fresh session
		}
	}

	async stop(): Promise<void> {
		await this.#rpc.stop();
	}

	// -------------------------------------------------------------------------
	// WebSocket lifecycle
	// -------------------------------------------------------------------------

	registerClient(ws: ServerWebSocket<WsData>): void {
		this.#clients.set(ws.data.id, ws);
	}

	unregisterClient(ws: ServerWebSocket<WsData>): void {
		this.#clients.delete(ws.data.id);
	}

	// -------------------------------------------------------------------------
	// Inbound message dispatch
	// -------------------------------------------------------------------------

	async handleMessage(ws: ServerWebSocket<WsData>, msg: ClientMessage): Promise<void> {
		switch (msg.type) {
			case "ping":
				ws.send(JSON.stringify({ type: "pong" }));
				break;
			case "attach":
				this.#handleAttach(ws, msg.lastSeq);
				break;
			case "prompt": {
				const behavior = msg.streamingBehavior;
				if (behavior === "steer") {
					await this.#rpc.steer(msg.text);
				} else if (behavior === "followUp") {
					await this.#rpc.followUp(msg.text);
				} else {
					await this.#rpc.prompt(msg.text, msg.images as any);
				}
				break;
			}
			case "steer":
				await this.#rpc.steer(msg.text);
				break;
			case "follow_up":
				await this.#rpc.followUp(msg.text);
				break;
			case "abort":
				await this.#rpc.abort();
				break;
			case "set_model":
				await this.#rpc.setModel(msg.provider, msg.modelId);
				break;
			case "set_thinking_level":
				await this.#rpc.setThinkingLevel(msg.level as any);
				break;
			case "compact":
				await this.#rpc.compact(msg.customInstructions);
				break;
			case "ui_response":
				// Extension UI responses require RpcClient API not yet public.
				// Will be wired when RpcClient exposes onExtensionUIRequest.
				console.warn("[bridge] ui_response received but extension UI bridging not yet supported");
				break;
			case "new_session":
				await this.newSession();
				break;
			case "switch_session":
				await this.switchSession(msg.sessionPath);
				break;
			case "list_sessions": {
				const sessions = await this.listSessions({ cwd: msg.cwd, all: msg.all });
				ws.send(
					JSON.stringify({
						type: "sessions_list",
						currentCwd: this.getCwd(),
						currentSessionFile: this.getCurrentSessionFile(),
						currentSessionId: this.getCurrentSessionId(),
						sessions,
					}),
				);
				break;
			}
			case "rename_session":
				await this.renameSession(msg.sessionPath, msg.newTitle);
				break;
			case "delete_session":
				await this.deleteSession(msg.sessionPath);
				break;
		}
	}

	// -------------------------------------------------------------------------
	// Attach / replay
	// -------------------------------------------------------------------------

	#handleAttach(ws: ServerWebSocket<WsData>, lastSeq?: number): void {
		if (lastSeq != null && lastSeq > 0) {
			const missed = this.#ring.getAfter(lastSeq);
			if (missed) {
				for (const { item } of missed) {
					ws.send(JSON.stringify(item));
				}
				return;
			}
		}

		const sync: ServerMessage = {
			type: "sync",
			seq: this.#ring.currentSeq(),
			state: this.#state,
			entries: this.#entries,
			agents: this.#agents,
			models: this.#models,
		};
		ws.send(JSON.stringify(sync));
	}

	// -------------------------------------------------------------------------
	// Session Management
	// -------------------------------------------------------------------------

	getCwd(): string {
		return this.#cwd;
	}

	getCurrentSessionFile(): string | undefined {
		return this.#state?.sessionFile;
	}

	getCurrentSessionId(): string | undefined {
		return this.#state?.sessionId;
	}

	getState(): RpcSessionState | null {
		return this.#state;
	}

	async newSession(): Promise<void> {
		await this.#rpc.newSession();
		this.#entries = [];
		this.#state = await this.#rpc.getState();
		this.broadcastSync();
	}

	async switchSession(sessionPath: string): Promise<void> {
		const res = await this.#rpc.switchSession(sessionPath);
		if (res?.cancelled) {
			throw new Error("Session switch was cancelled");
		}
		try {
			const file = await loadSessionFile(sessionPath);
			const header = extractHeader(file);
			if (header?.cwd) {
				this.#cwd = header.cwd;
			}
		} catch {
			// Header inspection best-effort
		}
		try {
			const messages = await this.#rpc.getMessages();
			this.#entries = messages.map(toSessionEntry).filter(Boolean);
		} catch {
			this.#entries = [];
		}
		this.#state = await this.#rpc.getState();
		this.broadcastSync();
	}

	broadcastSync(): void {
		const sync: ServerMessage = {
			type: "sync",
			seq: this.#ring.currentSeq(),
			state: this.#state,
			entries: this.#entries,
			agents: this.#agents,
			models: this.#models,
		};
		this.#broadcast(sync);
	}

	async listSessions(options?: { cwd?: string; all?: boolean }): Promise<SessionListItem[]> {
		const all = options?.all === true;
		const targetCwd = options?.cwd || this.getCwd();
		const rawSessions = all ? await SessionManager.listAll() : await SessionManager.list(targetCwd);

		return rawSessions.map(s => ({
			id: s.id,
			path: s.path,
			cwd: s.cwd,
			title: s.title,
			created: s.created.toISOString(),
			modified: s.modified.toISOString(),
			messageCount: s.messageCount,
			size: s.size,
			firstMessage: s.firstMessage,
			status: s.status,
		}));
	}

	async renameSession(sessionPath: string, newTitle: string): Promise<void> {
		const abs = resolve(sessionPath);
		const raw = readFileSync(abs, "utf-8");
		const lines = raw.split("\n");
		let found = false;
		for (let i = 0; i < lines.length; i++) {
			if (!lines[i].trim()) continue;
			try {
				const obj = JSON.parse(lines[i]);
				if (obj.type === "header") {
					obj.title = newTitle;
					lines[i] = JSON.stringify(obj);
					found = true;
					break;
				}
			} catch {
				continue;
			}
		}
		if (!found) {
			throw new Error("No header line found in session file");
		}
		writeFileSync(abs, lines.join("\n"));
	}

	async deleteSession(sessionPath: string): Promise<void> {
		const abs = resolve(sessionPath);
		const currentFile = this.getCurrentSessionFile();
		if (currentFile && resolve(currentFile) === abs) {
			throw new Error("Cannot delete the currently active session");
		}
		unlinkSync(abs);
	}

	async previewSession(sessionPath: string): Promise<SessionPreviewData> {
		const file = await loadSessionFile(sessionPath);
		const messages: SessionPreviewTurn[] = [];

		for (const e of file.entries) {
			if (e.type === "message" && e.message) {
				const m = e.message;
				if (m.role === "user" || m.role === "assistant") {
					let text = "";
					if (typeof m.content === "string") {
						text = m.content;
					} else if (Array.isArray(m.content)) {
						text = m.content
							.map((c: unknown) => {
								if (
									typeof c === "object" &&
									c !== null &&
									"type" in c &&
									(c as { type: string }).type === "text"
								) {
									return (c as unknown as { text: string }).text;
								}
								return "";
							})
							.filter(Boolean)
							.join(" ");
					}
					messages.push({
						id: e.id,
						role: m.role,
						text,
						timestamp: e.timestamp,
					});
				}
			}
		}

		const branches: SessionPreviewBranch[] = [];
		for (const e of file.entries) {
			if (e.type === "label" && e.label) {
				branches.push({
					id: e.targetId,
					label: e.label,
					messageCount: messages.length,
				});
			}
		}

		const header = extractHeader(file);
		return {
			id: header?.id ?? "",
			path: sessionPath,
			cwd: header?.cwd ?? "",
			title: header?.title,
			messageCount: file.entries.length,
			messages,
			branches: branches.length > 0 ? branches : undefined,
		};
	}

	async listWorkspaces(): Promise<WorkspaceItem[]> {
		const all = await SessionManager.listAll();
		const map = new Map<string, WorkspaceItem>();
		for (const s of all) {
			const cwd = s.cwd || "unknown";
			const existing = map.get(cwd);
			const modIso = s.modified.toISOString();
			if (!existing) {
				map.set(cwd, {
					cwd,
					name: cwd.split("/").filter(Boolean).pop() ?? cwd,
					sessionCount: 1,
					lastModified: modIso,
				});
			} else {
				existing.sessionCount++;
				if (modIso > existing.lastModified) {
					existing.lastModified = modIso;
				}
			}
		}
		return Array.from(map.values()).sort((a, b) => b.lastModified.localeCompare(a.lastModified));
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	#accumulate(event: AgentSessionEvent): void {
		if (event.type === "model_changed" || event.type === "thinking_level_changed") {
			void this.#rpc.getState().then(s => {
				this.#state = s;
				this.#broadcast({ type: "state", seq: 0, state: s });
			});
		}

		if (event.type === "agent_start") {
			if (this.#state) {
				this.#state = { ...this.#state, isStreaming: true };
				this.#broadcast({ type: "state", seq: 0, state: this.#state });
			}
		} else if (event.type === "agent_end" || event.type === "turn_end") {
			if (this.#state) {
				this.#state = { ...this.#state, isStreaming: false };
				this.#broadcast({ type: "state", seq: 0, state: this.#state });
			}
			void this.#rpc.getState().then(s => {
				this.#state = s;
				this.#broadcast({ type: "state", seq: 0, state: s });
			});
		}

		if (event.type === "message_end") {
			const entry = toSessionEntry(event.message);
			if (entry) {
				this.#entries.push(entry);
				this.#broadcast({ type: "entry", seq: 0, entry });
			}
		} else if (event.type === "tool_execution_end") {
			const rawResult = event.result as Record<string, unknown> | string | undefined;
			const toolContent =
				typeof rawResult === "string"
					? [{ type: "text", text: rawResult }]
					: Array.isArray((rawResult as { content?: unknown[] })?.content)
						? (rawResult as { content: unknown[] }).content
						: [{ type: "text", text: JSON.stringify(rawResult ?? "") }];
			const toolMsg = {
				role: "toolResult",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				content: toolContent,
				isError: event.isError ?? false,
				timestamp: Date.now(),
			};
			const entry = {
				type: "message",
				id: crypto.randomUUID(),
				parentId: null,
				timestamp: new Date().toISOString(),
				message: toolMsg,
			};
			this.#entries.push(entry);
			this.#broadcast({ type: "entry", seq: 0, entry });
		}
	}

	#broadcast(msg: ServerMessage): void {
		const seq = this.#ring.push(msg);
		const stamped = { ...msg, seq };
		const payload = JSON.stringify(stamped);
		for (const ws of this.#clients.values()) {
			ws.send(payload);
		}
	}
}

function toSessionEntry(raw: unknown): Record<string, unknown> | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (r.type === "message" || r.type === "custom_message" || r.type === "compaction") {
		return r;
	}
	const id = typeof r.id === "string" ? r.id : crypto.randomUUID();
	r.id = id;
	const timestamp =
		typeof r.timestamp === "number" || typeof r.timestamp === "string"
			? new Date(r.timestamp).toISOString()
			: new Date().toISOString();
	if (r.role === "custom") {
		return {
			type: "custom_message",
			id,
			parentId: null,
			timestamp,
			customType: typeof r.customType === "string" ? r.customType : "custom",
			content: r.content ?? "",
			display: typeof r.display === "boolean" ? r.display : true,
			details: r.details,
		};
	}
	if (typeof r.role === "string") {
		return {
			type: "message",
			id,
			parentId: null,
			timestamp,
			message: r,
		};
	}
	return null;
}
