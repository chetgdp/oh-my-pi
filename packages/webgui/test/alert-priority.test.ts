import { describe, expect, it } from "bun:test";
import { type AlertInput, pickAlert } from "../src/lib/alert-priority";

const NONE: AlertInput = {
	notice: null,
	focusLabel: null,
	focusDetail: null,
	offline: false,
	dialogCount: 0,
	planTitle: null,
	dialogSheetOpen: false,
	compacting: false,
	ctxPercent: 40,
};

const ALL: AlertInput = {
	notice: { id: 1, kind: "error", message: "Failed" },
	focusLabel: "ComposerAudit",
	focusDetail: null,
	offline: true,
	dialogCount: 2,
	planTitle: "Plan",
	dialogSheetOpen: false,
	compacting: true,
	ctxPercent: 90,
};

describe("pickAlert", () => {
	it("returns null when nothing needs attention", () => {
		expect(pickAlert(NONE)).toBeNull();
	});

	it("orders offline > notice > focus > needs-you > compacting > context", () => {
		const order: AlertInput[] = [
			ALL,
			{ ...ALL, offline: false },
			{ ...ALL, offline: false, notice: null },
			{ ...ALL, offline: false, notice: null, focusLabel: null },
			{ ...ALL, offline: false, notice: null, focusLabel: null, dialogCount: 0, planTitle: null },
			{ ...ALL, offline: false, notice: null, focusLabel: null, dialogCount: 0, planTitle: null, compacting: false },
		];
		expect(order.map(i => pickAlert(i)?.kind)).toEqual([
			"offline",
			"notice",
			"focus",
			"needs-you",
			"compacting",
			"context",
		]);
	});

	it("notice outranks focus but not offline", () => {
		const notice = { id: 7, kind: "info", message: "Session renamed" } as const;
		expect(pickAlert({ ...NONE, notice, focusLabel: "A" })).toEqual({
			kind: "notice",
			noticeKind: "info",
			title: "Session renamed",
			actions: [{ id: "dismiss", label: "Dismiss" }],
		});
		expect(pickAlert({ ...NONE, notice, offline: true })?.kind).toBe("offline");
	});

	it("focus carries revive progress or error as detail", () => {
		expect(pickAlert({ ...NONE, focusLabel: "A", focusDetail: "Reviving agent..." })?.detail).toBe(
			"Reviving agent...",
		);
		expect(pickAlert({ ...NONE, focusLabel: "A" })?.detail).toBeUndefined();
	});

	it("needs-you prefers dialogs, then plan, and hides while the sheet is open", () => {
		expect(pickAlert({ ...NONE, dialogCount: 2, planTitle: "P" })).toMatchObject({
			title: "Agent asks",
			detail: "1 of 2",
			actions: [{ id: "open", label: "Answer" }],
		});
		expect(pickAlert({ ...NONE, planTitle: "P" })).toMatchObject({ title: "Plan ready", detail: "P" });
		expect(pickAlert({ ...NONE, planTitle: "P", dialogSheetOpen: true })).toBeNull();
	});

	it("context alert starts at 85% with Handoff and Compact", () => {
		expect(pickAlert({ ...NONE, ctxPercent: 84.9 })).toBeNull();
		expect(pickAlert({ ...NONE, ctxPercent: 85 })).toEqual({
			kind: "context",
			title: "Context 85%",
			actions: [
				{ id: "handoff", label: "Handoff" },
				{ id: "compact", label: "Compact" },
			],
		});
	});
});
