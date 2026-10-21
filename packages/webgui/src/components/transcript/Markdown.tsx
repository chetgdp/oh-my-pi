import { Marked, Renderer } from "@oh-my-pi/pi-utils/marked";
import type { MarkedExtension, Token, Tokens, TokensList } from "@oh-my-pi/pi-utils/marked";
import { type MathSpan, mathBlockAt, mathSpanAt, mathStartIndex } from "@oh-my-pi/pi-utils/math-delimiters";
import type * as Katex from "katex";
import type * as PeleLazy from "pele/lazy";
import type { DiagramType } from "pele/lazy";
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
import { highlighter, resolveLanguage } from "../../lib/highlight";
import { LazyModule } from "../../lib/lazy-module";
import { highlightMagicWords } from "../../lib/magic-words";
import { type BlockContainer, type MountedBlock, patchBlocks } from "./markdown-blocks";
import { type LexState, createLexState, lexIncremental } from "./markdown-lex";
import { MermaidViewer } from "./MermaidViewer";
import { escapeHtml } from "./format";

// ---------------------------------------------------------------------------
// katex loads on the first math token. It is ~600KB, larger than everything
// else in the bundle combined, and most sessions never contain math.
// ---------------------------------------------------------------------------

const katex = new LazyModule<typeof Katex>(() => import("katex"));

// ---------------------------------------------------------------------------
// Diagrams: ```mermaid fences render with Pele. `pele/lazy` loads on the first
// closed fence and each diagram type is its own chunk; once a type is loaded,
// diagrams of that type render synchronously inside the markdown pass.
// ---------------------------------------------------------------------------

const DIAGRAM_CACHE_MAX = 100;
/** Below the md breakpoint, pass the viewport width so Pele picks a narrow layout. */
const NARROW_VIEWPORT_PX = 720;
/** `.tr-md` horizontal padding plus the transcript gutter on phones. */
const NARROW_GUTTER_PX = 32;
const pele = new LazyModule<typeof PeleLazy>(() => import("pele/lazy"));
const diagramTypes = new Map<DiagramType, LazyModule<boolean>>();
let diagramSeq = 0;
/**
 * Diagram source to SVG, or null when Pele rejected the source (source stays
 * shown). Load failures are never stored here, so a later render retries.
 */
const diagramCache = new Map<string, string | null>();
let diagramVersion = 0;
const diagramListeners = new Set<() => void>();

function notifyDiagrams(): void {
	diagramVersion++;
	for (const fn of diagramListeners) fn();
}
pele.subscribe(notifyDiagrams);

function storeDiagram(source: string, svg: string | null): void {
	if (diagramCache.size >= DIAGRAM_CACHE_MAX) {
		const oldest = diagramCache.keys().next().value;
		if (oldest !== undefined) diagramCache.delete(oldest);
	}
	diagramCache.set(source, svg);
}

function diagramTypeLoader(api: typeof PeleLazy, type: DiagramType): LazyModule<boolean> {
	let loader = diagramTypes.get(type);
	if (loader === undefined) {
		loader = new LazyModule(() => api.load(type));
		loader.subscribe(notifyDiagrams);
		diagramTypes.set(type, loader);
	}
	return loader;
}

/**
 * SVG for a closed mermaid fence; null when the source is not a diagram Pele
 * can draw; undefined while Pele or the diagram type is still loading.
 */
function diagramSvg(source: string): string | null | undefined {
	const cached = diagramCache.get(source);
	if (cached !== undefined) return cached;
	const api = pele.value;
	if (api === null) {
		pele.request();
		return undefined;
	}
	try {
		// Malformed frontmatter or directives can throw before a type is known.
		const type = api.detectType(source);
		if (type !== null && !api.registered(type)) {
			diagramTypeLoader(api, type).request();
			return undefined;
		}
		const width = browserWindow.innerWidth;
		const svg =
			type === null
				? null
				: api.render(source, {
						// Diagram source is model output: no outbound links or image fetches.
						links: false,
						images: false,
						idPrefix: `tr-pele-${++diagramSeq}-`,
						maxWidth: width > 0 && width < NARROW_VIEWPORT_PX ? width - NARROW_GUTTER_PX : undefined,
					}).svg;
		storeDiagram(source, svg);
		return svg;
	} catch (err) {
		// PeleError is a verdict on the source; anything else is a renderer bug,
		// so the source shows without caching and the next render tries again.
		if (err instanceof api.PeleError) storeDiagram(source, null);
		return null;
	}
}

