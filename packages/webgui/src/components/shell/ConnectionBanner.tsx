import type { ReactNode } from "react";
import type { RpcConnectionState } from "../../lib/rpc-client";

interface ConnectionBannerProps {
	connection: RpcConnectionState;
	attempt?: number;
	onReconnect?: () => void;
}

const MESSAGES: Record<string, string> = {
	connecting: "Connecting to host...",
	reconnecting: "Reconnecting to host...",
	closed: "WebSocket disconnected from host",
	incompatible: "This omp is too old, restart it",
};

export function ConnectionBanner({ connection, attempt, onReconnect }: ConnectionBannerProps): ReactNode {
	if (connection === "ready") return null;
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
