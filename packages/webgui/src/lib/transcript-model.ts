/**
 * Pure reducer that maps RPC v3 events and history pages into the state
 * consumed by the Transcript component.
 */

import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { RpcSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3Event, RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";

export interface ActiveTool {
	toolCallId: string;
	toolName: string;
	args: unknown;
	intent?: string;
	partialResult?: unknown;
	startedAt: number;
}

export interface LiveStream {
	message: AgentMessage;
	frozen: boolean;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface PendingUserMessage {
	readonly text: string;
	readonly images?: readonly string[];
}

export interface TranscriptState {
	/** Finished entries on the current branch (oldest-first). */
	entries: readonly SessionEntry[];
	/** Live streams keyed by sid (stream ID). */
	live: ReadonlyMap<number, LiveStream>;
	/** Currently executing tools keyed by toolCallId. */
	activeTools: ReadonlyMap<string, ActiveTool>;
	/** Whether the agent is actively working. */
	working: boolean;
	/** Messages the user submitted that the session has not echoed back yet. */
	pendingUser: readonly PendingUserMessage[];
	/** Whether the current branch changed or needs a full reload from the server. */
	needsReload: boolean;
	/** Whether older history entries exist on this branch. */
	hasMore: boolean;
	/** Current leaf entry ID on this branch. */
	leafId: string | null;
	/** Mapping from entry.id to React key for rows born live (so keys stay `live:<sid>`). */
	entryKeys: ReadonlyMap<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMessageText(message: AgentMessage): string {
	if (typeof message !== "object" || message === null) return "";
	if ("content" in message) {
		const content = message.content;
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			const texts: string[] = [];
			for (const block of content) {
				if (typeof block === "object" && block !== null && "type" in block) {
					if (block.type === "text" && "text" in block && typeof block.text === "string") {
						texts.push(block.text);
					}
				}
			}
			return texts.join("\n");
		}
	}
	return "";
}

function getBlocks(message: AgentMessage): unknown[] {
	if (typeof message === "object" && message !== null && "content" in message && Array.isArray(message.content)) {
		return [...message.content];
	}
	return [];
}

function withBlocks(message: AgentMessage, content: unknown[]): AgentMessage {
	return {
		...message,
		content,
	} as AgentMessage;
}

function isFailedTurn(message: AgentMessage): boolean {
	return "stopReason" in message && (message.stopReason === "error" || message.stopReason === "aborted");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function emptyTranscriptState(): TranscriptState {
	return {
		entries: [],
		live: new Map(),
		activeTools: new Map(),
		working: false,
		pendingUser: [],
		needsReload: false,
		hasMore: false,
		leafId: null,
		entryKeys: new Map(),
	};
}

export function oldestEntryId(state: TranscriptState): string | undefined {
	return state.entries.length > 0 ? state.entries[0].id : undefined;
}

export function currentLeafId(state: TranscriptState): string | null | undefined {
	return state.leafId;
}

export function addPendingUser(
	state: TranscriptState,
	itemOrText: string | PendingUserMessage,
	images?: readonly string[],
): TranscriptState {
	const item: PendingUserMessage =
		typeof itemOrText === "string"
			? { text: itemOrText, ...(images && images.length > 0 ? { images } : {}) }
			: itemOrText;
	return { ...state, pendingUser: [...state.pendingUser, item] };
}

export function clearPendingUser(state: TranscriptState): TranscriptState {
	if (state.pendingUser.length === 0) return state;
	return { ...state, pendingUser: state.pendingUser.slice(1) };
}

export function clearAllPendingUser(state: TranscriptState): TranscriptState {
	if (state.pendingUser.length === 0) return state;
	return { ...state, pendingUser: [] };
}

export function resetTranscriptForResync(state: TranscriptState): TranscriptState {
	return {
		...state,
		entryKeys: new Map(),
		working: false,
		activeTools: new Map(),
		pendingUser: [],
	};
}

/**
 * Apply a page of history results.
 * Newest page (!opts.older) replaces finished entries and live; older page prepends.
 */
export function applyHistoryPage(
	state: TranscriptState,
	page: RpcV3HistoryResult,
	opts: { older: boolean },
): TranscriptState {
	if (!opts.older) {
		const nextLive = new Map<number, LiveStream>();
		if (page.live) {
			for (const item of page.live) {
				nextLive.set(item.sid, {
					message: item.message,
					frozen: false,
				});
			}
		}
		return {
			...state,
			entries: [...page.entries],
			live: nextLive,
			leafId: page.leafId,
			hasMore: page.hasMore,
			needsReload: false,
			working: nextLive.size > 0,
		};
	}

	if (page.entries.length === 0) {
		return {
			...state,
			hasMore: page.hasMore,
		};
	}

	const existingIds = new Set(state.entries.map(e => e.id));
	const olderEntries = page.entries.filter(e => !existingIds.has(e.id));

	return {
		...state,
		entries: [...olderEntries, ...state.entries],
		hasMore: page.hasMore,
	};
}

/**
 * Immutable reducer: apply one RPC v3 protocol event to the transcript state.
 */
export function applyV3Event(state: TranscriptState, ev: RpcV3Event): TranscriptState {
	switch (ev.type) {
		case "msg_start": {
			if (ev.message.role !== "assistant") {
				return state;
			}
			// A retained failed row is superseded once the next turn starts streaming.
			const nextLive = new Map<number, LiveStream>();
			for (const [sid, stream] of state.live) {
				if (!(stream.frozen && isFailedTurn(stream.message))) nextLive.set(sid, stream);
			}
			const content = getBlocks(ev.message);
			const message = withBlocks(ev.message, content);
			nextLive.set(ev.sid, { message, frozen: false });
			return { ...state, live: nextLive, working: true };
		}

		case "block_start": {
			const current = state.live.get(ev.sid);
			if (!current) return state;

			let blockContent: unknown;
			switch (ev.start.type) {
				case "text":
					blockContent = { type: "text", text: "" };
					break;
				case "thinking":
					blockContent = { type: "thinking", thinking: "" };
					break;
				case "redactedThinking":
					blockContent = { type: "redactedThinking", data: ev.start.data };
					break;
				case "toolCall":
					blockContent = {
						type: "toolCall",
						id: ev.start.id,
						name: ev.start.name,
						arguments: {},
					};
					break;
				default:
					return state;
			}

			const content = getBlocks(current.message);
			// A stream adopted mid-block (attach, history live) already holds the
			// block's accumulated content; resetting it would drop that prefix.
			const existing = content[ev.block];
			if (
				typeof existing === "object" &&
				existing !== null &&
				"type" in existing &&
				existing.type === ev.start.type
			) {
				return state;
			}
			if (ev.block < content.length) {
				content[ev.block] = blockContent;
			} else {
				while (content.length < ev.block) {
					content.push(null);
				}
				content.push(blockContent);
			}

			const nextMsg = withBlocks(current.message, content);
			const nextLive = new Map(state.live);
			nextLive.set(ev.sid, { ...current, message: nextMsg });
			return { ...state, live: nextLive };
		}

		case "delta": {
			const current = state.live.get(ev.sid);
			if (!current) return state;

			const content = getBlocks(current.message);
			if (ev.block < 0 || ev.block >= content.length) {
				return state;
			}

			const targetBlock = content[ev.block];
			if (typeof targetBlock !== "object" || targetBlock === null) {
				return state;
			}

			let updatedBlock: Record<string, unknown>;
			if (
				"type" in targetBlock &&
				targetBlock.type === "text" &&
				"text" in targetBlock &&
				typeof targetBlock.text === "string"
			) {
				updatedBlock = { ...targetBlock, text: targetBlock.text + ev.text };
			} else if (
				"type" in targetBlock &&
				targetBlock.type === "thinking" &&
				"thinking" in targetBlock &&
				typeof targetBlock.thinking === "string"
			) {
				updatedBlock = { ...targetBlock, thinking: targetBlock.thinking + ev.text };
			} else {
				return state;
			}

			content[ev.block] = updatedBlock;
			const nextMsg = withBlocks(current.message, content);
			const nextLive = new Map(state.live);
			nextLive.set(ev.sid, { ...current, message: nextMsg });
			return { ...state, live: nextLive };
		}

		case "block_end": {
			const current = state.live.get(ev.sid);
			if (!current) return state;

			const content = getBlocks(current.message);
			if (ev.block < content.length) {
				content[ev.block] = ev.content;
			} else {
				while (content.length < ev.block) {
					content.push(null);
				}
				content.push(ev.content);
			}

			const nextMsg = withBlocks(current.message, content);
			const nextLive = new Map(state.live);
			nextLive.set(ev.sid, { ...current, message: nextMsg });
			return { ...state, live: nextLive };
		}

		case "msg_end": {
			if (ev.message.role !== "assistant") {
				return state;
			}
			const nextLive = new Map(state.live);
			nextLive.set(ev.sid, { message: ev.message, frozen: true });
			return { ...state, live: nextLive };
		}

		case "entry": {
			const entryExists = state.entries.some(e => e.id === ev.entry.id);
			const entries = entryExists ? state.entries : [...state.entries, ev.entry];

			let nextLive = state.live;
			let nextEntryKeys = state.entryKeys;
			if (ev.sid !== undefined) {
				if (state.live.has(ev.sid)) {
					const liveCopy = new Map(state.live);
					liveCopy.delete(ev.sid);
					nextLive = liveCopy;
				}
				const entryKeysCopy = new Map(state.entryKeys);
				entryKeysCopy.set(ev.entry.id, `live:${ev.sid}`);
				nextEntryKeys = entryKeysCopy;
			}
			let nextPending = state.pendingUser;
			if (ev.entry.type === "message") {
				const msg = ev.entry.message;
				if (msg.role === "user" && state.pendingUser.length > 0) {
					const entryText = extractMessageText(msg).trim();
					const matchIdx = state.pendingUser.findIndex(item => item.text.trim() === entryText);
					if (matchIdx >= 0) {
						nextPending = [...state.pendingUser.slice(0, matchIdx), ...state.pendingUser.slice(matchIdx + 1)];
					} else {
						// Slash command expansions or rewritten text won't match verbatim; remove oldest
						nextPending = state.pendingUser.slice(1);
					}
				}
			}

			let nextActiveTools = state.activeTools;
			if (ev.entry.type === "message") {
				const msg = ev.entry.message;
				if (
					msg.role === "toolResult" &&
					"toolCallId" in msg &&
					typeof msg.toolCallId === "string" &&
					state.activeTools.has(msg.toolCallId)
				) {
					const activeToolsCopy = new Map(state.activeTools);
					activeToolsCopy.delete(msg.toolCallId);
					nextActiveTools = activeToolsCopy;
				}
			}

			return {
				...state,
				entries,
				live: nextLive,
				entryKeys: nextEntryKeys,
				pendingUser: nextPending,
				activeTools: nextActiveTools,
				leafId: ev.entry.id,
			};
		}

		case "branch": {
			// Keep current rows until the newest page replaces them so the
			// transcript never flashes empty (compaction appends to the same path).
			return {
				...state,
				leafId: ev.leafId,
				needsReload: true,
			};
		}

		case "tool_output": {
			const toolResultExists = state.entries.some(e => {
				if (e.type === "message" && e.message.role === "toolResult") {
					return "toolCallId" in e.message && e.message.toolCallId === ev.toolCallId;
				}
				return false;
			});
			if (toolResultExists) return state;

			const nextActiveTools = new Map(state.activeTools);
			const prev = nextActiveTools.get(ev.toolCallId);
			if (prev) {
				const prevText = typeof prev.partialResult === "string" ? prev.partialResult : "";
				nextActiveTools.set(ev.toolCallId, {
					...prev,
					partialResult: ev.replace ? ev.text : prevText + ev.text,
				});
			} else {
				nextActiveTools.set(ev.toolCallId, {
					toolCallId: ev.toolCallId,
					toolName: "",
					args: undefined,
					partialResult: ev.text,
					startedAt: Date.now(),
				});
			}
			return { ...state, activeTools: nextActiveTools };
		}

		default:
			return state;
	}
}

/**
 * Common event router handling both v3 protocol events and remaining
 * ambient lifecycle/tool frames.
 */
export function applyTranscriptEvent(state: TranscriptState, event: RpcSessionEventFrame): TranscriptState {
	switch (event.type) {
		case "msg_start":
		case "block_start":
		case "delta":
		case "block_end":
		case "msg_end":
		case "entry":
		case "branch":
		case "tool_output":
			return applyV3Event(state, event);

		case "agent_start":
			return { ...state, working: true };

		case "agent_end": {
			let nextLive = state.live;
			if (state.live.size > 0) {
				const filtered = new Map<number, LiveStream>();
				for (const [sid, stream] of state.live) {
					// Unsaved failed turns never produce an entry; keep them visible.
					if (!stream.frozen || isFailedTurn(stream.message)) {
						filtered.set(sid, stream);
					}
				}
				if (filtered.size !== state.live.size) {
					nextLive = filtered;
				}
			}
			return { ...state, live: nextLive, working: false };
		}

		case "turn_start":
			return state;

		case "turn_end":
			return { ...state, working: false };

		case "tool_execution_start": {
			if (
				!("toolCallId" in event) ||
				typeof event.toolCallId !== "string" ||
				!("toolName" in event) ||
				typeof event.toolName !== "string"
			) {
				return state;
			}
			const toolCallId = event.toolCallId;
			const toolName = event.toolName;
			const args = "args" in event ? event.args : undefined;
			const intent = "intent" in event && typeof event.intent === "string" ? event.intent : undefined;
			const next = new Map(state.activeTools);
			const existing = next.get(toolCallId);
			next.set(toolCallId, {
				toolCallId,
				toolName,
				args,
				intent,
				partialResult: existing?.partialResult,
				startedAt: existing?.startedAt ?? Date.now(),
			});
			return { ...state, activeTools: next };
		}

		case "tool_execution_end": {
			if (!("toolCallId" in event) || typeof event.toolCallId !== "string") {
				return state;
			}
			if (!state.activeTools.has(event.toolCallId)) return state;
			const next = new Map(state.activeTools);
			next.delete(event.toolCallId);
			return { ...state, activeTools: next };
		}

		case "command_output": {
			if (!("text" in event) || typeof event.text !== "string") return state;
			const text = event.text;
			const id = `cmd-out-${state.entries.length}-${Date.now()}`;
			const entry: SessionEntry = {
				id,
				parentId: state.leafId ?? null,
				timestamp: new Date().toISOString(),
				type: "message",
				message: {
					role: "developer",
					content: text,
					timestamp: Date.now(),
				} as AgentMessage,
			} as SessionEntry;
			return {
				...state,
				entries: [...state.entries, entry],
				pendingUser: state.pendingUser.length > 0 ? state.pendingUser.slice(1) : state.pendingUser,
			};
		}

		case "prompt_result": {
			if ("agentInvoked" in event && event.agentInvoked === false && state.pendingUser.length > 0) {
				return { ...state, pendingUser: state.pendingUser.slice(1) };
			}
			return state;
		}

		default:
			return state;
	}
}
