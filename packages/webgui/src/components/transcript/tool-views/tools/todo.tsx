/** `todo` — phased task-list tree render and consecutive run summaries. */
import type { ReactNode } from "react";
import {
	formatRoman,
	isClosedTodo,
	isTodoStatus,
	selectActivePhaseIndex,
	type TodoItem,
	type TodoPhase,
	type TodoStatus,
} from "../../../../lib/todo-model";
import { Badges, ResultText } from "../parts";
import type { ToolRenderer, ToolRenderProps } from "../types";
import { detailsRecord, isRecord, normalizeWs, str, truncate } from "../util";

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

function toPhases(raw: unknown): TodoPhase[] | null {
	if (!Array.isArray(raw)) return null;
	const phases: TodoPhase[] = [];
	for (const p of raw) {
		if (!isRecord(p)) continue;
		const name = str(p.name) ?? "";
		const rawTasks = Array.isArray(p.tasks) ? p.tasks : [];
		const tasks: TodoItem[] = [];
		for (const t of rawTasks) {
			if (!isRecord(t)) continue;
			const content = str(t.content) ?? "";
			const rawStatus = str(t.status);
			const status: TodoStatus = isTodoStatus(rawStatus) ? rawStatus : "pending";
			const blocker = str(t.blocker) ?? undefined;
			tasks.push({
				content,
				status,
				...(blocker ? { blocker } : {}),
			});
		}
		phases.push({ name, tasks });
	}
	return phases.length > 0 ? phases : null;
}

export function TodoTree({ phases }: { phases: readonly TodoPhase[] }): ReactNode {
	const activeIdx = selectActivePhaseIndex(phases);

	return (
		<div className="tv-todo-tree">
			<div className="tv-todo-tree-root">TODO</div>
			{phases.map((phase, pIdx) => {
				const closed = phase.tasks.filter(t => isClosedTodo(t.status)).length;
				const total = phase.tasks.length;
				const roman = formatRoman(pIdx + 1);
				const displayName = roman ? `${roman}. ${phase.name}` : phase.name;
				const progress = ` · ${closed}/${total}`;
				const isActive = pIdx === activeIdx;

				if (!isActive) {
					return (
						<div key={phase.name || `p-${pIdx}`} className="tv-todo-row">
							<span className="tv-todo-rail tv-todo-rail--outer"> ├─ </span>
							<span className="tv-todo-content tv-todo-phase--dim">
								{displayName}
								{progress}
							</span>
						</div>
					);
				}

				return (
					<div key={phase.name || `p-${pIdx}`} className="tv-todo-active-phase">
						<div className="tv-todo-row">
							<span className="tv-todo-rail tv-todo-rail--outer"> ├─ </span>
							<span className="tv-todo-content tv-todo-phase--active">
								{displayName}
								{progress}
							</span>
						</div>
						{phase.tasks.map((task, tIdx) => {
							const isLast = tIdx === phase.tasks.length - 1;
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
									<span className={`tv-todo-rail tv-todo-rail--outer${isLast ? "" : " tv-todo-rail--inner"}`}>
										{rail}
									</span>
									<span className="tv-todo-content">
										<span className="tv-todo-marker">{marker}</span>{" "}
										<span className="tv-todo-task-text">{task.content}</span>
										{suffix && <span className="tv-todo-task-suffix">{suffix}</span>}
									</span>
								</div>
							);
						})}
					</div>
				);
			})}
			<div className="tv-todo-row">
				<span className="tv-todo-rail"> └──</span>
			</div>
		</div>
	);
}

function Body({ result }: ToolRenderProps): ReactNode {
	const rec = detailsRecord(result);
	const phases = rec && Array.isArray(rec.phases) && !result?.isError ? toPhases(rec.phases) : null;
	if (result?.isError || phases === null) {
		return <ResultText result={result} maxLines={8} />;
	}
	return <TodoTree phases={phases} />;
}

export const todoRenderer: ToolRenderer = {
	Summary,
	Body,
	defaultOpen: true,
};
