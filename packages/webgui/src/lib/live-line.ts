/**
 * Line 2 of the top bar: activity · elapsed · context % · cost.
 * Pure so the 1s ticker only re-renders the bar, never the store.
 */

import { type ContextUsageLevel, contextLevel } from "./context-usage";
import { fmtCost } from "./format";
import type { SessionSnapshot } from "./session-store";

export type LiveLineTone = "normal" | "wait" | "bad" | "ghost";

export interface LiveLine {
	/** normal: idle/working; wait: the agent waits on the user; bad: offline; ghost: viewing a subagent. */
	tone: LiveLineTone;
	activity: string;
	/** Epoch ms the elapsed counter runs from; null hides it. */
	elapsedFrom: number | null;
	ctxPercent: number | null;
	ctxLevel: ContextUsageLevel;
	cost: string | null;
	/** Epoch ms of the next reconnect attempt while offline; null otherwise. */
	retryAt: number | null;
}

/** The focused subagent, when one is shown instead of Main. */
export interface LiveLineFocus {
	/** Title of the session the subagent belongs to. */
	parentTitle: string;
	/** Tool the subagent is running; null between tools. */
	tool: string | null;
	/** Epoch ms the subagent's current tool (or run) started. */
	since: number | null;
	ctxPercent: number | null;
	/** USD spent by the subagent. */
	cost: number | null;
}

export interface LiveLineInput {
	snapshot: Pick<
		SessionSnapshot,
		| "connection"
		| "streaming"
		| "transcript"
		| "turnStartedAt"
		| "idleSince"
		| "compactionStartedAt"
		| "attentionSince"
		| "hostTools"
		| "dialogs"
		| "planReview"
		| "sessionState"
		| "stats"
	>;
	focus: LiveLineFocus | null;
	/** Client reconnect state, read from `RpcWebClient`. */
	retry?: { attempt: number; nextRetryAt: number | null };
}

export function liveLine(input: LiveLineInput): LiveLine {
	const { snapshot, focus, retry } = input;
	const mainCtx = snapshot.sessionState?.contextUsage?.percent ?? null;
	const ctxPercent = focus ? focus.ctxPercent : mainCtx;
	const costUsd = focus ? focus.cost : (snapshot.stats?.cost ?? null);
	const base = {
		ctxPercent,
		ctxLevel: ctxPercent === null ? "normal" : contextLevel(ctxPercent),
		cost: costUsd === null ? null : fmtCost(costUsd),
		retryAt: null,
	} satisfies Partial<LiveLine>;

	const needsYou = snapshot.dialogs.length > 0 ? "question" : snapshot.planReview ? "plan" : null;
	if (needsYou) {
		return { ...base, tone: "wait", activity: `needs you · ${needsYou}`, elapsedFrom: snapshot.attentionSince };
	}
	// No session state yet: the first connect is still in flight (retries included), not an outage.
	if (snapshot.connection !== "ready" && snapshot.connection !== "incompatible" && snapshot.sessionState === null) {
		return { ...base, tone: "normal", activity: "connecting", elapsedFrom: null };
	}
	const offline = snapshot.connection !== "ready" && snapshot.connection !== "connecting";
	if (offline) {
		const attempt = retry?.attempt ?? 0;
		return {
			tone: "bad",
			activity: attempt > 0 ? `offline · retry ${attempt}` : "offline",
			elapsedFrom: null,
			ctxPercent: null,
			ctxLevel: "normal",
			cost: null,
			retryAt: retry?.nextRetryAt ?? null,
		};
	}
	if (focus) {
		const activity = focus.tool
			? `subagent of ${focus.parentTitle} · ${focus.tool}`
			: `subagent of ${focus.parentTitle}`;
		return { ...base, tone: "ghost", activity, elapsedFrom: focus.since };
	}
	if (snapshot.compactionStartedAt !== null) {
		return { ...base, tone: "normal", activity: "compacting", elapsedFrom: snapshot.compactionStartedAt };
	}
	if (snapshot.streaming) {
		// The newest running tool names the activity; between tools the run itself is timed.
		// Host start times win over client receipt times, which restart after a reload.
		let latest: { toolName: string; startedAt: number } | null = null;
		for (const [id, tool] of snapshot.transcript.activeTools) {
			const host = snapshot.hostTools.get(id);
			const startedAt = host?.startedAt ?? tool.startedAt;
			if (!latest || startedAt >= latest.startedAt) {
				latest = { toolName: tool.toolName || (host?.toolName ?? ""), startedAt };
			}
		}
		// After a reload the host reports tools the transcript has not seen events for yet.
		for (const [id, tool] of snapshot.hostTools) {
			if (snapshot.transcript.activeTools.has(id)) continue;
			if (!latest || tool.startedAt >= latest.startedAt) latest = tool;
		}
		return latest?.toolName
			? { ...base, tone: "normal", activity: latest.toolName, elapsedFrom: latest.startedAt }
			: { ...base, tone: "normal", activity: "working", elapsedFrom: snapshot.turnStartedAt };
	}
	return { ...base, tone: "normal", activity: "idle", elapsedFrom: snapshot.idleSince };
}
