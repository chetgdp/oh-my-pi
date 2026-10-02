import { describe, expect, test } from "bun:test";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { RpcSubagentMessagesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session-events";
import {
	applyFocusChunk,
	applyFocusEvent,
	detachMessage,
	escapeAction,
	eventPersistsEntries,
	gateFocusedSubmit,
	initialFocusWatch,
	isFocusable,
	resetFocusCursor,
	startFocus,
	watchFocusedAgent,
} from "../src/lib/focus-model";
import { addPendingUser } from "../src/lib/transcript-model";

const roster = (over: Partial<AgentRosterEntry> = {}): AgentRosterEntry => ({
	id: "A.B",
	displayName: "task",
	kind: "sub",
	status: "running",
	createdAt: 1,
	lastActivity: 1,
	...over,
});

function userEntry(id: string, text: string): RpcSubagentMessagesResult["entries"][number] {
	return {
		type: "message",
		id,
		parentId: null,
		timestamp: "2026-01-01T00:00:00Z",
		message: { role: "user", content: text, timestamp: 1 },
	} as RpcSubagentMessagesResult["entries"][number];
}

const header = {
	type: "session",
	id: "hdr",
	version: 3,
	timestamp: "2026-01-01T00:00:00Z",
	cwd: "/",
} as unknown as RpcSubagentMessagesResult["entries"][number];

function chunk(over: Partial<RpcSubagentMessagesResult>): RpcSubagentMessagesResult {
	return {
		sessionFile: "/tmp/a.jsonl",
		fromByte: 0,
		nextByte: 10,
		reset: false,
		fileId: "1:1",
		sentinel: "s",
		entries: [],
		messages: [],
		...over,
	};
}

function assistant(text: string, stopReason = "stop"): never {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		stopReason,
		timestamp: 1,
	} as never;
}

describe("focus history", () => {
	test("first chunk fills entries without the file header and marks loaded", () => {
		const s0 = startFocus("A.B", 1, true);
		expect(s0.loaded).toBe(false);
		expect(s0.transcript.working).toBe(true);
		const s1 = applyFocusChunk(s0, chunk({ entries: [header, userEntry("u1", "hi")] }));
		expect(s1.loaded).toBe(true);
		expect(s1.transcript.entries.map(e => e.id)).toEqual(["u1"]);
		expect(s1.cursor.nextByte).toBe(10);
	});

	test("incremental chunk appends and settles the matching pending user echo", () => {
		let s = startFocus("A.B", 1, false);
		s = applyFocusChunk(s, chunk({ entries: [userEntry("u1", "first")] }));
		s = { ...s, transcript: addPendingUser(s.transcript, "steer me") };
		s = applyFocusChunk(s, chunk({ fromByte: 10, nextByte: 20, entries: [userEntry("u2", "steer me")] }));
		expect(s.transcript.entries.map(e => e.id)).toEqual(["u1", "u2"]);
		expect(s.transcript.pendingUser).toEqual([]);
	});

	test("a stale chunk that does not start at the cursor is ignored", () => {
		let s = startFocus("A.B", 1, false);
		s = applyFocusChunk(s, chunk({ entries: [userEntry("u1", "x")] }));
		const stale = applyFocusChunk(s, chunk({ fromByte: 3, nextByte: 7, entries: [userEntry("u9", "no")] }));
		expect(stale.transcript.entries.map(e => e.id)).toEqual(["u1"]);
		expect(stale.cursor.nextByte).toBe(10);
	});

	test("reset replaces the transcript with the rewritten file", () => {
		let s = startFocus("A.B", 1, false);
		s = applyFocusChunk(s, chunk({ entries: [userEntry("u1", "old")] }));
		s = applyFocusChunk(s, chunk({ reset: true, fromByte: 0, nextByte: 4, entries: [userEntry("n1", "new")] }));
		expect(s.transcript.entries.map(e => e.id)).toEqual(["n1"]);
	});

	test("resetFocusCursor refetches from byte 0 but keeps rendered rows meanwhile", () => {
		let s = startFocus("A.B", 1, false);
		s = applyFocusChunk(s, chunk({ entries: [userEntry("u1", "x")] }));
		const r = resetFocusCursor(s);
		expect(r.cursor.nextByte).toBe(0);
		expect(r.transcript.entries).toHaveLength(1);
	});
});

