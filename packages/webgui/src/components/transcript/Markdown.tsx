import { Marked, Renderer } from "@oh-my-pi/pi-utils/marked";
import type { MarkedExtension, Token, Tokens, TokensList } from "@oh-my-pi/pi-utils/marked";
import { type MathSpan, mathBlockAt, mathSpanAt, mathStartIndex } from "@oh-my-pi/pi-utils/math-delimiters";
import type { renderToString } from "katex";
import type { Mermaid } from "mermaid";
import type { ReactNode } from "react";
import {
	type MouseEvent,
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { browserWindow } from "../../lib/dom";
import { highlightMagicWords } from "../../lib/magic-words";
import { type BlockContainer, type MountedBlock, patchBlocks } from "./markdown-blocks";
import { MermaidViewer } from "./MermaidViewer";
import { escapeHtml } from "./format";

// ---------------------------------------------------------------------------
// katex loads on the first math token. It is ~600KB, larger than everything
// else in the bundle combined, and most sessions never contain math.
// ---------------------------------------------------------------------------

let renderKatex: typeof renderToString | null = null;
let katexLoading: Promise<void> | null = null;
const katexListeners = new Set<() => void>();

function ensureKatex(): void {
	if (renderKatex !== null || katexLoading !== null) return;
	katexLoading = import("katex").then(mod => {
		renderKatex = mod.renderToString;
		for (const fn of katexListeners) fn();
	});
}

function subscribeKatex(fn: () => void): () => void {
	katexListeners.add(fn);
	return () => {
		katexListeners.delete(fn);
	};
}

function katexReady(): boolean {
	return renderKatex !== null;
}

// ---------------------------------------------------------------------------
// mermaid loads on the first closed ```mermaid fence, like katex. Its render
// is async, so finished SVGs go into a cache and listeners re-render.
// ---------------------------------------------------------------------------

const MERMAID_CACHE_MAX = 100;
let mermaidLoading: Promise<Mermaid> | null = null;
let mermaidSeq = 0;
let mermaidVersion = 0;
const mermaidListeners = new Set<() => void>();
/** Diagram source to SVG, or null when mermaid rejected it (source stays shown). */
const mermaidCache = new Map<string, string | null>();
const mermaidPending = new Set<string>();

function loadMermaid(): Promise<Mermaid> {
	mermaidLoading ??= import("mermaid").then(mod => {
		const api = mod.default;
		// strict: mermaid sanitizes labels and disables click handlers, since
		// diagram source comes from model output.
		api.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			theme: "dark",
			// Without this a parse error appends mermaid's error SVG to <body>.
			suppressErrorRendering: true,
			// mermaid 12 defaults to ELK, a 1.5MB chunk fetched on the first
			// diagram. Diagrams that set `layout: elk` still load it on demand.
			layout: "dagre",
		});
		return api;
	});
	return mermaidLoading;
}

function settleMermaid(source: string, svg: string | null): void {
	mermaidPending.delete(source);
	if (mermaidCache.size >= MERMAID_CACHE_MAX) {
		const oldest = mermaidCache.keys().next().value;
		if (oldest !== undefined) mermaidCache.delete(oldest);
	}
	mermaidCache.set(source, svg);
	mermaidVersion++;
	for (const fn of mermaidListeners) fn();
}

function requestMermaid(source: string): void {
	if (mermaidCache.has(source) || mermaidPending.has(source)) return;
	mermaidPending.add(source);
	void loadMermaid()
		.then(api => api.render(`tr-mermaid-${++mermaidSeq}`, source))
		.then(
			({ svg }) => settleMermaid(source, svg),
			() => settleMermaid(source, null),
		);
}

function subscribeMermaid(fn: () => void): () => void {
	mermaidListeners.add(fn);
	return () => {
		mermaidListeners.delete(fn);
	};
}

function mermaidSnapshot(): number {
	return mermaidVersion;
}

/** A fence still streaming has no closing marker; rendering it would parse half a diagram per delta. */
function fenceClosed(raw: string): boolean {
	const end = raw.trimEnd();
	return end.length > 3 && (end.endsWith("```") || end.endsWith("~~~"));
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

function unescapeHtml(raw: string): string {
	const parseCodePoint = (value: number): string => {
		if (Number.isFinite(value) && value >= 0 && value <= 0x10ffff) {
			try {
				return String.fromCodePoint(value);
			} catch {}
		}
		return "";
	};
	return raw.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);/gi, (match, entity) => {
		const lower = entity.toLowerCase();
		switch (lower) {
			case "nbsp":
				return " ";
			case "lt":
				return "<";
			case "gt":
				return ">";
			case "quot":
				return '"';
			case "apos":
				return "'";
			case "amp":
				return "&";
			default: {
				if (lower.startsWith("#x")) return parseCodePoint(Number.parseInt(lower.slice(2), 16));
				if (lower.startsWith("#")) return parseCodePoint(Number(lower.slice(1)));
				return match;
			}
		}
	});
}

