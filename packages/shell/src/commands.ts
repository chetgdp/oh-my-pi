/**
 * `?` argv: input -> parse -> normalize. Shell-local commands are `/a` (live
 * host), `/r [--all]` (past session) and `/n`; any other leading `/` is a host
 * slash prompt and gets no cwd preamble.
 */

export type ShellCommandKind = "prompt" | "attach" | "resume" | "new";

export interface ShellCommand {
	kind: ShellCommandKind;
	/** Prompt text from argv, merged with piped stdin; null when there is none. */
	prompt: string | null;
	/** `/r --all`: list past sessions of every project, not only the pane cwd. */
	all: boolean;
}

const SHELL_COMMANDS: Record<string, ShellCommandKind> = { "/a": "attach", "/r": "resume", "/n": "new" };

export function parseArgv(argv: readonly string[], stdin: string | null = null): ShellCommand {
	const kind = SHELL_COMMANDS[argv[0] ?? ""] ?? "prompt";
	let words = kind === "prompt" ? argv : argv.slice(1);
	const all = kind === "resume" && words[0] === "--all";
	if (all) words = words.slice(1);
	return { kind, prompt: mergeStdin(words.join(" ").trim(), stdin), all };
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
