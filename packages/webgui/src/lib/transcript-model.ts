/**
 * Pure reducer that maps RPC `get_messages` responses and streaming session
 * events into the prop shape collab-web's `Transcript` component consumes.
 *
 * Wire types (from `@oh-my-pi/pi-wire`) are the target; pi-ai / pi-agent-core
 * `AgentMessage` is the source coming over the RPC channel.
 */

import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage as PiAssistantMessage } from "@oh-my-pi/pi-ai";
import type {
	AssistantMessage as WireAssistantMessage,
	AssistantContent,
	SessionEntry,
	ToolResultMessage as WireToolResultMessage,
	WireUsage,
} from "@oh-my-pi/pi-wire";
import type { ActiveTool } from "../../../collab-web/src/lib/client";
import type { RpcSessionEvent } from "./rpc-client";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface TranscriptState {
	/** Committed entries for the Transcript component. */
	entries: readonly SessionEntry[];
	/** Partial assistant message being streamed; null when idle. */
	stream: WireAssistantMessage | null;
	/** True once the streaming message received `message_end`. */
	streamDone: boolean;
	/** Currently executing tools keyed by toolCallId. */
	activeTools: ReadonlyMap<string, ActiveTool>;
	/** Whether the agent is between agent_start and agent_end. */
	working: boolean;
}

// ---------------------------------------------------------------------------
// Helpers: pi-ai -> wire conversion
// ---------------------------------------------------------------------------

/** Convert a pi-ai assistant content block to a wire AssistantContent block. */
function toWireContent(block: { type: string; [k: string]: unknown }): AssistantContent | null {
	switch (block.type) {
		case "text":
			return { type: "text", text: block.text as string };
		case "thinking":
			return { type: "thinking", thinking: block.thinking as string };
		case "redactedThinking":
			return {
				type: "redactedThinking",
				data: (block.data as string) ?? "",
			};
		case "toolCall":
			return {
				type: "toolCall",
				id: block.id as string,
				name: block.name as string,
				arguments: (block.arguments as Record<string, unknown>) ?? {},
				intent: block.intent as string | undefined,
			};
		default:
			return null;
	}
}

function toWireUsage(usage: PiAssistantMessage["usage"]): WireUsage {
	return {
		input: usage.input,
		output: usage.output,
		cacheRead: usage.cacheRead,
		cacheWrite: usage.cacheWrite,
		totalTokens: usage.totalTokens,
		cost: { total: usage.cost.total },
	};
}

function convertAssistantContent(srcContent: readonly { type: string }[]): AssistantContent[] {
	const out: AssistantContent[] = [];
	for (const block of srcContent) {
		const mapped = toWireContent(block);
		if (mapped) out.push(mapped);
	}
	return out;
}

function toWireAssistant(msg: PiAssistantMessage): WireAssistantMessage {
	return {
		role: "assistant",
		content: convertAssistantContent(msg.content),
		model: msg.model ?? "",
		usage: toWireUsage(msg.usage),
		stopReason: (msg.stopReason as WireAssistantMessage["stopReason"]) ?? "stop",
		errorMessage: msg.errorMessage,
		timestamp: msg.timestamp ?? 0,
	};
}

/** Best-effort conversion of a pi-ai Message to a wire SessionEntry. */
function messageToEntry(msg: AgentMessage, index: number): SessionEntry | null {
	if (!("role" in msg)) return null;
	const id = String("id" in msg ? msg.id : index);
	const ts = new Date(msg.timestamp ?? Date.now()).toISOString();
	const base = { id, parentId: null, timestamp: ts };

	switch (msg.role) {
		case "user":
			return {
				...base,
				type: "message",
				message: {
					role: "user",
					content: msg.content,
					timestamp: msg.timestamp ?? 0,
				},
			};
		case "assistant":
			return {
				...base,
				type: "message",
				message: toWireAssistant(msg),
			};
		case "toolResult": {
			const wireResult: WireToolResultMessage = {
				role: "toolResult",
				toolCallId: msg.toolCallId,
				toolName: msg.toolName,
				content: msg.content ?? [],
				isError: msg.isError ?? false,
				timestamp: msg.timestamp ?? 0,
			};
			return { ...base, type: "message", message: wireResult };
		}
		default:
			// developer messages and unknown roles skipped
			return null;
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function emptyTranscriptState(): TranscriptState {
	return {
		entries: [],
		stream: null,
		streamDone: false,
		activeTools: new Map(),
		working: false,
	};
}

/** Build initial state from a `get_messages` response. */
export function transcriptFromMessages(messages: AgentMessage[]): TranscriptState {
	const entries: SessionEntry[] = [];
	for (let i = 0; i < messages.length; i++) {
		const entry = messageToEntry(messages[i], i);
		if (entry) entries.push(entry);
	}
	return {
		entries,
		stream: null,
		streamDone: false,
		activeTools: new Map(),
		working: false,
	};
}

/** Immutable reducer: apply one streaming event to the current state. */
export function applyTranscriptEvent(state: TranscriptState, event: RpcSessionEvent): TranscriptState {
	switch (event.type) {
		case "agent_start":
			return { ...state, working: true };

		case "agent_end":
			return { ...state, working: false };

		case "message_start": {
			const msg = event.message;
			if (msg.role === "assistant") {
				return {
					...state,
					stream: toWireAssistant(msg),
					streamDone: false,
				};
			}
			return state;
		}

		case "message_update": {
			const msg = event.message;
			if (msg.role === "assistant") {
				return { ...state, stream: toWireAssistant(msg) };
			}
			return state;
		}

		case "message_end": {
			const msg = event.message;
			if (msg.role === "assistant" || msg.role === "user" || msg.role === "toolResult") {
				const entry = messageToEntry(msg, state.entries.length);
				if (entry) {
					const entries = [...state.entries, entry];
					if (msg.role === "assistant") {
						return {
							...state,
							entries,
							streamDone: true,
						};
					}
					return { ...state, entries };
				}
			}
			return state;
		}

		case "turn_start":
			return {
				...state,
				stream: null,
				streamDone: false,
			};

		case "turn_end":
			return { ...state, stream: null, streamDone: false };

		case "tool_execution_start": {
			const e = event as {
				toolCallId: string;
				toolName: string;
				args: unknown;
				intent?: string;
			};
			const next = new Map(state.activeTools);
			next.set(e.toolCallId, {
				toolCallId: e.toolCallId,
				toolName: e.toolName,
				args: e.args,
				intent: e.intent,
				startedAt: Date.now(),
			});
			return { ...state, activeTools: next };
		}

		case "tool_execution_update": {
			const e = event as {
				toolCallId: string;
				toolName: string;
				args: unknown;
				partialResult: unknown;
			};
			const prev = state.activeTools.get(e.toolCallId);
			if (!prev) return state;
			const next = new Map(state.activeTools);
			next.set(e.toolCallId, {
				...prev,
				partialResult: e.partialResult,
			});
			return { ...state, activeTools: next };
		}

		case "tool_execution_end": {
			const e = event as { toolCallId: string };
			if (!state.activeTools.has(e.toolCallId)) return state;
			const next = new Map(state.activeTools);
			next.delete(e.toolCallId);
			return { ...state, activeTools: next };
		}

		default:
			return state;
	}
}
