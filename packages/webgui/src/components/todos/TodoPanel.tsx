/**
 * Phased task list viewer and interactive control panel.
 *
 * Supports tap-to-cycle or tap-to-set task status via RPC set_todos, or a read-only view
 * (`readOnly`) for a focused subagent's list, which never submits an edit.
 * Guaranteed 44px min touch targets for mobile ergonomics.
 */

import { type ReactNode, useState } from "react";
import {
	type TodoPhase,
	type TodoStatus,
	countTodoProgress,
	cycleTaskStatus,
	formatRoman,
	updateTaskStatus,
} from "../../lib/todo-model";
import "./todos.css";

export interface TodoPanelProps {
	phases: readonly TodoPhase[];
	/** Persists an edited list; omitted with `readOnly`. */
	onUpdateTodos?: (phases: TodoPhase[]) => Promise<void>;
	/** Display only: rows are inert and no edit is ever submitted (a focused subagent's list). */
	readOnly?: boolean;
}

const STATUS_ICONS: Record<TodoStatus, string> = {
	completed: "✓",
	in_progress: "→",
	abandoned: "✕",
	pending: "○",
	blocked: "⊘",
};

const STATUS_LABELS: Record<TodoStatus, string> = {
	completed: "Done",
	in_progress: "In Progress",
	abandoned: "Dropped",
	pending: "Pending",
	blocked: "Blocked",
};

export function TodoPanel({ phases, onUpdateTodos, readOnly = false }: TodoPanelProps): ReactNode {
	const [submitting, setSubmitting] = useState(false);
	const progress = countTodoProgress(phases);

	async function handleCycle(phaseIndex: number, taskIndex: number): Promise<void> {
		if (readOnly || !onUpdateTodos || submitting) return;
		const phase = phases[phaseIndex];
		const task = phase?.tasks[taskIndex];
		if (!task) return;
		const nextStatus = cycleTaskStatus(task.status);
		setSubmitting(true);
		try {
			const updated = updateTaskStatus(phases, phaseIndex, taskIndex, nextStatus);
			await onUpdateTodos(updated);
		} finally {
			setSubmitting(false);
		}
	}

	async function handleSetStatus(
		phaseIndex: number,
		taskIndex: number,
		status: TodoStatus,
		e: React.MouseEvent,
	): Promise<void> {
		e.stopPropagation();
		if (readOnly || !onUpdateTodos || submitting) return;
		setSubmitting(true);
		try {
			const updated = updateTaskStatus(phases, phaseIndex, taskIndex, status);
			await onUpdateTodos(updated);
		} finally {
			setSubmitting(false);
		}
	}

	if (phases.length === 0 || progress.total === 0) {
		return (
			<div className="td-panel">
				<div className="td-empty">
					<div className="td-empty-title">No todos</div>
					<div className="td-empty-desc">
						Tasks and phases created by the agent or /todo commands will appear here.
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={readOnly ? "td-panel td-panel--readonly" : "td-panel"}>
			<div className="td-summary">
				<div className="td-summary-row">
					<span className="td-summary-counts">
						{progress.closed} of {progress.total} tasks closed
					</span>
					<span className="td-summary-percent">{progress.percent}%</span>
				</div>
				<div className="td-progress-track">
					<div className="td-progress-fill" style={{ width: `${progress.percent}%` }} />
				</div>
			</div>

			<div className="td-content">
				{phases.map((phase, pIdx) => {
					const phaseClosed = phase.tasks.filter(t => t.status === "completed" || t.status === "abandoned").length;
					const roman = formatRoman(pIdx + 1);
					return (
						<div key={phase.name || `phase-${pIdx}`} className="td-phase">
							<div className="td-phase-header">
								<span>
									{roman ? `${roman}. ` : ""}
									{phase.name}
								</span>
								<span className="td-phase-count">
									{phaseClosed}/{phase.tasks.length}
								</span>
							</div>

							<div className="td-task-list">
								{phase.tasks.map((task, tIdx) => {
									const status = task.status;
									return (
										<div
											key={`task-${pIdx}-${tIdx}-${task.content}`}
											className={`td-task-row td-task-row--${status}`}
											onClick={readOnly ? undefined : () => handleCycle(pIdx, tIdx)}
											role={readOnly ? undefined : "button"}
											tabIndex={readOnly ? undefined : 0}
											onKeyDown={
												readOnly
													? undefined
													: e => {
															if (e.key === "Enter" || e.key === " ") {
																e.preventDefault();
																void handleCycle(pIdx, tIdx);
															}
														}
											}
											aria-label={
												readOnly
													? `${task.content}: ${STATUS_LABELS[status]}`
													: `${task.content}: ${STATUS_LABELS[status]}. Tap to cycle status.`
											}
										>
											<button
												type="button"
												className={`td-status-btn td-status-btn--${status}`}
												onClick={e => {
													e.stopPropagation();
													void handleCycle(pIdx, tIdx);
												}}
												title={
													readOnly
														? `Status: ${STATUS_LABELS[status]}`
														: `Status: ${STATUS_LABELS[status]}. Tap to cycle.`
												}
												aria-label={
													readOnly ? STATUS_LABELS[status] : `Cycle status from ${STATUS_LABELS[status]}`
												}
												disabled={submitting || readOnly}
											>
												{STATUS_ICONS[status]}
											</button>

											<div className="td-task-body">
												<div className="td-task-main">
													<span className="td-task-content">{task.content}</span>
													<button
														type="button"
														className={`td-task-badge td-task-badge--${status}`}
														onClick={e => {
															// Clicking badge cycles to next status
															void handleSetStatus(pIdx, tIdx, cycleTaskStatus(status), e);
														}}
														title={readOnly ? undefined : "Tap to change status"}
														disabled={submitting || readOnly}
													>
														{STATUS_LABELS[status]}
													</button>
												</div>

												{status === "blocked" && task.blocker && (
													<div className="td-task-blocker">
														<span>Blocked:</span> {task.blocker}
													</div>
												)}

												{task.details && (
													<div className="td-task-blocker">
														<span>Note:</span> {task.details}
													</div>
												)}

												{task.notes && task.notes.length > 0 && (
													<ul className="td-task-notes">
														{task.notes.map((note, nIdx) => (
															<li key={`note-${nIdx}`}>{note}</li>
														))}
													</ul>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
