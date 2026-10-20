import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import type { LiveLine } from "../../lib/live-line";
import { useNow } from "../agent-hub/HubDetail";

const ELAPSED_TICK_MS = 1000;

export interface TopBarProps {
	title: string;
	/** Live status line (line 2). Null renders the title only (sessions list). */
	line: LiveLine | null;
	/** Back handler; omitted on the sessions list where there is nowhere to go back to. */
	onBack?: () => void;
	backLabel?: string;
	ccOpen: boolean;
	onToggleCc?: () => void;
	/** Fixed clock for tests/static render; when omitted a 1s ticker drives elapsed text. */
	now?: number;
}

/** Whole-second elapsed: "12s", "2m14s", "14m", "1h05m". */
export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	if (total < 60) return `${total}s`;
	const min = Math.floor(total / 60);
	if (min < 10) return `${min}m${String(total % 60).padStart(2, "0")}s`;
	if (min < 60) return `${min}m`;
	return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;
}

/** Seconds until the next reconnect attempt, never negative. */
function formatCountdown(ms: number): string {
	return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

/** Only this leaf re-renders on the 1s tick. */
function Ticking({ format }: { format: (now: number) => string }): ReactNode {
	const now = useNow(ELAPSED_TICK_MS);
	return format(now);
}

/** Static text when a fixed clock is given, else a 1s ticking leaf. */
function clockText(now: number | undefined, format: (now: number) => string): ReactNode {
	return now === undefined ? <Ticking format={format} /> : format(now);
}

function LiveText({ line, now }: { line: LiveLine; now?: number }): ReactNode {
	const { elapsedFrom, retryAt } = line;
	const elapsed = elapsedFrom === null ? null : clockText(now, t => formatElapsed(t - elapsedFrom));
	const retry = retryAt === null ? null : clockText(now, t => formatCountdown(retryAt - t));
	const running = line.elapsedFrom !== null && line.activity !== "idle" && line.retryAt === null;
	return (
		<span className="tb-live" data-tone={line.tone}>
			<span className="tb-live-dot" data-tone={line.tone} data-running={running ? "true" : undefined} />
			<span className="tb-live-act">
				{line.activity}
				{elapsed !== null && <> · {elapsed}</>}
				{retry !== null && <> in {retry}</>}
			</span>
			{line.ctxPercent !== null && (
				<>
					<span className="tb-live-sep">·</span>
					<span className="tb-live-ctx" data-level={line.ctxLevel}>
						{Math.round(line.ctxPercent)}%
					</span>
				</>
			)}
			{line.cost !== null && (
				<>
					<span className="tb-live-sep">·</span>
					<span>{line.cost}</span>
				</>
			)}
		</span>
	);
}

export function TopBar({
	title,
	line,
	onBack,
	backLabel = "Back to sessions",
	ccOpen,
	onToggleCc,
	now,
}: TopBarProps): ReactNode {
	if (!onToggleCc) {
		return <span className="tb-title">{title}</span>;
	}
	const ccLabel = ccOpen ? "Close control center" : "Open control center";
	return (
		<div className="tb-bar" data-open={ccOpen ? "true" : undefined}>
			{onBack && (
				<button type="button" className="tb-back" onClick={onBack} aria-label={backLabel}>
					<ChevronLeft size={22} />
				</button>
			)}
			<button type="button" className="tb-title-btn" onClick={onToggleCc} aria-label={`${title}. ${ccLabel}`}>
				<span className="tb-title">{title}</span>
				{line && <LiveText line={line} now={now} />}
			</button>
			<button type="button" className="tb-pull" onClick={onToggleCc} aria-label={ccLabel} aria-expanded={ccOpen}>
				{ccOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
			</button>
			{!ccOpen && <span className="tb-grabber" aria-hidden="true" />}
		</div>
	);
}
