import { useState } from "react";
import type { ReactNode } from "react";
// Leaf module import: the pi-agent-core barrel drags bun-only modules into
// the browser bundle.
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";

/** Minimal model shape for display purposes (subset of catalog Model). */
export interface ComposerModel {
	id: string;
	name: string;
	provider: { id: string; name: string };
}

export interface ComposerProps {
	busy: boolean;
	models: ComposerModel[];
	currentModel: ComposerModel | undefined;
	thinkingLevel: string | undefined;
	onSend(text: string, mode: "prompt" | "steer" | "followUp"): void;
	onAbort(): void;
	onSetModel(provider: string, modelId: string): void;
	onSetThinkingLevel(level: ThinkingLevel): void;
}

const THINKING_LEVELS: readonly ThinkingLevel[] = [
	ThinkingLevel.Off,
	ThinkingLevel.Minimal,
	ThinkingLevel.Low,
	ThinkingLevel.Medium,
	ThinkingLevel.High,
	ThinkingLevel.XHigh,
	ThinkingLevel.Max,
];

export function Composer({
	busy,
	models,
	currentModel,
	thinkingLevel,
	onSend,
	onAbort,
	onSetModel,
	onSetThinkingLevel,
}: ComposerProps): ReactNode {
	const [text, setText] = useState("");
	const [busyMode, setBusyMode] = useState<"steer" | "followUp">("steer");

	const trimmed = text.trim();
	const canSend = trimmed.length > 0;

	function handleSend(): void {
		if (!canSend) return;
		if (busy) {
			onSend(trimmed, busyMode);
		} else {
			onSend(trimmed, "prompt");
		}
		setText("");
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>): void {
		const selected = models.find(m => m.id === e.target.value);
		if (selected) {
			onSetModel(selected.provider.id, selected.id);
		}
	}

	return (
		<div className="sh-composer">
			<div className="sh-composer-inner">
				<textarea
					className="sh-composer-input"
					value={text}
					onChange={e => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={busy ? "steer or follow up..." : "prompt the agent..."}
					rows={1}
					spellCheck={false}
				/>
				<div className="sh-composer-actions">
					{busy && (
						<>
							<select value={busyMode} onChange={e => setBusyMode(e.target.value as "steer" | "followUp")}>
								<option value="steer">Steer</option>
								<option value="followUp">Follow-up</option>
							</select>
							<button
								type="button"
								className="sh-btn sh-btn-stop"
								onClick={onAbort}
								title="abort the current turn"
							>
								Abort
							</button>
						</>
					)}
					<button
						type="button"
						className="sh-btn sh-btn-primary"
						onClick={handleSend}
						disabled={!canSend}
						title={busy ? busyMode : "send (Enter)"}
					>
						{busy ? (busyMode === "steer" ? "Steer" : "Follow-up") : "Send"}
					</button>
				</div>
			</div>
			<div className="sh-composer-actions">
				<select value={currentModel?.id ?? ""} onChange={handleModelChange} data-testid="model-select">
					{models.map(m => (
						<option key={m.id} value={m.id}>
							{m.name}
						</option>
					))}
				</select>
				<select
					value={thinkingLevel ?? "medium"}
					onChange={e => onSetThinkingLevel(e.target.value as ThinkingLevel)}
					data-testid="thinking-select"
				>
					{THINKING_LEVELS.map(l => (
						<option key={l} value={l}>
							{l}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
