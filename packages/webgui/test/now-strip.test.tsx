import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { NowStrip } from "../src/components/shell/NowStrip";
import type { PinnedAgentRow } from "../src/lib/pinned-subagents-model";
import type { TodoPhase } from "../src/lib/todo-model";

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
		rerender(next: ReactElement) {
			act(() => root.render(next));
		},
		cleanup() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

const PHASES: TodoPhase[] = [
	{
		name: "Build",
		tasks: [
			{ content: "Read verdict", status: "completed" },
			{ content: "Copy base", status: "completed" },
			{ content: "Build concept L", status: "in_progress" },
			{ content: "Wire compare page", status: "pending" },
		],
	},
];

const agent = (id: string, status: PinnedAgentRow["status"]): PinnedAgentRow => ({
	id,
	label: id,
	status,
	task: `task of ${id}`,
	lastActivity: 1,
});

const AGENTS = [agent("ComposerAudit", "running"), agent("StripReview", "running"), agent("Old", "idle")];

describe("NowStrip", () => {
	test("renders nothing without todos or running agents", () => {
		const { container, cleanup } = mount(
			<NowStrip
				phases={[]}
				agents={[agent("x", "idle")]}
				expanded={false}
				onToggle={() => {}}
				onFocusAgent={() => {}}
			/>,
		);
		expect(container.innerHTML).toBe("");
		cleanup();
	});

	test("collapsed shows current todo, position and running agent count", () => {
		const { container, cleanup } = mount(
			<NowStrip phases={PHASES} agents={AGENTS} expanded={false} onToggle={() => {}} onFocusAgent={() => {}} />,
		);
		const label = container.querySelector(".now-strip-label");
		expect(label?.textContent).toBe("3 of 4Build concept L");
		expect(container.querySelector(".now-strip-ring")).not.toBeNull();
		expect(container.querySelector(".now-strip-agents")?.textContent).toBe("2");
		expect(container.querySelector(".now-strip-body")).toBeNull();
		cleanup();
	});

	test("without an in-progress todo shows the next one", () => {
		const phases: TodoPhase[] = [
			{
				name: "p",
				tasks: [
					{ content: "a", status: "completed" },
					{ content: "b", status: "pending" },
				],
			},
		];
		const { container, cleanup } = mount(
			<NowStrip phases={phases} agents={[]} expanded={false} onToggle={() => {}} onFocusAgent={() => {}} />,
		);
		const label = container.querySelector(".now-strip-label");
		expect(label?.classList.contains("done")).toBe(true);
		expect(label?.textContent).toBe("2 of 2Next: b");
		expect(container.querySelector(".now-strip-agents")).toBeNull();
		cleanup();
	});

	test("head toggles; expanded lists todos and running agents that focus on tap", () => {
		let expanded = false;
		const focused: string[] = [];
		const ui = () => (
			<NowStrip
				phases={PHASES}
				agents={AGENTS}
				expanded={expanded}
				onToggle={() => {
					expanded = !expanded;
				}}
				onFocusAgent={id => focused.push(id)}
			/>
		);
		const m = mount(ui());
		const head = m.container.querySelector(".now-strip-head") as HTMLButtonElement;
		expect(head.getAttribute("aria-expanded")).toBe("false");
		act(() => head.click());
		expect(expanded).toBe(true);
		m.rerender(ui());
		expect(m.container.querySelector(".now-strip-head")?.getAttribute("aria-expanded")).toBe("true");
		const todos = Array.from(m.container.querySelectorAll(".now-strip-todo"));
		expect(todos.map(t => t.textContent)).toEqual(PHASES[0].tasks.map(t => t.content));
		expect(todos.filter(t => t.classList.contains("done")).length).toBe(2);
		expect(todos[2].classList.contains("cur")).toBe(true);
		const rows = Array.from(m.container.querySelectorAll(".now-strip-agent")) as HTMLButtonElement[];
		expect(rows.length).toBe(2);
		act(() => rows[1].click());
		expect(focused).toEqual(["StripReview"]);
		act(() => (m.container.querySelector(".now-strip-head") as HTMLButtonElement).click());
		expect(expanded).toBe(false);
		m.cleanup();
	});
});
