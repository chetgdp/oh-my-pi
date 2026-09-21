import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LiveSessionEntry } from "../../server/live";
import type { PastSessionSummary } from "../../server/past";
import type { SessionListApi } from "../../lib/sessions-api";
import "./session-list.css";

// -- helpers ----------------------------------------------------------------

function shortenCwd(cwd: string): string {
	const parts = cwd.split("/").filter(Boolean);
	if (parts.length <= 2) return cwd;
	return parts.slice(-2).join("/");
}

function relativeTime(ts: number): string {
	const delta = Date.now() - ts;
	const secs = Math.floor(delta / 1000);
	if (secs < 60) return "just now";
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

// -- presentational ---------------------------------------------------------

export interface SessionListViewProps {
	live: LiveSessionEntry[];
	past: PastSessionSummary[];
	onAttach(instanceId: string): void;
	onResume(id: string): void;
	onShutdown(instanceId: string): void;
	onLaunch(cwd: string): void;
	shuttingDown: string | null;
	launchCwd: string;
	onLaunchCwdChange(cwd: string): void;
	pendingAction: string | null;
}

export function SessionListView({
	live,
	past,
	onAttach,
	onResume,
	onShutdown,
	onLaunch,
	shuttingDown,
	launchCwd,
	onLaunchCwdChange,
	pendingAction,
}: SessionListViewProps): ReactNode {
	return (
		<div className="sl-content">
			<section className="sl-section">
				<h3 className="sl-heading">Live</h3>
				{live.length === 0 && <p className="sl-empty">No live sessions</p>}
				{live.map(s => (
					<div key={s.instanceId} className="sl-row">
						<button type="button" className="sl-row-main" onClick={() => onAttach(s.instanceId)}>
							<span className="sl-row-name">{s.sessionName ?? s.sessionId ?? s.instanceId}</span>
							<span className="sl-row-detail">
								{shortenCwd(s.cwd)}
								{s.model ? ` \u00b7 ${s.model}` : ""}
								{` \u00b7 pid ${s.pid}`}
							</span>
						</button>
						<button type="button" className="sl-shutdown" onClick={() => onShutdown(s.instanceId)}>
							{shuttingDown === s.instanceId ? "Confirm?" : "Shut down"}
						</button>
					</div>
				))}
			</section>

			<section className="sl-section">
				<h3 className="sl-heading">Past</h3>
				{past.length === 0 && <p className="sl-empty">No past sessions</p>}
				{past.map(s => (
					<button key={s.id} type="button" className="sl-row sl-row-main" onClick={() => onResume(s.id)}>
						<span className="sl-row-name">{s.name ?? s.firstUserMessage ?? s.id}</span>
						<span className="sl-row-detail">
							{shortenCwd(s.cwd)}
							{` \u00b7 ${relativeTime(s.modifiedAt)}`}
						</span>
					</button>
				))}
			</section>

			<section className="sl-section">
				<h3 className="sl-heading">New session</h3>
				<div className="sl-new">
					<input
						type="text"
						className="sl-cwd-input"
						value={launchCwd}
						placeholder="Working directory"
						onChange={e => onLaunchCwdChange((e.target as unknown as { value: string }).value)}
					/>
					<button type="button" className="sl-start-btn" onClick={() => onLaunch(launchCwd)}>
						Start
					</button>
				</div>
			</section>

			{pendingAction != null && <p className="sl-pending">{pendingAction}</p>}
		</div>
	);
}

// -- stateful wrapper -------------------------------------------------------

export interface SessionListProps {
	open: boolean;
	onClose(): void;
	onAttach(instanceId: string): void;
	api: SessionListApi;
}

export function SessionList({ open, onClose, onAttach, api }: SessionListProps): ReactNode {
	const [live, setLive] = useState<LiveSessionEntry[]>([]);
	const [past, setPast] = useState<PastSessionSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [shuttingDown, setShuttingDown] = useState<string | null>(null);
	const [launchCwd, setLaunchCwd] = useState("");
	const [pendingAction, setPendingAction] = useState<string | null>(null);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [l, p] = await Promise.all([api.listLive(), api.listPast({ all: true })]);
			setLive(l);
			setPast(p);
			// Default cwd from most recent entry
			const firstCwd = l[0]?.cwd ?? p[0]?.cwd;
			if (firstCwd) setLaunchCwd(firstCwd);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [api]);

	useEffect(() => {
		if (open) reload();
	}, [open, reload]);

	const handleShutdown = useCallback(
		async (instanceId: string) => {
			if (shuttingDown !== instanceId) {
				// First tap: arm confirm
				setShuttingDown(instanceId);
				return;
			}
			// Second tap: execute
			try {
				await api.shutdown(instanceId);
				setShuttingDown(null);
				await reload();
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
		[api, shuttingDown, reload],
	);

	const handleResume = useCallback(
		async (id: string) => {
			try {
				const result = await api.resume(id);
				if (result.instanceId) {
					onAttach(result.instanceId);
					onClose();
					return;
				}
				// No instanceId yet; poll for it
				const entry = past.find(s => s.id === id);
				const cwd = entry?.cwd;
				const startTime = Date.now();
				setPendingAction("Started; waiting for it to appear\u2026");
				const poll = async (): Promise<void> => {
					if (Date.now() - startTime > 20_000) {
						setPendingAction(null);
						return;
					}
					const sessions = await api.listLive();
					const match = sessions.find(s => cwd != null && s.cwd === cwd && s.startedAt > startTime);
					if (match) {
						setPendingAction(null);
						onAttach(match.instanceId);
						onClose();
						return;
					}
					await new Promise<void>(r => setTimeout(r, 2000));
					return poll();
				};
				poll();
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
		[api, past, onAttach, onClose],
	);

	const handleLaunch = useCallback(
		async (cwd: string) => {
			try {
				const result = await api.launch(cwd);
				if (result.instanceId) {
					onAttach(result.instanceId);
					onClose();
					return;
				}
				const startTime = Date.now();
				setPendingAction("Started; waiting for it to appear\u2026");
				const poll = async (): Promise<void> => {
					if (Date.now() - startTime > 20_000) {
						setPendingAction(null);
						return;
					}
					const sessions = await api.listLive();
					const match = sessions.find(s => s.cwd === cwd && s.startedAt > startTime);
					if (match) {
						setPendingAction(null);
						onAttach(match.instanceId);
						onClose();
						return;
					}
					await new Promise<void>(r => setTimeout(r, 2000));
					return poll();
				};
				poll();
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
		[api, onAttach, onClose],
	);

	if (!open) return null;

	return (
		<div className="sl-overlay" onClick={onClose}>
			<div className="sl-panel" onClick={e => (e as unknown as { stopPropagation(): void }).stopPropagation()}>
				<div className="sl-header">
					<h2 className="sl-title">Sessions</h2>
					<button type="button" className="sl-close" onClick={onClose} aria-label="Close">
						{"\u00d7"}
					</button>
				</div>

				{loading && <p className="sl-loading">{"Loading\u2026"}</p>}
				{error != null && <p className="sl-error">{error}</p>}
				{!loading && error == null && (
					<SessionListView
						live={live}
						past={past}
						onAttach={id => {
							onAttach(id);
							onClose();
						}}
						onResume={handleResume}
						onShutdown={handleShutdown}
						onLaunch={handleLaunch}
						shuttingDown={shuttingDown}
						launchCwd={launchCwd}
						onLaunchCwdChange={setLaunchCwd}
						pendingAction={pendingAction}
					/>
				)}
			</div>
		</div>
	);
}
