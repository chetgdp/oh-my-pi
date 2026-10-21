/**
 * Shared UI primitives for tool renderers. Every renderer composes these
 * instead of inventing new CSS — see tool-render.css for the `tv-` classes.
 */
import type { ReactNode } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CopyButton } from "../CopyButton";
import type { ToolRenderHost, ToolResultImage, ToolResultLike } from "./types";
import { type DiffRow, parseDiffRows, type WordSpan, wordSpans } from "../../../lib/diff-rows";
import { highlighter, type TokenRun, tokenLines } from "../../../lib/highlight";
import { replaceTabs, resultImagesOf, resultTextOf, shortenPath, stripAnsi } from "./util";

export type Tone = "accent" | "ok" | "err" | "warn";

/** Inline chip. Renders nothing for empty content. */
export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }): ReactNode {
	if (children == null || children === "" || children === false) return null;
	return <span className={`tv-badge${tone ? ` tv-badge--${tone}` : ""}`}>{children}</span>;
}

/** Chip row; falsy items are skipped. Usable inline (summaries) and in bodies. */
export function Badges({ items }: { items: ReadonlyArray<ReactNode> }): ReactNode {
	const visible = items.filter(item => item != null && item !== "" && item !== false);
	if (visible.length === 0) return null;
	return (
		<span className="tv-badges">
			{visible.map((item, i) => (
				<Badge key={i}>{item}</Badge>
			))}
		</span>
	);
}

/** File path with optional `:start-end` line range or raw selector suffix. */
export function PathText({
	path,
	from,
	to,
	sel,
}: {
	path: string;
	from?: number | null;
	to?: number | null;
	sel?: string | null;
}): ReactNode {
	let range = "";
	if (from != null || to != null) {
		const start = from ?? 1;
		range = to != null ? `:${start}-${to}` : `:${start}`;
	}
	return (
		<span className="tv-path">
			{shortenPath(path)}
			{range && <span className="tv-lines">{range}</span>}
			{sel && <span className="tv-lines">:{sel}</span>}
		</span>
	);
}

/** Key/value grid. */
export function KvGrid({ children }: { children: ReactNode }): ReactNode {
	return <div className="tv-kv">{children}</div>;
}

export function Kv({ k, children }: { k: ReactNode; children: ReactNode }): ReactNode {
	if (children == null || children === "" || children === false) return null;
	return (
		<>
			<span className="tv-kv-key">{k}</span>
			<span className="tv-kv-val">{children}</span>
		</>
	);
}

/** Highlighted HTML for `code`, or null (plain) until the grammar loads or when unsupported/too large. */
function useHighlight(code: string, lang: string | null | undefined): string | null {
	const grammars = useSyncExternalStore(highlighter.subscribe, highlighter.snapshot, highlighter.snapshot);
	return useMemo(() => (grammars >= 0 ? highlighter.highlight(code, lang) : null), [code, lang, grammars]);
}

/** Inline syntax-highlighted text (plain until the grammar loads). */
export function HighlightedText({ text, lang }: { text: string; lang: string | null }): ReactNode {
	const html = useHighlight(text, lang);
	return html === null ? text : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export interface OutputProps {
	text: string;
	/** Lines shown before collapsing behind a "more" affordance. */
	maxLines?: number;
	/** highlight.js language id (see lib/highlight); null renders plain text. */
	lang?: string | null;
	/** Render in error color. */
	error?: boolean;
	/** Uppercase mini-title above the block. */
	title?: string;
	/** Drop the inset background (inline in flow). */
	bare?: boolean;
}

/**
 * Expandable text block — the workhorse for command output, file previews,
 * search results. Tabs are widened, ANSI escapes stripped.
 */
export function Output({ text, maxLines = 10, lang, error, title, bare }: OutputProps): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const clean = useMemo(() => replaceTabs(stripAnsi(text)).replace(/\n+$/, ""), [text]);
	const lines = useMemo(() => clean.split("\n"), [clean]);
	const collapsible = lines.length > maxLines + 1;
	const shown = collapsible && !expanded ? lines.slice(0, maxLines).join("\n") : clean;
	const html = useHighlight(shown, error ? null : lang);
	const classes = ["tv-pre"];
	if (error) classes.push("tv-pre--error");
	if (bare) classes.push("tv-pre--bare");
	return (
		<div className="tv-out">
			<div className="tv-out-header">
				{title && <div className="tv-out-title">{title}</div>}
				<CopyButton text={clean} className="tv-out-copy" />
			</div>
			{html !== null ? (
				<pre className={classes.join(" ")} dangerouslySetInnerHTML={{ __html: html }} />
			) : (
				<pre className={classes.join(" ")}>{shown}</pre>
			)}
			{collapsible && (
				<button type="button" className="tv-expand" onClick={() => setExpanded(v => !v)}>
					{expanded ? "collapse" : `⋯ ${lines.length - maxLines} more lines`}
				</button>
			)}
		</div>
	);
}

