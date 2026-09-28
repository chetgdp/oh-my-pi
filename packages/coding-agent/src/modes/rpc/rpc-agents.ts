/**
 * Agent RPC handlers and builders.
 */
import type { AgentSession } from "../../session/agent-session";
import type { AgentDefinition } from "../../task/types";
import { discoverAgents } from "../../task/discovery";
import { resolveSpawnPolicy } from "../../task/spawn-policy";
import { resolveAgentPrewalkDefault } from "../../task/prewalk";
import {
	cfgTaskAgentAdvisor,
	cfgTaskAgentModelOverrides,
	cfgTaskAgentPrewalk,
	cfgTaskAgentServiceTierOverrides,
	cfgTaskDisabledAgents,
	cfgTaskPrewalk,
} from "../../task/settings";
import {
	formatModelString,
	getModelMatchPreferences,
	resolveAgentAdvisorSelection,
	resolveAgentModelSelection,
	resolveAgentPrewalkPattern,
	resolveModelRoleValue,
} from "../../config/model-resolver";
import { isServiceTierInheritSettingValue, validateAgentServiceTierOverrides } from "../../config/service-tier";
import type { ModelConfigSession } from "./rpc-model-config";
import { toResolvedModel } from "./rpc-model-config";
import type { RpcAgentInfo, RpcAgentsResult, RpcCommand, RpcResolvedModel, RpcResponse } from "./rpc-types";
import { errorResponse, success } from "./rpc-response";
export async function buildAgents(session: ModelConfigSession): Promise<RpcAgentsResult> {
	await session.settings.reloadFromDisk();
	const { settings } = session;
	const availableModels = session.getAvailableModels();
	const cwd = session.sessionManager.getCwd();
	const discovery = await discoverAgents(cwd, undefined, session.effectiveExtensionRoots);
	const agents: AgentDefinition[] = [...discovery.agents, ...session.getSessionAgents()];
	const spawnPolicy = resolveSpawnPolicy(session.getSessionSpawns?.());
	const agentModelOverrides = cfgTaskAgentModelOverrides.get(settings);
	const disabledAgents = cfgTaskDisabledAgents.get(settings);
	const agentServiceTierOverrides = cfgTaskAgentServiceTierOverrides.get(settings);
	const agentPrewalkOverrides = cfgTaskAgentPrewalk.get(settings);
	const agentAdvisorOverrides = cfgTaskAgentAdvisor.get(settings);
	const taskPrewalkDefault = cfgTaskPrewalk.get(settings);

	const parentActive = session.model ? formatModelString(session.model) : session.getActiveModelString?.();
	const parentFallback = settings.getModelRole("default") ?? session.getModelString?.();

	const infos: RpcAgentInfo[] = agents.map(agent => {
		const rawOverride = agentModelOverrides[agent.name];
		const override = Array.isArray(rawOverride)
			? rawOverride.join(", ")
			: typeof rawOverride === "string"
				? rawOverride
				: undefined;
		const { patterns, role } = resolveAgentModelSelection({
			requestModel: undefined,
			settingsOverride: override,
			agentModel: agent.model,
			settings,
			activeModelPattern: parentActive,
			fallbackModelPattern: parentFallback,
		});

		let resolved: RpcResolvedModel | undefined;
		if (patterns[0]) {
			const r = resolveModelRoleValue(patterns[0], availableModels, {
				settings,
				matchPreferences: getModelMatchPreferences(settings),
			});
			resolved = toResolvedModel(r);
		}

		// Prewalk resolution
		const prewalkOverride = agentPrewalkOverrides[agent.name]?.trim() || undefined;
		const prewalkDefault = resolveAgentPrewalkDefault(agent, taskPrewalkDefault);
		const effectivePrewalk = resolveAgentPrewalkPattern({
			settingsOverride: prewalkOverride,
			agentPrewalk: prewalkDefault,
		});
		const prewalkSource: "override" | "frontmatter" | "default" | "none" =
			prewalkOverride !== undefined
				? "override"
				: agent.prewalk != null
					? "frontmatter"
					: effectivePrewalk
						? "default"
						: "none";

		// Advisor resolution
		const advisorOverride = agentAdvisorOverrides[agent.name]?.trim() || undefined;
		const advisorSelection = resolveAgentAdvisorSelection({
			settingsOverride: advisorOverride,
			agentAdvisor: agent.advisor,
		});
		const effectiveAdvisor = advisorSelection ? (advisorSelection.model ?? "@advisor") : undefined;
		const advisorSource: "override" | "frontmatter" | "none" =
			advisorOverride !== undefined ? "override" : agent.advisor != null ? "frontmatter" : "none";

		// Precedence entries
		const precedenceEntries: Array<{
			source: "override" | "frontmatter" | "parentActive" | "parentFallback" | "defaultRole";
			selector: string;
		}> = [];
		if (override) {
			precedenceEntries.push({ source: "override", selector: override });
		}
		if (agent.model && agent.model.length > 0) {
			precedenceEntries.push({ source: "frontmatter", selector: agent.model.join(", ") });
		}
		if (parentActive) {
			precedenceEntries.push({ source: "parentActive", selector: parentActive });
		}
		if (parentFallback) {
			precedenceEntries.push({ source: "parentFallback", selector: parentFallback });
		}
		precedenceEntries.push({ source: "defaultRole", selector: "@default" });

		let winnerIndex = precedenceEntries.findIndex(e => e.selector === patterns[0]);
		if (winnerIndex < 0) {
			winnerIndex = 0;
		}

		const serviceTier = agentServiceTierOverrides[agent.name];

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
			...(serviceTier ? { serviceTier } : {}),
			prewalk: {
				...(effectivePrewalk ? { effective: effectivePrewalk } : {}),
				source: prewalkSource,
			},
			advisor: {
				...(effectiveAdvisor ? { effective: effectiveAdvisor } : {}),
				source: advisorSource,
			},
			isDefaultTaskAgent: agent.name === spawnPolicy.defaultAgent,
			precedence: {
				entries: precedenceEntries,
				winner: winnerIndex,
			},
		};
	});

	return {
		defaultAgent: spawnPolicy.defaultAgent,
		agents: infos,
	};
}

