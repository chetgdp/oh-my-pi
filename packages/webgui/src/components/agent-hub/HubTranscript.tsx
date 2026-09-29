import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import {
	agentIdLabel,
	applyTranscriptChunk,
	emptyHubTranscript,
	type HubTranscriptState,
} from "../../lib/agent-hub-model";
import { getSubagentMessages, steerAgent, type SessionCommandSink } from "../../lib/session-actions";
import { emptyTranscriptState } from "../../lib/transcript-model";
import { notify } from "../../lib/notify";
import type { ToolRenderHost } from "../transcript/tool-views/types";
import { TranscriptView } from "../transcript/Transcript";

const POLL_MS = 1000;

export function HubTranscript(props: {
	sink: SessionCommandSink | null;
	entry: AgentRosterEntry;
	toolHost: ToolRenderHost;
}): ReactNode {
	const { sink, entry, toolHost } = props;
	const agentId = entry.id;
	const [transcript, setTranscript] = useState<HubTranscriptState>(() => emptyHubTranscript(agentId));
	const [error, setError] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const cursor = useRef<HubTranscriptState>(transcript);

	useEffect(() => {
		const fresh = emptyHubTranscript(agentId);
		cursor.current = fresh;
		setTranscript(fresh);
		setError(null);
		if (!sink) return;
		let cancelled = false;
		let inFlight = false;
		const poll = async (): Promise<void> => {
			if (inFlight || cancelled) return;
			inFlight = true;
			try {
				const resp = await getSubagentMessages(
					sink,
					agentId,
					cursor.current.nextByte,
					cursor.current.fileId,
					cursor.current.sentinel,
				);
				if (cancelled) return;
				const next = applyTranscriptChunk(cursor.current, resp.data);
				setError(null);
				if (next !== cursor.current) {
					cursor.current = next;
					setTranscript(next);
				}
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			} finally {
				inFlight = false;
			}
		};
		void poll();
		const timer = setInterval(() => void poll(), POLL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [sink, agentId]);

	const state = useMemo(() => {
		// The file header is not a conversation entry.
		const entries = transcript.entries.filter((e): e is SessionEntry => e.type !== "session");
		return { ...emptyTranscriptState(), entries };
	}, [transcript.entries]);

	const canSteer = sink !== null && entry.kind === "sub" && entry.status !== "aborted";
	const send = useCallback(async () => {
		const text = draft.trim();
		if (!sink || text === "" || sending) return;
		setSending(true);
		try {
			await steerAgent(sink, agentId, text);
			setDraft("");
		} catch (err) {
			notify("error", err instanceof Error ? err.message : String(err));
		} finally {
			setSending(false);
		}
	}, [sink, agentId, draft, sending]);

	return (
		<div className="ah-transcript">
			{error && <div className="ah-note ah-note--err">{error}</div>}
			{!entry.sessionFile && transcript.entries.length === 0 ? (
				<div className="ah-empty">No transcript yet.</div>
			) : (
				<div className="ah-transcript-body">
					<TranscriptView
						state={state}
						streaming={entry.status === "running"}
						expandAll={false}
						toolHost={toolHost}
					/>
				</div>
			)}
			<form
				className="ah-steer"
				onSubmit={e => {
					e.preventDefault();
					void send();
				}}
			>
				<input
					className="ah-input"
					value={draft}
					disabled={!canSteer}
					placeholder={canSteer ? `Steer ${agentIdLabel(entry.id)}...` : "Steering unavailable for this agent"}
					aria-label="Steer agent"
					onChange={e => setDraft(e.currentTarget.value)}
				/>
				<button type="submit" className="ah-btn" disabled={!canSteer || sending || draft.trim() === ""}>
					Steer
				</button>
			</form>
		</div>
	);
}
