import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface SlashAutocompleteProps {
	matches: readonly RpcAvailableSlashCommand[];
	index: number;
	onSelect(name: string): void;
}

export function matchingCommands(
	text: string,
	commands: readonly RpcAvailableSlashCommand[],
): readonly RpcAvailableSlashCommand[] {
	if (!text.startsWith("/") || text.includes(" ")) return [];
	const prefix = text.slice(1).toLowerCase();
	return commands.filter(c => c.name.toLowerCase().startsWith(prefix));
}

export interface SlashKey {
	key: string;
	shiftKey: boolean;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	isComposing: boolean;
	/** Caret is collapsed at the end of the draft. */
	caretAtEnd: boolean;
}

export type SlashKeyAction = { type: "move"; index: number } | { type: "accept" } | { type: "dismiss" };

/** Keys the open menu claims from the composer, matching the TUI editor's autocomplete. */
export function slashKeyAction(k: SlashKey, index: number, count: number): SlashKeyAction | null {
	if (count === 0 || k.isComposing || k.altKey || k.ctrlKey || k.metaKey) return null;
	switch (k.key) {
		case "ArrowDown":
			return { type: "move", index: (index + 1) % count };
		case "ArrowUp":
			return { type: "move", index: (index - 1 + count) % count };
		case "PageDown":
			return { type: "move", index: count - 1 };
		case "PageUp":
			return { type: "move", index: 0 };
		case "Tab":
			return k.shiftKey ? null : { type: "accept" };
		case "Enter":
			return k.shiftKey ? null : { type: "accept" };
		case "ArrowRight":
			return k.caretAtEnd && !k.shiftKey ? { type: "accept" } : null;
		case "Escape":
			return { type: "dismiss" };
		default:
			return null;
	}
}

export function SlashAutocomplete({ matches, index, onSelect }: SlashAutocompleteProps): ReactNode {
	const activeRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		activeRef.current?.scrollIntoView?.({ block: "nearest" });
	}, [index]);

	if (matches.length === 0) return null;

	return (
		<div className="cmp-slash" role="listbox">
			{matches.map((cmd, i) => (
				<button
					key={cmd.name}
					ref={i === index ? activeRef : undefined}
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
