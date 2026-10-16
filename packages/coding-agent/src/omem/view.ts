export interface NodeRef {
	l: number;
	i: number;
}

export const UNBUILT_TEXT = "(not summarized yet: zoom it)";

export function nodeName(l: number, i: number): string {
	const n = 2 ** l;
	return `${i * n}+${n}`;
}

export function renderLine(l: number, i: number, text: string | undefined): string {
	return `${nodeName(l, i)}|${text === undefined ? UNBUILT_TEXT : text.replace(/\r?\n/g, " ")}`;
}

/**
 * Merges the most due sibling pairs in place until `total <= target` or no pair
 * can merge. due = (T - last) / 2^l, measured from the pair's last message so
 * old lines stay put (measuring from `first` churns them). Ties go to the oldest.
 * Returns the new total.
 */
export function foldView(
	view: NodeRef[],
	T: number,
	target: number,
	total: number,
	canMerge: (l: number, i: number) => boolean,
	size: (l: number, i: number) => number,
): number {
	while (total > target) {
		let best = -1;
		let bestDue = -Infinity;
		for (let k = 0; k + 1 < view.length; k++) {
			const a = view[k];
			const b = view[k + 1];
			if (a.l !== b.l || (a.i & 1) !== 0 || b.i !== a.i + 1) continue;
			const n = 2 ** a.l;
			const due = (T - ((a.i + 2) * n - 1)) / n;
			if (due > bestDue && canMerge(a.l + 1, a.i >> 1)) {
				best = k;
				bestDue = due;
			}
		}
		if (best < 0) break;
		const a = view[best];
		const parent = { l: a.l + 1, i: a.i >> 1 };
		total += size(parent.l, parent.i) - size(a.l, a.i) - size(a.l, a.i + 1);
		view.splice(best, 2, parent);
	}
	return total;
}
