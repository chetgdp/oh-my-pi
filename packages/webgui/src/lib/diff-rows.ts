/**
 * Parse the diff text tool results carry into aligned side-by-side rows.
 *
 * Accepted input (mixed freely):
 * - numbered rows from the native edit formatter: `+12|text`, `-12|text`,
 *   ` 12|text` (context rows carry the old-side number);
 * - plain unified rows: `+text`, `-text`, ` text`, with `@@ -a,b +c,d @@`
 *   headers seeding the line counters;
 * - blank rows, which mark a gap between non-contiguous regions.
 * `---`/`+++` file headers are dropped. Any other line becomes a labelled
 * separator so headers emitted by other tools stay visible.
 *
 * Removed/added runs pair positionally: the i-th removed line pairs with the
 * i-th added line as a `modified` row; leftovers become removed-only or
 * added-only rows.
 */
import { diffWordsWithSpace } from "diff";

export type DiffRowKind = "context" | "modified" | "removed" | "added" | "separator";

export interface DiffSide {
	/** Source line number, when known. */
	line?: number;
	text: string;
}

export interface DiffRow {
	kind: DiffRowKind;
	left?: DiffSide;
	right?: DiffSide;
	/** Separator label (hunk header or foreign header line); empty for plain gaps. */
	label?: string;
}

export interface WordSpan {
	text: string;
	changed: boolean;
}

/** Word-level diffing is skipped above this per-line length. */
export const WORD_DIFF_MAX_CHARS = 1000;

const NUMBERED = /^([+\- ])(\d+)\|(.*)$/s;
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiffRows(diff: string): DiffRow[] {
	const rows: DiffRow[] = [];
	let removed: DiffSide[] = [];
	let added: DiffSide[] = [];
	// Running line counters; `undefined` until a number is observed.
	let oldLine: number | undefined;
	let newLine: number | undefined;
	// new - old offset, valid for the numbered format where context rows only
	// carry the old number.
	let delta = 0;

	const flush = (): void => {
		const n = Math.max(removed.length, added.length);
		for (let i = 0; i < n; i++) {
			const left = removed[i];
			const right = added[i];
			if (left && right) rows.push({ kind: "modified", left, right });
			else if (left) rows.push({ kind: "removed", left });
			else if (right) rows.push({ kind: "added", right });
		}
		removed = [];
		added = [];
	};
	const separator = (label: string): void => {
		flush();
		const last = rows[rows.length - 1];
		if (label === "" && (last === undefined || (last.kind === "separator" && last.label === ""))) return;
		rows.push({ kind: "separator", label });
	};

	for (const line of diff.split("\n")) {
		if (line.trim().length === 0) {
			separator("");
			continue;
		}
		if (line.startsWith("---") || line.startsWith("+++")) {
			// File headers, but only when they look like headers (`--- a/x`).
			if (/^(---|\+\+\+)( |$)/.test(line)) continue;
		}
		const hunk = HUNK.exec(line);
		if (hunk) {
			flush();
			oldLine = Number(hunk[1]);
			newLine = Number(hunk[2]);
			delta = newLine - oldLine;
			rows.push({ kind: "separator", label: line });
			continue;
		}
		const numbered = NUMBERED.exec(line);
		if (numbered) {
			const [, marker, num, text] = numbered;
			const n = Number(num);
			if (marker === "-") {
				removed.push({ line: n, text });
				oldLine = n + 1;
			} else if (marker === "+") {
				added.push({ line: n, text });
				newLine = n + 1;
			} else {
				flush();
				rows.push({ kind: "context", left: { line: n, text }, right: { line: n + delta, text } });
				oldLine = n + 1;
				newLine = n + delta + 1;
				continue;
			}
			// Keep the offset current so later context rows map to new numbers.
			if (marker === "-") delta--;
			else delta++;
			continue;
		}
		const marker = line[0];
		const text = line.slice(1);
		if (marker === "-") {
			removed.push({ line: oldLine, text });
			if (oldLine !== undefined) oldLine++;
		} else if (marker === "+") {
			added.push({ line: newLine, text });
			if (newLine !== undefined) newLine++;
		} else if (marker === " ") {
			flush();
			rows.push({ kind: "context", left: { line: oldLine, text }, right: { line: newLine, text } });
			if (oldLine !== undefined) oldLine++;
			if (newLine !== undefined) newLine++;
		} else {
			separator(line);
		}
	}
	flush();
	while (rows.length > 0 && rows[rows.length - 1].kind === "separator" && rows[rows.length - 1].label === "")
		rows.pop();
	return rows;
}

/**
 * Word-level spans for a modified pair. Returns `null` when either side
 * exceeds {@link WORD_DIFF_MAX_CHARS} (callers render the plain line).
 */
export function wordSpans(oldText: string, newText: string): { left: WordSpan[]; right: WordSpan[] } | null {
	if (oldText.length > WORD_DIFF_MAX_CHARS || newText.length > WORD_DIFF_MAX_CHARS) return null;
	const left: WordSpan[] = [];
	const right: WordSpan[] = [];
	for (const part of diffWordsWithSpace(oldText, newText)) {
		if (part.added) right.push({ text: part.value, changed: true });
		else if (part.removed) left.push({ text: part.value, changed: true });
		else {
			left.push({ text: part.value, changed: false });
			right.push({ text: part.value, changed: false });
		}
	}
	return { left, right };
}
