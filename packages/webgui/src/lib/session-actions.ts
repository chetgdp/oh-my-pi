/**
 * Thin wrappers issuing RPC commands through a SessionCommandSink.
 *
 * Each function builds the exact RpcCommand shape and delegates to
 * sink.request(). No transport logic lives here.
 */

import type { RpcWebClient, RpcResponseFor } from "./rpc-client";
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import type { ImageContent } from "@oh-my-pi/pi-wire";

export interface SessionCommandSink {
	request: RpcWebClient["request"];
}

/** Composer emits data URLs; the RPC wants split base64 + mime type. */
export function dataUrlToImage(url: string): ImageContent | null {
	const m = /^data:([^;,]+);base64,(.+)$/.exec(url);
	return m ? { type: "image", data: m[2], mimeType: m[1] } : null;
}

function toImages(urls?: readonly string[]): ImageContent[] | undefined {
	if (!urls || urls.length === 0) return undefined;
	const out: ImageContent[] = [];
	for (const u of urls) {
		const img = dataUrlToImage(u);
		if (img) out.push(img);
	}
	return out.length > 0 ? out : undefined;
}

export function sendPrompt(
	sink: SessionCommandSink,
	text: string,
	opts?: { streamingBehavior?: "steer" | "followUp"; images?: readonly string[] },
): Promise<RpcResponseFor<"prompt">> {
	return sink.request({
		type: "prompt",
		message: text,
		...(opts?.streamingBehavior ? { streamingBehavior: opts.streamingBehavior } : undefined),
		...(toImages(opts?.images) ? { images: toImages(opts?.images) } : undefined),
	});
}

export function steer(
	sink: SessionCommandSink,
	text: string,
	images?: readonly string[],
): Promise<RpcResponseFor<"steer">> {
	const imgs = toImages(images);
	return sink.request({ type: "steer", message: text, ...(imgs ? { images: imgs } : undefined) });
}

export function followUp(
	sink: SessionCommandSink,
	text: string,
	images?: readonly string[],
): Promise<RpcResponseFor<"follow_up">> {
	const imgs = toImages(images);
	return sink.request({ type: "follow_up", message: text, ...(imgs ? { images: imgs } : undefined) });
}

export function abort(sink: SessionCommandSink): Promise<RpcResponseFor<"abort">> {
	return sink.request({ type: "abort" });
}

export function getAvailableModels(sink: SessionCommandSink): Promise<RpcResponseFor<"get_available_models">> {
	return sink.request({ type: "get_available_models" });
}

export function setModel(
	sink: SessionCommandSink,
	provider: string,
	modelId: string,
	opts?: { persist?: boolean; thinkingLevel?: ThinkingLevel },
): Promise<RpcResponseFor<"set_model">> {
	return sink.request({ type: "set_model", provider, modelId, ...opts });
}

export type { ThinkingLevel };

export function setThinkingLevel(
	sink: SessionCommandSink,
	level: ThinkingLevel,
): Promise<RpcResponseFor<"set_thinking_level">> {
	return sink.request({ type: "set_thinking_level", level });
}

export function getSessionStats(sink: SessionCommandSink): Promise<RpcResponseFor<"get_session_stats">> {
	return sink.request({ type: "get_session_stats" });
}

export function getAvailableCommands(sink: SessionCommandSink): Promise<RpcResponseFor<"get_available_commands">> {
	return sink.request({ type: "get_available_commands" });
}

export function getMessagesPage(
	sink: SessionCommandSink,
	cursor?: string,
	limit?: number,
): Promise<RpcResponseFor<"get_messages_page">> {
	return sink.request({
		type: "get_messages_page",
		...(cursor !== undefined ? { cursor } : undefined),
		...(limit !== undefined ? { limit } : undefined),
	});
}

export function getSubagents(sink: SessionCommandSink): Promise<RpcResponseFor<"get_subagents">> {
	return sink.request({ type: "get_subagents" });
}

export function getModelRoles(sink: SessionCommandSink): Promise<RpcResponseFor<"get_model_roles">> {
	return sink.request({ type: "get_model_roles" });
}

export function setModelRole(
	sink: SessionCommandSink,
	role: string,
	selector: string | null,
): Promise<RpcResponseFor<"set_model_role">> {
	return sink.request({ type: "set_model_role", role, selector });
}

export function getAgents(sink: SessionCommandSink): Promise<RpcResponseFor<"get_agents">> {
	return sink.request({ type: "get_agents" });
}

export function setAgentModel(
	sink: SessionCommandSink,
	agent: string,
	selector: string | null,
): Promise<RpcResponseFor<"set_agent_model">> {
	return sink.request({ type: "set_agent_model", agent, selector });
}
