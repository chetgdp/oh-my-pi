import type { ReactNode } from "react";
import type { RpcConnectionState } from "../../lib/rpc-client";

interface ConnectionBannerProps {
	connection: RpcConnectionState;
	attempt?: number;
}

const MESSAGES: Record<string, string> = {
	connecting: "Connecting",
	reconnecting: "Reconnecting",
	closed: "Disconnected",
};

export function ConnectionBanner({ connection, attempt }: ConnectionBannerProps): ReactNode {
	if (connection === "ready") return null;
	const msg = MESSAGES[connection] ?? "Connecting";
	const suffix = attempt && attempt > 1 ? ` (attempt ${attempt})` : "";
	return (
		<div className="conn-banner">
			{msg}
			{suffix}
		</div>
	);
}
