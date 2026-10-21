/** `wren` voice calls (custom tool or `wren` CLI via bash): spoken text in a readable callout. */
import { Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { ResultText } from "../parts";
import type { ToolRenderer, ToolRenderProps } from "../types";
import { normalizeWs, truncate } from "../util";
import { type VoiceCall, voiceCallText } from "../voice";

export function VoiceSummary({ call, isError }: { call: VoiceCall; isError?: boolean }): ReactNode {
	const label = call.text !== null ? truncate(normalizeWs(call.text) || "…", 80) : call.command;
	return isError ? <span className="tv-err-text">{label}</span> : <span className="tv-voice-sum">{label}</span>;
}

export function VoiceBody({ call, result }: { call: VoiceCall; result: ToolRenderProps["result"] }): ReactNode {
	return (
		<>
			<div className="tv-cmd">
				<span className="tv-cmd-prompt">$</span>
				<span className="tv-cmd-text">{`wren ${call.command}`}</span>
			</div>
			{call.command === "say" && (
				<blockquote className="tv-voice">
					<Volume2 className="tv-voice-icon" size={16} aria-hidden="true" />
					<span className="tv-voice-text">{call.text || "…"}</span>
				</blockquote>
			)}
			{result?.isError && <ResultText result={result} maxLines={6} />}
		</>
	);
}

function Summary(props: ToolRenderProps): ReactNode {
	const call = voiceCallText("wren", props.args) ?? { command: "say", text: null };
	return <VoiceSummary call={call} isError={props.result?.isError} />;
}

function Body(props: ToolRenderProps): ReactNode {
	const call = voiceCallText("wren", props.args) ?? { command: "say", text: null };
	return <VoiceBody call={call} result={props.result} />;
}

export const wrenRenderer: ToolRenderer = { Summary, Body };
