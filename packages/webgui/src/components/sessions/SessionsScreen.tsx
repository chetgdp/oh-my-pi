import { History, Server, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { PastSessionSummary } from "../../server/past";
import { groupPast, recentCwds } from "../../lib/session-groups";
import { notify } from "../../lib/notify";
import { browserWindow } from "../../lib/dom";
import { computeUnread, markSeen } from "../../lib/unread";
import { LOCAL_SERVER_ID, mergeLive, sessionKey } from "../../lib/servers";
import type { KeyedLiveEntry, ServerLiveState, ServerOperator, ServerStatus } from "../../lib/servers";
import { LiveSessionRow, liveSessionName, PastSessionRow } from "./SessionRow";
import { NewSession } from "./NewSession";
import { ServerPicker, ServersManager } from "./ServersManager";
import "./sessions.css";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function railGlyph(name: string): string {
	const first = graphemes.segment(name.trim())[Symbol.iterator]().next().value;
	return first ? first.segment.toUpperCase() : "?";
}

function pageVisible(): boolean {
	const doc = (globalThis as Record<string, unknown>)["document"] as { visibilityState?: string } | undefined;
	return !doc || doc.visibilityState === "visible";
}

export function SessionsScreen(props: {
	servers: ServerOperator;
	variant: "page" | "sidebar";
	/** Session key (`sessionKey`) of the attached session. */
	currentInstanceId: string | null;
	/** Live title of the attached session; the registry poll lags a rename. */
	currentSessionName?: string | null;
	/** Receives a session key. */
	onAttach(key: string): void;
	/** Runs after a stop succeeds, before the list reloads; receives a session key. */
	onShutdown?(key: string): void;
	/** Sidebar only: the shell's collapse button, placed in this header to save a row. */
	collapseToggle?: ReactNode;
}): ReactNode {
	const { servers, variant, currentInstanceId, currentSessionName, onAttach, onShutdown, collapseToggle } = props;
	const serverList = useSyncExternalStore(servers.subscribe, servers.list);
	const multi = serverList.length > 1;
	const [states, setStates] = useState<ServerLiveState[]>([]);
	const live = useMemo(() => {
		const merged = mergeLive(states).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
		if (!currentSessionName) return merged;
		return merged.map(s =>
			s.key === currentInstanceId && s.sessionName !== currentSessionName
				? { ...s, sessionName: currentSessionName }
				: s,
		);
	}, [states, currentInstanceId, currentSessionName]);
	const statusById = useMemo(() => new Map<string, ServerStatus>(states.map(s => [s.server.id, s.status])), [states]);
	const [seenVersion, setSeenVersion] = useState(0);
	// seenVersion forces recompute after an explicit open changes stored counts.
	// biome-ignore lint/correctness/useExhaustiveDependencies: seenVersion is an intentional invalidation key
	const unread = useMemo(
		() =>
			computeUnread(
				live.map(e => ({ ...e, instanceId: e.key })),
				currentInstanceId,
			),
		[live, currentInstanceId, seenVersion],
	);
	const handleAttachLive = useCallback(
		(key: string) => {
			const opened = live.find(s => s.key === key);
			if (opened) markSeen(opened.sessionId, opened.assistantCount);
			setSeenVersion(v => v + 1);
			onAttach(key);
		},
		[live, onAttach],
	);
	const [pastServerId, setPastServerId] = useState(LOCAL_SERVER_ID);
	const [launchServerId, setLaunchServerId] = useState(LOCAL_SERVER_ID);
	const [past, setPast] = useState<{ serverId: string; list: PastSessionSummary[] } | null>(null);
	const [pastOpen, setPastOpen] = useState(false);
	const [pastError, setPastError] = useState<string | null>(null);
	const pastInflightRef = useRef<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [showNew, setShowNew] = useState(false);
	const [showServers, setShowServers] = useState(false);
	const [resumingId, setResumingId] = useState<string | null>(null);
	const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
	const abortRef = useRef<AbortController | null>(null);

	// A removed server falls back to `local` for launch and resume.
	const effectivePastId = serverList.some(s => s.id === pastServerId) ? pastServerId : LOCAL_SERVER_ID;
	const effectiveLaunchId = serverList.some(s => s.id === launchServerId) ? launchServerId : LOCAL_SERVER_ID;
	const pastList = past?.serverId === effectivePastId ? past.list : null;

	const fetchPast = useCallback(
		async (serverId: string, signal: AbortSignal) => {
			if (pastInflightRef.current === serverId) return;
			pastInflightRef.current = serverId;
			try {
				const p = await servers.apiFor(serverId).listPast({ all: true, signal });
				if (signal.aborted) return;
				setPast({ serverId, list: p });
				setPastError(null);
			} catch (err: unknown) {
				if (signal.aborted) return;
				setPastError(err instanceof Error ? err.message : String(err));
			} finally {
				if (pastInflightRef.current === serverId) pastInflightRef.current = null;
			}
		},
		[servers],
	);

	// The full past list is hundreds of KB; fetch it only for Resume or New session.
	const ensurePast = useCallback(
		(serverId: string) => {
			const ac = abortRef.current;
			if (past?.serverId === serverId || !ac || ac.signal.aborted) return;
			setPastError(null);
			void fetchPast(serverId, ac.signal);
		},
		[past, fetchPast],
	);

	const refreshPastIfLoaded = useCallback(() => {
		const ac = abortRef.current;
		if (past === null || !ac || ac.signal.aborted) return;
		void fetchPast(past.serverId, ac.signal);
	}, [past, fetchPast]);

	const loadLive = useCallback(
		async (signal: AbortSignal) => {
			const next = await servers.poll(signal);
			if (signal.aborted) return;
			setStates(next);
			setLoading(false);
		},
		[servers],
	);

	// Initial load, reload on server list change and visibility, poll every 10s while visible.
	// biome-ignore lint/correctness/useExhaustiveDependencies: serverList is an intentional reload key
	useEffect(() => {
		const ac = new AbortController();
		abortRef.current = ac;
		void loadLive(ac.signal);

		const onVisChange = () => {
			if (pageVisible()) void loadLive(ac.signal);
		};
		browserWindow.addEventListener("visibilitychange", onVisChange);
		const poll = setInterval(() => {
			if (pageVisible()) void loadLive(ac.signal);
		}, 10_000);

		return () => {
			ac.abort();
			clearInterval(poll);
			browserWindow.removeEventListener("visibilitychange", onVisChange);
		};
	}, [loadLive, serverList]);

	// Past titles come from session files, which change on rename too.
	const seenNameRef = useRef(currentSessionName);
	useEffect(() => {
		if (seenNameRef.current === currentSessionName) return;
		seenNameRef.current = currentSessionName;
		if (currentSessionName) refreshPastIfLoaded();
	}, [currentSessionName, refreshPastIfLoaded]);

	const handleShutdown = useCallback(
		async (serverId: string, instanceId: string) => {
			try {
				await servers.apiFor(serverId).shutdown(instanceId);
				onShutdown?.(sessionKey({ serverId, instanceId }));
				const ac = abortRef.current;
				if (ac && !ac.signal.aborted) {
					await loadLive(ac.signal);
					refreshPastIfLoaded();
				}
			} catch (err: unknown) {
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[servers, loadLive, refreshPastIfLoaded, onShutdown],
	);

	const handleResume = useCallback(
		async (serverId: string, id: string) => {
			setResumingId(id);
			try {
				const result = await servers.apiFor(serverId).resume(id);
				setResumingId(null);
				onAttach(sessionKey({ serverId, instanceId: result.instanceId }));
			} catch (err: unknown) {
				setResumingId(null);
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[servers, onAttach],
	);
	const handleDeletePast = useCallback(
		async (serverId: string, id: string) => {
			try {
				await servers.apiFor(serverId).deletePast(id);
				setPast(prev =>
					prev?.serverId === serverId ? { serverId, list: prev.list.filter(p => p.id !== id) } : prev,
				);
				notify("info", "Session deleted");
			} catch (err: unknown) {
				notify("error", err instanceof Error ? err.message : String(err));
			}
		},
		[servers],
	);

	const dayGroups = useMemo(() => groupPast(pastList ?? []), [pastList]);

	const recent = useMemo(
		() =>
			recentCwds(
				live.filter(e => e.serverId === effectiveLaunchId),
				past?.serverId === effectiveLaunchId ? past.list : [],
				10,
			),
		[live, past, effectiveLaunchId],
	);

	const toggleProject = useCallback((key: string) => {
		setCollapsedProjects(prev => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const retry = useCallback(() => {
		setLoading(true);
		abortRef.current?.abort();
		const ac = new AbortController();
		abortRef.current = ac;
		void loadLive(ac.signal);
	}, [loadLive]);

	const containerClass = variant === "page" ? "ses-page" : "ses-sidebar";
	const singleDown = !multi && states[0]?.status === "down" ? states[0] : null;

	const resumeToggle = (
		<button
			type="button"
			className={`ses-new-btn ses-resume-btn${pastOpen ? " ses-new-btn--active" : ""}`}
			onClick={() => {
				if (!pastOpen) ensurePast(effectivePastId);
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

	const serversToggle = (
		<button
			type="button"
			className={`ses-new-btn${showServers ? " ses-new-btn--active" : ""}`}
			onClick={() => setShowServers(!showServers)}
			aria-label={showServers ? "Close servers" : "Manage servers"}
			title={showServers ? "Close servers" : "Manage servers"}
		>
			<Server size={20} strokeWidth={2.5} aria-hidden="true" />
		</button>
	);

	const renderLiveRows = (entries: readonly KeyedLiveEntry[]) => (
		<div className="ses-live-grid">
			{entries.map(entry => (
				<LiveSessionRow
					key={entry.key}
					entry={entry}
					current={entry.key === currentInstanceId}
					unread={(entry.sessionId && unread.get(entry.sessionId)) || 0}
					onAttach={() => handleAttachLive(entry.key)}
					onShutdown={() => handleShutdown(entry.serverId, entry.instanceId)}
				/>
			))}
		</div>
	);

	return (
		<div className={containerClass}>
			{variant === "sidebar" && (
				<nav className="ses-rail" aria-label="Live sessions">
					{live.map(entry => {
						const name = liveSessionName(entry);
						const current = entry.key === currentInstanceId;
						const unreadCount = (entry.sessionId && unread.get(entry.sessionId)) || 0;
						return (
							<button
								key={entry.key}
								type="button"
								className={`ses-rail-item${current ? " ses-rail-item--current" : ""}`}
								onClick={() => handleAttachLive(entry.key)}
								title={name}
								aria-label={name}
								aria-current={current ? "page" : undefined}
							>
								{railGlyph(name)}
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
						{serversToggle}
						{resumeToggle}
						<button
							type="button"
							className={`ses-new-btn${showNew ? " ses-new-btn--active" : ""}`}
							onClick={() => {
								if (!showNew) ensurePast(effectiveLaunchId);
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

			{showServers && <ServersManager servers={servers} list={serverList} status={statusById} />}

			{showNew && (
				<>
					{multi && (
						<ServerPicker
							label="Launch on"
							list={serverList}
							value={effectiveLaunchId}
							onChange={id => {
								setLaunchServerId(id);
								ensurePast(id);
							}}
						/>
					)}
					<NewSession
						key={effectiveLaunchId}
						api={servers.apiFor(effectiveLaunchId)}
						recentCwds={recent}
						onAttach={instanceId => onAttach(sessionKey({ serverId: effectiveLaunchId, instanceId }))}
					/>
				</>
			)}

			{loading && (
				<p className="ses-loading">
					<span className="ses-spin" aria-hidden="true" />
					Loading sessions…
				</p>
			)}

			{!loading && singleDown && (
				<div className="ses-unreachable">
					<p className="ses-unreachable-title">Server unreachable</p>
					<p className="ses-unreachable-reason">{singleDown.error}</p>
					<button type="button" className="ses-retry-btn" onClick={retry}>
						Retry
					</button>
				</div>
			)}

			{!loading && !singleDown && (
				<>
					{multi ? (
						states.map(st => {
							const entries = live.filter(e => e.serverId === st.server.id);
							return (
								<section key={st.server.id} className="ses-server-section" aria-label={st.server.name}>
									<div className="ses-section-label ses-section-label--live ses-server-head">
										<span className={`ses-server-dot ses-server-dot--${st.status}`} aria-hidden="true" />
										{st.server.name}
										{st.status === "down" ? " · down" : entries.length > 0 ? ` · ${entries.length}` : ""}
									</div>
									{st.status === "down" ? (
										<div className="ses-unreachable">
											<p className="ses-unreachable-reason">{st.error}</p>
											<button type="button" className="ses-retry-btn" onClick={retry}>
												Retry
											</button>
										</div>
									) : (
										<>
											{entries.length === 0 && <p className="ses-empty">No live sessions</p>}
											{renderLiveRows(entries)}
										</>
									)}
								</section>
							);
						})
					) : (
						<>
							<div className="ses-section-label ses-section-label--live">
								<span className="ses-busy-dot" />
								Live{live.length > 0 ? ` · ${live.length}` : ""}
							</div>
							{live.length === 0 && <p className="ses-empty">No live sessions</p>}
							{renderLiveRows(live)}
						</>
					)}

					{pastOpen && (
						<>
							<div className="ses-section-label">Past</div>
							{multi && (
								<ServerPicker
									label="Resume from"
									list={serverList}
									value={effectivePastId}
									onChange={id => {
										setPastServerId(id);
										ensurePast(id);
									}}
								/>
							)}
							{pastList === null && !pastError && (
								<p className="ses-loading">
									<span className="ses-spin" aria-hidden="true" />
									Loading past sessions…
								</p>
							)}
							{pastList === null && pastError && (
								<div className="ses-unreachable">
									<p className="ses-unreachable-reason">{pastError}</p>
									<button type="button" className="ses-retry-btn" onClick={() => ensurePast(effectivePastId)}>
										Retry
									</button>
								</div>
							)}
							{pastList !== null && dayGroups.length === 0 && <p className="ses-empty">No past sessions</p>}
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
															onResume={id => handleResume(effectivePastId, id)}
															onDelete={id => handleDeletePast(effectivePastId, id)}
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
