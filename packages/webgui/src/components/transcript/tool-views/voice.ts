/**
 * Detects Wren voice calls: the `wren` custom tool, and `bash` commands that
 * invoke the `wren` CLI or its curl fallback. Shared by the wren and bash
 * renderers and by the card chrome, which keeps spoken text expanded.
 */
import { isRecord } from "./util";

export interface VoiceCall {
	command: string;
	/** Spoken text for `say`; null for other commands or when not yet streamed. */
	text: string | null;
}

const WREN_COMMANDS: Record<string, true> = {
	say: true,
	stop: true,
	pause: true,
	resume: true,
	status: true,
	config: true,
};

/** Optional leading `NAME=value` assignments, then the wren binary (bare, `~/`-relative, or absolute). */
const WREN_CLI =
	/^\s*(?:[A-Za-z_]\w*=(?:'[^']*'|"(?:[^"\\]|\\.)*"|\S*)\s+)*(?:wren|~\/\.local\/bin\/wren|\/\S*\/wren)\s+(\w+)(.*)$/s;

const CURL_SPEAK = /^\s*curl\s.*localhost:8765\/speak/s;

/**
 * First shell word of `rest` with quotes removed. An unterminated quote
 * yields what has streamed so far, so partial args render while arriving.
 */
function firstShellWord(rest: string): string | null {
	let i = 0;
	while (i < rest.length && /\s/.test(rest[i]!)) i++;
	if (i >= rest.length) return null;
	let out = "";
	while (i < rest.length) {
		const c = rest[i]!;
		if (/\s/.test(c)) break;
		if (c === "'") {
			const end = rest.indexOf("'", i + 1);
			out += end < 0 ? rest.slice(i + 1) : rest.slice(i + 1, end);
			if (end < 0) break;
			i = end + 1;
		} else if (c === '"') {
			i++;
			while (i < rest.length && rest[i] !== '"') {
				if (rest[i] === "\\" && i + 1 < rest.length && /["\\$`]/.test(rest[i + 1]!)) i++;
				out += rest[i];
				i++;
			}
			i++;
		} else if (c === "\\" && i + 1 < rest.length) {
			out += rest[i + 1];
			i += 2;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

function curlText(command: string): string | null {
	const m = /\s(?:-d|--data(?:-raw)?)\s+/.exec(command);
	if (!m) return null;
	const body = firstShellWord(command.slice(m.index + m[0].length));
	if (!body) return null;
	try {
		const parsed: unknown = JSON.parse(body);
		return isRecord(parsed) && typeof parsed.text === "string" ? parsed.text : null;
	} catch {
		return null;
	}
}

/** Splits on unquoted `;`, `&&`, `||`, `|` and newlines; quotes and escapes stay inside their segment. */
function splitShellSegments(cmd: string): string[] {
	const out: string[] = [];
	let start = 0;
	let quote: "'" | '"' | null = null;
	for (let i = 0; i < cmd.length; i++) {
		const c = cmd[i]!;
		if (quote) {
			if (c === "\\" && quote === '"') i++;
			else if (c === quote) quote = null;
			continue;
		}
		if (c === "\\") {
			i++;
		} else if (c === "'" || c === '"') {
			quote = c;
		} else if (c === ";" || c === "\n" || c === "|" || (c === "&" && cmd[i + 1] === "&")) {
			out.push(cmd.slice(start, i));
			if ((c === "&" || c === "|") && cmd[i + 1] === c) i++;
			start = i + 1;
		}
	}
	out.push(cmd.slice(start));
	return out.filter(s => s.trim() !== "");
}

function bashSegmentCall(segment: string): VoiceCall | null {
	const cli = WREN_CLI.exec(segment);
	if (cli && WREN_COMMANDS[cli[1]!]) {
		const command = cli[1]!;
		return { command, text: command === "say" ? firstShellWord(cli[2]!) : null };
	}
	if (CURL_SPEAK.test(segment)) {
		const text = curlText(segment);
		return text === null ? null : { command: "say", text };
	}
	return null;
}

export function voiceCallText(toolName: string, args: Record<string, unknown>): VoiceCall | null {
	if (toolName === "wren") {
		const command = typeof args.command === "string" ? args.command : "say";
		const text = command === "say" && typeof args.text === "string" ? args.text : null;
		return { command, text };
	}
	if (toolName !== "bash" || typeof args.command !== "string") return null;
	// Models chain calls like `wren status; wren say "..."`. A chain that mixes in non-wren
	// commands stays a plain bash card, since its output matters on its own.
	const calls: VoiceCall[] = [];
	for (const segment of splitShellSegments(args.command)) {
		const call = bashSegmentCall(segment);
		if (call === null) return null;
		calls.push(call);
	}
	if (calls.length === 0) return null;
	const said = calls.filter(c => c.command === "say");
	if (said.length === 0) return calls[calls.length - 1]!;
	const texts = said.map(c => c.text).filter((t): t is string => t !== null);
	return { command: "say", text: texts.length > 0 ? texts.join(" ") : null };
}
