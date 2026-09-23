import { useState, type ReactNode } from "react";
import type { RpcModelRole } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface CycleOrderEditorProps {
	roles: RpcModelRole[];
	cycleOrder: string[];
	onChange(newOrder: string[]): void;
}

/**
 * Toggle a role in/out of the quick-switch cycle order.
 * If present, removes it; if absent, appends it to the end.
 */
export function toggleCycleRole(order: string[], roleId: string): string[] {
	if (order.includes(roleId)) {
		return order.filter(id => id !== roleId);
	}
	return [...order, roleId];
}

/**
 * Move a role within the cycle order by delta (-1 for up/earlier, +1 for down/later).
 * Clamps to [0, order.length - 1]. Returns a new array.
 */
export function moveCycleRole(order: string[], roleId: string, delta: number): string[] {
	const index = order.indexOf(roleId);
	if (index === -1) return order;
	const nextIndex = Math.max(0, Math.min(order.length - 1, index + delta));
	if (nextIndex === index) return order;

	const next = [...order];
	const [item] = next.splice(index, 1);
	next.splice(nextIndex, 0, item);
	return next;
}

export function CycleOrderEditor({ roles, cycleOrder, onChange }: CycleOrderEditorProps): ReactNode {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="md-cycle-editor">
			<button
				type="button"
				className="md-cycle-toggle"
				onClick={() => setExpanded(prev => !prev)}
				aria-expanded={expanded}
			>
				<span className="md-cycle-title">Quick-switch cycle</span>
				<span className="md-cycle-count">({cycleOrder.length})</span>
				{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
			</button>

			{expanded && (
				<div className="md-cycle-body">
					<div className="md-cycle-list">
						{roles.map(role => {
							const checked = cycleOrder.includes(role.id);
							return (
								<div key={role.id} className="md-cycle-item">
									<label className="md-cycle-label">
										<input
											type="checkbox"
											checked={checked}
											onChange={() => onChange(toggleCycleRole(cycleOrder, role.id))}
										/>
										<span className="md-cycle-name">{role.name}</span>
										<span className="md-cycle-id">{role.id}</span>
									</label>

									{checked && (
										<div className="md-cycle-actions">
											<button
												type="button"
												className="md-cycle-btn"
												aria-label={`Move ${role.id} up`}
												disabled={cycleOrder.indexOf(role.id) <= 0}
												onClick={() => onChange(moveCycleRole(cycleOrder, role.id, -1))}
											>
												<ChevronUp size={16} />
											</button>
											<button
												type="button"
												className="md-cycle-btn"
												aria-label={`Move ${role.id} down`}
												disabled={cycleOrder.indexOf(role.id) >= cycleOrder.length - 1}
												onClick={() => onChange(moveCycleRole(cycleOrder, role.id, 1))}
											>
												<ChevronDown size={16} />
											</button>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
