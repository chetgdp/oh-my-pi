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
 * Runs `<omp …>; exit` so the window automatically closes when omp exits.
 */
export function buildNewWindowArgv(cwd: string, ompArgs: string[]): string[] {
	const parts = ["omp"];
	for (const arg of ompArgs) {
		parts.push(fishEscape(arg));
	}
	const shellCommand = `${parts.join(" ")}; exit`;
	return [
		"tmux",
		"new-window",
		"-t",
		"ompgui:",
		"-c",
		cwd,
		"-P",
		"-F",
		"#{window_id}",
		"--",
		"fish",
		"-C",
		shellCommand,
	];
}

/**
 * Ensure the hidden session exists. If it does not, create it and return
 * its initial window id so it can be cleaned up after the real window is launched.
 * Handles race conditions where two concurrent launches attempt to create it.
 */
export async function ensureSession(runner: TmuxRunner, sessionName = "ompgui"): Promise<string | null> {
	const hasResult = await runner(["has-session", "-t", `=${sessionName}`]);
	if (hasResult.exitCode === 0) {
		return null;
	}

	const newResult = await runner(["new-session", "-d", "-s", sessionName, "-P", "-F", "#{window_id}"]);
	if (newResult.exitCode === 0) {
		const id = newResult.stdout.trim();
		return id || null;
	}

	const combined = `${newResult.stderr} ${newResult.stdout}`.toLowerCase();
	if (combined.includes("duplicate session")) {
		return null;
	}

	throw new Error(`tmux new-session failed (exit ${newResult.exitCode}): ${newResult.stderr}`);
}

/**
 * Run `tmux new-window` in the hidden `ompgui` session, tag the created
 * window with `@ompgui 1`, and clean up any dummy initial window created
 * when `ompgui` had to be created fresh.
 * Throws on nonzero exit.
 */
export async function newWindow(runner: TmuxRunner, cwd: string, ompArgs: string[]): Promise<string> {
	const initialWindowId = await ensureSession(runner, "ompgui");
	let windowId: string | undefined;
	try {
		const fullArgv = buildNewWindowArgv(cwd, ompArgs);
		const argv = fullArgv.slice(1);
		const result = await runner(argv);
		if (result.exitCode !== 0) {
			throw new Error(`tmux new-window failed (exit ${result.exitCode}): ${result.stderr}`);
		}
		windowId = result.stdout.trim();

		const tagResult = await runner(["set-option", "-w", "-t", windowId, "@ompgui", "1"]);
		if (tagResult.exitCode !== 0) {
			throw new Error(`tmux set-option failed (exit ${tagResult.exitCode}): ${tagResult.stderr}`);
		}

		return windowId;
	} finally {
		if (initialWindowId && initialWindowId !== windowId) {
			await runner(["kill-window", "-t", initialWindowId]).catch(() => ({}));
		}
	}
}

export interface TmuxPaneInfo {
	panePid: number;
	windowId: string;
	ompgui: boolean;
}

/**
 * Parse output of `tmux list-panes -a -F '#{pane_pid} #{window_id} #{@ompgui}'`.
 */
export function parseListPanes(stdout: string): TmuxPaneInfo[] {
	const panes: TmuxPaneInfo[] = [];
	for (const rawLine of stdout.split("\n")) {
		const line = rawLine.trim();
		if (!line) continue;
		const parts = line.split(/\s+/);
		if (parts.length >= 2) {
			const panePid = parseInt(parts[0], 10);
			const windowId = parts[1];
			const tag = parts.slice(2).join(" ").trim();
			if (!Number.isNaN(panePid)) {
				panes.push({
					panePid,
					windowId,
					ompgui: tag.length > 0,
				});
			}
		}
	}
	return panes;
}

/**
 * Query all tmux panes with `@ompgui` options via runner.
 * Fails soft: returns null if runner is omitted or tmux command fails.
 */
export async function getTmuxPanes(runner?: TmuxRunner): Promise<TmuxPaneInfo[] | null> {
	if (!runner) return null;
	try {
		const res = await runner(["list-panes", "-a", "-F", "#{pane_pid} #{window_id} #{@ompgui}"]);
		if (res.exitCode !== 0) return null;
		return parseListPanes(res.stdout);
	} catch {
		return null;
	}
}

export type ProcessTreeReader = () => Promise<Map<number, number>>;

/**
 * Parse lines of `pid ppid` into a Map<pid, ppid>.
 */
export function parseProcessTree(stdout: string): Map<number, number> {
	const map = new Map<number, number>();
	for (const rawLine of stdout.split("\n")) {
		const line = rawLine.trim();
		if (!line) continue;
		const parts = line.split(/\s+/);
		if (parts.length >= 2) {
			const pid = parseInt(parts[0], 10);
			const ppid = parseInt(parts[1], 10);
			if (!Number.isNaN(pid) && !Number.isNaN(ppid)) {
				map.set(pid, ppid);
			}
		}
	}
	return map;
}

/**
 * Read system process tree using `ps -o pid=,ppid= -A`.
 */
export async function readProcessTree(): Promise<Map<number, number>> {
	try {
		const result = await $`ps -o pid=,ppid= -A`.quiet().nothrow();
		if (result.exitCode !== 0) return new Map();
		return parseProcessTree(result.text());
	} catch {
		return new Map();
	}
}

export type SessionOrigin = "gui" | "cli" | "unknown";

/**
 * Traverse parent process chain upwards from `pid` to find a matching tmux pane PID.
 */
export function matchPidToPane(pid: number, panePids: Set<number>, parentMap: Map<number, number>): number | null {
	let curr = pid;
	const visited = new Set<number>();
	while (curr > 1 && !visited.has(curr)) {
		if (panePids.has(curr)) {
			return curr;
		}
		visited.add(curr);
		const parent = parentMap.get(curr);
		if (!parent || parent === curr) break;
		curr = parent;
	}
	return null;
}

/**
 * Resolve session origin for an omp process.
 * - Tagged pane: "gui"
 * - Untagged pane: "cli"
 * - No tmux / unmapped: "unknown"
 */
export function resolveSessionOrigin(
	ompPid: number,
	panes: TmuxPaneInfo[] | null,
	parentMap?: Map<number, number>,
): SessionOrigin {
	if (!panes || panes.length === 0) {
		return "unknown";
	}

	const paneByPid = new Map<number, TmuxPaneInfo>();
	const panePidSet = new Set<number>();
	for (const p of panes) {
		paneByPid.set(p.panePid, p);
		panePidSet.add(p.panePid);
	}

	const matchedPanePid = matchPidToPane(ompPid, panePidSet, parentMap ?? new Map());
	if (matchedPanePid === null) {
		return "unknown";
	}

	const pane = paneByPid.get(matchedPanePid);
	return pane?.ompgui ? "gui" : "cli";
}
