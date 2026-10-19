import { describe, expect, it } from "bun:test";
import type { RpcServerSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { type LiveLineInput, liveLine } from "../src/lib/live-line";
import type { ActiveTool } from "../src/lib/transcript-model";
import type { PendingDialog } from "../src/lib/session-store";
import { applyV3Event, emptyTranscriptState } from "../src/lib/transcript-model";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";

function input(overrides: Partial<LiveLineInput["snapshot"]> = {}, rest: Partial<LiveLineInput> = {}): LiveLineInput {
	return {
		snapshot: {
			connection: "ready",
			streaming: false,
			transcript: emptyTranscriptState(),
			turnStartedAt: null,
			idleSince: 100,
			compactionStartedAt: null,
			attentionSince: null,
			hostTools: new Map(),
			dialogs: [],
			planReview: null,
			sessionState: {
				contextUsage: { percent: 41, tokens: 0, contextWindow: 1 },
			} as unknown as RpcServerSessionState,
			stats: { cost: 0.47 } as LiveLineInput["snapshot"]["stats"],
			...overrides,
		},
		focus: null,
		...rest,
	};
}

describe("liveLine", () => {
	it("idle shows idle time, context and cost", () => {
		expect(liveLine(input())).toEqual({
			tone: "normal",
			activity: "idle",
			elapsedFrom: 100,
			ctxPercent: 41,
			ctxLevel: "warning",
			cost: "$0.470",
			retryAt: null,
		});
	});

	it("busy names the newest running tool", () => {
		const transcript = emptyTranscriptState();
		const tools = new Map<string, ActiveTool>([
			["a", { toolCallId: "a", toolName: "read", args: {}, startedAt: 10 }],
			["b", { toolCallId: "b", toolName: "bash", args: {}, startedAt: 20 }],
		]);
		const line = liveLine(
			input({ streaming: true, turnStartedAt: 5, transcript: { ...transcript, activeTools: tools } }),
		);
		expect(line.tone).toBe("normal");
		expect(line.activity).toBe("bash");
		expect(line.elapsedFrom).toBe(20);
		const between = liveLine(input({ streaming: true, turnStartedAt: 5 }));
		expect(between.activity).toBe("working");
		expect(between.elapsedFrom).toBe(5);
	});

	it("host start times win, and host-only tools show after a reload", () => {
		const tools = new Map<string, ActiveTool>([
			["a", { toolCallId: "a", toolName: "read", args: {}, startedAt: 50 }],
		]);
		const hostTools = new Map([["a", { toolName: "read", startedAt: 7 }]]);
		const line = liveLine(
			input({
				streaming: true,
				turnStartedAt: 5,
				transcript: { ...emptyTranscriptState(), activeTools: tools },
				hostTools,
			}),
		);
		expect(line).toMatchObject({ activity: "read", elapsedFrom: 7 });
		const reloaded = liveLine(
			input({ streaming: true, turnStartedAt: 5, hostTools: new Map([["b", { toolName: "bash", startedAt: 6 }]]) }),
		);
		expect(reloaded).toMatchObject({ activity: "bash", elapsedFrom: 6 });
	});

	it("a nameless running tool reads as working", () => {
		const tools = new Map<string, ActiveTool>([["a", { toolCallId: "a", toolName: "", args: {}, startedAt: 10 }]]);
		const line = liveLine(
			input({ streaming: true, turnStartedAt: 5, transcript: { ...emptyTranscriptState(), activeTools: tools } }),
		);
		expect(line).toMatchObject({ activity: "working", elapsedFrom: 5 });
	});

	it("before the first ready the line says connecting, even while retrying", () => {
		for (const connection of ["closed", "connecting", "reconnecting"] as const) {
			const line = liveLine(input({ connection, sessionState: null }, { retry: { attempt: 1, nextRetryAt: 9 } }));
			expect(line).toMatchObject({ tone: "normal", activity: "connecting", elapsedFrom: null, retryAt: null });
		}
	});

	it("names a tool whose output arrives without tool_execution_start (attached mid-tool)", () => {
		// History page: the committed assistant message holding the eval call; no toolResult yet.
		const entry = {
			id: "e1",
			parentId: null,
			timestamp: "2026-10-18T12:00:00.000Z",
			type: "message",
			message: {
				role: "assistant",
				content: [{ type: "toolCall", id: "toolu_eval", name: "eval", arguments: { language: "js" } }],
				stopReason: "toolUse",
				timestamp: 1,
			},
		} as unknown as SessionEntry;
		let transcript = applyV3Event(emptyTranscriptState(), { type: "entry", entry });
		// Live frame after attach: tool_execution_start was emitted before this client connected.
		transcript = applyV3Event(transcript, { type: "tool_output", toolCallId: "toolu_eval", text: "line 1\n" });
		const line = liveLine(input({ streaming: true, turnStartedAt: 5, transcript }));
		expect(line.activity).toBe("eval");
		expect(line.elapsedFrom).toBe(transcript.activeTools.get("toolu_eval")?.startedAt ?? -1);
	});

	it("needs you waits on question or plan", () => {
		const q = liveLine(input({ dialogs: [{ id: "d" } as PendingDialog], attentionSince: 7 }));
		expect(q).toMatchObject({ tone: "wait", activity: "needs you · question", elapsedFrom: 7 });
		const p = liveLine(
			input({ planReview: { reviewId: "r", title: "t", planFilePath: "p", markdown: "" }, attentionSince: 8 }),
		);
		expect(p).toMatchObject({ tone: "wait", activity: "needs you · plan", elapsedFrom: 8 });
	});

	it("offline is bad and carries the retry time", () => {
		const line = liveLine(input({ connection: "reconnecting" }, { retry: { attempt: 2, nextRetryAt: 999 } }));
		expect(line).toEqual({
			tone: "bad",
			activity: "offline · retry 2",
			elapsedFrom: null,
			ctxPercent: null,
			ctxLevel: "normal",
			cost: null,
			retryAt: 999,
		});
	});

	it("compacting is timed from compaction start", () => {
		expect(liveLine(input({ compactionStartedAt: 50, streaming: true }))).toMatchObject({
			tone: "normal",
			activity: "compacting",
			elapsedFrom: 50,
		});
	});

	it("focus is ghost and uses the subagent's context and cost", () => {
		const line = liveLine(
			input({}, { focus: { parentTitle: "WEBGUI", tool: "edit", since: 30, ctxPercent: 88, cost: 0.1 } }),
		);
		expect(line).toMatchObject({
			tone: "ghost",
			activity: "subagent of WEBGUI · edit",
			elapsedFrom: 30,
			ctxPercent: 88,
			ctxLevel: "danger",
			cost: "$0.100",
		});
	});

	it("context level maps 10/25/50 to notice/warning/danger", () => {
		const at = (percent: number) =>
			liveLine(input({ sessionState: { contextUsage: { percent } } as unknown as RpcServerSessionState })).ctxLevel;
		expect(at(9)).toBe("normal");
		expect(at(10)).toBe("notice");
		expect(at(25)).toBe("warning");
		expect(at(50)).toBe("danger");
	});
});
