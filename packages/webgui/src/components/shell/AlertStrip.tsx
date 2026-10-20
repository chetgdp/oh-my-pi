import { CircleAlert, Gauge, Ghost, Info, ListChecks, Loader2, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import type { Alert } from "../../lib/alert-priority";

export interface AlertStripProps {
	alert: Alert | null;
	onAction(id: string): void;
}

type Tone = "ghost" | "bad" | "warn" | "prog" | "neutral";

const TONE: Record<Exclude<Alert["kind"], "notice">, Tone> = {
	focus: "ghost",
	offline: "bad",
	"needs-you": "warn",
	compacting: "prog",
	context: "bad",
};

function icon(alert: Alert): ReactNode {
	switch (alert.kind) {
		case "notice":
			return alert.noticeKind === "error" ? <CircleAlert aria-hidden="true" /> : <Info aria-hidden="true" />;
		case "focus":
			return <Ghost aria-hidden="true" />;
		case "offline":
			return <WifiOff aria-hidden="true" />;
		case "needs-you":
			return /plan/i.test(alert.title) ? <ListChecks aria-hidden="true" /> : <Info aria-hidden="true" />;
		case "compacting":
			return <Loader2 className="alert-strip-spin" aria-hidden="true" />;
		case "context":
			return <Gauge aria-hidden="true" />;
	}
}

/** One-line notice under the top bar; one style, tinted per kind (r4.html concept L). */
export function AlertStrip({ alert, onAction }: AlertStripProps) {
	if (!alert) return null;
	const tone: Tone = alert.kind === "notice" ? (alert.noticeKind === "error" ? "bad" : "neutral") : TONE[alert.kind];
	return (
		<div
			className={`alert-strip alert-strip-${tone}`}
			role={alert.noticeKind === "error" ? "alert" : "status"}
			data-kind={alert.kind}
		>
			{icon(alert)}
			<span className="alert-strip-text">
				<b>{alert.title}</b>
				{alert.detail ? <span className="alert-strip-detail"> {alert.detail}</span> : null}
			</span>
			{alert.actions.map(action => (
				<button
					key={action.id}
					type="button"
					className={`alert-strip-action${action.solid ? " solid" : ""}`}
					onClick={() => onAction(action.id)}
				>
					<span>{action.label}</span>
				</button>
			))}
			{tone === "prog" ? (
				<span className="alert-strip-bar" aria-hidden="true">
					{alert.progress === undefined ? (
						<i className="indeterminate" />
					) : (
						<i style={{ width: `${Math.max(0, Math.min(100, alert.progress))}%` }} />
					)}
				</span>
			) : null}
		</div>
	);
}
