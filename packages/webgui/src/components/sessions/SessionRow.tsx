import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LiveSessionEntry } from "../../server/live";
import type { PastSessionSummary } from "../../server/past";
import { displayName, shortCwd } from "../../lib/session-groups";

function relativeTime(ts: number): string {
	const delta = Date.now() - ts;
	const secs = Math.floor(delta / 1000);
	if (secs < 60) return "just now";
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

const SHUTDOWN_TIMEOUT_MS = 4000;

export function liveSessionName(entry: LiveSessionEntry): string {
	return entry.sessionName ?? entry.cwd.split("/").filter(Boolean).pop() ?? entry.instanceId;
}

export function LiveSessionRow(props: {
	entry: LiveSessionEntry;
	current: boolean;
	onAttach(instanceId: string): void;
	onShutdown(instanceId: string): void;
	unread?: number;
}): ReactNode {
	const { entry, current, onAttach, onShutdown, unread = 0 } = props;
	const [armed, setArmed] = useState(false);
	const timerRef = useRef<Timer | number | null>(null);

	useEffect(() => {
		if (!armed) return;
		timerRef.current = setTimeout(() => setArmed(false), SHUTDOWN_TIMEOUT_MS);
		return () => {
			clearTimeout(timerRef.current ?? undefined);
		};
	}, [armed]);

	useEffect(() => {
		return () => {
			clearTimeout(timerRef.current ?? undefined);
		};
	}, []);

	const handleShutdown = useCallback(() => {
		if (!armed) {
			setArmed(true);
			return;
		}
		clearTimeout(timerRef.current ?? undefined);
		timerRef.current = null;
		setArmed(false);
		onShutdown(entry.instanceId);
	}, [armed, entry.instanceId, onShutdown]);

	const name = liveSessionName(entry);

	return (
		<div className={`ses-row ses-row--live${current ? " ses-row--current" : ""}`}>
			<button type="button" className="ses-row-main" onClick={() => onAttach(entry.instanceId)}>
				<span className="ses-row-name">
					<span className="ses-busy-dot" title="running" />
					{name}
					{entry.origin === "gui" && <span className="ses-badge ses-badge--gui">GUI</span>}
				</span>
				{entry.recap ? (
					<span className="ses-recap">
						<span className="ses-recap-text">{entry.recap.text}</span>
						<span className="ses-recap-age">recap {relativeTime(entry.recap.createdAt)}</span>
					</span>
				) : null}
				<span className="ses-row-meta">
					<span className="ses-row-cwd">{shortCwd(entry.cwd)}</span>
					{entry.model ? <span>{entry.model}</span> : null}
					<span>active {relativeTime(entry.lastActivityAt)}</span>
				</span>
			</button>
			{unread > 0 && (
				<span className="ses-unread" role="status" aria-label={`${unread} unread`}>
					{unread > 99 ? "99+" : unread}
				</span>
			)}
			<button
				type="button"
				className={`ses-menu-btn${armed ? " ses-menu-btn--armed" : ""}`}
				onClick={handleShutdown}
				aria-label={armed ? "Confirm shut down" : "Shut down"}
			>
				{armed ? "Confirm?" : "Stop"}
			</button>
		</div>
	);
}

export function PastSessionRow(props: {
	entry: PastSessionSummary;
	pending: boolean;
	onResume(id: string): void;
	onDelete?(id: string): void;
}): ReactNode {
	const { entry, pending, onResume, onDelete } = props;
	const [armed, setArmed] = useState(false);
	const timerRef = useRef<Timer | number | null>(null);

	useEffect(() => {
		if (armed) {
			timerRef.current = setTimeout(() => setArmed(false), 4000);
		}
		return () => {
			clearTimeout(timerRef.current ?? undefined);
		};
	}, [armed]);

	const handleDelete = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (!armed) {
				setArmed(true);
				return;
			}
			clearTimeout(timerRef.current ?? undefined);
			timerRef.current = null;
			setArmed(false);
			onDelete?.(entry.id);
		},
		[armed, entry.id, onDelete],
	);

	return (
		<div className={`ses-row ses-row--past${pending ? " ses-row--pending" : ""}`}>
			<button type="button" className="ses-row-main" onClick={() => onResume(entry.id)}>
				<span className="ses-row-name">{displayName(entry)}</span>
				<span className="ses-row-meta">
					<span className="ses-row-cwd">{shortCwd(entry.cwd)}</span>
					<span>{relativeTime(entry.modifiedAt)}</span>
				</span>
			</button>
			{pending && <span className="ses-row-pending-text">Resuming...</span>}
			{onDelete && !pending && (
				<button
					type="button"
					className={`ses-menu-btn${armed ? " ses-menu-btn--armed" : ""}`}
					onClick={handleDelete}
					aria-label={armed ? "Confirm delete session" : "Delete session"}
				>
					{armed ? "Confirm?" : "Delete"}
				</button>
			)}
		</div>
	);
}
