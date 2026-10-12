import { afterEach, describe, expect, it, vi } from "bun:test";
import type { Api, Model } from "@oh-my-pi/pi-ai";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import * as sdkModule from "@oh-my-pi/pi-coding-agent/sdk";
import type { CreateAgentSessionOptions } from "@oh-my-pi/pi-coding-agent/sdk";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { buildSystemPrompt } from "@oh-my-pi/pi-coding-agent/system-prompt";
import { runSubprocess } from "@oh-my-pi/pi-coding-agent/task/executor";
import { createSessionDefaults } from "./helpers/session-defaults";

const MARKER = "ORCHESTRATOR-ONLY-APPEND-MARKER";

function model(): Model<Api> {
	return buildModel({
		provider: "primary",
		id: "m",
		name: "m",
		api: "openai-completions",
		baseUrl: "https://primary.example.test",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 8192,
	});
}

function yieldingSession(): AgentSession {
	const listeners: Array<(event: { type: string; [key: string]: unknown }) => void> = [];
	return {
		...createSessionDefaults(),
		agent: { state: { systemPrompt: ["test"] } },
		state: { messages: [] },
		model: model(),
		extensionRunner: undefined,
		sessionManager: { appendSessionInit: () => {} },
		getActiveToolNames: () => ["yield"],
		getEnabledToolNames: () => ["yield"],
		subscribe: (listener: (event: { type: string; [key: string]: unknown }) => void) => {
			listeners.push(listener);
			return () => {};
		},
		prompt: async () => {
			for (const listener of listeners) {
				listener({
					type: "tool_execution_end",
					toolCallId: "tool-yield",
					toolName: "yield",
					result: { content: [{ type: "text", text: "Result submitted." }], details: { status: "success" } },
					isError: false,
				});
			}
		},
	} as unknown as AgentSession;
}

describe("append system prompt isolation", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("reaches the session it was given but not a subagent spawned from it", async () => {
		const baseInputs = {
			cwd: "/tmp",
			contextFiles: [],
			skills: [],
			rules: [],
			toolNames: [],
			workspaceTree: { rootPath: "/tmp", rendered: "", truncated: false, totalLines: 0, agentsMdFiles: [] },
		};
		const parent = await buildSystemPrompt({ ...baseInputs, appendSystemPrompt: MARKER });
		expect(parent.systemPrompt.join("\n\n")).toContain(MARKER);

		let childOptions: CreateAgentSessionOptions | undefined;
		vi.spyOn(sdkModule, "createAgentSession").mockImplementation(async options => {
			childOptions = options;
			return { session: yieldingSession(), extensionsResult: {}, setToolUIContext: () => {} } as never;
		});
		await runSubprocess({
			cwd: "/tmp",
			agent: { name: "task", description: "test", systemPrompt: "Do the assigned work.", source: "bundled" },
			task: "work",
			index: 0,
			id: "append-isolation",
			modelOverride: "primary/m",
			settings: Settings.isolated({}),
			modelRegistry: {
				refresh: async () => {},
				getAvailable: () => [model()],
				getApiKey: async () => "test-key",
			} as never,
			enableLsp: false,
		});

		if (!childOptions) throw new Error("subagent session was not created");
		expect(childOptions.appendSystemPrompt).toBeUndefined();
		// The sdk hands the child's systemPrompt callback a default built from the child's own options.
		const childDefault = await buildSystemPrompt({
			...baseInputs,
			appendSystemPrompt: childOptions.appendSystemPrompt,
		});
		const compose = childOptions.systemPrompt;
		if (typeof compose !== "function") throw new Error("expected subagent systemPrompt composer");
		const childPrompt = await compose(childDefault.systemPrompt);
		const childText = (Array.isArray(childPrompt) ? childPrompt : [childPrompt]).join("\n\n");
		expect(childText).toContain("Do the assigned work.");
		expect(childText).not.toContain(MARKER);
	});
});
