/**
 * `?` argv: input -> parse -> normalize. Shell-local commands are `/a` (live
 * host), `/r [--all]` (past session), `/new` (`/n`) and `/last` (`/l`); any other
 * leading `/` is a host slash prompt; `/status` (`/st`) prints settings and the attached session and gets no cwd preamble. `/a`, `/r` and
 * `/new` take one follow-up: a prompt, a host slash prompt, or `/last`. A prompt
 * steers a busy session like TUI Enter; a leading `/f` queues it as a follow-up.
 * `/a --id <id>` and `/r --id <id>` name the session by id (or a unique prefix)
 * instead of opening the picker; `--id` without a value is a usage error.
 * `/plan [prompt]` toggles plan mode over RPC (the host's `/plan` is TUI-only);
 * `/export [N|--html [path]]` prints the transcript or has the host write HTML;
 * `/diff [instruction]` prompts with the pane cwd's uncommitted diff.
 * `/perms` picks the session's approval mode; a leading `--ask`, `--ask-cached`,
 * `--write` or `--yolo` sets it, then sends the rest (if any) as a prompt.
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
	| "perms";

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
	/** `/a --id <id>`, `/r --id <id>`: session id or unique prefix; "" when `--id` had no value. */
	sessionId?: string;
	/** Leading mode flag: set this approval mode before the prompt (none: only set it). */
	mode?: ApprovalMode;
}

const SHELL_COMMANDS: Record<string, ShellCommandKind> = {
	"/a": "attach",
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
};

/** Short names the shell expands before a host slash command is sent. */
const HOST_ALIASES: Record<string, string> = { "/u": "/usage", "/m": "/model", "/c": "/clear" };

export function parseArgv(argv: readonly string[], stdin: string | null = null): ShellCommand {
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
	if (kind === "last" || kind === "status" || kind === "perms") return { kind, prompt: null, all: false };
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
	const followUp = words[0] === "/f";
	if (followUp) words = words.slice(1);
	const alias = HOST_ALIASES[words[0] ?? ""];
	if (alias) words = [alias, ...words.slice(1)];
	const all = kind === "resume" && !followUp && sessionId === undefined && words[0] === "--all";
	if (all) words = words.slice(1);
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
