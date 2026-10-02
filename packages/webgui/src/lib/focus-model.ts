/**
 * Pure model for the focused-agent view (TUI `SessionFocusController` parity).
 *
 * Finished entries come from the host's transcript-file cursor
 * (`get_subagent_messages`); the in-flight assistant message and running tools
 * come from `subagent_event` frames, which carry raw agent-session events
 * rather than the v3 stream the main session uses.
 */
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type {
	RpcSubagentInflightSnapshot,
	RpcSubagentMessagesResult,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session-events";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { applyTranscriptChunk, emptyHubTranscript, type HubTranscriptState, MAIN_AGENT_ID } from "./agent-hub-model";
import {
	applyTranscriptEvent,
	applyV3Event,
	emptyTranscriptState,
	type LiveStream,
	type TranscriptState,
} from "./transcript-model";

export interface FocusState {
	readonly agentId: string;
	/** Monotonic focus-request id: a request that resolves after a newer one is dropped. */
	readonly seq: number;
	readonly cursor: HubTranscriptState;
	readonly transcript: TranscriptState;
	/** True once the first transcript chunk arrived. */
	readonly loaded: boolean;
	/** Stream ids for live messages; synthesized because raw events carry none. */
	readonly nextSid: number;
}

export function startFocus(agentId: string, seq: number, running: boolean): FocusState {
	return {
		agentId,
		seq,
		cursor: emptyHubTranscript(agentId),
		transcript: { ...emptyTranscriptState(), working: running },
		loaded: false,
		nextSid: 1,
	};
}

/** Restart the cursor after a reconnect while keeping the rendered transcript until the replacement lands. */
export function resetFocusCursor(state: FocusState): FocusState {
	return { ...state, cursor: emptyHubTranscript(state.agentId) };
}

function fieldOf(value: unknown, key: string): unknown {
	if (typeof value !== "object" || value === null || !(key in value)) return undefined;
	const record: Record<string, unknown> = { ...value };
	return record[key];
}

/** Joined text blocks of a message or tool-result content value. */
function textOf(content: unknown, separator: string): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		const text = fieldOf(block, "text");
		if (fieldOf(block, "type") === "text" && typeof text === "string") parts.push(text);
	}
	return parts.join(separator);
}

function messageText(message: AgentMessage): string {
	return textOf(fieldOf(message, "content"), "\n");
}

function dropSettledPending(
	pending: TranscriptState["pendingUser"],
	added: readonly SessionEntry[],
): TranscriptState["pendingUser"] {
	let next = pending;
	for (const entry of added) {
		if (next.length === 0) break;
		if (entry.type !== "message" || entry.message.role !== "user") continue;
		const text = messageText(entry.message).trim();
		const at = next.findIndex(p => p.text.trim() === text);
		next = at >= 0 ? [...next.slice(0, at), ...next.slice(at + 1)] : next.slice(1);
	}
	return next;
}

/** A frozen message is superseded once its saved entry lands; failed turns never save, so they stay. */
function dropSavedLive(live: TranscriptState["live"]): TranscriptState["live"] {
	let out: Map<number, LiveStream> | undefined;
	for (const [sid, stream] of live) {
		if (!stream.frozen) continue;
		const stopReason = fieldOf(stream.message, "stopReason");
		if (stopReason === "error" || stopReason === "aborted") continue;
		out ??= new Map(live);
		out.delete(sid);
	}
	return out ?? live;
}

/**
 * Fold one `get_subagent_messages` chunk. A stale chunk (cursor mismatch) leaves the
 * transcript untouched, as `applyTranscriptChunk` decides.
 */