function safeHref(href: string): string | null {
	const trimmed = href.trim();
	let protocol: string;
	try {
		({ protocol } = new URL(trimmed, "https://relative.invalid/"));
	} catch {
		return null;
	}
	if (protocol === "https:" || protocol === "http:" || protocol === "mailto:") return trimmed;
	return null;
}

// ---------------------------------------------------------------------------
// Math extension
// ---------------------------------------------------------------------------

function typesettable(span: MathSpan): boolean {
	return !span.body.includes("`");
}

function renderMath(token: Tokens.Generic): string | false {
	if (token.type !== "math" || typeof token.text !== "string" || typeof token.display !== "boolean") return false;
	const raw = escapeHtml(typeof token.raw === "string" ? token.raw : token.text);
	if (renderKatex === null) {
		ensureKatex();
		return raw;
	}
	try {
		const math = renderKatex(token.text, {
			displayMode: token.display,
			output: "mathml",
			throwOnError: false,
			strict: false,
			trust: false,
		});
		return token.display ? `<span class="tr-math">${math}</span>` : math;
	} catch {
		return raw;
	}
}

const mathExtension: MarkedExtension = {
	extensions: [
		{
			name: "math",
			level: "block",
			tokenizer(source) {
				const block = mathBlockAt(source);
				if (!block) return undefined;
				return { type: "math", raw: block.raw, text: block.body, display: true };
			},
			renderer: renderMath,
		},
		{
			name: "math",
			level: "inline",
			start: mathStartIndex,
			tokenizer(source) {
				const span = mathSpanAt(source, 0);
				if (!span || !typesettable(span)) return undefined;
				return { type: "math", raw: source.slice(0, span.end), text: span.body, display: span.display };
			},
			renderer: renderMath,
		},
	],
};

const tableExtension: MarkedExtension = {
	extensions: [
		{
			name: "table",
			level: "block",
			renderer(this: { parser: { renderer: Renderer } }, token: Tokens.Generic) {
				const html = Renderer.prototype.table.call(this.parser.renderer, token as unknown as Tokens.Table);
				return `<div class="tr-table-wrap">${html}</div>`;
			},
		},
	],
};

const md = new Marked({
	gfm: true,
	renderer: {
		html({ text }) {
			const cleaned = text.replace(/<\/?(?:advisory|span|text)\b(?:\s[^>]*)?\s*\/?>/gi, "");
			if (cleaned === "") return "";
			return escapeHtml(unescapeHtml(cleaned));
		},
		code({ text, lang, raw, codeBlockStyle }) {
			if (lang?.trim().toLowerCase() === "mermaid" && fenceClosed(raw)) {
				const svg = mermaidCache.get(text);
				if (svg) return `<div class="tr-mermaid">${svg}</div>`;
				if (svg === undefined) requestMermaid(text);
				return false;
			}
			if (codeBlockStyle === "indented") return false;
			const langClass = lang ? ` class="language-${escapeHtml(lang.trim().split(/\s+/)[0])}"` : "";
			const copyBtn = `<button type="button" class="tr-copy-btn tr-copy-btn--fence" aria-label="Copy" title="Copy"><svg class="tr-copy-icon tr-copy-icon--copy" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><svg class="tr-copy-icon tr-copy-icon--check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span class="tr-copy-label">Copy</span><span class="tr-copy-label tr-copy-label--copied">Copied</span></button>`;
			return `<div class="tr-fence-wrap">${copyBtn}<pre><code${langClass}>${escapeHtml(text)}\n</code></pre></div>`;
		},
		link({ href, title, tokens }) {
			const inner = this.parser.parseInline(tokens);
			const url = safeHref(href);
			if (url === null) return inner;
			const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
			return `<a href="${escapeHtml(url)}"${titleAttr} target="_blank" rel="noopener">${inner}</a>`;
		},
	},
	breaks: true,
});
md.use(tableExtension);
md.use(mathExtension);

export function renderMarkdown(text: string): string {
	try {
		return md.parse(text, { async: false });
	} catch {
		return escapeHtml(text);
	}
}

interface BlockCache {
	sig: string;
	html: Map<string, string>;
}

/**
 * HTML per top-level block. The whole text is lexed each call (reference links
 * resolve across blocks), but a block whose source and context are unchanged
 * reuses its HTML from `cache`, so a streaming delta renders only the tail.
 */
