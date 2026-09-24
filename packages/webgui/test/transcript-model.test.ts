import { describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import {
	addPendingUser,
	applyHistoryPage,
	applyTranscriptEvent,
	applyV3Event,
	clearPendingUser,
	currentLeafId,
	emptyTranscriptState,
	oldestEntryId,
	resetTranscriptForResync,
} from "../src/lib/transcript-model";

function makeAssistantMessage(
	content: AssistantMessage["content"] = [],
	overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
			},
		},
		stopReason: "stop",
		timestamp: 100,
		...overrides,
	};
}
const USER_ENTRY: SessionEntry = {
	id: "entry-u1",
	parentId: null,
	timestamp: "2026-09-24T12:00:00.000Z",
	type: "message",
	message: {
		role: "user",
		content: "Hello agent",
		timestamp: 1000,
	},
};

const USER_ENTRY_2: SessionEntry = {
	id: "entry-u2",
	parentId: "entry-u1",
	timestamp: "2026-09-24T12:01:00.000Z",
	type: "message",
	message: {
		role: "user",
		content: "Follow-up question",
		timestamp: 1500,
	},
};

const ASSISTANT_ENTRY: SessionEntry = {
	id: "entry-a1",
	parentId: "entry-u1",
	timestamp: "2026-09-24T12:02:00.000Z",
	type: "message",
	message: makeAssistantMessage([{ type: "text", text: "Answer here" }], {
		model: "claude-sonnet",
		usage: {
			input: 10,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 30,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0.01,
			},
		},
		timestamp: 2000,
	}),
};

const TOOL_RESULT_ENTRY: SessionEntry = {
	id: "entry-tr1",
	parentId: "entry-a1",
	timestamp: "2026-09-24T12:03:00.000Z",
	type: "message",
	message: {
		role: "toolResult",
		toolCallId: "call-1",
		toolName: "read",
		content: [{ type: "text", text: "file content" }],
		isError: false,
		timestamp: 3000,
	},
};

describe("v3 reducer: delta appends only", () => {
	it("appends streaming text chunks without clobbering preceding tokens", () => {
		let state = emptyTranscriptState();
		const emptyMsg = makeAssistantMessage([]);

		state = applyV3Event(state, { type: "msg_start", sid: 1, message: emptyMsg });
		state = applyV3Event(state, { type: "block_start", sid: 1, block: 0, start: { type: "text" } });
		state = applyV3Event(state, { type: "delta", sid: 1, block: 0, text: "Hello" });
		state = applyV3Event(state, { type: "delta", sid: 1, block: 0, text: " world" });

		const live = state.live.get(1);
		expect(live).toBeDefined();
		const content = "content" in live!.message && Array.isArray(live!.message.content) ? live!.message.content : [];
		expect(content).toHaveLength(1);
		expect(content[0]).toEqual({ type: "text", text: "Hello world" });
	});

	it("appends thinking deltas into the thinking block", () => {
		let state = emptyTranscriptState();
		const emptyMsg = makeAssistantMessage([]);

		state = applyV3Event(state, { type: "msg_start", sid: 2, message: emptyMsg });
		state = applyV3Event(state, { type: "block_start", sid: 2, block: 0, start: { type: "thinking" } });
		state = applyV3Event(state, { type: "delta", sid: 2, block: 0, text: "Pondering..." });
		state = applyV3Event(state, { type: "delta", sid: 2, block: 0, text: " done." });

		const live = state.live.get(2);
		expect(live).toBeDefined();
		const content = "content" in live!.message && Array.isArray(live!.message.content) ? live!.message.content : [];
		expect(content[0]).toEqual({ type: "thinking", thinking: "Pondering... done." });
	});
});

describe("v3 reducer: msg_end then entry{sid} keeps key", () => {
	it("preserves live:<sid> row key identity after entry arrives", () => {
		let state = emptyTranscriptState();
		const emptyMsg = makeAssistantMessage([]);

		state = applyV3Event(state, { type: "msg_start", sid: 42, message: emptyMsg });
		state = applyV3Event(state, { type: "block_start", sid: 42, block: 0, start: { type: "text" } });
		state = applyV3Event(state, { type: "delta", sid: 42, block: 0, text: "Answer text" });

		const finalMsg = makeAssistantMessage([{ type: "text", text: "Answer text" }]);
		state = applyV3Event(state, { type: "msg_end", sid: 42, message: finalMsg });
		expect(state.live.get(42)?.frozen).toBe(true);

		state = applyV3Event(state, {
			type: "entry",
			sid: 42,
			entry: {
				...ASSISTANT_ENTRY,
				id: "entry-saved-42",
			},
		});

		// Live entry removed from active streaming map
		expect(state.live.has(42)).toBe(false);
		// Appended to finished entries
		expect(state.entries.some(e => e.id === "entry-saved-42")).toBe(true);
		// Stable React key mapped to live:42
		expect(state.entryKeys.get("entry-saved-42")).toBe("live:42");
	});
});

