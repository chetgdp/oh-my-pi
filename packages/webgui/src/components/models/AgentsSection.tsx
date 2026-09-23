import type { ReactNode } from "react";
import type { AgentsSectionProps } from "./contract";
import { AgentRow } from "./AgentRow";
import "./agents-config.css";

export function AgentsSection({
	agents,
	onPickAgent,
	onSetEnabled,
	onSetServiceTier,
	onSetPrewalk,
	onSetAdvisor,
}: AgentsSectionProps): ReactNode {
	if (!agents || agents.agents.length === 0) {
		return null;
	}

	return (
		<div className="ag-section">
			{agents.agents.map(agent => (
				<AgentRow
					key={agent.name}
					agent={agent}
					onPickAgent={onPickAgent}
					onSetEnabled={onSetEnabled}
					onSetServiceTier={onSetServiceTier}
					onSetPrewalk={onSetPrewalk}
					onSetAdvisor={onSetAdvisor}
				/>
			))}
		</div>
	);
}