describe("focus live events", () => {
	const ev = (e: unknown): AgentSessionEvent => e as AgentSessionEvent;

	test("assistant stream shows live, freezes on end, and is superseded by its saved entry", () => {
		let s = startFocus("A.B", 1, false);
		s = applyFocusEvent(s, ev({ type: "agent_start" }));
		expect(s.transcript.working).toBe(true);
		s = applyFocusEvent(s, ev({ type: "message_start", message: assistant("") }));
		s = applyFocusEvent(s, ev({ type: "message_update", message: assistant("hel"), assistantMessageEvent: {} }));
		const streaming = [...s.transcript.live.values()];
		expect(streaming).toHaveLength(1);
		expect(streaming[0].frozen).toBe(false);
		s = applyFocusEvent(s, ev({ type: "message_update", message: assistant("hello"), assistantMessageEvent: {} }));
		expect(s.transcript.live.size).toBe(1);
		s = applyFocusEvent(s, ev({ type: "message_end", message: assistant("hello") }));
		expect([...s.transcript.live.values()][0].frozen).toBe(true);
		s = applyFocusEvent(s, ev({ type: "agent_end", messages: [] }));
		// Frozen row stays through agent_end so the turn never flickers out before the cursor delivers it.
		expect(s.transcript.live.size).toBe(1);
		expect(s.transcript.working).toBe(false);
		s = applyFocusChunk(s, chunk({ entries: [userEntry("u1", "x")] }));
		expect(s.transcript.live.size).toBe(0);
	});

	test("failed frozen turns survive the cursor because they never save", () => {
		let s = startFocus("A.B", 1, false);
		s = applyFocusEvent(s, ev({ type: "message_start", message: assistant("") }));
		s = applyFocusEvent(s, ev({ type: "message_end", message: assistant("boom", "error") }));
		s = applyFocusChunk(s, chunk({ entries: [userEntry("u1", "x")] }));
		expect(s.transcript.live.size).toBe(1);
	});

	test("a mid-stream update without a start adopts the message", () => {
		let s = startFocus("A.B", 1, false);
		s = applyFocusEvent(s, ev({ type: "message_update", message: assistant("partial"), assistantMessageEvent: {} }));
		expect(s.transcript.live.size).toBe(1);
		expect(s.transcript.working).toBe(true);
	});

	test("non-assistant messages are entries only", () => {
		const s = startFocus("A.B", 1, false);
		const next = applyFocusEvent(s, ev({ type: "message_start", message: { role: "user", content: "x" } }));
		expect(next).toBe(s);
	});

	test("tool updates replace partial output and end clears the tool", () => {
		let s = startFocus("A.B", 1, true);
		s = applyFocusEvent(s, ev({ type: "tool_execution_start", toolCallId: "t1", toolName: "bash", args: {} }));
		s = applyFocusEvent(
			s,
			ev({
				type: "tool_execution_update",
				toolCallId: "t1",
				toolName: "bash",
				args: {},
				partialResult: { content: [{ type: "text", text: "line 1" }], details: { n: 1 } },
			}),
		);
		expect(s.transcript.activeTools.get("t1")?.partialResult).toBe("line 1");
		s = applyFocusEvent(
			s,
			ev({
				type: "tool_execution_update",
				toolCallId: "t1",
				toolName: "bash",
				args: {},
				partialResult: { content: [{ type: "text", text: "line 1\nline 2" }] },
			}),
		);
		expect(s.transcript.activeTools.get("t1")?.partialResult).toBe("line 1\nline 2");
		s = applyFocusEvent(s, ev({ type: "tool_execution_end", toolCallId: "t1", toolName: "bash", result: {} }));
		expect(s.transcript.activeTools.size).toBe(0);
	});

	test("an update for a tool that started before focus registers it", () => {
		const s = applyFocusEvent(
			startFocus("A.B", 1, true),
			ev({
				type: "tool_execution_update",
				toolCallId: "t9",
				toolName: "bash",
				args: { command: "sleep 5" },
				partialResult: "out",
			}),
		);
		expect(s.transcript.activeTools.get("t9")).toMatchObject({ toolName: "bash", partialResult: "out" });
	});

	test("agent_end drops running tools and unrelated events are inert", () => {
		let s = startFocus("A.B", 1, true);
		s = applyFocusEvent(s, ev({ type: "tool_execution_start", toolCallId: "t1", toolName: "bash", args: {} }));
		s = applyFocusEvent(s, ev({ type: "agent_end", messages: [] }));
		expect(s.transcript.activeTools.size).toBe(0);
		expect(applyFocusEvent(s, ev({ type: "turn_start" }))).toBe(s);
	});

	test("only events that persist entries trigger a cursor poll", () => {
		expect(eventPersistsEntries(ev({ type: "message_end", message: {} }))).toBe(true);
		expect(eventPersistsEntries(ev({ type: "message_update" }))).toBe(false);
	});
});