describe("v3 reducer: unknown sid delta ignored", () => {
	it("silently drops delta when sid is not in live map", () => {
		const state = emptyTranscriptState();
		const next = applyV3Event(state, { type: "delta", sid: 999, block: 0, text: "ghost token" });
		expect(next).toBe(state);
	});

	it("silently drops delta when block index is out of bounds", () => {
		let state = emptyTranscriptState();
		state = applyV3Event(state, {
			type: "msg_start",
			sid: 1,
			message: makeAssistantMessage([]),
		});
		const before = state;
		const next = applyV3Event(state, { type: "delta", sid: 1, block: 5, text: "missing block" });
		expect(next).toBe(before);
	});
});

describe("v3 reducer: branch keeps rows until reload", () => {
	it("keeps finished entries and live rows, and flags needsReload", () => {
		let state = emptyTranscriptState();
		state = {
			...state,
			entries: [USER_ENTRY, ASSISTANT_ENTRY],
			leafId: ASSISTANT_ENTRY.id,
		};
		state = applyV3Event(state, {
			type: "msg_start",
			sid: 7,
			message: makeAssistantMessage([]),
		});

		const next = applyV3Event(state, { type: "branch", leafId: "new-leaf-10" });
		expect(next.entries).toBe(state.entries);
		expect(next.live.has(7)).toBe(true);
		expect(next.needsReload).toBe(true);
		expect(next.leafId).toBe("new-leaf-10");
	});
});

describe("v3 reducer: older page prepends without duplicates", () => {
	it("prepends only new historical entries", () => {
		let state = emptyTranscriptState();
		state = applyHistoryPage(
			state,
			{
				leafId: "entry-u2",
				entries: [USER_ENTRY_2],
				hasMore: true,
				live: [],
			},
			{ older: false },
		);
		expect(state.entries).toHaveLength(1);
		expect(state.entries[0].id).toBe("entry-u2");

		// Fetch older page containing entry-u1 and already-present entry-u2
		state = applyHistoryPage(
			state,
			{
				leafId: "entry-u2",
				entries: [USER_ENTRY, USER_ENTRY_2],
				hasMore: false,
				live: [],
			},
			{ older: true },
		);

		expect(state.entries).toHaveLength(2);
		expect(state.entries[0].id).toBe("entry-u1");
		expect(state.entries[1].id).toBe("entry-u2");
		expect(state.hasMore).toBe(false);
	});
});

describe("v3 reducer: pendingUser FIFO clears on user entry", () => {
	it("clears pending prompts in FIFO order as user entries arrive", () => {
		let state = addPendingUser(emptyTranscriptState(), "first question");
		state = addPendingUser(state, "second question");
		expect(state.pendingUser).toEqual(["first question", "second question"]);

		// Non-user entry should not shift pending prompts
		state = applyV3Event(state, { type: "entry", entry: ASSISTANT_ENTRY });
		expect(state.pendingUser).toEqual(["first question", "second question"]);

		// First user entry shifts the first prompt
		state = applyV3Event(state, { type: "entry", entry: USER_ENTRY });
		expect(state.pendingUser).toEqual(["second question"]);

		// Second user entry shifts the second prompt
		state = applyV3Event(state, { type: "entry", entry: USER_ENTRY_2 });
		expect(state.pendingUser).toEqual([]);
	});
});

