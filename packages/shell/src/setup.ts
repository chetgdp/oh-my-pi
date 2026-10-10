/**
 * `omp-shell --setup [--dry-run]` / `omp-shell --uninstall [--dry-run]`.
 *
 * Installs the `?` binding for fish, bash and zsh, replacing any giverny
 * install. Only shells whose config already exists are touched.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { removeBlocks, upsertBlock } from "./rc-block";

export const FISH_FUNCTION = "function '?' --description 'omp shell mode'\n    omp-shell $argv\nend\n";

// `set -f` runs before the arguments are globbed; the helper restores it.
export const BASH_BODY = ["set +H", '_omp_shell() { set +f; omp-shell "$@"; }', "alias '?'='set -f; _omp_shell'"].join(
	"\n",
);

export const ZSH_BODY = "alias '?'='noglob omp-shell'";

export interface SetupOptions {
	home: string;
	dryRun: boolean;
	uninstall: boolean;
}

export interface Change {
	file: string;
	/** null = delete file */
	content: string | null;
}

function readOrNull(file: string): string | null {
	try {
		return fs.readFileSync(file, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw err;
	}
}

/** Compute the file changes; no writes. */
export function planSetup(opts: SetupOptions): Change[] {
	const changes: Change[] = [];

	for (const [name, body] of [
		[".bashrc", BASH_BODY],
		[".zshrc", ZSH_BODY],
	] as const) {
		const file = path.join(opts.home, name);
		const current = readOrNull(file);
		if (current === null) continue;
		const next = opts.uninstall ? removeBlocks(current) : upsertBlock(current, body);
		if (next !== current) changes.push({ file, content: next });
	}

	const fishDir = path.join(opts.home, ".config", "fish");
	if (fs.existsSync(fishDir)) {
		const file = path.join(fishDir, "functions", "?.fish");
		const current = readOrNull(file);
		const ours = current !== null && /\b(omp-shell|giverny)\b/.test(current);
		if (opts.uninstall) {
			if (ours) changes.push({ file, content: null });
		} else if (current === null || (ours && current !== FISH_FUNCTION)) {
			changes.push({ file, content: FISH_FUNCTION });
		} else if (!ours) {
			throw new Error(`${file} exists and is not managed by omp-shell or giverny; remove it first`);
		}
	}
	return changes;
}

export function applyChanges(changes: Change[]): void {
	for (const change of changes) {
		if (change.content === null) {
			fs.rmSync(change.file, { force: true });
			continue;
		}
		fs.mkdirSync(path.dirname(change.file), { recursive: true });
		fs.writeFileSync(change.file, change.content);
	}
}

/** CLI entry; returns process exit code. */
export function runSetup(argv: string[], home: string = os.homedir()): number {
	const opts: SetupOptions = {
		home,
		dryRun: argv.includes("--dry-run"),
		uninstall: argv.includes("--uninstall"),
	};
	let changes: Change[];
	try {
		changes = planSetup(opts);
	} catch (err) {
		process.stderr.write(`omp-shell: ${(err as Error).message}\n`);
		return 1;
	}
	if (changes.length === 0) {
		process.stderr.write("omp-shell: nothing to change\n");
		return 0;
	}
	for (const change of changes) {
		const verb = change.content === null ? "remove" : "write";
		process.stderr.write(`${opts.dryRun ? "would " : ""}${verb} ${change.file}\n`);
	}
	if (!opts.dryRun) applyChanges(changes);
	if (!opts.dryRun && !opts.uninstall) process.stderr.write("open a new shell (or source your rc file) to use ?\n");
	return 0;
}
