/**
 * Pure reducer that maps RPC v3 events and history pages into the state
 * consumed by the Transcript component.
 */

import { Flag, is as hasErrorFlag } from "@oh-my-pi/pi-ai/error/flags";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { RpcSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3Event, RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { splitReaction } from "@oh-my-pi/pi-tui/chat/reaction";
import type { DeveloperMessage, ImageContent, TextContent, ToolResultMessage } from "@oh-my-pi/pi-wire";
import { fmtTokens } from "./format";
import { dataUrlToImage } from "./session-actions";

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
	epoch?: number;
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
	/** Mapping from entry.id to React key for rows born live (so keys stay `live:<epoch>:<sid>`). */
	entryKeys: ReadonlyMap<string, string>;
	/** Connection epoch, incremented on resync to prevent live stream key collisions. */
	epoch: number;
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

/** Plan approval and TTSR abort the turn as control flow; the TUI hides these (`isSilentAbort` in pi-tui). */
function isSilentAbort(message: AgentMessage): boolean {
	return (
		("errorId" in message &&
			typeof message.errorId === "number" &&
			hasErrorFlag(message.errorId, Flag.SilentAbort)) ||
		("errorMessage" in message && message.errorMessage === "__omp.silent_abort__")
	);
}

function isFailedTurn(message: AgentMessage): boolean {
	return (
		"stopReason" in message &&
		(message.stopReason === "error" || message.stopReason === "aborted") &&
		!isSilentAbort(message)
	);
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
		epoch: 0,
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
	// Saved entries keep their live-assigned React keys; drop sid-indexed live state
	const savedIds = new Set(state.entries.map(e => e.id));
	const nextEntryKeys = new Map<string, string>();
	for (const [id, key] of state.entryKeys) {
		if (savedIds.has(id)) {
			nextEntryKeys.set(id, key);
		}
	}
	return {
		...state,
		epoch: (state.epoch ?? 0) + 1,
		entryKeys: nextEntryKeys,
		live: new Map(),
		working: false,
		activeTools: new Map(),
		pendingUser: [],
	};
}

/**
 * Apply a page of history results.
 * Newest page (!opts.older) reconciles finished entries and live; older page prepends.
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
					epoch: state.epoch,
				});
			}
		}

		if (page.entries.length === 0) {
			const finalEntries = state.entries.length === 0 ? state.entries : [];
			const nextEntryKeys =
				finalEntries.length === 0 && state.entryKeys.size > 0 ? new Map<string, string>() : state.entryKeys;
			return {
				...state,
				entries: finalEntries,
				entryKeys: nextEntryKeys,
				live: nextLive,
				leafId: page.leafId,
				hasMore: page.hasMore,
				needsReload: false,
				working: state.working || nextLive.size > 0,
			};
		}

		const existingById = new Map<string, SessionEntry>();
		for (const entry of state.entries) {
			existingById.set(entry.id, entry);
		}

		const reconciledPageEntries = page.entries.map(e => existingById.get(e.id) ?? e);

		let connects = false;
		let matchIndex = -1;

		if (!state.needsReload && state.entries.length > 0) {
			const oldestPageEntry = page.entries[0];
			matchIndex = state.entries.findIndex(e => e.id === oldestPageEntry.id);
			if (matchIndex !== -1) {
				if (matchIndex === 0) {
					connects = true;
				} else {
					const precedingEntry = state.entries[matchIndex - 1];
					if (oldestPageEntry.parentId === precedingEntry.id) {
						connects = true;
					}
				}
			}
		}

		let nextEntries: readonly SessionEntry[];
		let nextHasMore: boolean;

		if (connects) {
			const olderKept = matchIndex > 0 ? state.entries.slice(0, matchIndex) : [];
			nextEntries = olderKept.length > 0 ? [...olderKept, ...reconciledPageEntries] : reconciledPageEntries;
			nextHasMore = matchIndex > 0 ? state.hasMore : page.hasMore;
		} else {
			nextEntries = reconciledPageEntries;
			nextHasMore = page.hasMore;
		}

		let finalEntries = nextEntries;
		if (nextEntries.length === state.entries.length) {
			let identical = true;
			for (let i = 0; i < nextEntries.length; i++) {
				if (nextEntries[i] !== state.entries[i]) {
					identical = false;
					break;
				}
			}
			if (identical) {
				finalEntries = state.entries;
			}
		}

		let nextEntryKeys = state.entryKeys;
		const keptIds = new Set(finalEntries.map(e => e.id));
		let hasDropped = false;
		for (const id of state.entryKeys.keys()) {
			if (!keptIds.has(id)) {
				hasDropped = true;
				break;
			}
		}
		if (hasDropped) {
			const filtered = new Map<string, string>();
			for (const [id, key] of state.entryKeys) {
				if (keptIds.has(id)) filtered.set(id, key);
			}
			nextEntryKeys = filtered;
		}

		return {
			...state,
			entries: finalEntries,
			entryKeys: nextEntryKeys,
			live: nextLive,
			leafId: page.leafId,
			hasMore: nextHasMore,
			needsReload: false,
			// A page fetched mid-tool-call has no live stream, yet the turn is
			// still running; only agent_end (or a resync) ends it.
			working: state.working || nextLive.size > 0,
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
			nextLive.set(ev.sid, { message, frozen: false, epoch: state.epoch });
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
			const current = state.live.get(ev.sid);
			nextLive.set(ev.sid, { message: ev.message, frozen: true, epoch: current?.epoch ?? state.epoch });
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
				entryKeysCopy.set(ev.entry.id, `live:${state.epoch}:${ev.sid}`);
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

		// Turns end between tool rounds while the agent keeps running;
		// agent_end is the only signal that the run is over.
		case "turn_end":
			return state;

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

// ---------------------------------------------------------------------------
// Row Items & Transcript Flattening
// ---------------------------------------------------------------------------

export interface UserItem {
	kind: "user";
	content: string | readonly (TextContent | ImageContent)[];
	timestamp: string;
	id: string;
	pending?: boolean;
	entryId?: string;
	reaction?: string;
}

export interface AssistantTextItem {
	kind: "assistant-text";
	text: string;
	id: string;
}

export interface AssistantImageItem {
	kind: "assistant-image";
	source: Record<string, unknown>;
	id: string;
}

export interface ThinkingItem {
	kind: "thinking";
	text: string;
	redacted: boolean;
	id: string;
}

export interface ToolCallItem {
	kind: "tool-call";
	toolCallId: string;
	name: string;
	args: unknown;
	intent?: string;
	result?: ToolResultMessage;
	running: boolean;
	partialResult?: unknown;
	startedAt?: number;
	id: string;
	groupCount?: number;
}

export interface DeveloperItem {
	kind: "developer";
	content: string;
	timestamp: string;
	/** Rows with a label show it instead of a content preview; unlabeled rows read "system". */
	label?: string;
	id: string;
}

