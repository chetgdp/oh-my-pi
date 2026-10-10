/**
 * Encode/output side of a turn. stdout carries only the final assistant text;
 * every other line (spinner, tool starts, notices) goes to stderr.
 */

import { advance, initialState, type Rng, renderDumb, renderLine, type SpinnerState } from "./spinner";

/** Joined text blocks of an assistant message; null for other roles or no text. */
export function assistantText(message: unknown): string | null {
	if (typeof message !== "object" || message === null) return null;
	const m = message as Record<string, unknown>;
	if (m.role !== "assistant") return null;
	if (typeof m.content === "string") return m.content.length > 0 ? m.content : null;
	if (!Array.isArray(m.content)) return null;
	const parts: string[] = [];
	for (const block of m.content) {
		if (typeof block !== "object" || block === null) continue;
		const b = block as Record<string, unknown>;
		if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
	}
	const text = parts.join("");
	return text.trim().length > 0 ? text : null;
}

/** Text of the last assistant message that has any, scanning from the end. */
export function finalAssistantText(messages: readonly unknown[]): string | null {
	for (let index = messages.length - 1; index >= 0; index--) {
		const text = assistantText(messages[index]);
		if (text !== null) return text;
	}
	return null;
}

const SPINNER_TICK_MS = 100;
/** Fast tools finish before this; deferring the first frame avoids a flash. */
const FIRST_FRAME_DELAY_MS = 180;
const TOOL_LINE_MAX = 120;
const TOOL_RESULT_LINES = 8;

export interface ChromeOptions {
	tty?: boolean;
	dumb?: boolean;
	now?: () => number;
	rng?: Rng;
	columns?: () => number;
	write?: (text: string) => void;
}

/** Kaomoji spinner and tool lines on stderr; the spinner runs only when stderr is a terminal. */
export class Chrome {
	readonly #tty: boolean;
	readonly #dumb: boolean;
	readonly #now: () => number;
	readonly #rng: Rng;
	readonly #columns: () => number;
	readonly #write: (text: string) => void;
	#timer: NodeJS.Timeout | null = null;
	#state: SpinnerState | null = null;
	#shownAt = 0;
	/** Last text drawn on the spinner line; empty when the line is clear. */
	#drawn = "";
	#label = "thinking";

	constructor(tty: boolean | ChromeOptions = process.stderr.isTTY === true) {
		const options: ChromeOptions = typeof tty === "boolean" ? { tty } : tty;
		this.#tty = options.tty ?? process.stderr.isTTY === true;
		this.#dumb = options.dumb ?? Bun.env.TERM === "dumb";
		this.#now = options.now ?? Date.now;
		this.#rng = options.rng ?? Math.random;
		this.#columns = options.columns ?? (() => process.stderr.columns || 80);
		this.#write = options.write ?? (text => process.stderr.write(text));
	}

	start(): void {
		if (!this.#tty || this.#timer) return;
		const now = this.#now();
		// State persists across stop/start (dialogs) so elapsed time and the face carry over.
		this.#state ??= initialState(now, this.#rng);
		this.#shownAt = now + FIRST_FRAME_DELAY_MS;
		this.#timer = setInterval(() => this.#draw(), SPINNER_TICK_MS);
	}

	stop(): void {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
		this.#clear();
	}

	tool(name: string, args: unknown): void {
		let line = `· ${name}`;
		const summary = summarizeArgs(args);
		if (summary.length > 0) line += ` ${summary}`;
		if (line.length > TOOL_LINE_MAX) line = `${line.slice(0, TOOL_LINE_MAX - 1)}…`;
		this.line(line);
		this.#label = name;
	}

	/** One full line on stderr, clearing the spinner first. */
	line(text: string): void {
		this.#clear();
		this.#write(`${text}\n`);
	}

	/** Up to TOOL_RESULT_LINES of a tool result under its tool line; red when it failed. */
	toolResult(result: unknown, isError: boolean): void {
		const text = toolResultText(result);
		if (text === null) return;
		const lines = text.replace(/\n+$/, "").split("\n");
		const width = Math.max(20, this.#columns() - 1);
		const style = !this.#tty ? "" : isError ? "\x1b[31m" : "\x1b[2m";
		const reset = this.#tty ? "\x1b[0m" : "";
		const shown = Math.min(lines.length, TOOL_RESULT_LINES);
		for (let index = 0; index < shown; index++) {
			// Tool output is untrusted: strip escapes/control bytes so it cannot drive the terminal.
			const clean = lines[index].replaceAll("\t", "    ").replace(/[\x00-\x1f\x7f\x9b]/g, "");
			const cut = Bun.stringWidth(clean) > width - 4 ? `${sliceWidth(clean, width - 5)}…` : clean;
			this.line(`${style}  ${cut}${reset}`);
		}
		if (lines.length > shown) this.line(`${style}  … ${lines.length - shown} more lines${reset}`);
	}

	#clear(): void {
		if (this.#drawn.length === 0) return;
		this.#write(this.#dumb ? "\n" : "\r\x1b[2K");
		this.#drawn = "";
	}

	/** Exposed for tests: one timer tick. */
	tick(): void {
		this.#draw();
	}

	#draw(): void {
		const state = this.#state;
		if (!state) return;
		const now = this.#now();
		if (now < this.#shownAt) return;
		const next = advance(state, now, this.#rng);
		this.#state = next;
		if (this.#dumb) {
			const text = renderDumb(next, now);
			if (text === this.#drawn) return;
			// Append-only: emit just what is new since the last draw.
			this.#write(text.startsWith(this.#drawn) ? text.slice(this.#drawn.length) : `\n${text}`);
			this.#drawn = text;
			return;
		}
		const text = renderLine(next, now, this.#label, this.#columns());
		if (text === this.#drawn) return;
		this.#write(`\r${text}\x1b[K`);
		this.#drawn = text;
	}
}

/** First string argument of a tool call, single-lined; the most telling field for every builtin. */
function summarizeArgs(args: unknown): string {
	if (typeof args !== "object" || args === null) return "";
	for (const key of ["command", "path", "pattern", "query", "url"]) {
		const value = (args as Record<string, unknown>)[key];
		if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
	}
	return "";
}

/** Joined text blocks of a tool result `{content: [{type:"text", text}]}`; null when it has none. */
function toolResultText(result: unknown): string | null {
	if (typeof result !== "object" || result === null) return null;
	const content = (result as Record<string, unknown>).content;
	if (!Array.isArray(content)) return null;
	const parts: string[] = [];
	for (const block of content) {
		if (typeof block !== "object" || block === null) continue;
		const b = block as Record<string, unknown>;
		if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
	}
	const text = parts.join("\n");
	return text.trim().length > 0 ? text : null;
}

/** Longest prefix of `text` that fits in `width` terminal cells. */
function sliceWidth(text: string, width: number): string {
	let out = "";
	for (const char of text) {
		if (Bun.stringWidth(out + char) > width) break;
		out += char;
	}
	return out;
}
