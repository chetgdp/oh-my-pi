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
}): ReactNode {
	const { api, variant, currentInstanceId, currentSessionName, onAttach } = props;
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
	const [past, setPast] = useState<PastSessionSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showNew, setShowNew] = useState(false);
	const [resumingId, setResumingId] = useState<string | null>(null);
	const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
	const abortRef = useRef<AbortController | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const loadAll = useCallback(
		async (signal: AbortSignal) => {
			try {
				const [l, p] = await Promise.all([api.listLive(signal), api.listPast({ all: true, signal })]);
				if (signal.aborted) return;
				setLive(l);
				setPast(p);
				setError(null);
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
			}
		},
		[api],
	);

	// Initial load + visibility change reload
	useEffect(() => {
		const ac = new AbortController();
		abortRef.current = ac;
		loadAll(ac.signal);

		const onVisChange = () => {
			const doc = (globalThis as Record<string, unknown>)["document"] as { visibilityState?: string } | undefined;
			if (doc?.visibilityState === "visible") {
				loadAll(ac.signal);
			}
		};
		browserWindow.addEventListener("visibilitychange", onVisChange);

		return () => {
			ac.abort();
			browserWindow.removeEventListener("visibilitychange", onVisChange);
		};
	}, [loadAll]);

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
		const ac = abortRef.current;
		if (currentSessionName && ac && !ac.signal.aborted) loadAll(ac.signal);
	}, [currentSessionName, loadAll]);

	const handleShutdown = useCallback(
		async (instanceId: string) => {
			try {
				await api.shutdown(instanceId);
				const ac = abortRef.current;
				if (ac && !ac.signal.aborted) {
					await loadAll(ac.signal);
				}
			} catch (err: unknown) {
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[api, loadAll],
	);

	const handleResume = useCallback(
		async (id: string) => {
			setResumingId(id);
			const ac = new AbortController();

			try {
				const result = await api.resume(id, ac.signal);
				if (ac.signal.aborted) return;

				if (result.instanceId) {
					setResumingId(null);
					onAttach(result.instanceId);
					return;
				}

				const entry = past.find(s => s.id === id);
				const cwdMatch = entry?.cwd;
				const startTime = Date.now();
				while (Date.now() - startTime < 20_000) {
					if (ac.signal.aborted) return;
					await new Promise<void>((resolve, reject) => {
						const timer = setTimeout(resolve, 2000);
						ac.signal.addEventListener(
							"abort",
							() => {
								clearTimeout(timer);
								reject(new DOMException("Aborted", "AbortError"));
							},
							{ once: true },
						);
					});
					if (ac.signal.aborted) return;
					const sessions = await api.listLive(ac.signal);
					const match = sessions.find(s => cwdMatch != null && s.cwd === cwdMatch && s.startedAt > startTime);
					if (match) {
						setResumingId(null);
						onAttach(match.instanceId);
						return;
					}
				}
				setResumingId(null);
				notify("error", "Resumed session did not appear within 20 seconds");
			} catch (err: unknown) {
				if (ac.signal.aborted) return;
				setResumingId(null);
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[api, past, onAttach],
	);
	const handleDeletePast = useCallback(
		async (id: string) => {
			try {
				await api.deletePast(id);
				setPast(prev => prev.filter(p => p.id !== id));
				notify("info", "Session deleted");
			} catch (err: unknown) {
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[api],
	);

	const dayGroups = useMemo(() => groupPast(past), [past]);

	const recentCwds = useMemo(() => {
		const seen = new Set<string>();
		const result: string[] = [];
		for (const s of live) {
			if (!seen.has(s.cwd)) {
				seen.add(s.cwd);
				result.push(s.cwd);
			}
		}
		for (const s of past) {
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
			{variant === "page" && (
				<div className="ses-page-header">
					<h2 className="ses-page-title">Sessions</h2>
					<button
						type="button"
						className={`ses-new-btn${showNew ? " ses-new-btn--active" : ""}`}
						onClick={() => setShowNew(!showNew)}
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
				</div>
			)}

			{showNew && variant === "page" && <NewSession api={api} recentCwds={recentCwds} onAttach={onAttach} />}

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
							loadAll(ac.signal);
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

					<div className="ses-section-label">Past</div>
					{dayGroups.length === 0 && <p className="ses-empty">No past sessions</p>}
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

			{variant === "sidebar" && <NewSession api={api} recentCwds={recentCwds} onAttach={onAttach} />}
		</div>
	);
}
