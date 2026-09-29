import { describe, expect, test } from "bun:test";
import type { RpcSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import {
	EMPTY_SUBAGENT_STATE,
	applySubagentEvent,
	buildChildrenMap,
} from "../src/lib/subagent-model";

describe("buildChildrenMap", () => {
	test("tree projection places child under parent via the dot-nested id", () => {
		let state = EMPTY_SUBAGENT_STATE;

		// Parent agent (no parentToolCallId)
		const start1: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "P",
				agent: "task",
				agentSource: "bundled",
				description: "Coordinator",
				status: "started",
				index: 0,
			},
		};
		state = applySubagentEvent(state, start1);

		// Child agent nested under P
		const start2: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "P.C1",
				agent: "scout",
				agentSource: "bundled",
				description: "SearchHelper",
				status: "started",
				index: 1,
			},
		};
		state = applySubagentEvent(state, start2);

		// Another child of parent-1
		const start3: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "P.C2",
				agent: "task",
				agentSource: "bundled",
				description: "BuildWorker",
				status: "started",
				index: 2,
			},
		};
		state = applySubagentEvent(state, start3);

		const children = buildChildrenMap(state);

		// parent-1 is a root (empty-string key)
		const roots = children.get("");
		expect(roots).toBeDefined();
		expect(roots).toContain("P");

		// parent-1 has two children
		const parentChildren = children.get("P");
		expect(parentChildren).toBeDefined();
		expect(parentChildren).toHaveLength(2);
		expect(parentChildren).toContain("P.C1");
		expect(parentChildren).toContain("P.C2");

		// Children are not roots
		expect(roots).not.toContain("P.C1");
		expect(roots).not.toContain("P.C2");
	});

	test("top-level agent ids are roots", () => {
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
