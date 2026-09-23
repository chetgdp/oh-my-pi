/**
 * Props contracts shared by the Models hub sections and the picker sheet.
 *
 * The hub hook (useModelsHub) owns state and RPC calls; sections are
 * presentational and report intent through these callbacks.
 */

import type { ConfiguredThinkingLevel } from "../../lib/session-actions";
import type { LoginPendingState, LoginResultState } from "../../lib/session-store";
import type {
	RpcAgentInfo,
	RpcAgentsResult,
	RpcModelBrowserResult,
	RpcModelRole,
	RpcModelRolesResult,
	RpcSessionState,
	RpcLoginStatusResult,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export type RoleStorage = "global" | "project";

/** Picker confirm payload. `persist:false` = this session only. `storage` only for role/default writes. */
export interface PickerSelection {
	provider: string;
	id: string;
	thinkingLevel?: ConfiguredThinkingLevel;
	persist: boolean;
	storage?: RoleStorage;
}

export type PickerMode =
	| { kind: "active" }
	/** `storage` is the session's `modelRoleStorage`; the scope toggle shows only when it is "project". */
	| { kind: "role"; role: RpcModelRole; storage: RoleStorage }
	| { kind: "agent"; agent: RpcAgentInfo };

export interface ModelPickerSheetProps {
	open: boolean;
	title: string;
	browser: RpcModelBrowserResult | null;
	/** provider/id keys; when set, other models are hidden. */
	eligible?: string[];
	current?: { provider: string; id: string; thinkingLevel?: ConfiguredThinkingLevel };
	mode: PickerMode;
	/** Provider id being refreshed, "all" for a global refresh, null when idle. */
	refreshing: string | null;
	onPick(selection: PickerSelection): void;
	/** Clear the role/agent override back to auto. Absent for the active mode. */
	onClear?(): void;
	onRefresh(provider?: string): void;
	onClose(): void;
	onLogin?(providerId: string): void;
}

export interface ActiveSectionProps {
	state: RpcSessionState | null;
	roles: RpcModelRolesResult | null;
	streaming: boolean;
	onPick(): void;
	onCycle(direction: "forward" | "backward"): void;
}

export interface RolesSectionProps {
	roles: RpcModelRolesResult | null;
	onPickRole(roleId: string): void;
	onClearRole(roleId: string, storage?: RoleStorage): void;
	onCreateRole(roleId: string): void;
	onDeleteRole(roleId: string): void;
	onSetCycleOrder(order: string[]): void;
	onSetTag(model: string, tag: string | null): void;
}

export interface AgentsSectionProps {
	agents: RpcAgentsResult | null;
	onPickAgent(agentName: string): void;
	onSetEnabled(agentName: string, enabled: boolean): void;
	onSetServiceTier(agentName: string, tier: string | null): void;
	onSetPrewalk(agentName: string, value: string | null): void;
	onSetAdvisor(agentName: string, value: string | null): void;
}

export interface ProvidersSectionProps {
	browser: RpcModelBrowserResult | null;
	/** Provider id being refreshed, "all" for a global refresh, null when idle. */
	refreshing: string | null;
	loginStatus?: RpcLoginStatusResult | null;
	onRefresh(provider?: string): void;
	onLogin?(providerId: string): void;
	onLogout?(providerId: string, credentialId: number): void;
}

export interface LoginSheetProps {
	open: boolean;
	providerName: string;
	url?: string;
	instructions?: string;
	progress?: readonly string[];
	pending?: LoginPendingState;
	result?: LoginResultState;
	onSubmitInput(value: string): void;
	onCancel(): void;
	onClose(): void;
}
