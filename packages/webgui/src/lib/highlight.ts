/**
 * Syntax highlighting for markdown fences and tool code blocks.
 *
 * @pierre/highlights (Wasm lexers, every grammar in one module) is one lazy
 * chunk: the first block requests it, renders plain text, and re-renders
 * highlighted once it arrives (subscribers are notified). After that,
 * highlighting is synchronous. A host page that already ships a full
 * highlight.js as `globalThis.hljs` (the HTML session export) is used
 * directly instead, and the chunk is never requested.
 */
import type { Highlighter as HighlightsInstance, Lang, Theme } from "@pierre/highlights";
import { LazyModule } from "./lazy-module";

/** Larger inputs render as plain text: highlighting cost grows with size and blocks the main thread. */
export const HIGHLIGHT_MAX_CHARS = 1_000_000;
export const HIGHLIGHT_MAX_LINES = 20_000;

/** The subset of the highlight.js API the host path calls. */
export interface HostHljsApi {
	getLanguage(name: string): unknown;
	highlight(code: string, options: { language: string; ignoreIllegals?: boolean }): { value: string };
}

/** The subset of the `@pierre/highlights` module this file calls. */
export interface HighlightsModule {
	codeToTokens: HighlightsInstance["codeToTokens"];
	tokenNames: readonly string[];
}

/** Ids that map to themselves; each is a `@pierre/highlights` language. */
const SAME = (
	"astro bash bat c clojure cmake cpp csharp css dart diff dockerfile elixir elm erlang fsharp gleam glsl go " +
	"graphql groovy haskell hcl html java javascript json json5 jsonl jsx julia kotlin latex less lua makefile " +
	"markdown matlab mdx nim nix ocaml perl php powershell proto python r ruby rust sass scala scss " +
	"shellsession solidity sql svelte swift terraform toml tsx typescript vue wgsl xml yaml zig"
).split(" ");

/**
 * Fence info tokens, file extensions, and tool language names to a language
 * id. The single alias table: fences, file paths, and eval cells all resolve
 * through it.
 */
const ALIASES: Record<string, string> = {
	...Object.fromEntries(SAME.map(id => [id, id])),
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	fish: "bash",
	ksh: "bash",
	console: "shellsession",
	"shell-session": "shellsession",
	cmd: "bat",
	h: "c",
	"c++": "cpp",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	hh: "cpp",
	hxx: "cpp",
	cs: "csharp",
	"c#": "csharp",
	clj: "clojure",
	cljs: "clojure",
	cljc: "clojure",
	edn: "clojure",
	patch: "diff",
	docker: "dockerfile",
	containerfile: "dockerfile",
	ex: "elixir",
	exs: "elixir",
	erl: "erlang",
	fs: "fsharp",
	fsx: "fsharp",
	"f#": "fsharp",
	golang: "go",
	gql: "graphql",
	gradle: "groovy",
	hs: "haskell",
	tf: "hcl",
	tfvars: "hcl",
	htm: "html",
	ini: "toml",
	cfg: "toml",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	node: "javascript",
	jsonc: "json",
	jl: "julia",
	kt: "kotlin",
	kts: "kotlin",
	tex: "latex",
	make: "makefile",
	mk: "makefile",
	md: "markdown",
	ml: "ocaml",
	mli: "ocaml",
	pl: "perl",
	pm: "perl",
	ps1: "powershell",
	pwsh: "powershell",
	protobuf: "proto",
	py: "python",
	python3: "python",
	ipy: "python",
	ipython: "python",
	rb: "ruby",
	rs: "rust",
	sbt: "scala",
	sol: "solidity",
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	svg: "xml",
	yml: "yaml",
	zon: "zig",
};

/** Names the host highlight.js knows under another id (others go through as-is; unknown ones render plain). */
const HOST_ALIASES: Record<string, string> = {
	json5: "json",
	jsonl: "json",
	mdx: "markdown",
	vue: "xml",
	svelte: "xml",
	astro: "xml",
	toml: "ini",
	terraform: "hcl",
};

