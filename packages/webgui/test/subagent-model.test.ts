import { describe, expect, test } from "bun:test";
import type { RpcSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import {
	EMPTY_SUBAGENT_STATE,
	SUBAGENT_SUBSCRIBE_COMMAND,
	applySubagentEvent,
	toAgentsPanelData,
} from "../src/lib/subagent-model";

describe("subagent-model", () => {
	test("lifecycle start for parent and nested child, progress, then end", () => {
		let state = EMPTY_SUBAGENT_STATE;

		// Parent starts
		const parentStart: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "agent-1",
				agent: "task",
				agentSource: "bundled",
				description: "ParentAgent",
				status: "started",
				index: 0,
			},
		};
		state = applySubagentEvent(state, parentStart);

		expect(state.agents.size).toBe(1);
		const parent = state.agents.get("agent-1")!;
		expect(parent.snapshot.status).toBe("running");
		expect(parent.snapshot.displayName).toBe("ParentAgent");
		expect(parent.snapshot.kind).toBe("sub");

		// Child starts, nested under parent via parentToolCallId
		const childStart: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "agent-2",
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
		const child = state.agents.get("agent-2")!;
		expect(child.snapshot.status).toBe("running");
		expect(child.snapshot.displayName).toBe("ChildAgent");
		expect(child.snapshot.parentId).toBe("tool-call-1");

		// Progress frame for child
		const progressFrame: RpcSessionEventFrame = {
			type: "subagent_progress",
			payload: {
				index: 1,
				agent: "scout",
				agentSource: "bundled",
				task: "Searching codebase",
				progress: {
					index: 1,
					id: "agent-2",
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

		const childAfterProgress = state.agents.get("agent-2")!;
		expect(childAfterProgress.progress).toBeDefined();
		expect(childAfterProgress.progress!.progress.lastIntent).toBe("Reading files");
		expect(childAfterProgress.snapshot.status).toBe("running");

		// Child ends
		const childEnd: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "agent-2",
				agent: "scout",
				agentSource: "bundled",
				description: "ChildAgent",
				status: "completed",
				parentToolCallId: "tool-call-1",
				index: 1,
			},
		};
		state = applySubagentEvent(state, childEnd);

		const childDone = state.agents.get("agent-2")!;
		expect(childDone.snapshot.status).toBe("parked");
		// Progress preserved after lifecycle end
		expect(childDone.progress).toBeDefined();

		// Parent still running
		expect(state.agents.get("agent-1")!.snapshot.status).toBe("running");

		// Projection to panel data
		const data = toAgentsPanelData(state);
		expect(data.agents).toHaveLength(2);
		expect(data.progress.size).toBe(1);
		expect(data.lifecycle.size).toBe(2);
	});

	test("unrelated events are ignored", () => {
		const state = EMPTY_SUBAGENT_STATE;
		const event = { type: "agent_start" } as unknown as RpcSessionEventFrame;
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