async function applyAgentMutation(
	session: AgentSession,
	commandType: RpcCommand["type"],
	agentName: string,
	id: string | undefined,
	mutate: () => void | Promise<void>,
): Promise<RpcResponse> {
	const discovery = await discoverAgents(session.sessionManager.getCwd(), undefined, session.effectiveExtensionRoots);
	const allAgents = [...discovery.agents, ...session.getSessionAgents()];
	const agent = allAgents.find(a => a.name === agentName);
	if (!agent) {
		return errorResponse(id, commandType, `Unknown agent: ${agentName}`);
	}

	await mutate();
	await session.settings.flush();

	const updatedAgents = await buildAgents(session);
	const updatedAgent = updatedAgents.agents.find(a => a.name === agentName);
	if (!updatedAgent) {
		return errorResponse(id, commandType, `Agent not found after update: ${agentName}`);
	}

	return success(id, commandType, updatedAgent);
}

export async function handleSetAgentModel(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_agent_model" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const agentName = command.agent;
	const overrides = { ...cfgTaskAgentModelOverrides.get(session.settings) };
	if (command.selector === null) {
		delete overrides[agentName];
	} else {
		const availableModels = session.getAvailableModels();
		const resolved = resolveModelRoleValue(command.selector, availableModels, {
			settings: session.settings,
			matchPreferences: getModelMatchPreferences(session.settings),
		});
		if (!resolved.model) {
			return errorResponse(
				id,
				"set_agent_model",
				`Selector does not resolve to an available model: ${command.selector}${resolved.warning ? ` (${resolved.warning})` : ""}`,
			);
		}
		overrides[agentName] = command.selector;
	}

	return applyAgentMutation(session, "set_agent_model", agentName, id, () => {
		cfgTaskAgentModelOverrides.set(session.settings, overrides);
	});
}

export async function handleSetAgentEnabled(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_agent_enabled" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const agentName = command.agent;
	return applyAgentMutation(session, "set_agent_enabled", agentName, id, () => {
		const current = cfgTaskDisabledAgents.get(session.settings);
		const disabledSet = new Set(current);
		if (command.enabled) {
			disabledSet.delete(agentName);
		} else {
			disabledSet.add(agentName);
		}
		cfgTaskDisabledAgents.set(session.settings, [...disabledSet]);
	});
}

export async function handleSetAgentServiceTier(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_agent_service_tier" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const agentName = command.agent;
	const { tier } = command;
	if (tier !== null && !isServiceTierInheritSettingValue(tier)) {
		return errorResponse(id, "set_agent_service_tier", `Invalid service tier: ${tier}`);
	}

	return applyAgentMutation(session, "set_agent_service_tier", agentName, id, () => {
		const overrides = {
			...validateAgentServiceTierOverrides(cfgTaskAgentServiceTierOverrides.get(session.settings)),
		};
		if (tier === null) {
			delete overrides[agentName];
		} else {
			overrides[agentName] = tier;
		}
		cfgTaskAgentServiceTierOverrides.set(session.settings, overrides);
	});
}

export async function handleSetAgentPrewalk(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_agent_prewalk" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const agentName = command.agent;
	if (command.value !== null) {
		const val = command.value.trim().toLowerCase();
		if (val !== "on" && val !== "off") {
			const availableModels = session.getAvailableModels();
			const resolved = resolveModelRoleValue(command.value, availableModels, {
				settings: session.settings,
				matchPreferences: getModelMatchPreferences(session.settings),
			});
			if (!resolved.model) {
				return errorResponse(
					id,
					"set_agent_prewalk",
					`Selector does not resolve to an available model: ${command.value}${resolved.warning ? ` (${resolved.warning})` : ""}`,
				);
			}
		}
	}

	return applyAgentMutation(session, "set_agent_prewalk", agentName, id, () => {
		const overrides = { ...cfgTaskAgentPrewalk.get(session.settings) };
		if (command.value === null) {
			delete overrides[agentName];
		} else {
			overrides[agentName] = command.value;
		}
		cfgTaskAgentPrewalk.set(session.settings, overrides);
	});
}

export async function handleSetAgentAdvisor(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_agent_advisor" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const agentName = command.agent;
	if (command.value !== null) {
		const val = command.value.trim().toLowerCase();
		if (val !== "on" && val !== "off") {
			const availableModels = session.getAvailableModels();
			const resolved = resolveModelRoleValue(command.value, availableModels, {
				settings: session.settings,
				matchPreferences: getModelMatchPreferences(session.settings),
			});
			if (!resolved.model) {
				return errorResponse(
					id,
					"set_agent_advisor",
					`Selector does not resolve to an available model: ${command.value}${resolved.warning ? ` (${resolved.warning})` : ""}`,
				);
			}
		}
	}

	return applyAgentMutation(session, "set_agent_advisor", agentName, id, () => {
		const overrides = { ...cfgTaskAgentAdvisor.get(session.settings) };
		if (command.value === null) {
			delete overrides[agentName];
		} else {
			overrides[agentName] = command.value;
		}
		cfgTaskAgentAdvisor.set(session.settings, overrides);
	});
}
