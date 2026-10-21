import { win } from "./dom-setup";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseDiffRows, WORD_DIFF_MAX_CHARS, wordSpans } from "../src/lib/diff-rows";

import { DiffBlock } from "../src/components/transcript/tool-views/parts";

describe("parseDiffRows (native numbered format)", () => {
	it("pairs removed/added runs positionally and leaves extras one-sided", () => {
		// Regression: misaligned pairing puts unrelated lines side by side.
		const rows = parseDiffRows(["-3|a", "-4|b", "-5|c", "+3|A", "+4|B", " 6|tail"].join("\n"));
		expect(rows.map(r => r.kind)).toEqual(["modified", "modified", "removed", "context"]);
		expect(rows[0]).toEqual({ kind: "modified", left: { line: 3, text: "a" }, right: { line: 3, text: "A" } });
		expect(rows[2].right).toBeUndefined();
		// 3 removed, 2 added: new-side numbering of trailing context is old - 1.
		expect(rows[3].left?.line).toBe(6);
		expect(rows[3].right?.line).toBe(5);
	});

	it("emits added-only rows when additions outnumber removals", () => {
		const rows = parseDiffRows(["-1|x", "+1|y", "+2|z"].join("\n"));
		expect(rows.map(r => r.kind)).toEqual(["modified", "added"]);
		expect(rows[1].left).toBeUndefined();
		expect(rows[1].right).toEqual({ line: 2, text: "z" });
	});

	it("turns blank rows into single gap separators, dropping leading/trailing gaps", () => {
		const rows = parseDiffRows(["", " 1|a", "", "", " 9|b", ""].join("\n"));
		expect(rows.map(r => r.kind)).toEqual(["context", "separator", "context"]);
		expect(rows[1].label).toBe("");
	});

	it("keeps `|` inside content intact", () => {
		expect(parseDiffRows("+7|a | b")[0].right).toEqual({ line: 7, text: "a | b" });
	});
});

describe("parseDiffRows (plain unified format)", () => {
	it("drops file headers, seeds counters from hunk headers, keeps hunk label", () => {
		const rows = parseDiffRows(
			["--- a/f.ts", "+++ b/f.ts", "@@ -10,3 +20,3 @@", " ctx", "-old", "+new", " end"].join("\n"),
		);
		expect(rows.map(r => r.kind)).toEqual(["separator", "context", "modified", "context"]);
		expect(rows[0].label).toBe("@@ -10,3 +20,3 @@");
		expect(rows[1].left?.line).toBe(10);
		expect(rows[1].right?.line).toBe(20);
		expect(rows[2].left).toEqual({ line: 11, text: "old" });
		expect(rows[2].right).toEqual({ line: 21, text: "new" });
	});

	it("keeps foreign header lines visible as labelled separators", () => {
		const rows = parseDiffRows(["# src/x.ts", "-a", "+b"].join("\n"));
		expect(rows[0]).toEqual({ kind: "separator", label: "# src/x.ts" });
	});
});

describe("wordSpans", () => {
	it("marks only the changed words on each side", () => {
		const spans = wordSpans("const a = 1;", "const b = 1;");
		expect(spans?.left.filter(s => s.changed).map(s => s.text)).toEqual(["a"]);
		expect(spans?.right.filter(s => s.changed).map(s => s.text)).toEqual(["b"]);
		expect(spans?.right.map(s => s.text).join("")).toBe("const b = 1;");
	});

	it("skips word diffing for overlong lines", () => {
		expect(wordSpans("x".repeat(WORD_DIFF_MAX_CHARS + 1), "y")).toBeNull();
	});
});

describe("DiffBlock markup", () => {
	it("renders aligned 4-cell rows with word highlights and full-width separators", () => {
		const html = renderToStaticMarkup(
			<DiffBlock diff={[" 1|keep", "-2|let a = 1;", "+2|let b = 1;", "+3|extra", "", " 9|z"].join("\n")} />,
		);
		const doc = win.document.createElement("div");
		doc.innerHTML = html;
		const rows = [...doc.querySelectorAll(".tv-diff-grid > .tv-diff-row")];
		expect(rows.map(r => r.className.replace("tv-diff-row tv-diff-row--", ""))).toEqual([
			"context",
			"modified",
			"added",
			"sep",
			"context",
		]);
		// Every non-separator row has exactly 4 cells, so grid columns stay aligned.
		for (const r of rows.filter(r => !r.className.includes("--sep"))) expect(r.children.length).toBe(4);
		const mod = rows[1];
		expect(mod.querySelector(".tv-diff-l .tv-diff-word--del")?.textContent).toBe("a");
		expect(mod.querySelector(".tv-diff-r .tv-diff-word--add")?.textContent).toBe("b");
		// Added-only row: left half is an empty placeholder (hidden in unified layout).
		expect(rows[2].querySelector(".tv-diff-text.tv-diff-l")?.className).toContain("tv-diff--empty");
		expect(rows[2].querySelector(".tv-diff-num.tv-diff-r")?.textContent).toBe("3");
	});
});
