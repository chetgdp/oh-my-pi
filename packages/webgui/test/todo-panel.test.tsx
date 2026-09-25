import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TodoPanel } from "../src/components/todos/TodoPanel";
import { StatusStrip } from "../src/components/shell/StatusStrip";
import type { TodoPhase } from "../src/lib/todo-model";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

describe("TodoPanel component", () => {
	test("renders empty state when no phases provided", () => {
		const html = renderToStaticMarkup(<TodoPanel phases={[]} onUpdateTodos={async () => {}} />);
		expect(html).toContain("No todos");
		expect(html).toContain("td-empty");
	});

	test("renders empty state when phases have no tasks", () => {
		const html = renderToStaticMarkup(
			<TodoPanel phases={[{ name: "Empty", tasks: [] }]} onUpdateTodos={async () => {}} />,
		);
		expect(html).toContain("No todos");
	});

	test("renders phases with roman numerals and tasks with statuses", () => {
		const phases: TodoPhase[] = [
			{
				name: "Foundation",
				tasks: [
					{ content: "Setup schema", status: "completed" },
					{ content: "Implement RPC", status: "in_progress" },
				],
			},
			{
				name: "Validation",
				tasks: [
					{ content: "Write tests", status: "pending" },
					{ content: "Performance bench", status: "abandoned" },
					{ content: "Deploy", status: "blocked", blocker: "Needs credentials" },
				],
			},
		];

		const html = renderToStaticMarkup(<TodoPanel phases={phases} onUpdateTodos={async () => {}} />);

		// Phase headers with roman numerals
		expect(html).toContain("I. Foundation");
		expect(html).toContain("II. Validation");

		// Tasks
		expect(html).toContain("Setup schema");
		expect(html).toContain("Implement RPC");
		expect(html).toContain("Write tests");
		expect(html).toContain("Performance bench");
		expect(html).toContain("Deploy");
		expect(html).toContain("Needs credentials");

		// Status classes
		expect(html).toContain("td-task-row--completed");
		expect(html).toContain("td-task-row--in_progress");
		expect(html).toContain("td-task-row--pending");
		expect(html).toContain("td-task-row--abandoned");
		expect(html).toContain("td-task-row--blocked");

		// Summary: 2 closed (1 completed + 1 abandoned) of 5 total = 40%
		expect(html).toContain("2 of 5 tasks closed");
		expect(html).toContain("40%");
	});
});

describe("StatusStrip todo indicator", () => {
	test("does not render todo progress button when phases are empty", () => {
		const state: Partial<RpcSessionState> = {
			todoPhases: [],
		};
		const html = renderToStaticMarkup(
			<StatusStrip
				sessionState={state as RpcSessionState}
				stats={null}
				streaming={false}
				expandAll={false}
				onToggleExpand={() => {}}
				onPickModel={() => {}}
				onPickThinking={() => {}}
			/>,
		);
		expect(html).not.toContain("ss-todos");
	});

	test("renders compact todo progress button when phases contain tasks", () => {
		const state: Partial<RpcSessionState> = {
			todoPhases: [
				{
					name: "Phase 1",
					tasks: [
						{ content: "Task A", status: "completed" },
						{ content: "Task B", status: "in_progress" },
						{ content: "Task C", status: "pending" },
					],
				},
			],
		};
		const html = renderToStaticMarkup(
			<StatusStrip
				sessionState={state as RpcSessionState}
				stats={null}
				streaming={false}
				expandAll={false}
				onToggleExpand={() => {}}
				onPickModel={() => {}}
				onPickThinking={() => {}}
			/>,
		);
		expect(html).toContain("ss-todos");
		expect(html).toContain("1/3");
	});
});
