import { Marked } from "@oh-my-pi/pi-utils/marked";
import type { MarkedExtension, Tokens } from "@oh-my-pi/pi-utils/marked";
import { type MathSpan, mathBlockAt, mathSpanAt, mathStartIndex } from "@oh-my-pi/pi-utils/math-delimiters";
import type { renderToString } from "katex";
import type { Mermaid } from "mermaid";
import type { ReactNode } from "react";
import { type MouseEvent, memo, useCallback, useMemo, useState, useSyncExternalStore } from "react";
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

const md = new Marked({
	gfm: true,
	renderer: {
		html({ text }) {
			const cleaned = text.replace(/<\/?(?:advisory|span|text)\b(?:\s[^>]*)?\s*\/?>/gi, "");
			if (cleaned === "") return "";
			return escapeHtml(unescapeHtml(cleaned));
		},
		code({ text, lang, raw }) {
			if (lang?.trim().toLowerCase() !== "mermaid" || !fenceClosed(raw)) return false;
			const svg = mermaidCache.get(text);
			if (svg) return `<div class="tr-mermaid">${svg}</div>`;
			if (svg === undefined) requestMermaid(text);
			return false;
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
md.use(mathExtension);

export function renderMarkdown(text: string): string {
	try {
		return md.parse(text, { async: false });
	} catch {
		return escapeHtml(text);
	}
}

export const Markdown = memo(function Markdown({ text }: { text: string }): ReactNode {
	// Re-render once katex or a mermaid diagram arrives so raw source gets replaced.
	const ready = useSyncExternalStore(subscribeKatex, katexReady, katexReady);
	const diagrams = useSyncExternalStore(subscribeMermaid, mermaidSnapshot, mermaidSnapshot);
	const html = useMemo(() => renderMarkdown(text), [text, ready, diagrams]);
	const [openSvg, setOpenSvg] = useState<string | null>(null);
	const close = useCallback(() => setOpenSvg(null), []);
	// Event delegation: the diagram markup comes from dangerouslySetInnerHTML.
	const onClick = (e: MouseEvent<HTMLDivElement>) => {
		// Clicks inside this div come from its HTML descendants.
		const target = e.target as unknown as HTMLElement;
		const diagram = target.closest(".tr-mermaid");
		if (diagram) setOpenSvg(diagram.innerHTML);
	};
	return (
		<>
			<div className="tr-md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
			{openSvg !== null && <MermaidViewer svg={openSvg} onClose={close} />}
		</>
	);
});