/** Source-code block: inset background, optional title chip. */
export function CodeBlock({
	code,
	lang,
	title,
	maxLines = 14,
}: {
	code: string;
	lang?: string | null;
	title?: string;
	maxLines?: number;
}): ReactNode {
	if (!code) return null;
	return <Output text={code} lang={lang} maxLines={maxLines} title={title} />;
}

/**
 * Result text of a tool result, styled for success or error automatically.
 * Renders nothing when the result is absent or has no text.
 */
export function ResultText({
	result,
	maxLines = 10,
	lang,
	title,
}: {
	result: ToolResultLike | undefined;
	maxLines?: number;
	lang?: string | null;
	title?: string;
}): ReactNode {
	const text = resultTextOf(result).trim();
	if (!text) return null;
	return (
		<Output
			text={text}
			maxLines={maxLines}
			lang={result?.isError ? null : lang}
			error={result?.isError === true}
			title={title}
		/>
	);
}

function openImage(img: ToolResultImage): void {
	try {
		const bin = atob(img.data);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		const url = URL.createObjectURL(new Blob([bytes], { type: img.mimeType }));
		window.open(url, "_blank", "noopener");
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	} catch {
		// undecodable image data — the broken thumbnail already conveys it
	}
}

/** Thumbnails for every image block in a result; click opens full size. */
export function ResultImages({ result }: { result: ToolResultLike | undefined }): ReactNode {
	const images = resultImagesOf(result);
	if (images.length === 0) return null;
	return (
		<div className="tv-imgs">
			{images.map((img, i) => (
				<button
					key={i}
					type="button"
					style={{ all: "unset", display: "inline-flex" }}
					onClick={() => openImage(img)}
					aria-label={`Open tool result image ${i + 1}`}
				>
					<img className="tv-img" src={`data:${img.mimeType};base64,${img.data}`} alt={`tool result ${i + 1}`} />
				</button>
			))}
		</div>
	);
}

/** Callout block. */
export function Note({ tone, children }: { tone?: "err" | "warn" | "ok"; children: ReactNode }): ReactNode {
	if (children == null || children === "" || children === false) return null;
	return <div className={`tv-note${tone ? ` tv-note--${tone}` : ""}`}>{children}</div>;
}

/** Labeled row inside a `.tv-list`. */
export function Row({ k, children }: { k?: ReactNode; children: ReactNode }): ReactNode {
	return (
		<div className="tv-row">
			{k != null && k !== "" && <span className="tv-row-key">{k}</span>}
			<span className="tv-row-val">{children}</span>
		</div>
	);
}

/** Marker for arguments that arrived with the wrong JSON type. */
export function InvalidArg({ what }: { what?: string }): ReactNode {
	return <span className="tv-err-text">[invalid {what ?? "arg"}]</span>;
}

/**
 * Diff block. One DOM serves both layouts: a 4-column grid (old number, old
 * text, new number, new text) side by side, which a container query re-flows
 * into 2 columns below 720px so modified rows stack removed-then-added
 * (unified). Modified pairs carry word-level highlights; with `lang`, each
 * side is syntax-highlighted as one text so multi-line tokens stay intact.
 */
export function DiffBlock({
	diff,
	maxLines = 80,
	lang,
}: {
	diff: string;
	maxLines?: number;
	lang?: string | null;
}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const clean = useMemo(() => replaceTabs(stripAnsi(diff)).replace(/\n+$/, ""), [diff]);
	const lines = useMemo(() => clean.split("\n"), [clean]);
	const rows = useMemo(() => parseDiffRows(clean), [clean]);
	const collapsible = rows.length > maxLines + 1;
	const shown = collapsible && !expanded ? rows.slice(0, maxLines) : rows;
	const newSideText = useMemo(() => {
		return lines
			.filter(
				line =>
					!line.startsWith("-") && !line.startsWith("@@") && !line.startsWith("---") && !line.startsWith("+++"),
			)
			.map(line => (line.startsWith("+") ? line.slice(1) : line))
			.join("\n")
			.replace(/\n+$/, "");
	}, [lines]);
	const grammars = useSyncExternalStore(highlighter.subscribe, highlighter.snapshot, highlighter.snapshot);
	const sideTokens = useMemo(() => {
		if (!lang || grammars < 0) return null;
		const left: string[] = [];
		const right: string[] = [];
		for (const row of rows) {
			if (row.left) left.push(row.left.text);
			if (row.right) right.push(row.right.text);
		}
		const leftHtml = highlighter.highlight(left.join("\n"), lang);
		const rightHtml = highlighter.highlight(right.join("\n"), lang);
		if (leftHtml === null || rightHtml === null) return null;
		return { left: tokenLines(leftHtml), right: tokenLines(rightHtml) };
	}, [rows, lang, grammars]);
	const rendered: ReactNode[] = [];
	let leftIdx = 0;
	let rightIdx = 0;
	for (let i = 0; i < shown.length; i++) {
		const row = shown[i];
		const leftRuns = row.left ? sideTokens?.left[leftIdx++] : undefined;
		const rightRuns = row.right ? sideTokens?.right[rightIdx++] : undefined;
		rendered.push(renderDiffRow(row, i, leftRuns, rightRuns));
	}

	return (
		<div className="tv-out">
			<div className="tv-out-header">
				<CopyButton text={newSideText} className="tv-out-copy" />
			</div>
			<div className="tv-diff">
				<div className="tv-diff-grid">{rendered}</div>
			</div>
			{collapsible && (
				<button type="button" className="tv-expand" onClick={() => setExpanded(v => !v)}>
					{expanded ? "collapse" : `⋯ ${rows.length - maxLines} more lines`}
				</button>
			)}
		</div>
	);
}

