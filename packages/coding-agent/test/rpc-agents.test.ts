import { describe, expect, test } from "bun:test";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import type { ModelConfigSession } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-model-config";
import {
	buildAgents,
	handleSetAgentAdvisor,
	handleSetAgentEnabled,
	handleSetAgentModel,
	handleSetAgentPrewalk,
	handleSetAgentServiceTier,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-agents";
import type { RpcResponse } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";

const fakeModel = {
	provider: "anthropic",
	id: "claude-sonnet-4-20250514",
	name: "Claude Sonnet 4",
	contextWindow: 200_000,
	maxOutputTokens: 16_384,
	supportsImages: true,
	supportsPromptCaching: true,
	inputPrice: 3,
	outputPrice: 15,
	cacheWritePrice: 3.75,
	cacheReadPrice: 0.3,
} as never;

const fakeRegistry = {
	getAvailable(_filter?: string) {
		return [fakeModel];
	},
	find(provider: string, id: string) {
		if (provider === "anthropic" && id === "claude-sonnet-4-20250514") return fakeModel;
		return undefined;
	},
	awaitBackgroundRefresh() {
		return Promise.resolve();
	},
};

function asSession(stub: ModelConfigSession & { settings: Settings }): AgentSession {
	return stub as unknown as AgentSession;
}

type ResponseDataMap = {
	[K in Extract<RpcResponse, { success: true }> as K["command"]]: K extends { data: infer D } ? D : undefined;
};

function dataOf<C extends keyof ResponseDataMap>(resp: RpcResponse, command: C): ResponseDataMap[C] {
	if (!resp.success || resp.command !== command) {
		throw new Error(`Expected successful ${command} response, got ${resp.command} (success=${resp.success})`);
	}
	const variant = resp as Extract<RpcResponse, { command: C; success: true }>;
	return "data" in variant ? (variant.data as ResponseDataMap[C]) : (undefined as ResponseDataMap[C]);
}

function makeSession(
	overrides?: Record<string, unknown>,
	extraAgents: unknown[] = [],
): ModelConfigSession & { settings: Settings } {
	const settings = Settings.isolated(overrides as never);
	return {
		settings,
		sessionManager: { getCwd: () => "/tmp/test-project" },
		modelRegistry: fakeRegistry as never,
		getAvailableModels: () => [fakeModel],
		model: fakeModel,
		effectiveExtensionRoots: { explicit: [], mode: "auto", configured: [], provenance: "default" } as never,
		getSessionAgents: () => extraAgents as never,
		getSessionSpawns: () => undefined,
	};
}

describe("buildAgents contract additions", () => {
	test("reports prewalk.source for override/frontmatter/default/none and effective", async () => {
		// 1) frontmatter prewalk
		const agentWithFrontmatter = {
			name: "custom-prewalk-agent",
			description: "test",
			source: "custom",
			prewalk: true,
		};
		// 2) none prewalk
		const agentNone = {
			name: "custom-none-agent",
			description: "test",
			source: "custom",
		};
		const session = makeSession(
			{
				"task.prewalk": true,
			},
			[agentWithFrontmatter, agentNone],
		);

		const result = await buildAgents(session);
		const bundledTask = result.agents.find(a => a.name === "task");
		const frontmatterAgent = result.agents.find(a => a.name === "custom-prewalk-agent");
		const noneAgent = result.agents.find(a => a.name === "custom-none-agent");

		// Bundled task with task.prewalk=true gets source="default"
		expect(bundledTask).toBeDefined();
		expect(bundledTask!.prewalk.source).toBe("default");
		expect(bundledTask!.prewalk.effective).toBe("@smol");

		// Custom agent with prewalk: true gets source="frontmatter"
		expect(frontmatterAgent).toBeDefined();
		expect(frontmatterAgent!.prewalk.source).toBe("frontmatter");
		expect(frontmatterAgent!.prewalk.effective).toBe("@smol");

		// Custom agent with no prewalk gets source="none"
		expect(noneAgent).toBeDefined();
		expect(noneAgent!.prewalk.source).toBe("none");
		expect(noneAgent!.prewalk.effective).toBeUndefined();

		// 3) override prewalk
		const sessionOverride = makeSession(
			{
				"task.agentPrewalk": { "custom-none-agent": "on" },
			},
			[agentNone],
		);
		const resultOverride = await buildAgents(sessionOverride);
		const overriddenAgent = resultOverride.agents.find(a => a.name === "custom-none-agent");
		expect(overriddenAgent).toBeDefined();
		expect(overriddenAgent!.prewalk.source).toBe("override");
		expect(overriddenAgent!.prewalk.effective).toBe("@smol");
	});

	test("reports advisor.source for override/frontmatter/none and effective", async () => {
		const agentWithAdvisor = {
			name: "custom-advisor-agent",
			description: "test",
			source: "custom",
			advisor: true,
		};
		const agentNone = {
			name: "custom-none-agent",
			description: "test",
			source: "custom",
		};
		const session = makeSession({}, [agentWithAdvisor, agentNone]);
		const result = await buildAgents(session);

		const frontmatterAgent = result.agents.find(a => a.name === "custom-advisor-agent");
		expect(frontmatterAgent).toBeDefined();
		expect(frontmatterAgent!.advisor.source).toBe("frontmatter");
		expect(frontmatterAgent!.advisor.effective).toBe("@advisor");

		const noneAgent = result.agents.find(a => a.name === "custom-none-agent");
		expect(noneAgent).toBeDefined();
		expect(noneAgent!.advisor.source).toBe("none");
		expect(noneAgent!.advisor.effective).toBeUndefined();

		const sessionOverride = makeSession(
			{
				"task.agentAdvisor": { "custom-none-agent": "anthropic/claude-sonnet-4-20250514" },
			},
			[agentNone],
		);
		const resultOverride = await buildAgents(sessionOverride);
		const overriddenAgent = resultOverride.agents.find(a => a.name === "custom-none-agent");
		expect(overriddenAgent).toBeDefined();
		expect(overriddenAgent!.advisor.source).toBe("override");
		expect(overriddenAgent!.advisor.effective).toBe("anthropic/claude-sonnet-4-20250514");
	});

	test("precedence.winner points at override entry when override exists, and frontmatter otherwise", async () => {
		const customAgent = {
			name: "custom-model-agent",
			description: "test",
			source: "custom",
			model: ["anthropic/claude-sonnet-4-20250514"],
		};
		const sessionWithoutOverride = makeSession({}, [customAgent]);
		const res1 = await buildAgents(sessionWithoutOverride);
		const agent1 = res1.agents.find(a => a.name === "custom-model-agent");
		expect(agent1).toBeDefined();
		expect(agent1!.precedence.entries[agent1!.precedence.winner].source).toBe("frontmatter");

		const sessionWithOverride = makeSession(
			{
				"task.agentModelOverrides": { "custom-model-agent": "anthropic/claude-sonnet-4-20250514" },
			},
			[customAgent],
		);
		const res2 = await buildAgents(sessionWithOverride);
		const agent2 = res2.agents.find(a => a.name === "custom-model-agent");
		expect(agent2).toBeDefined();
		expect(agent2!.precedence.entries[agent2!.precedence.winner].source).toBe("override");
	});

	test("isDefaultTaskAgent is true only for the spawn-policy default agent", async () => {
		const session = makeSession();
		const result = await buildAgents(session);
		const defaultAgent = result.defaultAgent;
		for (const agent of result.agents) {
			if (agent.name === defaultAgent) {
				expect(agent.isDefaultTaskAgent).toBe(true);
			} else {
				expect(agent.isDefaultTaskAgent).toBe(false);
			}
		}
	});

	test("serviceTier reflects task.agentServiceTierOverrides", async () => {
		const session = makeSession({
			"task.agentServiceTierOverrides": { task: "flex" },
		});
		const result = await buildAgents(session);
		const taskAgent = result.agents.find(a => a.name === "task");
		expect(taskAgent).toBeDefined();
		expect(taskAgent!.serviceTier).toBe("flex");
	});
});

describe("Agent mutation handlers", () => {
	test("unknown agent returns errorResponse for all mutations", async () => {
		const session = makeSession();

		const resEnabled = await handleSetAgentEnabled(
			asSession(session),
			{ type: "set_agent_enabled", agent: "non-existent", enabled: true },
			"1",
		);
		expect(resEnabled.success).toBe(false);

		const resTier = await handleSetAgentServiceTier(
			asSession(session),
			{ type: "set_agent_service_tier", agent: "non-existent", tier: "flex" },
			"2",
		);
		expect(resTier.success).toBe(false);

		const resPrewalk = await handleSetAgentPrewalk(
			asSession(session),
			{ type: "set_agent_prewalk", agent: "non-existent", value: "on" },
			"3",
		);
		expect(resPrewalk.success).toBe(false);

		const resAdvisor = await handleSetAgentAdvisor(
			asSession(session),
			{ type: "set_agent_advisor", agent: "non-existent", value: "on" },
			"4",
		);
		expect(resAdvisor.success).toBe(false);

		const resModel = await handleSetAgentModel(
			asSession(session),
			{ type: "set_agent_model", agent: "non-existent", selector: null },
			"5",
		);
		expect(resModel.success).toBe(false);
	});

	test("invalid tier returns errorResponse", async () => {
		const session = makeSession();

		const resTier = await handleSetAgentServiceTier(
			asSession(session),
			{ type: "set_agent_service_tier", agent: "task", tier: "invalid-tier" },
			"1",
		);
		expect(resTier.success).toBe(false);
	});

	test("set_agent_enabled false then true round-trips disabled", async () => {
		const session = makeSession();

		// 1) disable
		const resDisable = await handleSetAgentEnabled(
			asSession(session),
			{ type: "set_agent_enabled", agent: "task", enabled: false },
			"1",
		);
		expect(resDisable.success).toBe(true);
		const data1 = dataOf(resDisable, "set_agent_enabled");
		expect(data1.disabled).toBe(true);

		// 2) re-enable
		const resEnable = await handleSetAgentEnabled(
			asSession(session),
			{ type: "set_agent_enabled", agent: "task", enabled: true },
			"2",
		);
		expect(resEnable.success).toBe(true);
		const data2 = dataOf(resEnable, "set_agent_enabled");
		expect(data2.disabled).toBe(false);
	});

	test("set_agent_service_tier sets and clears tier", async () => {
		const session = makeSession();

		const resSet = await handleSetAgentServiceTier(
			asSession(session),
			{ type: "set_agent_service_tier", agent: "task", tier: "flex" },
			"1",
		);
		expect(resSet.success).toBe(true);
		expect(dataOf(resSet, "set_agent_service_tier").serviceTier).toBe("flex");

		const resClear = await handleSetAgentServiceTier(
			asSession(session),
			{ type: "set_agent_service_tier", agent: "task", tier: null },
			"2",
		);
		expect(resClear.success).toBe(true);
		expect(dataOf(resClear, "set_agent_service_tier").serviceTier).toBeUndefined();
	});

	test("set_agent_prewalk sets, validates selector, and clears value", async () => {
		const session = makeSession();

		// Valid on/off
		const resSetOn = await handleSetAgentPrewalk(
			asSession(session),
			{ type: "set_agent_prewalk", agent: "task", value: "on" },
			"1",
		);
		expect(resSetOn.success).toBe(true);
		const data1 = dataOf(resSetOn, "set_agent_prewalk");
		expect(data1.prewalk.effective).toBe("@smol");

		// Invalid custom model selector
		const resInvalid = await handleSetAgentPrewalk(
			asSession(session),
			{ type: "set_agent_prewalk", agent: "task", value: "nonexistent/model" },
			"2",
		);
		expect(resInvalid.success).toBe(false);

		// Valid model selector
		const resValidModel = await handleSetAgentPrewalk(
			asSession(session),
			{ type: "set_agent_prewalk", agent: "task", value: "anthropic/claude-sonnet-4-20250514" },
			"3",
		);
		expect(resValidModel.success).toBe(true);
		const data3 = dataOf(resValidModel, "set_agent_prewalk");
		expect(data3.prewalk.effective).toBe("anthropic/claude-sonnet-4-20250514");

		// Clear
		const resClear = await handleSetAgentPrewalk(
			asSession(session),
			{ type: "set_agent_prewalk", agent: "task", value: null },
			"4",
		);
		expect(resClear.success).toBe(true);
	});

	test("set_agent_advisor sets, validates selector, and clears value", async () => {
		const session = makeSession();

		// Valid on
		const resSetOn = await handleSetAgentAdvisor(
			asSession(session),
			{ type: "set_agent_advisor", agent: "task", value: "on" },
			"1",
		);
		expect(resSetOn.success).toBe(true);
		const data1 = dataOf(resSetOn, "set_agent_advisor");
		expect(data1.advisor.effective).toBe("@advisor");

		// Invalid custom model selector
		const resInvalid = await handleSetAgentAdvisor(
			asSession(session),
			{ type: "set_agent_advisor", agent: "task", value: "nonexistent/model" },
			"2",
		);
		expect(resInvalid.success).toBe(false);

		// Valid model selector
		const resValidModel = await handleSetAgentAdvisor(
			asSession(session),
			{ type: "set_agent_advisor", agent: "task", value: "anthropic/claude-sonnet-4-20250514" },
			"3",
		);
		expect(resValidModel.success).toBe(true);
		const data3 = dataOf(resValidModel, "set_agent_advisor");
		expect(data3.advisor.effective).toBe("anthropic/claude-sonnet-4-20250514");

		// Clear
		const resClear = await handleSetAgentAdvisor(
			asSession(session),
			{ type: "set_agent_advisor", agent: "task", value: null },
			"4",
		);
		expect(resClear.success).toBe(true);
		const data4 = dataOf(resClear, "set_agent_advisor");
		expect(data4.advisor.effective).toBeUndefined();
	});
});
