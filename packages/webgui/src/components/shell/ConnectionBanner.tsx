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
};

export function ConnectionBanner({ connection, attempt, onReconnect }: ConnectionBannerProps): ReactNode {
	if (connection === "ready") return null;
	const msg = MESSAGES[connection] ?? "Connecting to host...";
	const suffix = attempt && attempt > 1 ? ` (attempt ${attempt})` : "";

	return (
		<div className="conn-banner">
			<span className="conn-banner-text">
				{msg}
				{suffix}
			</span>
			{onReconnect && (
				<button type="button" className="conn-banner-btn" onClick={onReconnect}>
					Reconnect
				</button>
			)}
		</div>
	);
}
