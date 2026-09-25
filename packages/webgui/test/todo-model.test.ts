import { describe, expect, test } from "bun:test";
import {
	countTodoProgress,
	cycleTaskStatus,
	extractTodoPhasesFromEvent,
	formatRoman,
	isClosedTodo,
	isTodoItem,
	isTodoPhase,
	isTodoPhaseArray,
	isTodoStatus,
	selectActivePhaseIndex,
	updateTaskStatus,
	type TodoPhase,
} from "../src/lib/todo-model";

describe("todo-model", () => {
	describe("type guards", () => {
		test("isTodoStatus recognizes valid statuses", () => {
			expect(isTodoStatus("pending")).toBe(true);
			expect(isTodoStatus("in_progress")).toBe(true);
			expect(isTodoStatus("completed")).toBe(true);
			expect(isTodoStatus("abandoned")).toBe(true);
			expect(isTodoStatus("blocked")).toBe(true);
			expect(isTodoStatus("unknown")).toBe(false);
			expect(isTodoStatus(null)).toBe(false);
		});

		test("isTodoItem validates tasks", () => {
			expect(isTodoItem({ content: "Do work", status: "pending" })).toBe(true);
			expect(isTodoItem({ content: 123, status: "pending" })).toBe(false);
			expect(isTodoItem({ content: "Do work", status: "invalid" })).toBe(false);
			expect(isTodoItem(null)).toBe(false);
		});

		test("isTodoPhase validates phases", () => {
			expect(isTodoPhase({ name: "Phase 1", tasks: [{ content: "Task 1", status: "completed" }] })).toBe(true);
			expect(isTodoPhase({ name: "Phase 1", tasks: "not-an-array" })).toBe(false);
			expect(isTodoPhase(null)).toBe(false);
		});

		test("isTodoPhaseArray validates lists", () => {
			expect(isTodoPhaseArray([])).toBe(true);
			expect(
				isTodoPhaseArray([
					{ name: "Phase A", tasks: [{ content: "Task A", status: "in_progress" }] },
					{ name: "Phase B", tasks: [] },
				]),
			).toBe(true);
			expect(isTodoPhaseArray([1, 2, 3])).toBe(false);
		});
	});

	describe("countTodoProgress", () => {
		test("empty phases return zero counts", () => {
			const progress = countTodoProgress([]);
			expect(progress).toEqual({
				closed: 0,
				total: 0,
				completed: 0,
				inProgress: 0,
				pending: 0,
				abandoned: 0,
				blocked: 0,
				percent: 0,
			});
		});

		test("counts all task statuses accurately", () => {
			const phases: TodoPhase[] = [
				{
					name: "Phase 1",
					tasks: [
						{ content: "T1", status: "completed" },
						{ content: "T2", status: "abandoned" },
						{ content: "T3", status: "in_progress" },
					],
				},
				{
					name: "Phase 2",
					tasks: [
						{ content: "T4", status: "pending" },
						{ content: "T5", status: "blocked" },
						{ content: "T6", status: "completed" },
					],
				},
			];

			const progress = countTodoProgress(phases);
			expect(progress.total).toBe(6);
			expect(progress.completed).toBe(2);
			expect(progress.abandoned).toBe(1);
			expect(progress.inProgress).toBe(1);
			expect(progress.pending).toBe(1);
			expect(progress.blocked).toBe(1);
			expect(progress.closed).toBe(3); // 2 completed + 1 abandoned
			expect(progress.percent).toBe(50); // 3 / 6 = 50%
		});

		test("isClosedTodo identifies closed statuses", () => {
			expect(isClosedTodo("completed")).toBe(true);
			expect(isClosedTodo("abandoned")).toBe(true);
			expect(isClosedTodo("pending")).toBe(false);
			expect(isClosedTodo("in_progress")).toBe(false);
			expect(isClosedTodo("blocked")).toBe(false);
		});
	});

	describe("cycleTaskStatus", () => {
		test("advances through the standard lifecycle", () => {
			expect(cycleTaskStatus("pending")).toBe("in_progress");
			expect(cycleTaskStatus("in_progress")).toBe("completed");
			expect(cycleTaskStatus("completed")).toBe("abandoned");
			expect(cycleTaskStatus("abandoned")).toBe("pending");
		});

		test("advances blocked to in_progress", () => {
			expect(cycleTaskStatus("blocked")).toBe("in_progress");
		});
	});

	describe("updateTaskStatus", () => {
		test("updates targeted task without mutating original array", () => {
			const initial: TodoPhase[] = [
				{
					name: "P1",
					tasks: [
						{ content: "Task 0", status: "pending" },
						{ content: "Task 1", status: "pending" },
					],
				},
				{
					name: "P2",
					tasks: [{ content: "Task 2", status: "pending" }],
				},
			];

			const updated = updateTaskStatus(initial, 0, 1, "completed");

			expect(updated).not.toBe(initial);
			expect(updated[0]?.tasks[1]?.status).toBe("completed");
			// Ensure other tasks remain untouched
			expect(updated[0]?.tasks[0]?.status).toBe("pending");
			expect(updated[1]?.tasks[0]?.status).toBe("pending");
			// Original was not mutated
			expect(initial[0]?.tasks[1]?.status).toBe("pending");
		});

		test("returns unchanged phases for invalid indices", () => {
			const initial: TodoPhase[] = [
				{
					name: "P1",
					tasks: [{ content: "Task 0", status: "pending" }],
				},
			];

			const out1 = updateTaskStatus(initial, 99, 0, "completed");
			expect(out1).toEqual(initial);

			const out2 = updateTaskStatus(initial, 0, 99, "completed");
			expect(out2).toEqual(initial);
		});
	});

	describe("extractTodoPhasesFromEvent", () => {
		test("returns undefined for non-objects or empty events", () => {
			expect(extractTodoPhasesFromEvent(null)).toBeUndefined();
			expect(extractTodoPhasesFromEvent(undefined)).toBeUndefined();
			expect(extractTodoPhasesFromEvent("string")).toBeUndefined();
			expect(extractTodoPhasesFromEvent({})).toBeUndefined();
		});

		test("returns undefined for unrelated events", () => {
			expect(extractTodoPhasesFromEvent({ type: "model_changed" })).toBeUndefined();
			expect(extractTodoPhasesFromEvent({ type: "tool_execution_end", toolName: "bash" })).toBeUndefined();
			expect(
				extractTodoPhasesFromEvent({
					type: "tool_execution_end",
					toolName: "todo",
					isError: true,
					result: { details: { phases: [] } },
				}),
			).toBeUndefined();
		});

		test("extracts phases from tool_execution_end for todo tool", () => {
			const phases: TodoPhase[] = [
				{
					name: "Phase Alpha",
					tasks: [{ content: "Do initial setup", status: "in_progress" }],
				},
			];
			const event = {
				type: "tool_execution_end",
				toolName: "todo",
				result: {
					details: { phases },
				},
			};

			const extracted = extractTodoPhasesFromEvent(event);
			expect(extracted).toEqual(phases);
			expect(extracted).not.toBe(phases); // Defensive clone
		});

		test("extracts phases from entry message toolResult for todo", () => {
			const phases: TodoPhase[] = [
				{
					name: "Phase Beta",
					tasks: [{ content: "Run verification", status: "completed" }],
				},
			];
			const event = {
				type: "entry",
				entry: {
					type: "message",
					message: {
						role: "toolResult",
						toolName: "todo",
						details: { phases },
					},
				},
			};

			const extracted = extractTodoPhasesFromEvent(event);
			expect(extracted).toEqual(phases);
		});

		test("extracts phases from entry custom user_todo_edit", () => {
			const phases: TodoPhase[] = [
				{
					name: "User Plan",
					tasks: [{ content: "Custom item", status: "pending" }],
				},
			];
			const event = {
				type: "entry",
				entry: {
					type: "custom",
					customType: "user_todo_edit",
					data: { phases },
				},
			};

			const extracted = extractTodoPhasesFromEvent(event);
			expect(extracted).toEqual(phases);
		});

		test("ignores malformed details.phases", () => {
			const event = {
				type: "tool_execution_end",
				toolName: "todo",
				result: {
					details: { phases: "not-an-array" },
				},
			};

			expect(extractTodoPhasesFromEvent(event)).toBeUndefined();
		});
	});

	describe("formatRoman", () => {
		test("formats numbers into roman numerals", () => {
			expect(formatRoman(0)).toBe("");
			expect(formatRoman(-5)).toBe("");
			expect(formatRoman(1)).toBe("I");
			expect(formatRoman(2)).toBe("II");
			expect(formatRoman(3)).toBe("III");
			expect(formatRoman(4)).toBe("IV");
			expect(formatRoman(5)).toBe("V");
			expect(formatRoman(9)).toBe("IX");
			expect(formatRoman(10)).toBe("X");
			expect(formatRoman(14)).toBe("XIV");
			expect(formatRoman(40)).toBe("XL");
			expect(formatRoman(50)).toBe("L");
			expect(formatRoman(90)).toBe("XC");
			expect(formatRoman(100)).toBe("C");
			expect(formatRoman(400)).toBe("CD");
			expect(formatRoman(500)).toBe("D");
			expect(formatRoman(900)).toBe("CM");
			expect(formatRoman(1000)).toBe("M");
		});
	});

	describe("selectActivePhaseIndex", () => {
		test("returns -1 for empty phases", () => {
			expect(selectActivePhaseIndex([])).toBe(-1);
		});

		test("selects phase with in_progress task even if another phase has open tasks", () => {
			const phases: TodoPhase[] = [
				{ name: "P1", tasks: [{ content: "T1", status: "pending" }] },
				{ name: "P2", tasks: [{ content: "T2", status: "in_progress" }] },
				{ name: "P3", tasks: [{ content: "T3", status: "pending" }] },
			];
			expect(selectActivePhaseIndex(phases)).toBe(1);
		});

		test("selects first phase with open (pending) tasks when none in_progress", () => {
			const phases: TodoPhase[] = [
				{
					name: "P1",
					tasks: [
						{ content: "T1", status: "completed" },
						{ content: "T2", status: "abandoned" },
					],
				},
				{ name: "P2", tasks: [{ content: "T3", status: "pending" }] },
				{ name: "P3", tasks: [{ content: "T4", status: "blocked" }] },
			];
			expect(selectActivePhaseIndex(phases)).toBe(1);
		});

		test("selects last phase when all tasks across all phases are closed or blocked", () => {
			const phases: TodoPhase[] = [
				{ name: "P1", tasks: [{ content: "T1", status: "completed" }] },
				{ name: "P2", tasks: [{ content: "T2", status: "blocked" }] },
				{ name: "P3", tasks: [{ content: "T3", status: "blocked" }] },
			];
			expect(selectActivePhaseIndex(phases)).toBe(2);
		});
	});
});
