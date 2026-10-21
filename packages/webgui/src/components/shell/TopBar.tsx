import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import type { LiveLine } from "../../lib/live-line";
import type { WrenVoiceState } from "../../lib/wren";
import type { SheetDragHandlers } from "../../lib/use-sheet-drag";
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
	/** Pull-to-open handlers (ControlCenter `pullRef`); a downward drag on the bar opens the sheet. */
	pull?: RefObject<SheetDragHandlers | null>;
	/** Fixed clock for tests/static render; when omitted a 1s ticker drives elapsed text. */
	now?: number;
	/** Per-session voice state; the chip renders only alongside a live line. */
	voice?: WrenVoiceState;
	onToggleVoice?: () => void;
}

type VoiceChipState = "on" | "tap" | "elsewhere" | "off";

function voiceChip(v: WrenVoiceState): { state: VoiceChipState; text: string } {
	if (v.armed) return { state: "tap", text: "voice: tap" };
	if (v.enabled && v.activeElsewhere !== null)
		return { state: "elsewhere", text: `voice \u2192 ${v.activeElsewhere}` };
	if (v.enabled) return { state: "on", text: v.active ? "voice on" : "voice\u2026" };
	return { state: "off", text: "voice off" };
}

function VoiceChip({ voice, onToggle }: { voice: WrenVoiceState; onToggle: () => void }): ReactNode {
	const { state, text } = voiceChip(voice);
	return (
		<button
			type="button"
			className="tb-voice"
			data-state={state}
			// Keeps the bar's pull-to-open drag and control-center toggle out of the tap.
			onPointerDown={e => e.stopPropagation()}
			onClick={e => {
				e.stopPropagation();
				onToggle();
			}}
			aria-label={state === "off" ? "Turn voice on for this session" : "Turn voice off for this session"}
			aria-pressed={state !== "off"}
		>
			{text}
		</button>
	);
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
	pull,
	now,
	voice,
	onToggleVoice,
}: TopBarProps): ReactNode {
	if (!onToggleCc) {
		return <span className="tb-title">{title}</span>;
	}
	const ccLabel = ccOpen ? "Close control center" : "Open control center";
	const toggle = (): void => {
		if (!pull?.current?.consumeDragClick()) onToggleCc();
	};
	return (
		<div
			className="tb-bar"
			data-open={ccOpen ? "true" : undefined}
			data-pull={pull ? "" : undefined}
			onPointerDown={
				pull &&
				((e: ReactPointerEvent<HTMLElement>) => {
					// The back button keeps plain tap semantics.
					if ((e.target as unknown as HTMLElement).closest(".tb-back")) return;
					pull.current?.onPointerDown(e);
				})
			}
			onPointerMove={pull && (e => pull.current?.onPointerMove(e))}
			onPointerUp={pull && (e => pull.current?.onPointerUp(e))}
			onPointerCancel={pull && (() => pull.current?.onPointerCancel())}
			onLostPointerCapture={pull && (e => pull.current?.onLostPointerCapture(e))}
			onPointerLeave={pull && (() => pull.current?.onPointerLeave())}
		>
			{onBack && (
				<button type="button" className="tb-back" onClick={onBack} aria-label={backLabel}>
					<ChevronLeft size={22} />
				</button>
			)}
			<button type="button" className="tb-title-btn" onClick={toggle} aria-label={`${title}. ${ccLabel}`}>
				<span className="tb-title">{title}</span>
				{line && <LiveText line={line} now={now} />}
			</button>
			{line && voice && onToggleVoice && <VoiceChip voice={voice} onToggle={onToggleVoice} />}
			<button type="button" className="tb-pull" onClick={toggle} aria-label={ccLabel} aria-expanded={ccOpen}>
				{ccOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
			</button>
			{!ccOpen && <span className="tb-grabber" aria-hidden="true" />}
		</div>
	);
}
