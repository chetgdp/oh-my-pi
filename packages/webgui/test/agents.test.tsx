import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { RpcSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { AgentDrawer } from "../src/components/agents/AgentDrawer";
import { EMPTY_SUBAGENT_STATE, applySubagentEvent } from "../src/lib/subagent-model";

describe("AgentDrawer", () => {
	test("renders both agent labels", () => {
		let state = EMPTY_SUBAGENT_STATE;

		const start1: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "a1",
				agent: "task",
				agentSource: "bundled",
				description: "BuildWorker",
				status: "started",
				index: 0,
			},
		};
		state = applySubagentEvent(state, start1);

		const start2: RpcSessionEventFrame = {
			type: "subagent_lifecycle",
			payload: {
				id: "a2",
				agent: "scout",
				agentSource: "bundled",
				description: "SearchHelper",
				status: "started",
				parentToolCallId: "tc-1",
				index: 1,
			},
		};
		state = applySubagentEvent(state, start2);

		const html = renderToStaticMarkup(
			<AgentDrawer state={state} open={true} onClose={() => {}} />,
		);

		expect(html).toContain("BuildWorker");
		expect(html).toContain("SearchHelper");
		expect(html).toContain("Subagents");
	});

	test("renders nothing when closed", () => {
		const html = renderToStaticMarkup(
			<AgentDrawer state={EMPTY_SUBAGENT_STATE} open={false} onClose={() => {}} />,
		);
		expect(html).toBe("");
	});
});
