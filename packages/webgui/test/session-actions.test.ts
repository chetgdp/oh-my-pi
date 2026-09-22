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
	getModelRoles,
	setModelRole,
	getAgents,
	setAgentModel,
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

	it("setModel passes persist and thinkingLevel opts", async () => {
		const { sink, commands } = fakeSink();
		await setModel(sink, "anthropic", "opus", { persist: true, thinkingLevel: ThinkingLevel.High });
		expect(commands).toEqual([
			{ type: "set_model", provider: "anthropic", modelId: "opus", persist: true, thinkingLevel: "high" },
		]);
	});

	it("getModelRoles issues get_model_roles", async () => {
		const { sink, commands } = fakeSink();
		await getModelRoles(sink);
		expect(commands).toEqual([{ type: "get_model_roles" }]);
	});

	it("setModelRole issues set_model_role with role and selector", async () => {
		const { sink, commands } = fakeSink();
		await setModelRole(sink, "smol", "anthropic/claude-sonnet-4:high");
		expect(commands).toEqual([{ type: "set_model_role", role: "smol", selector: "anthropic/claude-sonnet-4:high" }]);
	});

	it("setModelRole with null selector clears the role", async () => {
		const { sink, commands } = fakeSink();
		await setModelRole(sink, "smol", null);
		expect(commands).toEqual([{ type: "set_model_role", role: "smol", selector: null }]);
	});

	it("getAgents issues get_agents", async () => {
		const { sink, commands } = fakeSink();
		await getAgents(sink);
		expect(commands).toEqual([{ type: "get_agents" }]);
	});

	it("setAgentModel issues set_agent_model", async () => {
		const { sink, commands } = fakeSink();
		await setAgentModel(sink, "scout", "anthropic/claude-sonnet-4");
		expect(commands).toEqual([{ type: "set_agent_model", agent: "scout", selector: "anthropic/claude-sonnet-4" }]);
	});

	it("setAgentModel with null clears override", async () => {
		const { sink, commands } = fakeSink();
		await setAgentModel(sink, "scout", null);
		expect(commands).toEqual([{ type: "set_agent_model", agent: "scout", selector: null }]);
	});
});
