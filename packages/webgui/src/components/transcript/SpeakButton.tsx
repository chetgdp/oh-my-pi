import type { MouseEvent, ReactNode } from "react";
import { memo, useCallback, useId, useSyncExternalStore } from "react";
import { Ban, Volume2 } from "lucide-react";
import { getWrenState, speakText, stopSpeaking, subscribeWren } from "../../lib/wren";

export interface SpeakButtonProps {
	text: string;
	/** Stable id tying this button to the speech it starts; defaults to a per-instance id. */
	owner?: string;
	className?: string;
}

export const SpeakButton = memo(function SpeakButton({ text, owner, className }: SpeakButtonProps): ReactNode {
	const generatedId = useId();
	const ownerId = owner ?? generatedId;
	const state = useSyncExternalStore(subscribeWren, getWrenState, getWrenState);
	const showStop = state.owner === ownerId && (state.pending || state.speaking);

	const handleClick = useCallback(
		(e: MouseEvent<HTMLButtonElement>) => {
			// Sits inside clickable headers.
			e.stopPropagation();
			if (showStop) {
				void stopSpeaking().catch(() => {});
				return;
			}
			void speakText(text, ownerId).catch(() => {});
		},
		[showStop, text, ownerId],
	);

	const label = showStop ? "Stop speaking" : (state.error ?? "Speak");
	return (
		<button
			type="button"
			className={className ? `tr-copy-btn tr-speak-btn ${className}` : "tr-copy-btn tr-speak-btn"}
			onClick={handleClick}
			aria-label={showStop ? "Stop speaking" : "Speak"}
			title={label}
		>
			{showStop ? (
				<Ban size={13} className="tr-copy-icon stop-icon" aria-hidden="true" />
			) : (
				<Volume2 size={13} className="tr-copy-icon" aria-hidden="true" />
			)}
		</button>
	);
});
