/**
 * The single alert strip under the top bar: picks the most urgent notice.
 * Priority: focus, offline, needs-you, compacting, context.
 */

import { CONTEXT_CRIT_PERCENT } from "./context-usage";

export type AlertKind = "focus" | "offline" | "needs-you" | "compacting" | "context";

export interface AlertAction {
	/** focus: "back"; offline: "retry"; needs-you: "open"; context: "handoff" | "compact". */
	id: string;
	label: string;
	solid?: boolean;
}

export interface Alert {
	kind: AlertKind;
	title: string;
	detail?: string;
	actions: AlertAction[];
	/** 0..1 when progress is known; absent renders an indeterminate bar. */
	progress?: number;
}

export interface AlertInput {
	/** Label of the focused subagent; null while Main is shown. */
	focusLabel: string | null;
	/** Revive progress or the focus error, shown after the label; null when none. */
	focusDetail: string | null;
	offline: boolean;
	/** Pending extension dialogs; the strip counts them. */
	dialogCount: number;
	/** Title of the pending plan review; null when none. */
	planTitle: string | null;
	/** The dialog/plan sheet is already showing, so the strip has nothing to reopen. */
	dialogSheetOpen: boolean;
	compacting: boolean;
	ctxPercent: number | null;
}

export function pickAlert(input: AlertInput): Alert | null {
	if (input.focusLabel !== null) {
		return {
			kind: "focus",
			title: `Viewing subagent ${input.focusLabel}`,
			...(input.focusDetail !== null ? { detail: input.focusDetail } : {}),
			actions: [{ id: "back", label: "Back to main" }],
		};
	}
	if (input.offline) {
		return {
			kind: "offline",
			title: "Offline.",
			detail: "Draft is kept.",
			actions: [{ id: "retry", label: "Retry" }],
		};
	}
	if (!input.dialogSheetOpen && input.dialogCount > 0) {
		return {
			kind: "needs-you",
			title: "Agent asks",
			detail: `1 of ${input.dialogCount}`,
			actions: [{ id: "open", label: "Answer" }],
		};
	}
	if (!input.dialogSheetOpen && input.planTitle !== null) {
		return {
			kind: "needs-you",
			title: "Plan ready",
			detail: input.planTitle,
			actions: [{ id: "open", label: "Review" }],
		};
	}
	if (input.compacting) {
		return {
			kind: "compacting",
			title: "Compacting",
			...(input.ctxPercent !== null ? { detail: `from ${Math.round(input.ctxPercent)}%` } : {}),
			actions: [],
		};
	}
	if (input.ctxPercent !== null && input.ctxPercent >= CONTEXT_CRIT_PERCENT) {
		return {
			kind: "context",
			title: `Context ${Math.round(input.ctxPercent)}%`,
			actions: [
				{ id: "handoff", label: "Handoff" },
				{ id: "compact", label: "Compact" },
			],
		};
	}
	return null;
}
