/**
 * Subagent tree panel for webgui.
 *
 * Rows are 44px min touch targets, 15px text.
 * Tree structure via parentToolCallId linkage.
 * Running agents first, then parked. Tap toggles inline detail.
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { SubagentTreeState, SubagentNode } from "../../lib/subagent-model";
import { buildChildrenMap } from "../../lib/subagent-model";
import { AgentRow } from "./AgentRow";
import "./agents.css";

export function AgentsPanel(props: { state: SubagentTreeState }): ReactNode {
	const { state } = props;
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const { sorted, childrenMap } = useMemo(() => {
		const cm = buildChildrenMap(state);
		const roots: SubagentNode[] = [];
		for (const node of state.agents.values()) {
			// An agent is a root if it has no parentId, or if its parentId does not exist as an agent in the tree
			if (!node.snapshot.parentId || !state.agents.has(node.snapshot.parentId)) {
				roots.push(node);
			}
		}
		roots.sort((a, b) => {
			const ar = a.snapshot.status === "running" ? 0 : 1;
			const br = b.snapshot.status === "running" ? 0 : 1;
			if (ar !== br) return ar - br;
			return b.snapshot.lastActivity - a.snapshot.lastActivity;
		});
		return { sorted: roots, childrenMap: cm };
	}, [state]);

	function toggle(id: string): void {
		setExpandedId(prev => (prev === id ? null : id));
	}

	function renderTree(nodes: readonly SubagentNode[], depth: number): ReactNode[] {
		const out: ReactNode[] = [];
		for (const node of nodes) {
			out.push(
				<AgentRow
					key={node.snapshot.id}
					node={node}
					depth={depth}
					expanded={expandedId === node.snapshot.id}
					now={now}
					onToggle={toggle}
				/>,
			);
			const childIds = childrenMap.get(node.snapshot.id);
			if (childIds && childIds.length > 0) {
				const childNodes = childIds
					.map(id => state.agents.get(id))
					.filter((n): n is SubagentNode => n !== undefined)
					.sort((a, b) => {
						const ar = a.snapshot.status === "running" ? 0 : 1;
						const br = b.snapshot.status === "running" ? 0 : 1;
						if (ar !== br) return ar - br;
						return b.snapshot.lastActivity - a.snapshot.lastActivity;
					});
				out.push(...renderTree(childNodes, depth + 1));
			}
		}
		return out;
	}

	if (state.agents.size === 0) {
		return (
			<div className="ag-panel">
				<div className="ag-empty">no subagents</div>
			</div>
		);
	}

	return <div className="ag-panel">{renderTree(sorted, 0)}</div>;
}
