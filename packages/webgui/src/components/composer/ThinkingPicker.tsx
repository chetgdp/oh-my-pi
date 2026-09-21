import { useEffect } from "react";
import type { ReactNode } from "react";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";

const LEVELS: readonly ThinkingLevel[] = [
	ThinkingLevel.Off,
	ThinkingLevel.Minimal,
	ThinkingLevel.Low,
	ThinkingLevel.Medium,
	ThinkingLevel.High,
	ThinkingLevel.XHigh,
	ThinkingLevel.Max,
];

export interface ThinkingPickerProps {
	open: boolean;
	current?: ThinkingLevel;
	onPick(level: ThinkingLevel): void;
	onClose(): void;
}

export function ThinkingPicker({ open, current, onPick, onClose }: ThinkingPickerProps): ReactNode {
	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent): void {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		}
		const win = globalThis as unknown as {
			addEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
			removeEventListener(t: string, fn: (e: KeyboardEvent) => void): void;
		};
		win.addEventListener("keydown", handleKey);
		return () => win.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<>
			<div className="cmp-picker-backdrop" onClick={onClose} />
			<div className="cmp-picker cmp-thinking-picker" role="dialog" aria-label="Thinking level">
				<div className="cmp-picker-header">
					<span className="cmp-picker-title">Thinking</span>
				</div>
				<div className="cmp-picker-list">
					{LEVELS.map(level => (
						<button
							key={level}
							type="button"
							className={"cmp-picker-row" + (current === level ? " cmp-picker-current" : "")}
							onClick={() => {
								onPick(level);
								onClose();
							}}
						>
							{level}
							{current === level && (
								<span className="cmp-picker-check" aria-label="current">
									&#10003;
								</span>
							)}
						</button>
					))}
				</div>
			</div>
		</>
	);
}
