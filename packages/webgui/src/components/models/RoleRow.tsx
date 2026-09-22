import type { ReactNode } from "react";
import type { RpcModelRole } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface RoleRowProps {
	role: RpcModelRole;
	onClick(): void;
}

function sourceLabel(role: RpcModelRole): string {
	if (role.source === "fallback" && role.fallbackFrom) return `fallback from ${role.fallbackFrom}`;
	return role.source;
}

export function RoleRow({ role, onClick }: RoleRowProps): ReactNode {
	return (
		<button type="button" className="md-row" onClick={onClick}>
			<div className="md-row-main">
				<span className="md-row-name">{role.name}</span>
				<span className="md-row-id">{role.id}</span>
			</div>
			<div className="md-row-detail">
				{role.resolved ? (
					<>
						<span className="md-row-model">
							{role.resolved.name}
							{role.resolved.thinkingLevel ? ` (${role.resolved.thinkingLevel})` : ""}
						</span>
						<span className={"md-badge md-badge--" + role.source}>{sourceLabel(role)}</span>
					</>
				) : (
					<span className="md-row-model md-row-unset">unset</span>
				)}
			</div>
			{role.warning && <div className="md-row-warn">{role.warning}</div>}
		</button>
	);
}
