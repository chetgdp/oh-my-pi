import { describe, expect, it } from "bun:test";
import {
	createPromptHistoryNavigator,
	dedupeConsecutive,
	extractUserPrompts,
	isCaretOnFirstLine,
	isCaretOnLastLine,
} from "../src/lib/prompt-history";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";

describe("prompt-history", () => {
	describe("dedupeConsecutive", () => {
		it("collapses consecutive duplicate items but preserves distinct items", () => {
			expect(dedupeConsecutive([])).toEqual([]);
			expect(dedupeConsecutive(["a", "a", "b", "b", "b", "a"])).toEqual(["a", "b", "a"]);
			expect(dedupeConsecutive(["hello", "world"])).toEqual(["hello", "world"]);
		});
	});

	describe("extractUserPrompts", () => {
		it("extracts and dedupes consecutive user prompts from session entries and pending messages", () => {
			const entries: SessionEntry[] = [
				{
					type: "message",
					id: "1",
					parentId: null,
					timestamp: "2026-09-25T10:00:00Z",
					message: { role: "user", content: "first prompt", timestamp: 1000 },
				},
				{
					type: "message",
					id: "2",
					parentId: "1",
					timestamp: "2026-09-25T10:00:05Z",
					message: {
						role: "assistant",
						content: [{ type: "text", text: "assistant reply" }],
						api: "test",
						provider: "test",
						model: "test",
						usage: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 0,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						stopReason: "stop",
						timestamp: 1005,
					},
				},
				{
					type: "message",
					id: "3",
					parentId: "2",
					timestamp: "2026-09-25T10:01:00Z",
					message: {
						role: "user",
						content: [{ type: "text", text: "second prompt" }],
						timestamp: 1010,
					},
				},
				{
					type: "message",
					id: "4",
					parentId: "3",
					timestamp: "2026-09-25T10:02:00Z",
					message: { role: "user", content: "second prompt", timestamp: 1020 },
				},
			];

			const pendingUser = [{ text: "third prompt" }, { text: "third prompt" }];

			const prompts = extractUserPrompts({ entries, pendingUser });
			expect(prompts).toEqual(["first prompt", "second prompt", "third prompt"]);
		});

		it("handles empty or non-text entries cleanly", () => {
			const entries: SessionEntry[] = [
				{
					type: "message",
					id: "1",
					parentId: null,
					timestamp: "2026-09-25T10:00:00Z",
					message: { role: "user", content: "", timestamp: 1000 },
				},
			];
			expect(extractUserPrompts({ entries, pendingUser: [] })).toEqual([]);
		});
	});

	describe("PromptHistoryNavigator", () => {
		it("handles empty history gracefully", () => {
			const nav = createPromptHistoryNavigator(() => []);
			expect(nav.index).toBe(0);
			expect(nav.stepUp("draft text")).toBe("draft text");
			expect(nav.draft).toBe("");
			expect(nav.stepDown()).toBe("");
		});

		it("steps up and down in history order and restores unsent draft", () => {
			const history = ["first", "second", "third"];
			const nav = createPromptHistoryNavigator(() => history);

			expect(nav.index).toBe(3);

			// Step up: saves draft, recalls newest ("third")
			const recalled1 = nav.stepUp("my draft");
			expect(recalled1).toBe("third");
			expect(nav.index).toBe(2);
			expect(nav.draft).toBe("my draft");

			// Step up again: recalls "second"
			const recalled2 = nav.stepUp(recalled1);
			expect(recalled2).toBe("second");
			expect(nav.index).toBe(1);

			// Step up again: recalls "first" (oldest)
			const recalled3 = nav.stepUp(recalled2);
			expect(recalled3).toBe("first");
			expect(nav.index).toBe(0);

			// Step up at oldest: boundary no-op, stays on "first"
			const recalledBoundary = nav.stepUp(recalled3);
			expect(recalledBoundary).toBe("first");
			expect(nav.index).toBe(0);

			// Step down: moves to "second"
			const down1 = nav.stepDown();
			expect(down1).toBe("second");
			expect(nav.index).toBe(1);

			// Step down: moves to "third"
			const down2 = nav.stepDown();
			expect(down2).toBe("third");
			expect(nav.index).toBe(2);

			// Step down past newest: restores draft
			const downDraft = nav.stepDown();
			expect(downDraft).toBe("my draft");
			expect(nav.index).toBe(3);

			// Extra step down when already at draft: no-op, returns draft
			const downAgain = nav.stepDown();
			expect(downAgain).toBe("my draft");
			expect(nav.index).toBe(3);
		});

		it("resets position to draft semantics when recalled entry is edited", () => {
			const history = ["first", "second", "third"];
			const nav = createPromptHistoryNavigator(() => history);

			// Recall "third"
			nav.stepUp("original draft");
			expect(nav.index).toBe(2);

			// User edits the recalled prompt
			nav.onEdit("third with edits");
			expect(nav.index).toBe(3); // reset to draft position
			expect(nav.draft).toBe("third with edits");

			// Stepping up again should now treat "third with edits" as draft and recall "third"
			const stepAgain = nav.stepUp("third with edits");
			expect(stepAgain).toBe("third");
			expect(nav.index).toBe(2);
			expect(nav.draft).toBe("third with edits");

			// Stepping down restores edited draft
			expect(nav.stepDown()).toBe("third with edits");
			expect(nav.index).toBe(3);
		});

		it("captures fresh draft when re-navigating after clearing text at draft position", () => {
			const history = ["prompt P"];
			const nav = createPromptHistoryNavigator(() => history);

			// Type "my draft", step up (recalls "prompt P")
			const recalled = nav.stepUp("my draft");
			expect(recalled).toBe("prompt P");
			expect(nav.draft).toBe("my draft");

			// Step down (restores "my draft")
			const restored = nav.stepDown();
			expect(restored).toBe("my draft");

			// User edits while at draft position: clears textarea to ""
			nav.onEdit("");
			expect(nav.draft).toBe("");

			// Step up: recalls "prompt P"
			const recalledAgain = nav.stepUp("");
			expect(recalledAgain).toBe("prompt P");

			// Step down: should restore the new draft "", not stale "my draft"
			const restoredAgain = nav.stepDown();
			expect(restoredAgain).toBe("");
		});

		it("resets completely on reset()", () => {
			const history = ["first", "second"];
			const nav = createPromptHistoryNavigator(() => history);

			nav.stepUp("draft");
			expect(nav.draft).toBe("draft");
			expect(nav.index).toBe(1);

			nav.reset();
			expect(nav.draft).toBe("");
			expect(nav.index).toBe(2);
		});
	});

	describe("caret line helpers", () => {
		it("detects first line correctly across single and multi-line strings", () => {
			// Single line
			expect(isCaretOnFirstLine("single line", 0)).toBe(true);
			expect(isCaretOnFirstLine("single line", 5)).toBe(true);
			expect(isCaretOnFirstLine("single line", 11)).toBe(true);

			// Multi-line
			const multi = "line 1\nline 2\nline 3";
			// "line 1" is indices 0..5, newline at 6
			expect(isCaretOnFirstLine(multi, 0)).toBe(true);
			expect(isCaretOnFirstLine(multi, 3)).toBe(true);
			expect(isCaretOnFirstLine(multi, 6)).toBe(true); // right before \n

			// line 2 starts at 7
			expect(isCaretOnFirstLine(multi, 7)).toBe(false);
			expect(isCaretOnFirstLine(multi, 10)).toBe(false);

			// Clamped boundaries
			expect(isCaretOnFirstLine(multi, -5)).toBe(true);
			expect(isCaretOnFirstLine(multi, 100)).toBe(false);
		});

		it("detects last line correctly across single and multi-line strings", () => {
			// Single line
			expect(isCaretOnLastLine("single line", 0)).toBe(true);
			expect(isCaretOnLastLine("single line", 5)).toBe(true);
			expect(isCaretOnLastLine("single line", 11)).toBe(true);

			// Multi-line
			const multi = "line 1\nline 2\nline 3";
			// indices for line 3: "line 1\n" (7) + "line 2\n" (7) -> 14 onwards
			expect(isCaretOnLastLine(multi, 0)).toBe(false);
			expect(isCaretOnLastLine(multi, 6)).toBe(false);
			expect(isCaretOnLastLine(multi, 7)).toBe(false); // line 2
			expect(isCaretOnLastLine(multi, 13)).toBe(false); // before second \n
			expect(isCaretOnLastLine(multi, 14)).toBe(true); // line 3 start
			expect(isCaretOnLastLine(multi, 18)).toBe(true); // line 3 end

			// Clamped boundaries
			expect(isCaretOnLastLine(multi, -5)).toBe(false);
			expect(isCaretOnLastLine(multi, 100)).toBe(true);
		});
	});
});
