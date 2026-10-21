/**
 * Syntax highlighting for markdown fences and tool code blocks.
 *
 * highlight.js core and each grammar are their own lazy chunks: the first
 * block in a language requests core + that grammar, renders plain text, and
 * re-renders highlighted once both arrive (subscribers are notified). After
 * that, highlighting is synchronous. A host page that already ships a full
 * highlight.js as `globalThis.hljs` (the HTML session export) is used
 * directly, so there is one code path for both hosts.
 */
import { LazyModule } from "./lazy-module";

/** A highlight.js grammar definition (`highlight.js/lib/languages/*` default export). */
export type LanguageFn = (hljs: unknown) => unknown;

/** Larger inputs render as plain text: highlighting cost grows with size and blocks the main thread. */
export const HIGHLIGHT_MAX_CHARS = 100_000;
export const HIGHLIGHT_MAX_LINES = 2000;

/** The subset of the highlight.js API this module calls. */
export interface HighlighterApi {
	getLanguage(name: string): unknown;
	highlight(code: string, options: { language: string; ignoreIllegals?: boolean }): { value: string };
	registerLanguage?(name: string, fn: LanguageFn): void;
}

type GrammarModule = { default: LanguageFn };

/** Bundled grammars, one chunk each. Keys are highlight.js language ids. */
const GRAMMARS: Record<string, () => Promise<GrammarModule>> = {
	bash: () => import("highlight.js/lib/languages/bash"),
	c: () => import("highlight.js/lib/languages/c"),
	cpp: () => import("highlight.js/lib/languages/cpp"),
	csharp: () => import("highlight.js/lib/languages/csharp"),
	css: () => import("highlight.js/lib/languages/css"),
	diff: () => import("highlight.js/lib/languages/diff"),
	dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
	go: () => import("highlight.js/lib/languages/go"),
	ini: () => import("highlight.js/lib/languages/ini"),
	java: () => import("highlight.js/lib/languages/java"),
	javascript: () => import("highlight.js/lib/languages/javascript"),
	json: () => import("highlight.js/lib/languages/json"),
	julia: () => import("highlight.js/lib/languages/julia"),
	kotlin: () => import("highlight.js/lib/languages/kotlin"),
	less: () => import("highlight.js/lib/languages/less"),
	lua: () => import("highlight.js/lib/languages/lua"),
	markdown: () => import("highlight.js/lib/languages/markdown"),
	php: () => import("highlight.js/lib/languages/php"),
	python: () => import("highlight.js/lib/languages/python"),
	ruby: () => import("highlight.js/lib/languages/ruby"),
	rust: () => import("highlight.js/lib/languages/rust"),
	scss: () => import("highlight.js/lib/languages/scss"),
	shell: () => import("highlight.js/lib/languages/shell"),
	sql: () => import("highlight.js/lib/languages/sql"),
	swift: () => import("highlight.js/lib/languages/swift"),
	typescript: () => import("highlight.js/lib/languages/typescript"),
	xml: () => import("highlight.js/lib/languages/xml"),
	yaml: () => import("highlight.js/lib/languages/yaml"),
};

/**
 * Fence info tokens, file extensions, and tool language names to a grammar
 * id. The single alias table: fences, file paths, and eval cells all resolve
 * through it.
 */
const ALIASES: Record<string, string> = {
	bash: "bash",
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	fish: "bash",
	ksh: "bash",
	console: "shell",
	"shell-session": "shell",
	c: "c",
	h: "c",
	cpp: "cpp",
	"c++": "cpp",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	hh: "cpp",
	cs: "csharp",
	csharp: "csharp",
	"c#": "csharp",
	css: "css",
	diff: "diff",
	patch: "diff",
	dockerfile: "dockerfile",
	docker: "dockerfile",
	go: "go",
	golang: "go",
	ini: "ini",
	toml: "ini",
	cfg: "ini",
	java: "java",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	javascript: "javascript",
	node: "javascript",
	json: "json",
	jsonc: "json",
	json5: "json",
	jsonl: "json",
	jl: "julia",
	julia: "julia",
	kt: "kotlin",
	kts: "kotlin",
	kotlin: "kotlin",
	less: "less",
	lua: "lua",
	md: "markdown",
	mdx: "markdown",
	markdown: "markdown",
	php: "php",
	py: "python",
	python: "python",
	python3: "python",
	ipy: "python",
	ipython: "python",
	rb: "ruby",
	ruby: "ruby",
	rs: "rust",
	rust: "rust",
	scss: "scss",
	sql: "sql",
	swift: "swift",
	ts: "typescript",
	tsx: "typescript",
	mts: "typescript",
	cts: "typescript",
	typescript: "typescript",
	html: "xml",
	htm: "xml",
	xml: "xml",
	svg: "xml",
	vue: "xml",
	yaml: "yaml",
	yml: "yaml",
};

