import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import type { RpcPlanReview } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { PendingDialog } from "../src/lib/session-store";
// react-dom/client and the components must load after dom-setup installs window/navigator.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { ExtensionDialogSheet } = await import("../src/components/dialog/ExtensionDialogSheet");
const { PlanReviewSheet } = await import("../src/components/plan/PlanReviewSheet");
const { BtwSheet } = await import("../src/components/btw/BtwSheet");
const { PromptDock } = await import("../src/components/composer/PromptDock");
const { Composer } = await import("../src/components/composer/Composer");

const ASK: PendingDialog = {
	type: "extension_ui_request",
	id: "a1",
	method: "ask",
	questions: [
		{
			id: "q1",
			header: "Pick one",
			question: "Which approach?",
			recommended: 1,
			options: [{ label: "Option A" }, { label: "Option B" }, { label: "Option C" }],
		},
	],
} as PendingDialog;

const APPROVAL: PendingDialog = {
	type: "extension_ui_request",
	id: "p1",
	method: "select",
	title: "Allow bash?",
	options: ["Approve", "Deny"],
} as PendingDialog;

const REVIEW = { reviewId: "r1", title: "Plan", markdown: "Step one" } as RpcPlanReview;
const noop = (): void => {};

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
});

function mount(): { container: HTMLElement; render(node: ReactNode): void } {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	return {
		container: container as unknown as HTMLElement,
		render(node) {
			act(() => root.render(node));
		},
	};
}

describe("docked prompts (Clear) vs sheets (Flat)", () => {
	for (const [name, dialog] of [
		["ask", ASK],
		["approval select", APPROVAL],
	] as const) {
		test(`${name}: Flat is a modal sheet with a backdrop`, () => {
			const m = mount();
			m.render(<ExtensionDialogSheet dialog={dialog} queued={0} onAnswer={noop} />);
			expect(m.container.querySelector(".plan-backdrop")).not.toBeNull();
			expect(m.container.querySelector(".is-docked")).toBeNull();
			expect(m.container.querySelector('[role="dialog"]')).not.toBeNull();
		});

		test(`${name}: docked has no backdrop and keeps role=dialog`, () => {
			const m = mount();
			m.render(<ExtensionDialogSheet dialog={dialog} queued={2} onAnswer={noop} docked />);
			expect(m.container.querySelector(".plan-backdrop")).toBeNull();
			const sheet = m.container.querySelector('[role="dialog"]');
			expect(sheet?.className).toContain("is-docked");
			expect(m.container.textContent).toContain("2 more waiting");
		});
	}

	test("docked ask spells out the step and draws one Recommended chip", () => {
		const m = mount();
		m.render(<ExtensionDialogSheet dialog={ASK} queued={0} onAnswer={noop} docked />);
		expect(m.container.textContent).toContain("Question 1 of 1");
		expect(m.container.querySelectorAll(".xdlg-ask-badge").length).toBe(1);
		m.render(<ExtensionDialogSheet dialog={ASK} queued={0} onAnswer={noop} />);
		expect(m.container.textContent).toContain("Q 1 of 1");
	});

	test("plan review and /btw dock without a backdrop", () => {
		const m = mount();
		m.render(<PlanReviewSheet review={REVIEW} docked />);
		expect(m.container.querySelector(".plan-backdrop")).toBeNull();
		expect(m.container.querySelector(".plan-review-sheet.is-docked")).not.toBeNull();
		m.render(
			<BtwSheet
				btw={{ recordId: "b1", question: "why?", answer: "because", status: "complete" } as never}
				onCancel={noop}
				onClose={noop}
				docked
			/>,
		);
		expect(m.container.querySelector(".btw-backdrop")).toBeNull();
		expect(m.container.querySelector(".btw-sheet.is-docked")).not.toBeNull();
		m.render(<PlanReviewSheet review={REVIEW} />);
		expect(m.container.querySelector(".plan-backdrop")).not.toBeNull();
	});
});

describe("PromptDock", () => {
	function composer(): ReactNode {
		return <Composer busy={false} commands={[]} onSend={noop} onAbort={noop} />;
	}

	function textarea(c: HTMLElement): HTMLTextAreaElement {
		return c.querySelector(".cmp-textarea") as unknown as HTMLTextAreaElement;
	}

	test("hides the composer while a prompt is open and restores it with its draft", () => {
		const m = mount();
		const prompt = <ExtensionDialogSheet dialog={ASK} queued={0} onAnswer={noop} docked />;
		m.render(<PromptDock prompt={null}>{composer()}</PromptDock>);
		const ta = textarea(m.container);
		Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(ta, "my draft");
		act(() => {
			(ta as unknown as { dispatchEvent(e: unknown): boolean }).dispatchEvent(
				new win.Event("input", { bubbles: true }),
			);
		});
		const hold = (): { hidden: boolean } => m.container.querySelector(".sh-composer-hold") as never;
		expect(hold().hidden).toBe(false);

		m.render(<PromptDock prompt={prompt}>{composer()}</PromptDock>);
		expect(hold().hidden).toBe(true);
		expect(m.container.querySelector('[role="dialog"].is-docked')).not.toBeNull();
		// Same node: the composer was hidden, not remounted.
		expect(textarea(m.container)).toBe(ta);

		m.render(<PromptDock prompt={null}>{composer()}</PromptDock>);
		expect(hold().hidden).toBe(false);
		expect(m.container.querySelector('[role="dialog"]')).toBeNull();
		expect(textarea(m.container)).toBe(ta);
		expect(textarea(m.container).value).toBe("my draft");
	});
});