function renderMarkdownBlocks(text: string, magicWords: boolean, context: string, cache: BlockCache): string[] {
	let tokens: TokensList;
	try {
		tokens = md.lexer(text);
	} catch {
		return [escapeHtml(text)];
	}
	// A link definition anywhere changes how earlier blocks resolved at lex time.
	const sig = `${magicWords}\0${context}\0${Object.keys(tokens.links).length ? JSON.stringify(tokens.links) : ""}`;
	const previous = cache.sig === sig ? cache.html : null;
	const next = new Map<string, string>();
	const out: string[] = [];
	try {
		for (const token of tokens) {
			let html = previous?.get(token.raw) ?? next.get(token.raw);
			if (html === undefined) {
				const single: Token[] & { links?: TokensList["links"] } = [token];
				single.links = tokens.links;
				const rendered = md.parser(single);
				html = magicWords ? highlightMagicWords(rendered) : rendered;
			}
			next.set(token.raw, html);
			out.push(html);
		}
	} catch {
		return [escapeHtml(text)];
	}
	cache.sig = sig;
	cache.html = next;
	return out;
}

export const Markdown = memo(function Markdown({
	text,
	magicWords = false,
}: {
	text: string;
	magicWords?: boolean;
}): ReactNode {
	// Re-render once katex or a mermaid diagram arrives so raw source gets replaced.
	const ready = useSyncExternalStore(subscribeKatex, katexReady, katexReady);
	const diagrams = useSyncExternalStore(subscribeMermaid, mermaidSnapshot, mermaidSnapshot);
	const cache = useRef<BlockCache>({ sig: "", html: new Map() });
	const blocks = useMemo(
		() => renderMarkdownBlocks(text, magicWords, `${ready}\0${diagrams}`, cache.current),
		[text, magicWords, ready, diagrams],
	);
	// First paint goes through React (also covers server rendering); later
	// updates patch only the changed blocks, so this prop must never change.
	const [initialHtml] = useState(() => ({ __html: blocks.join("") }));
	const container = useRef<HTMLDivElement>(null);
	const mounted = useRef<MountedBlock[] | null>(null);
	const initialBlocks = useRef<readonly string[] | null>(blocks);
	useLayoutEffect(() => {
		const el = container.current;
		if (!el) return;
		if (initialBlocks.current === blocks) return;
		initialBlocks.current = null;
		mounted.current = patchBlocks(el as unknown as BlockContainer, mounted.current, blocks);
	}, [blocks]);
	const [openSvg, setOpenSvg] = useState<string | null>(null);
	const copyTimers = useRef<Map<HTMLElement, number>>(new Map());
	const close = useCallback(() => setOpenSvg(null), []);

	useEffect(() => {
		const timers = copyTimers.current;
		return () => {
			for (const id of timers.values()) {
				clearTimeout(id);
			}
			timers.clear();
		};
	}, []);

	// Event delegation: diagram viewer and code fence copy buttons.
	const onClick = (e: MouseEvent<HTMLDivElement>) => {
		const target = e.target as unknown as HTMLElement;
		const copyBtn = target.closest(".tr-copy-btn--fence");
		if (copyBtn) {
			e.stopPropagation();
			const wrap = copyBtn.closest(".tr-fence-wrap");
			const codeEl = wrap?.querySelector("pre > code");
			const textToCopy = codeEl ? (codeEl.textContent ?? "").replace(/\n$/, "") : "";
			const clipboard = browserWindow.navigator?.clipboard;
			if (clipboard?.writeText) {
				clipboard
					.writeText(textToCopy)
					.then(() => {
						copyBtn.classList.add("tr-copy-btn--copied");
						copyBtn.setAttribute("aria-label", "Copied");
						copyBtn.setAttribute("title", "Copied");
						const existing = copyTimers.current.get(copyBtn);
						if (existing !== undefined) clearTimeout(existing);
						const id = setTimeout(() => {
							copyBtn.classList.remove("tr-copy-btn--copied");
							copyBtn.setAttribute("aria-label", "Copy");
							copyBtn.setAttribute("title", "Copy");
							copyTimers.current.delete(copyBtn);
						}, 1500) as unknown as number;
						copyTimers.current.set(copyBtn, id);
					})
					.catch(() => {});
			}
			return;
		}

		const diagram = target.closest(".tr-mermaid");
		if (diagram) setOpenSvg(diagram.innerHTML);
	};
	return (
		<>
			<div ref={container} className="tr-md" onClick={onClick} dangerouslySetInnerHTML={initialHtml} />
			{openSvg !== null && <MermaidViewer svg={openSvg} onClose={close} />}
		</>
	);
});
