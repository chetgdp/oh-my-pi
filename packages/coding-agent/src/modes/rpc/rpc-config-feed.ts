import type { AnySetting } from "../../config/registry";
import {
	cfgCycleOrder,
	cfgDisabledProviders,
	cfgModelProviderOrder,
	cfgModelRoles,
	cfgModelRoleStorage,
	cfgModelTags,
} from "../../config/model-settings";
import type { Settings } from "../../config/settings";
import { cfgDefaultThinkingLevel, cfgRetryFallbackChains } from "../../session/settings";
import {
	cfgTaskAgentAdvisor,
	cfgTaskAgentModelOverrides,
	cfgTaskAgentPrewalk,
	cfgTaskAgentServiceTierOverrides,
	cfgTaskDisabledAgents,
	cfgTaskPrewalk,
} from "../../task/settings";
import type { RpcOutput } from "./rpc-response";

interface ConfigUpdateFlags {
	modelRoles?: true;
	agents?: true;
}

const MODEL_ROLE_SETTINGS: readonly AnySetting[] = [
	cfgModelRoles,
	cfgCycleOrder,
	cfgModelTags,
	cfgModelRoleStorage,
	cfgModelProviderOrder,
	cfgDefaultThinkingLevel,
	cfgDisabledProviders,
	cfgRetryFallbackChains,
];

const AGENT_SETTINGS: readonly AnySetting[] = [
	cfgModelRoles,
	cfgModelProviderOrder,
	cfgTaskAgentModelOverrides,
	cfgTaskDisabledAgents,
	cfgTaskAgentServiceTierOverrides,
	cfgTaskAgentPrewalk,
	cfgTaskAgentAdvisor,
	cfgTaskPrewalk,
];

const ALL_SETTINGS: readonly AnySetting[] = Array.from(new Set([...MODEL_ROLE_SETTINGS, ...AGENT_SETTINGS]));

const MODEL_ROLE_SET = new Set(MODEL_ROLE_SETTINGS);
const AGENT_SET = new Set(AGENT_SETTINGS);

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

	const unsubscribe = settings.onEffectiveChange(ALL_SETTINGS, setting => {
		if (MODEL_ROLE_SET.has(setting)) pending.modelRoles = true;
		if (AGENT_SET.has(setting)) pending.agents = true;
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
