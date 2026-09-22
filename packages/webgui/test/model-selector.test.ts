import { describe, expect, test } from "bun:test";
import { toSelector } from "../src/lib/model-selector";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";

describe("toSelector", () => {
	test("provider/id without thinking level", () => {
		expect(toSelector("anthropic", "claude-opus-4")).toBe("anthropic/claude-opus-4");
	});

	test("provider/id with thinking level", () => {
		expect(toSelector("anthropic", "claude-opus-4", ThinkingLevel.High)).toBe("anthropic/claude-opus-4:high");
	});

	test("null thinking level omits suffix", () => {
		expect(toSelector("openai", "gpt-4", null)).toBe("openai/gpt-4");
	});

	test("undefined thinking level omits suffix", () => {
		expect(toSelector("openai", "gpt-4", undefined)).toBe("openai/gpt-4");
	});
});
