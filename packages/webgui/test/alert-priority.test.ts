import { describe, expect, it } from "bun:test";
import { type AlertInput, pickAlert } from "../src/lib/alert-priority";

const NONE: AlertInput = {
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

	it("orders focus > offline > needs-you > compacting > context", () => {
		expect(pickAlert(ALL)?.kind).toBe("focus");
		expect(pickAlert({ ...ALL, focusLabel: null })?.kind).toBe("offline");
		expect(pickAlert({ ...ALL, focusLabel: null, offline: false })?.kind).toBe("needs-you");
		expect(pickAlert({ ...ALL, focusLabel: null, offline: false, dialogCount: 0, planTitle: null })?.kind).toBe(
			"compacting",
		);
		expect(
			pickAlert({ ...ALL, focusLabel: null, offline: false, dialogCount: 0, planTitle: null, compacting: false })
				?.kind,
		).toBe("context");
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
