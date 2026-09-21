import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LiveSessionEntry } from "../../server/live";
import type { PastSessionSummary } from "../../server/past";
import type { SessionListApi } from "../../lib/sessions-api";
import { groupPast } from "../../lib/session-groups";
import { notify } from "../../lib/notify";
import { browserWindow } from "../../lib/dom";
import { LiveSessionRow, PastSessionRow } from "./SessionRow";
import { NewSession } from "./NewSession";
import "./sessions.css";

export function SessionsScreen(props: {
	api: SessionListApi;
	variant: "page" | "sidebar";
	currentInstanceId: string | null;
	onAttach(id: string): void;
}): ReactNode {
	const { api, variant, currentInstanceId, onAttach } = props;
	const [live, setLive] = useState<LiveSessionEntry[]>([]);
	const [past, setPast] = useState<PastSessionSummary[]>([]);
	const [loading, setLoading] = useState(true);
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
			} catch (err: unknown) {
				if (signal.aborted) return;
				notify("error", err instanceof Error ? err.message : String(err));
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
				if (!signal.aborted) setLive(l);
			} catch (err: unknown) {
				if (signal.aborted) return;
				notify("error", err instanceof Error ? err.message : String(err));
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
			{variant === "page" && (
				<div className="ses-page-header">
					<h2 className="ses-page-title">Sessions</h2>
					<button type="button" className="ses-new-btn" onClick={() => setShowNew(!showNew)}>
						{showNew ? "Cancel" : "New"}
					</button>
				</div>
			)}

			{showNew && variant === "page" && <NewSession api={api} recentCwds={recentCwds} onAttach={onAttach} />}

			{loading && <p className="ses-loading">Loading...</p>}

			{!loading && (
				<>
					<div className="ses-section-label">Live</div>
					{live.length === 0 && <p className="ses-empty">No live sessions</p>}
					{live.map(entry => (
						<LiveSessionRow
							key={entry.instanceId}
							entry={entry}
							current={entry.instanceId === currentInstanceId}
							onAttach={onAttach}
							onShutdown={handleShutdown}
						/>
					))}

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
