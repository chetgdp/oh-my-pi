/**
 * `omp-shell --setup [--alias <name>]... [--shell fish|bash|zsh]... [--dry-run]`
 * `omp-shell --uninstall [--shell fish|bash|zsh]... [--dry-run]`
 *
 * On a terminal, setup asks for the alias names, then which shells, then confirms the
 * planned file writes. `--alias`/`--shell` skip the prompts and the confirmation.
 * Only shells whose config already exists are touched.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { $which } from "@oh-my-pi/pi-utils";
import { GIVERNY_MARKERS, type Markers, OMP_MARKERS, removeBlocks, upsertBlock } from "./rc-block";
import { promptLine, runChecklist } from "./tty-ui";

export type ShellName = "fish" | "bash" | "zsh";

export const DEFAULT_ALIAS = "?";

const SHELL_NAMES: readonly ShellName[] = ["fish", "bash", "zsh"];

const SETUP_USAGE =
	"usage: omp-shell --setup [--alias <name>]... [--shell fish|bash|zsh]... [--dry-run] | omp-shell --uninstall [--shell fish|bash|zsh]... [--dry-run]";

/** fish autoloads a function from functions/<name>.fish, so the file name is the alias. */
export function fishFunction(alias: string): string {
	return `function '${alias}' --description 'omp shell mode'\n    omp-shell $argv\nend\n`;
}

// `set -f` runs before the arguments are globbed; the helper restores it.
export function bashBody(aliases: readonly string[]): string {
	const lines = ["set +H", '_omp_shell() { set +f; omp-shell "$@"; }'];
	for (const alias of aliases) lines.push(`alias '${alias}'='set -f; _omp_shell'`);
	return lines.join("\n");
}

export function zshBody(aliases: readonly string[]): string {
	return aliases.map(alias => `alias '${alias}'='noglob omp-shell'`).join("\n");
}

export interface SetupOptions {
	home: string;
	dryRun: boolean;
	uninstall: boolean;
	/** Empty = `?`. Ignored by uninstall. */
	aliases: string[];
	/** undefined = every detected shell (setup) or every shell with a binding (uninstall). */
	shells?: readonly ShellName[];
	/** Command lookup for the PATH conflict check; defaults to `$which`. */
	which?: (name: string) => string | null;
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

function rcFile(home: string, shell: "bash" | "zsh"): string {
	return path.join(home, shell === "bash" ? ".bashrc" : ".zshrc");
}

function shellConfigPath(home: string, shell: ShellName): string {
	return shell === "fish" ? path.join(home, ".config", "fish") : rcFile(home, shell);
}

function fishFunctionsDir(home: string): string {
	return path.join(home, ".config", "fish", "functions");
}

/** Files omp-shell or giverny owns say so in their body; anything else is the user's. */
function isOwned(content: string): boolean {
	return /\b(omp-shell|giverny)\b/.test(content);
}

interface FishFunction {
	alias: string;
	file: string;
	content: string;
}

/** Fish autoload files that call omp-shell or giverny, keyed by their alias (the file name). */
function fishFunctions(home: string): FishFunction[] {
	const dir = fishFunctionsDir(home);
	let names: string[];
	try {
		names = fs.readdirSync(dir);
	} catch {
		return [];
	}
	const out: FishFunction[] = [];
	for (const name of names) {
		if (!name.endsWith(".fish")) continue;
		const file = path.join(dir, name);
		try {
			if (!fs.statSync(file).isFile()) continue;
		} catch {
			continue;
		}
		const content = readOrNull(file);
		if (content === null || !isOwned(content)) continue;
		out.push({ alias: name.slice(0, -".fish".length), file, content });
	}
	return out.sort((a, b) => a.alias.localeCompare(b.alias));
}

function blocks(content: string, markers: Markers): string[] {
	const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const re = new RegExp(`${escape(markers.start)}[\\s\\S]*?${escape(markers.end)}`, "g");
	return [...content.matchAll(re)].map(match => match[0]);
}

const RE_ALIAS = /\balias\s+(?:'([^']*)'|"([^"]*)"|([^\s='"]+))/g;

/** Aliases an rc file's omp-shell and giverny blocks define, in file order. */
function rcAliases(content: string): string[] {
	const out = new Set<string>();
	for (const markers of [OMP_MARKERS, GIVERNY_MARKERS]) {
		for (const block of blocks(content, markers)) {
			for (const match of block.matchAll(RE_ALIAS)) {
				const name = match[1] ?? match[2] ?? match[3];
				if (name) out.add(name);
			}
		}
	}
	return [...out];
}

function hasRcBinding(home: string, shell: "bash" | "zsh"): boolean {
	const current = readOrNull(rcFile(home, shell));
	if (current === null) return false;
	return blocks(current, OMP_MARKERS).length > 0 || blocks(current, GIVERNY_MARKERS).length > 0;
}

