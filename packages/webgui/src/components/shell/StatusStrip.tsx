import type { ReactNode } from "react";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { countTodoProgress } from "../../lib/todo-model";

interface StatusStripProps {
	sessionState: RpcSessionState | null;
	stats: SessionStats | null;
	streaming: boolean;
	expandAll: boolean;
	onToggleExpand: () => void;
	onPickModel: () => void;
	onPickThinking: () => void;
	onOpenTodos?: () => void;
}

function formatCost(cost: number): string {
	if (cost < 0.01) return "<$0.01";
	return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(n);
}

function contextPercent(usage: { used: number; total: number } | undefined): string | null {
	if (!usage || !usage.total) return null;
	return `${Math.round((usage.used / usage.total) * 100)}%`;
}

export function StatusStrip({
	sessionState,
	stats,
	streaming,
	expandAll,
	onToggleExpand,
	onPickModel,
	onPickThinking,
	onOpenTodos,
}: StatusStripProps): ReactNode {
	const todoProgress = countTodoProgress(sessionState?.todoPhases);
	const model = sessionState?.model;
	const ctx = contextPercent(sessionState?.contextUsage as { used: number; total: number } | undefined);

	return (
		<div className="ss-strip">
			<div className="ss-group ss-group--left">
				{model && (
					<button type="button" className="ss-item ss-item--btn ss-model" onClick={onPickModel} title={model.name}>
						{model.name}
					</button>
				)}
				{sessionState?.thinkingLevel && (
					<>
						<span className="ss-sep" />
						<button type="button" className="ss-item ss-item--btn ss-thinking" onClick={onPickThinking}>
							{sessionState.thinkingLevel}
						</button>
					</>
				)}
				{ctx && (
					<>
						<span className="ss-sep" />
						<span className="ss-item ss-ctx">{ctx}</span>
					</>
				)}
				{todoProgress.total > 0 && (
					<>
						<span className="ss-sep" />
						<button
							type="button"
							className="ss-item ss-item--btn ss-todos"
							onClick={onOpenTodos}
							title={`Todos: ${todoProgress.closed}/${todoProgress.total}`}
							aria-label={`Todos: ${todoProgress.closed} of ${todoProgress.total} completed`}
						>
							<span className="ss-todo-icon" aria-hidden="true">
								&#x2713;
							</span>
							<span>
								{todoProgress.closed}/{todoProgress.total}
							</span>
						</button>
					</>
				)}
			</div>
			<div className="ss-group ss-group--right">
				{stats && (
					<>
						<span className="ss-item ss-cost">{formatCost(stats.cost)}</span>
						<span className="ss-sep" />
						<span className="ss-item ss-tokens">{formatTokens(stats.tokens.total)}</span>
					</>
				)}
				{(streaming || sessionState?.isCompacting) && (
					<>
						<span className="ss-sep" />
						<span className="ss-item ss-indicator">
							<span className="ss-dot" />
							{sessionState?.isCompacting ? "compacting" : "streaming"}
						</span>
					</>
				)}
				<span className="ss-sep" />
				<button
					type="button"
					className="ss-item ss-item--btn ss-tools"
					onClick={onToggleExpand}
					aria-label={expandAll ? "Collapse all tools" : "Expand all tools"}
				>
					{expandAll ? "\u25BC" : "\u25B6"} tools
				</button>
			</div>
		</div>
	);
}
