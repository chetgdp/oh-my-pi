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

export function LiveSessionRow(props: {
	entry: LiveSessionEntry;
	current: boolean;
	onAttach(instanceId: string): void;
	onShutdown(instanceId: string): void;
}): ReactNode {
	const { entry, current, onAttach, onShutdown } = props;
	const [armed, setArmed] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!armed) return;
		timerRef.current = setTimeout(() => setArmed(false), SHUTDOWN_TIMEOUT_MS);
		return () => {
			if (timerRef.current != null) clearTimeout(timerRef.current);
		};
	}, [armed]);

	useEffect(() => {
		return () => {
			if (timerRef.current != null) clearTimeout(timerRef.current);
		};
	}, []);

	const handleShutdown = useCallback(() => {
		if (!armed) {
			setArmed(true);
			return;
		}
		if (timerRef.current != null) clearTimeout(timerRef.current);
		timerRef.current = null;
		setArmed(false);
		onShutdown(entry.instanceId);
	}, [armed, entry.instanceId, onShutdown]);

	const name = entry.sessionName ?? entry.cwd.split("/").filter(Boolean).pop() ?? entry.instanceId;

	return (
		<div className={`ses-row${current ? " ses-row--current" : ""}`}>
			<button type="button" className="ses-row-main" onClick={() => onAttach(entry.instanceId)}>
				<span className="ses-row-name">{name}</span>
				<span className="ses-row-meta">
					<span className="ses-row-cwd">{shortCwd(entry.cwd)}</span>
					{entry.model ? <span>{entry.model}</span> : null}
					<span className="ses-busy-dot" title="running" />
					<span>{relativeTime(entry.startedAt)}</span>
				</span>
			</button>
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
}): ReactNode {
	const { entry, pending, onResume } = props;

	return (
		<div className={`ses-row${pending ? " ses-row--pending" : ""}`}>
			<button type="button" className="ses-row-main" onClick={() => onResume(entry.id)}>
				<span className="ses-row-name">{displayName(entry)}</span>
				<span className="ses-row-meta">
					<span className="ses-row-cwd">{shortCwd(entry.cwd)}</span>
					<span>{relativeTime(entry.modifiedAt)}</span>
				</span>
			</button>
			{pending && <span className="ses-row-pending-text">Resuming...</span>}
		</div>
	);
}
