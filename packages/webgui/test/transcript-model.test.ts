import { describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import {
	addPendingUser,
	applyHistoryPage,
	applyTranscriptEvent,
	applyV3Event,
	buildTranscriptRows,
	clearPendingUser,
	currentLeafId,
	emptyTranscriptState,
	oldestEntryId,
	resetFinishedEntryCache,
	resetTranscriptForResync,
	type ToolCallItem,
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
		// Stable React key mapped to live:0:42
		expect(state.entryKeys.get("entry-saved-42")).toBe("live:0:42");
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
		expect(state.pendingUser).toEqual([{ text: "first question" }, { text: "second question" }]);

		// Non-user entry should not shift pending prompts
		state = applyV3Event(state, { type: "entry", entry: ASSISTANT_ENTRY });
		expect(state.pendingUser).toEqual([{ text: "first question" }, { text: "second question" }]);

		// First user entry shifts the first prompt
		state = applyV3Event(state, { type: "entry", entry: USER_ENTRY });
		expect(state.pendingUser).toEqual([{ text: "second question" }]);

		// Second user entry shifts the second prompt
		state = applyV3Event(state, { type: "entry", entry: USER_ENTRY_2 });
		expect(state.pendingUser).toEqual([]);
	});
});
describe("v3 reducer: pendingUser content matching", () => {
	it("an out-of-order user entry removes the matching pending item and leaves the others; the no-match fallback removes the oldest", () => {
		let state = addPendingUser(emptyTranscriptState(), "alpha");
		state = addPendingUser(state, "beta");
		state = addPendingUser(state, "gamma");
		expect(state.pendingUser).toEqual([{ text: "alpha" }, { text: "beta" }, { text: "gamma" }]);

		// Out-of-order user entry matching "gamma" should remove "gamma" and leave "alpha" and "beta"
		const gammaEntry: SessionEntry = {
			id: "entry-gamma",
			parentId: null,
			timestamp: "2026-09-24T12:00:00.000Z",
			type: "message",
			message: {
				role: "user",
				content: " gamma ", // extra whitespace to verify trimming
				timestamp: 1000,
			},
		};
		state = applyV3Event(state, { type: "entry", entry: gammaEntry });
		expect(state.pendingUser).toEqual([{ text: "alpha" }, { text: "beta" }]);

		// No-match fallback (e.g. slash command expansion) removes the oldest ("alpha")
		const expandedEntry: SessionEntry = {
			id: "entry-expanded",
			parentId: null,
			timestamp: "2026-09-24T12:01:00.000Z",
			type: "message",
			message: {
				role: "user",
				content: "Slash command expanded text not in pending queue",
				timestamp: 2000,
			},
		};
		state = applyV3Event(state, { type: "entry", entry: expandedEntry });
		expect(state.pendingUser).toEqual([{ text: "beta" }]);
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

	it("resetTranscriptForResync clears per-connection state but keeps saved entry keys", () => {
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
		// Synthesize an unsaved mapping to prove only saved entries are kept
		state = {
			...state,
			entryKeys: new Map([...state.entryKeys, ["unsaved-entry-id", "live:0:99"]]),
		};
		const reset = resetTranscriptForResync(state);
		expect(reset.entryKeys.size).toBe(1);
		expect(reset.entryKeys.get(USER_ENTRY_2.id)).toBe("live:0:1");
		expect(reset.entryKeys.has("unsaved-entry-id")).toBe(false);
		expect(reset.live.size).toBe(0);
		expect(reset.activeTools.size).toBe(0);
		expect(reset.pendingUser).toEqual([]);
		expect(reset.working).toBe(false);
		expect(reset.entries).toBe(state.entries);
	});

	it("reconnect with identical newest page: entries array and entry objects identical, row ids unchanged", () => {
		let state = emptyTranscriptState();
		state = applyV3Event(state, {
			type: "msg_start",
			sid: 10,
			message: makeAssistantMessage([{ type: "text", text: "Answer here" }]),
		});
		state = applyV3Event(state, {
			type: "entry",
			sid: 10,
			entry: ASSISTANT_ENTRY,
		});

		const initialRows = buildTranscriptRows(state);
		const initialRow = initialRows.find(r => r.kind === "assistant-text");
		expect(initialRow?.id).toBe("live:0:10-txt0");
		expect(state.entryKeys.get(ASSISTANT_ENTRY.id)).toBe("live:0:10");

		state = resetTranscriptForResync(state);
		expect(state.entryKeys.get(ASSISTANT_ENTRY.id)).toBe("live:0:10");

		const identicalEntryFromJson: SessionEntry = JSON.parse(JSON.stringify(ASSISTANT_ENTRY));
		expect(identicalEntryFromJson).not.toBe(ASSISTANT_ENTRY);

		const nextState = applyHistoryPage(
			state,
			{
				leafId: ASSISTANT_ENTRY.id,
				entries: [identicalEntryFromJson],
				hasMore: false,
				live: [],
			},
			{ older: false },
		);

		expect(nextState.entries).toBe(state.entries);
		expect(nextState.entries[0]).toBe(ASSISTANT_ENTRY);

		const reconnectedRows = buildTranscriptRows(nextState);
		const reconnectedRow = reconnectedRows.find(r => r.kind === "assistant-text");
		expect(reconnectedRow?.id).toBe("live:0:10-txt0");
	});

	it("after resync, a new live stream with the same sid as a kept entry yields distinct row ids", () => {
		let state = emptyTranscriptState();
		state = applyV3Event(state, {
			type: "msg_start",
			sid: 0,
			message: makeAssistantMessage([{ type: "text", text: "First reply" }]),
		});
		state = applyV3Event(state, {
			type: "entry",
			sid: 0,
			entry: ASSISTANT_ENTRY,
		});

		const savedRows = buildTranscriptRows(state);
		const savedRow = savedRows.find(r => r.kind === "assistant-text");
		expect(savedRow?.id).toBe("live:0:0-txt0");
		state = resetTranscriptForResync(state);

		state = applyV3Event(state, {
			type: "msg_start",
			sid: 0,
			message: makeAssistantMessage([{ type: "text", text: "Second reply" }]),
		});

		const rows = buildTranscriptRows(state);
		const textRows = rows.filter(r => r.kind === "assistant-text");
		expect(textRows.length).toBe(2);
		expect(textRows[0].id).toBe("live:0:0-txt0");
		expect(textRows[1].id).toBe("live:1:0-txt0");
		expect(textRows[0].id).not.toBe(textRows[1].id);
	});

	it("reconnect after new entries arrived: old objects reused, new appended, older pages kept", () => {
		let state = emptyTranscriptState();
		state = applyHistoryPage(
			state,
			{
				leafId: USER_ENTRY_2.id,
				entries: [USER_ENTRY_2],
				hasMore: true,
				live: [],
			},
			{ older: false },
		);
		state = applyHistoryPage(
			state,
			{
				leafId: USER_ENTRY_2.id,
				entries: [USER_ENTRY],
				hasMore: false,
				live: [],
			},
			{ older: true },
		);
		expect(state.entries.length).toBe(2);
		expect(state.entries[0]).toBe(USER_ENTRY);
		expect(state.entries[1]).toBe(USER_ENTRY_2);
		expect(state.hasMore).toBe(false);

		const newAssistantEntry: SessionEntry = {
			...ASSISTANT_ENTRY,
			parentId: USER_ENTRY_2.id,
		};
		const userEntry2FromJson: SessionEntry = JSON.parse(JSON.stringify(USER_ENTRY_2));

		state = resetTranscriptForResync(state);
		const nextState = applyHistoryPage(
			state,
			{
				leafId: newAssistantEntry.id,
				entries: [userEntry2FromJson, newAssistantEntry],
				hasMore: true,
				live: [],
			},
			{ older: false },
		);

		expect(nextState.entries.length).toBe(3);
		expect(nextState.entries[0]).toBe(USER_ENTRY);
		expect(nextState.entries[1]).toBe(USER_ENTRY_2);
		expect(nextState.entries[2]).toBe(newAssistantEntry);
		expect(nextState.hasMore).toBe(false);
	});

	it("branch change page: full replace", () => {
		const state = applyHistoryPage(
			emptyTranscriptState(),
			{
				leafId: USER_ENTRY.id,
				entries: [USER_ENTRY],
				hasMore: false,
				live: [],
			},
			{ older: false },
		);

		const branchEntry: SessionEntry = {
			id: "entry-branched",
			parentId: null,
			timestamp: "2026-09-24T13:00:00.000Z",
			type: "message",
			message: {
				role: "user",
				content: "New branch",
				timestamp: 3000,
			},
		};

		const disconnectedState = applyHistoryPage(
			state,
			{
				leafId: branchEntry.id,
				entries: [branchEntry],
				hasMore: false,
				live: [],
			},
			{ older: false },
		);
		expect(disconnectedState.entries.length).toBe(1);
		expect(disconnectedState.entries[0]).toBe(branchEntry);

		const reloadState = applyHistoryPage(
			{ ...state, needsReload: true },
			{
				leafId: branchEntry.id,
				entries: [branchEntry],
				hasMore: false,
				live: [],
			},
			{ older: false },
		);
		expect(reloadState.entries.length).toBe(1);
		expect(reloadState.entries[0]).toBe(branchEntry);
		expect(reloadState.needsReload).toBe(false);
	});

	it("newest page fetched mid-tool-call keeps a running turn working", () => {
		let state = applyHistoryPage(
			emptyTranscriptState(),
			{ leafId: null, entries: [], hasMore: false, live: [] },
			{ older: false },
		);
		expect(state.working).toBe(false);
		state = applyHistoryPage(
			state,
			{ leafId: null, entries: [], hasMore: false, live: [{ sid: 3, message: makeAssistantMessage([]) }] },
			{ older: false },
		);
		expect(state.working).toBe(true);
		state = applyTranscriptEvent(emptyTranscriptState(), { type: "agent_start" });
		state = applyHistoryPage(state, { leafId: null, entries: [], hasMore: false, live: [] }, { older: false });
		expect(state.working).toBe(true);
	});

	it("turn_end between tool rounds keeps working until agent_end", () => {
		let state = applyTranscriptEvent(emptyTranscriptState(), { type: "agent_start" });
		state = applyTranscriptEvent(state, { type: "turn_end" });
		expect(state.working).toBe(true);
		state = applyTranscriptEvent(state, { type: "agent_end" });
		expect(state.working).toBe(false);
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

	it("silent aborts (plan approval, TTSR) render no stop row; plain aborts still do", () => {
		const rowsFor = (message: AssistantMessage) => {
			let state = applyV3Event(emptyTranscriptState(), { type: "msg_start", sid: 1, message });
			state = applyV3Event(state, { type: "msg_end", sid: 1, message });
			return buildTranscriptRows(state).filter(r => r.kind === "stop");
		};
		expect(
			rowsFor(makeAssistantMessage([], { stopReason: "aborted", errorMessage: "__omp.silent_abort__" })),
		).toEqual([]);
		// TTSR stamps only the structural flag (SilentAbort | Class).
		expect(rowsFor(makeAssistantMessage([], { stopReason: "aborted", errorId: 0x0200_1000 }))).toEqual([]);
		expect(rowsFor(makeAssistantMessage([], { stopReason: "aborted" }))).toHaveLength(1);
	});

	it("tool_output with replace resets partialResult instead of appending", () => {
		let state = applyV3Event(emptyTranscriptState(), { type: "tool_output", toolCallId: "w", text: "poll 1" });
		state = applyV3Event(state, { type: "tool_output", toolCallId: "w", text: " more" });
		expect(state.activeTools.get("w")?.partialResult).toBe("poll 1 more");
		state = applyV3Event(state, { type: "tool_output", toolCallId: "w", text: "poll 2", replace: true });
		expect(state.activeTools.get("w")?.partialResult).toBe("poll 2");
	});
});

describe("transcript-model: todo consecutive run grouping", () => {
	it("groups a run of N consecutive todo calls into one row item with last call's state", () => {
		resetFinishedEntryCache();
		let state = emptyTranscriptState();

		// Assistant message with a thinking block followed by 8 consecutive todo calls,
		// with an intermediate thinking block between call 4 and 5
		const toolCalls = Array.from({ length: 8 }, (_, idx) => ({
			type: "toolCall" as const,
			id: `call-todo-${idx + 1}`,
			name: "todo",
			arguments: { op: idx === 0 ? "init" : "block", task: `Task ${idx + 1}` },
			intent: `Step ${idx + 1}`,
		}));

		const content = [
			{ type: "thinking" as const, thinking: "Planning tasks..." },
			toolCalls[0],
			toolCalls[1],
			toolCalls[2],
			toolCalls[3],
			{ type: "thinking" as const, thinking: "Intermediate reasoning..." },
			toolCalls[4],
			toolCalls[5],
			toolCalls[6],
			toolCalls[7],
		];

		const assistantEntry: SessionEntry = {
			id: "entry-a1",
			parentId: null,
			timestamp: "2026-09-25T03:57:47.100Z",
			type: "message",
			message: makeAssistantMessage(content),
		};

		const toolResultEntries: SessionEntry[] = Array.from({ length: 8 }, (_, i) => ({
			id: `entry-tr-${i + 1}`,
			parentId: "entry-a1",
			timestamp: "2026-09-25T03:57:48.000Z",
			type: "message",
			message: {
				role: "toolResult",
				toolCallId: `call-todo-${i + 1}`,
				toolName: "todo",
				content: [{ type: "text", text: `Done step ${i + 1}` }],
				isError: false,
				timestamp: 1000 + i,
				details: {
					phases: [
						{
							name: "Main",
							tasks: Array.from({ length: i + 1 }, (_, t) => ({
								content: `Task ${t + 1}`,
								status: "pending",
							})),
						},
					],
				},
			},
		}));

		state = { ...state, entries: [assistantEntry, ...toolResultEntries] };
		const rows = buildTranscriptRows(state);

		// Leading thinking row is preserved, intermediate thinking is absorbed.
		// Exactly 2 rows: thinking + single coalesced todo card.
		expect(rows).toHaveLength(2);
		expect(rows[0].kind).toBe("thinking");
		expect(rows[1].kind).toBe("tool-call");
		const todoRow = rows[1] as ToolCallItem;
		expect(todoRow.name).toBe("todo");
		expect(todoRow.groupCount).toBe(8);
		// Row key stays stable: must equal the FIRST call's key
		expect(todoRow.id).toBe("entry-a1-tc-call-todo-1");
		// State reflects the LAST call (call-todo-8)
		expect(todoRow.toolCallId).toBe("call-todo-8");
		expect(todoRow.args).toEqual({ op: "block", task: "Task 8" });
		expect(todoRow.intent).toBe("Step 8");
		expect(todoRow.result?.details).toEqual({
			phases: [
				{
					name: "Main",
					tasks: Array.from({ length: 8 }, (_, t) => ({
						content: `Task ${t + 1}`,
						status: "pending",
					})),
				},
			],
		});
	});

	it("breaks todo group when interrupted by assistant text", () => {
		resetFinishedEntryCache();
		let state = emptyTranscriptState();

		const content = [
			{ type: "toolCall" as const, id: "c1", name: "todo", arguments: { op: "start", task: "A" } },
			{ type: "toolCall" as const, id: "c2", name: "todo", arguments: { op: "block", task: "B" } },
			{ type: "text" as const, text: "I have updated the first two tasks." },
			{ type: "toolCall" as const, id: "c3", name: "todo", arguments: { op: "block", task: "C" } },
			{ type: "toolCall" as const, id: "c4", name: "todo", arguments: { op: "block", task: "D" } },
		];

		state = {
			...state,
			entries: [
				{
					id: "entry-a1",
					parentId: null,
					timestamp: "2026-09-25T03:57:47.100Z",
					type: "message",
					message: makeAssistantMessage(content),
				},
			],
		};

		const rows = buildTranscriptRows(state);
		expect(rows).toHaveLength(3);

		// Group 1
		expect(rows[0].kind).toBe("tool-call");
		const g1 = rows[0] as ToolCallItem;
		expect(g1.id).toBe("entry-a1-tc-c1");
		expect(g1.toolCallId).toBe("c2");
		expect(g1.groupCount).toBe(2);

		// Intervening text
		expect(rows[1].kind).toBe("assistant-text");

		// Group 2
		expect(rows[2].kind).toBe("tool-call");
		const g2 = rows[2] as ToolCallItem;
		expect(g2.id).toBe("entry-a1-tc-c3");
		expect(g2.toolCallId).toBe("c4");
		expect(g2.groupCount).toBe(2);
	});

	it("extends todo group live as streaming deltas append new todo calls while keeping stable id", () => {
		let state = emptyTranscriptState();

		// Live stream starts with 1 todo call
		state = applyV3Event(state, {
			type: "msg_start",
			sid: 10,
			message: makeAssistantMessage([{ type: "toolCall", id: "live-c1", name: "todo", arguments: { op: "init" } }]),
		});

		let rows = buildTranscriptRows(state);
		expect(rows).toHaveLength(1);
		expect(rows[0].kind).toBe("tool-call");
		const initialTodo = rows[0] as ToolCallItem;
		expect(initialTodo.id).toBe("live:0:10-tc-live-c1");
		expect(initialTodo.groupCount).toBe(1);
		expect(initialTodo.toolCallId).toBe("live-c1");

		// Stream appends block 1: another todo call
		state = applyV3Event(state, {
			type: "block_start",
			sid: 10,
			block: 1,
			start: { type: "toolCall", id: "live-c2", name: "todo" },
		});
		// Stream delivers block_end for block 1: parsed arguments
		state = applyV3Event(state, {
			type: "block_end",
			sid: 10,
			block: 1,
			content: { type: "toolCall", id: "live-c2", name: "todo", arguments: { op: "start", task: "T1" } },
		});

		rows = buildTranscriptRows(state);
		expect(rows).toHaveLength(1);
		const secondTodo = rows[0] as ToolCallItem;
		// CRITICAL: row key stays identical to anchor the virtual list
		expect(secondTodo.id).toBe("live:0:10-tc-live-c1");
		expect(secondTodo.groupCount).toBe(2);
		expect(secondTodo.toolCallId).toBe("live-c2");
		expect(secondTodo.args).toEqual({ op: "start", task: "T1" });

		// Stream appends block 2: a third todo call
		state = applyV3Event(state, {
			type: "block_start",
			sid: 10,
			block: 2,
			start: { type: "toolCall", id: "live-c3", name: "todo" },
		});
		state = applyV3Event(state, {
			type: "block_end",
			sid: 10,
			block: 2,
			content: { type: "toolCall", id: "live-c3", name: "todo", arguments: { op: "done", task: "T1" } },
		});

		rows = buildTranscriptRows(state);
		expect(rows).toHaveLength(1);
		const thirdTodo = rows[0] as ToolCallItem;
		expect(thirdTodo.id).toBe("live:0:10-tc-live-c1");
		expect(thirdTodo.groupCount).toBe(3);
		expect(thirdTodo.toolCallId).toBe("live-c3");
		expect(thirdTodo.args).toEqual({ op: "done", task: "T1" });
	});

	it("merges todo run across a page boundary on history prepend without duplicate rows", () => {
		resetFinishedEntryCache();
		let state = emptyTranscriptState();
		// Initial (newer) history page has an entry with todo3 and todo4
		state = applyHistoryPage(
			state,
			{
				entries: [
					{
						id: "entry-newer",
						parentId: "entry-older",
						timestamp: "2026-09-25T03:58:00.000Z",
						type: "message",
						message: makeAssistantMessage([
							{ type: "toolCall", id: "c3", name: "todo", arguments: { op: "block", task: "T3" } },
							{ type: "toolCall", id: "c4", name: "todo", arguments: { op: "block", task: "T4" } },
						]),
					},
				],
				hasMore: true,
				leafId: null,
				live: [],
			},
			{ older: false },
		);
		const initialRows = buildTranscriptRows(state);
		expect(initialRows).toHaveLength(1);
		expect((initialRows[0] as ToolCallItem).groupCount).toBe(2);
		expect(initialRows[0].id).toBe("entry-newer-tc-c3");

		// Now an older history page is prepended with todo1 and todo2
		state = applyHistoryPage(
			state,
			{
				entries: [
					{
						id: "entry-older",
						parentId: null,
						timestamp: "2026-09-25T03:57:00.000Z",
						type: "message",
						message: makeAssistantMessage([
							{ type: "toolCall", id: "c1", name: "todo", arguments: { op: "init" } },
							{ type: "toolCall", id: "c2", name: "todo", arguments: { op: "block", task: "T2" } },
						]),
					},
				],
				hasMore: false,
				leafId: null,
				live: [],
			},
			{ older: true },
		);
		const mergedRows = buildTranscriptRows(state);
		// Spans across page boundary: merges into 1 unified card
		expect(mergedRows).toHaveLength(1);
		const merged = mergedRows[0] as ToolCallItem;
		expect(merged.groupCount).toBe(4);
		// Stable key is the first call in the merged group
		expect(merged.id).toBe("entry-older-tc-c1");
		// State is the last call in the group
		expect(merged.toolCallId).toBe("c4");
		expect(merged.args).toEqual({ op: "block", task: "T4" });
	});
});

describe("transcript-model: injected rule rows", () => {
	const interrupt: SessionEntry = {
		id: "rule-c1",
		parentId: "entry-u1",
		timestamp: "2026-09-29T05:21:11.860Z",
		type: "custom_message",
		customType: "ttsr-injection",
		content: '<system-interrupt rule="doe">DOE body</system-interrupt>',
		display: false,
		details: { rules: ["doe"] },
	};
	const interruptNames: SessionEntry = {
		id: "rule-n1",
		parentId: "rule-c1",
		timestamp: "2026-09-29T05:21:11.865Z",
		type: "ttsr_injection",
		injectedRules: ["doe"],
	};
	const reminderNames: SessionEntry = {
		id: "rule-n2",
		parentId: "rule-n1",
		timestamp: "2026-09-29T05:31:16.155Z",
		type: "ttsr_injection",
		injectedRules: ["ts-no-tiny-functions", "ts-no-inline-cast-access"],
	};
	const otherCustom: SessionEntry = {
		id: "other-c1",
		parentId: "rule-n2",
		timestamp: "2026-09-29T05:32:00.000Z",
		type: "custom_message",
		customType: "irc",
		content: "not a rule",
		display: false,
	};

	it("shows an interrupt once with its text and a non-interrupting injection as a marker, live", () => {
		resetFinishedEntryCache();
		let state = emptyTranscriptState();
		for (const entry of [USER_ENTRY, interrupt, interruptNames, reminderNames, otherCustom]) {
			state = applyV3Event(state, { type: "entry", entry });
		}
		const rows = buildTranscriptRows(state).filter(r => r.kind !== "user");
		expect(rows).toEqual([
			{
				kind: "developer",
				label: "rule interrupt: doe",
				content: '<system-interrupt rule="doe">DOE body</system-interrupt>',
				timestamp: "2026-09-29T05:21:11.860Z",
				id: "rule-c1",
			},
			{ kind: "marker", text: "rules: ts-no-tiny-functions, ts-no-inline-cast-access", id: "rule-n2" },
		]);
	});
});
