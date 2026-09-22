import { describe, expect, test } from "bun:test";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import {
	buildModelRoles,
	buildAgents,
	type ModelConfigSession,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-model-config";
import type { RpcModelRole } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

// ---------------------------------------------------------------------------
// Fake model and registry
// ---------------------------------------------------------------------------

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

function makeSession(overrides?: Record<string, unknown>): ModelConfigSession {
	const settings = Settings.isolated(overrides as never);
	return {
		settings,
		sessionManager: { getCwd: () => "/tmp/test-project" },
		modelRegistry: fakeRegistry as never,
		getAvailableModels: () => [fakeModel],
		model: fakeModel,
		effectiveExtensionRoots: { explicit: [], mode: "auto", configured: [], provenance: "default" } as never,
		getSessionAgents: () => [],
	};
}

// ---------------------------------------------------------------------------
// buildModelRoles
// ---------------------------------------------------------------------------

describe("buildModelRoles", () => {
	test("smol reports source=fallback fallbackFrom=default when unset", async () => {
		const session = makeSession();
		const result = await buildModelRoles(session);
		const smol = result.roles.find((r: RpcModelRole) => r.id === "smol");
		expect(smol).toBeDefined();
		expect(smol!.source).toBe("fallback");
		expect(smol!.fallbackFrom).toBe("default");
	});

	test("smol reports source=global after setModelRole", async () => {
		const session = makeSession();
		session.settings.setModelRole("smol", "anthropic/claude-sonnet-4-20250514");
		const result = await buildModelRoles(session);
		const smol = result.roles.find((r: RpcModelRole) => r.id === "smol");
		expect(smol).toBeDefined();
		expect(smol!.source).toBe("global");
		expect(smol!.configured).toBe("anthropic/claude-sonnet-4-20250514");
	});

	test("default role with active model has source=active", async () => {
		const session = makeSession();
		const result = await buildModelRoles(session);
		const def = result.roles.find((r: RpcModelRole) => r.id === "default");
		expect(def).toBeDefined();
		expect(def!.source).toBe("active");
	});

	test("advisor reports source=unset when slow is not configured (configuredOnly)", async () => {
		const session = makeSession();
		const result = await buildModelRoles(session);
		const advisor = result.roles.find((r: RpcModelRole) => r.id === "advisor");
		expect(advisor).toBeDefined();
		expect(advisor!.source).toBe("unset");
	});

	test("tiny reports source=fallback fallbackFrom=smol", async () => {
		const session = makeSession();
		const result = await buildModelRoles(session);
		const tiny = result.roles.find((r: RpcModelRole) => r.id === "tiny");
		expect(tiny).toBeDefined();
		expect(tiny!.source).toBe("fallback");
		expect(tiny!.fallbackFrom).toBe("smol");
	});

	test("eligible contains model keys", async () => {
		const session = makeSession();
		const result = await buildModelRoles(session);
		const def = result.roles.find((r: RpcModelRole) => r.id === "default");
		expect(def!.eligible).toContain("anthropic/claude-sonnet-4-20250514");
	});
});

// ---------------------------------------------------------------------------
// buildAgents
// ---------------------------------------------------------------------------

describe("buildAgents", () => {
	test("returns discovered agents with defaultAgent", async () => {
		const session = makeSession();
		const result = await buildAgents(session);
		// Bundled agents always include at least "task"
		expect(result.defaultAgent).toBe("task");
		expect(result.agents.length).toBeGreaterThan(0);
		const taskAgent = result.agents.find(a => a.name === "task");
		expect(taskAgent).toBeDefined();
		expect(taskAgent!.disabled).toBe(false);
	});

	test("override appears in agent info", async () => {
		const session = makeSession({
			"task.agentModelOverrides": { task: "anthropic/claude-sonnet-4-20250514" },
		});
		const result = await buildAgents(session);
		const taskAgent = result.agents.find(a => a.name === "task");
		expect(taskAgent).toBeDefined();
		expect(taskAgent!.override).toBe("anthropic/claude-sonnet-4-20250514");
		expect(taskAgent!.patterns[0]).toBe("anthropic/claude-sonnet-4-20250514");
	});

	test("disabled agent has disabled=true", async () => {
		const session = makeSession({
			"task.disabledAgents": ["scout"],
		});
		const result = await buildAgents(session);
		const scout = result.agents.find(a => a.name === "scout");
		expect(scout).toBeDefined();
		expect(scout!.disabled).toBe(true);
	});
});
