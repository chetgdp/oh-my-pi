import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
// Exception: react-dom/client and PlanReviewSheet must be dynamically imported after dom-setup initializes globalThis window and navigator
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { PlanReviewSheet } = await import("../src/components/plan/PlanReviewSheet");
import type { RpcCommand, RpcPlanReview } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionCommandSink } from "../src/lib/session-actions";

interface TestMount {
	container: HTMLElement;
	cleanup(): void;
	findButton(text: string): { click(): void; disabled?: boolean; textContent: string | null } | undefined;
	findInput(
		selector: string,
	): { value: string; style?: { fontSize?: string }; className?: string; dispatchEvent(e: unknown): boolean } | null;
	rerender(ui: React.ReactElement): void;
}

function mount(ui: React.ReactElement): TestMount {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
		rerender(newUi: React.ReactElement) {
			act(() => {
				root.render(newUi);
			});
		},
		findButton(text: string) {
			const buttons = Array.from(container.querySelectorAll("button")) as unknown as Array<{
				click(): void;
				disabled?: boolean;
				textContent: string | null;
			}>;
			return buttons.find(b => b.textContent?.trim() === text);
		},
		findInput(selector: string) {
			const el = container.querySelector(selector);
			return el as unknown as {
				value: string;
				style?: { fontSize?: string };
				className?: string;
				dispatchEvent(e: unknown): boolean;
			} | null;
		},
	};
}

function changeTextareaValue(input: { value: string; dispatchEvent: (e: unknown) => boolean }, value: string): void {
	const nativeSetter =
		Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")?.set ??
		Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
	if (nativeSetter) {
		nativeSetter.call(input, value);
	} else {
		input.value = value;
	}
	input.dispatchEvent(new win.Event("input", { bubbles: true }));
}

