import { describe, expect, test } from "bun:test";
import { highlightMagicWords } from "../src/lib/magic-words";

const glowing = (html: string) =>
	[...highlightMagicWords(html).matchAll(/class="magic-word"[^>]*>(\w+)</g)].map(m => m[1]);

describe("highlightMagicWords", () => {
	test("wraps standalone prose words", () => {
		expect(glowing("<p>please ultrathink and workflowz, then jevify.</p>")).toEqual([
			"ultrathink",
			"workflowz",
			"jevify",
		]);
	});

	test("skips code, pre, and links", () => {
		expect(
			glowing('<p><code>workflowz</code> <a href="#">orchestrate</a></p><pre><code>ultrathink</code></pre>'),
		).toEqual([]);
	});

	test("skips paths, flags, calls, and embedded words", () => {
		expect(glowing("<p>./workflowz --jevify orchestrate() ultrathinking workflowz.ts</p>")).toEqual([]);
	});

	test("prose after a closed code span still glows", () => {
		expect(glowing("<p><code>x</code> orchestrate</p>")).toEqual(["orchestrate"]);
	});

	test("does not match inside tag attributes", () => {
		expect(highlightMagicWords('<p title="ultrathink">hi</p>')).toBe('<p title="ultrathink">hi</p>');
	});
});
