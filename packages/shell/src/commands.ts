/**
 * `?` argv: input -> parse -> normalize. Shell-local commands are `/a` (live
 * host), `/r [--all]` (past session), `/new` (`/n`) and `/last` (`/l`); any other
 * leading `/` is a host slash prompt; `/status` (`/st`) prints settings and the attached session and gets no cwd preamble. `/a`, `/r` and
 * `/new` take one follow-up: a prompt, a host slash prompt, or `/last`. A prompt
 * steers a busy session like TUI Enter; a leading `/f` queues it as a follow-up.
 * Bare `/a` into a running turn prints its last tool calls and streams it to `agent_end`.
 * `/a --id <id>` and `/r --id <id>` name the session by id (or a unique prefix)
 * instead of opening the picker; `--id` without a value is a usage error.
 * `/plan [prompt]` toggles plan mode over RPC (the host's `/plan` is TUI-only);
 * `/export [N|--html [path]]` prints the transcript or has the host write HTML;
 * `/diff [instruction]` prompts with the pane cwd's uncommitted diff.
 * `/perms` picks the session's approval mode; a leading `--ask`, `--ask-cached`,
 * `--write` or `--yolo` sets it, then sends the rest (if any) as a prompt.
 * `/sub` binds the pane to a running subagent; `/main` clears that binding.
 * Chains: leading `/l`, `/m <model>` and mode flags run left to right before the
 * prompt (`? /l /m opus-5.5 fix the bug`); a single step keeps its single form.
 */

export type ShellCommandKind =
	| "prompt"
	| "attach"
	| "resume"
	| "new"
	| "last"
	| "output"
	| "status"
	| "plan"
	| "diff"
	| "export"
	| "perms"
	| "stop"
	| "help"
	| "tools"
	| "sub"
	| "main";

