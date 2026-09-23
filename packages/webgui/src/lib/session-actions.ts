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
	opts?: { persist?: boolean; thinkingLevel?: ThinkingLevel | "auto" },
): Promise<RpcResponseFor<"set_model">> {
	return sink.request({ type: "set_model", provider, modelId, ...opts });
}

export type { ThinkingLevel };
export type ConfiguredThinkingLevel = ThinkingLevel | "auto";

export function setThinkingLevel(
	sink: SessionCommandSink,
	level: ThinkingLevel | "auto",
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
	opts?: { persist?: boolean; storage?: "global" | "project" },
): Promise<RpcResponseFor<"set_model_role">> {
	return sink.request({ type: "set_model_role", role, selector, ...opts });
}

export function deleteModelRole(sink: SessionCommandSink, role: string): Promise<RpcResponseFor<"delete_model_role">> {
	return sink.request({ type: "delete_model_role", role });
}

export function setCycleOrder(sink: SessionCommandSink, order: string[]): Promise<RpcResponseFor<"set_cycle_order">> {
	return sink.request({ type: "set_cycle_order", order });
}

export function setModelTag(
	sink: SessionCommandSink,
	model: string,
	tag: string | null,
): Promise<RpcResponseFor<"set_model_tag">> {
	return sink.request({ type: "set_model_tag", model, tag });
}

export function getModelBrowser(sink: SessionCommandSink): Promise<RpcResponseFor<"get_model_browser">> {
	return sink.request({ type: "get_model_browser" });
}

export function refreshModels(sink: SessionCommandSink, provider?: string): Promise<RpcResponseFor<"refresh_models">> {
	return sink.request(provider !== undefined ? { type: "refresh_models", provider } : { type: "refresh_models" });
}

export function cycleRoleModel(
	sink: SessionCommandSink,
	direction?: "forward" | "backward",
): Promise<RpcResponseFor<"cycle_role_model">> {
	return sink.request(
		direction !== undefined ? { type: "cycle_role_model", direction } : { type: "cycle_role_model" },
	);
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

export function setAgentEnabled(
	sink: SessionCommandSink,
	agent: string,
	enabled: boolean,
): Promise<RpcResponseFor<"set_agent_enabled">> {
	return sink.request({ type: "set_agent_enabled", agent, enabled });
}

export function setAgentServiceTier(
	sink: SessionCommandSink,
	agent: string,
	tier: string | null,
): Promise<RpcResponseFor<"set_agent_service_tier">> {
	return sink.request({ type: "set_agent_service_tier", agent, tier });
}

export function setAgentPrewalk(
	sink: SessionCommandSink,
	agent: string,
	value: string | null,
): Promise<RpcResponseFor<"set_agent_prewalk">> {
	return sink.request({ type: "set_agent_prewalk", agent, value });
}

export function setAgentAdvisor(
	sink: SessionCommandSink,
	agent: string,
	value: string | null,
): Promise<RpcResponseFor<"set_agent_advisor">> {
	return sink.request({ type: "set_agent_advisor", agent, value });
}
