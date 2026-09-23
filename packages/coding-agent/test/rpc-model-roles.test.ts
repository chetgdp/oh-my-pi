import { describe, expect, test } from "bun:test";
import type { Model } from "@oh-my-pi/pi-ai";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import {
	buildModelRoles,
	handleCycleRoleModel,
	handleDeleteModelRole,
	handleSetCycleOrder,
	handleSetModelRole,
	handleSetModelTag,
	type ModelConfigSession,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-model-config";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import type { RoleModelCycle, RoleModelCycleResult } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import type { RpcModelRole, RpcResponse } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcOutputFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-response";

function dataOf<C extends Extract<RpcResponse, { success: true }>["command"]>(
	resp: RpcResponse,
	command: C,
): Extract<RpcResponse, { command: C; success: true }> extends { data: infer D } ? D : never {
	if (!resp.success || resp.command !== command) {
		throw new Error(`Expected success response for command ${command}, got ${JSON.stringify(resp)}`);
	}
	const successResp = resp as Extract<RpcResponse, { command: C; success: true }> & { data: unknown };
	return successResp.data as Extract<RpcResponse, { command: C; success: true }> extends { data: infer D } ? D : never;
}
const fakeSonnet = {
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

const fakeHaiku = {
	provider: "anthropic",
	id: "claude-haiku-3-5",
	name: "Claude Haiku 3.5",
	contextWindow: 200_000,
	maxOutputTokens: 8_192,
	supportsImages: true,
	supportsPromptCaching: true,
	inputPrice: 0.8,
	outputPrice: 4,
	cacheWritePrice: 1,
	cacheReadPrice: 0.08,
} as unknown as Model;

const fakeGemini = {
	provider: "google-antigravity",
	id: "gemini-3.8-flash",
	name: "Gemini 3.8 Flash",
	contextWindow: 1_000_000,
	maxOutputTokens: 8_192,
	supportsImages: true,
	supportsPromptCaching: true,
	inputPrice: 0.1,
	outputPrice: 0.4,
	cacheWritePrice: 0.1,
	cacheReadPrice: 0.025,
} as unknown as Model;

const catalogModels = [fakeSonnet, fakeHaiku, fakeGemini];

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
	frames: RpcOutputFrame[];
	flushCount: number;
}

function createSessionHarness(overrides?: Record<string, unknown>): TestSessionHarness {
	const settings = Settings.isolated(overrides as never);
	const frames: RpcOutputFrame[] = [];
	let flushCount = 0;

	const origFlush = settings.flush.bind(settings);
	settings.flush = async () => {
		flushCount++;
		return origFlush();
	};

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
		cycleRoleModels: async (
			roleOrder: readonly string[],
			_direction?: "forward" | "backward",
		): Promise<RoleModelCycleResult | undefined> => {
			if (roleOrder.length === 0) return undefined;
			return {
				model: fakeHaiku,
				thinkingLevel: undefined,
				role: roleOrder[0],
			};
		},
		getRoleModelCycle: (roleOrder: readonly string[]): RoleModelCycle | undefined => {
			return {
				models: roleOrder.map(r => ({
					role: r,
					model: r === "default" ? fakeSonnet : fakeHaiku,
					thinkingLevel: undefined,
					explicitThinkingLevel: false,
				})),
				currentIndex: 0,
			};
		},
	};

	return {
		session: sessionStub as unknown as AgentSession,
		frames,
		get flushCount() {
			return flushCount;
		},
	};
}

