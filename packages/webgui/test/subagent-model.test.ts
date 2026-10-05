import { describe, expect, test } from "bun:test";
import type { RpcServerSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import {
	EMPTY_SUBAGENT_STATE,
	SUBAGENT_SUBSCRIBE_COMMAND,
	applySubagentEvent,
	mergeSubagentSnapshots,
} from "../src/lib/subagent-model";

describe("subagent-model", () => {
	test("lifecycle start for parent and nested child, progress, then end", () => {
		let state = EMPTY_SUBAGENT_STATE;

		// Parent starts
		const parentStart: RpcServerSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "Alpha",
				agent: "task",
				agentSource: "bundled",
				description: "ParentAgent",
				status: "started",
				index: 0,
			},
		};
		state = applySubagentEvent(state, parentStart);

		expect(state.agents.size).toBe(1);
		const parent = state.agents.get("Alpha")!;
		expect(parent.snapshot.status).toBe("running");
		expect(parent.snapshot.displayName).toBe("ParentAgent");
		expect(parent.snapshot.kind).toBe("sub");

		// Child starts, nested under parent via the dot-nested id (parentToolCallId is a tool call, not an agent)
		const childStart: RpcServerSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "Alpha.Bravo",
				agent: "scout",
				agentSource: "bundled",
				description: "ChildAgent",
				status: "started",
				parentToolCallId: "tool-call-1",
				index: 1,
			},
		};
		state = applySubagentEvent(state, childStart);

		expect(state.agents.size).toBe(2);
		const child = state.agents.get("Alpha.Bravo")!;
		expect(child.snapshot.status).toBe("running");
		expect(child.snapshot.displayName).toBe("ChildAgent");
		expect(child.snapshot.parentId).toBe("Alpha");

		// Progress frame for child
		const progressFrame: RpcServerSessionEventFrame = {
			type: "subagent_progress",
			payload: {
				index: 1,
				agent: "scout",
				agentSource: "bundled",
				task: "Searching codebase",
				progress: {
					index: 1,
					id: "Alpha.Bravo",
					agent: "scout",
					agentSource: "bundled",
					status: "running",
					task: "Searching codebase",
					lastIntent: "Reading files",
					recentTools: [],
					recentOutput: [],
					toolCount: 3,
					requests: 2,
					tokens: 500,
					cost: 0.01,
					durationMs: 1200,
				},
			},
		};
		state = applySubagentEvent(state, progressFrame);

		const childAfterProgress = state.agents.get("Alpha.Bravo")!;
		expect(childAfterProgress.progress).toBeDefined();
		expect(childAfterProgress.progress!.progress.lastIntent).toBe("Reading files");
		expect(childAfterProgress.snapshot.status).toBe("running");

		// Child ends
		const childEnd: RpcServerSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "Alpha.Bravo",
				agent: "scout",
				agentSource: "bundled",
				description: "ChildAgent",
				status: "completed",
				parentToolCallId: "tool-call-1",
				index: 1,
			},
		};
		state = applySubagentEvent(state, childEnd);

		const childDone = state.agents.get("Alpha.Bravo")!;
		expect(childDone.snapshot.status).toBe("parked");
		// Progress preserved after lifecycle end
		expect(childDone.progress).toBeDefined();

		// Parent still running
		expect(state.agents.get("Alpha")!.snapshot.status).toBe("running");
	});

	test("progress for an unseen agent uses its own status, not a running default", () => {
		const frame: RpcServerSessionEventFrame = {
			type: "subagent_progress",
			payload: {
				index: 0,
				agent: "task",
				task: "t",
				parentToolCallId: "toolu_1",
				agentSource: "bundled",
				progress: {
					index: 0,
					id: "A.B.C",
					agent: "task",
					agentSource: "bundled",
					status: "failed",
					task: "t",
					recentTools: [],
					recentOutput: [],
					toolCount: 0,
					requests: 0,
					tokens: 0,
					cost: 0,
					durationMs: 0,
				},
			},
		};
		const node = applySubagentEvent(EMPTY_SUBAGENT_STATE, frame).agents.get("A.B.C")!;
		expect(node.snapshot.status).toBe("aborted");
		expect(node.snapshot.parentId).toBe("A.B");
	});

	test("a revived agent re-runs, then stays listed as finished across the turn-end refetch", () => {
		const lifecycle = (status: "started" | "completed"): RpcServerSessionEventFrame => ({
			type: "subagent_lifecycle",
			payload: {
				id: "Echo",
				agent: "task",
				agentSource: "bundled",
				status,
				parentToolCallId: "toolu_spawn",
				index: 0,
			},
		});
		let state = applySubagentEvent(EMPTY_SUBAGENT_STATE, lifecycle("started"));
		state = applySubagentEvent(state, lifecycle("completed"));
		// Parent turn ends; the server snapshot omits terminal agents.
		state = mergeSubagentSnapshots(state, []);
		expect(state.agents.get("Echo")?.snapshot.status).toBe("parked");

		state = applySubagentEvent(state, lifecycle("started"));
		expect(state.agents.get("Echo")?.snapshot.status).toBe("running");
		state = applySubagentEvent(state, lifecycle("completed"));
		state = mergeSubagentSnapshots(state, []);
		expect([...state.agents.keys()]).toEqual(["Echo"]);
		expect(state.agents.get("Echo")?.snapshot.status).toBe("parked");
	});

	test("turn-end refetch drops an agent last seen running that the server no longer reports", () => {
		const started: RpcServerSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: { id: "Gone", agent: "task", agentSource: "bundled", status: "started", index: 0 },
		};
		const state = mergeSubagentSnapshots(applySubagentEvent(EMPTY_SUBAGENT_STATE, started), []);
		expect(state.agents.size).toBe(0);
	});

	test("unrelated events are ignored", () => {
		const state = EMPTY_SUBAGENT_STATE;
		const event = { type: "agent_start" } as unknown as RpcServerSessionEventFrame;
		const next = applySubagentEvent(state, event);
		expect(next).toBe(state);
	});

	test("SUBAGENT_SUBSCRIBE_COMMAND has correct shape", () => {
		expect(SUBAGENT_SUBSCRIBE_COMMAND.type).toBe("set_subagent_subscription");
		if ("level" in SUBAGENT_SUBSCRIBE_COMMAND) {
			expect(SUBAGENT_SUBSCRIBE_COMMAND.level).toBe("progress");
		}
	});
});
