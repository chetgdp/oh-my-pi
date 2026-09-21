/**
 * Thin wrappers issuing RPC commands through a SessionCommandSink.
 *
 * Each function builds the exact RpcCommand shape and delegates to
 * sink.request(). No transport logic lives here.
 */

import type { RpcWebClient } from "./rpc-client";
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";

export interface SessionCommandSink {
	request: RpcWebClient["request"];
}

export function sendPrompt(
	sink: SessionCommandSink,
	text: string,
	opts?: { streamingBehavior?: "steer" | "followUp" },
): Promise<unknown> {
	return sink.request({
		type: "prompt",
		message: text,
		...(opts?.streamingBehavior ? { streamingBehavior: opts.streamingBehavior } : undefined),
	});
}

export function steer(sink: SessionCommandSink, text: string): Promise<unknown> {
	return sink.request({ type: "steer", message: text });
}

export function followUp(sink: SessionCommandSink, text: string): Promise<unknown> {
	return sink.request({ type: "follow_up", message: text });
}

export function abort(sink: SessionCommandSink): Promise<unknown> {
	return sink.request({ type: "abort" });
}

export function getAvailableModels(sink: SessionCommandSink): Promise<unknown> {
	return sink.request({ type: "get_available_models" });
}

export function setModel(sink: SessionCommandSink, provider: string, modelId: string): Promise<unknown> {
	return sink.request({
		type: "set_model",
		provider,
		modelId,
	});
}
export type { ThinkingLevel };

export function setThinkingLevel(sink: SessionCommandSink, level: ThinkingLevel): Promise<unknown> {
	return sink.request({ type: "set_thinking_level", level });
}
