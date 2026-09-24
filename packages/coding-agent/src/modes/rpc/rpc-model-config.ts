/**
 * Pure builders for model-role and agent RPC responses.
 *
 * Factored out of rpc-server.ts so the logic is testable with a
 * structural session stub.
 */
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import type { Model } from "@oh-my-pi/pi-ai";
import { resolveRoleAssignments } from "@oh-my-pi/pi-tui/overlays/model-browser";
import { AUTO_THINKING, concreteThinkingLevel, parseConfiguredThinkingLevel } from "@oh-my-pi/pi-tui/thinking";
import {
	getModelMatchPreferences,
	resolveModelRoleValue,
	type ResolvedModelRoleValue,
} from "../../config/model-resolver";
import type { ModelRegistry } from "../../config/model-registry";
import { getKnownRoleIds, getRoleInfo, MODEL_ROLES, roleCandidatePool, type ModelRole } from "../../config/model-roles";
import { resolveRoleModelFull } from "../../session/role-models";
import type { Settings } from "../../config/settings";
import type { AgentSession } from "../../session/agent-session";
import type { AgentDefinition } from "../../task/types";
import type { EffectiveExtensionRoots } from "../../capability/types";
import { createModelBrowserSource } from "../model-browser-source";
import type { RpcCommand, RpcModelRole, RpcModelRolesResult, RpcResolvedModel, RpcResponse } from "./rpc-types";
import { errorResponse, success, type RpcOutput } from "./rpc-response";

// Fallback chain mirroring ROLE_CONFIGURED_FALLBACK in model-resolver.ts.
// Kept as a plain map so the RPC layer does not import private constants.
const ROLE_FALLBACK: Record<string, { role: string; configuredOnly: boolean }> = {
	smol: { role: "default", configuredOnly: false },
	slow: { role: "default", configuredOnly: false },
	advisor: { role: "slow", configuredOnly: true },
	memory: { role: "tiny", configuredOnly: false },
	tiny: { role: "smol", configuredOnly: false },
};

export function toResolvedModel(resolved: ResolvedModelRoleValue): RpcResolvedModel | undefined {
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

	const allModels = session.modelRegistry.getAll("all");
	const autoCandidates = session.modelRegistry.getAvailable();
	const browserSource = createModelBrowserSource(settings);
	const roleAssignments = resolveRoleAssignments(browserSource, allModels, autoCandidates);

	const configuredTags = settings.get("modelTags");
	const modelTags: Record<string, string> = {};
	for (const [key, val] of Object.entries(configuredTags)) {
		if (val && typeof val === "object" && typeof val.name === "string") {
			modelTags[key] = val.name;
		}
	}

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

		const assignment = roleAssignments[role];
		let autoSelected: RpcResolvedModel | undefined;
		if (!configured && assignment?.autoSelected && assignment.model) {
			autoSelected = {
				provider: assignment.model.provider,
				id: assignment.model.id,
				name: assignment.model.name,
				...(assignment.thinkingLevel && assignment.thinkingLevel !== ThinkingLevel.Inherit
					? { thinkingLevel: assignment.thinkingLevel as ThinkingLevel }
					: {}),
			};
		}

		const resolvedModel = resolved.model ?? assignment?.model;
		const resolvedKey = resolvedModel ? `${resolvedModel.provider}/${resolvedModel.id}` : undefined;
		const tag = resolvedKey ? modelTags[resolvedKey] : undefined;

		const eligible = roleCandidatePool(role, settings, session.modelRegistry).map(m => `${m.provider}/${m.id}`);

		return {
			id: role,
			name: info.name ?? role,
			section: info.section ?? "chat",
			...(configured ? { configured } : {}),
			source,
			provenance: settings.getModelRoleProvenance(role),
			custom: !(role in MODEL_ROLES),
			...(fallbackFrom ? { fallbackFrom } : {}),
			...(resolved.model ? { resolved: toResolvedModel(resolved) } : {}),
			...(autoSelected ? { autoSelected } : {}),
			...(tag ? { tag } : {}),
			...(resolved.warning ? { warning: resolved.warning } : {}),
			eligible,
		};
	});

	return {
		storage: settings.get("modelRoleStorage") as "global" | "project",
		roles,
		cycleOrder: settings.get("cycleOrder"),
		modelTags,
	};
}

