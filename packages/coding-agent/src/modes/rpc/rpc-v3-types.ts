import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AgentSessionEvent } from "../../session/agent-session-events";
import type { SessionEntry } from "../../session/session-entries";

export type RpcV3BlockStart =
	| { type: "text" }
	| { type: "thinking" }
	| { type: "redactedThinking"; data: string }
	| { type: "toolCall"; id: string; name: string };

/** Live message still streaming, as held by omp at snapshot time. */
export interface RpcV3Live {
	sid: number;
	message: AgentMessage; // partial assistant message so far
}

// msg_start/block_*/delta/msg_end are sent only for assistant messages; every other message arrives only as `entry`.
export type RpcV3Event =
	| { type: "msg_start"; sid: number; message: AgentMessage } // assistant only; message has empty/initial content
	| { type: "block_start"; sid: number; block: number; start: RpcV3BlockStart }
	| { type: "delta"; sid: number; block: number; text: string } // new text only, text/thinking blocks
	| { type: "block_end"; sid: number; block: number; content: unknown } // final content block (toolCall carries arguments whole)
	| { type: "msg_end"; sid: number; message: AgentMessage } // final message; row frozen until its entry arrives; error/aborted rows survive agent_end until the next msg_start or reload
	| { type: "entry"; entry: SessionEntry; sid?: number; secrets?: true } // a saved entry appended to the current branch; sid set when it is the saved form of a streamed message; secrets = entry carries restored secret values, do not persist
	| { type: "branch"; leafId: string | null } // current branch changed (compaction, switch, resume, dropped failed turn)
	| { type: "tool_output"; toolCallId: string; text: string; replace?: true; details?: unknown }; // new tool output only; replace = text is the whole output, discard what was shown; details = latest live details snapshot (replaces prior)

// On v3 the run/turn terminal frames are signals only: their payloads were already delivered as msg_end/entry.
export type RpcV3AgentEnd = Omit<Extract<AgentSessionEvent, { type: "agent_end" }>, "messages">;
export type RpcV3TurnEnd = Omit<Extract<AgentSessionEvent, { type: "turn_end" }>, "message" | "toolResults">;

export interface RpcV3HistoryCommand {
	type: "history";
	id?: string;
	before?: string;
	after?: string;
	leafId?: string;
	limit?: number;
}
// before = entry id; page holds entries strictly older than it. No before/after = newest page. limit default 50, max 200.
// after = entry id; page holds entries strictly newer than it when count <= limit; echoes after with hasMore: false.
// leafId/before/after = where the browser is paging from; if any is not on the current branch path => error response with error "branch_changed". A leaf that only advanced by appends is not a branch change.
export interface RpcV3HistoryResult {
	leafId: string | null;
	entries: SessionEntry[]; // oldest-first within the page
	hasMore: boolean; // older entries exist (false for after delta responses)
	live: RpcV3Live[]; // on newest page and after delta responses
	after?: string; // echoed cursor when returning a delta strictly after it
	secrets?: true; // entries or live carry restored secret values; clients must not persist this session
}