describe("v3 reducer: tool_output dropped after result", () => {
	it("drops tool output when the toolResult entry is already committed", () => {
		let state = emptyTranscriptState();
		state = { ...state, entries: [TOOL_RESULT_ENTRY] };

		const next = applyV3Event(state, {
			type: "tool_output",
			toolCallId: "call-1",
			text: "stale late output",
		});
		expect(next.activeTools.has("call-1")).toBe(false);
		expect(next).toBe(state);
	});

	it("accumulates tool output chunks when result is not yet committed", () => {
		let state = emptyTranscriptState();
		state = applyV3Event(state, {
			type: "tool_output",
			toolCallId: "call-2",
			text: "first line\n",
		});
		state = applyV3Event(state, {
			type: "tool_output",
			toolCallId: "call-2",
			text: "second line\n",
		});

		const tool = state.activeTools.get("call-2");
		expect(tool).toBeDefined();
		expect(tool!.partialResult).toBe("first line\nsecond line\n");
	});
});

describe("v3 reducer: query helpers", () => {
	it("oldestEntryId returns the first entry id or undefined", () => {
		expect(oldestEntryId(emptyTranscriptState())).toBeUndefined();
		const state = { ...emptyTranscriptState(), entries: [USER_ENTRY, USER_ENTRY_2] };
		expect(oldestEntryId(state)).toBe("entry-u1");
	});

	it("currentLeafId returns the state leafId", () => {
		expect(currentLeafId(emptyTranscriptState())).toBeNull();
		const state = { ...emptyTranscriptState(), leafId: "leaf-99" };
		expect(currentLeafId(state)).toBe("leaf-99");
	});

	it("clearPendingUser manual call", () => {
		let state = addPendingUser(emptyTranscriptState(), "one");
		state = clearPendingUser(state);
		expect(state.pendingUser).toEqual([]);
	});
});

describe("applyTranscriptEvent backward compatibility", () => {
	it("delegates v3 events to applyV3Event", () => {
		const state = emptyTranscriptState();
		const next = applyTranscriptEvent(state, {
			type: "branch",
			leafId: "b-1",
		});
		expect(next.leafId).toBe("b-1");
		expect(next.needsReload).toBe(true);
	});

	it("handles tool_execution_start and end", () => {
		let state = emptyTranscriptState();
		state = applyTranscriptEvent(state, {
			type: "tool_execution_start",
			toolCallId: "tc-9",
			toolName: "bash",
			args: { cmd: "ls" },
			intent: "Listing",
		});
		expect(state.activeTools.get("tc-9")?.toolName).toBe("bash");

		state = applyTranscriptEvent(state, {
			type: "tool_execution_end",
			toolCallId: "tc-9",
			toolName: "bash",
			result: undefined,
		});
		expect(state.activeTools.has("tc-9")).toBe(false);
	});

	it("handles command_output and clears pendingUser", () => {
		let state = addPendingUser(emptyTranscriptState(), "/theme");
		state = applyTranscriptEvent(state, {
			type: "command_output",
			text: "Theme updated",
		});
		expect(state.pendingUser).toEqual([]);
		expect(state.entries).toHaveLength(1);
		expect(state.entries[0].type).toBe("message");
	});
});

describe("v3 reducer: review regressions", () => {
	it("ignores msg_start/msg_end for non-assistant roles", () => {
		const initial = emptyTranscriptState();
		const user = USER_ENTRY.type === "message" ? USER_ENTRY.message : undefined;
		let state = applyV3Event(initial, { type: "msg_start", sid: 1, message: user! });
		state = applyV3Event(state, { type: "msg_end", sid: 1, message: user! });
		expect(state).toBe(initial);
		expect(state.live.size).toBe(0);
		expect(state.working).toBe(false);
	});

	it("agent_end drops frozen live rows that never got an entry, keeps open ones", () => {
		let state = emptyTranscriptState();
		state = applyV3Event(state, { type: "msg_start", sid: 1, message: makeAssistantMessage([]) });
		state = applyV3Event(state, { type: "msg_end", sid: 1, message: makeAssistantMessage([]) });
		state = applyV3Event(state, { type: "msg_start", sid: 2, message: makeAssistantMessage([]) });
		state = applyTranscriptEvent(state, { type: "agent_end" });
		expect(state.live.has(1)).toBe(false);
		expect(state.live.has(2)).toBe(true);
		expect(state.working).toBe(false);
	});

	it("resetTranscriptForResync clears per-connection state", () => {
		let state = addPendingUser(emptyTranscriptState(), "hi");
		state = applyV3Event(state, { type: "entry", sid: 1, entry: USER_ENTRY_2 });
		state = applyTranscriptEvent(state, {
			type: "tool_execution_start",
			toolCallId: "t",
			toolName: "bash",
			args: {},
		});
		state = applyTranscriptEvent(state, { type: "agent_start" });
		state = addPendingUser(state, "queued");
		const reset = resetTranscriptForResync(state);
		expect(reset.entryKeys.size).toBe(0);
		expect(reset.activeTools.size).toBe(0);
		expect(reset.pendingUser).toEqual([]);
		expect(reset.working).toBe(false);
		expect(reset.entries).toBe(state.entries);
	});

	it("newest page derives working from live only", () => {
		let state = applyTranscriptEvent(emptyTranscriptState(), { type: "agent_start" });
		state = applyHistoryPage(state, { leafId: null, entries: [], hasMore: false, live: [] }, { older: false });
		expect(state.working).toBe(false);
		state = applyHistoryPage(
			state,
			{ leafId: null, entries: [], hasMore: false, live: [{ sid: 3, message: makeAssistantMessage([]) }] },
			{ older: false },
		);
		expect(state.working).toBe(true);
	});

	it("tool_output for an unknown toolCallId leaves args undefined", () => {
		const state = applyV3Event(emptyTranscriptState(), { type: "tool_output", toolCallId: "orphan", text: "x" });
		expect(state.activeTools.get("orphan")?.args).toBeUndefined();
	});

	it("command_output does not move leafId", () => {
		let state = applyV3Event(emptyTranscriptState(), { type: "entry", entry: USER_ENTRY });
		state = applyTranscriptEvent(state, { type: "command_output", text: "done" });
		expect(state.leafId).toBe("entry-u1");
		expect(currentLeafId(state)).toBe("entry-u1");
	});
});