export interface DividerItem {
	kind: "divider";
	label: string;
	detail?: string;
	id: string;
}

export interface MarkerItem {
	kind: "marker";
	text: string;
	id: string;
}

export interface StopItem {
	kind: "stop";
	reason: string;
	errorMessage?: string;
	id: string;
}

export interface ShimmerItem {
	kind: "shimmer";
	id: string;
}

export type RowItem =
	| UserItem
	| AssistantTextItem
	| AssistantImageItem
	| ThinkingItem
	| ToolCallItem
	| DeveloperItem
	| DividerItem
	| MarkerItem
	| StopItem
	| ShimmerItem;

interface CachedFinishedEntry {
	key: string;
	items: RowItem[];
	toolCallIds: readonly string[];
	resultsSnapshot: readonly (unknown | undefined)[];
	hadActiveTools: boolean;
	hasUserTarget: boolean;
	reaction?: string;
}

let finishedEntryCache = new WeakMap<SessionEntry, CachedFinishedEntry>();

export function resetFinishedEntryCache(): void {
	finishedEntryCache = new WeakMap<SessionEntry, CachedFinishedEntry>();
}

function flattenAssistant(
	items: RowItem[],
	msg: AgentMessage,
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
	pending: boolean,
	baseId: string,
	toolCallIds?: string[],
	hasUserTarget: boolean = false,
): string | undefined {
	const content = "content" in msg && Array.isArray(msg.content) ? msg.content : [];
	const openingTextIndex = content.findIndex(
		block =>
			block &&
			typeof block === "object" &&
			block.type === "text" &&
			typeof block.text === "string" &&
			block.text.length > 0,
	);
	let reaction: string | undefined;

	for (let i = 0; i < content.length; i++) {
		const block = content[i];
		if (!block || typeof block !== "object") continue;
		switch (block.type) {
			case "thinking":
				items.push({
					kind: "thinking",
					text: typeof block.thinking === "string" ? block.thinking : "",
					redacted: false,
					id: `${baseId}-t${i}`,
				});
				break;
			case "redactedThinking":
				items.push({ kind: "thinking", text: "", redacted: true, id: `${baseId}-rt${i}` });
				break;
			case "text": {
				const rawText = typeof block.text === "string" ? block.text : "";
				let displayText = rawText;
				if (i === openingTextIndex && hasUserTarget) {
					const split = splitReaction(rawText);
					if (split.emoji !== undefined) {
						reaction = split.emoji;
						displayText = split.body;
					} else if (split.pending && pending) {
						displayText = "";
					}
				}
				items.push({
					kind: "assistant-text",
					text: displayText,
					id: `${baseId}-txt${i}`,
				});
				break;
			}
			case "toolCall": {
				const id = typeof block.id === "string" ? block.id : "";
				const name = typeof block.name === "string" ? block.name : "";
				if (toolCallIds && id) toolCallIds.push(id);
				const act = activeTools?.get(id);
				const result = results?.get(id);
				items.push({
					kind: "tool-call",
					toolCallId: id,
					name,
					args: act?.args ?? block.arguments,
					intent: (typeof block.intent === "string" ? block.intent : undefined) ?? act?.intent,
					result,
					running: !result && (act !== undefined || pending),
					partialResult: act?.partialResult,
					startedAt: act?.startedAt,
					id: `${baseId}-tc-${id}`,
				});
				break;
			}
			case "image": {
				if ("source" in block && block.source && typeof block.source === "object") {
					items.push({
						kind: "assistant-image",
						source: block.source as Record<string, unknown>,
						id: `${baseId}-img${i}`,
					});
				}
				break;
			}
			default:
				break;
		}
	}

	const stopReason = "stopReason" in msg && typeof msg.stopReason === "string" ? msg.stopReason : undefined;
	const errorMessage = "errorMessage" in msg && typeof msg.errorMessage === "string" ? msg.errorMessage : undefined;
	if (!pending && (stopReason === "error" || stopReason === "aborted") && !isSilentAbort(msg)) {
		items.push({
			kind: "stop",
			reason: stopReason,
			errorMessage,
			id: `${baseId}-stop`,
		});
	}

	return reaction;
}

