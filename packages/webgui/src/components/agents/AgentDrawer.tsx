/**
 * Wrapper around collab-web AgentsPanel for the webgui.
 *
 * Takes a SubagentTreeState and renders a slide-out panel listing
 * all subagents with their status and progress.
 */
import type { ReactNode } from "react";
import { AgentsPanel } from "../../../../collab-web/src/components/agents/AgentsPanel";
import type { SubagentTreeState } from "../../lib/subagent-model";
import { toAgentsPanelData } from "../../lib/subagent-model";

export function AgentDrawer(props: { state: SubagentTreeState; open: boolean; onClose(): void }): ReactNode {
	const { state, open, onClose } = props;
	if (!open) return null;

	const { agents, progress, lifecycle } = toAgentsPanelData(state);

	return (
		<aside className="agent-drawer" role="dialog" aria-label="Subagents">
			<div className="agent-drawer-header">
				<span>Subagents</span>
				<button type="button" onClick={onClose} aria-label="Close">
					&times;
				</button>
			</div>
			<AgentsPanel agents={agents} progress={progress} lifecycle={lifecycle} selectedId={null} onSelect={() => {}} />
		</aside>
	);
}
