import { describe, expect, it } from "bun:test";
import {
	sendPrompt,
	steer,
	followUp,
	abort,
	getAvailableModels,
	setModel,
	setThinkingLevel,
	getSessionStats,
	getAvailableCommands,
	getMessagesPage,
	getSubagents,
} from "../src/lib/session-actions";
import type { SessionCommandSink } from "../src/lib/session-actions";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core";

function fakeSink(): { sink: SessionCommandSink; commands: unknown[] } {
	const commands: unknown[] = [];
	const request: SessionCommandSink["request"] = cmd => {
		commands.push(cmd);
		return Promise.resolve(undefined) as never;
	};
	const sink: SessionCommandSink = { request };
	return { sink, commands };
}

describe("session-actions", () => {
	it("sendPrompt issues a prompt command", async () => {
		const { sink, commands } = fakeSink();
		await sendPrompt(sink, "hello");
		expect(commands).toEqual([{ type: "prompt", message: "hello" }]);
	});

	it("sendPrompt with streamingBehavior", async () => {
		const { sink, commands } = fakeSink();
		await sendPrompt(sink, "hey", { streamingBehavior: "steer" });
		expect(commands).toEqual([{ type: "prompt", message: "hey", streamingBehavior: "steer" }]);
	});

	it("steer issues a steer command", async () => {
		const { sink, commands } = fakeSink();
		await steer(sink, "go left");
		expect(commands).toEqual([{ type: "steer", message: "go left" }]);
	});

	it("followUp issues a follow_up command", async () => {
		const { sink, commands } = fakeSink();
		await followUp(sink, "more");
		expect(commands).toEqual([{ type: "follow_up", message: "more" }]);
	});

	it("abort issues an abort command", async () => {
		const { sink, commands } = fakeSink();
		await abort(sink);
		expect(commands).toEqual([{ type: "abort" }]);
	});

	it("getAvailableModels issues get_available_models", async () => {
		const { sink, commands } = fakeSink();
		await getAvailableModels(sink);
		expect(commands).toEqual([{ type: "get_available_models" }]);
	});

	it("setModel issues set_model with provider and modelId", async () => {
		const { sink, commands } = fakeSink();
		await setModel(sink, "anthropic", "claude-opus-4");
		expect(commands).toEqual([{ type: "set_model", provider: "anthropic", modelId: "claude-opus-4" }]);
	});

	it("setThinkingLevel issues set_thinking_level", async () => {
		const { sink, commands } = fakeSink();
		await setThinkingLevel(sink, ThinkingLevel.High);
		expect(commands).toEqual([{ type: "set_thinking_level", level: "high" }]);
	});

	it("getSessionStats issues get_session_stats", async () => {
		const { sink, commands } = fakeSink();
		await getSessionStats(sink);
		expect(commands).toEqual([{ type: "get_session_stats" }]);
	});

	it("getAvailableCommands issues get_available_commands", async () => {
		const { sink, commands } = fakeSink();
		await getAvailableCommands(sink);
		expect(commands).toEqual([{ type: "get_available_commands" }]);
	});

	it("getMessagesPage issues get_messages_page with optional cursor and limit", async () => {
		const { sink, commands } = fakeSink();
		await getMessagesPage(sink);
		expect(commands).toEqual([{ type: "get_messages_page" }]);
	});

	it("getMessagesPage passes cursor and limit when provided", async () => {
		const { sink, commands } = fakeSink();
		await getMessagesPage(sink, "abc", 50);
		expect(commands).toEqual([{ type: "get_messages_page", cursor: "abc", limit: 50 }]);
	});

	it("getSubagents issues get_subagents", async () => {
		const { sink, commands } = fakeSink();
		await getSubagents(sink);
		expect(commands).toEqual([{ type: "get_subagents" }]);
	});
});
