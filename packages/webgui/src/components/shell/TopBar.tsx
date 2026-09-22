import type { ReactNode } from "react";
import { useState } from "react";
import { Bot, RefreshCw, X, SlidersHorizontal } from "lucide-react";
import type { RpcConnectionState } from "../../lib/rpc-client";
import { navigate } from "../../lib/route";
import type { Route } from "../../lib/route";

interface TopBarProps {
	title: string;
	connection: RpcConnectionState;
	route: Route;
	subagentCount?: number;
	onReconnect?: () => void;
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

export function TopBar({ title, connection, route, subagentCount, onReconnect }: TopBarProps): ReactNode {
	const [connPopoverOpen, setConnPopoverOpen] = useState(false);
	const instanceId = route.kind === "session" ? route.id : null;
	const panel = route.kind === "session" ? route.panel : null;
	if (route.kind === "sessions") {
		return <span className="tb-title">{title}</span>;
	}
	const toggleInfo = () => {
		if (route.kind === "session") {
			navigate({
				kind: "session",
				id: route.id,
				panel: panel === "info" ? null : "info",
			});
		}
	};

	const toggleAgents = () => {
		if (route.kind === "session") {
			navigate({
				kind: "session",
				id: route.id,
				panel: panel === "agents" ? null : "agents",
			});
		}
	};

	const toggleModels = () => {
		if (route.kind === "session") {
			navigate({
				kind: "session",
				id: route.id,
				panel: panel === "models" ? null : "models",
			});
		}
	};

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
			<button
				type="button"
				className="tb-title-btn"
				data-active={panel === "info" ? "true" : undefined}
				onClick={toggleInfo}
				title={title}
				aria-label="Toggle info panel"
			>
				<span className="tb-title">{title}</span>
			</button>
			<div className="tb-spacer" />

			<div className="tb-conn-anchor">
				<button
					type="button"
					className="tb-conn-btn"
					data-active={connPopoverOpen ? "true" : undefined}
					onClick={() => setConnPopoverOpen(prev => !prev)}
					title={`Connection: ${CONNECTION_LABELS[connection] ?? connection}. Tap for status.`}
					aria-label={`Connection: ${CONNECTION_LABELS[connection] ?? connection}`}
				>
					<span className={dotClass(connection)} />
					<span className="tb-conn-label">{CONNECTION_LABELS[connection] ?? connection}</span>
				</button>

				{connPopoverOpen && (
					<>
						<div className="tb-popover-backdrop" onClick={() => setConnPopoverOpen(false)} />
						<div className="tb-conn-popover" role="dialog" aria-label="Connection Status">
							<div className="tb-popover-header">
								<span className="tb-popover-title">Connection</span>
								<button
									type="button"
									className="tb-popover-close"
									onClick={() => setConnPopoverOpen(false)}
									aria-label="Close"
								>
									<X size={14} />
								</button>
							</div>
							<div className="tb-popover-body">
								<div className="tb-popover-row">
									<span className="tb-popover-label">Status</span>
									<span className="tb-popover-val">
										<span className={dotClass(connection)} />
										{CONNECTION_LABELS[connection] ?? connection}
									</span>
								</div>
								<div className="tb-popover-row">
									<span className="tb-popover-label">Transport</span>
									<span className="tb-popover-val">WebSocket</span>
								</div>
								{instanceId && (
									<div className="tb-popover-row">
										<span className="tb-popover-label">Instance</span>
										<span className="tb-popover-val tb-popover-mono">{instanceId}</span>
									</div>
								)}
							</div>
							<div className="tb-popover-actions">
								<button
									type="button"
									className="tb-popover-btn"
									onClick={() => {
										onReconnect?.();
										setConnPopoverOpen(false);
									}}
								>
									<RefreshCw size={13} />
									<span>{connection === "ready" ? "Reconnect" : "Reconnect now"}</span>
								</button>
							</div>
						</div>
					</>
				)}
			</div>
			<button
				type="button"
				className="tb-panel-btn tb-models-btn"
				data-active={panel === "models" ? "true" : undefined}
				onClick={toggleModels}
				aria-label="Toggle models panel"
				title="Models"
			>
				<SlidersHorizontal size={18} />
			</button>
			<button
				type="button"
				className="tb-panel-btn tb-agents-btn"
				data-active={panel === "agents" ? "true" : undefined}
				onClick={toggleAgents}
				aria-label="Toggle agents panel"
				title={subagentCount && subagentCount > 0 ? `Subagents (${subagentCount})` : "Subagents"}
			>
				<Bot size={18} />
				{subagentCount !== undefined && subagentCount > 0 ? (
					<span className="tb-badge">{subagentCount}</span>
				) : null}
			</button>
		</>
	);
}
