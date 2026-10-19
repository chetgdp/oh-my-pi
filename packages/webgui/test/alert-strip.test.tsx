import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { AlertStrip } from "../src/components/shell/AlertStrip";
import type { Alert } from "../src/lib/alert-priority";

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

const ALERTS: Alert[] = [
	{ kind: "focus", title: "Viewing subagent ComposerAudit", actions: [{ id: "back", label: "Back to main" }] },
	{ kind: "offline", title: "Offline.", detail: "Draft is kept.", actions: [{ id: "retry", label: "Retry" }] },
	{ kind: "needs-you", title: "Agent asks", detail: "1 of 2", actions: [{ id: "open", label: "Answer" }] },
	{ kind: "needs-you", title: "Plan ready", detail: "6 steps", actions: [{ id: "open", label: "Review" }] },
	{
		kind: "context",
		title: "Context 88%",
		actions: [
			{ id: "handoff", label: "Handoff" },
			{ id: "compact", label: "Compact" },
		],
	},
];

describe("AlertStrip", () => {
	test("renders nothing without an alert", () => {
		const { container, cleanup } = mount(<AlertStrip alert={null} onAction={() => {}} />);
		expect(container.innerHTML).toBe("");
		cleanup();
	});

	for (const alert of ALERTS) {
		test(`${alert.kind} (${alert.title}) renders label and fires actions`, () => {
			const fired: string[] = [];
			const { container, cleanup } = mount(<AlertStrip alert={alert} onAction={id => fired.push(id)} />);
			const strip = container.querySelector(".alert-strip");
			expect(strip?.getAttribute("data-kind")).toBe(alert.kind);
			expect(strip?.textContent).toContain(alert.title);
			if (alert.detail) expect(strip?.textContent).toContain(alert.detail);
			const buttons = Array.from(container.querySelectorAll("button"));
			expect(buttons.map(b => b.textContent)).toEqual(alert.actions.map(a => a.label));
			for (const b of buttons) act(() => b.click());
			expect(fired).toEqual(alert.actions.map(a => a.id));
			cleanup();
		});
	}

	test("compacting renders progress bar and no buttons", () => {
		const { container, cleanup } = mount(
			<AlertStrip
				alert={{ kind: "compacting", title: "Compacting", detail: "41% to about 9%", actions: [], progress: 62 }}
				onAction={() => {}}
			/>,
		);
		expect(container.textContent).toContain("Compacting");
		expect(container.querySelectorAll("button").length).toBe(0);
		const bar = container.querySelector(".alert-strip-bar i") as HTMLElement | null;
		expect(bar?.style.getPropertyValue("width")).toBe("62%");
		cleanup();
	});

	test("tone classes per kind", () => {
		const tones: Record<string, string> = {
			focus: "ghost",
			offline: "bad",
			"needs-you": "warn",
			context: "bad",
		};
		for (const alert of ALERTS) {
			const { container, cleanup } = mount(<AlertStrip alert={alert} onAction={() => {}} />);
			expect(container.querySelector(`.alert-strip-${tones[alert.kind]}`)).not.toBeNull();
			cleanup();
		}
	});
});
