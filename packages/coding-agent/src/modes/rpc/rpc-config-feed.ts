import type { Settings } from "../../config/settings";
import type { SettingPath } from "../../config/settings-schema";
import type { RpcOutput } from "./rpc-response";

interface ConfigUpdateFlags {
	modelRoles?: true;
	agents?: true;
}

const CONFIG_UPDATE_FLAGS_BY_PATH: Partial<Record<SettingPath, ConfigUpdateFlags>> = {
	modelRoles: { modelRoles: true, agents: true },
	cycleOrder: { modelRoles: true },
	modelTags: { modelRoles: true },
	modelRoleStorage: { modelRoles: true },
	modelProviderOrder: { modelRoles: true, agents: true },
	defaultThinkingLevel: { modelRoles: true },
	disabledProviders: { modelRoles: true },
	"retry.fallbackChains": { modelRoles: true },
	"task.agentModelOverrides": { agents: true },
	"task.disabledAgents": { agents: true },
	"task.agentServiceTierOverrides": { agents: true },
	"task.agentPrewalk": { agents: true },
	"task.agentAdvisor": { agents: true },
	"task.prewalk": { agents: true },
};

/**
 * Forward effective settings changes to one RPC connection as a single
 * coalesced `config_update` frame per microtask burst.
 */
export function subscribeConfigUpdates(settings: Settings, output: RpcOutput): () => void {
	let pending: ConfigUpdateFlags = {};
	let scheduled = false;
	let active = true;

	const flush = (): void => {
		scheduled = false;
		const flags = pending;
		pending = {};
		if (!active || (!flags.modelRoles && !flags.agents)) return;
		output({ type: "config_update", ...flags });
	};

	const unsubscribe = settings.onEffectiveChange(path => {
		const flags = CONFIG_UPDATE_FLAGS_BY_PATH[path];
		if (!flags) return;
		if (flags.modelRoles) pending.modelRoles = true;
		if (flags.agents) pending.agents = true;
		if (!scheduled) {
			scheduled = true;
			queueMicrotask(flush);
		}
	});

	return () => {
		active = false;
		pending = {};
		unsubscribe();
	};
}