function subscribeDiagrams(fn: () => void): () => void {
	diagramListeners.add(fn);
	return () => {
		diagramListeners.delete(fn);
	};
}

function diagramSnapshot(): number {
	return diagramVersion;
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
	const api = katex.value;
	if (api === null) {
		katex.request();
		return raw;
	}
	try {
		const math = api.renderToString(token.text, {
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
				const svg = diagramSvg(text);
				if (svg) return `<div class="tr-diagram">${svg}</div>`;
				return false;
			}
			if (codeBlockStyle === "indented") return false;
			const langName = lang?.trim().split(/\s+/)[0];
			const langClass = langName ? ` class="language-${escapeHtml(langName)}"` : "";
			const langTag = langName
				? `<span class="tr-fence-lang" aria-hidden="true">${escapeHtml(langName)}</span>`
				: "";
			const copyBtn = `<button type="button" class="tr-copy-btn tr-copy-btn--fence" aria-label="Copy" title="Copy"><svg class="tr-copy-icon tr-copy-icon--copy" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><svg class="tr-copy-icon tr-copy-icon--check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span class="tr-copy-label">Copy</span><span class="tr-copy-label tr-copy-label--copied">Copied</span></button>`;
			const body = highlighter.highlight(text, resolveLanguage(lang)) ?? escapeHtml(text);
			return `<div class="tr-fence-wrap">${copyBtn}<pre>${langTag}<code${langClass}>${body}\n</code></pre></div>`;
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

/** Streaming render: same HTML as `renderMarkdown`, reusing `state`'s stable prefix tokens. */
export function renderMarkdownStreaming(text: string, state: LexState): string {
	return md.parser(lexIncremental(text, state, src => md.lexer(src)));
}

interface BlockCache {
	sig: string;
	html: Map<string, string>;
	lex: LexState;
}

/**
 * HTML per top-level block. Text is lexed incrementally (only the tail after
 * the last stable block; full lex when reference links or open math could
 * reach back), and a block whose source and context are unchanged reuses its
 * HTML from `cache`, so a streaming delta renders only the tail.
 */
function renderMarkdownBlocks(text: string, magicWords: boolean, context: string, cache: BlockCache): string[] {
	let tokens: TokensList;
	try {
		tokens = lexIncremental(text, cache.lex, src => md.lexer(src));
	} catch {
		cache.lex = createLexState();
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
	// Re-render once katex, Pele, a diagram type, or a grammar arrives so raw source gets replaced.
	const ready = useSyncExternalStore(katex.subscribe, katex.snapshot, katex.snapshot) !== null;
	const diagrams = useSyncExternalStore(subscribeDiagrams, diagramSnapshot, diagramSnapshot);
	const grammars = useSyncExternalStore(highlighter.subscribe, highlighter.snapshot, highlighter.snapshot);
	const cache = useRef<BlockCache>({ sig: "", html: new Map(), lex: createLexState() });
	const blocks = useMemo(
		() => renderMarkdownBlocks(text, magicWords, `${ready}\0${diagrams}\0${grammars}`, cache.current),
		[text, magicWords, ready, diagrams, grammars],
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

		const diagram = target.closest(".tr-diagram");
		if (diagram) setOpenSvg(diagram.innerHTML);
	};
	return (
		<>
			<div ref={container} className="tr-md" onClick={onClick} dangerouslySetInnerHTML={initialHtml} />
			{openSvg !== null && <MermaidViewer svg={openSvg} onClose={close} />}
		</>
	);
});