const ROLE_ID_REGEX = /^[a-zA-Z][\w-]*$/;

/**
 * Runtime (session-only) role overrides live in one `modelRoles` override
 * object; rewriting it from the merged view would mark every persisted role
 * as runtime-owned, so only roles whose provenance is already runtime are kept.
 */
function setRuntimeModelRole(settings: Settings, role: string, selector: string | undefined): void {
	const merged = (settings.get("modelRoles") as Record<string, string>) ?? {};
	const runtime: Record<string, string> = {};
	for (const id of getKnownRoleIds(settings)) {
		if (id !== role && settings.getModelRoleProvenance(id) === "runtime" && merged[id]) runtime[id] = merged[id];
	}
	if (selector !== undefined) runtime[role] = selector;
	if (Object.keys(runtime).length === 0) {
		settings.clearOverride("modelRoles");
	} else {
		settings.override("modelRoles", runtime);
	}
}

export async function handleSetModelRole(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_model_role" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const roleId = command.role;
	const knownRoles = getKnownRoleIds(session.settings);
	if (!knownRoles.includes(roleId) && !ROLE_ID_REGEX.test(roleId)) {
		return errorResponse(id, "set_model_role", `Invalid role id: ${roleId}`);
	}

	const configuredStorage = session.settings.get("modelRoleStorage");
	const persist = command.persist ?? true;
	const targetScope = command.storage ?? (configuredStorage === "project" ? "project" : "global");

	if (command.storage === "project" && configuredStorage === "global") {
		return errorResponse(id, "set_model_role", "project storage disabled");
	}

	if (command.selector === null && !persist) {
		setRuntimeModelRole(session.settings, roleId, undefined);
	} else if (command.selector === null) {
		const previousEffectiveRoleValue = roleId === "default" ? session.settings.getModelRole("default") : undefined;

		if (targetScope === "project") {
			session.settings.clearProjectModelRole(roleId);
		} else {
			session.settings.setModelRole(roleId, undefined);
		}

		if (roleId === "default") {
			const fallbackRoleValue = session.settings.getModelRole("default");
			const fallbackProvenance = session.settings.getModelRoleProvenance("default");
			const exposesPersistedFallback = fallbackProvenance === "project" || fallbackProvenance === "global";
			if (fallbackRoleValue && fallbackRoleValue !== previousEffectiveRoleValue && exposesPersistedFallback) {
				const scopedModels = session.scopedModels.map(sm => sm.model);
				const availableModels = scopedModels.length > 0 ? scopedModels : session.getAvailableModels();
				const resolved = resolveModelRoleValue(fallbackRoleValue, availableModels, {
					settings: session.settings,
				});
				if (resolved.model) {
					const fallbackModel = resolved.model;
					const isAuto = resolved.thinkingLevel === AUTO_THINKING;
					let concreteThinking = concreteThinkingLevel(resolved.thinkingLevel);
					let isAutoFromDefault = false;
					if (!resolved.explicitThinkingLevel && !concreteThinking) {
						const defaultLevel = parseConfiguredThinkingLevel(session.settings.get("defaultThinkingLevel"));
						if (defaultLevel === AUTO_THINKING) {
							isAutoFromDefault = true;
						} else if (defaultLevel) {
							concreteThinking = defaultLevel;
						}
					}
					const effectiveIsAuto = isAuto || isAutoFromDefault;
					const { switched } = await session.setModel(fallbackModel, "default", {
						persist: false,
						thinkingLevel: effectiveIsAuto ? ThinkingLevel.Inherit : (concreteThinking ?? ThinkingLevel.Inherit),
					});
					if (switched) {
						if (effectiveIsAuto) {
							session.setThinkingLevel(AUTO_THINKING, true);
						} else if (concreteThinking && concreteThinking !== ThinkingLevel.Inherit) {
							session.setThinkingLevel(concreteThinking);
						}
					}
				}
			}
		}
	} else {
		const availableModels = session.getAvailableModels();
		const resolved = resolveModelRoleValue(command.selector, availableModels, {
			settings: session.settings,
			matchPreferences: getModelMatchPreferences(session.settings),
		});
		if (!resolved.model) {
			return errorResponse(
				id,
				"set_model_role",
				`Selector does not resolve to an available model: ${command.selector}${resolved.warning ? ` (${resolved.warning})` : ""}`,
			);
		}

		const selector = command.selector;
		const model = resolved.model;
		const thinkingLevel = resolved.thinkingLevel;
		const isAuto = thinkingLevel === AUTO_THINKING;
		const concreteThinking = isAuto || thinkingLevel === undefined ? undefined : thinkingLevel;
		// The raw selector already carries any `:level`; re-suffixing would double it.
		// Only the default role's `:auto` moves into `defaultThinkingLevel`, like the hub.
		const persistedValue = isAuto && roleId === "default" ? selector.replace(/:auto$/i, "") : selector;

		if (!persist) {
			if (roleId === "default") {
				await session.setModel(model, "default", {
					selector,
					thinkingLevel: isAuto ? ThinkingLevel.Inherit : (concreteThinking as ThinkingLevel | undefined),
					persist: false,
				});
				if (isAuto) {
					session.setThinkingLevel(AUTO_THINKING, true);
				} else if (concreteThinking && concreteThinking !== ThinkingLevel.Inherit) {
					session.setThinkingLevel(concreteThinking);
				}
			} else {
				setRuntimeModelRole(session.settings, roleId, selector);
			}
		} else {
			if (roleId === "default") {
				const effectiveProvenance = session.settings.getModelRoleProvenance("default");
				const shadowedGlobal =
					configuredStorage === "project" &&
					targetScope === "global" &&
					(effectiveProvenance === "project" ||
						effectiveProvenance === "overlay" ||
						(effectiveProvenance === "runtime" &&
							session.settings.isProjectModelRoleRuntimeOverrideActive("default")));
				const shadowedProject =
					configuredStorage === "project" && targetScope === "project" && effectiveProvenance === "overlay";

				if (shadowedGlobal) {
					session.settings.setModelRole("default", persistedValue);
					if (isAuto) {
						session.settings.set("defaultThinkingLevel", AUTO_THINKING);
					}
				} else if (shadowedProject) {
					session.settings.setProjectModelRole("default", persistedValue);
					if (isAuto) {
						session.settings.set("defaultThinkingLevel", AUTO_THINKING);
					}
				} else {
					const { switched } = await session.setModel(model, "default", {
						selector,
						thinkingLevel: isAuto ? ThinkingLevel.Inherit : (concreteThinking as ThinkingLevel | undefined),
						persist: targetScope === "global",
					});
					if (!switched) {
						return errorResponse(id, "set_model_role", "Failed to switch default model");
					}
					if (targetScope === "project") {
						session.settings.setProjectModelRole("default", persistedValue);
					}
					if (isAuto) {
						session.setThinkingLevel(AUTO_THINKING, true);
					} else if (concreteThinking && concreteThinking !== ThinkingLevel.Inherit) {
						session.setThinkingLevel(concreteThinking);
					}
				}
			} else {
				const modelRoleValue = persistedValue;
				if (targetScope === "project") {
					session.settings.setProjectModelRole(roleId, modelRoleValue);
				} else {
					session.settings.setModelRole(roleId, modelRoleValue);
				}
			}
		}
	}

	if (persist) {
		await session.settings.flush();
	}
	const updated = await buildModelRoles(session);
	const updatedRole = updated.roles.find(r => r.id === roleId);
	if (!updatedRole) {
		return errorResponse(id, "set_model_role", `Role not found after update: ${roleId}`);
	}
	return success(id, "set_model_role", updatedRole);
}

