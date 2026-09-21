import { describe, expect, test } from "bun:test";
import type { RpcSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import {
	EMPTY_SUBAGENT_STATE,
	applySubagentEvent,
	buildChildrenMap,
} from "../src/lib/subagent-model";

describe("buildChildrenMap", () => {
	test("tree projection places child under parent via parentToolCallId", () => {
		let state = EMPTY_SUBAGENT_STATE;

		// Parent agent (no parentToolCallId)
		const start1: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "parent-1",
				agent: "task",
				agentSource: "bundled",
				description: "Coordinator",
				status: "started",
				index: 0,
			},
		};
		state = applySubagentEvent(state, start1);

		// Child agent with parentToolCallId pointing to parent-1
		const start2: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "child-1",
				agent: "scout",
				agentSource: "bundled",
				description: "SearchHelper",
				status: "started",
				parentToolCallId: "parent-1",
				index: 1,
			},
		};
		state = applySubagentEvent(state, start2);

		// Another child of parent-1
		const start3: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "child-2",
				agent: "task",
				agentSource: "bundled",
				description: "BuildWorker",
				status: "started",
				parentToolCallId: "parent-1",
				index: 2,
			},
		};
		state = applySubagentEvent(state, start3);

		const children = buildChildrenMap(state);

		// parent-1 is a root (empty-string key)
		const roots = children.get("");
		expect(roots).toBeDefined();
		expect(roots).toContain("parent-1");

		// parent-1 has two children
		const parentChildren = children.get("parent-1");
		expect(parentChildren).toBeDefined();
		expect(parentChildren).toHaveLength(2);
		expect(parentChildren).toContain("child-1");
		expect(parentChildren).toContain("child-2");

		// Children are not roots
		expect(roots).not.toContain("child-1");
		expect(roots).not.toContain("child-2");
	});

	test("agents without parentToolCallId are roots", () => {
		let state = EMPTY_SUBAGENT_STATE;

		const start1: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "a1",
				agent: "task",
				agentSource: "bundled",
				description: "One",
				status: "started",
				index: 0,
			},
		};
		state = applySubagentEvent(state, start1);

		const start2: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "a2",
				agent: "task",
				agentSource: "bundled",
				description: "Two",
				status: "started",
				index: 1,
			},
		};
		state = applySubagentEvent(state, start2);

		const children = buildChildrenMap(state);
		const roots = children.get("");
		expect(roots).toHaveLength(2);
		expect(roots).toContain("a1");
		expect(roots).toContain("a2");
	});
});
