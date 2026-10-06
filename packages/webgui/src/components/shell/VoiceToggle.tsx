import type { ReactNode } from "react";
import { useCallback, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { disableVoice, enableVoice, getWrenState, subscribeWren } from "../../lib/wren";

export function VoiceToggle(): ReactNode {
	const state = useSyncExternalStore(subscribeWren, getWrenState, getWrenState);
	const onClick = useCallback(() => {
		if (getWrenState().enabled) disableVoice();
		else void enableVoice();
	}, []);

	const title =
		state.error ??
		(state.enabled ? (state.active ? "this device has voice" : "another device has voice") : "Voice off");
	const on = state.enabled && state.active;
	return (
		<button
			type="button"
			className={`ss-voice${on ? " ss-voice--on" : ""}${state.error ? " ss-voice--err" : ""}`}
			onClick={onClick}
			aria-pressed={state.enabled}
			aria-label={state.enabled ? "Disable voice" : "Enable voice"}
			title={title}
		>
			{state.enabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
		</button>
	);
}
