import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { TranscriptState } from "./transcript-model";

/**
 * Extract plain text from an AgentMessage.
 */
function extractMessageText(message: AgentMessage): string {
	if (typeof message !== "object" || message === null) return "";
	if ("content" in message) {
		const content = message.content;
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			const texts: string[] = [];
			for (const block of content) {
				if (typeof block === "object" && block !== null && "type" in block) {
					if (block.type === "text" && "text" in block && typeof block.text === "string") {
						texts.push(block.text);
					}
				}
			}
			return texts.join("\n");
		}
	}
	return "";
}

/**
 * Deduplicate consecutive identical items in an array.
 */
export function dedupeConsecutive(items: readonly string[]): string[] {
	const result: string[] = [];
	for (const item of items) {
		if (result.length === 0 || result[result.length - 1] !== item) {
			result.push(item);
		}
	}
	return result;
}

/**
 * Extract past user prompts from finished session entries and pending user messages.
 * Returns prompts in oldest..newest order, consecutive duplicates collapsed.
 */
export function extractUserPrompts(state: Pick<TranscriptState, "entries" | "pendingUser">): string[] {
	const raw: string[] = [];

	for (const entry of state.entries) {
		if (entry.type === "message" && entry.message.role === "user") {
			const text = extractMessageText(entry.message);
			if (text.length > 0) {
				raw.push(text);
			}
		}
	}

	for (const pending of state.pendingUser) {
		if (pending.text.length > 0) {
			raw.push(pending.text);
		}
	}

	return dedupeConsecutive(raw);
}

export interface PromptHistoryNavigator {
	/** Current 0-based index in history, or history.length when at the draft. */
	readonly index: number;
	/** The unsent draft text when navigation started or was edited. */
	readonly draft: string;
	/**
	 * Step up (older) in history.
	 * If currently at draft, saves currentText as the new draft.
	 * Returns the recalled prompt text (or currentText if history is empty).
	 */
	stepUp(currentText: string): string;
	/**
	 * Step down (newer) in history.
	 * If stepping past newest, returns the saved draft.
	 */
	stepDown(): string;
	/**
	 * Reset navigator to draft semantics when the recalled text is edited.
	 * The edited text becomes the draft.
	 */
	onEdit(editedText: string): void;
	/**
	 * Reset navigator completely (e.g. on send or draft clear).
	 */
	reset(): void;
}

export function createPromptHistoryNavigator(getHistory: () => readonly string[]): PromptHistoryNavigator {
	let index = -1; // -1 indicates at-draft (not navigating)
	let draft = "";

	return {
		get index(): number {
			const history = getHistory();
			return index === -1 ? history.length : index;
		},
		get draft(): string {
			return draft;
		},
		stepUp(currentText: string): string {
			const history = getHistory();
			if (history.length === 0) {
				return currentText;
			}

			if (index === -1) {
				draft = currentText;
				index = history.length - 1;
				return history[index]!;
			}

			if (index > 0) {
				index -= 1;
				return history[index]!;
			}

			// Boundary: at oldest entry (0), no-op
			return history[0]!;
		},
		stepDown(): string {
			const history = getHistory();
			if (index === -1) {
				// Already at draft
				return draft;
			}

			if (index < history.length - 1) {
				index += 1;
				return history[index]!;
			}

			// Stepping past newest: restore draft
			index = -1;
			return draft;
		},
		onEdit(editedText: string): void {
			draft = editedText;
			index = -1;
		},
		reset(): void {
			draft = "";
			index = -1;
		},
	};
}

/**
 * Caret position detection helpers for multiline textareas.
 * Returns true if caret is on the first line (ArrowUp candidate).
 */
export function isCaretOnFirstLine(text: string, selectionStart: number): boolean {
	const clamped = Math.max(0, Math.min(selectionStart, text.length));
	const prevNewline = text.lastIndexOf("\n", clamped - 1);
	return prevNewline === -1;
}

/**
 * Returns true if caret is on the last line (ArrowDown candidate).
 */
export function isCaretOnLastLine(text: string, selectionEnd: number): boolean {
	const clamped = Math.max(0, Math.min(selectionEnd, text.length));
	const nextNewline = text.indexOf("\n", clamped);
	return nextNewline === -1;
}
