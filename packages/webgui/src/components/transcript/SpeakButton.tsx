import type { ReactNode } from "react";
import { useCallback, useRef, useSyncExternalStore, memo } from "react";
import { Square, Volume2 } from "lucide-react";
import { getWrenState, speakText, stopSpeaking, subscribeWren } from "../../lib/wren";

export interface SpeakButtonProps {
	text: string;
	className?: string;
}

export const SpeakButton = memo(function SpeakButton({ text, className }: SpeakButtonProps): ReactNode {
	const state = useSyncExternalStore(subscribeWren, getWrenState, getWrenState);
	// Only the button that started playback shows the stop affordance.
	const ownRef = useRef(false);
	const showStop = state.speaking && ownRef.current;
	if (!state.speaking) ownRef.current = false;

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			if (showStop) {
				void stopSpeaking();
				return;
			}
			ownRef.current = true;
			void speakText(text);
		},
		[showStop, text],
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
				<Square size={13} className="tr-copy-icon" aria-hidden="true" />
			) : (
				<Volume2 size={13} className="tr-copy-icon" aria-hidden="true" />
			)}
		</button>
	);
});