/**
 * One diff cell: syntax token runs (when highlighted) overlaid with word-change
 * spans, so a changed word keeps both its token color and its change tint.
 */
function renderCell(
	runs: readonly TokenRun[] | undefined,
	spans: readonly WordSpan[] | undefined,
	text: string,
	mark: "add" | "del",
): ReactNode {
	if (text.length === 0) return "\u00a0";
	const wordClass = `tv-diff-word tv-diff-word--${mark}`;
	// Token runs must cover the cell text exactly; otherwise fall back to word spans only.
	if (runs === undefined || runs.map(r => r.text).join("") !== text) {
		if (spans === undefined) return text;
		return spans.map((s, i) =>
			s.changed ? (
				<span key={i} className={wordClass}>
					{s.text}
				</span>
			) : (
				s.text
			),
		);
	}
	const out: ReactNode[] = [];
	let spanIdx = 0;
	let spanOffset = 0;
	for (const run of runs) {
		let rest = run.text;
		while (rest.length > 0) {
			while (spans !== undefined && spanIdx < spans.length && spanOffset >= spans[spanIdx].text.length) {
				spanIdx++;
				spanOffset = 0;
			}
			const span = spans?.[spanIdx];
			const take = span ? Math.min(rest.length, span.text.length - spanOffset) : rest.length;
			const piece = rest.slice(0, take);
			const className = span?.changed
				? run.className
					? `${run.className} ${wordClass}`
					: wordClass
				: run.className;
			out.push(
				className ? (
					<span key={out.length} className={className}>
						{piece}
					</span>
				) : (
					piece
				),
			);
			rest = rest.slice(take);
			spanOffset += take;
		}
	}
	return out;
}

/** Four cells per row (rows use `display: contents`); empty sides keep their cells so the grid stays aligned. */
function renderDiffRow(
	row: DiffRow,
	key: number,
	leftRuns: readonly TokenRun[] | undefined,
	rightRuns: readonly TokenRun[] | undefined,
): ReactNode {
	if (row.kind === "separator") {
		return (
			<div key={key} className="tv-diff-row tv-diff-row--sep">
				<div className="tv-diff-sep">{row.label ? row.label : "…"}</div>
			</div>
		);
	}
	const words = row.kind === "modified" && row.left && row.right ? wordSpans(row.left.text, row.right.text) : null;
	const leftMod = row.kind === "context" ? "ctx" : row.left ? "del" : "empty";
	const rightMod = row.kind === "context" ? "ctx" : row.right ? "add" : "empty";
	return (
		<div key={key} className={`tv-diff-row tv-diff-row--${row.kind}`}>
			<div className={`tv-diff-num tv-diff-l tv-diff--${leftMod}`}>{row.left?.line ?? ""}</div>
			<div className={`tv-diff-text tv-diff-l tv-diff--${leftMod}`}>
				{row.left ? renderCell(leftRuns, words?.left, row.left.text, "del") : ""}
			</div>
			<div className={`tv-diff-num tv-diff-r tv-diff--${rightMod}`}>{row.right?.line ?? ""}</div>
			<div className={`tv-diff-text tv-diff-r tv-diff--${rightMod}`}>
				{row.right ? renderCell(rightRuns, words?.right, row.right.text, "add") : ""}
			</div>
		</div>
	);
}

/**
 * Agent id chip. Becomes a drill-down button when the host can open that
 * agent's sub-session; otherwise renders as a plain accent badge.
 */
export function AgentLink({
	id,
	host,
	children,
}: {
	id: string;
	host?: ToolRenderHost;
	children?: ReactNode;
}): ReactNode {
	const clickable = host?.openAgent !== undefined && (host.hasAgent === undefined || host.hasAgent(id));
	if (!clickable) return <Badge tone="accent">{children ?? id}</Badge>;
	return (
		<button type="button" className="tv-badge tv-badge--accent tv-agent-link" onClick={() => host.openAgent?.(id)}>
			{children ?? id}
			<span className="tv-agent-link-arrow" aria-hidden="true">
				{" ↗"}
			</span>
		</button>
	);
}
