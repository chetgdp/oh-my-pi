import { Marked } from "@oh-my-pi/pi-utils/marked";
import type { MarkedExtension, Tokens } from "@oh-my-pi/pi-utils/marked";
import { type MathSpan, mathBlockAt, mathSpanAt, mathStartIndex } from "@oh-my-pi/pi-utils/math-delimiters";
import type { renderToString } from "katex";
import type { ReactNode } from "react";
import { memo, useMemo, useSyncExternalStore } from "react";
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
	// Re-render once katex arrives so math emitted as raw source gets typeset.
	const ready = useSyncExternalStore(subscribeKatex, katexReady, katexReady);
	const html = useMemo(() => renderMarkdown(text), [text, ready]);
	return <div className="tr-md" dangerouslySetInnerHTML={{ __html: html }} />;
});