describe("set_model_role", () => {
	test("persist:false sets runtime value without touching persisted layer", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetModelRole(
			harness.session,
			{
				type: "set_model_role",
				role: "smol",
				selector: "anthropic/claude-haiku-3-5",
				persist: false,
			},
			"req-1",
			output,
		);

		expect(response.success).toBe(true);
		expect(harness.session.settings.getModelRole("smol")).toBe("anthropic/claude-haiku-3-5");
		expect(harness.session.settings.getModelRoleSource("smol")).toBe("default");
		expect(harness.session.settings.getModelRoleProvenance("smol")).toBe("runtime");
		expect(harness.flushCount).toBe(0);
		expect(harness.frames).toEqual([{ type: "config_update", modelRoles: true }]);
	});

	test("persist:false clear removes only the runtime value and leaves other roles' provenance intact", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);
		harness.session.settings.setModelRole("smol", "anthropic/claude-sonnet-4-20250514");
		harness.session.settings.setModelRole("slow", "anthropic/claude-sonnet-4-20250514");

		await handleSetModelRole(
			harness.session,
			{ type: "set_model_role", role: "smol", selector: "anthropic/claude-haiku-3-5", persist: false },
			"req-1",
			output,
		);
		expect(harness.session.settings.getModelRoleProvenance("slow")).toBe("global");

		const response = await handleSetModelRole(
			harness.session,
			{ type: "set_model_role", role: "smol", selector: null, persist: false },
			"req-2",
			output,
		);

		expect(response.success).toBe(true);
		expect(harness.session.settings.getModelRole("smol")).toBe("anthropic/claude-sonnet-4-20250514");
		expect(harness.session.settings.getModelRoleProvenance("smol")).toBe("global");
		expect(harness.flushCount).toBe(0);
	});

	test("storage:project writes to project settings layer", async () => {
		const harness = createSessionHarness({ modelRoleStorage: "project" });
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetModelRole(
			harness.session,
			{
				type: "set_model_role",
				role: "slow",
				selector: "anthropic/claude-sonnet-4-20250514",
				storage: "project",
			},
			"req-2",
			output,
		);

		expect(response.success).toBe(true);
		expect(harness.session.settings.getProjectModelRole("slow")).toBe("anthropic/claude-sonnet-4-20250514");
		expect(harness.session.settings.getModelRoleSource("slow")).toBe("project");
		expect(harness.flushCount).toBe(1);
		expect(harness.frames).toEqual([{ type: "config_update", modelRoles: true }]);
	});

	test("a selector carrying :level is stored verbatim, not re-suffixed", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetModelRole(
			harness.session,
			{ type: "set_model_role", role: "slow", selector: "anthropic/claude-sonnet-4-20250514:low" },
			"req-3",
			output,
		);

		expect(response.success).toBe(true);
		expect(harness.session.settings.getModelRole("slow")).toBe("anthropic/claude-sonnet-4-20250514:low");
	});

	test("storage:project with modelRoleStorage global returns error response", async () => {
		const harness = createSessionHarness({ modelRoleStorage: "global" });
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetModelRole(
			harness.session,
			{
				type: "set_model_role",
				role: "slow",
				selector: "anthropic/claude-sonnet-4-20250514",
				storage: "project",
			},
			"req-3",
			output,
		);

		expect(response.success).toBe(false);
		if (!response.success) {
			expect(response.error).toContain("project storage disabled");
		}
		expect(harness.frames).toHaveLength(0);
	});
});

describe("delete_model_role", () => {
	test("refuses built-in MODEL_ROLES id", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleDeleteModelRole(
			harness.session,
			{ type: "delete_model_role", role: "smol" },
			"req-del-builtin",
			output,
		);

		expect(response.success).toBe(false);
		if (!response.success) {
			expect(response.error).toContain("Cannot delete built-in role: smol");
		}
	});

	test("removes custom role from global, project, and cycleOrder", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		harness.session.settings.set("cycleOrder", ["smol", "custom-audit", "slow"]);
		harness.session.settings.setModelRole("custom-audit", "anthropic/claude-sonnet-4-20250514");
		harness.session.settings.setProjectModelRole("custom-audit", "anthropic/claude-haiku-3-5");

		const response = await handleDeleteModelRole(
			harness.session,
			{ type: "delete_model_role", role: "custom-audit" },
			"req-del-custom",
			output,
		);

		expect(response.success).toBe(true);
		expect(harness.session.settings.getModelRole("custom-audit")).toBeUndefined();
		expect(harness.session.settings.getProjectModelRole("custom-audit")).toBeUndefined();
		expect(harness.session.settings.get("cycleOrder")).toEqual(["smol", "slow"]);
		expect(harness.frames).toEqual([{ type: "config_update", modelRoles: true }]);
	});
});

