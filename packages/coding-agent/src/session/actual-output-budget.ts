/**
 * Actual's runners reject an output budget that does not fit next to the
 * prompt with a 422 `invalid_max_tokens` that names the real window. The relay
 * publishes no window and unloaded local rows have none, so the rejection is
 * often the first place omp learns it. The retry runs before any content
 * reaches the consumer, so the session never sees the error and never compacts
 * a prompt that already fits.
 */
import { OUTPUT_FIT_HEADWAY_TOKENS } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessageEventStream, Model } from "@oh-my-pi/pi-ai";
import { AssistantMessageEventStream as EventStream } from "@oh-my-pi/pi-ai/utils/event-stream";
import { logger } from "@oh-my-pi/pi-utils";

const ACTUAL_PROVIDERS: Record<string, true> = { "actual-local": true, "actual-relay": true };

export function isActualProvider(provider: string): boolean {
	return ACTUAL_PROVIDERS[provider] === true;
}

export interface ActualOutputBudgetRejection {
	contextWindow: number;
	promptTokens: number;
}

const CONTEXT_WINDOW_PATTERN = /maximum context length is (\d+) tokens/i;
const PROMPT_TOKENS_PATTERN = /alongside an? (\d+)-token prompt/i;

/**
 * The window and server-counted prompt from an `invalid_max_tokens` message,
 * or undefined when either number is missing: without the prompt size a real
 * prompt overflow cannot be told apart.
 */
export function parseActualOutputBudgetRejection(message: string | undefined): ActualOutputBudgetRejection | undefined {
	if (!message || !/max_tokens/i.test(message)) return undefined;
	const window = CONTEXT_WINDOW_PATTERN.exec(message)?.[1];
	const prompt = PROMPT_TOKENS_PATTERN.exec(message)?.[1];
	if (!window || !prompt) return undefined;
	const contextWindow = Number(window);
	const promptTokens = Number(prompt);
	if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0 || !Number.isSafeInteger(promptTokens)) {
		return undefined;
	}
	return { contextWindow, promptTokens };
}

/** Output cap that fits the server-counted prompt inside the learned window. */
export function actualRetryMaxTokens(rejection: ActualOutputBudgetRejection, fitted: number | undefined): number {
	const room = Math.max(1, rejection.contextWindow - rejection.promptTokens - OUTPUT_FIT_HEADWAY_TOKENS);
	return fitted === undefined ? room : Math.min(fitted, room);
}

/**
 * Drain `first`; when it fails with a fitting-prompt output-budget rejection
 * before any content, report the window and replay once via `retry`.
 */
export function withActualOutputBudgetRetry(
	model: Model,
	first: () => AssistantMessageEventStream | Promise<AssistantMessageEventStream>,
	retry: (
		rejection: ActualOutputBudgetRejection,
	) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>,
): AssistantMessageEventStream {
	const outer = new EventStream();
	let sawStart = false;
	const pump = async (inner: AssistantMessageEventStream, allowRetry: boolean) => {
		let sawContent = false;
		for await (const event of inner) {
			if (event.type === "start") {
				if (!sawStart) {
					sawStart = true;
					outer.push(event);
				}
				continue;
			}
			if (allowRetry && event.type === "error" && !sawContent && event.error.stopReason === "error") {
				const rejection = parseActualOutputBudgetRejection(event.error.errorMessage);
				if (rejection && rejection.promptTokens < rejection.contextWindow) return rejection;
			}
			if (event.type !== "error" && event.type !== "done") sawContent = true;
			outer.push(event);
		}
		return undefined;
	};
	const run = async () => {
		const rejection = await pump(await first(), true);
		if (!rejection) return;
		logger.warn("actual: output budget rejected; retrying inside the reported window", {
			provider: model.provider,
			model: model.id,
			contextWindow: rejection.contextWindow,
			promptTokens: rejection.promptTokens,
		});
		await pump(await retry(rejection), false);
	};
	void run().catch(error => {
		if (!outer.done) outer.fail(error);
	});
	return outer;
}
