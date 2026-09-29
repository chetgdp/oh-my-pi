import type { ReactNode } from "react";
import { useState, useEffect, useCallback } from "react";
import { Bot, RefreshCw, X, SlidersHorizontal, Pencil, Info, MoreVertical } from "lucide-react";
import type { RpcConnectionState } from "../../lib/rpc-client";
import { navigate } from "../../lib/route";
import type { Route } from "../../lib/route";
import type { SessionCommandSink } from "../../lib/session-actions";
import { compact, handoff, newSession, clearContext } from "../../lib/session-actions";
import { notify } from "../../lib/notify";
import { browserWindow } from "../../lib/dom";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface TopBarProps {
	title: string;
	connection: RpcConnectionState;
	route: Route;
	subagentCount?: number;
	sessionState?: RpcSessionState | null;
	streaming?: boolean;
	sink?: SessionCommandSink | null;
	onReconnect?: () => void;
	onRename?: (newName: string) => Promise<boolean | void>;
}

type ContextActionKind = "compact" | "handoff" | "clear" | "new_session";

interface ConfirmState {
	action: ContextActionKind;
	title: string;
	description: string;
	confirmLabel: string;
	isDestructive?: boolean;
}
const CONNECTION_LABELS: Record<string, string> = {
	ready: "Connected",
	connecting: "Connecting",
	reconnecting: "Reconnecting",
	closed: "Disconnected",
};

function dotClass(conn: RpcConnectionState): string {
	if (conn === "reconnecting") return "tb-dot tb-dot-connecting";
	return `tb-dot tb-dot-${conn}`;
}