describe("PlanReviewSheet component", () => {
	const sampleReview: RpcPlanReview = {
		reviewId: "rev-42",
		title: "Database Migration Plan",
		planFilePath: "/workspace/plans/migration.md",
		markdown: "# Database Migration\n\nMigrate user accounts to new schema.\n\n- Step 1: Backup\n- Step 2: Migrate",
	};

	test("renders null when review is null", () => {
		const html = renderToStaticMarkup(<PlanReviewSheet review={null} />);
		expect(html).toBe("");

		const mounted = mount(<PlanReviewSheet review={null} />);
		expect(mounted.container.innerHTML).toBe("");
		mounted.cleanup();
	});

	test("renders title, path, and markdown content when review is provided", () => {
		const html = renderToStaticMarkup(<PlanReviewSheet review={sampleReview} />);
		expect(html).toContain("Database Migration Plan");
		expect(html).toContain("/workspace/plans/migration.md");
		expect(html).toContain("Migrate user accounts to new schema");
		expect(html).toContain("plan-review-sheet");
	});

	test("renders the three initial action buttons", () => {
		const mounted = mount(<PlanReviewSheet review={sampleReview} />);
		expect(mounted.findButton("Approve and execute")).toBeDefined();
		expect(mounted.findButton("Approve and compact")).toBeDefined();
		expect(mounted.findButton("Refine")).toBeDefined();
		mounted.cleanup();
	});

	test("clicking Approve and execute sends correct approve_plan payload", async () => {
		const requestLog: RpcCommand[] = [];
		const request: SessionCommandSink["request"] = cmd => {
			requestLog.push(cmd);
			return Promise.resolve({
				success: true,
				command: cmd.type,
				data: { state: { available: true, enabled: false, paused: false } },
			} as never);
		};
		const fakeSink: SessionCommandSink = { request };

		const mounted = mount(<PlanReviewSheet review={sampleReview} sink={fakeSink} />);
		const btn = mounted.findButton("Approve and execute");
		expect(btn).toBeDefined();

		act(() => {
			btn?.click();
		});

		expect(requestLog).toHaveLength(1);
		expect(requestLog[0]).toEqual({
			type: "approve_plan",
			reviewId: "rev-42",
			action: "execute",
		});

		mounted.cleanup();
	});

	test("clicking Approve and compact sends correct approve_plan payload", async () => {
		const requestLog: RpcCommand[] = [];
		const request: SessionCommandSink["request"] = cmd => {
			requestLog.push(cmd);
			return Promise.resolve({
				success: true,
				command: cmd.type,
				data: { state: { available: true, enabled: false, paused: false } },
			} as never);
		};
		const fakeSink: SessionCommandSink = { request };

		const mounted = mount(<PlanReviewSheet review={sampleReview} sink={fakeSink} />);
		const btn = mounted.findButton("Approve and compact");
		expect(btn).toBeDefined();

		act(() => {
			btn?.click();
		});

		expect(requestLog).toHaveLength(1);
		expect(requestLog[0]).toEqual({
			type: "approve_plan",
			reviewId: "rev-42",
			action: "compact",
		});

		mounted.cleanup();
	});

	test("clicking Refine reveals textarea with iOS-safe font size (>= 16px)", () => {
		const mounted = mount(<PlanReviewSheet review={sampleReview} />);

		// Before click, textarea is not present
		expect(mounted.findInput("textarea")).toBeNull();

		// Click Refine
		const refineBtn = mounted.findButton("Refine");
		expect(refineBtn).toBeDefined();
		act(() => {
			refineBtn?.click();
		});

		// Textarea is now revealed
		const textarea = mounted.findInput("textarea");
		expect(textarea).not.toBeNull();
		expect(textarea?.className).toContain("plan-refine-input");

		mounted.cleanup();
	});

	test("submitting refine with feedback sends approve_plan payload with feedback", async () => {
		const requestLog: RpcCommand[] = [];
		const request: SessionCommandSink["request"] = cmd => {
			requestLog.push(cmd);
			return Promise.resolve({
				success: true,
				command: cmd.type,
				data: { state: { available: true, enabled: true, paused: false } },
			} as never);
		};
		const fakeSink: SessionCommandSink = { request };

		const mounted = mount(<PlanReviewSheet review={sampleReview} sink={fakeSink} />);

		// Reveal refine
		act(() => {
			mounted.findButton("Refine")?.click();
		});

		const textarea = mounted.findInput("textarea");
		expect(textarea).not.toBeNull();

		// Enter feedback
		act(() => {
			changeTextareaValue(textarea!, "Please add rollback instructions");
		});

		// Click Send feedback
		const sendBtn = mounted.findButton("Send feedback");
		expect(sendBtn).toBeDefined();
		act(() => {
			sendBtn?.click();
		});

		expect(requestLog).toHaveLength(1);
		expect(requestLog[0]).toEqual({
			type: "approve_plan",
			reviewId: "rev-42",
			action: "refine",
			feedback: "Please add rollback instructions",
		});

		mounted.cleanup();
	});

	test("submitting refine without feedback sends action: 'refine' without feedback property", async () => {
		const requestLog: RpcCommand[] = [];
		const request: SessionCommandSink["request"] = cmd => {
			requestLog.push(cmd);
			return Promise.resolve({
				success: true,
				command: cmd.type,
				data: { state: { available: true, enabled: true, paused: false } },
			} as never);
		};
		const fakeSink: SessionCommandSink = { request };

		const mounted = mount(<PlanReviewSheet review={sampleReview} sink={fakeSink} />);

		// Reveal refine
		act(() => {
			mounted.findButton("Refine")?.click();
		});

		// Click Send feedback immediately without typing
		const sendBtn = mounted.findButton("Send feedback");
		expect(sendBtn).toBeDefined();
		act(() => {
			sendBtn?.click();
		});

		expect(requestLog).toHaveLength(1);
		expect(requestLog[0]).toEqual({
			type: "approve_plan",
			reviewId: "rev-42",
			action: "refine",
		});

		mounted.cleanup();
	});

	test("buttons are disabled while request is in flight", async () => {
		const { promise, resolve: resolveRequest } = Promise.withResolvers<unknown>();
		const fakeSink: SessionCommandSink = {
			request: () => promise as never,
		};

		const mounted = mount(<PlanReviewSheet review={sampleReview} sink={fakeSink} />);
		const btn = mounted.findButton("Approve and execute");
		expect(btn?.disabled).toBe(false);

		// Click to trigger in-flight request
		act(() => {
			btn?.click();
		});

		// Now buttons should be disabled
		expect(mounted.findButton("Approve and execute")?.disabled).toBe(true);
		expect(mounted.findButton("Approve and compact")?.disabled).toBe(true);
		expect(mounted.findButton("Refine")?.disabled).toBe(true);

		// Resolve in-flight request
		act(() => {
			resolveRequest({
				success: true,
				command: "approve_plan",
				data: { state: { available: true, enabled: false, paused: false } },
			});
		});

		mounted.cleanup();
	});

	test("sheet closes (renders null) when review transitions to null", () => {
		const mounted = mount(<PlanReviewSheet review={sampleReview} />);
		expect(mounted.container.querySelector(".plan-review-sheet")).not.toBeNull();

		// Parent passes review = null (answered elsewhere in TUI or completed)
		mounted.rerender(<PlanReviewSheet review={null} />);
		expect(mounted.container.querySelector(".plan-review-sheet")).toBeNull();
		expect(mounted.container.innerHTML).toBe("");

		mounted.cleanup();
	});

	test("delegates to onApprove prop when provided instead of sink", async () => {
		let approvedReviewId = "";
		let approvedAction = "";
		let approvedFeedback: string | undefined;

		const onApprove = async (reviewId: string, action: "execute" | "compact" | "refine", feedback?: string) => {
			approvedReviewId = reviewId;
			approvedAction = action;
			approvedFeedback = feedback;
		};

		const mounted = mount(<PlanReviewSheet review={sampleReview} onApprove={onApprove} />);
		act(() => {
			mounted.findButton("Refine")?.click();
		});

		const textarea = mounted.findInput("textarea");
		act(() => {
			changeTextareaValue(textarea!, "Refine details");
		});

		act(() => {
			mounted.findButton("Send feedback")?.click();
		});

		expect(approvedReviewId).toBe("rev-42");
		expect(approvedAction).toBe("refine");
		expect(approvedFeedback).toBe("Refine details");

		mounted.cleanup();
	});

	test("calls onClose when close button is clicked", () => {
		let closed = false;
		const mounted = mount(
			<PlanReviewSheet
				review={sampleReview}
				onClose={() => {
					closed = true;
				}}
			/>,
		);

		const closeBtn = mounted.container.querySelector(".plan-review-close") as HTMLElement | null;
		expect(closeBtn).not.toBeNull();

		act(() => {
			closeBtn?.click();
		});

		expect(closed).toBe(true);
		mounted.cleanup();
	});
});
