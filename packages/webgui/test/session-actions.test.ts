import { describe, expect, it } from "bun:test";
import {
	sendPrompt,
	steer,
	followUp,
	abort,
	restoreClearedMessagesToDraft,
	getAvailableModels,
	setModel,
	setThinkingLevel,
	getSessionStats,
	getAvailableCommands,
	getSubagents,
	getModelRoles,
	setModelRole,
	deleteModelRole,
	setCycleOrder,
	setModelTag,
	getModelBrowser,
	refreshModels,
	cycleRoleModel,
	getAgents,
	setAgentModel,
	setAgentEnabled,
	setAgentServiceTier,
	setAgentPrewalk,
	setAgentAdvisor,
	getLoginStatus,
	loginStart,
	loginInput,
	loginCancel,
	logout,
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

	it("abort with clearQueue passes clearQueue flag", async () => {
		const { sink, commands } = fakeSink();
		await abort(sink, { clearQueue: true });
		expect(commands).toEqual([{ type: "abort", clearQueue: true }]);
	});

	describe("restoreClearedMessagesToDraft", () => {
		it("returns draft unchanged when cleared is empty", () => {
			const draft = { text: "existing text", images: ["data:image/png;base64,aaa"] };
			expect(restoreClearedMessagesToDraft(draft, [])).toEqual(draft);
		});

		it("prepends restored messages ahead of current draft joined by double newlines", () => {
			const draft = { text: "existing draft", images: [] };
			const cleared = [{ text: "first queued" }, { text: "second queued" }];
			const result = restoreClearedMessagesToDraft(draft, cleared);
			expect(result.text).toBe("first queued\n\nsecond queued\n\nexisting draft");
			expect(result.images).toEqual([]);
		});

		it("folds restored images back into draft images preserving data URLs", () => {
			const draft = { text: "draft", images: ["data:image/png;base64,draftimg"] };
			const cleared = [
				{
					text: "cleared text",
					images: [{ type: "image" as const, mimeType: "image/jpeg", data: "clearedimg" }],
				},
			];
			const result = restoreClearedMessagesToDraft(draft, cleared);
			expect(result.text).toBe("cleared text\n\ndraft");
			expect(result.images).toEqual(["data:image/jpeg;base64,clearedimg", "data:image/png;base64,draftimg"]);
		});

		it("handles image-only cleared messages without adding empty text lines", () => {
			const draft = { text: "", images: [] };
			const cleared = [
				{
					text: "",
					images: [{ type: "image" as const, mimeType: "image/png", data: "clearedimg" }],
				},
			];
			const result = restoreClearedMessagesToDraft(draft, cleared);
			expect(result.text).toBe("");
			expect(result.images).toEqual(["data:image/png;base64,clearedimg"]);
		});
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

	it("setModelRole passes persist and storage opts", async () => {
		const { sink, commands } = fakeSink();
		await setModelRole(sink, "smol", "anthropic/claude-sonnet-4", { persist: true, storage: "project" });
		expect(commands).toEqual([
			{
				type: "set_model_role",
				role: "smol",
				selector: "anthropic/claude-sonnet-4",
				persist: true,
				storage: "project",
			},
		]);
	});

	it("deleteModelRole issues delete_model_role", async () => {
		const { sink, commands } = fakeSink();
		await deleteModelRole(sink, "custom-role");
		expect(commands).toEqual([{ type: "delete_model_role", role: "custom-role" }]);
	});

	it("setCycleOrder issues set_cycle_order", async () => {
		const { sink, commands } = fakeSink();
		await setCycleOrder(sink, ["default", "fast", "smart"]);
		expect(commands).toEqual([{ type: "set_cycle_order", order: ["default", "fast", "smart"] }]);
	});

	it("setModelTag issues set_model_tag", async () => {
		const { sink, commands } = fakeSink();
		await setModelTag(sink, "anthropic/claude-sonnet-4", "coding");
		expect(commands).toEqual([{ type: "set_model_tag", model: "anthropic/claude-sonnet-4", tag: "coding" }]);
	});

	it("getModelBrowser issues get_model_browser", async () => {
		const { sink, commands } = fakeSink();
		await getModelBrowser(sink);
		expect(commands).toEqual([{ type: "get_model_browser" }]);
	});

	it("refreshModels issues refresh_models without provider", async () => {
		const { sink, commands } = fakeSink();
		await refreshModels(sink);
		expect(commands).toEqual([{ type: "refresh_models" }]);
	});

	it("refreshModels issues refresh_models with provider", async () => {
		const { sink, commands } = fakeSink();
		await refreshModels(sink, "anthropic");
		expect(commands).toEqual([{ type: "refresh_models", provider: "anthropic" }]);
	});

	it("cycleRoleModel issues cycle_role_model without direction", async () => {
		const { sink, commands } = fakeSink();
		await cycleRoleModel(sink);
		expect(commands).toEqual([{ type: "cycle_role_model" }]);
	});

	it("cycleRoleModel issues cycle_role_model with direction", async () => {
		const { sink, commands } = fakeSink();
		await cycleRoleModel(sink, "backward");
		expect(commands).toEqual([{ type: "cycle_role_model", direction: "backward" }]);
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

	it("setAgentEnabled issues set_agent_enabled", async () => {
		const { sink, commands } = fakeSink();
		await setAgentEnabled(sink, "reviewer", false);
		expect(commands).toEqual([{ type: "set_agent_enabled", agent: "reviewer", enabled: false }]);
	});

	it("setAgentServiceTier issues set_agent_service_tier", async () => {
		const { sink, commands } = fakeSink();
		await setAgentServiceTier(sink, "reviewer", "fast");
		expect(commands).toEqual([{ type: "set_agent_service_tier", agent: "reviewer", tier: "fast" }]);
	});

	it("setAgentPrewalk issues set_agent_prewalk", async () => {
		const { sink, commands } = fakeSink();
		await setAgentPrewalk(sink, "reviewer", "custom-prewalk");
		expect(commands).toEqual([{ type: "set_agent_prewalk", agent: "reviewer", value: "custom-prewalk" }]);
	});

	it("setAgentAdvisor issues set_agent_advisor", async () => {
		const { sink, commands } = fakeSink();
		await setAgentAdvisor(sink, "reviewer", "advisor-agent");
		expect(commands).toEqual([{ type: "set_agent_advisor", agent: "reviewer", value: "advisor-agent" }]);
	});

	it("getLoginStatus issues get_login_status", async () => {
		const { sink, commands } = fakeSink();
		await getLoginStatus(sink);
		expect(commands).toEqual([{ type: "get_login_status" }]);
	});

	it("loginStart issues login_start with providerId", async () => {
		const { sink, commands } = fakeSink();
		await loginStart(sink, "anthropic");
		expect(commands).toEqual([{ type: "login_start", providerId: "anthropic" }]);
	});

	it("loginInput issues login_input with loginId, requestId, value", async () => {
		const { sink, commands } = fakeSink();
		await loginInput(sink, "log-1", "req-1", "my-code");
		expect(commands).toEqual([{ type: "login_input", loginId: "log-1", requestId: "req-1", value: "my-code" }]);
	});

	it("loginCancel issues login_cancel with loginId", async () => {
		const { sink, commands } = fakeSink();
		await loginCancel(sink, "log-1");
		expect(commands).toEqual([{ type: "login_cancel", loginId: "log-1" }]);
	});

	it("logout issues logout with providerId and credentialId", async () => {
		const { sink, commands } = fakeSink();
		await logout(sink, "anthropic", 42);
		expect(commands).toEqual([{ type: "logout", providerId: "anthropic", credentialId: 42 }]);
	});
});
