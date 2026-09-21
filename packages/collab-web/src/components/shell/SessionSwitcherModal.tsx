import { Check, Clock, Folder, MessageSquare, Pencil, Plus, RotateCw, Search, Trash2, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent, ReactNode, TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { relTime, shortenPath } from "../../lib/format";
import type { RpcWebClient } from "../../lib/rpc-web-client";
import type { SessionListItem, SessionPreviewData, WorkspaceItem } from "../../server/protocol";

export interface SessionSwitcherModalProps {
	isOpen: boolean;
	onClose(): void;
	rpcClient?: RpcWebClient;
	currentSessionFile?: string;
	currentCwd?: string;
}

export function SessionSwitcherModal({
	isOpen,
	onClose,
	rpcClient,
	currentSessionFile,
	currentCwd,
}: SessionSwitcherModalProps): ReactNode {
	const [sessions, setSessions] = useState<SessionListItem[]>([]);
	const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
	const [selectedSession, setSelectedSession] = useState<SessionListItem | null>(null);
	const [preview, setPreview] = useState<SessionPreviewData | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadingPreview, setLoadingPreview] = useState(false);
	const [switching, setSwitching] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<"project" | "all">("project");
	const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");

	const searchInputRef = useRef<HTMLInputElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const touchStartY = useRef(0);
	const touchDelta = useRef(0);

	const loadData = useCallback(async () => {
		if (!rpcClient) return;
		setLoading(true);
		setError(null);
		try {
			const isAll = viewMode === "all" && !selectedWorkspace;
			const targetCwd = selectedWorkspace || (viewMode === "project" ? currentCwd : undefined);
			const [sessResp, wsResp] = await Promise.all([
				rpcClient.listSessions({ cwd: targetCwd, all: isAll }),
				rpcClient.listWorkspaces().catch(() => ({ currentCwd: "", workspaces: [] })),
			]);
			setSessions(sessResp.sessions);
			setWorkspaces(wsResp.workspaces);

			// Auto-select current session or first session
			const active = sessResp.sessions.find(s => s.path === currentSessionFile);
			const initial = active ?? sessResp.sessions[0] ?? null;
			setSelectedSession(initial);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [rpcClient, viewMode, selectedWorkspace, currentCwd, currentSessionFile]);

	useEffect(() => {
		if (isOpen) {
			loadData();
			setTimeout(() => searchInputRef.current?.focus(), 50);
		} else {
			setSearchQuery("");
			setError(null);
		}
	}, [isOpen, loadData]);

	// Focus trap: cycle Tab/Shift+Tab within the dialog; return focus on close.
	useEffect(() => {
		if (!isOpen) return;
		const previouslyFocused = document.activeElement as HTMLElement | null;
		const dialog = dialogRef.current;
		if (!dialog) return;

		const handleTrap = (e: globalThis.KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const focusable = dialog.querySelectorAll<HTMLElement>(
				'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
			);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};

		dialog.addEventListener("keydown", handleTrap);
		return () => {
			dialog.removeEventListener("keydown", handleTrap);
			previouslyFocused?.focus();
		};
	}, [isOpen]);

	// Load preview when selected session changes
	useEffect(() => {
		if (!rpcClient || !selectedSession) {
			setPreview(null);
			return;
		}
		let cancelled = false;
		setLoadingPreview(true);
		rpcClient
			.previewSession(selectedSession.path)
			.then(data => {
				if (!cancelled) setPreview(data);
			})
			.catch(() => {
				if (!cancelled) setPreview(null);
			})
			.finally(() => {
				if (!cancelled) setLoadingPreview(false);
			});

		return () => {
			cancelled = true;
		};
	}, [rpcClient, selectedSession]);

	const filteredSessions = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return sessions;
		return sessions.filter(s => {
			const title = (s.title ?? "").toLowerCase();
			const first = (s.firstMessage ?? "").toLowerCase();
			const cwd = (s.cwd ?? "").toLowerCase();
			const id = s.id.toLowerCase();
			return title.includes(q) || first.includes(q) || cwd.includes(q) || id.includes(q);
		});
	}, [sessions, searchQuery]);

	const handleSwitch = useCallback(
		async (sessionPath: string) => {
			if (!rpcClient || switching) return;
			setSwitching(true);
			try {
				rpcClient.switchSession(sessionPath);
				onClose();
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setSwitching(false);
			}
		},
		[rpcClient, switching, onClose],
	);

	const handleNewSession = useCallback(() => {
		if (!rpcClient) return;
		rpcClient.newSession();
		onClose();
	}, [rpcClient, onClose]);

	const handleRenameStart = useCallback((session: SessionListItem) => {
		setEditingId(session.path);
		setEditTitle(session.title || session.firstMessage || `Session ${session.id.slice(0, 8)}`);
	}, []);

	const handleRenameCommit = useCallback(
		async (sessionPath: string) => {
			const trimmed = editTitle.trim();
			setEditingId(null);
			if (!trimmed || !rpcClient) return;
			try {
				await rpcClient.renameSession(sessionPath, trimmed);
				await loadData();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
			}
		},
		[rpcClient, editTitle, loadData],
	);

	const handleRenameCancel = useCallback(() => {
		setEditingId(null);
	}, []);

	const handleDelete = useCallback(
		async (session: SessionListItem) => {
			if (!rpcClient) return;
			const label = session.title || session.id.slice(0, 8);
			if (!window.confirm(`Delete session "${label}"? This cannot be undone.`)) return;
			try {
				await rpcClient.deleteSession(session.path);
				if (selectedSession?.path === session.path) {
					setSelectedSession(null);
					setPreview(null);
				}
				await loadData();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
			}
		},
		[rpcClient, selectedSession, loadData],
	);

	// Keyboard navigation in session list
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			onClose();
			return;
		}
		if (filteredSessions.length === 0) return;

		const currentIndex = selectedSession ? filteredSessions.findIndex(s => s.path === selectedSession.path) : -1;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			const nextIndex = Math.min(filteredSessions.length - 1, currentIndex + 1);
			setSelectedSession(filteredSessions[nextIndex] ?? null);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const prevIndex = Math.max(0, currentIndex - 1);
			setSelectedSession(filteredSessions[prevIndex] ?? null);
		} else if (e.key === "Enter" && selectedSession) {
			e.preventDefault();
			handleSwitch(selectedSession.path);
		}
	};

	if (!isOpen) return null;

	const handleTouchStart = (e: ReactTouchEvent) => {
		touchStartY.current = e.touches[0].clientY;
		touchDelta.current = 0;
	};
	const handleTouchMove = (e: ReactTouchEvent) => {
		const delta = e.touches[0].clientY - touchStartY.current;
		if (delta > 0) {
			touchDelta.current = delta;
			dialogRef.current?.style.setProperty("transform", `translateY(${delta}px)`);
		}
	};
	const handleTouchEnd = () => {
		if (touchDelta.current > 100) {
			onClose();
		}
		dialogRef.current?.style.removeProperty("transform");
		touchDelta.current = 0;
	};

	return (
		<div className="ss-backdrop" onClick={onClose}>
			<div
				ref={dialogRef}
				className="ss-dialog"
				onClick={e => e.stopPropagation()}
				onKeyDown={handleKeyDown}
				role="dialog"
				aria-modal="true"
				aria-label="Session Switcher"
			>
				<div
					className="ss-drag-handle"
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				/>
				<header className="ss-header">
					<div className="ss-header-title">
						<Folder size={18} className="ss-folder-icon" />
						<h2>Sessions &amp; Workspaces</h2>
					</div>
					<div className="ss-header-actions">
						<button
							type="button"
							className="ss-btn ss-btn-primary"
							onClick={handleNewSession}
							title="Start a fresh session in current directory"
						>
							<Plus size={14} />
							<span>New Session</span>
						</button>
						<button type="button" className="ss-btn ss-btn-icon" onClick={onClose} title="Close (Esc)">
							<X size={16} />
						</button>
					</div>
				</header>

				<div className="ss-controls">
					<div className="ss-search-wrap">
						<Search size={14} className="ss-search-icon" />
						<input
							ref={searchInputRef}
							type="text"
							className="ss-search-input"
							placeholder="Search sessions by title, prompt, or cwd..."
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
						/>
						{searchQuery && (
							<button type="button" className="ss-search-clear" onClick={() => setSearchQuery("")}>
								<X size={12} />
							</button>
						)}
					</div>

					<div className="ss-tabs">
						<button
							type="button"
							className={`ss-tab ${viewMode === "project" ? "ss-tab-active" : ""}`}
							onClick={() => {
								setViewMode("project");
								setSelectedWorkspace("");
							}}
						>
							Current Project
						</button>
						<button
							type="button"
							className={`ss-tab ${viewMode === "all" ? "ss-tab-active" : ""}`}
							onClick={() => setViewMode("all")}
						>
							All Projects
						</button>
					</div>

					{viewMode === "all" && workspaces.length > 0 && (
						<div className="ss-workspace-select-wrap">
							<select
								className="ss-workspace-select"
								value={selectedWorkspace}
								onChange={e => setSelectedWorkspace(e.target.value)}
								title="Filter by workspace"
							>
								<option value="">All Workspaces ({workspaces.length})</option>
								{workspaces.map(ws => (
									<option key={ws.cwd} value={ws.cwd}>
										{ws.name} ({ws.sessionCount}) — {shortenPath(ws.cwd)}
									</option>
								))}
							</select>
						</div>
					)}

					<button
						type="button"
						className="ss-btn ss-btn-icon ss-refresh-btn"
						onClick={loadData}
						title="Refresh session list"
					>
						<RotateCw size={13} className={loading ? "ss-spin" : ""} />
					</button>
				</div>

				{error && <div className="ss-error-banner">{error}</div>}

				<div className="ss-body">
					{/* Left: Session List */}
					<div className="ss-list-pane">
						{loading && sessions.length === 0 ? (
							<div className="ss-empty">Loading sessions...</div>
						) : filteredSessions.length === 0 ? (
							<div className="ss-empty">{searchQuery ? "No matching sessions" : "No sessions found"}</div>
						) : (
							<ul className="ss-list">
								{filteredSessions.map(session => {
									const isCurrent = session.path === currentSessionFile;
									const isSelected = selectedSession?.path === session.path;
									const modTs = new Date(session.modified).getTime();

									return (
										<li
											key={session.path}
											className={`ss-item ${isSelected ? "ss-item-selected" : ""} ${isCurrent ? "ss-item-current" : ""}`}
											onClick={() => setSelectedSession(session)}
											onDoubleClick={() => {
												if (editingId !== session.path) handleSwitch(session.path);
											}}
										>
											<div className="ss-item-main">
												<div className="ss-item-title-row">
													{isCurrent && (
														<span className="ss-active-badge" title="Active session">
															<Check size={11} />
														</span>
													)}
													{editingId === session.path ? (
														<input
															type="text"
															className="ss-rename-input"
															value={editTitle}
															onChange={(e: ChangeEvent<HTMLInputElement>) =>
																setEditTitle(e.target.value)
															}
															onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
																e.stopPropagation();
																if (e.key === "Enter") void handleRenameCommit(session.path);
																if (e.key === "Escape") handleRenameCancel();
															}}
															onBlur={() => void handleRenameCommit(session.path)}
															autoFocus
														/>
													) : (
														<span
															className="ss-item-title"
															title={session.title || session.firstMessage || session.id}
															onDoubleClick={e => {
																e.stopPropagation();
																handleRenameStart(session);
															}}
														>
															{session.title ||
																session.firstMessage ||
																`Session ${session.id.slice(0, 8)}`}
														</span>
													)}
													{!isCurrent && editingId !== session.path && (
														<div className="ss-item-actions">
															<button
																type="button"
																className="ss-btn ss-btn-icon ss-action-btn"
																title="Rename session"
																onClick={e => {
																	e.stopPropagation();
																	handleRenameStart(session);
																}}
															>
																<Pencil size={12} />
															</button>
															<button
																type="button"
																className="ss-btn ss-btn-icon ss-action-btn ss-action-delete"
																title="Delete session"
																onClick={e => {
																	e.stopPropagation();
																	void handleDelete(session);
																}}
															>
																<Trash2 size={12} />
															</button>
														</div>
													)}
												</div>
												{session.firstMessage && session.title && (
													<p className="ss-item-snippet">{session.firstMessage}</p>
												)}
												<div className="ss-item-meta">
													<span className="ss-meta-item">
														<Clock size={11} />
														<span>{relTime(modTs)}</span>
													</span>
													<span className="ss-meta-item">
														<MessageSquare size={11} />
														<span>{session.messageCount}</span>
													</span>
													{session.status && session.status !== "unknown" && (
														<span className={`ss-status ss-status-${session.status}`}>
															{session.status}
														</span>
													)}
													{viewMode === "all" && session.cwd && (
														<span className="ss-cwd-tag" title={session.cwd}>
															{shortenPath(session.cwd)}
														</span>
													)}
												</div>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>

					{/* Right: Session Details & Preview */}
					<div className="ss-preview-pane">
						{selectedSession ? (
							<div className="ss-preview-content">
								<div className="ss-preview-header">
									<div className="ss-preview-title-area">
										<h3 className="ss-preview-title" title={selectedSession.title || selectedSession.id}>
											{selectedSession.title || `Session ${selectedSession.id.slice(0, 8)}`}
										</h3>
										<span className="ss-preview-id">ID: {selectedSession.id}</span>
									</div>
									<div className="ss-preview-actions">
										<button
											type="button"
											className="ss-btn ss-btn-primary"
											disabled={selectedSession.path === currentSessionFile || switching}
											onClick={() => handleSwitch(selectedSession.path)}
										>
											{selectedSession.path === currentSessionFile
												? "Current Session"
												: switching
													? "Switching..."
													: "Switch to Session"}
										</button>
									</div>
								</div>

								<div className="ss-preview-info-grid">
									<div className="ss-info-item">
										<span className="ss-info-label">Workspace</span>
										<span className="ss-info-val" title={selectedSession.cwd}>
											{shortenPath(selectedSession.cwd)}
										</span>
									</div>
									<div className="ss-info-item">
										<span className="ss-info-label">Modified</span>
										<span className="ss-info-val">{new Date(selectedSession.modified).toLocaleString()}</span>
									</div>
									<div className="ss-info-item">
										<span className="ss-info-label">Messages</span>
										<span className="ss-info-val">{selectedSession.messageCount}</span>
									</div>
									<div className="ss-info-item">
										<span className="ss-info-label">Status</span>
										<span className="ss-info-val">{selectedSession.status ?? "unknown"}</span>
									</div>
								</div>

								{preview?.branches && preview.branches.length > 0 && (
									<div className="ss-branches-section">
										<h4 className="ss-section-title">Branches</h4>
										<div className="ss-branches-list">
											{preview.branches.map(b => (
												<div key={b.id} className="ss-branch-chip">
													<span>{b.label ?? `Branch ${b.id.slice(0, 8)}`}</span>
												</div>
											))}
										</div>
									</div>
								)}

								<div className="ss-turns-section">
									<h4 className="ss-section-title">Transcript Preview</h4>
									{loadingPreview ? (
										<div className="ss-preview-loading">Loading transcript preview...</div>
									) : preview?.messages && preview.messages.length > 0 ? (
										<div className="ss-turns-list">
											{preview.messages.map((turn, i) => (
												<div
													key={turn.id || `${turn.role}-${i}`}
													className={`ss-turn ss-turn-${turn.role}`}
												>
													<div className="ss-turn-header">
														<span className="ss-turn-role">
															{turn.role === "user" ? "User" : "Assistant"}
														</span>
														{turn.timestamp && (
															<span className="ss-turn-time">
																{relTime(new Date(turn.timestamp).getTime())}
															</span>
														)}
													</div>
													<div className="ss-turn-body">{turn.text || "(empty message)"}</div>
												</div>
											))}
										</div>
									) : (
										<div className="ss-preview-loading">
											{selectedSession.firstMessage
												? `First prompt: "${selectedSession.firstMessage}"`
												: "No message transcript available."}
										</div>
									)}
								</div>
							</div>
						) : (
							<div className="ss-empty">Select a session to view its preview and branch turns</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
