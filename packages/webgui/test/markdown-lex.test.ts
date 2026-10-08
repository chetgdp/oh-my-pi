import { describe, expect, it } from "bun:test";
import { createRng, generateMarkdownText } from "../bench/lib/session-frames";
import { renderMarkdown, renderMarkdownStreaming } from "../src/components/transcript/Markdown";
import { createLexState } from "../src/components/transcript/markdown-lex";

/** Streams `text` in `step`-sized prefixes; every frame must match a full lex. */
function expectStreamMatches(text: string, step: number): void {
	const state = createLexState();
	for (let end = 0; end <= text.length; end = end === text.length ? end + 1 : Math.min(text.length, end + step)) {
		const prefix = text.slice(0, end);
		const streamed = renderMarkdownStreaming(prefix, state);
		if (streamed !== renderMarkdown(prefix)) {
			expect({ prefix, html: streamed }).toEqual({ prefix, html: renderMarkdown(prefix) });
		}
	}
}

const FIXTURES: Record<string, string> = {
	"unclosed then closed $$": "intro\n\n$$\na = b\n\nc = d\n\n$$\n\nafter\n\nmore text",
	"unclosed then closed \\[": "intro\n\n\\[\nx + y\n\nz\n\\]\n\nafter",
	"inline $$ pairs": "a $$x$$ b\n\npara\n\n$$y$$ and $$z\n\n$$ end\n\ntail",
	"ref before def": "see [ref] here\n\nmore\n\n[ref]: https://example.com\n\nafter [ref]",
	lists: "- a\n- b\n\n- c\n\n    indented continuation\n\n1. one\n2. two\n\n   nested para\n\nend",
	"nested blockquote": "> a\n> > b\n> > c\n\n> d\nlazy\n\n>> e\n\nplain",
	tables: "| a | b |\n|---|---|\n| 1 | 2 |\n\npara\n\n| x |\n|---|\n| y |\nz\n\nend",
	"unclosed fence": "text\n\n```ts\nconst a = 1;\n\nconst b = 2;\n\nmore\n```\n\nafter",
	"html block": "para\n\n<div>\nx\n\ny\n</div>\n\n<!--\ncomment\n\nstill\n-->\n\n<pre>\na\n\nb\n</pre>\n\nend",
	crlf: "a\r\n\r\nb\r\n\r\n- c\r\n- d\r\n\r\ne",
	tabs: "a\n\n\tcode\n\n-\titem\n\n\tmore\n\nend",
	setext: "Title\n\n===\n\npara\nline\n---\n\nend",
};

describe("lexIncremental", () => {
	for (const [name, text] of Object.entries(FIXTURES)) {
		it(`matches full lex for every prefix: ${name}`, () => {
			expectStreamMatches(text, 1);
		});
	}

	it("matches full lex for generated markdown streamed in small steps", () => {
		for (const seed of [1, 2, 3]) {
			expectStreamMatches(generateMarkdownText(createRng(seed), 4000), 7);
		}
	});

	it("falls back to a full lex when text is not an extension", () => {
		const state = createLexState();
		renderMarkdownStreaming("one\n\ntwo\n\nthree", state);
		expect(renderMarkdownStreaming("uno\n\ntwo", state)).toBe(renderMarkdown("uno\n\ntwo"));
	});
});
