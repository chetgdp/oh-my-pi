import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, it } from "bun:test";
import type { ReactElement } from "react";
import { isSupportedLanguage } from "@pierre/highlights";
import {
	createHighlighter,
	HIGHLIGHT_MAX_LINES,
	type HighlightsModule,
	languageFromPath,
	resolveLanguage,
	tokenLines,
} from "../src/lib/highlight";

// Exception: react-dom/client and components must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { Markdown } = await import("../src/components/transcript/Markdown");
const { DiffBlock } = await import("../src/components/transcript/tool-views/parts");

const mounted: { cleanup(): void }[] = [];

function mount(ui: ReactElement): HTMLElement {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	mounted.push({
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	});
	return container as unknown as HTMLElement;
}

/** Yields whole event-loop turns until `check` holds; grammar chunks load from disk. */
async function waitFor(check: () => boolean, maxTurns = 500): Promise<void> {
	for (let turn = 0; !check(); turn++) {
		if (turn >= maxTurns) throw new Error("condition not reached");
		await act(async () => {
			await new Promise<void>(resolve => setImmediate(resolve));
		});
	}
}

const loadHighlights = (): Promise<HighlightsModule> => import("@pierre/highlights");

afterEach(() => {
	for (const m of mounted.splice(0)) m.cleanup();
});

describe("language resolution", () => {
	it("maps fence info strings, tool language names, and paths through one alias table", () => {
		// A wrong id means a fence renders plain or with the wrong grammar.
		expect(resolveLanguage("TS")).toBe("typescript");
		expect(resolveLanguage("rust title=main.rs")).toBe("rust");
		expect(resolveLanguage("sh")).toBe("bash");
		expect(resolveLanguage("c++")).toBe("cpp");
		expect(resolveLanguage("py")).toBe("python");
		expect(resolveLanguage("ini")).toBe("toml");
		expect(resolveLanguage("console")).toBe("shellsession");
		expect(resolveLanguage("brainfuck")).toBeNull();
		expect(resolveLanguage("constructor")).toBeNull();
		expect(resolveLanguage("")).toBeNull();
		expect(languageFromPath("packages/webgui/src/App.tsx")).toBe("tsx");
		expect(languageFromPath("crates/x/src/lib.RS")).toBe("rust");
		expect(languageFromPath("docker/Dockerfile")).toBe("dockerfile");
		expect(languageFromPath("Makefile")).toBe("makefile");
		expect(languageFromPath("flake.nix")).toBe("nix");
		expect(languageFromPath("README")).toBeNull();
	});

	it("resolves only to languages @pierre/highlights supports", () => {
		const tokens = "bash sh zsh fish console c h cpp hpp cs css diff patch docker go ini toml js jsx mjs json jsonc json5 jsonl jl kt less lua md mdx php py rb rs scss sass sql swift ts tsx mts html svg vue svelte yaml yml zig nix hs ex erl clj scala dart r pl ml ps1 mk gql proto tex fs sol tf hcl bat elm nim gleam glsl wgsl groovy cmake latex matlab astro".split(" ");
		for (const token of tokens) {
			const id = resolveLanguage(token);
			expect(id === null ? token : isSupportedLanguage(id) ? "ok" : id).toBe("ok");
		}
	});
});