/** Grammar id for a fence info string / language name / extension; null when unsupported (rendered plain). */
export function resolveLanguage(token: string | null | undefined): string | null {
	if (!token) return null;
	const first =
		token
			.trim()
			.split(/[\s{,]/, 1)[0]
			?.toLowerCase() ?? "";
	return ALIASES[first.startsWith(".") ? first.slice(1) : first] ?? null;
}

/** Grammar id for a file path by basename / extension; null when unsupported. */
export function languageFromPath(filePath: string): string | null {
	const base = filePath.split(/[\\/]/).pop() ?? "";
	if (/^(?:dockerfile|containerfile)(?:\..*)?$/i.test(base)) return "dockerfile";
	const dot = base.lastIndexOf(".");
	return dot < 0 ? null : resolveLanguage(base.slice(dot + 1));
}

/** True when `code` is small enough to highlight. */
export function withinHighlightLimits(code: string): boolean {
	if (code.length > HIGHLIGHT_MAX_CHARS) return false;
	let lines = 1;
	for (let i = code.indexOf("\n"); i !== -1; i = code.indexOf("\n", i + 1)) {
		if (++lines > HIGHLIGHT_MAX_LINES) return false;
	}
	return true;
}

/** A host-provided full highlight.js (the HTML export page), or null. */
function hostHljs(): HighlighterApi | null {
	const candidate: unknown = Reflect.get(globalThis, "hljs");
	if (typeof candidate !== "object" || candidate === null) return null;
	if (!("highlight" in candidate) || typeof candidate.highlight !== "function") return null;
	if (!("getLanguage" in candidate) || typeof candidate.getLanguage !== "function") return null;
	// Both called members were checked above; the export page's full highlight.js satisfies the rest.
	const api = candidate as HighlighterApi;
	return api;
}

export interface Highlighter {
	/** Highlighted HTML (escaped, `hljs-*` spans), or null to render plain text (unsupported, too large, or still loading). */
	highlight(code: string, language: string | null | undefined): string | null;
	subscribe(fn: () => void): () => void;
	/** Bumps whenever a grammar becomes available; include in render memo keys. */
	snapshot(): number;
}

export function createHighlighter(
	loadCore: () => Promise<HighlighterApi>,
	grammars: Record<string, () => Promise<GrammarModule>>,
): Highlighter {
	const core = new LazyModule<HighlighterApi>(loadCore);
	const modules = new Map<string, LazyModule<LanguageFn>>();
	const listeners = new Set<() => void>();
	let version = 0;

	const register = (): void => {
		const api = core.value;
		if (api === null) return;
		let added = false;
		for (const [name, mod] of modules) {
			const fn = mod.value;
			if (fn !== null && !api.getLanguage(name)) {
				api.registerLanguage?.(name, fn);
				added = true;
			}
		}
		if (!added) return;
		version++;
		for (const fn of listeners) fn();
	};
	core.subscribe(register);

	const grammar = (name: string): LazyModule<LanguageFn> | null => {
		let mod = modules.get(name);
		if (mod === undefined) {
			const load = grammars[name];
			if (load === undefined) return null;
			mod = new LazyModule(() => load().then(m => m.default));
			mod.subscribe(register);
			modules.set(name, mod);
		}
		return mod;
	};

	return {
		highlight(code, language) {
			if (!language || !withinHighlightLimits(code)) return null;
			let api = hostHljs();
			if (api === null) {
				const mod = grammar(language);
				if (mod === null) return null;
				api = core.value;
				if (api === null || mod.value === null) {
					core.request();
					mod.request();
					return null;
				}
			}
			try {
				if (!api.getLanguage(language)) return null;
				return api.highlight(code, { language, ignoreIllegals: true }).value;
			} catch {
				return null;
			}
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => {
				listeners.delete(fn);
			};
		},
		snapshot: () => version,
	};
}

export const highlighter: Highlighter = createHighlighter(
	() => import("highlight.js/lib/core").then((m): HighlighterApi => m.default),
	GRAMMARS,
);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'" };

/** A run of source text with the `hljs-*` scope classes enclosing it ("" when unscoped). */
export interface TokenRun {
	text: string;
	className: string;
}

/**
 * Flatten highlight.js HTML (only `<span class>` / `</span>` and the five
 * escaped entities) into runs carrying the innermost-to-outermost scope
 * classes, then split them into lines. Lets callers overlay other ranges
 * (diff word changes) on syntax tokens without re-parsing HTML in the DOM.
 */
export function tokenLines(html: string): TokenRun[][] {
	const lines: TokenRun[][] = [[]];
	const stack: string[] = [];
	const push = (raw: string): void => {
		if (raw === "") return;
		const text = raw.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, e: string) => ENTITIES[e] ?? "");
		const className = stack.join(" ");
		const parts = text.split("\n");
		for (let i = 0; i < parts.length; i++) {
			if (i > 0) lines.push([]);
			if (parts[i] !== "") lines[lines.length - 1].push({ text: parts[i], className });
		}
	};
	const tag = /<span class="([^"]*)">|<\/span>/g;
	let last = 0;
	for (let m = tag.exec(html); m !== null; m = tag.exec(html)) {
		push(html.slice(last, m.index));
		if (m[1] !== undefined) stack.push(m[1]);
		else stack.pop();
		last = tag.lastIndex;
	}
	push(html.slice(last));
	return lines;
}