function getFinishedEntryItems(
	entry: SessionEntry,
	entryKey: string,
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
	hasUserTarget: boolean = false,
): { items: RowItem[]; reaction?: string } {
	const cached = finishedEntryCache.get(entry);
	if (cached !== undefined && cached.key === entryKey && cached.hasUserTarget === hasUserTarget) {
		if (cached.toolCallIds.length === 0) {
			return { items: cached.items, reaction: cached.reaction };
		}
		const hasActiveNow = cached.toolCallIds.some(id => activeTools.has(id));
		if (!cached.hadActiveTools && !hasActiveNow) {
			let resultsMatch = true;
			for (let i = 0; i < cached.toolCallIds.length; i++) {
				if (results.get(cached.toolCallIds[i]) !== cached.resultsSnapshot[i]) {
					resultsMatch = false;
					break;
				}
			}
			if (resultsMatch) {
				return { items: cached.items, reaction: cached.reaction };
			}
		}
	}

	const items: RowItem[] = [];
	const toolCallIds: string[] = [];
	let reaction: string | undefined;

	switch (entry.type) {
		case "message": {
			const msg = entry.message;
			switch (msg.role) {
				case "user": {
					const userContent = msg.content as string | readonly (TextContent | ImageContent)[];
					items.push({
						kind: "user",
						content: userContent,
						timestamp: entry.timestamp,
						id: entryKey,
						entryId: entry.id,
					});
					break;
				}
				case "assistant": {
					reaction = flattenAssistant(
						items,
						msg,
						results,
						activeTools,
						false,
						entryKey,
						toolCallIds,
						hasUserTarget,
					);
					break;
				}
				case "developer": {
					const devMsg = msg as DeveloperMessage;
					const devContent =
						typeof devMsg.content === "string"
							? devMsg.content
							: Array.isArray(devMsg.content)
								? devMsg.content
										.map((b: unknown) => (typeof b === "object" && b && "text" in b ? String(b.text) : ""))
										.join("")
								: "";
					items.push({
						kind: "developer",
						content: devContent,
						timestamp: entry.timestamp,
						id: entryKey,
					});
					break;
				}
			}
			break;
		}
		case "compaction": {
			items.push({
				kind: "divider",
				label: `context compacted -- ${fmtTokens(entry.tokensBefore)} tokens`,
				detail: entry.shortSummary ?? entry.summary,
				id: entryKey,
			});
			break;
		}
		case "branch_summary": {
			items.push({
				kind: "divider",
				label: "branch summary",
				detail: entry.summary,
				id: entryKey,
			});
			break;
		}
		case "model_change": {
			items.push({
				kind: "marker",
				text: `model: ${entry.model}`,
				id: entryKey,
			});
			break;
		}
		case "thinking_level_change": {
			items.push({
				kind: "marker",
				text: `thinking: ${entry.thinkingLevel ?? "off"}`,
				id: entryKey,
			});
			break;
		}
		case "ttsr_injection": {
			items.push({
				kind: "marker",
				text: `rules: ${entry.injectedRules.join(", ")}`,
				id: entryKey,
			});
			break;
		}
		case "custom_message": {
			if (entry.customType !== "ttsr-injection") break;
			const details = entry.details;
			const rules =
				details && typeof details === "object" && "rules" in details && Array.isArray(details.rules)
					? details.rules.filter((r): r is string => typeof r === "string")
					: [];
			items.push({
				kind: "developer",
				label: `rule interrupt: ${rules.join(", ")}`,
				content:
					typeof entry.content === "string"
						? entry.content
						: entry.content.map(block => (block.type === "text" ? block.text : "")).join(""),
				timestamp: entry.timestamp,
				id: entryKey,
			});
			break;
		}
	}

	const hadActiveTools = toolCallIds.some(id => activeTools.has(id));
	const resultsSnapshot = toolCallIds.map(id => results.get(id));

	finishedEntryCache.set(entry, {
		key: entryKey,
		items,
		toolCallIds,
		resultsSnapshot,
		hadActiveTools,
		hasUserTarget,
		reaction,
	});

	return { items, reaction };
}

