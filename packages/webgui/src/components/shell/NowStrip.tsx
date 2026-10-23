import { Bot, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { TodoTree } from "../transcript/tool-views/tools/todo";
import "../transcript/tool-views/tool-render.css";
import type { PinnedAgentRow } from "../../lib/pinned-subagents-model";
import { countTodoProgress, isClosedTodo, type TodoItem, type TodoPhase } from "../../lib/todo-model";

export interface NowStripProps {
	phases: readonly TodoPhase[];
	agents: readonly PinnedAgentRow[];
	expanded: boolean;
	onToggle(): void;
	onFocusAgent(id: string): void;
}

const RING_R = 7;
const RING_C = 2 * Math.PI * RING_R;

function Ring({ done, total }: { done: number; total: number }) {
	const filled = total > 0 ? (RING_C * done) / total : 0;
	return (
		<svg className="now-strip-ring" viewBox="0 0 18 18" aria-hidden="true">
			<circle cx="9" cy="9" r={RING_R} stroke="var(--bg-inset)" />
			<circle
				cx="9"
				cy="9"
				r={RING_R}
				stroke="var(--accent)"
				strokeDasharray={`${filled} ${RING_C}`}
				transform="rotate(-90 9 9)"
			/>
		</svg>
	);
}

/**
 * Strip above the composer: progress ring, current todo, running subagents chip.
 * Expanding shows the full todo list and subagent rows (tap to watch).
 * Hidden by CSS while the on-screen keyboard is up.
 */
export function NowStrip({ phases, agents, expanded, onToggle, onFocusAgent }: NowStripProps) {
	const tasks: TodoItem[] = phases.flatMap(p => p.tasks);
	const running = agents.filter(a => a.status === "running");
	if (tasks.length === 0 && running.length === 0) return null;

	const progress = countTodoProgress(phases);
	const current = tasks.find(t => t.status === "in_progress");
	const next = current ? undefined : tasks.find(t => !isClosedTodo(t.status));
	const position = current || next ? tasks.indexOf((current ?? next) as TodoItem) + 1 : progress.total;
	const label = current ? current.content : next ? `Next: ${next.content}` : tasks.length ? "All done" : "Subagents";

	const head = (
		<button type="button" className="now-strip-head" aria-expanded={expanded} onClick={onToggle}>
			{tasks.length > 0 ? <Ring done={progress.closed} total={progress.total} /> : null}
			<span className={`now-strip-label${current ? "" : " done"}`}>
				{tasks.length > 0 ? <b>{`${position} of ${progress.total}`}</b> : null}
				{label}
			</span>
			{running.length > 0 ? (
				<span className="now-strip-agents" aria-label={`${running.length} running subagents`}>
					<Bot aria-hidden="true" />
					{running.length}
				</span>
			) : null}
			{expanded ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
		</button>
	);

	if (!expanded) return <div className="now-strip">{head}</div>;

	return (
		<div className="now-strip">
			<div className="now-strip-body">
				{tasks.length > 0 ? <TodoTree phases={phases} full /> : null}
				{running.length > 0 ? (
					<>
						<div className="now-strip-sec">
							Subagents<span>tap to watch</span>
						</div>
						{running.map(agent => (
							<button
								key={agent.id}
								type="button"
								className="now-strip-agent"
								onClick={() => onFocusAgent(agent.id)}
							>
								<span className="now-strip-dot" aria-hidden="true" />
								<span className="now-strip-agent-name">{agent.label}</span>
								<span className="now-strip-agent-task">{agent.task ?? ""}</span>
								<ChevronRight aria-hidden="true" />
							</button>
						))}
					</>
				) : null}
			</div>
			{head}
		</div>
	);
}
