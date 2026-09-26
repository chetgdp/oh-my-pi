import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { RpcConnectionState } from "../../lib/rpc-client";

export interface ConnectionBannerProps {
	connection: RpcConnectionState;
	attempt?: number;
	onReconnect?: () => void;
	delayMs?: number;
}

const MESSAGES: Record<string, string> = {
	connecting: "Connecting to host...",
	reconnecting: "Reconnecting to host...",
	closed: "WebSocket disconnected from host",
	incompatible: "This omp is too old, restart it",
};

const DEFAULT_DELAY_MS = 1000;

export function ConnectionBanner({
	connection,
	attempt,
	onReconnect,
	delayMs = DEFAULT_DELAY_MS,
}: ConnectionBannerProps): ReactNode {
	const isImmediate = connection === "incompatible" || connection === "closed";
	const isDelayed = connection === "connecting" || connection === "reconnecting";

	const [delayedVisible, setDelayedVisible] = useState(false);

	useEffect(() => {
		if (!isDelayed) {
			setDelayedVisible(false);
			return;
		}

		if (delayMs <= 0) {
			setDelayedVisible(true);
			return;
		}

		const timer = setTimeout(() => {
			setDelayedVisible(true);
		}, delayMs);

		return () => {
			clearTimeout(timer);
		};
	}, [isDelayed, delayMs]);

	if (connection === "ready") return null;

	const isVisible = isImmediate || delayMs <= 0 || delayedVisible;
	if (!isVisible) return null;

	const msg = MESSAGES[connection] ?? "Connecting to host...";
	const suffix = connection !== "incompatible" && attempt && attempt > 1 ? ` (attempt ${attempt})` : "";

	return (
		<div className="conn-banner">
			<span className="conn-banner-text">
				{msg}
				{suffix}
			</span>
			{onReconnect && connection !== "incompatible" && (
				<button type="button" className="conn-banner-btn" onClick={onReconnect}>
					Reconnect
				</button>
			)}
		</div>
	);
}
