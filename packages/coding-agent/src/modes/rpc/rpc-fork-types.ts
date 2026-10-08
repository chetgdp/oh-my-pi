/**
 * Fork-only RPC protocol: commands, params, results, frames and state fields the
 * fork server adds on top of upstream's v1/v2 protocol in `rpc-types.ts`.
 *
 * Kept separate so `rpc-types.ts` stays identical to upstream and matches the
 * generated wire spec checked by `test/rpc-wire/conformance.types.ts`. Server and
 * fork clients use the `RpcServer*` unions, which replace overridden upstream arms.
 */
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import type {
	AssistantMessage,
	ImageContent,
	ResetCreditTarget,
	UsageReport,
	UsageResetCreditDetail,
} from "@oh-my-pi/pi-ai";
import type { TodoItem, TodoStatus } from "@oh-my-pi/pi-tui/tools/todo";
import type { AgentRegistryFrame, AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { AgentSessionEvent } from "../../session/agent-session";
import type { RestoredQueuedMessage } from "../../session/agent-session-types";
import type {
	RpcAvailableCommandsUpdateFrame,
	RpcCommand,
	RpcPromptResultFrame,
	RpcReadyFrame,
	RpcResponse,
	RpcSessionEventFrame,
	RpcSessionSettledFrame,
	RpcSessionState,
	RpcSubagentMessagesResult,
	RpcSubagentSnapshot,
	RpcSubagentSubscriptionLevel,
} from "./rpc-types";
import type { RpcV3AgentEnd, RpcV3Event, RpcV3HistoryCommand, RpcV3HistoryResult, RpcV3TurnEnd } from "./rpc-v3-types";

export type { ResetCreditTarget, RestoredQueuedMessage, TodoItem, TodoStatus };
export * from "./rpc-v3-types";

// ============================================================================
// Commands
// ============================================================================

/** Upstream commands whose fork shape replaces upstream's arm in {@link RpcServerCommand}. */
export type RpcOverriddenCommandType =
	| "set_subagent_subscription"
	| "get_subagent_messages"
	| "set_model"
	| "set_thinking_level"
	| "export_html";

export type RpcForkCommand =
	| RpcV3HistoryCommand
	// Overrides of upstream commands (extra params)
	| {
			id?: string;
			type: "set_subagent_subscription";
			level: RpcSubagentSubscriptionLevel;
			ids?: string[];
			/** Strip `assistantMessageEvent.partial` from relayed `message_update` (duplicates `message`). */
			omitPartial?: boolean;
	  }
	| {
			id?: string;
			type: "get_subagent_messages";
			subagentId?: string;
			sessionFile?: string;
			fromByte?: number;
			fileId?: string;
			sentinel?: string;
	  }
	| {
			id?: string;
			type: "set_model";
			provider: string;
			modelId: string;
			persist?: boolean;
			thinkingLevel?: ThinkingLevel | "auto";
	  }
	| { id?: string; type: "set_thinking_level"; level: ThinkingLevel | "auto" }
	| { id?: string; type: "export_html"; outputPath?: string; agentId?: string }
	| { id?: string; type: "shutdown" }

	// Agent roster
	| { id?: string; type: "get_agent_roster" }
	| { id?: string; type: "set_agent_roster_subscription"; enabled: boolean }
	| { id?: string; type: "kill_agent"; agentId: string }
	| { id?: string; type: "revive_agent"; agentId: string }
	| {
			id?: string;
			type: "steer_agent";
			agentId: string;
			message: string;
			images?: ImageContent[];
			mode?: "steer" | "followUp";
	  }
	| { id?: string; type: "interrupt_agent"; agentId: string }

	// Plan mode
	| { id?: string; type: "get_plan_state" }
	| { id?: string; type: "set_plan_mode"; enabled: boolean }
	| {
			id?: string;
			type: "approve_plan";
			reviewId: string;
			action: RpcPlanReviewAction;
			feedback?: string;
	  }

	// Model roles and agents
	| { id?: string; type: "get_model_roles" }
	| {
			id?: string;
			type: "set_model_role";
			role: string;
			selector: string | null;
			persist?: boolean;
			storage?: "global" | "project";
	  }
	| { id?: string; type: "delete_model_role"; role: string }
	| { id?: string; type: "set_cycle_order"; order: string[] }
	| { id?: string; type: "set_model_tag"; model: string; tag: string | null }
	| { id?: string; type: "get_model_browser" }
	| { id?: string; type: "refresh_models"; provider?: string }
	| {
			id?: string;
			type: "cycle_role_model";
			direction?: "forward" | "backward";
	  }
	| { id?: string; type: "get_agents" }
	| {
			id?: string;
			type: "set_agent_model";
			agent: string;
			selector: string | null;
	  }
	| { id?: string; type: "set_agent_enabled"; agent: string; enabled: boolean }
	| {
			id?: string;
			type: "set_agent_service_tier";
			agent: string;
			tier: string | null;
	  }
	| {
			id?: string;
			type: "set_agent_prewalk";
			agent: string;
			value: string | null;
	  }
	| {
			id?: string;
			type: "set_agent_advisor";
			agent: string;
			value: string | null;
	  }

	// Login (webgui contract O; runs off the serial queue, see rpc-login.ts)
	| { id?: string; type: "get_login_status" }
	| { id?: string; type: "login_start"; providerId: string }
	| {
			id?: string;
			type: "login_input";
			loginId: string;
			requestId: string;
			value: string;
	  }
	| { id?: string; type: "login_cancel"; loginId: string }
	// Usage
	| {
			id?: string;
			type: "get_usage_reports";
			/** When true, invalidates cached usage reports before fetching if UsageService supports bypassing cache; otherwise ignored. */
			refresh?: boolean;
	  }
	| { id?: string; type: "get_reset_credits" }
	| { id?: string; type: "redeem_reset_credit"; target: ResetCreditTarget };

/** Every command the fork server accepts. */
export type RpcServerCommand = Exclude<RpcCommand, { type: RpcOverriddenCommandType }> | RpcForkCommand;

// ============================================================================
// State
// ============================================================================

export interface RpcServerSessionState extends RpcSessionState {
	/** Why the active model is what it is. Absent when no model-change entry exists. */
	modelSource?: RpcModelSource;
}

export interface RpcServerSubagentSnapshot extends RpcSubagentSnapshot {
	detached?: boolean;
}

export interface RpcServerSubagentMessagesResult extends RpcSubagentMessagesResult {
	/** `${ino}:${birthtimeMs}` of the transcript file; changes when the file is replaced. */
	fileId: string;
	/** Base64 of up to 64 bytes ending at `nextByte`; "" when `nextByte` is 0. */
	sentinel: string;
}

/** Fork advertises protocol v3 in addition to upstream's versions. */
export interface RpcServerReadyFrame extends Omit<RpcReadyFrame, "supportedProtocolVersions"> {
	supportedProtocolVersions: number[];
}

export interface RpcModelSource {
	/** `role`: set via a role (role id in `role`; "default" = the default role). `temporary`/`ephemeral`: /switch-style session-scoped change. `fallback`: retry fallback chain is serving `fallbackFrom`'s request. */
	kind: "role" | "temporary" | "ephemeral" | "fallback";
	role?: string;
	/** provider/id of the model the fallback replaced. */
	fallbackFrom?: string;
}

/** Concrete model a role or agent resolves to right now. */
export interface RpcResolvedModel {
	provider: string;
	id: string;
	name: string;
	thinkingLevel?: ThinkingLevel;
}

export interface RpcModelRole {
	id: string;
	/** Human label from MODEL_ROLES (e.g. "Fast" for smol); custom roles use the id. */
	name: string;
	section: "chat" | "kind";
	/** Configured selector string as stored in settings (may carry `:level`). */
	configured?: string;
	/** Where the effective value comes from. `fallback` = inherited from `fallbackFrom`; `active` = default role tracking the session model. */
	source: "global" | "project" | "fallback" | "active" | "unset";
	/** Settings layer owning the effective value. */
	provenance: "env" | "runtime" | "overlay" | "project" | "global" | "default";
	fallbackFrom?: string;
	resolved?: RpcResolvedModel;
	/** Auto-selection result when the role has no configured value. */
	autoSelected?: RpcResolvedModel;
	/** modelTags entry for the resolved model, if any. */
	tag?: string;
	/** True for roles not in MODEL_ROLES (deletable). */
	custom: boolean;
	warning?: string;
	/** provider/id keys of models eligible for this role. */
	eligible: string[];
}

export interface RpcModelRolesResult {
	storage: "global" | "project";
	roles: RpcModelRole[];
	cycleOrder: string[];
	/** provider/id -> tag */
	modelTags: Record<string, string>;
}

export interface RpcRoleCycleResult {
	role: string;
	model: RpcResolvedModel;
	/** Roles in cycle order with the active index. */
	cycle: { roles: string[]; currentIndex: number };
}

export interface RpcModelPerf {
	samples: number;
	tps: number;
	ttftMs: number | null;
}

export interface RpcBrowserModel {
	provider: string;
	id: string;
	name: string;
	/** `provider/id` */
	selector: string;
	kind: string;
	/** Provider has no credentials; model cannot be selected. */
	locked: boolean;
	perf?: RpcModelPerf;
	/** Roles resolving to this model; `auto` = not configured, chosen by auto-selection. */
	roles: Array<{ role: string; auto: boolean }>;
	tag?: string;
	contextWindow?: number;
}

export interface RpcProviderStatus {
	id: string;
	authenticated: boolean;
	discoverable: boolean;
	discovery?: {
		optional: boolean;
		status: "idle" | "ok" | "empty" | "cached" | "unavailable" | "unauthenticated";
		fetchedAt?: number;
		error?: string;
	};
	modelCount: number;
}

export interface RpcModelBrowserResult {
	models: RpcBrowserModel[];
	/** Recently used selectors, most recent first. */
	mruOrder: string[];
	providers: RpcProviderStatus[];
	kinds: string[];
}

export interface RpcAgentInfo {
	name: string;
	description: string;
	source: string;
	/** Selectors declared in agent frontmatter, in priority order. */
	declaredModel?: string[];
	declaredThinkingLevel?: string;
	/** Value in settings.task.agentModelOverrides, if any. */
	override?: string;
	/** Effective selector patterns after override/declared/parent-fallback precedence. */
	patterns: string[];
	role?: string;
	resolved?: RpcResolvedModel;
	disabled: boolean;
	serviceTier?: string;
	prewalk: {
		effective?: string;
		source: "override" | "frontmatter" | "default" | "none";
	};
	advisor: { effective?: string; source: "override" | "frontmatter" | "none" };
	isDefaultTaskAgent: boolean;
	/** Full model precedence chain; `winner` indexes `entries`. */
	precedence: {
		entries: Array<{
			source: "override" | "frontmatter" | "parentActive" | "parentFallback" | "defaultRole";
			selector: string;
		}>;
		winner: number;
	};
}

export interface RpcAgentsResult {
	defaultAgent: string;
	agents: RpcAgentInfo[];
}

export interface RpcCommandOutputFrame {
	type: "command_output";
	text: string;
}

export interface RpcSessionInfoUpdateFrame {
	type: "session_info_update";
	title: string;
	sessionId: string;
}

export type RpcPlanReviewAction = "execute" | "compact" | "refine";

export interface RpcPlanState {
	/** Mirrors the `plan.enabled` setting; false means set_plan_mode {enabled:true} is refused. */
	available: boolean;
	enabled: boolean;
	paused: boolean;
	planFilePath?: string;
}

export interface RpcPlanReview {
	reviewId: string;
	title: string;
	planFilePath: string;
	markdown: string;
}

/** Pushed on every plan-mode change, whoever made it (TUI, RPC, agent). */
export interface RpcPlanStateFrame {
	type: "plan_state";
	state: RpcPlanState;
}

/** Pushed when a plan awaits approval, and again on attach while pending. `review: null` means it was resolved or dropped. */
export interface RpcPlanReviewFrame {
	type: "plan_review";
	review: RpcPlanReview | null;
}

export interface RpcConfigUpdateFrame {
	type: "config_update";
	model?: unknown;
	thinkingLevel?: unknown;
	/** Set when model roles or agent overrides changed; clients refetch get_model_roles / get_agents. */
	modelRoles?: true;
	agents?: true;
	/** Model catalog changed (refresh_models). Clients refetch get_model_browser and get_available_models. */
	models?: true;
}

/** One OAuth-capable provider and the credentials currently stored for it (contract O). */
export interface RpcLoginProviderStatus {
	id: string;
	name: string;
	available: boolean;
	/** Provider id credentials are stored under when it differs from `id`. */
	storeCredentialsAs?: string;
	/** Whether any credential source (stored, env, broker) currently authenticates the provider. */
	authenticated: boolean;
	/** Human description of the active credential source, when authenticated. */
	source?: string;
	/** Stored credentials that `logout` can remove. */
	accounts: Array<{ credentialId: number; label: string }>;
}

export interface RpcLoginStatusResult {
	providers: RpcLoginProviderStatus[];
}

/** Progress of one `login_start` flow (contract O). */
export type RpcLoginEvent =
	| { kind: "auth"; url: string; instructions?: string }
	| { kind: "progress"; message: string }
	| {
			kind: "prompt";
			requestId: string;
			message: string;
			placeholder?: string;
			secret?: boolean;
			allowEmpty?: boolean;
	  }
	/** The flow accepts the pasted redirect URL or authorization code. */
	| { kind: "manual_input"; requestId: string }
	| { kind: "done"; providerId: string; identity?: string }
	| { kind: "failed"; error: string; cancelled: boolean };

export interface RpcLoginEventFrame {
	type: "login_event";
	loginId: string;
	providerId: string;
	event: RpcLoginEvent;
}
/**
 * In-flight state of one live subagent session, replayed so a late-attaching client
 * sees the partial assistant message and running tool output it missed.
 */
export interface RpcSubagentInflightSnapshot {
	/** Partial assistant message being streamed, or null between messages. */
	streamMessage: AssistantMessage | null;
	/** Latest cached `tool_execution_start` per running tool call. */
	activeToolStarts?: Extract<AgentSessionEvent, { type: "tool_execution_start" }>[];
	/** Latest cached `tool_execution_update` per running tool call (tools that never emitted an update are absent). */
	activeToolUpdates: Extract<AgentSessionEvent, { type: "tool_execution_update" }>[];
}

export interface RpcSubagentSubscriptionResult {
	level: RpcSubagentSubscriptionLevel;
	/**
	 * Only with level `events` and `ids`: in-flight state keyed by agent id, for listed agents with a live
	 * session (parked, aborted, and unknown agents are omitted). Absent when `ids` is omitted.
	 */
	snapshots?: Record<string, RpcSubagentInflightSnapshot>;
}

/**
 * Sanitized usage report for RPC / webgui consumers.
 *
 * Provider-specific HTTP payloads (`raw`) are stripped before transmission.
 * `active` is computed server-side from the session's active OAuth identity.
 */
export type RpcUsageReport = Omit<UsageReport, "raw"> & { active: boolean };

/**
 * Account row with its redeemable rate-limit reset credits for RPC / webgui.
 * Matches the selector row shape produced by `toResetUsageAccounts`.
 */
export interface RpcResetAccount {
	label: string;
	provider: string;
	providerLabel: string;
	availableCount: number;
	redeemableCount: number;
	target: ResetCreditTarget;
	active: boolean;
	error?: string;
	unavailableReason?: string;
	expiresAt?: string;
	credit?: UsageResetCreditDetail;
}

export interface RpcRedeemResetCreditResult {
	ok: boolean;
	code: string;
	message: string;
	cleared?: string[];
}

// ============================================================================
// Responses
// ============================================================================

/** Upstream responses whose fork shape replaces upstream's arm in {@link RpcServerResponse}. */
export type RpcOverriddenResponseCommand =
	| "negotiate_protocol"
	| "get_state"
	| "set_subagent_subscription"
	| "get_subagents"
	| "get_subagent_messages";

export type RpcForkResponse =
	// Overrides of upstream responses
	| {
			id?: string;
			type: "response";
			command: "negotiate_protocol";
			success: true;
			data: { protocolVersion: 1 | 2 | 3 };
	  }
	| {
			id?: string;
			type: "response";
			command: "get_state";
			success: true;
			data: RpcServerSessionState;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_subagent_subscription";
			success: true;
			data: RpcSubagentSubscriptionResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "get_subagents";
			success: true;
			data: { subagents: RpcServerSubagentSnapshot[] };
	  }
	| {
			id?: string;
			type: "response";
			command: "get_subagent_messages";
			success: true;
			data: RpcServerSubagentMessagesResult;
	  }
	| { id?: string; type: "response"; command: "shutdown"; success: true }
	| {
			id?: string;
			type: "response";
			command: "history";
			success: true;
			data: RpcV3HistoryResult;
	  }

	// Plan mode
	| {
			id?: string;
			type: "response";
			command: "get_plan_state";
			success: true;
			data: { state: RpcPlanState; review: RpcPlanReview | null };
	  }
	| {
			id?: string;
			type: "response";
			command: "set_plan_mode";
			success: true;
			data: { state: RpcPlanState };
	  }
	| {
			id?: string;
			type: "response";
			command: "approve_plan";
			success: true;
			data: { state: RpcPlanState };
	  }

	// Agent roster
	| {
			id?: string;
			type: "response";
			command: "get_agent_roster";
			success: true;
			data: { agents: AgentRosterEntry[] };
	  }
	| {
			id?: string;
			type: "response";
			command: "set_agent_roster_subscription";
			success: true;
			data: { enabled: boolean };
	  }
	| {
			id?: string;
			type: "response";
			command: "kill_agent";
			success: true;
			data: { agentId: string };
	  }
	| {
			id?: string;
			type: "response";
			command: "revive_agent";
			success: true;
			data: { agentId: string };
	  }
	| {
			id?: string;
			type: "response";
			command: "steer_agent";
			success: true;
			data: { agentId: string };
	  }
	| {
			id?: string;
			type: "response";
			command: "interrupt_agent";
			success: true;
			data: { agentId: string };
	  }

	// Model roles and agents
	| {
			id?: string;
			type: "response";
			command: "get_model_roles";
			success: true;
			data: RpcModelRolesResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_model_role";
			success: true;
			data: RpcModelRole;
	  }
	| {
			id?: string;
			type: "response";
			command: "delete_model_role";
			success: true;
			data: RpcModelRolesResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_cycle_order";
			success: true;
			data: RpcModelRolesResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_model_tag";
			success: true;
			data: RpcModelRolesResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "get_model_browser";
			success: true;
			data: RpcModelBrowserResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "refresh_models";
			success: true;
			data: RpcModelBrowserResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "cycle_role_model";
			success: true;
			data: RpcRoleCycleResult | null;
	  }
	| {
			id?: string;
			type: "response";
			command: "get_agents";
			success: true;
			data: RpcAgentsResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_agent_model";
			success: true;
			data: RpcAgentInfo;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_agent_enabled";
			success: true;
			data: RpcAgentInfo;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_agent_service_tier";
			success: true;
			data: RpcAgentInfo;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_agent_prewalk";
			success: true;
			data: RpcAgentInfo;
	  }
	| {
			id?: string;
			type: "response";
			command: "set_agent_advisor";
			success: true;
			data: RpcAgentInfo;
	  }

	// Login
	| {
			id?: string;
			type: "response";
			command: "get_login_status";
			success: true;
			data: RpcLoginStatusResult;
	  }
	| {
			id?: string;
			type: "response";
			command: "login_start";
			success: true;
			data: { loginId: string };
	  }
	| {
			id?: string;
			type: "response";
			command: "login_input";
			success: true;
			data: Record<string, never>;
	  }
	| {
			id?: string;
			type: "response";
			command: "login_cancel";
			success: true;
			data: Record<string, never>;
	  }
	// Usage
	| {
			id?: string;
			type: "response";
			command: "get_usage_reports";
			success: true;
			data: { reports: RpcUsageReport[] };
	  }
	| {
			id?: string;
			type: "response";
			command: "get_reset_credits";
			success: true;
			data: { accounts: RpcResetAccount[] };
	  }
	| {
			id?: string;
			type: "response";
			command: "redeem_reset_credit";
			success: true;
			data: RpcRedeemResetCreditResult;
	  };

/** Every response the fork server emits. */
export type RpcServerResponse = Exclude<RpcResponse, { command: RpcOverriddenResponseCommand }> | RpcForkResponse;

// ============================================================================
// Push frames
// ============================================================================

/** Every session/push frame the fork server emits. */
export type RpcServerSessionEventFrame =
	| RpcSessionEventFrame
	| AgentRegistryFrame
	| RpcSessionSettledFrame
	| RpcPromptResultFrame
	| RpcAvailableCommandsUpdateFrame
	| RpcSessionInfoUpdateFrame
	| RpcConfigUpdateFrame
	| RpcCommandOutputFrame
	| RpcPlanStateFrame
	| RpcPlanReviewFrame
	| RpcLoginEventFrame
	| RpcV3Event
	| RpcV3AgentEnd
	| RpcV3TurnEnd;
