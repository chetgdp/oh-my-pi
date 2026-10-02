/**
 * Todo data model, status progression, and event extraction helpers.
 */

export type TodoStatus = "pending" | "in_progress" | "completed" | "abandoned" | "blocked";

export interface TodoItem {
	content: string;
	status: TodoStatus;
	blocker?: string;
	details?: string;
	notes?: string[];
}

export interface TodoPhase {
	name: string;
	tasks: TodoItem[];
}

export interface TodoProgress {
	closed: number;
	total: number;
	completed: number;
	inProgress: number;
	pending: number;
	abandoned: number;
	blocked: number;
	percent: number;
}

export function isTodoStatus(val: unknown): val is TodoStatus {
	return val === "pending" || val === "in_progress" || val === "completed" || val === "abandoned" || val === "blocked";
}

export function isTodoItem(val: unknown): val is TodoItem {
	if (!val || typeof val !== "object") return false;
	const item = val as Record<string, unknown>;
	return typeof item.content === "string" && isTodoStatus(item.status);
}

export function isTodoPhase(val: unknown): val is TodoPhase {
	if (!val || typeof val !== "object") return false;
	const phase = val as Record<string, unknown>;
	return typeof phase.name === "string" && Array.isArray(phase.tasks) && phase.tasks.every(isTodoItem);
}

export function isTodoPhaseArray(val: unknown): val is TodoPhase[] {
	return Array.isArray(val) && val.every(isTodoPhase);
}

export function isClosedTodo(status: TodoStatus): boolean {
	return status === "completed" || status === "abandoned";
}

export const ROMAN_NUMERALS: ReadonlyArray<readonly [number, string]> = [
	[1000, "M"],
	[900, "CM"],
	[500, "D"],
	[400, "CD"],
	[100, "C"],
	[90, "XC"],
	[50, "L"],
	[40, "XL"],
	[10, "X"],
	[9, "IX"],
	[5, "V"],
	[4, "IV"],
	[1, "I"],
];

/** Convert a 1-based number to Roman numerals (I, II, III, IV, etc.). */
export function formatRoman(n: number): string {
	if (n <= 0) return "";
	let out = "";
	let rem = n;
	for (const [val, sym] of ROMAN_NUMERALS) {
		while (rem >= val) {
			out += sym;
			rem -= val;
		}
	}
	return out;
}

/**
 * Select the active phase index for display:
 * 1. The one with an in_progress task.
 * 2. Else first with open (pending) tasks.
 * 3. Else last phase.
 * Returns -1 if phases is empty.
 */
export function selectActivePhaseIndex(phases: readonly TodoPhase[]): number {
	if (phases.length === 0) return -1;
	const inProgIdx = phases.findIndex(p => p.tasks.some(t => t.status === "in_progress"));
	if (inProgIdx !== -1) return inProgIdx;
	const openIdx = phases.findIndex(p => p.tasks.some(t => t.status === "pending"));
	if (openIdx !== -1) return openIdx;
	return phases.length - 1;
}

export function cloneTodoPhases(phases: readonly TodoPhase[]): TodoPhase[] {
	return phases.map(phase => ({
		name: phase.name,
		tasks: phase.tasks.map(task => ({
			content: task.content,
			status: task.status,
			...(task.blocker !== undefined ? { blocker: task.blocker } : {}),
			...(task.details !== undefined ? { details: task.details } : {}),
			...(task.notes !== undefined ? { notes: [...task.notes] } : {}),
		})),
	}));
}

export function countTodoProgress(phases: readonly TodoPhase[] = []): TodoProgress {
	let closed = 0;
	let total = 0;
	let completed = 0;
	let inProgress = 0;
	let pending = 0;
	let abandoned = 0;
	let blocked = 0;

	for (const phase of phases) {
		for (const task of phase.tasks) {
			total++;
			switch (task.status) {
				case "completed":
					completed++;
					closed++;
					break;
				case "abandoned":
					abandoned++;
					closed++;
					break;
				case "in_progress":
					inProgress++;
					break;
				case "pending":
					pending++;
					break;
				case "blocked":
					blocked++;
					break;
			}
		}
	}

	const percent = total > 0 ? Math.round((closed / total) * 100) : 0;
	return { closed, total, completed, inProgress, pending, abandoned, blocked, percent };
}

/**
 * Cycle item status through the canonical sequence:
 * pending -> in_progress -> completed -> abandoned -> pending.
 * Blocked tasks advance to in_progress when cycled.
 */
