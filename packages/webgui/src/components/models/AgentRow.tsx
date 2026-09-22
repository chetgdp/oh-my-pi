import type { ReactNode } from "react";
import type { RpcAgentInfo } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface AgentRowProps {
	agent: RpcAgentInfo;
	onClick(): void;
}

function effectiveModel(agent: RpcAgentInfo): string {
	if (agent.resolved) return agent.resolved.name;
	if (agent.patterns.length > 0) return agent.patterns[0];
	return "default";
}

export function AgentRow({ agent, onClick }: AgentRowProps): ReactNode {
	return (
		<button type="button" className={"md-row" + (agent.disabled ? " md-row--disabled" : "")} onClick={onClick}>
			<div className="md-row-main">
				<span className="md-row-name">{agent.name}</span>
				<span className="md-badge md-badge--source">{agent.source}</span>
				{agent.override && <span className="md-badge md-badge--override">override</span>}
			</div>
			<div className="md-row-detail">
				<span className="md-row-model">{effectiveModel(agent)}</span>
				<span className="md-row-desc">{agent.description}</span>
			</div>
		</button>
	);
}
