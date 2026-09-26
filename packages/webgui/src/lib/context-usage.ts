import { formatNumber } from "@oh-my-pi/pi-utils/format";

export type ContextUsageLevel = "normal" | "notice" | "warning" | "danger";

export interface ContextUsageLike {
	tokens?: number;
	contextWindow?: number;
	percent?: number;
}

export function formatContextUsage(usage: ContextUsageLike | null | undefined): string | null {
	if (!usage || usage.contextWindow == null || !Number.isFinite(usage.contextWindow) || usage.contextWindow <= 0) {
		return null;
	}

	const percent = usage.percent ?? (usage.tokens != null ? (usage.tokens / usage.contextWindow) * 100 : 0);
	const pctStr = percent < 1 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
	return `${pctStr} / ${formatNumber(usage.contextWindow)}`;
}

export function contextLevel(percent: number): ContextUsageLevel {
	if (percent >= 50) return "danger";
	if (percent >= 25) return "warning";
	if (percent >= 10) return "notice";
	return "normal";
}
