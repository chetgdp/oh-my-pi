/**
 * `/tools`: the host's `/tools` list (`* name` active, `- name` inactive,
 * `~ xd://name` mounted device) rendered as aligned columns with family colors
 * and a short description.
 */
import { toolColor } from "./output";

export type ToolState = "active" | "inactive" | "device";

export interface ToolRow {
	name: string;
	state: ToolState;
}

const STATE_MARKERS: Record<string, ToolState> = { "*": "active", "-": "inactive", "~": "device" };

/** Built-in tools only; MCP and extension tools have no entry and show an empty description. */
const TOOL_SUMMARIES: Record<string, string> = {
	read: "read files, dirs, URLs",
	write: "create or overwrite a file",
	edit: "patch lines in a file",
	apply_patch: "apply a unified patch",
	ast_edit: "structural code rewrite",
	ast_grep: "structural code search",
	grep: "regex search in files",
	glob: "find files by pattern",
	find: "locate code by behavior",
	lsp: "language server queries",
	bash: "run shell commands",
	eval: "run Python or JS cells",
	debug: "drive a debugger (DAP)",
	tui: "run TUI apps on a PTY",
	task: "spawn subagents",
	wait: "wait for background jobs",
	todo: "track task list",
	items: "edit structured lists",
	ask: "ask the user a question",
	think: "private scratchpad",
	dialectic: "thesis, antithesis, synthesis",
	web_search: "search the web",
	web_fetch: "fetch a URL",
	browser: "drive a browser tab",
	github: "GitHub issues and PRs",
	memory_edit: "edit stored memory",
	recall: "search memory",
	retain: "save to memory",
	reflect: "summarize memory",
	learn: "record a lesson",
	context_notes: "notes kept in context",
	checkpoint: "mark a rewind point",
	rewind: "return to a checkpoint",
	new_context: "start a fresh context",
	manage_skill: "create or edit skills",
	security_scan: "scan for vulnerabilities",
	ida: "query IDA disassembly",
	wren: "speak text aloud",
	yield: "end the turn with a result",
	vibe_spawn: "start a vibe agent",
	vibe_send: "message a vibe agent",
	vibe_list: "list vibe agents",
	vibe_wait: "wait for a vibe agent",
	vibe_kill: "stop a vibe agent",
};

const STATE_LABELS: Record<ToolState, string> = { active: "on", inactive: "off", device: "xd" };
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const COLUMN_GAP = "  ";

/** Rows of the host's `/tools` text; lines without a known marker are skipped. */
export function parseToolList(text: string): ToolRow[] {
	const rows: ToolRow[] = [];
	for (const line of text.split("\n")) {
		const state = STATE_MARKERS[line[0] ?? ""];
		const name = line.slice(2).trim();
		if (state === undefined || line[1] !== " " || name.length === 0) continue;
		rows.push({ name: state === "device" ? name.replace(/^xd:\/\//, "") : name, state });
	}
	return rows;
}

/** One line per tool: name, state, description; padding is computed before escapes are added. */
export function renderToolTable(rows: readonly ToolRow[], color: boolean): string {
	const nameWidth = Math.max(...rows.map(row => displayName(row).length));
	const lines = rows.map(row => {
		const name = displayName(row);
		const pad = " ".repeat(nameWidth - name.length);
		const family = color ? toolColor(row.name) : null;
		const shownName = family ? `${family}${name}${RESET}` : name;
		const label = STATE_LABELS[row.state];
		const shownLabel = color && row.state === "inactive" ? `${DIM}${label}${RESET}` : label;
		const summary = TOOL_SUMMARIES[row.name] ?? "";
		const shownSummary = color && summary ? `${DIM}${summary}${RESET}` : summary;
		return `${shownName}${pad}${COLUMN_GAP}${shownLabel}${" ".repeat(3 - label.length)}${COLUMN_GAP}${shownSummary}`.trimEnd();
	});
	return `${lines.join("\n")}\n`;
}

function displayName(row: ToolRow): string {
	return row.state === "device" ? `xd://${row.name}` : row.name;
}
