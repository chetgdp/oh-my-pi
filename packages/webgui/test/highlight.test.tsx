import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, it } from "bun:test";
import type { ReactElement } from "react";
import {
	createHighlighter,
	HIGHLIGHT_MAX_LINES,
	type HighlighterApi,
	type LanguageFn,
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

async function loadCore(): Promise<HighlighterApi> {
	const mod = await import("highlight.js/lib/core");
	return mod.default.newInstance();
}

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
		expect(resolveLanguage("brainfuck")).toBeNull();
		expect(resolveLanguage("")).toBeNull();
		expect(languageFromPath("packages/webgui/src/App.tsx")).toBe("typescript");
		expect(languageFromPath("crates/x/src/lib.RS")).toBe("rust");
		expect(languageFromPath("docker/Dockerfile")).toBe("dockerfile");
		expect(languageFromPath("Makefile")).toBeNull();
	});
});

describe("createHighlighter", () => {
	const grammars = {
		typescript: () => import("highlight.js/lib/languages/typescript"),
	};

	it("renders plain until the grammar loads, then token spans; oversized input stays plain", async () => {
		const hl = createHighlighter(loadCore, grammars);
		expect(hl.highlight("const x = 1;", "typescript")).toBeNull();
		await waitFor(() => hl.highlight("const x = 1;", "typescript") !== null);
		expect(hl.highlight("const x = 1;", "typescript")).toContain('<span class="hljs-keyword">const</span>');
		expect(hl.highlight("const x = 1;", "cobol")).toBeNull();

		const atCap = Array.from({ length: HIGHLIGHT_MAX_LINES }, () => "let a = 1;").join("\n");
		expect(hl.highlight(atCap, "typescript")).not.toBeNull();
		expect(hl.highlight(`${atCap}\nlet a = 1;`, "typescript")).toBeNull();
	});

	it("keeps a failed grammar load plain and retries on the next render", async () => {
		let attempts = 0;
		const hl = createHighlighter(loadCore, {
			rust: async () => {
				attempts++;
				if (attempts === 1) throw new Error("chunk missing");
				const mod = await import("highlight.js/lib/languages/rust");
				return { default: mod.default satisfies LanguageFn };
			},
		});
		const code = "fn main() {}";
		expect(hl.highlight(code, "rust")).toBeNull();
		await waitFor(() => attempts === 1);
		await Promise.resolve();
		expect(hl.highlight(code, "rust")).toBeNull();
		await waitFor(() => hl.highlight(code, "rust") !== null);
		expect(attempts).toBe(2);
		expect(hl.highlight(code, "rust")).toContain("hljs-keyword");
	});
});

describe("tokenLines", () => {
	it("splits multi-line scopes per line and decodes entities", () => {
		const lines = tokenLines('<span class="hljs-comment">/* a\nb &lt;c&gt; */</span> x');
		expect(lines).toEqual([
			[{ text: "/* a", className: "hljs-comment" }],
			[
				{ text: "b <c> */", className: "hljs-comment" },
				{ text: " x", className: "" },
			],
		]);
	});
});

describe("highlighted components", () => {
	it("markdown fence gains token spans after the lazy load and copies plain text", async () => {
		const el = mount(<Markdown text={"```ts\nconst greeting: string = 'hi';\n```"} />);
		await waitFor(() => el.querySelector("pre code .hljs-keyword") !== null);
		const code = el.querySelector("pre code");
		expect(code?.textContent).toBe("const greeting: string = 'hi';\n");
		expect(el.querySelector(".tr-copy-btn--fence")).not.toBeNull();
	});

	it("diff cells carry both syntax tokens and word-change spans", async () => {
		const diff = ["-1|const total = 1;", "+1|const total = 2;"].join("\n");
		const el = mount(<DiffBlock diff={diff} lang="typescript" />);
		await waitFor(() => el.querySelector(".tv-diff-text .hljs-keyword") !== null);
		const added = el.querySelector(".tv-diff-r .tv-diff-word--add");
		expect(added?.textContent).toBe("2");
		expect(added?.classList.contains("hljs-number")).toBe(true);
		expect(el.querySelector(".tv-diff-r.tv-diff-text")?.textContent).toBe("const total = 2;");
	});
});