export function TopBar({
	title,
	connection,
	route,
	subagentCount,
	sessionState,
	streaming,
	sink,
	onReconnect,
	onRename,
}: TopBarProps): ReactNode {
	const [connPopoverOpen, setConnPopoverOpen] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
	const [actionPending, setActionPending] = useState(false);
	const [renaming, setRenaming] = useState(false);
	const [editName, setEditName] = useState(title);
	const instanceId = route.kind === "session" ? route.id : null;
	const panel = route.kind === "session" ? route.panel : null;

	const isStreaming = streaming ?? sessionState?.isStreaming ?? false;
	const isCompacting = sessionState?.isCompacting ?? false;
	const isBusy = isStreaming || isCompacting;

	// Close context menu on Esc key
	useEffect(() => {
		if (!menuOpen && !confirmModal) return;
		const handleKeyDown = (e: unknown): void => {
			if (e !== null && typeof e === "object" && "key" in e && e.key === "Escape") {
				if (confirmModal) {
					setConfirmModal(null);
				} else if (menuOpen) {
					setMenuOpen(false);
				}
			}
		};
		browserWindow.addEventListener("keydown", handleKeyDown);
		return () => {
			browserWindow.removeEventListener("keydown", handleKeyDown);
		};
	}, [menuOpen, confirmModal]);

	const openConfirm = useCallback((action: ContextActionKind) => {
		setMenuOpen(false);
		switch (action) {
			case "compact":
				setConfirmModal({
					action: "compact",
					title: "Compact context",
					description: "Summarize and compact current conversation history? This effect is shared with the TUI.",
					confirmLabel: "Compact",
				});
				break;
			case "handoff":
				setConfirmModal({
					action: "handoff",
					title: "Handoff session",
					description: "Produce a handoff summary for this session? This effect is shared with the TUI.",
					confirmLabel: "Handoff",
				});
				break;
			case "clear":
				setConfirmModal({
					action: "clear",
					title: "Clear context",
					description:
						"Reset session context and drop all conversation history? This effect is shared with the TUI.",
					confirmLabel: "Clear context",
					isDestructive: true,
				});
				break;
			case "new_session":
				setConfirmModal({
					action: "new_session",
					title: "New session",
					description: "Start a new session? This effect is shared with the TUI.",
					confirmLabel: "New session",
				});
				break;
		}
	}, []);

	const handleExecuteAction = useCallback(async () => {
		if (!confirmModal || !sink) {
			setConfirmModal(null);
			return;
		}
		const { action } = confirmModal;
		setActionPending(true);
		try {
			switch (action) {
				case "compact":
					await compact(sink);
					notify("info", "Compaction started");
					break;
				case "handoff":
					await handoff(sink);
					notify("info", "Handoff completed");
					break;
				case "clear":
					await clearContext(sink);
					notify("info", "Context cleared");
					break;
				case "new_session":
					await newSession(sink);
					notify("info", "New session started");
					break;
			}
		} catch (err: unknown) {
			notify("error", err instanceof Error ? err.message : String(err));
		} finally {
			setActionPending(false);
			setConfirmModal(null);
		}
	}, [confirmModal, sink]);

	if (route.kind === "sessions") {
		return <span className="tb-title">{title}</span>;
	}
	const toggleInfo = () => {
		if (route.kind === "session") {
			navigate({
				kind: "session",
				id: route.id,
				panel: panel === "info" ? null : "info",
			});
		}
	};

	const toggleAgents = () => {
		if (route.kind === "session") {
			navigate({
				kind: "session",
				id: route.id,
				panel: panel === "agents" ? null : "agents",
			});
		}
	};

	const toggleModels = () => {
		if (route.kind === "session") {
			navigate({
				kind: "session",
				id: route.id,
				panel: panel === "models" ? null : "models",
			});
		}
	};

	return (
		<>
			<button
				type="button"
				className="tb-back"
				onClick={() => navigate({ kind: "sessions" })}
				aria-label="Back to sessions"
			>
				&#x2190;
			</button>
			<button
				type="button"
				className="tb-title-btn"
				onClick={() => {
					setEditName(title);
					setRenaming(true);
				}}
				title="Tap to rename session"
				aria-label={`Session: ${title}. Tap to rename.`}
			>
				<span className="tb-title">{title}</span>
				{onRename && <Pencil size={12} className="tb-title-edit-icon" />}
			</button>
			<div className="tb-spacer" />

			<button
				type="button"
				className="tb-icon-btn tb-info-btn"
				data-active={panel === "info" ? "true" : undefined}
				onClick={toggleInfo}
				title="Session info"
				aria-label="Toggle info panel"
			>
				<Info size={16} />
			</button>

			<div className="tb-conn-anchor">
				<button
					type="button"
					className="tb-conn-btn"
					data-active={connPopoverOpen ? "true" : undefined}
					onClick={() => setConnPopoverOpen(prev => !prev)}
					title={`Connection: ${CONNECTION_LABELS[connection] ?? connection}. Tap for status.`}
					aria-label={`Connection: ${CONNECTION_LABELS[connection] ?? connection}`}
				>
					<span className={dotClass(connection)} />
					<span className={`tb-conn-label tb-conn-label--${connection}`}>
						{CONNECTION_LABELS[connection] ?? connection}
					</span>
				</button>

				{connPopoverOpen && (
					<>
						<div className="tb-popover-backdrop" onClick={() => setConnPopoverOpen(false)} />
						<div className="tb-conn-popover" role="dialog" aria-label="Connection Status">
							<div className="tb-popover-header">
								<span className="tb-popover-title">Connection</span>
								<button
									type="button"
									className="tb-popover-close"
									onClick={() => setConnPopoverOpen(false)}
									aria-label="Close"
								>
									<X size={14} />
								</button>
							</div>
							<div className="tb-popover-body">
								<div className="tb-popover-row">
									<span className="tb-popover-label">Status</span>
									<span className="tb-popover-val">
										<span className={dotClass(connection)} />
										{CONNECTION_LABELS[connection] ?? connection}
									</span>
								</div>
								<div className="tb-popover-row">
									<span className="tb-popover-label">Transport</span>
									<span className="tb-popover-val">WebSocket</span>
								</div>
								{instanceId && (
									<div className="tb-popover-row">
										<span className="tb-popover-label">Instance</span>
										<span className="tb-popover-val tb-popover-mono">{instanceId}</span>
									</div>
								)}
							</div>
							<div className="tb-popover-actions">
								<button
									type="button"
									className="tb-popover-btn"
									onClick={() => {
										onReconnect?.();
										setConnPopoverOpen(false);
									}}
								>
									<RefreshCw size={13} />
									<span>{connection === "ready" ? "Reconnect" : "Reconnect now"}</span>
								</button>
							</div>
						</div>
					</>
				)}
			</div>
			<button
				type="button"
				className="tb-panel-btn tb-models-btn"
				data-active={panel === "models" ? "true" : undefined}
				onClick={toggleModels}
				aria-label="Toggle models panel"
				title="Models"
			>
				<SlidersHorizontal size={18} />
			</button>
			<button
				type="button"
				className="tb-panel-btn tb-agents-btn"
				data-active={panel === "agents" ? "true" : undefined}
				onClick={toggleAgents}
				aria-label="Toggle agents panel"
				title={subagentCount && subagentCount > 0 ? `Subagents (${subagentCount})` : "Subagents"}
			>
				<Bot size={18} />
				{subagentCount !== undefined && subagentCount > 0 ? (
					<span className="tb-badge">{subagentCount}</span>
				) : null}
			</button>
			<div className="tb-menu-anchor">
				<button
					type="button"
					className="tb-panel-btn tb-menu-btn"
					data-active={menuOpen ? "true" : undefined}
					disabled={isBusy}
					onClick={() => setMenuOpen(prev => !prev)}
					aria-label="Session actions"
					title={isBusy ? "Session actions (disabled while busy)" : "Session actions"}
				>
					<MoreVertical size={18} />
				</button>

				{menuOpen && (
					<>
						<div className="tb-popover-backdrop" onClick={() => setMenuOpen(false)} />
						<div className="tb-context-menu" role="menu" aria-label="Session actions">
							<button
								type="button"
								role="menuitem"
								className="tb-menu-item"
								onClick={() => {
									setMenuOpen(false);
									if (instanceId) {
										navigate({ kind: "session", id: instanceId, panel: "usage" });
									}
								}}
							>
								Usage
							</button>
							<div className="tb-menu-sep" />
							<button
								type="button"
								role="menuitem"
								className="tb-menu-item"
								onClick={() => openConfirm("compact")}
							>
								Compact
							</button>
							<button
								type="button"
								role="menuitem"
								className="tb-menu-item"
								onClick={() => openConfirm("handoff")}
							>
								Handoff
							</button>
							<button
								type="button"
								role="menuitem"
								className="tb-menu-item tb-menu-item--destructive"
								onClick={() => openConfirm("clear")}
							>
								Clear context
							</button>
							<div className="tb-menu-sep" />
							<button
								type="button"
								role="menuitem"
								className="tb-menu-item"
								onClick={() => openConfirm("new_session")}
							>
								New session
							</button>
						</div>
					</>
				)}
			</div>

			{confirmModal && (
				<>
					<div className="tb-popover-backdrop" onClick={() => !actionPending && setConfirmModal(null)} />
					<div className="tb-confirm-dialog" role="dialog" aria-modal="true" aria-label={confirmModal.title}>
						<div className="tb-confirm-title">{confirmModal.title}</div>
						<div className="tb-confirm-desc">{confirmModal.description}</div>
						<div className="tb-confirm-actions">
							<button
								type="button"
								className="tb-confirm-btn tb-confirm-btn--cancel"
								disabled={actionPending}
								onClick={() => setConfirmModal(null)}
							>
								Cancel
							</button>
							<button
								type="button"
								className={`tb-confirm-btn ${confirmModal.isDestructive ? "tb-confirm-btn--destructive" : "tb-confirm-btn--primary"}`}
								disabled={actionPending}
								onClick={handleExecuteAction}
							>
								{actionPending ? "Processing..." : confirmModal.confirmLabel}
							</button>
						</div>
					</div>
				</>
			)}

			{renaming && (
				<>
					<div className="tb-popover-backdrop" onClick={() => setRenaming(false)} />
					<div className="tb-rename-dialog" role="dialog" aria-label="Rename session">
						<form
							onSubmit={async e => {
								e.preventDefault();
								const trimmed = editName.trim();
								if (trimmed && trimmed !== title) {
									await onRename?.(trimmed);
								}
								setRenaming(false);
							}}
						>
							<div className="tb-rename-title">Rename Session</div>
							<input
								type="text"
								className="tb-rename-input"
								value={editName}
								autoFocus
								onChange={e => setEditName(e.target.value)}
								placeholder="Session name"
							/>
							<div className="tb-rename-actions">
								<button
									type="button"
									className="tb-rename-btn tb-rename-btn--cancel"
									onClick={() => {
										setEditName(title);
										setRenaming(false);
									}}
								>
									Cancel
								</button>
								<button type="submit" className="tb-rename-btn tb-rename-btn--save" disabled={!editName.trim()}>
									Save
								</button>
							</div>
						</form>
					</div>
				</>
			)}
		</>
	);
}
