import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { todoRenderer, TodoTree } from "../src/components/transcript/tool-views/tools/todo";
import type { TodoPhase } from "../src/lib/todo-model";

describe("todo renderer", () => {
	it("has defaultOpen set to true", () => {
		expect(todoRenderer.defaultOpen).toBe(true);
	});

	it("renders summary with small count when groupCount > 1", () => {
		const Summary = todoRenderer.Summary;
		const html = renderToStaticMarkup(
			<Summary
				name="todo"
				args={{ op: "block", task: "GUI badge shows in sessions list" }}
				groupCount={8}
			/>,
		);

		expect(html).toContain("8 updates");
		expect(html).toContain("GUI badge shows in sessions list");
	});

	it("renders summary with standard op badge when groupCount is 1 or absent", () => {
		const Summary = todoRenderer.Summary;
		const html = renderToStaticMarkup(
			<Summary
				name="todo"
				args={{ op: "init", task: "Setup project" }}
			/>,
		);

		expect(html).toContain("init");
		expect(html).toContain("Setup project");
		expect(html).not.toContain("updates");
	});

	it("renders error result text when result is an error", () => {
		const Body = todoRenderer.Body!;
		const html = renderToStaticMarkup(
			<Body
				name="todo"
				args={{ op: "block", task: "Task 1" }}
				result={{
					content: [{ type: "text", text: "Phase 'Invalid' not found" }],
					isError: true,
					details: {
						phases: [{ name: "Main", tasks: [{ content: "Task 1", status: "pending" }] }],
					},
				}}
			/>,
		);

		expect(html).toContain("Phase &#x27;Invalid&#x27; not found");
		expect(html).not.toContain("TODO");
	});

	it("renders terminal-styled todo tree with active phase, tasks, markers, and suffixes", () => {
		const phases: TodoPhase[] = [
			{
				name: "Session controls",
				tasks: [
					{ content: "Rename session by tapping title", status: "completed" },
					{ content: "Rewind to an earlier user message", status: "abandoned" },
				],
			},
			{
				name: "Todo panel",
				tasks: [
					{ content: "Status strip shows todo progress", status: "completed" },
					{ content: "Tap an item to change its status", status: "in_progress" },
				],
			},
			{
				name: "GUI tmux",
				tasks: [
					{ content: "Launch from GUI lands in ompgui session", status: "blocked" },
					{ content: "Shutdown closes the tmux window", status: "blocked", blocker: "Need tmux hook" },
					{ content: "GUI badge shows in sessions list", status: "pending" },
				],
			},
		];

		const html = renderToStaticMarkup(<TodoTree phases={phases} />);

		// Root header
		expect(html).toContain("TODO");

		// Phase 1 is inactive (all closed: 2/2): rendered as dim summary
		expect(html).toContain("I. Session controls · 2/2");
		expect(html).toContain("tv-todo-phase--dim");
		// Tasks of Phase 1 are not rendered in the tree body (only active phase tasks are expanded)
		expect(html).not.toContain("Rename session by tapping title");

		// Phase 2 contains in_progress task -> selected as active phase!
		expect(html).toContain("II. Todo panel · 1/2");
		expect(html).toContain("tv-todo-phase--active");

		// Tasks of Phase 2 are rendered with markers and suffixes
		expect(html).toContain("Status strip shows todo progress");
		expect(html).toContain("☑"); // completed marker
		expect(html).toContain("Tap an item to change its status");
		expect(html).toContain("☐"); // unchecked marker
		expect(html).toContain("(in progress)"); // in_progress suffix

		// Phase 3 is inactive (open tasks but Phase 2 had in_progress): dim summary
		expect(html).toContain("III. GUI tmux · 0/3");

		// Tree footer
		expect(html).toContain(" └──");
	});

	it("renders active phase with blocked suffixes and proper tree connectors", () => {
		// When Phase 3 is active (e.g. no in_progress, first open is Phase 3 or all open in Phase 3)
		const phases: TodoPhase[] = [
			{
				name: "Session controls",
				tasks: [{ content: "Task A", status: "completed" }],
			},
			{
				name: "Todo panel",
				tasks: [{ content: "Task B", status: "completed" }],
			},
			{
				name: "GUI tmux",
				tasks: [
					{ content: "Launch from GUI lands in ompgui session", status: "blocked" },
					{ content: "Shutdown closes the tmux window", status: "blocked" },
					{ content: "GUI badge shows in sessions list", status: "blocked" },
				],
			},
		];

		const html = renderToStaticMarkup(<TodoTree phases={phases} />);

		// Active phase is GUI tmux
		expect(html).toContain("III. GUI tmux · 0/3");
		expect(html).toContain("Launch from GUI lands in ompgui session");
		expect(html).toContain("(blocked)");
		expect(html).toContain("Shutdown closes the tmux window");
		expect(html).toContain("GUI badge shows in sessions list");

		// Connectors: intermediate tasks use " │   ├─ ", last task uses " │   └─ "
		expect(html).toContain(" │   ├─ ");
		expect(html).toContain(" │   └─ ");
		expect(html).toContain(" └──");
	});
});