describe("auto-detach", () => {
	test("removed, aborted and parked-after-live detach; running and idle stay", () => {
		const live = initialFocusWatch(roster());
		expect(live.sawLive).toBe(true);
		expect(watchFocusedAgent(live, undefined).detach).toBe("gone");
		expect(watchFocusedAgent(live, roster({ status: "aborted" })).detach).toBe("aborted");
		expect(watchFocusedAgent(live, roster({ status: "parked" })).detach).toBe("parked");
		expect(watchFocusedAgent(live, roster({ status: "idle" })).detach).toBeNull();
		expect(watchFocusedAgent(live, roster({ status: "running" })).detach).toBeNull();
	});

	test("a parked agent that is still reviving does not detach until it was seen live", () => {
		let watch = initialFocusWatch(roster({ status: "parked" }));
		expect(watch.sawLive).toBe(false);
		expect(watchFocusedAgent(watch, roster({ status: "parked" })).detach).toBeNull();
		// Removal and abort are terminal regardless.
		expect(watchFocusedAgent(watch, undefined).detach).toBe("gone");
		expect(watchFocusedAgent(watch, roster({ status: "aborted" })).detach).toBe("aborted");
		watch = watchFocusedAgent(watch, roster({ status: "running" })).watch;
		expect(watchFocusedAgent(watch, roster({ status: "parked" })).detach).toBe("parked");
	});

	test("detach message matches the TUI wording", () => {
		expect(detachMessage("A.B", "parked")).toBe("Agent A.B is parked; returned to main session");
		expect(detachMessage("A.B", "gone")).toBe("Agent A.B is gone; returned to main session");
	});
});

describe("entry points", () => {
	test("only live subagents are focusable", () => {
		expect(isFocusable(roster())).toBe(true);
		expect(isFocusable(roster({ status: "parked" }))).toBe(true);
		expect(isFocusable(roster({ status: "aborted" }))).toBe(false);
		expect(isFocusable(roster({ id: "Main", kind: "main" }))).toBe(false);
		expect(isFocusable(undefined)).toBe(false);
	});
});

describe("command gating and Esc", () => {
	test("plain text sends", () => {
		expect(gateFocusedSubmit("please continue")).toEqual({ kind: "send" });
		expect(gateFocusedSubmit("a / b")).toEqual({ kind: "send" });
	});

	test("/usage without args goes to the usage screen; with other subcommands it is refused", () => {
		expect(gateFocusedSubmit("/usage")).toEqual({ kind: "usage" });
		expect(gateFocusedSubmit("/usage show")).toEqual({ kind: "usage" });
		expect(gateFocusedSubmit("/usage reset").kind).toBe("refuse");
	});

	test("other slash and bang commands are refused with the return hint", () => {
		for (const text of ["/model", "/compact now", "!ls"]) {
			const gate = gateFocusedSubmit(text);
			expect(gate.kind).toBe("refuse");
			if (gate.kind === "refuse") {
				expect(gate.message).toBe(
					"Only /btw, /export, /usage run here; other commands run in the main session, press Esc to return first",
				);
			}
		}
	});

	test("/export returns export kind while focused", () => {
		expect(gateFocusedSubmit("/export")).toEqual({ kind: "export" });
	});

	test("/btw returns btw kind with question while focused", () => {
		expect(gateFocusedSubmit("/btw why")).toEqual({
			kind: "btw",
			question: "why",
		});
		expect(gateFocusedSubmit("/btw")).toEqual({
			kind: "btw",
			question: "",
		});
	});

	test("Esc clears text or images first and returns only from an empty editor", () => {
		expect(escapeAction("draft", 0)).toBe("clear");
		expect(escapeAction("", 2)).toBe("clear");
		expect(escapeAction("", 0)).toBe("exit");
	});
});
