/**
 * Marker-delimited block management for shell rc files.
 * Pure string transforms; callers do the file I/O.
 */

export interface Markers {
	start: string;
	end: string;
}

export const OMP_MARKERS: Markers = {
	start: "# >>> omp-shell start",
	end: "# <<< omp-shell end",
};

export const GIVERNY_MARKERS: Markers = {
	start: "# ><(((*> giverny start",
	end: "# <*)))>< giverny end",
};

const NOTE = "# auto-managed by omp-shell --setup, do not edit between markers";

const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Remove every block delimited by `markers`, collapsing the blank lines it leaves. */
export function stripBlock(content: string, markers: Markers): string {
	const start = markers.start.replace(RE_SPECIAL, "\\$&");
	const end = markers.end.replace(RE_SPECIAL, "\\$&");
	const re = new RegExp(`\\n*${start}[\\s\\S]*?${end}[^\\n]*\\n?`, "g");
	if (!re.test(content)) return content;
	re.lastIndex = 0;
	let out = content.replace(re, "\n\n").replace(/\n{3,}/g, "\n\n");
	if (!content.startsWith("\n")) out = out.replace(/^\n+/, "");
	const trimmed = out.trimEnd();
	return trimmed.length === 0 ? "" : `${trimmed}\n`;
}

/** Replace (or append) the omp-shell block; removes giverny blocks too. */
export function upsertBlock(content: string, body: string): string {
	const base = stripBlock(stripBlock(content, GIVERNY_MARKERS), OMP_MARKERS).trimEnd();
	const block = `${OMP_MARKERS.start}\n${NOTE}\n${body}\n${OMP_MARKERS.end}\n`;
	return base.length === 0 ? block : `${base}\n\n${block}`;
}

/** Remove both omp-shell and giverny blocks. */
export function removeBlocks(content: string): string {
	return stripBlock(stripBlock(content, GIVERNY_MARKERS), OMP_MARKERS);
}
