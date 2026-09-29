import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolView } from "../src/components/transcript/tool-views/ToolView";
import { applyV3Event, emptyTranscriptState } from "../src/lib/transcript-model";

const nested = {
	progress: [
		{
			id: "Alpha",
			status: "running",
			description: "outer agent",
			extractedToolData: {
				task: [{ results: [{ id: "Alpha.Done", exitCode: 0, description: "finished child", output: "ok" }] }],
			},
			inflightTaskDetails: { progress: [{ id: "Alpha.Beta", status: "running", description: "inner agent" }] },
		},
	],
};

describe("task live details", () => {
	it("renders nested progress for a running card", () => {
		const html = renderToStaticMarkup(<ToolView name="task" args={{}} running liveDetails={nested} defaultOpen />);
		expect(html).toContain("outer agent");
		expect(html).toContain("inner agent");
		expect(html).toContain("finished child");
	});

	it("caps the nested depth and guards cycles", () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.progress = [{ id: "Loop", status: "running", inflightTaskDetails: cyclic }];
		const html = renderToStaticMarkup(<ToolView name="task" args={{}} running liveDetails={cyclic} defaultOpen />);
		expect(html).toContain("already shown");

		let deep: Record<string, unknown> = { progress: [{ id: "Leaf", status: "running" }] };
		for (let i = 0; i < 12; i++) deep = { progress: [{ id: `L${i}`, status: "running", inflightTaskDetails: deep }] };
		const deepHtml = renderToStaticMarkup(<ToolView name="task" args={{}} running liveDetails={deep} defaultOpen />);
		expect(deepHtml).toContain("depth limit reached");
		expect(deepHtml).not.toContain("Leaf");
	});

	it("collapses to 4 rows with a more-agents affordance", () => {
		const many = {
			progress: [
				{
					id: "P",
					status: "running",
					inflightTaskDetails: {
						progress: Array.from({ length: 6 }, (_, i) => ({ id: `P.c${i}`, status: "running" })),
					},
				},
			],
		};
		const html = renderToStaticMarkup(<ToolView name="task" args={{}} running liveDetails={many} defaultOpen />);
		expect(html).toContain("… 2 more agents");
		expect(html).toContain("P&gt;c5");
		expect(html).not.toContain("P&gt;c0");
	});

	it("reducer keeps the latest details snapshot across text-only frames", () => {
		let state = applyV3Event(emptyTranscriptState(), {
			type: "tool_output",
			toolCallId: "t1",
			text: "",
			details: nested,
		});
		state = applyV3Event(state, { type: "tool_output", toolCallId: "t1", text: "more" });
		expect(state.activeTools.get("t1")?.liveDetails).toEqual(nested);
		expect(state.activeTools.get("t1")?.partialResult).toBe("more");
	});
});
