import { useState, type ReactNode, type MouseEvent, type KeyboardEvent } from "react";
import type { RpcModelRole } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RoleStorage } from "./contract";
import { Trash2 } from "lucide-react";

export interface RoleRowProps {
	role: RpcModelRole;
	storage?: RoleStorage;
	onClick(): void;
	onClearRole?(roleId: string, storage?: RoleStorage): void;
	onDeleteRole?(roleId: string): void;
	onSetTag?(modelSelector: string, tag: string | null): void;
}

export function RoleRow({ role, storage, onClick, onClearRole, onDeleteRole, onSetTag }: RoleRowProps): ReactNode {
	// Storage scope cycle state: first tap arms with "tap again to clear <scope>", second tap clears.
	const [scopeArm, setScopeArm] = useState<RoleStorage | null>(null);
	// Delete confirmation: first tap arms with "tap again to delete", second tap deletes.
	const [deleteArm, setDeleteArm] = useState(false);
	// Tag editing inline input state.
	const [editingTag, setEditingTag] = useState(false);
	const [tagInput, setTagInput] = useState(role.tag ?? "");

	const model = role.resolved ?? role.autoSelected;
	const isAuto = !role.resolved && !!role.autoSelected;
	const isConfigured = Boolean(role.configured);

	// Scope cycling in project mode for configured roles:
	// project -> global -> armed clear -> execute clear
	const handleScopeClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (!onClearRole) return;
		if (scopeArm === "project") {
			onClearRole(role.id, "project");
			setScopeArm(null);
		} else if (scopeArm === "global") {
			onClearRole(role.id, "global");
			setScopeArm(null);
		} else if (role.provenance === "project") {
			setScopeArm("project");
		} else if (role.provenance === "global") {
			setScopeArm("global");
		} else {
			setScopeArm("project");
		}
	};

	const handleDeleteClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (!onDeleteRole) return;
		if (deleteArm) {
			onDeleteRole(role.id);
			setDeleteArm(false);
		} else {
			setDeleteArm(true);
		}
	};

	const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.stopPropagation();
			setEditingTag(false);
			const selector = role.resolved?.id ? `${role.resolved.provider}/${role.resolved.id}` : role.configured;
			if (selector && onSetTag) {
				const trimmed = tagInput.trim();
				onSetTag(selector, trimmed.length > 0 ? trimmed : null);
			}
		} else if (e.key === "Escape") {
			e.stopPropagation();
			setEditingTag(false);
			setTagInput(role.tag ?? "");
		}
	};

	// Determine badge label and display text
	const badgeType = role.provenance ?? (role.source === "active" ? "active" : role.source);
	const shouldShowBadge = badgeType && badgeType !== "default" && role.source !== "unset";

	let badgeText: string = badgeType;
	if (badgeType === "runtime") {
		badgeText = "session only";
	} else if (role.source === "fallback" && role.fallbackFrom) {
		badgeText = `fallback from ${role.fallbackFrom}`;
	}

	return (
		<div
			className="md-row md-role-row"
			onClick={onClick}
			role="button"
			tabIndex={0}
			onKeyDown={e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}}
		>
			<div className="md-row-main">
				<span className="md-row-name">{role.name}</span>
				<span className="md-row-id">{role.id}</span>

				{role.tag && !editingTag && (
					<button
						type="button"
						className="md-tag-chip"
						title="Click to edit tag"
						onClick={e => {
							e.stopPropagation();
							setEditingTag(true);
						}}
					>
						{role.tag}
					</button>
				)}

				{!role.tag && !editingTag && onSetTag && (
					<button
						type="button"
						className="md-tag-chip md-tag-chip--add"
						title="Add tag"
						onClick={e => {
							e.stopPropagation();
							setEditingTag(true);
						}}
					>
						+ tag
					</button>
				)}

				{editingTag && (
					<input
						type="text"
						className="md-tag-input"
						value={tagInput}
						autoFocus
						onClick={e => e.stopPropagation()}
						onChange={e => setTagInput(e.target.value)}
						onKeyDown={handleTagKeyDown}
						onBlur={() => {
							setEditingTag(false);
							setTagInput(role.tag ?? "");
						}}
						placeholder="tag..."
					/>
				)}
			</div>

			<div className="md-row-detail">
				{model ? (
					<>
						<span className="md-row-model">
							{model.name}
							{model.thinkingLevel ? ` (${model.thinkingLevel})` : ""}
						</span>
						{isAuto ? <span className="md-badge md-badge--auto">auto</span> : null}
					</>
				) : (
					<span className="md-row-model md-row-unset">unset</span>
				)}

				{/* Provenance badge: runtime -> session only; overlay/project/global; default is hidden */}
				{shouldShowBadge && (
					<>
						{storage === "project" && isConfigured && onClearRole ? (
							<button
								type="button"
								className={`md-badge md-badge--${badgeType} md-badge--scope-control`}
								onClick={handleScopeClick}
								title="Click to change scope or clear"
							>
								{scopeArm ? `tap again to clear ${scopeArm}` : badgeText}
							</button>
						) : (
							<span className={`md-badge md-badge--${badgeType}`}>{badgeText}</span>
						)}
					</>
				)}

				{role.custom && onDeleteRole && (
					<button
						type="button"
						className={`md-role-delete-btn ${deleteArm ? "md-role-delete-btn--armed" : ""}`}
						onClick={handleDeleteClick}
						aria-label={deleteArm ? `Tap again to delete ${role.id}` : `Delete ${role.id}`}
						title={deleteArm ? "Tap again to delete" : "Delete role"}
					>
						{deleteArm ? "tap again to delete" : <Trash2 size={16} />}
					</button>
				)}
			</div>

			{role.warning && <div className="md-row-warn">{role.warning}</div>}
		</div>
	);
}
