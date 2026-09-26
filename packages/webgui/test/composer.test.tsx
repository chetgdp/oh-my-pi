import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Composer } from "../src/components/composer/Composer";
import { resolveSendMode } from "../src/components/composer/Composer";
import type { ComposerModel } from "../src/components/composer/Composer";
import { enterSubmits } from "../src/components/composer/useComposerKeyboard";
import { matchingCommands } from "../src/components/composer/SlashAutocomplete";
import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

const MODELS: readonly ComposerModel[] = [
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

const COMMANDS: readonly RpcAvailableSlashCommand[] = [
	{ name: "help", description: "Show help", source: "builtin" },
	{ name: "history", description: "Show history", source: "builtin" },
	{ name: "compact", description: "Compact context", source: "builtin" },
	{ name: "abort", description: "Abort current run", source: "builtin" },
	{ name: "abstract", description: "Generate abstract", source: "builtin" },
];

const noop = (): void => {};

function defaultProps(overrides: Partial<Parameters<typeof Composer>[0]> = {}): Parameters<typeof Composer>[0] {
	return {
		busy: false,
		models: MODELS,
		commands: COMMANDS,
		onSend: noop,
		onAbort: noop,
		onSetModel: noop,
		onSetThinkingLevel: noop,
		...overrides,
	};
}

const g = globalThis as Record<string, unknown>;
let savedMatchMedia: unknown;

function mockPointer(fine: boolean): void {
	g.matchMedia = (_query: string) => ({ matches: fine });
}

// ---------------------------------------------------------------------------
// SSR tests (no DOM needed)
// ---------------------------------------------------------------------------

describe("Composer", () => {
	beforeEach(() => {
		savedMatchMedia = g.matchMedia;
		mockPointer(true);
	});
	afterEach(() => {
		g.matchMedia = savedMatchMedia;
	});

	describe("keyboard behavior", () => {
		it("enterkeyhint is send when pointer is fine", () => {
			mockPointer(true);
			const html = renderToStaticMarkup(createElement(Composer, defaultProps()));
			expect(html).toContain('enterKeyHint="send"');
		});

		it("enterkeyhint is enter when pointer is coarse", () => {
			mockPointer(false);
			const html = renderToStaticMarkup(createElement(Composer, defaultProps()));
			expect(html).toContain('enterKeyHint="enter"');
		});
	});

	describe("busy state", () => {
		beforeEach(() => mockPointer(true));

		it("shows Send when idle", () => {
			const html = renderToStaticMarkup(createElement(Composer, defaultProps()));
			expect(html).toContain(">Send<");
			expect(html).not.toContain(">Stop<");
			expect(html).not.toContain("Steer");
		});

		it("shows Stop and Steer/Queue when busy", () => {
			const html = renderToStaticMarkup(createElement(Composer, defaultProps({ busy: true })));
			expect(html).toContain(">Stop<");
			expect(html).toContain(">Steer<");
			expect(html).toContain(">Queue<");
		});
	});

	describe("history navigation buttons", () => {
		it("renders history up and down buttons", () => {
			const html = renderToStaticMarkup(createElement(Composer, defaultProps()));
			expect(html).toContain('aria-label="Previous prompt"');
			expect(html).toContain('aria-label="Next prompt"');
		});
	});
});

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe("enterSubmits", () => {
	it("Enter on fine pointer submits", () => {
		expect(enterSubmits({ key: "Enter", shiftKey: false, isComposing: false }, true)).toBe(true);
	});

	it("Enter on coarse pointer does not submit", () => {
		expect(enterSubmits({ key: "Enter", shiftKey: false, isComposing: false }, false)).toBe(false);
	});

	it("Shift+Enter does not submit", () => {
		expect(enterSubmits({ key: "Enter", shiftKey: true, isComposing: false }, true)).toBe(false);
	});

	it("composing does not submit", () => {
		expect(enterSubmits({ key: "Enter", shiftKey: false, isComposing: true }, true)).toBe(false);
	});

	it("non-Enter key does not submit", () => {
		expect(enterSubmits({ key: "a", shiftKey: false, isComposing: false }, true)).toBe(false);
	});
});

describe("resolveSendMode", () => {
	it("returns prompt when idle", () => {
		expect(resolveSendMode(false, "steer")).toBe("prompt");
	});

	it("returns steer when busy with steer mode", () => {
		expect(resolveSendMode(true, "steer")).toBe("steer");
	});

	it("returns followUp when busy with followUp mode", () => {
		expect(resolveSendMode(true, "followUp")).toBe("followUp");
	});
});

describe("matchingCommands", () => {
	it("/ab matches abort and abstract only", () => {
		const results = matchingCommands("/ab", COMMANDS);
		const names = results.map(c => c.name);
		expect(names).toEqual(["abort", "abstract"]);
	});

	it("/AB matches case-insensitively", () => {
		const results = matchingCommands("/AB", COMMANDS);
		const names = results.map(c => c.name);
		expect(names).toEqual(["abort", "abstract"]);
	});

	it("/ matches all commands", () => {
		const results = matchingCommands("/", COMMANDS);
		expect(results.length).toBe(COMMANDS.length);
	});
});
