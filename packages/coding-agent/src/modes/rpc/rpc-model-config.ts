/**
 * Pure builders for model-role and agent RPC responses.
 *
 * Factored out of rpc-server.ts so the logic is testable with a
 * structural session stub.
 */
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import type { Model } from "@oh-my-pi/pi-ai";
import {
	getModelMatchPreferences,
	resolveAgentModelSelection,
	resolveModelRoleValue,
	type ResolvedModelRoleValue,
} from "../../config/model-resolver";
import type { ModelRegistry } from "../../config/model-registry";
import { getKnownRoleIds, getRoleInfo, MODEL_ROLES, roleCandidatePool, type ModelRole } from "../../config/model-roles";
import { resolveRoleModelFull } from "../../session/role-models";
import type { Settings } from "../../config/settings";
import { discoverAgents } from "../../task/discovery";
import { resolveSpawnPolicy } from "../../task/spawn-policy";
import type { AgentDefinition } from "../../task/types";
import type { EffectiveExtensionRoots } from "../../capability/types";
import type { RpcAgentInfo, RpcAgentsResult, RpcModelRole, RpcModelRolesResult, RpcResolvedModel } from "./rpc-types";

// Fallback chain mirroring ROLE_CONFIGURED_FALLBACK in model-resolver.ts.
// Kept as a plain map so the RPC layer does not import private constants.
const ROLE_FALLBACK: Record<string, { role: string; configuredOnly: boolean }> = {
	smol: { role: "default", configuredOnly: false },
	slow: { role: "default", configuredOnly: false },
	advisor: { role: "slow", configuredOnly: true },
	memory: { role: "tiny", configuredOnly: false },
	tiny: { role: "smol", configuredOnly: false },
};

function toResolvedModel(resolved: ResolvedModelRoleValue): RpcResolvedModel | undefined {
	if (!resolved.model) return undefined;
	return {
		provider: resolved.model.provider,
		id: resolved.model.id,
		name: resolved.model.name,
		...(resolved.thinkingLevel != null ? { thinkingLevel: resolved.thinkingLevel as ThinkingLevel } : {}),
	};
}

/** Minimal session surface the builders need. */
export interface ModelConfigSession {
	settings: Settings;
	sessionManager: { getCwd(): string };
	modelRegistry: ModelRegistry;
	getAvailableModels(): Model[];
	model?: Model;
	effectiveExtensionRoots: EffectiveExtensionRoots;
	getSessionAgents(): AgentDefinition[];
	getSessionSpawns?: () => string | boolean | null | undefined;
	getActiveModelString?: () => string | undefined;
	getModelString?: () => string | undefined;
}

function resolveSource(
	settings: Settings,
	role: string,
	currentModel: Model | undefined,
): { source: RpcModelRole["source"]; fallbackFrom?: string } {
	const configured = settings.getModelRole(role);
	if (configured) {
		const persisted = settings.getModelRoleSource(role);
		if (persisted === "project") return { source: "project" };
		if (persisted === "global") return { source: "global" };
	}
	// Unset path
	if (role === "default") {
		if (currentModel) return { source: "active" };
		return { source: "unset" };
	}
	const fb = ROLE_FALLBACK[role];
	if (fb) {
		if (fb.configuredOnly && !settings.getModelRole(fb.role)) {
			return { source: "unset" };
		}
		return { source: "fallback", fallbackFrom: fb.role };
	}
	return { source: "unset" };
}

export async function buildModelRoles(session: ModelConfigSession): Promise<RpcModelRolesResult> {
	await session.settings.reloadFromDisk();
	const { settings } = session;
	const availableModels = session.getAvailableModels();
	const currentModel = session.model;
	const roleIds = getKnownRoleIds(settings);

	const roles: RpcModelRole[] = roleIds.map(role => {
		const builtIn = (MODEL_ROLES as Record<string, (typeof MODEL_ROLES)[ModelRole]>)[role];
		const info = builtIn ?? getRoleInfo(role, settings);
		const configured = settings.getModelRole(role);
		const { source, fallbackFrom } = resolveSource(settings, role, currentModel);

		let resolved = resolveRoleModelFull(settings, role, availableModels, currentModel);
		// When a fallback role itself resolves to nothing, resolve the fallback target
		if (!resolved.model && fallbackFrom) {
			resolved = resolveRoleModelFull(settings, fallbackFrom, availableModels, currentModel);
		}

		const eligible = roleCandidatePool(role, settings, session.modelRegistry).map(m => `${m.provider}/${m.id}`);

		return {
			id: role,
			name: info.name ?? role,
			section: info.section ?? "chat",
			...(configured ? { configured } : {}),
			source,
			...(fallbackFrom ? { fallbackFrom } : {}),
			...(resolved.model ? { resolved: toResolvedModel(resolved) } : {}),
			...(resolved.warning ? { warning: resolved.warning } : {}),
			eligible,
		};
	});

	return {
		storage: settings.get("modelRoleStorage") as "global" | "project",
		roles,
	};
}

export async function buildAgents(session: ModelConfigSession): Promise<RpcAgentsResult> {
	await session.settings.reloadFromDisk();
	const { settings } = session;
	const availableModels = session.getAvailableModels();
	const cwd = session.sessionManager.getCwd();
	const discovery = await discoverAgents(cwd, undefined, session.effectiveExtensionRoots);
	const agents: AgentDefinition[] = [...discovery.agents, ...session.getSessionAgents()];
	const spawnPolicy = resolveSpawnPolicy(session.getSessionSpawns?.());
	const agentModelOverrides = settings.get("task.agentModelOverrides") as Record<string, string>;
	const disabledAgents = settings.get("task.disabledAgents") as string[];

	const infos: RpcAgentInfo[] = agents.map(agent => {
		const override = agentModelOverrides[agent.name];
		const { patterns, role } = resolveAgentModelSelection({
			requestModel: undefined,
			settingsOverride: override,
			agentModel: agent.model,
			settings,
			activeModelPattern: session.getActiveModelString?.(),
			fallbackModelPattern: session.getModelString?.(),
		});

		let resolved: RpcResolvedModel | undefined;
		if (patterns[0]) {
			const r = resolveModelRoleValue(patterns[0], availableModels, {
				settings,
				matchPreferences: getModelMatchPreferences(settings),
			});
			resolved = toResolvedModel(r);
		}

		return {
			name: agent.name,
			description: agent.description,
			source: agent.source,
			...(agent.model ? { declaredModel: agent.model } : {}),
			...(agent.thinkingLevel != null ? { declaredThinkingLevel: String(agent.thinkingLevel) } : {}),
			...(override ? { override } : {}),
			patterns,
			...(role ? { role } : {}),
			...(resolved ? { resolved } : {}),
			disabled: disabledAgents.includes(agent.name),
		};
	});

	return {
		defaultAgent: spawnPolicy.defaultAgent,
		agents: infos,
	};
}