export async function handleDeleteModelRole(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "delete_model_role" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const roleId = command.role;
	if (roleId in MODEL_ROLES) {
		return errorResponse(id, "delete_model_role", `Cannot delete built-in role: ${roleId}`);
	}
	const knownRoles = getKnownRoleIds(session.settings);
	if (!knownRoles.includes(roleId)) {
		return errorResponse(id, "delete_model_role", `Unknown role: ${roleId}`);
	}

	session.settings.clearProjectModelRole(roleId);
	session.settings.setModelRole(roleId, undefined);

	const currentRoles = session.settings.get("modelRoles") as Record<string, string> | undefined;
	if (currentRoles && roleId in currentRoles) {
		const updatedRoles = { ...currentRoles };
		delete updatedRoles[roleId];
		session.settings.override("modelRoles", updatedRoles);
	}

	const cycleOrder = (session.settings.get("cycleOrder") as string[] | undefined) ?? [];
	if (cycleOrder.includes(roleId)) {
		session.settings.set(
			"cycleOrder",
			cycleOrder.filter(r => r !== roleId),
		);
	}

	await session.settings.flush();
	const result = await buildModelRoles(session);
	return success(id, "delete_model_role", result);
}

export async function handleSetCycleOrder(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_cycle_order" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const knownRoles = getKnownRoleIds(session.settings);
	const seen = new Set<string>();
	for (const role of command.order) {
		if (!knownRoles.includes(role)) {
			return errorResponse(id, "set_cycle_order", `Unknown role in cycle order: ${role}`);
		}
		if (seen.has(role)) {
			return errorResponse(id, "set_cycle_order", `Duplicate role in cycle order: ${role}`);
		}
		seen.add(role);
	}

	session.settings.set("cycleOrder", command.order);
	await session.settings.flush();
	const result = await buildModelRoles(session);
	return success(id, "set_cycle_order", result);
}