/** Language id for a fence info string / language name / extension; null when unsupported (rendered plain). */
export function resolveLanguage(token: string | null | undefined): string | null {
	if (!token) return null;
	const first =
		token
			.trim()
			.split(/[\s{,]/, 1)[0]
			?.toLowerCase() ?? "";
	const key = first.startsWith(".") ? first.slice(1) : first;
	return Object.hasOwn(ALIASES, key) ? ALIASES[key] : null;
}

/** Language id for a file path by basename / extension; null when unsupported. */
export function languageFromPath(filePath: string): string | null {
	const base = filePath.split(/[\\/]/).pop() ?? "";
	if (/^(?:dockerfile|containerfile)(?:\..*)?$/i.test(base)) return "dockerfile";
	if (/^(?:gnu)?makefile$/i.test(base)) return "makefile";
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
function hostHljs(): HostHljsApi | null {
	const candidate: unknown = Reflect.get(globalThis, "hljs");
	if (typeof candidate !== "object" || candidate === null) return null;
	if (!("highlight" in candidate) || typeof candidate.highlight !== "function") return null;
	if (!("getLanguage" in candidate) || typeof candidate.getLanguage !== "function") return null;
	// Both called members were checked above.
	const api = candidate as HostHljsApi;
	return api;
}

export interface Highlighter {
	/**
	 * Highlighted HTML (escaped text in `<span class>` runs: `hls-<token>` from
	 * Highlights, `hljs-*` from a host highlight.js), or null to render plain
	 * text (unsupported, too large, or still loading).
	 */
	highlight(code: string, language: string | null | undefined): string | null;
	subscribe(fn: () => void): () => void;
	/** Bumps when the highlighter becomes available; include in render memo keys. */
	snapshot(): number;
}

/**
 * CSS-variable prefix of token colors; the variable name is the class
 * (`var(--hls-keyword-control)` → `hls-keyword-control`, underscores become
 * dashes). Plain-text runs resolve to the foreground and get no span.
 */
const VAR_PREFIX = "var(--";
const FOREGROUND = "var(--hls-foreground)";

/**
 * A theme that names every token type, so each run carries its own
 * `var(--hls-<token>)` color; `styles/syntax.css` maps those names (as
 * classes) to the `--syn-*` palette. The colors here are never rendered.
 */
function tokenTheme(tokenNames: readonly string[]): Theme {
	const syntax: Record<string, string> = {};
	for (const name of tokenNames) {
		if (name !== "none" && name !== "background" && name !== "foreground") syntax[name] = "#000000";
	}
	return { name: "omp-tokens", appearance: "dark", style: { syntax }, cssVariables: true };
}

export function createHighlighter(load: () => Promise<HighlightsModule>): Highlighter {
	const mod = new LazyModule<HighlightsModule>(load);
	const listeners = new Set<() => void>();
	let version = 0;
	let theme: Theme | null = null;
	mod.subscribe(() => {
		version++;
		for (const fn of listeners) fn();
	});

	return {
		highlight(code, language) {
			if (!language || !withinHighlightLimits(code)) return null;
			const host = hostHljs();
			if (host !== null) {
				const name = HOST_ALIASES[language] ?? language;
				try {
					if (!host.getLanguage(name)) return null;
					return host.highlight(code, { language: name, ignoreIllegals: true }).value;
				} catch {
					return null;
				}
			}
			const api = mod.value;
			if (api === null) {
				mod.request();
				return null;
			}
			try {
				theme ??= tokenTheme(api.tokenNames);
				const { tokens } = api.codeToTokens(code, { lang: language as Lang, theme, defaultColor: false });
				let html = "";
				for (let i = 0; i < tokens.length; i++) {
					if (i > 0) html += "\n";
					for (const token of tokens[i]) {
						const text = token.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
						const color = token.color;
						html +=
							color !== undefined && color !== FOREGROUND && color.startsWith(VAR_PREFIX)
								? `<span class="${color.slice(VAR_PREFIX.length, -1)}">${text}</span>`
								: text;
					}
				}
				return html;
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

export const highlighter: Highlighter = createHighlighter(() => import("@pierre/highlights"));

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'" };

/** A run of source text with the token classes enclosing it ("" when unscoped). */
export interface TokenRun {
	text: string;
	className: string;
}

/**
 * Flatten highlighter HTML (only `<span class>` / `</span>` and the five
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
