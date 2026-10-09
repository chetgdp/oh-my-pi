import { History, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LiveSessionEntry } from "../../server/live";
import type { PastSessionSummary } from "../../server/past";
import type { SessionListApi } from "../../lib/sessions-api";
import { groupPast } from "../../lib/session-groups";
import { notify } from "../../lib/notify";
import { browserWindow } from "../../lib/dom";
import { computeUnread, markSeen, sortByActivity } from "../../lib/unread";
import { LiveSessionRow, liveSessionName, PastSessionRow } from "./SessionRow";
import { NewSession } from "./NewSession";
import "./sessions.css";

export function SessionsScreen(props: {
	api: SessionListApi;
	variant: "page" | "sidebar";
	currentInstanceId: string | null;
	/** Live title of the attached session; the registry poll lags a rename. */
	currentSessionName?: string | null;
	onAttach(id: string): void;
	/** Sidebar only: the shell's collapse button, placed in this header to save a row. */
	collapseToggle?: ReactNode;
}): ReactNode {
	const { api, variant, currentInstanceId, currentSessionName, onAttach, collapseToggle } = props;
	const [polledLive, setLive] = useState<LiveSessionEntry[]>([]);
	const live = useMemo(
		() =>
			sortByActivity(
				currentSessionName
					? polledLive.map(s =>
							s.instanceId === currentInstanceId && s.sessionName !== currentSessionName
								? { ...s, sessionName: currentSessionName }
								: s,
						)
					: polledLive,
			),
		[polledLive, currentInstanceId, currentSessionName],
	);
	const [seenVersion, setSeenVersion] = useState(0);
	// seenVersion forces recompute after an explicit open changes stored counts.
	// biome-ignore lint/correctness/useExhaustiveDependencies: seenVersion is an intentional invalidation key
	const unread = useMemo(() => computeUnread(live, currentInstanceId), [live, currentInstanceId, seenVersion]);
	const handleAttachLive = useCallback(
		(instanceId: string) => {
			const opened = live.find(s => s.instanceId === instanceId);
			if (opened) markSeen(opened.sessionId, opened.assistantCount);
			setSeenVersion(v => v + 1);
			onAttach(instanceId);
		},
		[live, onAttach],
	);
	const [past, setPast] = useState<PastSessionSummary[] | null>(null);
	const [pastOpen, setPastOpen] = useState(false);
	const [pastError, setPastError] = useState<string | null>(null);
	const pastInflightRef = useRef(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showNew, setShowNew] = useState(false);
	const [resumingId, setResumingId] = useState<string | null>(null);
	const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
	const abortRef = useRef<AbortController | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchPast = useCallback(
		async (signal: AbortSignal) => {
			if (pastInflightRef.current) return;
			pastInflightRef.current = true;
			try {
				const p = await api.listPast({ all: true, signal });
				if (signal.aborted) return;
				setPast(p);
				setPastError(null);
			} catch (err: unknown) {
				if (signal.aborted) return;
				setPastError(err instanceof Error ? err.message : String(err));
			} finally {
				pastInflightRef.current = false;
			}
		},
		[api],
	);

	// The full past list is hundreds of KB; fetch it only for Resume or New session.
	const ensurePast = useCallback(() => {
		const ac = abortRef.current;
		if (past !== null || !ac || ac.signal.aborted) return;
		void fetchPast(ac.signal);
	}, [past, fetchPast]);

	const refreshPastIfLoaded = useCallback(() => {
		const ac = abortRef.current;
		if (past === null || !ac || ac.signal.aborted) return;
		void fetchPast(ac.signal);
	}, [past, fetchPast]);

	const loadLive = useCallback(
		async (signal: AbortSignal) => {
			try {
				const l = await api.listLive(signal);
				if (!signal.aborted) {
					setLive(l);
					setError(null);
				}
			} catch (err: unknown) {
				if (signal.aborted) return;
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
			} finally {
				if (!signal.aborted) setLoading(false);
			}
		},
		[api],
	);

	// Initial load + visibility change reload
	useEffect(() => {
		const ac = new AbortController();
		abortRef.current = ac;
		loadLive(ac.signal);

		const onVisChange = () => {
			const doc = (globalThis as Record<string, unknown>)["document"] as { visibilityState?: string } | undefined;
			if (doc?.visibilityState === "visible") {
				loadLive(ac.signal);
			}
		};
		browserWindow.addEventListener("visibilitychange", onVisChange);

		return () => {
			ac.abort();
			browserWindow.removeEventListener("visibilitychange", onVisChange);
		};
	}, [loadLive]);

	// Poll live every 10s while visible
	useEffect(() => {
		const ac = new AbortController();
		pollRef.current = setInterval(() => {
			const doc = (globalThis as Record<string, unknown>)["document"] as { visibilityState?: string } | undefined;
			if (doc && doc.visibilityState !== "visible") return;
			loadLive(ac.signal);
		}, 10_000);

		return () => {
			ac.abort();
			if (pollRef.current != null) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
		};
	}, [loadLive]);

	// Past titles come from session files, which change on rename too.
	const seenNameRef = useRef(currentSessionName);
	useEffect(() => {
		if (seenNameRef.current === currentSessionName) return;
		seenNameRef.current = currentSessionName;
		if (currentSessionName) refreshPastIfLoaded();
	}, [currentSessionName, refreshPastIfLoaded]);

	const handleShutdown = useCallback(
		async (instanceId: string) => {
			try {
				await api.shutdown(instanceId);
				const ac = abortRef.current;
				if (ac && !ac.signal.aborted) {
					await loadLive(ac.signal);
					refreshPastIfLoaded();
				}
			} catch (err: unknown) {
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[api, loadLive, refreshPastIfLoaded],
	);

	const handleResume = useCallback(
		async (id: string) => {
			setResumingId(id);
			const ac = new AbortController();

			try {
				const result = await api.resume(id, ac.signal);
				if (ac.signal.aborted) return;

				setResumingId(null);
				onAttach(result.instanceId);
			} catch (err: unknown) {
				if (ac.signal.aborted) return;
				setResumingId(null);
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[api, onAttach],
	);
	const handleDeletePast = useCallback(
		async (id: string) => {
			try {
				await api.deletePast(id);
				setPast(prev => prev?.filter(p => p.id !== id) ?? null);
				notify("info", "Session deleted");
			} catch (err: unknown) {
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[api],
	);

	const dayGroups = useMemo(() => groupPast(past ?? []), [past]);

	const recentCwds = useMemo(() => {
		const seen = new Set<string>();
		const result: string[] = [];
		for (const s of live) {
			if (!seen.has(s.cwd)) {
				seen.add(s.cwd);
				result.push(s.cwd);
			}
		}
		for (const s of past ?? []) {
			if (!seen.has(s.cwd)) {
				seen.add(s.cwd);
				result.push(s.cwd);
			}
		}
		return result;
	}, [live, past]);

	const toggleProject = useCallback((key: string) => {
		setCollapsedProjects(prev => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const containerClass = variant === "page" ? "ses-page" : "ses-sidebar";

	const resumeToggle = (
		<button
			type="button"
			className={`ses-new-btn ses-resume-btn${pastOpen ? " ses-new-btn--active" : ""}`}
			onClick={() => {
				if (!pastOpen) ensurePast();
				setPastOpen(!pastOpen);
			}}
			aria-label={pastOpen ? "Close past sessions" : "Resume session"}
			title={pastOpen ? "Close past sessions" : "Resume session"}
		>
			{pastOpen ? (
				<X size={20} strokeWidth={2.5} aria-hidden="true" />
			) : (
				<History size={20} strokeWidth={2.5} aria-hidden="true" />
			)}
		</button>
	);

	return (
		<div className={containerClass}>
			{variant === "sidebar" && (
				<nav className="ses-rail" aria-label="Live sessions">
					{live.map(entry => {
						const name = liveSessionName(entry);
						const current = entry.instanceId === currentInstanceId;
						const unreadCount = (entry.sessionId && unread.get(entry.sessionId)) || 0;
						return (
							<button
								key={entry.instanceId}
								type="button"
								className={`ses-rail-item${current ? " ses-rail-item--current" : ""}`}
								onClick={() => handleAttachLive(entry.instanceId)}
								title={name}
								aria-label={name}
								aria-current={current ? "page" : undefined}
							>
								{name.trim().charAt(0).toUpperCase() || "?"}
								<span className="ses-rail-dot" aria-hidden="true" />
								{unreadCount > 0 && <span className="ses-rail-unread" aria-hidden="true" />}
							</button>
						);
					})}
				</nav>
			)}
			{(variant === "page" || collapseToggle) && (
				<div className={variant === "page" ? "ses-page-header" : "ses-page-header ses-sidebar-head"}>
					{variant === "page" ? (
						<h2 className="ses-page-title">Sessions</h2>
					) : (
						<span className="ses-sidebar-title">ompgui</span>
					)}
					<div className="ses-header-actions">
						{resumeToggle}
						<button
							type="button"
							className={`ses-new-btn${showNew ? " ses-new-btn--active" : ""}`}
							onClick={() => {
								if (!showNew) ensurePast();
								setShowNew(!showNew);
							}}
							aria-label={showNew ? "Close new session" : "New session"}
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								{showNew ? (
									<>
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</>
								) : (
									<>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</>
								)}
							</svg>
						</button>
						{collapseToggle}
					</div>
				</div>
			)}

			{showNew && <NewSession api={api} recentCwds={recentCwds} onAttach={onAttach} />}

			{loading && (
				<p className="ses-loading">
					<span className="ses-spin" aria-hidden="true" />
					Loading sessions…
				</p>
			)}

			{!loading && error && (
				<div className="ses-unreachable">
					<p className="ses-unreachable-title">Server unreachable</p>
					<p className="ses-unreachable-reason">{error}</p>
					<button
						type="button"
						className="ses-retry-btn"
						onClick={() => {
							setLoading(true);
							if (abortRef.current) abortRef.current.abort();
							const ac = new AbortController();
							abortRef.current = ac;
							loadLive(ac.signal);
						}}
					>
						Retry
					</button>
				</div>
			)}

			{!loading && !error && (
				<>
					<div className="ses-section-label ses-section-label--live">
						<span className="ses-busy-dot" />
						Live{live.length > 0 ? ` · ${live.length}` : ""}
					</div>
					{live.length === 0 && <p className="ses-empty">No live sessions</p>}
					<div className="ses-live-grid">
						{live.map(entry => (
							<LiveSessionRow
								key={entry.instanceId}
								entry={entry}
								current={entry.instanceId === currentInstanceId}
								unread={(entry.sessionId && unread.get(entry.sessionId)) || 0}
								onAttach={handleAttachLive}
								onShutdown={handleShutdown}
							/>
						))}
					</div>

					{pastOpen && (
						<>
							<div className="ses-section-label">Past</div>
							{past === null && !pastError && (
								<p className="ses-loading">
									<span className="ses-spin" aria-hidden="true" />
									Loading past sessions…
								</p>
							)}
							{past === null && pastError && (
								<div className="ses-unreachable">
									<p className="ses-unreachable-reason">{pastError}</p>
									<button type="button" className="ses-retry-btn" onClick={ensurePast}>
										Retry
									</button>
								</div>
							)}
							{past !== null && dayGroups.length === 0 && <p className="ses-empty">No past sessions</p>}
							{dayGroups.map(dg => (
								<div key={dg.dayLabel}>
									<div className="ses-day-label">{dg.dayLabel}</div>
									{dg.projects.map(pg => {
										const projectKey = `${dg.dayLabel}:${pg.cwd ?? ""}`;
										const collapsed = collapsedProjects.has(projectKey);
										return (
											<div key={projectKey} className="ses-project-group">
												{dg.projects.length > 1 && (
													<button
														type="button"
														className="ses-project-toggle"
														onClick={() => toggleProject(projectKey)}
													>
														<svg
															className={`ses-project-chevron${collapsed ? "" : " ses-project-chevron--open"}`}
															viewBox="0 0 12 12"
															fill="currentColor"
														>
															<path d="M4 2l4 4-4 4z" />
														</svg>
														{pg.label}
													</button>
												)}
												{!collapsed &&
													pg.sessions.map(entry => (
														<PastSessionRow
															key={entry.id}
															entry={entry}
															pending={resumingId === entry.id}
															onResume={handleResume}
															onDelete={handleDeletePast}
														/>
													))}
											</div>
										);
									})}
								</div>
							))}
						</>
					)}
				</>
			)}
		</div>
	);
}
