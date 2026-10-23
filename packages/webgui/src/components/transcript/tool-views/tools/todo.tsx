/** `todo` — one-line transcript summaries, and the phased tree the now strip renders. */
import type { ReactNode } from "react";
import {
	formatRoman,
	isClosedTodo,
	selectActivePhaseIndex,
	type TodoItem,
	type TodoPhase,
} from "../../../../lib/todo-model";
import { Badges, ResultText } from "../parts";
import type { ToolRenderer, ToolRenderProps } from "../types";
import { isRecord, normalizeWs, str, truncate } from "../util";

/**
 * Normalize call args to a flat op list. The current `todo` contract sends a
 * single top-level op `{op,...}`; legacy transcripts still carry the batched
 * `{ops:[...]}` shape. Non-record entries (streaming deltas) are dropped.
 */
function toOps(args: ToolRenderProps["args"]): unknown[] {
	if (Array.isArray(args.ops)) return args.ops;
	return typeof args.op === "string" ? [args] : [];
}

function Summary({ args, groupCount }: ToolRenderProps): ReactNode {
	const ops = toOps(args);
	const counts: Record<string, number> = {};
	const order: string[] = [];
	let firstTask: string | null = null;
	for (const entry of ops) {
		if (!isRecord(entry)) continue;
		const op = str(entry.op) ?? "update";
		if (counts[op] === undefined) {
			counts[op] = 0;
			order.push(op);
		}
		counts[op]++;
		if (firstTask === null) {
			firstTask = str(entry.task) ?? str(entry.phase);
			if (firstTask === null && Array.isArray(entry.list)) {
				const head = entry.list.find(isRecord);
				if (head && Array.isArray(head.items)) firstTask = str(head.items[0]);
			}
		}
	}
	const countBadge = groupCount !== undefined && groupCount > 1 ? `${groupCount} updates` : null;
	const labels = countBadge !== null ? [countBadge] : order.map(op => (counts[op] > 1 ? `${op}×${counts[op]}` : op));
	return (
		<>
			<Badges items={labels.length > 0 ? labels : ["update"]} />
			{firstTask !== null && <span> {truncate(normalizeWs(firstTask), 60)}</span>}
		</>
	);
}

function TaskRows({ tasks }: { tasks: readonly TodoItem[] }): ReactNode {
	return tasks.map((task, tIdx) => {
		const isLast = tIdx === tasks.length - 1;
		const rail = ` │   ${isLast ? "└─ " : "├─ "}`;
		const marker = task.status === "completed" ? "☑" : "☐";
		const suffix =
			task.status === "in_progress"
				? " (in progress)"
				: task.status === "blocked"
					? task.blocker
						? ` (blocked: ${task.blocker})`
						: " (blocked)"
					: null;
		return (
			<div key={task.content || `t-${tIdx}`} className={`tv-todo-row tv-todo-task--${task.status}`}>
				<span className={`tv-todo-rail tv-todo-rail--outer${isLast ? "" : " tv-todo-rail--inner"}`}>{rail}</span>
				<span className="tv-todo-content">
					<span className="tv-todo-marker">{marker}</span>{" "}
					<span className="tv-todo-task-text">{task.content}</span>
					{suffix && <span className="tv-todo-task-suffix">{suffix}</span>}
				</span>
			</div>
		);
	});
}

/** The TUI todo HUD tree. `full` lists every phase's tasks; otherwise only the active phase opens. */
export function TodoTree({ phases, full = false }: { phases: readonly TodoPhase[]; full?: boolean }): ReactNode {
	const activeIdx = selectActivePhaseIndex(phases);

	return (
		<div className="tv-todo-tree">
			<div className="tv-todo-tree-root">TODO</div>
			{phases.map((phase, pIdx) => {
				const closed = phase.tasks.filter(t => isClosedTodo(t.status)).length;
				const roman = formatRoman(pIdx + 1);
				const displayName = roman ? `${roman}. ${phase.name}` : phase.name;
				const isActive = pIdx === activeIdx;
				return (
					<div key={phase.name || `p-${pIdx}`} className={isActive ? "tv-todo-active-phase" : undefined}>
						<div className="tv-todo-row">
							<span className="tv-todo-rail tv-todo-rail--outer"> ├─ </span>
							<span className={`tv-todo-content ${isActive ? "tv-todo-phase--active" : "tv-todo-phase--dim"}`}>
								{displayName}
								{` · ${closed}/${phase.tasks.length}`}
							</span>
						</div>
						{isActive || full ? <TaskRows tasks={phase.tasks} /> : null}
					</div>
				);
			})}
			<div className="tv-todo-row">
				<span className="tv-todo-rail"> └──</span>
			</div>
		</div>
	);
}

// The tree lives in the now strip above the composer; the transcript keeps a one-line record per call.
function Body({ result }: ToolRenderProps): ReactNode {
	return result?.isError ? <ResultText result={result} maxLines={8} /> : null;
}

export const todoRenderer: ToolRenderer = {
	Summary,
	Body,
};