describe("v3 reducer: final review regressions", () => {
	it("block_start after a mid-stream attach keeps the block's accumulated text", () => {
		let state = applyHistoryPage(
			emptyTranscriptState(),
			{
				leafId: null,
				entries: [],
				hasMore: false,
				live: [{ sid: 1, message: makeAssistantMessage([{ type: "text", text: "already streamed " }]) }],
			},
			{ older: false },
		);
		state = applyV3Event(state, { type: "block_start", sid: 1, block: 0, start: { type: "text" } });
		state = applyV3Event(state, { type: "delta", sid: 1, block: 0, text: "tail" });
		const content = state.live.get(1)?.message;
		expect(content && "content" in content ? content.content : undefined).toEqual([
			{ type: "text", text: "already streamed tail" },
		]);
	});

	it("block_start still replaces a block of a different type", () => {
		let state = applyV3Event(emptyTranscriptState(), {
			type: "msg_start",
			sid: 1,
			message: makeAssistantMessage([{ type: "thinking", thinking: "hmm" }]),
		});
		state = applyV3Event(state, { type: "block_start", sid: 1, block: 0, start: { type: "text" } });
		const msg = state.live.get(1)?.message;
		expect(msg && "content" in msg ? msg.content : undefined).toEqual([{ type: "text", text: "" }]);
	});

	it("agent_end keeps frozen error/aborted rows until the next msg_start", () => {
		let state = emptyTranscriptState();
		const failed = makeAssistantMessage([], { stopReason: "error", errorMessage: "429" });
		const aborted = makeAssistantMessage([], { stopReason: "aborted" });
		state = applyV3Event(state, { type: "msg_start", sid: 1, message: failed });
		state = applyV3Event(state, { type: "msg_end", sid: 1, message: failed });
		state = applyV3Event(state, { type: "msg_start", sid: 2, message: aborted });
		state = applyV3Event(state, { type: "msg_end", sid: 2, message: aborted });
		state = applyTranscriptEvent(state, { type: "agent_end" });
		// sid 2's msg_start superseded the failed sid 1; the aborted sid 2 survives agent_end.
		expect([...state.live.keys()]).toEqual([2]);

		state = applyV3Event(state, { type: "msg_start", sid: 3, message: makeAssistantMessage([]) });
		expect([...state.live.keys()]).toEqual([3]);
	});

	it("tool_output with replace resets partialResult instead of appending", () => {
		let state = applyV3Event(emptyTranscriptState(), { type: "tool_output", toolCallId: "w", text: "poll 1" });
		state = applyV3Event(state, { type: "tool_output", toolCallId: "w", text: " more" });
		expect(state.activeTools.get("w")?.partialResult).toBe("poll 1 more");
		state = applyV3Event(state, { type: "tool_output", toolCallId: "w", text: "poll 2", replace: true });
		expect(state.activeTools.get("w")?.partialResult).toBe("poll 2");
	});
});
