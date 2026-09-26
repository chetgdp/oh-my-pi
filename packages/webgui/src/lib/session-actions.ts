/**
 * Thin wrappers issuing RPC commands through a SessionCommandSink.
 *
 * Each function builds the exact RpcCommand shape and delegates to
 * sink.request(). No transport logic lives here.
 */

import type { RpcWebClient, RpcResponseFor } from "./rpc-client";
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import type { ImageContent } from "@oh-my-pi/pi-wire";
import type {
	RestoredQueuedMessage,
	RpcUsageReport,
	RpcResetAccount,
	ResetCreditTarget,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
export type { RestoredQueuedMessage, RpcUsageReport, RpcResetAccount, ResetCreditTarget };

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

export function abort(sink: SessionCommandSink, opts?: { clearQueue?: boolean }): Promise<RpcResponseFor<"abort">> {
	return sink.request(opts?.clearQueue ? { type: "abort", clearQueue: true } : { type: "abort" });
}

export interface ComposerDraft {
	text: string;
	images?: readonly string[];
}

/**
 * Restore cleared queued user messages back into the composer draft.
 * Queued text is joined ahead of the existing draft text with double newlines
 * (matching the TUI restore order), and cleared images are folded back in.
 */
export function restoreClearedMessagesToDraft(
	currentDraft: ComposerDraft,
	cleared: readonly RestoredQueuedMessage[],
): ComposerDraft {
	if (cleared.length === 0) return currentDraft;

	const queuedText = cleared
		.map(e => e.text)
		.filter(t => t.trim().length > 0)
		.join("\n\n");

	const currentText = currentDraft.text ?? "";
	const combinedText = [queuedText, currentText].filter(t => t.trim().length > 0).join("\n\n");

	const restoredImages: string[] = [];
	for (const msg of cleared) {
		if (msg.images) {
			for (const img of msg.images) {
				const mime = img.mimeType || "image/png";
				restoredImages.push(`data:${mime};base64,${img.data}`);
			}
		}
	}

	const currentImages = currentDraft.images ?? [];
	const combinedImages = [...restoredImages, ...currentImages];

	return {
		text: combinedText,
		images: combinedImages,
	};
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

export function getLoginStatus(sink: SessionCommandSink): Promise<RpcResponseFor<"get_login_status">> {
	return sink.request({ type: "get_login_status" });
}

export function loginStart(sink: SessionCommandSink, providerId: string): Promise<RpcResponseFor<"login_start">> {
	return sink.request({ type: "login_start", providerId });
}

export function loginInput(
	sink: SessionCommandSink,
	loginId: string,
	requestId: string,
	value: string,
): Promise<RpcResponseFor<"login_input">> {
	return sink.request({ type: "login_input", loginId, requestId, value });
}

export function loginCancel(sink: SessionCommandSink, loginId: string): Promise<RpcResponseFor<"login_cancel">> {
	return sink.request({ type: "login_cancel", loginId });
}

export function logout(
	sink: SessionCommandSink,
	providerId: string,
	credentialId: number,
): Promise<RpcResponseFor<"logout">> {
	return sink.request({ type: "logout", providerId, credentialId });
}

export function setSessionName(sink: SessionCommandSink, name: string): Promise<RpcResponseFor<"set_session_name">> {
	return sink.request({ type: "set_session_name", name });
}

export function branch(sink: SessionCommandSink, entryId: string): Promise<RpcResponseFor<"branch">> {
	return sink.request({ type: "branch", entryId });
}

export function compact(sink: SessionCommandSink, customInstructions?: string): Promise<RpcResponseFor<"compact">> {
	return sink.request(
		customInstructions !== undefined ? { type: "compact", customInstructions } : { type: "compact" },
	);
}

export function handoff(sink: SessionCommandSink, customInstructions?: string): Promise<RpcResponseFor<"handoff">> {
	return sink.request(
		customInstructions !== undefined ? { type: "handoff", customInstructions } : { type: "handoff" },
	);
}

export function newSession(sink: SessionCommandSink, parentSession?: string): Promise<RpcResponseFor<"new_session">> {
	return sink.request(parentSession !== undefined ? { type: "new_session", parentSession } : { type: "new_session" });
}

export function clearContext(sink: SessionCommandSink): Promise<RpcResponseFor<"prompt">> {
	return sink.request({ type: "prompt", message: "/clear" });
}

export function retry(sink: SessionCommandSink): Promise<RpcResponseFor<"prompt">> {
	return sink.request({ type: "prompt", message: "/retry" });
}

export function getUsageReports(
	sink: SessionCommandSink,
	refresh?: boolean,
): Promise<RpcResponseFor<"get_usage_reports">> {
	return sink.request(refresh !== undefined ? { type: "get_usage_reports", refresh } : { type: "get_usage_reports" });
}

export function getResetCredits(sink: SessionCommandSink): Promise<RpcResponseFor<"get_reset_credits">> {
	return sink.request({ type: "get_reset_credits" });
}

export function redeemResetCredit(
	sink: SessionCommandSink,
	target: ResetCreditTarget,
): Promise<RpcResponseFor<"redeem_reset_credit">> {
	return sink.request({ type: "redeem_reset_credit", target });
}
