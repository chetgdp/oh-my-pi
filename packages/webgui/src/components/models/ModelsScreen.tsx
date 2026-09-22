import type { ReactNode } from "react";
import type { RpcModelRolesResult, RpcAgentsResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { RoleRow } from "./RoleRow";
import { AgentRow } from "./AgentRow";
import "./models.css";

export interface ModelsScreenProps {
	roles: RpcModelRolesResult | null;
	agents: RpcAgentsResult | null;
	onPickRole(roleId: string): void;
	onPickAgent(agentName: string): void;
}

function sortedRoles(roles: RpcModelRolesResult): RpcModelRolesResult["roles"] {
	const chat = roles.roles.filter(r => r.section === "chat");
	const kind = roles.roles.filter(r => r.section === "kind");
	return [...chat, ...kind];
}

export function ModelsScreen({ roles, agents, onPickRole, onPickAgent }: ModelsScreenProps): ReactNode {
	return (
		<div className="md-screen">
			<section className="md-section">
				<h3 className="md-section-title">Roles</h3>
				{roles ? (
					<div className="md-list">
						{sortedRoles(roles).map(role => (
							<RoleRow key={role.id} role={role} onClick={() => onPickRole(role.id)} />
						))}
					</div>
				) : (
					<div className="md-empty">loading...</div>
				)}
			</section>
			<section className="md-section">
				<h3 className="md-section-title">Agents</h3>
				{agents ? (
					<div className="md-list">
						{agents.agents.map(agent => (
							<AgentRow key={agent.name} agent={agent} onClick={() => onPickAgent(agent.name)} />
						))}
					</div>
				) : (
					<div className="md-empty">loading...</div>
				)}
			</section>
		</div>
	);
}
