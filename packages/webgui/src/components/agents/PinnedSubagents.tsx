import { type ReactNode, useState } from "react";
import { layoutPinned, type PinnedAgentRow } from "../../lib/pinned-subagents-model";
import "./pinned-subagents.css";

/** Desktop inspector: the TUI's pinned Subagents block. Rows focus the agent; the header opens the hub. */
export function PinnedSubagents(props: {
	rows: readonly PinnedAgentRow[];
	onFocusAgent(id: string): void;
	onOpenHub(): void;
}): ReactNode {
	const { rows, onFocusAgent, onOpenHub } = props;
	const [expanded, setExpanded] = useState(false);
	const layout = layoutPinned(rows.length, expanded);
	return (
		<section className="pa-panel" aria-label="Subagents">
			<header className="pa-head">
				<h3 className="pa-title">Subagents</h3>
				<button type="button" className="pa-hub-btn" onClick={onOpenHub}>
					Open Agent Hub
				</button>
			</header>
			{rows.length === 0 ? (
				<div className="pa-empty">No subagents running.</div>
			) : (
				<ul className="pa-list">
					{rows.slice(0, layout.itemRows).map(row => (
						<li key={row.id}>
							<button
								type="button"
								className="pa-row"
								data-agent-id={row.id}
								onClick={() => onFocusAgent(row.id)}
								title={`Focus ${row.label}`}
							>
								<span className="pa-dot" aria-hidden="true" />
								{row.model && <span className="pa-model">{row.model}</span>}
								<span className="pa-id">{row.label}</span>
								{row.role && <span className="pa-role">{row.role}</span>}
								{row.text && (
									<span className={row.textIsPreview ? "pa-text pa-text--muted" : "pa-text"}>{row.text}</span>
								)}
							</button>
						</li>
					))}
				</ul>
			)}
			{layout.toggle && (
				<button type="button" className="pa-toggle" onClick={() => setExpanded(v => !v)}>
					{layout.toggle === "expand" ? `… ${rows.length - layout.itemRows} more, expand` : "… show less"}
				</button>
			)}
		</section>
	);
}