export const APPROVAL_MODES = ["always-ask", "always-ask-cached", "write", "yolo"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

/** Approval mode flags; only the first argv word counts, elsewhere they are prompt text. */
const MODE_FLAGS: Record<string, ApprovalMode> = {
	"--ask": "always-ask",
	"--ask-cached": "always-ask-cached",
	"--write": "write",
	"--yolo": "yolo",
};

export interface ShellCommand {
	kind: ShellCommandKind;
	/** Prompt text from argv, merged with piped stdin; null when there is none, and always for `/last`. For `/output`, its argument; for `/diff`, the instruction without stdin. */
	prompt: string | null;
	/** `/r --all`: list past sessions of every project, not only the pane cwd. */
	all: boolean;
	/** `/a /l`, `/r /l`, `/n /l`: after attaching, print the session's last reply instead of prompting. */
	last?: true;
	/** `/f`: queue behind the running turn instead of steering it. */
	followUp?: true;
	/** `/a --id <id>`, `/r --id <id>`, `/stop --id <id>`: session id or unique prefix; "" when `--id` had no value. */
	sessionId?: string;
	/** Leading mode flag: set this approval mode before the prompt (none: only set it). */
	mode?: ApprovalMode;
	/** Chain steps run in order before the prompt, on one connection. */
	steps?: ChainStep[];
	/** Malformed chain (`/m` without a model): usage error. */
	usage?: true;
	/** `/new --omem`: start the host in omem memory mode. */
	omem?: true;
}

/** One chain step: print the last reply, switch model, or set the approval mode. */
export type ChainStep = { kind: "last" } | { kind: "model"; model: string } | { kind: "mode"; mode: ApprovalMode };

const LAST_WORDS: Record<string, true> = { "/l": true, "/last": true };

function isStepWord(word: string | undefined): boolean {
	return word !== undefined && (LAST_WORDS[word] === true || word === "/m" || MODE_FLAGS[word] !== undefined);
}

/**
 * Leading chain steps of `words`. A chain needs two steps, or `/l` or `/m <model>` plus
 * a prompt; anything less is null so the single forms (`? /m opus`, `? --write x`) stay.
 * `/m` without a model after an earlier step is a usage error.
 */
function parseChain(words: readonly string[]): { steps: ChainStep[]; rest: string[] } | "usage" | null {
	const steps: ChainStep[] = [];
	let i = 0;
	for (; i < words.length; i++) {
		const word = words[i]!;
		if (LAST_WORDS[word]) steps.push({ kind: "last" });
		else if (MODE_FLAGS[word]) steps.push({ kind: "mode", mode: MODE_FLAGS[word] });
		else if (word === "/m") {
			const model = words[i + 1];
			if (model === undefined || model === "/f" || isStepWord(model)) return steps.length > 0 ? "usage" : null;
			steps.push({ kind: "model", model });
			i++;
		} else break;
	}
	const rest = words.slice(i);
	if (steps.length >= 2 || (steps.length === 1 && rest.length > 0 && steps[0]!.kind !== "mode"))
		return { steps, rest };
	return null;
}

/** The chain form of a command, or null when `words` is not a chain. */
function chainCommand(
	kind: ShellCommandKind,
	words: readonly string[],
	stdin: string | null,
	extra: Pick<ShellCommand, "all" | "sessionId">,
): ShellCommand | null {
	const chain = parseChain(words);
	if (chain === null) return null;
	const id = extra.sessionId === undefined ? {} : { sessionId: extra.sessionId };
	if (chain === "usage") return { kind, prompt: null, all: extra.all, usage: true, ...id };
	const followUp = chain.rest[0] === "/f";
	const prompt = mergeStdin((followUp ? chain.rest.slice(1) : chain.rest).join(" ").trim(), stdin);
	const base = { kind, prompt, all: extra.all, steps: chain.steps, ...id };
	return followUp ? { ...base, followUp } : base;
}

const SHELL_COMMANDS: Record<string, ShellCommandKind> = {
	"/attach": "attach",
	"/a": "attach",
	"/resume": "resume",
	"/r": "resume",
	"/new": "new",
	"/n": "new",
	"/last": "last",
	"/l": "last",
	"/output": "output",
	"/status": "status",
	"/st": "status",
	"/plan": "plan",
	"/diff": "diff",
	"/export": "export",
	"/perms": "perms",
	"/stop": "stop",
	"/help": "help",
	"/h": "help",
	"/tools": "tools",
	"/sub": "sub",
	"/main": "main",
};

/** Short names the shell expands before a host slash command is sent. */
const HOST_ALIASES: Record<string, string> = { "/u": "/usage", "/m": "/model", "/c": "/clear" };

const COMMAND_WORDS: Record<string, true> = Object.fromEntries(
	[
		...Object.keys(SHELL_COMMANDS),
		...Object.keys(HOST_ALIASES),
		...Object.keys(MODE_FLAGS),
		"/f",
		"--all",
		"--omem",
		"--id",
	].map(word => [word, true]),
);
/** Command words whose next word is a value, kept as typed: `/m <model>`, `--id <session>`. */
const VALUE_WORDS: Record<string, true> = { "/m": true, "--id": true };

/**
 * Lowercases the leading command words (`? /SUB`, `? /A /L`). Stops at the first other
 * word, so prompt text, model names and session ids keep their case.
 */
function normalizeCommandWords(argv: readonly string[]): string[] {
	const words = [...argv];
	for (let i = 0; i < words.length; i++) {
		const lower = words[i]!.toLowerCase();
		if (!COMMAND_WORDS[lower]) break;
		words[i] = lower;
		if (VALUE_WORDS[lower]) i++;
	}
	return words;
}

export function parseArgv(rawArgv: readonly string[], stdin: string | null = null): ShellCommand {
	const argv = normalizeCommandWords(rawArgv);
	const chained = chainCommand("prompt", argv, stdin, { all: false });
	if (chained) return chained;
	const mode = MODE_FLAGS[argv[0] ?? ""];
	if (mode) {
		const rest = argv.slice(1);
		const words = rest[0] === "/f" ? rest.slice(1) : rest;
		const alias = HOST_ALIASES[words[0] ?? ""];
		const prompt = mergeStdin((alias ? [alias, ...words.slice(1)] : words).join(" ").trim(), stdin);
		return rest[0] === "/f"
			? { kind: "prompt", prompt, all: false, followUp: true, mode }
			: { kind: "prompt", prompt, all: false, mode };
	}
	const kind = SHELL_COMMANDS[argv[0] ?? ""] ?? "prompt";
	if (
		kind === "last" ||
		kind === "status" ||
		kind === "perms" ||
		kind === "help" ||
		kind === "tools" ||
		kind === "sub" ||
		kind === "main"
	)
		return { kind, prompt: null, all: false };
	if (kind === "stop") {
		const rest = argv.slice(1);
		if (rest.length === 0) return { kind, prompt: null, all: false };
		if (rest[0] === "--id" && rest.length <= 2)
			return { kind, prompt: null, all: false, sessionId: rest[1]?.trim() ?? "" };
		return { kind, prompt: null, all: false, usage: true };
	}
	if (kind === "export") return { kind, prompt: argv.slice(1).join(" ").trim() || null, all: false };
	if (kind === "diff") return { kind, prompt: argv.slice(1).join(" ").trim() || null, all: false };
	if (kind === "plan") return { kind, prompt: mergeStdin(argv.slice(1).join(" ").trim(), stdin), all: false };
	if (kind === "output") return { kind, prompt: argv.slice(1).join(" ").trim() || null, all: false };
	let words = kind === "prompt" ? argv : argv.slice(1);
	let sessionId: string | undefined;
	if ((kind === "attach" || kind === "resume") && words[0] === "--id") {
		sessionId = words[1]?.trim() ?? "";
		words = words.slice(2);
	}
	const all = kind === "resume" && sessionId === undefined && words[0] === "--all";
	if (all) words = words.slice(1);
	const omem = kind === "new" && words[0] === "--omem";
	if (omem) words = words.slice(1);
	if (omem) {
		const inner = parseArgv(["/new", ...words], stdin);
		return { ...inner, omem: true };
	}
	if (kind !== "prompt") {
		const chainedAfter = chainCommand(kind, words, stdin, { all, sessionId });
		if (chainedAfter) return chainedAfter;
	}
	const followUp = words[0] === "/f";
	if (followUp) words = words.slice(1);
	const alias = HOST_ALIASES[words[0] ?? ""];
	if (alias) words = [alias, ...words.slice(1)];
	const id = sessionId === undefined ? {} : { sessionId };
	if (kind !== "prompt" && !followUp && SHELL_COMMANDS[words[0] ?? ""] === "last") {
		return { kind, prompt: null, all, last: true, ...id };
	}
	const prompt = mergeStdin(words.join(" ").trim(), stdin);
	return followUp ? { kind, prompt, all, followUp, ...id } : { kind, prompt, all, ...id };
}

/** `/export` arguments: a markdown transcript (all turns, or the last `turns`), or host HTML at `path`. */
export type ExportRequest = { html: false; turns?: number } | { html: true; path?: string };

/** Null for a usage error: N must be a positive integer, `--html` takes at most one path and no N. */
export function parseExportArgs(arg: string | null): ExportRequest | null {
	const words = arg?.split(/\s+/).filter(Boolean) ?? [];
	if (words[0] === "--html") {
		if (words.length > 2) return null;
		const path = words[1];
		if (path !== undefined && /^\d+$/.test(path)) return null;
		return path === undefined ? { html: true } : { html: true, path };
	}
	if (words.length === 0) return { html: false };
	if (words.length > 1 || !/^\d+$/.test(words[0]!)) return null;
	const turns = Number(words[0]);
	return turns > 0 && Number.isSafeInteger(turns) ? { html: false, turns } : null;
}

/** Piped stdin is appended after a blank line; stdin alone becomes the prompt. */
export function mergeStdin(prompt: string, stdin: string | null): string | null {
	const piped = stdin?.replace(/\s+$/, "") ?? "";
	if (piped.length === 0) return prompt.length > 0 ? prompt : null;
	if (prompt.length === 0) return piped;
	return `${prompt}\n\n${piped}`;
}

/** Reads stdin to EOF when it is not a terminal; null for an interactive stdin. */
export async function readPipedStdin(): Promise<string | null> {
	if (process.stdin.isTTY) return null;
	return await Bun.stdin.text();
}
