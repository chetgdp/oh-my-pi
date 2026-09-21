import type { ReactNode } from "react";
import type { RpcConnectionState } from "../../lib/rpc-client";
import { navigate } from "../../lib/route";
import type { Route } from "../../lib/route";

interface TopBarProps {
	title: string;
	connection: RpcConnectionState;
	route: Route;
}

const CONNECTION_LABELS: Record<string, string> = {
	ready: "Connected",
	connecting: "Connecting",
	reconnecting: "Reconnecting",
	closed: "Disconnected",
};

function dotClass(conn: RpcConnectionState): string {
	if (conn === "reconnecting") return "tb-dot tb-dot-connecting";
	return `tb-dot tb-dot-${conn}`;
}

export function TopBar({ title, connection, route }: TopBarProps): ReactNode {
	const panel = route.kind === "session" ? route.panel : null;
	if (route.kind === "sessions") {
		return <span className="tb-title">{title}</span>;
	}

	return (
		<>
			<button
				type="button"
				className="tb-back"
				onClick={() => navigate({ kind: "sessions" })}
				aria-label="Back to sessions"
			>
				&#x2190;
			</button>
			<span className="tb-title">{title}</span>
			<span className={dotClass(connection)} />
			<span className="tb-conn-label">{CONNECTION_LABELS[connection] ?? connection}</span>
			<button
				type="button"
				className="tb-panel-btn"
				data-active={panel === "agents" ? "true" : undefined}
				onClick={() =>
					navigate(
						route.kind === "session"
							? {
									kind: "session",
									id: route.id,
									panel: panel === "agents" ? null : "agents",
								}
							: route,
					)
				}
				aria-label="Toggle agents panel"
			>
				&#x25A4;
			</button>
			<button
				type="button"
				className="tb-panel-btn"
				data-active={panel === "info" ? "true" : undefined}
				onClick={() =>
					navigate(
						route.kind === "session"
							? {
									kind: "session",
									id: route.id,
									panel: panel === "info" ? null : "info",
								}
							: route,
					)
				}
				aria-label="Toggle info panel"
			>
				&#x2139;
			</button>
		</>
	);
}
