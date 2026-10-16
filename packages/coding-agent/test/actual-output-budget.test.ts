/**
 * Actual answers an output budget that does not fit beside the prompt with a
 * 422 `invalid_max_tokens` naming the real window. The settings-aware stream
 * learns that window and replays once inside it, so the session never sees
 * the error; a prompt that itself overflows stays a ContextOverflow.
 */
import { afterAll, describe, expect, test } from "bun:test";
import * as AIError from "@oh-my-pi/pi-ai/error";
import type { AssistantMessageEvent, Context, Model } from "@oh-my-pi/pi-ai";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import type { ModelSpec } from "@oh-my-pi/pi-catalog/types";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { parseActualOutputBudgetRejection } from "@oh-my-pi/pi-coding-agent/session/actual-output-budget";
import { createSettingsAwareStreamFn } from "@oh-my-pi/pi-coding-agent/session/settings-stream-fn";

function rejection(window: number, requested: number, prompt: number): Response {
	return Response.json(
		{
			error: {
				message: `This model's maximum context length is ${window} tokens. However, you requested ${requested} max_tokens alongside a ${prompt}-token prompt, which leaves only ${window - prompt} tokens for generation.`,
				type: "invalid_request_error",
				param: "max_tokens",
				code: "invalid_max_tokens",
			},
		},
		{ status: 422 },
	);
}

function completion(): Response {
	const base = { id: "chatcmpl-actual", object: "chat.completion.chunk", created: 0, model: "mdl_test" };
	const chunks = [
		{ ...base, choices: [{ index: 0, delta: { role: "assistant", content: "391" }, finish_reason: null }] },
		{ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
		{ ...base, choices: [], usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 } },
	];
	return new Response(`${chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`, {
		headers: { "content-type": "text/event-stream" },
	});
}

const requests: Array<{ maxTokens: unknown }> = [];
let respond: (index: number) => Response = () => completion();

const server = Bun.serve({
	port: 0,
	hostname: "127.0.0.1",
	async fetch(request) {
		const body = (await request.json()) as Record<string, unknown>;
		requests.push({ maxTokens: body.max_tokens ?? body.max_completion_tokens });
		return respond(requests.length - 1);
	},
});

afterAll(() => server.stop(true));

function actualModel(provider: string): Model {
	return buildModel({
		id: "mdl_test",
		name: "Test",
		api: "openai-completions",
		provider,
		baseUrl: `http://127.0.0.1:${server.port}/v1`,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 32_768,
	} as ModelSpec<"openai-completions">) as Model;
}

const context: Context = {
	systemPrompt: [],
	messages: [{ role: "user", content: "What is 17*23?", timestamp: 0 }],
} as unknown as Context;

async function drain(provider: string, onLearned?: (model: Model, window: number) => void) {
	requests.length = 0;
	const stream = createSettingsAwareStreamFn(
		Settings.isolated({}),
		undefined,
		undefined,
		onLearned,
	)(actualModel(provider), context, { apiKey: "ac_live", maxRetryDelayMs: 0 });
	const events: AssistantMessageEvent[] = [];
	for await (const event of await stream) events.push(event);
	return { events, result: await (await stream).result() };
}

describe("Actual invalid_max_tokens", () => {
	test("parses the window and the server-counted prompt", () => {
		expect(
			parseActualOutputBudgetRejection(
				"422 This model's maximum context length is 32768 tokens. However, you requested 32768 max_tokens alongside a 17607-token prompt, which leaves only 15161 tokens for generation.",
			),
		).toEqual({ contextWindow: 32_768, promptTokens: 17_607 });
		expect(parseActualOutputBudgetRejection("maximum context length is 32768 tokens")).toBeUndefined();
	});

	for (const provider of ["actual-relay", "actual-local"]) {
		test(`${provider}: learns the window and retries once with a clamped max_tokens, no error surfaces`, async () => {
			respond = index => (index === 0 ? rejection(32_768, 32_768, 17_607) : completion());
			const learned: Array<[string, number]> = [];
			const { events, result } = await drain(provider, (model, window) => learned.push([model.id, window]));
			expect(requests).toHaveLength(2);
			expect(requests[0].maxTokens).toBe(32_768);
			expect(requests[1].maxTokens).toBeLessThanOrEqual(32_768 - 17_607);
			expect(learned).toEqual([["mdl_test", 32_768]]);
			expect(events.some(event => event.type === "error")).toBe(false);
			expect(result.stopReason).toBe("stop");
		});
	}

	test("a prompt that itself overflows the window is not retried and stays a ContextOverflow", async () => {
		respond = () => rejection(32_768, 32_768, 40_000);
		const learned: number[] = [];
		const { result } = await drain("actual-relay", (_model, window) => learned.push(window));
		expect(requests).toHaveLength(1);
		expect(learned).toEqual([]);
		expect(result.stopReason).toBe("error");
		expect(AIError.isContextOverflow(result, 128_000)).toBe(true);
	});

	test("other providers keep today's behavior", async () => {
		respond = () => rejection(32_768, 32_768, 17_607);
		const { result } = await drain("llama.cpp");
		expect(requests).toHaveLength(1);
		expect(result.stopReason).toBe("error");
	});
});
