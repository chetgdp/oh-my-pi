import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import type { Api, AssistantMessage, Context, Model, ModelSpec, SimpleStreamOptions } from "@oh-my-pi/pi-ai";
import { clearCustomApis, registerCustomApi } from "@oh-my-pi/pi-ai";
import { AssistantMessageEventStream } from "@oh-my-pi/pi-ai/utils/event-stream";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { Omem, OmemRefusalError } from "@oh-my-pi/pi-coding-agent/omem/index";
import {
	createOmemCompleteFn,
	OMEM_NOTICE_SOURCE,
	OmemMode,
	resolveOmemRoleModel,
} from "@oh-my-pi/pi-coding-agent/session/omem-mode";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";
import { createAssistantMessage } from "./helpers/agent-session-setup";

function text(content: Context["messages"][number]["content"]): string {
	if (typeof content === "string") return content;
	return content.map(part => ("text" in part ? part.text : "")).join("");
}

describe("omem session mode", () => {
	const sessions: AgentSession[] = [];
	afterEach(async () => {
		for (const session of sessions.splice(0)) await session.dispose();
		clearCustomApis();
	});

	it("sends each user message as a fresh request: view + state, then only the new message", async () => {
		using tempDir = TempDir.createSync("@pi-omem-session-");
		const api = "test-omem-session";
		const turns: Context[] = [];
		let reply = 0;
		registerCustomApi(api, (_model, context) => {
			// Compactor calls carry only the omem system prompt and no tools.
			if (context.tools?.length) turns.push(context);
			const stream = new AssistantMessageEventStream();
			const answer = `reply-${++reply}`;
			queueMicrotask(() => {
				const message = createAssistantMessage(answer);
				stream.push({ type: "text_delta", contentIndex: 0, delta: answer, partial: message });
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		});
		const model = buildModel({
			id: "omem-session",
			name: "omem session",
			api,
			provider: "managed-primary",
			baseUrl: "http://127.0.0.1:8080/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 32_000,
			maxTokens: 1024,
		} as ModelSpec<Api>) as Model<Api>;
		const authStorage = await AuthStorage.create(tempDir.join("auth.db"));
		authStorage.keys.setRuntime(model.provider, "test-key");
		const modelRegistry = new ModelRegistry(authStorage, tempDir.join("models.yml"));
		const { session } = await createAgentSession({
			cwd: tempDir.path(),
			agentDir: tempDir.path(),
			sessionManager: SessionManager.inMemory(tempDir.path()),
			authStorage,
			modelRegistry,
			settings: Settings.isolated({ "omem.enabled": true, "omem.dir": tempDir.join("omem") }),
			model,
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			skipPythonPreflight: true,
		});
		sessions.push(session);

		try {
			expect(session.autoCompactionEnabled).toBe(false);
			const toolNames = session.agent.state.tools.map(tool => tool.name);
			expect(toolNames).toContain("zoom");
			expect(toolNames).toContain("date");
			expect(toolNames).not.toContain("new_context");

			await session.sendUserMessage("first message");
			await session.sendUserMessage("second message");
			expect(turns).toHaveLength(2);

			const second = turns[1]!;
			expect(second.messages).toHaveLength(2);
			const [view, current] = second.messages;
			const viewText = text(view!.content);
			expect(viewText.startsWith("<chat>\n")).toBe(true);
			expect(viewText).toContain("first message");
			expect(viewText).toContain("reply-1");
			expect(current!.role).toBe("user");
			expect(text(current!.content)).toBe("second message");
			// The prior turn's raw messages never ride along.
			expect(second.messages.some(message => message.role === "assistant")).toBe(false);
			expect(second.messages.filter(message => text(message.content) === "first message")).toHaveLength(0);

			const systemPrompt = second.systemPrompt?.join("\n") ?? "";
			expect(systemPrompt).not.toContain(tempDir.path());
			expect(turns[0]!.systemPrompt).toEqual(second.systemPrompt);

			// Side requests (session title, /btw, IRC) must never enter the omem log or view.
			await session.runEphemeralTurn({ promptText: "<title-request>SIDE-PROBE</title-request>" });
			const mainDir = tempDir.join("omem", "main");
			const logged = fs
				.readdirSync(mainDir)
				.map(file => fs.readFileSync(path.join(mainDir, file), "utf8"))
				.join("");
			expect(logged).toContain("second message");
			expect(logged).not.toContain("SIDE-PROBE");
			await session.sendUserMessage("third message");
			expect(text(turns.at(-1)!.messages[0]!.content)).not.toContain("SIDE-PROBE");
		} finally {
			authStorage.close();
		}
	});

	it("puts one cache mark on the last whole view block and keeps only the request-end message mark", async () => {
		const blocks = ["<chat>\n0+1|a\n1+1|b\n2+1|c\n3+1|d\n", "4+1|e\n", "</chat>"];
		const appended: string[] = [];
		const omem = {
			settle: async () => true,
			viewBlocks: () => blocks,
			viewWholeBlocks: () => 1,
			append: (_kind: string, line: string) => {
				appended.push(line);
				return [];
			},
		} as unknown as ConstructorParameters<typeof OmemMode>[0];
		const mode = new OmemMode(omem, { renderState: () => "state" });
		const request = await mode.transform([{ role: "user", content: "now", timestamp: 1 }]);
		expect(appended).toEqual(["now"]);
		expect(request).toHaveLength(2);

		const payload = {
			system: [
				{ type: "text", text: "s", cache_control: { type: "ephemeral", ttl: "1h" } as Record<string, string> },
			],
			messages: [
				{
					role: "user",
					content: [
						...blocks.map(block => ({ type: "text", text: block }) as Record<string, unknown>),
						{ type: "text", text: "state", cache_control: { type: "ephemeral" } },
					],
				},
				{ role: "user", content: [{ type: "text", text: "now", cache_control: { type: "ephemeral" } }] },
			],
		};
		expect(mode.markPayload(payload)).toBe(payload);
		expect(payload.system[0]!.cache_control).toEqual({ type: "ephemeral" });
		const marks = payload.messages.flatMap((message, m) =>
			message.content.flatMap((block, b) => ("cache_control" in block ? [[m, b]] : [])),
		);
		expect(marks).toEqual([
			[0, 0],
			[1, 0],
		]);
	});

	it("does not log the same turn's user messages again when a restarted process continues it", async () => {
		using tempDir = TempDir.createSync("@pi-omem-ledger-");
		const appended: string[] = [];
		const omem = {
			settle: async () => true,
			viewBlocks: () => ["<chat>\n", "</chat>"],
			viewWholeBlocks: () => 0,
			append: (_kind: string, line: string) => {
				appended.push(line);
				return [];
			},
		} as unknown as ConstructorParameters<typeof OmemMode>[0];
		const ledgerFile = tempDir.join("turn-ledger.json");
		// Fresh objects per process: a restart reloads the transcript from the session file.
		const turn = () => [
			{ role: "user" as const, content: "build it", timestamp: 10 },
			{ role: "user" as const, content: "also test it", timestamp: 11, steering: true },
		];

		await new OmemMode(omem, { renderState: () => "", ledgerFile }).transform(turn());
		expect(appended).toEqual(["build it", "also test it"]);

		await new OmemMode(omem, { renderState: () => "", ledgerFile }).transform(turn());
		expect(appended).toEqual(["build it", "also test it"]);

		// A genuinely new message still starts a new turn and is logged.
		const restarted = new OmemMode(omem, { renderState: () => "", ledgerFile });
		await restarted.transform([...turn(), { role: "user", content: "next", timestamp: 20 }]);
		expect(appended).toEqual(["build it", "also test it", "next"]);
	});
});

function compactorModel(api: string, id = "omem-compactor"): Model<Api> {
	return buildModel({
		id,
		name: id,
		api,
		provider: "managed-primary",
		baseUrl: "http://127.0.0.1:8080/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 32_000,
		maxTokens: 1024,
	} as ModelSpec<Api>) as Model<Api>;
}

describe("omem compaction request", () => {
	afterEach(() => clearCustomApis());

	const viewBlocks = ["<chat>\n0+1|a\n1+1|b\n2+1|c\n", "3+1|d\n4+1|e\n5+1|f\n6+1|g\n", "7+1|h\n", "</chat>"];

	function completeFor(model: Model<Api>) {
		return createOmemCompleteFn({
			resolveModel: async () => ({ model, apiKey: "k", role: "omem" }),
			sessionId: () => "s",
			recordUsage: () => {},
		});
	}

	it("sends only the omem system prompt, no tools, and marks the last whole view block", async () => {
		const api = "test-omem-compact-shape";
		const contexts: Context[] = [];
		const payloads: unknown[] = [];
		registerCustomApi(api, (_model, context, options?: SimpleStreamOptions) => {
			contexts.push(context);
			const stream = new AssistantMessageEventStream();
			queueMicrotask(async () => {
				// Anthropic-shaped wire payload, as the provider would build it with its default tail mark.
				const content = (context.messages[0]!.content as Array<{ text: string }>).map(block => ({
					type: "text",
					text: block.text,
				})) as Array<Record<string, unknown>>;
				content.at(-1)!.cache_control = { type: "ephemeral" };
				payloads.push(await options?.onPayload?.({ messages: [{ role: "user", content }] }));
				const message = createAssistantMessage("ok");
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		});
		const reply = await completeFor(compactorModel(api))({
			viewBlocks,
			wholeBlocks: 2,
			task: "summarize",
			retries: [],
			signal: new AbortController().signal,
		});
		expect(reply).toBe("ok");
		const context = contexts[0]!;
		expect(context.systemPrompt).toEqual([Omem.systemPrompt]);
		expect(context.tools ?? []).toHaveLength(0);
		const sent = (context.messages[0]!.content as Array<{ text: string }>).map(block => block.text);
		expect(sent).toEqual([...viewBlocks, "summarize"]);
		const wire = payloads[0] as { messages: Array<{ content: Array<Record<string, unknown>> }> };
		const marks = wire.messages[0]!.content.flatMap((block, index) => ("cache_control" in block ? [index] : []));
		expect(marks).toEqual([1]);
	});

	it("waits for an in-flight call over the same prefix to start streaming before sending", async () => {
		const api = "test-omem-compact-flight";
		const events: string[] = [];
		const firstStream = Promise.withResolvers<() => void>();
		let calls = 0;
		registerCustomApi(api, () => {
			const call = ++calls;
			events.push(`send-${call}`);
			const stream = new AssistantMessageEventStream();
			const startStreaming = () => {
				events.push(`stream-${call}`);
				const message = createAssistantMessage(`r${call}`);
				stream.push({ type: "text_delta", contentIndex: 0, delta: `r${call}`, partial: message });
				stream.push({ type: "done", reason: "stop", message });
			};
			if (call === 1) firstStream.resolve(startStreaming);
			else queueMicrotask(startStreaming);
			return stream;
		});
		const complete = completeFor(compactorModel(api));
		const req = (task: string) => ({
			viewBlocks,
			wholeBlocks: 2,
			task,
			retries: [],
			signal: new AbortController().signal,
		});
		const first = complete(req("one"));
		const startFirst = await firstStream.promise;
		const second = complete(req("two"));
		await Bun.sleep(20);
		expect(events).toEqual(["send-1"]);
		startFirst();
		expect(await Promise.all([first, second])).toEqual(["r1", "r2"]);
		expect(events).toEqual(["send-1", "stream-1", "send-2", "stream-2"]);
	});

	it("throws OmemRefusalError on a provider refusal stop", async () => {
		const api = "test-omem-compact-refusal";
		registerCustomApi(api, () => {
			const stream = new AssistantMessageEventStream();
			queueMicrotask(() => {
				const message: AssistantMessage = {
					...createAssistantMessage(""),
					stopReason: "error",
					stopDetails: { type: "refusal" },
					errorMessage: "Refusal (no details provided)",
				};
				stream.push({ type: "error", reason: "error", error: message });
			});
			return stream;
		});
		const result = completeFor(compactorModel(api))({
			viewBlocks,
			wholeBlocks: 2,
			task: "t",
			retries: [],
			signal: new AbortController().signal,
		});
		await expect(result).rejects.toBeInstanceOf(OmemRefusalError);
	});

	it("resolves the compactor from the omem role, falling back to smol", () => {
		const smol = compactorModel("test-omem-role", "smol-model");
		const dedicated = compactorModel("test-omem-role", "omem-model");
		const available = [smol, dedicated];
		const fallback = resolveOmemRoleModel(
			Settings.isolated({ modelRoles: { smol: "managed-primary/smol-model" } }),
			available,
		);
		expect(fallback?.model.id).toBe("smol-model");
		const configured = resolveOmemRoleModel(
			Settings.isolated({
				modelRoles: { smol: "managed-primary/smol-model", omem: "managed-primary/omem-model:low" },
			}),
			available,
		);
		expect(configured?.model.id).toBe("omem-model");
		expect(String(configured?.thinkingLevel)).toBe("low");
	});
});

describe("omem compactor visibility", () => {
	const sessions: AgentSession[] = [];
	afterEach(async () => {
		for (const session of sessions.splice(0)) await session.dispose();
		clearCustomApis();
	});

	it("reports a turn stalled on compaction once, and not when settle is fast", async () => {
		const slow = Promise.withResolvers<boolean>();
		const stalls: number[] = [];
		const omem = (settle: () => Promise<boolean>) =>
			({
				settle,
				viewBlocks: () => ["<chat>\n", "</chat>"],
				viewWholeBlocks: () => 0,
				append: () => [],
				pendingNodes: () => 3,
			}) as unknown as ConstructorParameters<typeof OmemMode>[0];
		const deps = { renderState: () => "", slowSettleMs: 10, onSlowSettle: (pending: number) => stalls.push(pending) };

		await new OmemMode(
			omem(async () => true),
			deps,
		).transform([{ role: "user", content: "a", timestamp: 1 }]);
		await Bun.sleep(30);
		expect(stalls).toEqual([]);

		const turn = new OmemMode(
			omem(() => slow.promise),
			deps,
		).transform([{ role: "user", content: "b", timestamp: 2 }]);
		await Bun.sleep(40);
		expect(stalls).toEqual([3]);
		slow.resolve(true);
		await turn;
		expect(stalls).toEqual([3]);
	});

	it("emits an omem warning notice when a compaction call fails", async () => {
		using tempDir = TempDir.createSync("@pi-omem-notice-");
		const api = "test-omem-notice";
		registerCustomApi(api, (_model, context) => {
			const stream = new AssistantMessageEventStream();
			queueMicrotask(() => {
				if (context.tools?.length) {
					const message = createAssistantMessage("ok");
					stream.push({ type: "done", reason: "stop", message });
					return;
				}
				// Compactor call: a non-retryable provider error.
				const error: AssistantMessage = {
					...createAssistantMessage(""),
					stopReason: "error",
					errorMessage: "400 invalid_request_error: bad thinking config",
					errorStatus: 400,
				};
				stream.push({ type: "error", reason: "error", error });
			});
			return stream;
		});
		const model = compactorModel(api, "omem-notice");
		const authStorage = await AuthStorage.create(tempDir.join("auth.db"));
		authStorage.keys.setRuntime(model.provider, "test-key");
		const { session } = await createAgentSession({
			cwd: tempDir.path(),
			agentDir: tempDir.path(),
			sessionManager: SessionManager.inMemory(tempDir.path()),
			authStorage,
			modelRegistry: new ModelRegistry(authStorage, tempDir.join("models.yml")),
			settings: Settings.isolated({ "omem.enabled": true, "omem.dir": tempDir.join("omem") }),
			model,
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			skipPythonPreflight: true,
		});
		sessions.push(session);
		try {
			const notice = Promise.withResolvers<{ level: string; message: string }>();
			session.subscribe(event => {
				if (event.type === "notice" && event.source === OMEM_NOTICE_SOURCE) notice.resolve(event);
			});
			// Past NODE_BYTES, so this message needs a compactor call.
			await session.sendUserMessage("x".repeat(2000));
			const seen = await Promise.race([notice.promise, Bun.sleep(3000).then(() => undefined)]);
			expect(seen?.level).toBe("warning");
			expect(seen?.message).toContain("managed-primary/omem-notice");
			expect(seen?.message).toContain("bad thinking config");
		} finally {
			authStorage.close();
		}
	});
});