describe("createHighlighter", () => {
	it("renders plain until the module loads, then token spans; oversized input stays plain", async () => {
		let versions = 0;
		const hl = createHighlighter(loadHighlights);
		hl.subscribe(() => versions++);
		expect(hl.highlight("const x = 1;", "typescript")).toBeNull();
		await waitFor(() => hl.highlight("const x = 1;", "typescript") !== null);
		expect(versions).toBe(1);
		expect(hl.snapshot()).toBe(1);
		const html = hl.highlight("const x = 1;", "typescript");
		expect(html).toContain('<span class="hls-keyword-declaration">const </span>');
		expect(html).toContain('<span class="hls-number">1</span>');
		expect(hl.highlight("a < b && c", "javascript")).toContain("&lt;");
		expect(hl.highlight("const x = 1;", "cobol")).toBeNull();

		const atCap = Array.from({ length: HIGHLIGHT_MAX_LINES }, () => "let a = 1;").join("\n");
		expect(hl.highlight(atCap, "typescript")).not.toBeNull();
		expect(hl.highlight(`${atCap}\nlet a = 1;`, "typescript")).toBeNull();
	});

	it("keeps a failed load plain and retries on the next render", async () => {
		let attempts = 0;
		const hl = createHighlighter(async () => {
			attempts++;
			if (attempts === 1) throw new Error("chunk missing");
			return loadHighlights();
		});
		const code = "fn main() {}";
		expect(hl.highlight(code, "rust")).toBeNull();
		await waitFor(() => attempts === 1);
		await Promise.resolve();
		expect(hl.highlight(code, "rust")).toBeNull();
		await waitFor(() => hl.highlight(code, "rust") !== null);
		expect(attempts).toBe(2);
		expect(hl.highlight(code, "rust")).toContain("hls-keyword");
	});

	it("uses a host highlight.js (HTML export) without loading the module", () => {
		let loads = 0;
		const hl = createHighlighter(async () => {
			loads++;
			return loadHighlights();
		});
		const calls: string[] = [];
		Reflect.set(globalThis, "hljs", {
			getLanguage: (name: string) => name === "xml",
			highlight: (code: string, options: { language: string }) => {
				calls.push(options.language);
				return { value: `<span class="hljs-tag">${code}</span>` };
			},
		});
		try {
			expect(hl.highlight("<a/>", "vue")).toBe('<span class="hljs-tag"><a/></span>');
			expect(hl.highlight("x", "rust")).toBeNull();
			expect(calls).toEqual(["xml"]);
			expect(loads).toBe(0);
		} finally {
			Reflect.deleteProperty(globalThis, "hljs");
		}
	});

	it("emits a class for every token type the stylesheet maps", async () => {
		const hl = createHighlighter(loadHighlights);
		hl.highlight("", "typescript");
		await waitFor(() => hl.snapshot() > 0);
		const css = await Bun.file(new URL("../src/styles/syntax.css", import.meta.url)).text();
		const samples: [string, string][] = [
			["/** @param a x */\nexport async function f(a: string): Promise<void> { return `a` + 1 + true; }", "typescript"],
			["# Title\n\n- item *em* **strong** [text](http://x)\n", "markdown"],
			['{"key": [1, null, "s"]}', "json"],
			["@@ -1 +1 @@\n-a\n+b", "diff"],
			["const A = () => <Foo bar={1}>hi</Foo>;", "tsx"],
			["class A:\n    def f(self): return re.compile(r'x')", "python"],
		];
		const classes = new Set<string>();
		for (const [code, lang] of samples) {
			for (const m of (hl.highlight(code, lang) ?? "").matchAll(/class="([^"]+)"/g)) classes.add(m[1]);
		}
		// Identifiers, operators, punctuation and embedded regions inherit the text color on purpose.
		const unstyled = /^hls-(?:variable|operator|punctuation(?:-(?:bracket|delimiter|special|markup)(?:-\w+)?)?|embedded|text-jsx|none)$/;
		const unmapped = [...classes].filter(c => !unstyled.test(c) && !css.includes(`.${c},`) && !css.includes(`.${c} {`));
		expect(classes.size).toBeGreaterThan(15);
		expect(unmapped).toEqual([]);
	});
});

describe("tokenLines", () => {
	it("splits multi-line scopes per line and decodes entities", () => {
		const lines = tokenLines('<span class="hls-comment">/* a\nb &lt;c&gt; */</span> x');
		expect(lines).toEqual([
			[{ text: "/* a", className: "hls-comment" }],
			[
				{ text: "b <c> */", className: "hls-comment" },
				{ text: " x", className: "" },
			],
		]);
	});
});

describe("highlighted components", () => {
	it("markdown fence gains token spans after the lazy load and copies plain text", async () => {
		const el = mount(<Markdown text={"```ts\nconst greeting: string = 'hi';\n```"} />);
		await waitFor(() => el.querySelector("pre code [class^=\"hls-keyword\"]") !== null);
		const code = el.querySelector("pre code");
		expect(code?.textContent).toBe("const greeting: string = 'hi';\n");
		expect(el.querySelector(".tr-copy-btn--fence")).not.toBeNull();
	});

	it("diff cells carry both syntax tokens and word-change spans", async () => {
		const diff = ["-1|const total = 1;", "+1|const total = 2;"].join("\n");
		const el = mount(<DiffBlock diff={diff} lang="typescript" />);
		await waitFor(() => el.querySelector(".tv-diff-text [class^=\"hls-keyword\"]") !== null);
		const added = el.querySelector(".tv-diff-r .tv-diff-word--add");
		expect(added?.textContent).toBe("2");
		expect(added?.classList.contains("hls-number")).toBe(true);
		expect(el.querySelector(".tv-diff-r.tv-diff-text")?.textContent).toBe("const total = 2;");
	});

	it("diff cells keep multi-line tokens: a comment's continuation line stays a comment", async () => {
		const diff = [" 1|/* start", "-2|old */ let a = 1;", "+2|new */ let a = 1;"].join("\n");
		const el = mount(<DiffBlock diff={diff} lang="typescript" />);
		await waitFor(() => el.querySelector(".tv-diff-r .hls-comment") !== null);
		const added = el.querySelector(".tv-diff-r .tv-diff-word--add");
		expect(added?.textContent).toBe("new");
		expect(added?.classList.contains("hls-comment")).toBe(true);
	});
});
