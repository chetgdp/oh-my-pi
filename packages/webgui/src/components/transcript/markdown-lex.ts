import type { Token, TokensList } from "@oh-my-pi/pi-utils/marked";

/**
 * Stable-prefix lexing for streamed markdown. Blocks that end before the last
 * blank-line-separated block cannot change when text is appended, so their
 * tokens are kept and only the tail is re-lexed.
 */
export interface LexState {
	/** Raw source of the retained tokens (always a prefix of the last text). */
	prefix: string;
	/** Retained tokens; their raws concatenate to `prefix`. */
	tokens: Token[];
}

export function createLexState(): LexState {
	return { prefix: "", tokens: [] };
}

function count(haystack: string, needle: string): number {
	let n = 0;
	for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) n++;
	return n;
}

/** A token that may open a math block a later delimiter would close. */
function opensMath(token: Token): boolean {
	if (token.type === "math" || token.type === "code") return false;
	const raw = token.raw;
	return count(raw, "$$") % 2 === 1 || count(raw, "\\[") > count(raw, "\\]");
}

function hasLinks(tokens: TokensList): boolean {
	for (const _ in tokens.links) return true;
	return false;
}

/** Lexes `text`, reusing `state`'s retained prefix tokens when safe, and advances `state`. */
export function lexIncremental(text: string, state: LexState, lex: (src: string) => TokensList): TokensList {
	let tokens: TokensList;
	let kept = 0;
	const tail = text.slice(state.prefix.length);
	if (state.tokens.length > 0 && text.startsWith(state.prefix) && !tail.includes("\r") && !tail.includes("\t")) {
		const tailTokens = lex(tail);
		if (hasLinks(tailTokens)) {
			tokens = lex(text);
		} else {
			kept = state.tokens.length;
			tokens = state.tokens.concat(tailTokens) as TokensList;
			tokens.links = tailTokens.links;
		}
	} else {
		tokens = lex(text);
	}
	if (hasLinks(tokens) || text.includes("\r") || text.includes("\t")) {
		state.prefix = "";
		state.tokens = [];
		return tokens;
	}
	// Last non-space block that follows a blank line: everything before it is stable.
	let boundary = 0;
	for (let i = tokens.length - 1; i > 0; i--) {
		if (tokens[i].type !== "space" && tokens[i - 1].type === "space") {
			boundary = i;
			break;
		}
	}
	// Retain whole blank-line-terminated runs, never past a token that could still open a math block.
	let end = kept;
	for (let i = kept; i < boundary; i++) {
		if (opensMath(tokens[i])) break;
		if (tokens[i].type === "space") end = i + 1;
	}
	let prefix = kept === 0 ? "" : state.prefix;
	for (let i = kept; i < end; i++) prefix += tokens[i].raw;
	state.prefix = prefix;
	state.tokens = tokens.slice(0, end);
	return tokens;
}
