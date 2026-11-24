import { closeSync, openSync, readSync, writeSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { truncateToWidth } from "@oh-my-pi/pi-tui";
import { APPROVAL_MODES, type ApprovalMode } from "./commands";
import { type SubagentRow, subagentLabel } from "./subagents";

// Interactive UI for `?`, drawn on /dev/tty so it works with piped stdin/stdout.
// Rendering is pure (state -> lines); only the run* functions touch the tty.

export interface HostRow {
	instanceId: string;
	sessionId: string;
	sessionName?: string;
	cwd: string;
	model?: string;
	startedAt: number;
	/** Live entries only: `tui` rows are marked in the picker; headless hosts are unmarked. */
	kind?: "tui" | "host";
	/** Session runs (or was started) in omem memory mode; marked `[omem]`. */
	omem?: true;
	/** `/stop` picker: the session bound to this pane. */
	attached?: true;
}

export type Key =
	| { kind: "enter" }
	| { kind: "escape" }
	| { kind: "up" }
	| { kind: "down" }
	| { kind: "left" }
	| { kind: "right" }
	| { kind: "backspace" }
	| { kind: "digit"; digit: number }
	| { kind: "char"; char: string }
	| { kind: "other" };

/** Decode one read() worth of bytes into a key. Ctrl-C and Esc both map to escape. */
export function decodeKey(bytes: Uint8Array, n: number): Key {
	const length = Math.min(Math.max(n, 0), bytes.length);
	if (length === 0) return { kind: "other" };
	let end = length;
	while (end > 0 && (bytes[end - 1] === 0x0d || bytes[end - 1] === 0x0a)) end--;
	if (end === 0) return { kind: "enter" };
	if (end === 1) {
		const b = bytes[0];
		if (b === 0x03 || b === 0x1b) return { kind: "escape" };
		if (b === 0x7f || b === 0x08) return { kind: "backspace" };
		if (b >= 0x31 && b <= 0x39) return { kind: "digit", digit: b - 0x30 };
		if (b >= 0x20 && b < 0x7f) return { kind: "char", char: String.fromCharCode(b) };
		return { kind: "other" };
	}
	if (end === 3 && bytes[0] === 0x1b && (bytes[1] === 0x5b || bytes[1] === 0x4f)) {
		if (bytes[2] === 0x41) return { kind: "up" };
		if (bytes[2] === 0x42) return { kind: "down" };
		if (bytes[2] === 0x43) return { kind: "right" };
		if (bytes[2] === 0x44) return { kind: "left" };
	}
	if (bytes[0] !== 0x1b) {
		const text = new TextDecoder().decode(bytes.subarray(0, end));
		if (!/[\x00-\x1f\x7f]/.test(text)) return { kind: "char", char: text };
	}
	return { kind: "other" };
}

// ---------------------------------------------------------------- list state

export interface ListState {
	count: number;
	selected: number;
}

export type ListStep = { kind: "move"; state: ListState } | { kind: "pick"; index: number } | { kind: "cancel" };

/** Pure transition for list pickers: arrows/j/k move (wrapping), enter picks, 1-9 quick pick, esc/q cancel. */
export function stepList(state: ListState, key: Key): ListStep {
	if (state.count <= 0) return { kind: "cancel" };
	if (key.kind === "escape") return { kind: "cancel" };
	if (key.kind === "char" && key.char === "q") return { kind: "cancel" };
	if (key.kind === "enter") return { kind: "pick", index: state.selected };
	if (key.kind === "digit") {
		if (key.digit <= state.count) return { kind: "pick", index: key.digit - 1 };
		return { kind: "move", state };
	}
	const up = key.kind === "up" || (key.kind === "char" && key.char === "k");
	const down = key.kind === "down" || (key.kind === "char" && key.char === "j");
	if (up) return { kind: "move", state: { ...state, selected: (state.selected - 1 + state.count) % state.count } };
	if (down) return { kind: "move", state: { ...state, selected: (state.selected + 1) % state.count } };
	return { kind: "move", state };
}

// ---------------------------------------------------------------- formatting

export function shortenHome(dir: string, home: string = os.homedir()): string {
	if (home && (dir === home || dir.startsWith(`${home}/`))) return `~${dir.slice(home.length)}`;
	return dir;
}

export function formatAge(startedAt: number, now: number): string {
	const s = Math.max(0, Math.floor((now - startedAt) / 1000));
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.floor(s / 60)}m`;
	if (s < 86400) return `${Math.floor(s / 3600)}h`;
	return `${Math.floor(s / 86400)}d`;
}

export function hostLabel(row: HostRow, now: number, home?: string): string {
	const name = row.sessionName || row.sessionId.slice(0, 8);
	const parts = [name];
	if (row.omem) parts.push("[omem]");
	if (row.kind === "tui") parts.push("[tui]");
	if (row.attached) parts.push("[attached]");
	parts.push(shortenHome(row.cwd, home));
	if (row.model) parts.push(row.model);
	parts.push(formatAge(row.startedAt, now));
	return parts.join("  ");
}

const DIM = "\x1b[2m";
const INV = "\x1b[7m";
const RESET = "\x1b[0m";

/** `columns` bounds every line to columns - 1 so no row wraps; redraw counts one terminal row per line. */
export function renderList(title: string, labels: string[], selected: number, columns = Infinity): string[] {
	const fit = (text: string) => (Number.isFinite(columns) ? truncateToWidth(text, Math.max(1, columns - 1)) : text);
	const lines = titleLines(title).map(line => `${DIM}${fit(line)}${RESET}`);
	for (let i = 0; i < labels.length; i++) {
		const num = i < 9 ? `${i + 1}` : " ";
		const text = `${num} ${labels[i]}`;
		lines.push(i === selected ? `${INV}${fit(`> ${text}`)}${RESET}` : fit(`  ${text}`));
	}
	lines.push(`${DIM}${fit("↑/↓ j/k move · enter select · 1-9 pick · esc cancel")}${RESET}`);
	return lines;
}

export function renderHostPicker(
	rows: HostRow[],
	selected: number,
	now: number,
	home?: string,
	columns?: number,
): string[] {
	return renderList(
		"Select an omp session",
		rows.map(r => hostLabel(r, now, home)),
		selected,
		columns,
	);
}

export function renderInput(title: string, value: string): string[] {
	return [...titleLines(title).map(line => `${DIM}${line}${RESET}`), `> ${value}`];
}

/** One frame line per title line: an embedded newline would occupy a row that redraw never erases. */
function titleLines(title: string): string[] {
	return title.split(/\r?\n/).map(line => line.trimEnd());
}

// ---------------------------------------------------------------- response frames

type UiResponse = Record<string, unknown>;

export function cancelledResponse(id: unknown): UiResponse {
	return { type: "extension_ui_response", id, cancelled: true };
}
export function valueResponse(id: unknown, value: string): UiResponse {
	return { type: "extension_ui_response", id, value };
}
export function confirmedResponse(id: unknown, confirmed: boolean): UiResponse {
	return { type: "extension_ui_response", id, confirmed };
}

// ---------------------------------------------------------------- raw tty

interface Tty {
	readFd: number;
	writeFd: number;
}

function stty(fd: number, args: string[]): string | null {
	const r = Bun.spawnSync(["stty", ...args], { stdin: fd, stdout: "pipe", stderr: "ignore" });
	return r.exitCode === 0 ? r.stdout.toString().trim() : null;
}

/** Run `callback` with /dev/tty in raw mode; mode is restored in finally and on process exit. null = no tty. */
export function withRawTTY<T>(callback: (tty: Tty) => T): { value: T } | null {
	let readFd: number;
	let writeFd: number;
	try {
		readFd = openSync("/dev/tty", "r");
	} catch {
		return null;
	}
	try {
		writeFd = openSync("/dev/tty", "w");
	} catch {
		closeSync(readFd);
		return null;
	}
	const saved = stty(readFd, ["-g"]);
	let restored = false;
	const restore = (): void => {
		if (restored) return;
		restored = true;
		if (saved) stty(readFd, [saved]);
	};
	const onSignal = (): void => {
		restore();
		process.exit(130);
	};
	process.on("exit", restore);
	process.on("SIGINT", onSignal);
	process.on("SIGTERM", onSignal);
	try {
		if (!saved || stty(readFd, ["raw", "-echo"]) === null) return null;
		return { value: callback({ readFd, writeFd }) };
	} finally {
		restore();
		process.off("exit", restore);
		process.off("SIGINT", onSignal);
		process.off("SIGTERM", onSignal);
		closeSync(readFd);
		closeSync(writeFd);
	}
}

function ttyColumns(tty: Tty): number {
	const cols = Number(stty(tty.readFd, ["size"])?.split(" ")[1]);
	return cols > 0 ? cols : 80;
}

/** Terminal rows `lines` occupy at `columns` width; redraw must move up by rows, not lines, or wrapped frames stack. */
export function screenRows(lines: string[], columns: number): number {
	let rows = 0;
	for (const line of lines) rows += Math.max(1, Math.ceil(Bun.stringWidth(line) / columns));
	return rows;
}

/**
 * Replace the previous frame `prev` with `lines`. The row count of `prev` is taken at the current width
 * because terminals re-wrap soft-wrapped rows on resize. `cursorAtEnd` leaves the cursor after the last
 * character (line input) instead of on the row below (lists).
 */
function draw(tty: Tty, prev: string[], lines: string[], columns: number, cursorAtEnd: boolean): void {
	const up = prev.length === 0 ? 0 : screenRows(prev, columns) - (cursorAtEnd ? 1 : 0);
	let out = up > 0 ? `\x1b[${up}F\x1b[J` : "\r\x1b[J";
	if (lines.length > 0) out += lines.join("\r\n") + (cursorAtEnd ? "" : "\r\n");
	writeSync(tty.writeFd, out);
}

const MAX_KEYS = 100_000;

function runList(
	title: string,
	labels: string[],
	renderFn?: (sel: number, columns: number) => string[],
): number | null {
	const result = runListOnTty(title, labels, 0, renderFn);
	return result ? result.value : null;
}

/** null = no tty; `{ value: null }` = cancelled. */
function runListOnTty(
	title: string,
	labels: string[],
	initial: number,
	renderFn?: (sel: number, columns: number) => string[],
): { value: number | null } | null {
	if (labels.length === 0) return { value: null };
	return withRawTTY(tty => {
		const buf = new Uint8Array(64);
		let state: ListState = { count: labels.length, selected: initial };
		const renderLines = renderFn ?? ((sel: number, columns: number) => renderList(title, labels, sel, columns));
		let drawn: string[] = [];
		const redraw = (sel: number) => {
			const columns = ttyColumns(tty);
			const lines = renderLines(sel, columns);
			draw(tty, drawn, lines, columns, false);
			drawn = lines;
		};
		writeSync(tty.writeFd, "\x1b[?25l");
		redraw(state.selected);
		try {
			for (let i = 0; i < MAX_KEYS; i++) {
				const step = stepList(state, decodeKey(buf, readSync(tty.readFd, buf, 0, buf.length, null)));
				if (step.kind === "cancel") return null;
				if (step.kind === "pick") return step.index;
				state = step.state;
				redraw(state.selected);
			}
			return null;
		} finally {
			draw(tty, drawn, [], ttyColumns(tty), false);
			writeSync(tty.writeFd, "\x1b[?25h");
		}
	});
}

/** Pure line-edit step: returns new value, or done/cancel. */
export function stepLine(
	value: string,
	key: Key,
): { kind: "edit"; value: string } | { kind: "done" } | { kind: "cancel" } {
	if (key.kind === "escape") return { kind: "cancel" };
	if (key.kind === "enter") return { kind: "done" };
	if (key.kind === "backspace") return { kind: "edit", value: Array.from(value).slice(0, -1).join("") };
	if (key.kind === "char") return { kind: "edit", value: value + key.char };
	if (key.kind === "digit") return { kind: "edit", value: value + String(key.digit) };
	return { kind: "edit", value };
}

function runLine(title: string, initial: string): string | null {
	const result = withRawTTY(tty => {
		const buf = new Uint8Array(256);
		let value = initial;
		let drawn: string[] = [];
		const redraw = (lines: string[]) => {
			draw(tty, drawn, lines, ttyColumns(tty), true);
			drawn = lines;
		};
		redraw(renderInput(title, value));
		try {
			for (let i = 0; i < MAX_KEYS; i++) {
				const step = stepLine(value, decodeKey(buf, readSync(tty.readFd, buf, 0, buf.length, null)));
				if (step.kind === "cancel") return null;
				if (step.kind === "done") return value;
				value = step.value;
				redraw(renderInput(title, value));
			}
			return null;
		} finally {
			redraw([]);
		}
	});
	return result ? result.value : null;
}

async function runEditor(title: string, prefill: string): Promise<string | null> {
	const editor = process.env.VISUAL || process.env.EDITOR;
	if (!editor) return runLine(title, prefill);
	let readFd: number;
	let writeFd: number;
	try {
		readFd = openSync("/dev/tty", "r");
		writeFd = openSync("/dev/tty", "w");
	} catch {
		return null;
	}
	const file = path.join(os.tmpdir(), `omp-shell-${process.pid}-${Date.now()}.md`);
	try {
		await Bun.write(file, prefill);
		const proc = Bun.spawn(["sh", "-c", `${editor} "$1"`, "sh", file], {
			stdin: readFd,
			stdout: writeFd,
			stderr: writeFd,
		});
		if ((await proc.exited) !== 0) return null;
		return (await Bun.file(file).text()).replace(/\n$/, "");
	} finally {
		closeSync(readFd);
		closeSync(writeFd);
		await Bun.file(file)
			.delete()
			.catch(() => {});
	}
}

// ---------------------------------------------------------------- contract

export async function pickHost(rows: HostRow[]): Promise<HostRow | null> {
	if (rows.length === 0) return null;
	const now = Date.now();
	const index = runList(
		"Select an omp session",
		rows.map(r => r.sessionId),
		(sel, columns) => renderHostPicker(rows, sel, now, undefined, columns),
	);
	return index === null ? null : (rows[index] ?? null);
}

/** Picker on /dev/tty over the running subagents; null = cancelled or no terminal. */
export async function pickSubagent(rows: SubagentRow[]): Promise<SubagentRow | null> {
	if (rows.length === 0) return null;
	const index = runList("Select a running subagent", rows.map(subagentLabel));
	return index === null ? null : (rows[index] ?? null);
}

const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
	"always-ask": "always-ask  ask before writes and commands",
	"always-ask-cached": "always-ask-cached  ask once per file or folder, remember",
	write: "write  edit freely, ask before running code",
	yolo: "yolo  never ask",
};

/** Labels for the approval mode picker, the current mode marked. */
export function approvalModeLabels(current: ApprovalMode): string[] {
	return APPROVAL_MODES.map(mode => `${APPROVAL_MODE_LABELS[mode]}${mode === current ? "  (current)" : ""}`);
}

/** Picker on /dev/tty preselecting `current`; null = cancelled, "no-tty" = no terminal to ask on. */
export async function pickApprovalMode(current: ApprovalMode): Promise<ApprovalMode | null | "no-tty"> {
	const result = runListOnTty(
		"Approval mode for this session",
		approvalModeLabels(current),
		Math.max(0, APPROVAL_MODES.indexOf(current)),
	);
	if (result === null) return "no-tty";
	return result.value === null ? null : (APPROVAL_MODES[result.value] ?? null);
}

function str(v: unknown, fallback = ""): string {
	return typeof v === "string" ? v : fallback;
}

export async function answerUiRequest(req: Record<string, unknown>): Promise<Record<string, unknown>> {
	const id = req.id;
	const title = str(req.title) || str(req.message) || "Input";
	switch (req.method) {
		case "select": {
			const options = Array.isArray(req.options) ? req.options.map(o => String(o)) : [];
			const index = runList(title, options);
			return index === null ? cancelledResponse(id) : valueResponse(id, options[index]);
		}
		case "confirm": {
			const msg = str(req.message);
			const index = runList(msg && msg !== title ? `${title}: ${msg}` : title, ["Yes", "No"]);
			return index === null ? cancelledResponse(id) : confirmedResponse(id, index === 0);
		}
		case "input": {
			const value = runLine(str(req.placeholder) ? `${title} (${str(req.placeholder)})` : title, "");
			return value === null ? cancelledResponse(id) : valueResponse(id, value);
		}
		case "editor": {
			const value = await runEditor(title, str(req.prefill));
			return value === null ? cancelledResponse(id) : valueResponse(id, value);
		}
		default:
			return cancelledResponse(id);
	}
}

export function printNotice(text: string): void {
	process.stderr.write(`${text.replace(/\n/g, " ")}\n`);
}
