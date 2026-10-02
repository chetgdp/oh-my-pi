import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { ReactElement } from "react";
import { PinnedSubagents } from "../src/components/agents/PinnedSubagents";
import type { AgentHubState } from "../src/lib/agent-hub-model";
import { pinnedRows } from "../src/lib/pinned-subagents-model";
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
	test("lists subagents of every status in newest-first order, never Main", () => {
		const rows = pinnedRows(
			hubOf(
				entry("Main", { kind: "main" }),
				entry("B", { createdAt: 2 }),
				entry("A", { createdAt: 1 }),
				entry("C", { createdAt: 3, status: "parked" }),
				entry("D", { createdAt: 4, status: "idle" }),
				entry("E", { createdAt: 5, status: "aborted" }),
			),
			EMPTY_SUBAGENT_STATE,
		);
		expect(rows.map(r => r.id)).toEqual(["E", "D", "C", "B", "A"]);
	});

	test("finished agents stay until dismissed; a dismissed agent returns when running again", () => {
		const hub = hubOf(entry("A", { createdAt: 1, status: "idle" }), entry("B", { createdAt: 2 }));
		expect(pinnedRows(hub, EMPTY_SUBAGENT_STATE).map(r => [r.id, r.status])).toEqual([
			["B", "running"],
			["A", "idle"],
		]);
		const dismissed = new Set(["A", "B"]);
		expect(pinnedRows(hub, EMPTY_SUBAGENT_STATE, dismissed).map(r => r.id)).toEqual(["B"]);
	});
	test("row shape: id breadcrumb, role, model without provider or thinking suffix", () => {
		const [bare, suffixed] = pinnedRows(
			hubOf(
				entry("A.B", {
					createdAt: 1,
					agent: "scout",
					resolvedModel: "anthropic/claude-sonnet:low",
					progress: {
						resolvedModel: "anthropic/claude-sonnet:low",
						resolvedModelIdentity: "anthropic/claude-sonnet",
					} as AgentRosterEntry["progress"],
				}),
				entry("C", { createdAt: 2, resolvedModel: "anthropic/claude-opus" }),
			),
			EMPTY_SUBAGENT_STATE,
		);
		expect(suffixed).toMatchObject({ id: "A.B", label: "A>B", role: "scout", model: "claude-sonnet" });
		expect(bare.model).toBe("claude-opus");
	});

	test("falls back to live subagent frames until the roster loads", () => {
		const node = {
			snapshot: { id: "A", displayName: "task", kind: "sub", status: "running", hasSessionFile: false, createdAt: 1, lastActivity: 1 },
			lifecycle: undefined,
			progress: {
				agent: "task",
				progress: {
					id: "A",
					status: "running",
					resolvedModel: "p/m:high",
					resolvedModelIdentity: "p/m",
				},
			},
		} as unknown as SubagentNode;
		const tree: SubagentTreeState = { agents: new Map([["A", node]]) };
		const rows = pinnedRows({ agents: new Map(), loaded: false }, tree);
		expect(rows).toMatchObject([{ id: "A", label: "A", role: "task", model: "m" }]);
	});
});

describe("PinnedSubagents", () => {
	const rows = [
		{ id: "A", label: "A", status: "running" as const, lastActivity: 0 },
		{ id: "B", label: "B", status: "idle" as const, lastActivity: 0 },
	];
	const noop = () => {};

	test("only finished agents get a dismiss button, and it dismisses without focusing", () => {
		const focused: string[] = [];
		const dismissed: string[] = [];
		const m = mount(
			<PinnedSubagents rows={rows} onFocusAgent={id => focused.push(id)} onDismiss={id => dismissed.push(id)} onOpenHub={noop} />,
		);
		const buttons = m.container.querySelectorAll(".pa-dismiss");
		expect(buttons).toHaveLength(1);
		act(() => (buttons[0] as HTMLElement).click());
		expect(dismissed).toEqual(["B"]);
		expect(focused).toEqual([]);
		m.cleanup();
	});

	test("clicking a card focuses that agent; the header button opens the hub", () => {
		const focused: string[] = [];
		let hub = 0;
		const m = mount(
			<PinnedSubagents rows={rows} onFocusAgent={id => focused.push(id)} onDismiss={noop} onOpenHub={() => hub++} />,
		);
		act(() => (m.container.querySelector('[data-agent-id="B"]') as HTMLElement).click());
		expect(focused).toEqual(["B"]);
		act(() => (m.container.querySelector(".pa-hub-btn") as HTMLElement).click());
		expect(hub).toBe(1);
		m.cleanup();
	});

	test("empty state", () => {
		const m = mount(<PinnedSubagents rows={[]} onFocusAgent={noop} onDismiss={noop} onOpenHub={noop} />);
		expect(m.container.textContent).toContain("No subagents");
		m.cleanup();
	});
});