/**
 * Coalesce consecutive todo tool calls into a single row item:
 * - Consecutive todo calls with no other visible row between them become ONE card.
 * - Thinking rows strictly between todo calls are absorbed (omitted from output).
 * - Any other row (assistant text, assistant images, non-todo tool calls, developer reminders,
 *   user messages, markers, dividers, stop, shimmer) immediately breaks the run.
 * - The coalesced row item has:
 *   - `id`: stable ID from the FIRST call in the group (scroll anchoring preserved).
 *   - `groupCount`: count of calls in the group.
 *   - tool-call fields (`toolCallId`, `args`, `result`, `running`, `partialResult`, `intent`, `startedAt`): from the LAST call.
 */
export function coalesceTodoRuns(items: readonly RowItem[]): RowItem[] {
	const out: RowItem[] = [];
	let currentTodo: ToolCallItem | null = null;
	let pendingThinking: RowItem[] = [];

	const flushGroup = () => {
		if (currentTodo !== null) {
			out.push(currentTodo);
			currentTodo = null;
		}
		if (pendingThinking.length > 0) {
			for (const t of pendingThinking) out.push(t);
			pendingThinking = [];
		}
	};

	for (const item of items) {
		if (item.kind === "tool-call" && item.name === "todo") {
			if (currentTodo === null) {
				if (pendingThinking.length > 0) {
					for (const t of pendingThinking) out.push(t);
					pendingThinking = [];
				}
				currentTodo = {
					...item,
					groupCount: 1,
				};
			} else {
				// Intermediate thinking between todo calls is absorbed
				pendingThinking = [];
				// Extend group with latest call's state, preserving first call's id
				currentTodo = {
					...item,
					id: currentTodo.id,
					groupCount: (currentTodo.groupCount ?? 1) + 1,
				};
			}
		} else if (item.kind === "thinking") {
			if (currentTodo !== null) {
				pendingThinking.push(item);
			} else {
				out.push(item);
			}
		} else {
			flushGroup();
			out.push(item);
		}
	}

	flushGroup();
	return out;
}

