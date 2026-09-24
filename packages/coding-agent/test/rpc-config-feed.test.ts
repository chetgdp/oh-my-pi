import { describe, expect, test } from "bun:test";
import type { Model } from "@oh-my-pi/pi-ai";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { subscribeConfigUpdates } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-config-feed";
import { handleSetModelRole } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-model-config";
import type { RpcOutputFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-response";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";

const fakeSonnet = {
	id: "claude-sonnet-4-20250514",
	name: "Claude Sonnet 4",
	provider: "anthropic",
	contextWindow: 200_000,
	maxOutputTokens: 16_384,
	supportsImages: true,
	supportsPromptCaching: true,
	inputPrice: 3,
	outputPrice: 15,
	cacheWritePrice: 3.75,
	cacheReadPrice: 0.3,
} as unknown as Model;

const fakeHaiku = {
	id: "claude-haiku-3-5",
	name: "Claude Haiku 3.5",
	provider: "anthropic",
	contextWindow: 200_000,
	maxOutputTokens: 8192,
	supportsImages: true,
	supportsPromptCaching: true,
	inputPrice: 1,
	outputPrice: 5,
	cacheWritePrice: 1.25,
	cacheReadPrice: 0.1,
} as unknown as Model;

const catalogModels = [fakeSonnet, fakeHaiku];

const fakeRegistry = {
	getAll(_kind?: string) {
		return catalogModels;
	},
	getAvailable(_filter?: string) {
		return catalogModels;
	},
	find(provider: string, id: string) {
		return catalogModels.find(m => m.provider === provider && m.id === id);
	},
	awaitBackgroundRefresh() {
		return Promise.resolve();
	},
};

interface TestSessionHarness {
	session: AgentSession;
	settings: Settings;
}

function createSessionHarness(overrides?: Record<string, unknown>): TestSessionHarness {
	const settings = Settings.isolated(overrides as never);
	let currentModel = fakeSonnet;

	const sessionStub = {
		settings,
		sessionManager: { getCwd: () => "/tmp/test-project" },
		modelRegistry: fakeRegistry as never,
		getAvailableModels: () => catalogModels,
		get model() {
			return currentModel;
		},
		scopedModels: [],
		effectiveExtensionRoots: { explicit: [], mode: "auto", configured: [], provenance: "default" } as never,
		getSessionAgents: () => [],
		setModel: async (model: typeof fakeSonnet, _role?: string, _options?: { persist?: boolean }) => {
			currentModel = model;
			return { switched: true };
		},
		setThinkingLevel: () => {},
	};

	return {
		session: sessionStub as unknown as AgentSession,
		settings,
	};
}

describe("subscribeConfigUpdates", () => {
	test("direct settings.setModelRole yields config_update with modelRoles:true and agents:true", async () => {
		const settings = Settings.isolated();
		const frames: RpcOutputFrame[] = [];
		const unsubscribe = subscribeConfigUpdates(settings, frame => frames.push(frame));

		try {
			settings.setModelRole("smol", "anthropic/claude-haiku-3-5");
			expect(frames).toEqual([]);
			await Promise.resolve();
			expect(frames).toEqual([{ type: "config_update", modelRoles: true, agents: true }]);
		} finally {
			unsubscribe();
			settings.cancelPendingSaves();
		}
	});

	test("settings.set task.disabledAgents yields config_update with agents:true", async () => {
		const settings = Settings.isolated();
		const frames: RpcOutputFrame[] = [];
		const unsubscribe = subscribeConfigUpdates(settings, frame => frames.push(frame));

		try {
			settings.set("task.disabledAgents", ["scout"]);
			expect(frames).toEqual([]);
			await Promise.resolve();
			expect(frames).toEqual([{ type: "config_update", agents: true }]);
		} finally {
			unsubscribe();
			settings.cancelPendingSaves();
		}
	});

	test("burst of cycleOrder and task.agentAdvisor in the same synchronous run yields one coalesced frame with both flags", async () => {
		const settings = Settings.isolated();
		const frames: RpcOutputFrame[] = [];
		const unsubscribe = subscribeConfigUpdates(settings, frame => frames.push(frame));

		try {
			settings.set("cycleOrder", ["smol"]);
			settings.set("task.agentAdvisor", { explore: "auto" });
			expect(frames).toEqual([]);
			await Promise.resolve();
			expect(frames).toEqual([{ type: "config_update", modelRoles: true, agents: true }]);
		} finally {
			unsubscribe();
			settings.cancelPendingSaves();
		}
	});

	test("unrelated setting change yields no config_update frame", async () => {
		const settings = Settings.isolated();
		const frames: RpcOutputFrame[] = [];
		const unsubscribe = subscribeConfigUpdates(settings, frame => frames.push(frame));

		try {
			settings.set("autoResume", true);
			await Promise.resolve();
			expect(frames).toEqual([]);
		} finally {
			unsubscribe();
			settings.cancelPendingSaves();
		}
	});

	test("two subscribers on the same settings instance both receive the config_update frame", async () => {
		const settings = Settings.isolated();
		const conn1Frames: RpcOutputFrame[] = [];
		const conn2Frames: RpcOutputFrame[] = [];
		const unsubscribe1 = subscribeConfigUpdates(settings, frame => conn1Frames.push(frame));
		const unsubscribe2 = subscribeConfigUpdates(settings, frame => conn2Frames.push(frame));

		try {
			settings.set("task.disabledAgents", ["scout"]);
			await Promise.resolve();
			expect(conn1Frames).toEqual([{ type: "config_update", agents: true }]);
			expect(conn2Frames).toEqual([{ type: "config_update", agents: true }]);
		} finally {
			unsubscribe1();
			unsubscribe2();
			settings.cancelPendingSaves();
		}
	});

	test("unsubscribe before microtask drops pending frame and changes after unsubscribe yield no frame", async () => {
		const settings = Settings.isolated();
		const frames: RpcOutputFrame[] = [];
		const unsubscribe = subscribeConfigUpdates(settings, frame => frames.push(frame));

		try {
			settings.set("task.disabledAgents", ["scout"]);
			unsubscribe();
			await Promise.resolve();
			expect(frames).toEqual([]);

			settings.set("task.disabledAgents", ["scout", "planner"]);
			await Promise.resolve();
			expect(frames).toEqual([]);
		} finally {
			settings.cancelPendingSaves();
		}
	});

	test("real handleSetModelRole call with feed subscribed yields exactly one config_update frame", async () => {
		const harness = createSessionHarness();
		const frames: RpcOutputFrame[] = [];
		const unsubscribe = subscribeConfigUpdates(harness.session.settings, frame => frames.push(frame));

		try {
			const response = await handleSetModelRole(
				harness.session,
				{
					type: "set_model_role",
					role: "smol",
					selector: "anthropic/claude-haiku-3-5",
					persist: false,
				},
				"req-1",
			);

			expect(response.success).toBe(true);
			await Promise.resolve();
			expect(frames).toEqual([{ type: "config_update", modelRoles: true, agents: true }]);
		} finally {
			unsubscribe();
			harness.session.settings.cancelPendingSaves();
		}
	});
});
