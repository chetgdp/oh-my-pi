import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Composer } from "../src/components/shell/Composer";
import type { ComposerModel } from "../src/components/shell/Composer";

const MODELS: ComposerModel[] = [
	{
		id: "claude-opus-4",
		name: "Claude Opus",
		provider: { id: "anthropic", name: "Anthropic" },
	},
	{
		id: "gpt-5",
		name: "GPT-5",
		provider: { id: "openai", name: "OpenAI" },
	},
];

const noop = (): void => {};

describe("Composer", () => {
	it("shows Send button when idle", () => {
		const html = renderToStaticMarkup(
			createElement(Composer, {
				busy: false,
				models: MODELS,
				currentModel: MODELS[0],
				thinkingLevel: "medium",
				onSend: noop,
				onAbort: noop,
				onSetModel: noop,
				onSetThinkingLevel: noop,
			}),
		);
		expect(html).toContain(">Send<");
		expect(html).not.toContain("Abort");
	});

	it("shows Abort button when busy", () => {
		const html = renderToStaticMarkup(
			createElement(Composer, {
				busy: true,
				models: MODELS,
				currentModel: MODELS[0],
				thinkingLevel: "medium",
				onSend: noop,
				onAbort: noop,
				onSetModel: noop,
				onSetThinkingLevel: noop,
			}),
		);
		expect(html).toContain("Abort");
		// Send label changes to Steer when busy
		expect(html).toContain(">Steer<");
	});

	it("renders model options from fixture", () => {
		const html = renderToStaticMarkup(
			createElement(Composer, {
				busy: false,
				models: MODELS,
				currentModel: MODELS[0],
				thinkingLevel: "medium",
				onSend: noop,
				onAbort: noop,
				onSetModel: noop,
				onSetThinkingLevel: noop,
			}),
		);
		expect(html).toContain("Claude Opus");
		expect(html).toContain("GPT-5");
		expect(html).toContain('value="claude-opus-4"');
		expect(html).toContain('value="gpt-5"');
	});

	it("renders thinking level options", () => {
		const html = renderToStaticMarkup(
			createElement(Composer, {
				busy: false,
				models: MODELS,
				currentModel: MODELS[0],
				thinkingLevel: "high",
				onSend: noop,
				onAbort: noop,
				onSetModel: noop,
				onSetThinkingLevel: noop,
			}),
		);
		expect(html).toContain('value="high"');
		expect(html).toContain('value="minimal"');
		expect(html).toContain('value="max"');
	});
});
