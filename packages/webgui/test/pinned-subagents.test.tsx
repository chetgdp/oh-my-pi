import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { ReactElement } from "react";
import { PinnedSubagents } from "../src/components/agents/PinnedSubagents";
import type { AgentHubState } from "../src/lib/agent-hub-model";
import { layoutPinned, pinnedRows } from "../src/lib/pinned-subagents-model";
import { EMPTY_SUBAGENT_STATE, type SubagentNode, type SubagentTreeState } from "../src/lib/subagent-model";

const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

const entry = (id: string, over: Partial<AgentRosterEntry> = {}): AgentRosterEntry => ({
	id,
	displayName: "task",
	kind: "sub",
	status: "running",
	createdAt: 1,
	lastActivity: 1,
	...over,
});

const hubOf = (...entries: AgentRosterEntry[]): AgentHubState => ({
	agents: new Map(entries.map(e => [e.id, e])),
	loaded: true,
});

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

describe("pinnedRows", () => {
	test("lists only running subagents in creation order", () => {
		const rows = pinnedRows(
			hubOf(
				entry("Main", { kind: "main" }),
				entry("B", { createdAt: 2 }),
				entry("A", { createdAt: 1 }),
				entry("C", { status: "parked" }),
				entry("D", { status: "idle" }),
				entry("E", { status: "aborted" }),
			),
			EMPTY_SUBAGENT_STATE,
		);
		expect(rows.map(r => r.id)).toEqual(["A", "B"]);
	});

	test("row shape: id breadcrumb, role, model without provider, description or 40-char task preview", () => {
		const long = "x".repeat(60);
		const [withDesc, withTask, echo] = pinnedRows(
			hubOf(
				entry("A.B", { createdAt: 1, agent: "scout", resolvedModel: "anthropic/claude-sonnet", description: "inner work" }),
				entry("C", { createdAt: 2, task: long }),
				entry("D-2", { createdAt: 3, description: "D", task: "D" }),
			),
			EMPTY_SUBAGENT_STATE,
		);
		expect(withDesc).toMatchObject({ label: "A>B", role: "scout", model: "claude-sonnet", text: "inner work", textIsPreview: false });
		expect(withTask.text).toHaveLength(40);
		expect(withTask.textIsPreview).toBe(true);
		expect(echo.text).toBeUndefined();
	});

	test("falls back to live subagent frames until the roster loads", () => {
		const node = {
			snapshot: { id: "A", displayName: "task", kind: "sub", status: "running", hasSessionFile: false, createdAt: 1, lastActivity: 1 },
			lifecycle: undefined,
			progress: { agent: "task", progress: { id: "A", task: "do it", status: "running" } },
		} as unknown as SubagentNode;
		const tree: SubagentTreeState = { agents: new Map([["A", node]]) };
		const rows = pinnedRows({ agents: new Map(), loaded: false }, tree);
		expect(rows).toMatchObject([{ id: "A", text: "do it", textIsPreview: true }]);
	});
});

describe("layoutPinned", () => {
	test("three rows fit; more collapse to three plus an expander, expanded shows all", () => {
		expect(layoutPinned(3, false)).toEqual({ itemRows: 3, toggle: undefined });
		expect(layoutPinned(5, false)).toEqual({ itemRows: 3, toggle: "expand" });
		expect(layoutPinned(5, true)).toEqual({ itemRows: 5, toggle: "collapse" });
	});
});

describe("PinnedSubagents", () => {
	const rows = ["A", "B", "C", "D", "E"].map(id => ({ id, label: id, textIsPreview: false }));

	test("collapsed shows three rows and the remainder count; expanding shows all", () => {
		const m = mount(<PinnedSubagents rows={rows} onFocusAgent={() => {}} onOpenHub={() => {}} />);
		expect(m.container.querySelectorAll(".pa-row")).toHaveLength(3);
		const toggle = m.container.querySelector(".pa-toggle") as HTMLElement;
		expect(toggle.textContent).toContain("2 more");
		act(() => toggle.click());
		expect(m.container.querySelectorAll(".pa-row")).toHaveLength(5);
		expect(m.container.querySelector(".pa-toggle")?.textContent).toContain("show less");
		m.cleanup();
	});

	test("clicking a row focuses that agent; the header button opens the hub", () => {
		const focused: string[] = [];
		let hub = 0;
		const m = mount(<PinnedSubagents rows={rows} onFocusAgent={id => focused.push(id)} onOpenHub={() => hub++} />);
		act(() => (m.container.querySelector('[data-agent-id="B"]') as HTMLElement).click());
		expect(focused).toEqual(["B"]);
		act(() => (m.container.querySelector(".pa-hub-btn") as HTMLElement).click());
		expect(hub).toBe(1);
		m.cleanup();
	});

	test("empty state and no expander when nothing runs", () => {
		const m = mount(<PinnedSubagents rows={[]} onFocusAgent={() => {}} onOpenHub={() => {}} />);
		expect(m.container.textContent).toContain("No subagents running");
		expect(m.container.querySelector(".pa-toggle")).toBeNull();
		m.cleanup();
	});
});