/** Shells whose config already exists; setup never creates an rc file or fish config. */
export function detectShells(home: string): ShellName[] {
	return SHELL_NAMES.filter(shell => fs.existsSync(shellConfigPath(home, shell)));
}

/** Aliases omp-shell (or giverny) currently installs for one shell. */
export function installedAliases(home: string, shell: ShellName): string[] {
	if (shell === "fish") return fishFunctions(home).map(fn => fn.alias);
	const current = readOrNull(rcFile(home, shell));
	return current === null ? [] : rcAliases(current);
}

/** Shells that carry any omp-shell or giverny binding; uninstall defaults to these. */
export function boundShells(home: string): ShellName[] {
	return SHELL_NAMES.filter(shell => (shell === "fish" ? fishFunctions(home).length > 0 : hasRcBinding(home, shell)));
}

function unique<T>(values: readonly T[]): T[] {
	return [...new Set(values)];
}

const RE_BAD_ALIAS = /[\s'"`/$;|&<>]/;

/** Throws on a name that would break the generated shell code or shadow a command on PATH. */
function assertAlias(name: string, installed: ReadonlySet<string>, which: (name: string) => string | null): void {
	if (name.length === 0) throw new Error("alias names must not be empty");
	if (RE_BAD_ALIAS.test(name)) {
		throw new Error(`invalid alias name '${name}': whitespace, quotes, / $ \` ; | & < > are not allowed`);
	}
	if (installed.has(name)) return;
	const command = which(name);
	if (command !== null) throw new Error(`alias name '${name}' is already a command (${command})`);
}

function planFish(home: string, aliases: readonly string[]): Change[] {
	if (!fs.existsSync(shellConfigPath(home, "fish"))) return [];
	const wanted = new Set(aliases);
	const owned = fishFunctions(home);
	const changes: Change[] = [];
	for (const fn of owned) {
		if (!wanted.has(fn.alias)) changes.push({ file: fn.file, content: null });
	}
	for (const alias of aliases) {
		const existing = owned.find(fn => fn.alias === alias);
		if (existing) {
			const content = fishFunction(alias);
			if (existing.content !== content) changes.push({ file: existing.file, content });
			continue;
		}
		const file = path.join(fishFunctionsDir(home), `${alias}.fish`);
		if (fs.existsSync(file)) {
			throw new Error(`${file} exists and is not managed by omp-shell or giverny; remove it first`);
		}
		changes.push({ file, content: fishFunction(alias) });
	}
	return changes;
}

function planUninstall(opts: SetupOptions): Change[] {
	const shells = opts.shells ?? boundShells(opts.home);
	const changes: Change[] = [];
	for (const shell of unique(shells)) {
		if (shell === "fish") {
			if (!fs.existsSync(shellConfigPath(opts.home, "fish"))) continue;
			for (const fn of fishFunctions(opts.home)) changes.push({ file: fn.file, content: null });
			continue;
		}
		const file = rcFile(opts.home, shell);
		const current = readOrNull(file);
		if (current === null) continue;
		const next = removeBlocks(current);
		if (next !== current) changes.push({ file, content: next });
	}
	return changes;
}

/** Compute the file changes; no writes. Throws on an invalid or conflicting alias. */
export function planSetup(opts: SetupOptions): Change[] {
	if (opts.uninstall) return planUninstall(opts);

	const aliases = unique(opts.aliases.length > 0 ? opts.aliases : [DEFAULT_ALIAS]);
	const shells = unique(opts.shells ?? detectShells(opts.home));
	const installed = new Set<string>();
	for (const shell of SHELL_NAMES) for (const alias of installedAliases(opts.home, shell)) installed.add(alias);
	const which = opts.which ?? $which;
	for (const alias of aliases) assertAlias(alias, installed, which);

	const changes: Change[] = [];
	for (const shell of shells) {
		if (shell === "fish") {
			changes.push(...planFish(opts.home, aliases));
			continue;
		}
		const file = rcFile(opts.home, shell);
		const current = readOrNull(file);
		if (current === null) continue;
		const next = upsertBlock(current, shell === "bash" ? bashBody(aliases) : zshBody(aliases));
		if (next !== current) changes.push({ file, content: next });
	}
	return changes;
}

export function applyChanges(changes: readonly Change[]): void {
	for (const change of changes) {
		if (change.content === null) {
			fs.rmSync(change.file, { force: true });
			continue;
		}
		fs.mkdirSync(path.dirname(change.file), { recursive: true });
		fs.writeFileSync(change.file, change.content);
	}
}

interface SetupFlags {
	dryRun: boolean;
	uninstall: boolean;
	aliases: string[];
	shells: ShellName[];
}

function isShellName(value: string): value is ShellName {
	return value === "fish" || value === "bash" || value === "zsh";
}

export function parseSetupArgs(argv: readonly string[]): SetupFlags {
	const flags: SetupFlags = { dryRun: false, uninstall: false, aliases: [], shells: [] };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--setup":
				flags.uninstall = false;
				break;
			case "--uninstall":
				flags.uninstall = true;
				break;
			case "--dry-run":
				flags.dryRun = true;
				break;
			case "--alias":
			case "--shell": {
				const value = argv[++i];
				if (value === undefined) throw new Error(`${arg} needs a value\n${SETUP_USAGE}`);
				if (arg === "--alias") flags.aliases.push(value);
				else if (isShellName(value)) flags.shells.push(value);
				else throw new Error(`unknown shell '${value}' (fish, bash or zsh)\n${SETUP_USAGE}`);
				break;
			}
			default:
				throw new Error(`unknown option '${arg}'\n${SETUP_USAGE}`);
		}
	}
	return flags;
}

