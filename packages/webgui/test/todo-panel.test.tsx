import { describe, expect, test } from "bun:test";
import "./dom-setup";
import { win } from "./dom-setup";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { TodoPanel } from "../src/components/todos/TodoPanel";
import type { TodoPhase } from "../src/lib/todo-model";

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

const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

function mount(ui: ReactElement) {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

const samplePhases: TodoPhase[] = [
	{
		name: "Phase 1",
		tasks: [
			{ content: "Task A", status: "completed" },
			{ content: "Task B", status: "in_progress" },
			{ content: "Task C", status: "pending" },
		],
	},
];

describe("TodoPanel readOnly", () => {
	test("interactive panel submits an edit when a status button is tapped", async () => {
		const calls: TodoPhase[][] = [];
		const m = mount(<TodoPanel phases={samplePhases} onUpdateTodos={async p => void calls.push(p)} />);
		await act(async () => {
			(m.container.querySelector(".td-status-btn") as HTMLElement).click();
		});
		expect(calls).toHaveLength(1);
		m.cleanup();
	});

	test("read-only panel shows the list but no tap ever submits an edit", async () => {
		const calls: TodoPhase[][] = [];
		const m = mount(<TodoPanel phases={samplePhases} readOnly onUpdateTodos={async p => void calls.push(p)} />);
		expect(m.container.textContent).toContain("Task B");
		expect(m.container.textContent).toContain("1 of 3 tasks closed");
		expect(m.container.querySelector(".td-panel--readonly")).not.toBeNull();
		const buttons = [...m.container.querySelectorAll("button")] as HTMLElement[];
		expect(buttons.length).toBeGreaterThan(0);
		expect(buttons.every(b => (b as HTMLButtonElement).disabled)).toBe(true);
		await act(async () => {
			for (const el of [...buttons, ...(m.container.querySelectorAll(".td-task-row") as unknown as HTMLElement[])])
				el.click();
			(m.container.querySelector(".td-task-row") as HTMLElement).dispatchEvent(
				new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as never,
			);
		});
		expect(calls).toEqual([]);
		m.cleanup();
	});
});
