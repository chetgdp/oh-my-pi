import { useState, type ReactNode } from "react";
import type { RpcModelRole, RpcModelRolesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RolesSectionProps } from "./contract";
import { RoleRow } from "./RoleRow";
import { CycleOrderEditor } from "./CycleOrderEditor";
import { Plus } from "lucide-react";
import "./roles.css";

/**
 * Sorts roles by section: chat roles first, then kind roles.
 */
export function sortedRoles(roles: RpcModelRolesResult): RpcModelRole[] {
	const chat = roles.roles.filter(r => r.section === "chat");
	const kind = roles.roles.filter(r => r.section === "kind");
	return [...chat, ...kind];
}

/**
 * Validate a candidate role identifier:
 * Must start with an ASCII letter, followed by letters, digits, underscores or hyphens.
 * Must not already exist among current roles.
 */
export function validateRoleId(id: string, existing: string[]): string | null {
	if (!id) return "Role ID cannot be empty";
	if (!/^[a-zA-Z][\w-]*$/.test(id)) {
		return "Role ID must start with a letter and contain only letters, numbers, underscores, and dashes";
	}
	if (existing.includes(id)) {
		return `Role "${id}" already exists`;
	}
	return null;
}

export function RolesSection({
	roles,
	onPickRole,
	onClearRole,
	onCreateRole,
	onDeleteRole,
	onSetCycleOrder,
	onSetTag,
}: RolesSectionProps): ReactNode {
	const [isAdding, setIsAdding] = useState(false);
	const [newRoleId, setNewRoleId] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);

	if (!roles) {
		return (
			<section className="md-section md-roles-section">
				<div className="md-empty">loading...</div>
			</section>
		);
	}

	const existingIds = roles.roles.map(r => r.id);
	const orderedRoles = sortedRoles(roles);

	const handleCreateSubmit = () => {
		const trimmed = newRoleId.trim();
		const err = validateRoleId(trimmed, existingIds);
		if (err) {
			setValidationError(err);
			return;
		}
		onCreateRole(trimmed);
		setNewRoleId("");
		setValidationError(null);
		setIsAdding(false);
	};

	return (
		<section className="md-section md-roles-section">
			<div className="md-list">
				{orderedRoles.map(role => (
					<RoleRow
						key={role.id}
						role={role}
						storage={roles.storage}
						onClick={() => onPickRole(role.id)}
						onClearRole={onClearRole}
						onDeleteRole={onDeleteRole}
						onSetTag={onSetTag}
					/>
				))}
			</div>

			<div className="md-roles-footer">
				{!isAdding ? (
					<button
						type="button"
						className="md-new-role-btn"
						onClick={() => {
							setIsAdding(true);
							setValidationError(null);
						}}
					>
						<Plus size={16} />
						<span>New role</span>
					</button>
				) : (
					<div className="md-new-role-form">
						<div className="md-new-role-input-row">
							<input
								type="text"
								className={`md-new-role-input ${validationError ? "md-new-role-input--error" : ""}`}
								value={newRoleId}
								autoFocus
								onChange={e => {
									setNewRoleId(e.target.value);
									if (validationError) {
										setValidationError(null);
									}
								}}
								onKeyDown={e => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleCreateSubmit();
									} else if (e.key === "Escape") {
										setIsAdding(false);
										setNewRoleId("");
										setValidationError(null);
									}
								}}
								placeholder="role-id (e.g. planner)"
							/>
							<button type="button" className="md-new-role-submit" onClick={handleCreateSubmit}>
								Create
							</button>
							<button
								type="button"
								className="md-new-role-cancel"
								onClick={() => {
									setIsAdding(false);
									setNewRoleId("");
									setValidationError(null);
								}}
							>
								Cancel
							</button>
						</div>
						{validationError && (
							<div className="md-new-role-error" role="alert">
								{validationError}
							</div>
						)}
					</div>
				)}
			</div>

			<CycleOrderEditor roles={roles.roles} cycleOrder={roles.cycleOrder} onChange={onSetCycleOrder} />
		</section>
	);
}

export { toggleCycleRole, moveCycleRole } from "./CycleOrderEditor";
