import { describe, expect, test } from "bun:test";
import type { Model } from "@oh-my-pi/pi-ai";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import {
	buildModelBrowser,
	handleGetModelBrowser,
	handleRefreshModels,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-model-browser";
import type { ModelConfigSession } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-model-config";
import type { RpcOutput } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-response";
import type { RpcServerResponse } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";

function dataOf<C extends Extract<RpcServerResponse, { success: true }>["command"]>(
	resp: RpcServerResponse,
	command: C,
): Extract<RpcServerResponse, { command: C; success: true }> extends { data: infer D } ? D : never {
	if (!resp.success || resp.command !== command) {
		throw new Error(`Expected success response for command ${command}, got ${JSON.stringify(resp)}`);
	}
	const successResp = resp as Extract<RpcServerResponse, { command: C; success: true }> & { data: unknown };
	return successResp.data as Extract<RpcServerResponse, { command: C; success: true }> extends { data: infer D }
		? D
		: never;
}

// ---------------------------------------------------------------------------
// Fake models and registry
// ---------------------------------------------------------------------------

const fakeAnthropicModel = {
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
} as unknown as Model;

const fakeOpenAiModel = {
	provider: "openai",
	id: "gpt-4o",
	name: "GPT-4o",
	contextWindow: 128_000,
	maxOutputTokens: 4_096,
} as unknown as Model;

interface FakeRegistryOptions {
	models?: Model[];
	availableModels?: Model[];
	authProviders?: string[];
	discoverableProviders?: string[];
	discoveryStates?: Record<
		string,
		{ optional: boolean; status: "idle" | "ok" | "empty" | "cached" | "unavailable" | "unauthenticated" }
	>;
	onRefresh?: (strategy: string) => Promise<void>;
	onRefreshProvider?: (provider: string, strategy: string) => Promise<void>;
}

function makeFakeRegistry(options: FakeRegistryOptions = {}) {
	const allModels = options.models ?? [fakeAnthropicModel, fakeOpenAiModel];
	const available = options.availableModels ?? [fakeAnthropicModel];
	const authed = new Set(options.authProviders ?? ["anthropic"]);
	const discoverable = options.discoverableProviders ?? ["anthropic", "openai", "ollama"];
	const discoveryStates = options.discoveryStates ?? {
		ollama: { optional: true, status: "idle" as const },
	};

	return {
		getAll(_kind?: string) {
			return allModels;
		},
		getAvailable(_filter?: string) {
			return available;
		},
		find(provider: string, id: string) {
			return allModels.find(m => m.provider === provider && m.id === id);
		},
		hasConfiguredAuth(model: Model) {
			return authed.has(model.provider);
		},
		hasConcreteAuth(provider: string) {
			return authed.has(provider);
		},
		authStorage: {
			hasAuth(provider: string) {
				return authed.has(provider);
			},
		},
		getDiscoverableProviders() {
			return discoverable;
		},
		getProviderDiscoveryState(provider: string) {
			return discoveryStates[provider];
		},
		async refresh(strategy: "online") {
			if (options.onRefresh) await options.onRefresh(strategy);
		},
		async refreshProvider(provider: string, strategy: "online") {
			if (options.onRefreshProvider) await options.onRefreshProvider(provider, strategy);
		},
		awaitBackgroundRefresh() {
			return Promise.resolve();
		},
	};
}

function makeSession(
	overrides?: Record<string, unknown>,
	registryOptions?: FakeRegistryOptions,
	storageOverrides?: {
		usageOrder?: string[];
		perfMap?: Map<string, { samples: number; tps: number; ttftMs: number | null }>;
	},
): ModelConfigSession & { agentSession: AgentSession } {
	const settings = Settings.isolated(overrides as never);

	if (storageOverrides) {
		const storage = {
			getModelUsageOrder() {
				return storageOverrides.usageOrder ?? [];
			},
			getModelPerf() {
				return storageOverrides.perfMap ?? new Map();
			},
		};
		Object.defineProperty(settings, "getStorage", {
			value: () => storage,
		});
	}

	const registry = makeFakeRegistry(registryOptions);

	const session = {
		settings,
		sessionManager: { getCwd: () => "/tmp/test-project" },
		modelRegistry: registry as never,
		getAvailableModels: () => registry.getAvailable() as never,
		model: fakeAnthropicModel,
		effectiveExtensionRoots: { explicit: [], mode: "auto", configured: [], provenance: "default" } as never,
		getSessionAgents: () => [],
	};

	return {
		...session,
		agentSession: session as unknown as AgentSession,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildModelBrowser", () => {
	test("locked providers appear only as provider rows unless a role or MRU references a model", async () => {
		const session = makeSession({}, { authProviders: ["anthropic"] });
		const result = await buildModelBrowser(session);

		expect(result.models.find(m => m.provider === "anthropic")?.locked).toBe(false);
		expect(result.models.find(m => m.provider === "openai")).toBeUndefined();
		const openaiProvider = result.providers.find(p => p.id === "openai");
		expect(openaiProvider?.authenticated).toBe(false);
		expect(openaiProvider?.modelCount).toBe(1);

		const referenced = makeSession({ modelRoles: { smol: "openai/gpt-4o" } }, { authProviders: ["anthropic"] });
		const withRole = await buildModelBrowser(referenced);
		expect(withRole.models.find(m => m.provider === "openai")?.locked).toBe(true);
	});

	test("a role configured to a model appears with auto:false; unconfigured with auto:true", async () => {
		const session = makeSession({
			modelRoles: {
				default: "anthropic/claude-sonnet-4-20250514",
			},
		});

		const result = await buildModelBrowser(session);
		const anthropicModel = result.models.find(m => m.selector === "anthropic/claude-sonnet-4-20250514");

		expect(anthropicModel).toBeDefined();

		const defaultRole = anthropicModel!.roles.find(r => r.role === "default");
		expect(defaultRole).toBeDefined();
		expect(defaultRole!.auto).toBe(false);

		const autoRoles = anthropicModel!.roles.filter(r => r.auto);
		expect(autoRoles.length).toBeGreaterThan(0);
	});

	test("perf map values surface on the matching selector", async () => {
		const perfMap = new Map([["anthropic/claude-sonnet-4-20250514", { samples: 42, tps: 120.5, ttftMs: 450 }]]);
		const session = makeSession({}, undefined, {
			usageOrder: ["anthropic/claude-sonnet-4-20250514"],
			perfMap,
		});

		const result = await buildModelBrowser(session);
		const model = result.models.find(m => m.selector === "anthropic/claude-sonnet-4-20250514");

		expect(model).toBeDefined();
		expect(model!.perf).toEqual({ samples: 42, tps: 120.5, ttftMs: 450 });
		expect(result.mruOrder).toEqual(["anthropic/claude-sonnet-4-20250514"]);
	});

	test("providers include discoverable-but-empty providers with discovery state and modelCount:0", async () => {
		const session = makeSession(
			{},
			{
				discoverableProviders: ["anthropic", "openai", "ollama"],
				discoveryStates: {
					ollama: { optional: true, status: "idle" },
				},
			},
		);

		const result = await buildModelBrowser(session);
		const ollama = result.providers.find(p => p.id === "ollama");

		expect(ollama).toBeDefined();
		expect(ollama!.discoverable).toBe(true);
		expect(ollama!.modelCount).toBe(0);
		expect(ollama!.discovery).toEqual({ optional: true, status: "idle" });
	});
});

describe("handleGetModelBrowser", () => {
	test("returns successful response with browser data", async () => {
		const session = makeSession();
		const emitted: unknown[] = [];
		const output: RpcOutput = frame => emitted.push(frame);

		const response = await handleGetModelBrowser(
			session.agentSession,
			{ type: "get_model_browser" },
			"req-1",
			output,
		);

		expect(response.type).toBe("response");
		expect(response.command).toBe("get_model_browser");
		expect(response.success).toBe(true);
		const data = dataOf(response, "get_model_browser");
		expect(data.models.length).toBeGreaterThan(0);
	});
});

describe("handleRefreshModels", () => {
	test("refresh_models with unknown provider returns an error and emits nothing", async () => {
		const session = makeSession();
		const emitted: unknown[] = [];
		const output: RpcOutput = frame => emitted.push(frame);

		const response = await handleRefreshModels(
			session.agentSession,
			{ type: "refresh_models", provider: "unknown-provider-xyz" },
			"req-err",
			output,
		);

		expect(response.type).toBe("response");
		if (response.type === "response") {
			expect(response.success).toBe(false);
		}
		expect(emitted.length).toBe(0);
	});

	test("refresh_models success emits exactly one config_update {models:true}", async () => {
		let refreshedProvider: string | undefined;
		const session = makeSession(
			{},
			{
				onRefreshProvider: async provider => {
					refreshedProvider = provider;
				},
			},
		);
		const emitted: unknown[] = [];
		const output: RpcOutput = frame => emitted.push(frame);

		const response = await handleRefreshModels(
			session.agentSession,
			{ type: "refresh_models", provider: "anthropic" },
			"req-success",
			output,
		);

		expect(response.type).toBe("response");
		if (response.type === "response") {
			expect(response.success).toBe(true);
		}
		expect(refreshedProvider).toBe("anthropic");
		expect(emitted).toEqual([{ type: "config_update", models: true }]);
	});

	test("refresh_models without provider calls registry.refresh and emits config_update", async () => {
		let generalRefresh = false;
		const session = makeSession(
			{},
			{
				onRefresh: async () => {
					generalRefresh = true;
				},
			},
		);
		const emitted: unknown[] = [];
		const output: RpcOutput = frame => emitted.push(frame);

		const response = await handleRefreshModels(session.agentSession, { type: "refresh_models" }, "req-all", output);

		expect(response.type).toBe("response");
		if (response.type === "response") {
			expect(response.success).toBe(true);
		}
		expect(generalRefresh).toBe(true);
		expect(emitted).toEqual([{ type: "config_update", models: true }]);
	});
});