export function applyFocusChunk(state: FocusState, chunk: RpcSubagentMessagesResult): FocusState {
	const cursor = applyTranscriptChunk(state.cursor, chunk);
	if (cursor === state.cursor) return state.loaded ? state : { ...state, loaded: true };
	const entries = cursor.entries.filter((e): e is SessionEntry => e.type !== "session");
	const before = state.transcript.entries;
	const replaced = entries.length < before.length || (before.length > 0 && entries[0]?.id !== before[0]?.id);
	const added = replaced ? entries : entries.slice(before.length);
	const grew = added.length > 0 || replaced;
	return {
		...state,
		cursor,
		loaded: true,
		transcript: grew
			? {
					...state.transcript,
					entries,
					live: dropSavedLive(state.transcript.live),
					pendingUser: dropSettledPending(state.transcript.pendingUser, added),
				}
			: state.transcript,
	};
}

function toolText(partial: unknown): string {
	return typeof partial === "string" ? partial : textOf(fieldOf(partial, "content"), "");
}

/** Raw updates carry the whole partial message, so replace the live message (or start one) instead of replaying deltas. */
function replaceLiveAssistant(state: FocusState, message: AgentMessage): FocusState {
	const t = state.transcript;
	let liveSid: number | undefined;
	for (const [sid, stream] of t.live) if (!stream.frozen) liveSid = sid;
	if (liveSid === undefined) {
		const sid = state.nextSid;
		const started = applyV3Event(t, { type: "msg_start", sid, message });
		return { ...state, nextSid: sid + 1, transcript: started };
	}
	const live = new Map(t.live);
	live.set(liveSid, { ...t.live.get(liveSid)!, message });
	return { ...state, transcript: { ...t, live, working: true } };
}

/** Apply one raw agent event from `subagent_event.payload.event` through the shared transcript reducer. */
export function applyFocusEvent(state: FocusState, event: AgentSessionEvent): FocusState {
	const t = state.transcript;
	switch (event.type) {
		case "message_start": {
			if (event.message.role !== "assistant") return state;
			const sid = state.nextSid;
			return {
				...state,
				nextSid: sid + 1,
				transcript: applyV3Event(t, { type: "msg_start", sid, message: event.message }),
			};
		}
		case "message_update": {
			if (event.message.role !== "assistant") return state;
			return replaceLiveAssistant(state, event.message);
		}
		case "message_end": {
			if (event.message.role !== "assistant") return state;
			let liveSid: number | undefined;
			for (const [sid, stream] of t.live) if (!stream.frozen) liveSid = sid;
			if (liveSid === undefined) return state;
			return { ...state, transcript: applyV3Event(t, { type: "msg_end", sid: liveSid, message: event.message }) };
		}
		case "tool_execution_update": {
			// An update can be the first frame seen for a tool that started before focus.
			const base = t.activeTools.has(event.toolCallId)
				? t
				: applyTranscriptEvent(t, {
						type: "tool_execution_start",
						toolCallId: event.toolCallId,
						toolName: event.toolName,
						args: event.args,
					} as never);
			return {
				...state,
				transcript: applyV3Event(base, {
					type: "tool_output",
					toolCallId: event.toolCallId,
					text: toolText(event.partialResult),
					replace: true,
					details: fieldOf(event.partialResult, "details"),
				}),
			};
		}
		case "tool_execution_start": {
			const hasResult = t.entries.some(
				e =>
					e.type === "message" &&
					e.message.role === "toolResult" &&
					"toolCallId" in e.message &&
					e.message.toolCallId === event.toolCallId,
			);
			if (hasResult) return state;
			return { ...state, transcript: applyTranscriptEvent(t, event) };
		}
		case "tool_execution_end":
		case "agent_start":
			return { ...state, transcript: applyTranscriptEvent(t, event) };
		case "agent_end":
			// Frozen messages stay until the cursor delivers their entries, so the turn never flickers out.
			return { ...state, transcript: { ...t, working: false, activeTools: new Map() } };
		default:
			return state;
	}
}

/**
 * Replay the host's in-flight snapshot (`set_subagent_subscription` response) through the live-frame fold:
 * the partial assistant message first, then cached tool starts, then cached tool updates. Replacing semantics
 * and transcript toolResult checks make this safe to apply on top of frames that already arrived or entries
 * already loaded.
 */
