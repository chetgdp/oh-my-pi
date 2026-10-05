import type { ReactNode } from "react";
import type { RpcServerSessionState, RpcPlanState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { countTodoProgress, type TodoPhase } from "../../lib/todo-model";
import { contextLevel, type ContextUsageLike, formatContextUsage } from "../../lib/context-usage";
import { Ghost } from "lucide-react";
interface StatusStripProps {
	sessionState: RpcServerSessionState | null;
	stats: SessionStats | null;
	streaming: boolean;
	expandAll: boolean;
	onToggleExpand: () => void;
	onPickModel: () => void;
	onPickThinking: () => void;
	onOpenTodos?: () => void;
	planState?: RpcPlanState | null;
	onTogglePlan?: () => void;
}

function formatCost(cost: number): string {
	if (cost < 0.01) return "<$0.01";
	return `$${cost.toFixed(2)}`;
}

interface TodoChipProps {
	phases: readonly TodoPhase[] | undefined;
	onOpen?: () => void;
}

/** Closed/total todo counter with its leading separator; renders nothing without tasks. Shared by Main and focused strips. */
function TodoChip({ phases, onOpen }: TodoChipProps): ReactNode {
	const progress = countTodoProgress(phases);
	if (progress.total === 0) return null;
	return (
		<>
			<span className="ss-sep" />
			<button
				type="button"
				className="ss-item ss-item--btn ss-todos"
				onClick={onOpen}
				title={`Todos: ${progress.closed}/${progress.total}`}
				aria-label={`Todos: ${progress.closed} of ${progress.total} completed`}
			>
				<span className="ss-todo-icon" aria-hidden="true">
					&#x2713;
				</span>
				<span>
					{progress.closed}/{progress.total}
				</span>
			</button>
		</>
	);
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
	planState,
	onTogglePlan,
}: StatusStripProps): ReactNode {
	const model = sessionState?.model;
	const ctxFormatted = formatContextUsage(sessionState?.contextUsage);
	const ctxLevel = sessionState?.contextUsage ? contextLevel(sessionState.contextUsage.percent ?? 0) : "normal";
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
				{ctxFormatted && (
					<>
						<span className="ss-sep" />
						<span className={`ss-item ss-ctx ss-ctx--${ctxLevel}`}>{ctxFormatted}</span>
					</>
				)}
				<TodoChip phases={sessionState?.todoPhases} onOpen={onOpenTodos} />
				{planState?.available && (
					<>
						<span className="ss-sep" />
						<button
							type="button"
							className={`ss-item ss-item--btn ss-plan ${planState.enabled ? (planState.paused ? "ss-plan--paused" : "ss-plan--on") : "ss-plan--off"}`}
							onClick={onTogglePlan}
							title={
								planState.enabled
									? planState.paused
										? "Plan mode: paused (click to disable)"
										: "Plan mode: on (click to disable)"
									: "Plan mode: off (click to enable)"
							}
							aria-label={
								planState.enabled
									? planState.paused
										? "Plan mode: paused"
										: "Plan mode: on"
									: "Plan mode: off"
							}
						>
							<span className="ss-plan-label">
								{planState.enabled ? (planState.paused ? "plan: paused" : "plan: on") : "plan: off"}
							</span>
						</button>
					</>
				)}
			</div>
			<div className="ss-group ss-group--right">
				{stats && <span className="ss-item ss-cost">{formatCost(stats.cost)}</span>}
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

export interface FocusStatusStripProps {
	agentId: string;
	/** Focused agent's model, from its roster row. */
	model?: string;
	usage?: ContextUsageLike;
	cost?: number;
	streaming: boolean;
	expandAll: boolean;
	onToggleExpand: () => void;
	/** Focused agent's todos (read-only); the chip is hidden while it has none. */
	todoPhases?: readonly TodoPhase[];
	onOpenTodos?: () => void;
}

/** Dimmed strip for a focused subagent (TUI dims the status line and shows a ghost plus the agent id). Model, context and cost come from that agent, not Main. */
export function FocusStatusStrip({
	agentId,
	model,
	usage,
	cost,
	streaming,
	expandAll,
	onToggleExpand,
	todoPhases,
	onOpenTodos,
}: FocusStatusStripProps): ReactNode {
	const ctxFormatted = formatContextUsage(usage);
	const ctxLevel = usage ? contextLevel(usage.percent ?? 0) : "normal";
	return (
		<div className="ss-strip ss-strip--focused">
			<div className="ss-group ss-group--left">
				<span className="ss-item ss-focus-id" title={`Viewing agent ${agentId}`}>
					<Ghost size={13} aria-hidden="true" />
					{agentId}
				</span>
				{model && (
					<>
						<span className="ss-sep" />
						<span className="ss-item ss-model" title={model}>
							{model}
						</span>
					</>
				)}
				{ctxFormatted && (
					<>
						<span className="ss-sep" />
						<span className={`ss-item ss-ctx ss-ctx--${ctxLevel}`}>{ctxFormatted}</span>
					</>
				)}
				<TodoChip phases={todoPhases} onOpen={onOpenTodos} />
			</div>
			<div className="ss-group ss-group--right">
				{cost !== undefined && <span className="ss-item ss-cost">{formatCost(cost)}</span>}
				{streaming && (
					<>
						<span className="ss-sep" />
						<span className="ss-item ss-indicator">
							<span className="ss-dot" />
							streaming
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
