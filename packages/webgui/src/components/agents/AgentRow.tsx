import type { ReactNode } from "react";
import type { SubagentNode } from "../../lib/subagent-model";
import type { AgentProgress } from "@oh-my-pi/pi-wire";
import { fmtTokens, fmtCost, fmtDuration, relTime } from "../../lib/format";

function toolStartMs(p: AgentProgress): number | null {
	if ("currentToolStartMs" in p && typeof p.currentToolStartMs === "number") return p.currentToolStartMs;
	const lastEnd = p.recentTools[0]?.endMs;
	return typeof lastEnd === "number" ? lastEnd : null;
}

function activityLine(node: SubagentNode, now: number): string {
	// A finished run's last tool or intent is stale; its outcome is the news.
	if (node.snapshot.status !== "running") return node.lifecycle?.status ?? node.snapshot.status;
	const p = node.progress?.progress;
	if (p?.currentTool) {
		const start = toolStartMs(p);
		if (start !== null) return `${p.currentTool} -- ${fmtDuration(Math.max(0, now - start))}`;
		return p.currentTool;
	}
	if (p?.lastIntent) return p.lastIntent;
	if (node.lifecycle) return node.lifecycle.status;
	return node.snapshot.status;
}

export function AgentRow(props: {
	node: SubagentNode;
	depth: number;
	expanded: boolean;
	now: number;
	onToggle(id: string): void;
}): ReactNode {
	const { node, depth, expanded, now, onToggle } = props;
	const { snapshot } = node;
	const p = node.progress?.progress;
	const indent = depth * 20;

	return (
		<div className="ag-row-wrap">
			<button
				type="button"
				className="ag-row"
				style={{ paddingLeft: `${8 + indent}px` }}
				onClick={() => onToggle(snapshot.id)}
				aria-expanded={expanded}
			>
				<span className="ag-row-head">
					<span className={`ag-dot ag-dot--${snapshot.status}`} />
					<span className="ag-row-name">{snapshot.displayName}</span>
					{node.progress ? <span className="ag-row-model">{node.progress.agent}</span> : null}
				</span>
				<span className="ag-row-activity">{activityLine(node, now)}</span>
				<span className="ag-row-meta">
					{p ? <span>{fmtTokens(p.tokens)} tok</span> : null}
					{p ? <span>{fmtCost(p.cost)}</span> : null}
					<span className="ag-row-meta-when">{relTime(snapshot.lastActivity)}</span>
				</span>
			</button>
			{expanded ? (
				<div className="ag-row-detail" style={{ paddingLeft: `${22 + indent}px` }}>
					{node.progress?.task ? <p className="ag-detail-task">{node.progress.task}</p> : null}
					{node.progress?.assignment ? <p className="ag-detail-assignment">{node.progress.assignment}</p> : null}
					{!node.progress?.task && !node.progress?.assignment ? (
						<p className="ag-detail-none">no details</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