export function cycleTaskStatus(status: TodoStatus): TodoStatus {
	switch (status) {
		case "pending":
			return "in_progress";
		case "in_progress":
			return "completed";
		case "completed":
			return "abandoned";
		case "abandoned":
			return "pending";
		case "blocked":
			return "in_progress";
		default:
			return "pending";
	}
}

/**
 * Return a new TodoPhase[] with the designated task's status updated.
 */
export function updateTaskStatus(
	phases: readonly TodoPhase[],
	phaseIndex: number,
	taskIndex: number,
	newStatus: TodoStatus,
): TodoPhase[] {
	return phases.map((phase, pIdx) => {
		if (pIdx !== phaseIndex) return phase;
		return {
			...phase,
			tasks: phase.tasks.map((task, tIdx) => {
				if (tIdx !== taskIndex) return task;
				return { ...task, status: newStatus };
			}),
		};
	});
}

/**
 * Extract updated TodoPhase[] from an incoming RPC frame or event, if present.
 * Inspects:
 * - `tool_execution_end` where toolName === "todo"
 * - `entry` message where role === "toolResult" and toolName === "todo"
 * - `entry` custom where customType === "user_todo_edit"
 */
export function extractTodoPhasesFromEvent(event: unknown): TodoPhase[] | undefined {
	if (!event || typeof event !== "object") return undefined;
	const ev = event as Record<string, unknown>;

	if (ev.type === "tool_execution_end" && ev.toolName === "todo" && !ev.isError) {
		const result = ev.result as Record<string, unknown> | undefined;
		const details = result?.details as Record<string, unknown> | undefined;
		if (details && isTodoPhaseArray(details.phases)) {
			return cloneTodoPhases(details.phases);
		}
	}

	if (ev.type === "entry") {
		const entry = ev.entry as Record<string, unknown> | undefined;
		if (entry?.type === "message") {
			const msg = entry.message as Record<string, unknown> | undefined;
			if (msg?.role === "toolResult" && msg?.toolName === "todo") {
				const details = msg.details as Record<string, unknown> | undefined;
				if (details && isTodoPhaseArray(details.phases)) {
					return cloneTodoPhases(details.phases);
				}
			}
		}
		if (entry?.type === "custom" && entry.customType === "user_todo_edit") {
			const data = entry.data as Record<string, unknown> | undefined;
			if (data && isTodoPhaseArray(data.phases)) {
				return cloneTodoPhases(data.phases);
			}
		}
	}

	return undefined;
}

/** Custom entry type for phases persisted by a user edit (`set_todos`); mirrors `USER_TODO_EDIT_CUSTOM_TYPE` in the agent. */
export const USER_TODO_EDIT_CUSTOM_TYPE = "user_todo_edit";

/**
 * Phases carried by one session entry under the TUI's canonical rule (`canonicalTodoPhases`):
 * a `user_todo_edit` custom entry, or a successful `todo` tool result whose op is not `view`.
 * The selection only checks for an array, as the agent does; the shape is validated afterwards
 * so a malformed latest snapshot renders as empty instead of falling back to an older one.
 */
function canonicalEntryPhases(entry: unknown): unknown[] | undefined {
	if (!entry || typeof entry !== "object") return undefined;
	const e = entry as Record<string, unknown>;
	if (e.type === "custom" && e.customType === USER_TODO_EDIT_CUSTOM_TYPE) {
		const phases = (e.data as { phases?: unknown } | undefined)?.phases;
		return Array.isArray(phases) ? phases : undefined;
	}
	if (e.type !== "message") return undefined;
	const msg = e.message as
		| { role?: unknown; toolName?: unknown; isError?: unknown; details?: { op?: unknown; phases?: unknown } }
		| undefined;
	if (!msg || msg.role !== "toolResult" || msg.toolName !== "todo" || msg.isError) return undefined;
	if (msg.details?.op === "view") return undefined;
	const phases = msg.details?.phases;
	return Array.isArray(phases) ? phases : undefined;
}

/**
 * Latest todo phases of a session transcript (`getLatestTodoPhasesFromEntries` parity): scans
 * last to first, the newest canonical snapshot wins, and no snapshot yields `[]`.
 */
export function getLatestTodoPhasesFromEntries(entries: readonly unknown[]): TodoPhase[] {
	for (let i = entries.length - 1; i >= 0; i--) {
		const phases = canonicalEntryPhases(entries[i]);
		if (phases) return isTodoPhaseArray(phases) ? cloneTodoPhases(phases) : [];
	}
	return [];
}