export async function handleSetModelTag(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "set_model_tag" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const allModels = session.modelRegistry.getAll("all");
	const modelExists = allModels.some(m => `${m.provider}/${m.id}` === command.model);
	if (!modelExists) {
		return errorResponse(id, "set_model_tag", `Unknown model: ${command.model}`);
	}

	const currentTags = { ...session.settings.get("modelTags") };
	if (command.tag === null) {
		delete currentTags[command.model];
	} else {
		currentTags[command.model] = {
			...currentTags[command.model],
			name: command.tag,
		};
	}

	session.settings.set("modelTags", currentTags);
	await session.settings.flush();
	const result = await buildModelRoles(session);
	return success(id, "set_model_tag", result);
}

export async function handleCycleRoleModel(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "cycle_role_model" }>,
	id: string | undefined,
	_output: RpcOutput,
): Promise<RpcResponse> {
	const order = session.settings.get("cycleOrder");
	const result = await session.cycleRoleModels(order, command.direction ?? "forward");
	if (!result) {
		return success(id, "cycle_role_model", null);
	}

	const cycle = session.getRoleModelCycle(order);
	const cycleRoles = cycle ? cycle.models.map(m => m.role) : [result.role];
	const currentIndex = cycle ? cycle.currentIndex : 0;

	return success(id, "cycle_role_model", {
		role: result.role,
		model: {
			provider: result.model.provider,
			id: result.model.id,
			name: result.model.name,
			...(result.thinkingLevel != null ? { thinkingLevel: result.thinkingLevel } : {}),
		},
		cycle: {
			roles: cycleRoles,
			currentIndex,
		},
	});
}
