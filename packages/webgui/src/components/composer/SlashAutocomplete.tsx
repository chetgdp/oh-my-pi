import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface SlashAutocompleteProps {
	text: string;
	commands: readonly RpcAvailableSlashCommand[];
	onSelect(name: string): void;
	onDismiss(): void;
}

export function matchingCommands(
	text: string,
	commands: readonly RpcAvailableSlashCommand[],
): readonly RpcAvailableSlashCommand[] {
	if (!text.startsWith("/") || text.includes(" ")) return [];
	const prefix = text.slice(1).toLowerCase();
	return commands.filter(c => c.name.toLowerCase().startsWith(prefix));
}

export function SlashAutocomplete({ text, commands, onSelect, onDismiss }: SlashAutocompleteProps): ReactNode {
	const matches = matchingCommands(text, commands);
	const [index, setIndex] = useState(0);

	// Reset index when matches change
	useEffect(() => {
		setIndex(0);
	}, [matches.length]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (matches.length === 0) return;
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setIndex(i => (i + 1) % matches.length);
					break;
				case "ArrowUp":
					e.preventDefault();
					setIndex(i => (i - 1 + matches.length) % matches.length);
					break;
				case "Enter":
				case "Tab":
					e.preventDefault();
					onSelect(matches[index].name);
					break;
				case "Escape":
					e.preventDefault();
					onDismiss();
					break;
			}
		},
		[matches, index, onSelect, onDismiss],
	);

	if (matches.length === 0) return null;

	return (
		<div
			className="cmp-slash"
			role="listbox"
			onKeyDownCapture={handleKeyDown as unknown as React.KeyboardEventHandler}
		>
			{matches.map((cmd, i) => (
				<button
					key={cmd.name}
					type="button"
					role="option"
					className={"cmp-slash-item" + (i === index ? " cmp-slash-active" : "")}
					aria-selected={i === index}
					onMouseDown={e => e.preventDefault()}
					onClick={() => onSelect(cmd.name)}
				>
					<span className="cmp-slash-name">/{cmd.name}</span>
					{cmd.description && <span className="cmp-slash-desc">{cmd.description}</span>}
				</button>
			))}
		</div>
	);
}