describe("set_cycle_order", () => {
	test("rejects unknown role", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetCycleOrder(
			harness.session,
			{ type: "set_cycle_order", order: ["smol", "non-existent-role"] },
			"req-cycle-unknown",
			output,
		);

		expect(response.success).toBe(false);
		if (!response.success) {
			expect(response.error).toContain("Unknown role in cycle order");
		}
	});

	test("rejects duplicate role", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetCycleOrder(
			harness.session,
			{ type: "set_cycle_order", order: ["smol", "default", "smol"] },
			"req-cycle-dup",
			output,
		);

		expect(response.success).toBe(false);
		if (!response.success) {
			expect(response.error).toContain("Duplicate role in cycle order");
		}
	});

	test("updates cycleOrder and emits config_update", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetCycleOrder(
			harness.session,
			{ type: "set_cycle_order", order: ["slow", "default"] },
			"req-cycle-ok",
			output,
		);

		expect(response.success).toBe(true);
		expect(harness.session.settings.get("cycleOrder")).toEqual(["slow", "default"]);
		expect(harness.frames).toEqual([{ type: "config_update", modelRoles: true }]);
	});
});

describe("set_model_tag", () => {
	test("rejects unknown model", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleSetModelTag(
			harness.session,
			{ type: "set_model_tag", model: "unknown-provider/unknown-id", tag: "Fast" },
			"req-tag-unknown",
			output,
		);

		expect(response.success).toBe(false);
		if (!response.success) {
			expect(response.error).toContain("Unknown model: unknown-provider/unknown-id");
		}
	});

	test("round-trips tag into buildModelRoles modelTags and role tag", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		harness.session.settings.setModelRole("smol", "anthropic/claude-haiku-3-5");

		const response = await handleSetModelTag(
			harness.session,
			{ type: "set_model_tag", model: "anthropic/claude-haiku-3-5", tag: "Speedy" },
			"req-tag-ok",
			output,
		);

		expect(response.success).toBe(true);
		const data = dataOf(response, "set_model_tag");
		expect(data.modelTags["anthropic/claude-haiku-3-5"]).toBe("Speedy");
		const smolRole = data.roles.find(r => r.id === "smol");
		expect(smolRole?.tag).toBe("Speedy");
		expect(harness.frames).toEqual([{ type: "config_update", modelRoles: true }]);
	});
});

describe("buildModelRoles additions", () => {
	test("reports autoSelected for unconfigured role and custom:true for custom role", async () => {
		const harness = createSessionHarness();
		harness.session.settings.setModelRole("custom-helper", "anthropic/claude-haiku-3-5");

		const result = await buildModelRoles(harness.session as unknown as ModelConfigSession);
		const smolRole = result.roles.find((r: RpcModelRole) => r.id === "smol");
		const customRole = result.roles.find((r: RpcModelRole) => r.id === "custom-helper");

		expect(smolRole).toBeDefined();
		expect(smolRole?.custom).toBe(false);
		expect(smolRole?.autoSelected).toBeDefined();
		expect(smolRole?.autoSelected?.id).toBe("gemini-3.8-flash");

		expect(customRole).toBeDefined();
		expect(customRole?.custom).toBe(true);
		expect(customRole?.provenance).toBe("global");
	});
});

describe("cycle_role_model", () => {
	test("cycles configured role models", async () => {
		const harness = createSessionHarness();
		const output = (frame: RpcOutputFrame) => harness.frames.push(frame);

		const response = await handleCycleRoleModel(
			harness.session,
			{ type: "cycle_role_model", direction: "forward" },
			"req-cycle-model",
			output,
		);

		expect(response.success).toBe(true);
		const data = dataOf(response, "cycle_role_model");
		expect(data).not.toBeNull();
		expect(data?.role).toBe("smol");
		expect(data?.model.id).toBe("claude-haiku-3-5");
		expect(data?.cycle.roles).toContain("smol");
	});
});
