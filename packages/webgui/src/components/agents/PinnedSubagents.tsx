import type { ReactNode } from "react";
import { X } from "lucide-react";
import { fmtCost, fmtDuration, fmtTokens, relTime } from "../../lib/format";
import type { PinnedAgentRow } from "../../lib/pinned-subagents-model";
import "./pinned-subagents.css";

/**
 * Subagents as TUI Agent Hub cards: the desktop right bar, or a full page on
 * narrower screens (`onBack` set). Cards focus the agent; finished ones can be dismissed.
 */
export function PinnedSubagents(props: {
	rows: readonly PinnedAgentRow[];
	onFocusAgent(id: string): void;
	onDismiss(id: string): void;
	/** Shows "Clear all" for the finished agents when set. */
	onDismissAll?: (ids: readonly string[]) => void;
	onOpenHub(): void;
	onBack?: () => void;
	/** Rendered before the title, e.g. the desktop column's collapse toggle. */
	leading?: ReactNode;
}): ReactNode {
	const { rows, onFocusAgent, onDismiss, onDismissAll, onOpenHub, onBack, leading } = props;
	const finishedIds = rows.filter(row => row.status !== "running").map(row => row.id);
	return (
		<section className={onBack ? "pa-panel pa-panel--page" : "pa-panel"} aria-label="Subagents">
			<header className={onBack ? "pa-head sh-panel-header" : "pa-head"}>
				{onBack && (
					<button type="button" className="tb-back" onClick={onBack} aria-label="Back">
						&#x2190;
					</button>
				)}
				{leading}
				<h3 className="pa-title">Subagents</h3>
				{onDismissAll && finishedIds.length > 0 && (
					<button
						type="button"
						className="pa-clear-btn"
						onClick={() => onDismissAll(finishedIds)}
						title="Dismiss every finished agent"
					>
						Clear all
					</button>
				)}
				<button type="button" className="pa-hub-btn" onClick={onOpenHub}>
					Open Agent Hub
				</button>
			</header>
			{rows.length === 0 ? (
				<div className="pa-empty">No subagents.</div>
			) : (
				<ul className="pa-list">
					{rows.map(row => {
						const m = row.metrics;
						return (
							<li
								key={row.id}
								className={row.status === "running" ? "pa-card" : "pa-card pa-card--dismissible"}
								data-status={row.status}
							>
								<button
									type="button"
									className="pa-row"
									data-agent-id={row.id}
									onClick={() => onFocusAgent(row.id)}
									title={`Focus ${row.label}`}
								>
									<span className="pa-line">
										<span className={`pa-dot pa-dot--${row.status}`} title={row.status} />
										<span className="pa-id">{row.label}</span>
										<span className="pa-kind">
											{row.role && <span className="pa-role">{row.role}</span>}
											{row.role && row.model && <span className="pa-sep"> · </span>}
											{row.model && <span className="pa-model">{row.model}</span>}
											{row.level && <span className="pa-level"> {row.level}</span>}
										</span>
									</span>
									{row.task && <span className="pa-task">{row.task}</span>}
									<span className="pa-metrics">
										{m && (
											<>
												<span>{fmtCost(m.cost)}</span>
												{m.durationMs > 0 && <span>{fmtDuration(m.durationMs)}</span>}
												<span>{m.requests} req</span>
												<span>{m.tools} tools</span>
												<span>{fmtTokens(m.tokens)} tok</span>
											</>
										)}
										<span>{relTime(row.lastActivity)}</span>
									</span>
								</button>
								{row.status !== "running" && (
									<button
										type="button"
										className="pa-dismiss"
										aria-label={`Dismiss ${row.label}`}
										onClick={() => onDismiss(row.id)}
									>
										<X size={14} aria-hidden="true" />
									</button>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
