/**
 * Thin wrapper that renders collab-web's Transcript component
 * with the mapped TranscriptState.
 */

import type { ReactNode } from "react";
import type { TranscriptState } from "../../lib/transcript-model";
import { Transcript as CollabTranscript } from "../../../../collab-web/src/components/transcript/Transcript";

export interface TranscriptViewProps {
	state: TranscriptState;
	streaming: boolean;
}

export function TranscriptView({ state, streaming }: TranscriptViewProps): ReactNode {
	return (
		<CollabTranscript
			entries={state.entries}
			stream={state.stream}
			streamDone={state.streamDone}
			activeTools={state.activeTools}
			working={state.working || streaming}
			phase="live"
		/>
	);
}