export function applyFocusSnapshot(state: FocusState, snapshot: RpcSubagentInflightSnapshot): FocusState {
	let next = state;
	if (snapshot.streamMessage) next = replaceLiveAssistant(next, snapshot.streamMessage);
	if (snapshot.activeToolStarts) {
		for (const start of snapshot.activeToolStarts) next = applyFocusEvent(next, start);
	}
	for (const update of snapshot.activeToolUpdates) next = applyFocusEvent(next, update);
	return next;
}

/** Event types after which the transcript file has (or is about to have) new entries. */
export function eventPersistsEntries(event: AgentSessionEvent): boolean {
	return (
		event.type === "message_end" ||
		event.type === "tool_execution_end" ||
		event.type === "turn_end" ||
		event.type === "agent_end"
	);
}

// ---------------------------------------------------------------------------
// Entry points and detach rules
// ---------------------------------------------------------------------------

/** Advisors are read-only transcripts and aborted agents are terminal; Main is the view itself. */
export function isFocusable(entry: AgentRosterEntry | undefined): boolean {
	if (!entry || entry.id === MAIN_AGENT_ID || entry.kind !== "sub") return false;
	return entry.status !== "aborted";
}

export type FocusDetachReason = "gone" | "parked" | "aborted";

export interface FocusWatch {
	/** Live status observed since focus; a still-reviving parked agent must not detach before it comes up. */
	readonly sawLive: boolean;
}

export function initialFocusWatch(entry: AgentRosterEntry | undefined): FocusWatch {
	return { sawLive: entry?.status === "running" || entry?.status === "idle" };
}

/** Mirror of the TUI registry handler: removed, parked or aborted focused agents return to Main. */
export function watchFocusedAgent(
	watch: FocusWatch,
	entry: AgentRosterEntry | undefined,
): { watch: FocusWatch; detach: FocusDetachReason | null } {
	if (!entry) return { watch, detach: "gone" };
	if (entry.status === "aborted") return { watch, detach: "aborted" };
	if (entry.status === "parked") return { watch, detach: watch.sawLive ? "parked" : null };
	return { watch: watch.sawLive ? watch : { sawLive: true }, detach: null };
}

export function detachMessage(agentId: string, reason: FocusDetachReason): string {
	return `Agent ${agentId} is ${reason}; returned to main session`;
}

export function viewingMessage(agentId: string): string {
	return `Viewing agent ${agentId}`;
}

export const FOCUSED_VIEW_COMMANDS = ["btw", "export", "usage"] as const;

const FOCUSED_REFUSAL = `Only ${FOCUSED_VIEW_COMMANDS.map(n => `/${n}`).join(", ")} run here; other commands run in the main session, press Esc to return first`;

export type FocusedSubmit =
	| { kind: "send" }
	/** `/usage` is account-wide and has a dedicated screen in the web UI. */
	| { kind: "usage" }
	| { kind: "export" }
	| { kind: "btw"; question: string }
	| { kind: "refuse"; message: string };

/** Chat-only policy of `#submitToFocusedSession`: only viewer-scoped commands run, everything else with a command prefix is refused. */
export function gateFocusedSubmit(text: string): FocusedSubmit {
	if (text.startsWith("/")) {
		const match = /^\/(\S+)(?:\s+(.*))?$/s.exec(text);
		const name = match?.[1];
		const args = (match?.[2] ?? "").trim();
		if (name === "usage" && (args === "" || args === "show")) return { kind: "usage" };
		if (name === "export") return { kind: "export" };
		if (name === "btw") {
			return { kind: "btw", question: args };
		}
		return { kind: "refuse", message: FOCUSED_REFUSAL };
	}
	if (text.startsWith("!")) return { kind: "refuse", message: FOCUSED_REFUSAL };
	return { kind: "send" };
}

/** Esc in the focused editor: text is cleared first, an empty editor returns to Main. */
export function escapeAction(text: string, imageCount: number): "clear" | "exit" {
	return text.length > 0 || imageCount > 0 ? "clear" : "exit";
}
