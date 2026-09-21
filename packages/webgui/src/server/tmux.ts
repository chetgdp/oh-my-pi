import { $ } from "bun";

export type TmuxRunner = (argv: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export const runTmux: TmuxRunner = async argv => {
	const result = await $`tmux ${argv}`.quiet().nothrow();
	return {
		exitCode: result.exitCode,
		stdout: result.text(),
		stderr: result.stderr.toString(),
	};
};

/**
 * Escape a string for use inside fish single quotes.
 * Fish single quotes only need \' to represent a literal '.
 */
function fishEscape(arg: string): string {
	return "'" + arg.replace(/'/g, "\\\'") + "'";
}

/**
 * Build the argv for `tmux new-window` that launches omp in a fish shell.
 */
export function buildNewWindowArgv(cwd: string, ompArgs: string[]): string[] {
	const parts = ["omp"];
	for (const arg of ompArgs) {
		parts.push(fishEscape(arg));
	}
	const shellCommand = parts.join(" ");
	return ["tmux", "new-window", "-t", "0:", "-c", cwd, "-P", "-F", "#{window_id}", "--", "fish", "-C", shellCommand];
}

/**
 * Run `tmux new-window` via the provided runner and return the
 * trimmed window id. Throws on nonzero exit.
 */
export async function newWindow(runner: TmuxRunner, cwd: string, ompArgs: string[]): Promise<string> {
	// buildNewWindowArgv returns ["tmux", ...rest]; the runner
	// receives everything after "tmux".
	const fullArgv = buildNewWindowArgv(cwd, ompArgs);
	const argv = fullArgv.slice(1);
	const result = await runner(argv);
	if (result.exitCode !== 0) {
		throw new Error(`tmux new-window failed (exit ${result.exitCode}): ${result.stderr}`);
	}
	return result.stdout.trim();
}
