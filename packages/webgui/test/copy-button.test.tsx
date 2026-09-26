import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
// Exception: react-dom/client and components must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { Markdown } = await import("../src/components/transcript/Markdown");
const { CodeBlock, Output, DiffBlock } = await import("../src/components/transcript/tool-views/parts");

interface TestMount {
	container: HTMLElement;
	cleanup(): void;
	findButton(selector?: string): HTMLButtonElement | null;
}

function mount(ui: ReactElement): TestMount {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
		findButton(selector = "button") {
			return container.querySelector(selector) as unknown as HTMLButtonElement | null;
		},
	};
}

interface ClipboardShim {
	writeText(text: string): Promise<void>;
}

describe("Copy button functionality", () => {
	let originalClipboard: unknown;
	let writtenText: string | null = null;

	beforeEach(() => {
		writtenText = null;
		const nav = win.navigator as { clipboard?: ClipboardShim };
		originalClipboard = nav.clipboard;
		const stub: ClipboardShim = {
			writeText: async (t: string) => {
				writtenText = t;
			},
		};
		Object.defineProperty(win.navigator, "clipboard", {
			value: stub,
			configurable: true,
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(win.navigator, "clipboard", {
			value: originalClipboard,
			configurable: true,
			writable: true,
		});
	});

	describe("Markdown fenced code block", () => {
		it("renders copy button on fenced code block but not inline code", () => {
			const mdText = ["Some inline `code` here.", "", "```ts", "const greeting = 'hello';", "```"].join("\n");

			const html = renderToStaticMarkup(<Markdown text={mdText} />);
			expect(html).toContain("tr-copy-btn");
			expect(html).toContain("tr-fence-wrap");
			// Inline code should not have fence wrapper or copy button
			expect(html).toContain("<code>code</code>");
			const copyMatches = html.match(/<button[^>]*tr-copy-btn/g) ?? [];
			expect(copyMatches.length).toBe(1);
		});

		it("copies exact code text and shows Copied state on click", async () => {
			const mdText = "```python\ndef add(a, b):\n    return a + b\n```";
			const { findButton, cleanup } = mount(<Markdown text={mdText} />);

			const copyBtn = findButton(".tr-copy-btn--fence");
			expect(copyBtn).not.toBeNull();
			expect(copyBtn?.getAttribute("aria-label")).toBe("Copy");

			await act(async () => {
				copyBtn?.click();
			});

			expect(writtenText).toBe("def add(a, b):\n    return a + b");
			expect(copyBtn?.classList.contains("tr-copy-btn--copied")).toBe(true);
			expect(copyBtn?.getAttribute("aria-label")).toBe("Copied");

			cleanup();
		});

		it("does not trigger parent click handler when copy button is clicked", async () => {
			let parentClicked = false;
			const mdText = "```ts\nconst x = 1;\n```";
			const onParentClick = () => {
				parentClicked = true;
			};
			const Parent = () => (
				<div onClick={onParentClick}>
					<Markdown text={mdText} />
				</div>
			);

			const { findButton, cleanup } = mount(<Parent />);
			const copyBtn = findButton(".tr-copy-btn--fence");

			await act(async () => {
				copyBtn?.click();
			});

			expect(parentClicked).toBe(false);
			expect(writtenText).toBe("const x = 1;");
			cleanup();
		});
	});

	describe("CodeBlock in parts.tsx", () => {
		it("renders copy button and copies exact code on click", async () => {
			const code = "function test() {\n  return 42;\n}";
			const { findButton, cleanup } = mount(<CodeBlock code={code} lang="javascript" />);

			const copyBtn = findButton(".tv-out-copy");
			expect(copyBtn).not.toBeNull();
			expect(copyBtn?.textContent).toContain("Copy");

			await act(async () => {
				copyBtn?.click();
			});

			expect(writtenText).toBe(code);
			expect(copyBtn?.textContent).toContain("Copied");
			cleanup();
		});
	});

	describe("Output in parts.tsx", () => {
		it("renders copy button and copies full clean text even when collapsed", async () => {
			const longOutput = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n");
			const { findButton, cleanup } = mount(<Output text={longOutput} maxLines={5} />);

			const copyBtn = findButton(".tv-out-copy");
			expect(copyBtn).not.toBeNull();

			await act(async () => {
				copyBtn?.click();
			});

			expect(writtenText).toBe(longOutput);
			expect(copyBtn?.textContent).toContain("Copied");
			cleanup();
		});
	});

	describe("DiffBlock in parts.tsx", () => {
		it("copies only new-side text without +/- markers and without removed lines", async () => {
			const diff = [
				"--- a/file.ts",
				"+++ b/file.ts",
				"@@ -1,5 +1,6 @@",
				" common first line",
				"-removed line 1",
				"-removed line 2",
				"+added line 1",
				"+added line 2",
				" common last line",
			].join("\n");

			const { findButton, cleanup } = mount(<DiffBlock diff={diff} />);
			const copyBtn = findButton(".tv-out-copy");
			expect(copyBtn).not.toBeNull();

			await act(async () => {
				copyBtn?.click();
			});

			const expectedNewSide = [" common first line", "added line 1", "added line 2", " common last line"].join("\n");

			expect(writtenText).toBe(expectedNewSide);
			expect(copyBtn?.textContent).toContain("Copied");
			cleanup();
		});
	});
});
