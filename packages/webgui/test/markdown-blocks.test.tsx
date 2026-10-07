import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
// Exception: react-dom/client and components must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { Markdown, renderMarkdown } = await import("../src/components/transcript/Markdown");

// Compare as the browser serializes it (self-closing SVG children expand).
function domHtml(html: string): string {
	const div = win.document.createElement("div");
	div.innerHTML = html;
	return div.innerHTML;
}

function mountMarkdown(text: string) {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => root.render(<Markdown text={text} />));
	return {
		md: () => container.querySelector(".tr-md") as unknown as HTMLElement,
		update(next: string) {
			act(() => root.render(<Markdown text={next} />));
		},
		cleanup() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

describe("Markdown per-block rendering", () => {
	it("keeps finished blocks' DOM nodes when the last block grows", () => {
		const head = "# Title\n\n```ts\nconst a = 1;\n```\n\nfirst paragraph\n\n";
		const view = mountMarkdown(`${head}stream`);
		try {
			view.update(`${head}streami`);
			const h1 = view.md().querySelector("h1");
			const fence = view.md().querySelector(".tr-fence-wrap");
			const firstP = view.md().querySelector("p");
			view.update(`${head}streaming text`);
			view.update(`${head}streaming text with **bold**`);
			expect(view.md().querySelector("h1")).toBe(h1);
			expect(view.md().querySelector(".tr-fence-wrap")).toBe(fence);
			expect(view.md().querySelector("p")).toBe(firstP);
			expect(view.md().innerHTML).toBe(domHtml(renderMarkdown(`${head}streaming text with **bold**`)));
		} finally {
			view.cleanup();
		}
	});

	it("matches whole-text rendering after blocks are removed, merged, and re-resolved", () => {
		const steps = [
			"para one\n\n- a\n- b",
			"para one\n\n- a\n- b\n- c\n\n[x]: https://example.com",
			"para one\n\n[x] link\n\n[x]: https://example.com",
			"para one",
			"",
			"| a | b |\n|---|---|\n| 1 | 2 |",
		];
		const view = mountMarkdown(steps[0]!);
		try {
			for (const text of steps) {
				view.update(text);
				expect(view.md().innerHTML).toBe(domHtml(renderMarkdown(text)));
			}
		} finally {
			view.cleanup();
		}
	});

	it("server-renders the full HTML", () => {
		const text = "# T\n\nbody";
		expect(renderToStaticMarkup(<Markdown text={text} />)).toBe(`<div class="tr-md">${renderMarkdown(text)}</div>`);
	});
});