export function flattenEntries(
	entries: readonly SessionEntry[],
	results: ReadonlyMap<string, ToolResultMessage>,
	activeTools: ReadonlyMap<string, ActiveTool>,
	live: ReadonlyMap<number, LiveStream>,
	working: boolean,
	pendingUser: readonly PendingUserMessage[],
	entryKeys: ReadonlyMap<string, string>,
	epoch: number = 0,
): RowItem[] {
	const items: RowItem[] = [];
	const renderedToolIds = new Set<string>();
	let lastUserItemIndex = -1;
	let hasSeenAssistantSinceUser = false;

	// Finished entries (memoized by entry reference to prevent Markdown re-parsing on deltas)
	let prevEntry: SessionEntry | undefined;
	for (const entry of entries) {
		const followsInterrupt =
			entry.type === "ttsr_injection" &&
			prevEntry?.type === "custom_message" &&
			prevEntry.customType === "ttsr-injection";
		prevEntry = entry;
		// The interrupt row already names these rules; a second marker would repeat them.
		if (followsInterrupt) continue;
		const entryKey = entryKeys.get(entry.id) ?? entry.id;

		let hasUserTarget = false;
		if (entry.type === "message" && entry.message.role === "assistant") {
			if (lastUserItemIndex !== -1 && !hasSeenAssistantSinceUser) {
				hasUserTarget = true;
				hasSeenAssistantSinceUser = true;
			}
		}

		const { items: entryItems, reaction } = getFinishedEntryItems(
			entry,
			entryKey,
			results,
			activeTools,
			hasUserTarget,
		);

		if (reaction !== undefined && lastUserItemIndex !== -1) {
			const targetUser = items[lastUserItemIndex] as UserItem;
			items[lastUserItemIndex] = { ...targetUser, reaction };
		}

		for (const item of entryItems) {
			items.push(item);
			if (item.kind === "user") {
				lastUserItemIndex = items.length - 1;
				hasSeenAssistantSinceUser = false;
			}
			if (item.kind === "tool-call") {
				renderedToolIds.add(item.toolCallId);
			}
		}
	}

	// Live streams rendered below finished entries, ordered by stream id
	if (live.size > 0) {
		const sortedLive = Array.from(live.entries()).sort(([a], [b]) => a - b);
		for (const [sid, stream] of sortedLive) {
			const streamEpoch = stream.epoch ?? epoch;
			const baseId = `live:${streamEpoch}:${sid}`;
			let hasUserTarget = false;
			if (lastUserItemIndex !== -1 && !hasSeenAssistantSinceUser) {
				hasUserTarget = true;
				hasSeenAssistantSinceUser = true;
			}
			const reaction = flattenAssistant(
				items,
				stream.message,
				results,
				activeTools,
				!stream.frozen,
				baseId,
				undefined,
				hasUserTarget,
			);
			if (reaction !== undefined && lastUserItemIndex !== -1) {
				const targetUser = items[lastUserItemIndex] as UserItem;
				items[lastUserItemIndex] = { ...targetUser, reaction };
			}
		}
	}

	// Tail tools not yet incorporated in an assistant message block
	for (const item of items) {
		if (item.kind === "tool-call") renderedToolIds.add(item.toolCallId);
	}
	for (const tool of activeTools.values()) {
		if (!renderedToolIds.has(tool.toolCallId)) {
			items.push({
				kind: "tool-call",
				toolCallId: tool.toolCallId,
				name: tool.toolName,
				args: tool.args,
				intent: tool.intent,
				running: true,
				partialResult: tool.partialResult,
				startedAt: tool.startedAt,
				id: `tail-${tool.toolCallId}`,
			});
		}
	}

	for (let i = 0; i < pendingUser.length; i++) {
		const pendingItem = pendingUser[i];
		let content: string | readonly (TextContent | ImageContent)[];
		if (pendingItem.images && pendingItem.images.length > 0) {
			const parts: (TextContent | ImageContent)[] = [];
			if (pendingItem.text.length > 0) {
				parts.push({ type: "text", text: pendingItem.text });
			}
			for (const imgUrl of pendingItem.images) {
				const img = dataUrlToImage(imgUrl);
				if (img) parts.push(img);
			}
			content = parts;
		} else {
			content = pendingItem.text;
		}
		items.push({ kind: "user", content, timestamp: "", id: `pending-${i}`, pending: true });
	}

	if ((working || pendingUser.length > 0) && live.size === 0 && activeTools.size === 0) {
		items.push({ kind: "shimmer", id: "shimmer" });
	}

	return coalesceTodoRuns(items);
}

export function extractToolResults(entries: readonly SessionEntry[]): Map<string, ToolResultMessage> {
	const map = new Map<string, ToolResultMessage>();
	for (const entry of entries) {
		if (entry.type === "message" && entry.message.role === "toolResult") {
			const tr = entry.message as ToolResultMessage;
			map.set(tr.toolCallId, tr);
		}
	}
	return map;
}

export function buildTranscriptRows(state: TranscriptState, isWorking: boolean = false): RowItem[] {
	const results = extractToolResults(state.entries);
	return flattenEntries(
		state.entries,
		results,
		state.activeTools,
		state.live,
		isWorking || state.working,
		state.pendingUser,
		state.entryKeys,
		state.epoch,
	);
}