/** Labels for the shell checklist: each shell with the aliases omp-shell already installed there. */
function shellLabels(home: string, shells: readonly ShellName[]): string[] {
	return shells.map(shell => {
		const aliases = installedAliases(home, shell);
		return `${shell}  ${aliases.length > 0 ? aliases.join(" ") : "no aliases"}`;
	});
}

type Choice = { kind: "no-tty" } | { kind: "cancelled" } | { kind: "ok"; options: SetupOptions };

function chooseSetup(home: string, dryRun: boolean): Choice {
	const detected = detectShells(home);
	if (detected.length === 0) {
		return { kind: "ok", options: { home, dryRun, uninstall: false, aliases: [], shells: [] } };
	}
	const installed = unique(detected.flatMap(shell => installedAliases(home, shell)));
	const line = promptLine(
		"Aliases to install (space separated)",
		installed.length > 0 ? installed.join(" ") : DEFAULT_ALIAS,
	);
	if (line.kind === "no-tty") return { kind: "no-tty" };
	if (line.kind === "cancel") return { kind: "cancelled" };
	const text = line.value.trim();
	const aliases = text.length === 0 ? [DEFAULT_ALIAS] : text.split(/\s+/);
	const picked = runChecklist(
		"Install for which shells?",
		shellLabels(home, detected),
		detected.map(() => true),
	);
	if (picked.kind === "no-tty") return { kind: "no-tty" };
	if (picked.kind === "cancel") return { kind: "cancelled" };
	const shells = detected.filter((_, i) => picked.checked[i]);
	return { kind: "ok", options: { home, dryRun, uninstall: false, aliases, shells } };
}

function chooseUninstall(home: string, dryRun: boolean): Choice {
	const bound = boundShells(home);
	if (bound.length === 0) {
		return { kind: "ok", options: { home, dryRun, uninstall: true, aliases: [], shells: [] } };
	}
	const picked = runChecklist(
		"Remove omp-shell from which shells?",
		shellLabels(home, bound),
		bound.map(() => true),
	);
	if (picked.kind === "no-tty") return { kind: "no-tty" };
	if (picked.kind === "cancel") return { kind: "cancelled" };
	return {
		kind: "ok",
		options: { home, dryRun, uninstall: true, aliases: [], shells: bound.filter((_, i) => picked.checked[i]) },
	};
}

function confirmChanges(): boolean {
	const answer = promptLine("Write these changes? [y/N]", "");
	if (answer.kind !== "value") return false;
	const text = answer.value.trim().toLowerCase();
	return text === "y" || text === "yes";
}

/** CLI entry; returns process exit code. */
export function runSetup(argv: string[], home: string = os.homedir()): number {
	let flags: SetupFlags;
	try {
		flags = parseSetupArgs(argv);
	} catch (err) {
		process.stderr.write(`omp-shell: ${(err as Error).message}\n`);
		return 1;
	}

	const nonInteractive = flags.aliases.length > 0 || flags.shells.length > 0;
	let opts: SetupOptions = {
		home,
		dryRun: flags.dryRun,
		uninstall: flags.uninstall,
		aliases: flags.aliases,
		shells: flags.shells.length > 0 ? flags.shells : undefined,
	};
	let interactive = false;
	if (!nonInteractive) {
		const choice = flags.uninstall ? chooseUninstall(home, flags.dryRun) : chooseSetup(home, flags.dryRun);
		if (choice.kind === "cancelled") {
			process.stderr.write("omp-shell: cancelled\n");
			return 1;
		}
		if (choice.kind === "ok") {
			opts = choice.options;
			interactive = true;
		}
	}

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
	if (opts.dryRun) return 0;
	if (interactive && !confirmChanges()) {
		process.stderr.write("omp-shell: cancelled\n");
		return 1;
	}
	applyChanges(changes);
	if (!opts.uninstall) {
		const aliases = unique(opts.aliases.length > 0 ? opts.aliases : [DEFAULT_ALIAS]);
		process.stderr.write(`open a new shell (or source your rc file) to use ${aliases.join(" ")}\n`);
	}
	return 0;
}
