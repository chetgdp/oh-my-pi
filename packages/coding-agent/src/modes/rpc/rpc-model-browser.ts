/**
 * Model browser RPC handlers and builders.
 */
import { modelKind, MODEL_KINDS } from "@oh-my-pi/pi-catalog/types";
import { resolveRoleAssignments } from "@oh-my-pi/pi-tui/overlays/model-browser";
import type { AgentSession } from "../../session/agent-session";
import { createModelBrowserSource } from "../model-browser-source";
import type { ModelConfigSession } from "./rpc-model-config";
import type { RpcBrowserModel, RpcCommand, RpcModelBrowserResult, RpcProviderStatus, RpcResponse } from "./rpc-types";
import { errorResponse, success, type RpcOutput } from "./rpc-response";

export async function buildModelBrowser(session: ModelConfigSession): Promise<RpcModelBrowserResult> {
	await session.settings.reloadFromDisk();
	const { settings, modelRegistry } = session;

	const allModels = modelRegistry.getAll("all");
	const availableModels = modelRegistry.getAvailable();
	const browserSource = createModelBrowserSource(settings);
	const roleAssignments = resolveRoleAssignments(browserSource, allModels, availableModels);

	const storage = settings.getStorage();
	const mruOrder = storage?.getModelUsageOrder() ?? [];
	const perfMap = storage?.getModelPerf();

	const configuredTags = settings.get("modelTags") ?? {};
	const modelTags: Record<string, string> = {};
	for (const [key, val] of Object.entries(configuredTags)) {
		if (val && typeof val === "object" && typeof val.name === "string") {
			modelTags[key] = val.name;
		}
	}

	// Group roles by model selector "provider/id"
	const modelRolesMap = new Map<string, Array<{ role: string; auto: boolean }>>();
	for (const [role, assignment] of Object.entries(roleAssignments)) {
		if (!assignment?.model) continue;
		const selector = `${assignment.model.provider}/${assignment.model.id}`;
		let rolesList = modelRolesMap.get(selector);
		if (!rolesList) {
			rolesList = [];
			modelRolesMap.set(selector, rolesList);
		}
		rolesList.push({
			role,
			auto: Boolean(assignment.autoSelected),
		});
	}

	// A full catalog with locked providers runs past the 1 MiB frame cap; locked
	// providers are represented by their provider row, plus any model a role or
	// the MRU list still points at.
	const referenced = new Set<string>([...modelRolesMap.keys(), ...mruOrder]);
	const listed = allModels.filter(model => {
		if (modelRegistry.hasConfiguredAuth(model)) return true;
		return referenced.has(`${model.provider}/${model.id}`);
	});

	const models: RpcBrowserModel[] = listed.map(model => {
		const selector = `${model.provider}/${model.id}`;
		const locked = !modelRegistry.hasConfiguredAuth(model);
		const perf = perfMap?.get(selector);
		const roles = modelRolesMap.get(selector) ?? [];
		const tag = modelTags[selector];
		const kind = modelKind(model);

		return {
			provider: model.provider,
			id: model.id,
			name: model.name,
			selector,
			kind,
			locked,
			...(perf ? { perf } : {}),
			roles,
			...(tag ? { tag } : {}),
			...(model.contextWindow != null ? { contextWindow: model.contextWindow } : {}),
		};
	});

	// Providers: union of providers in allModels and discoverable providers
	const providerSet = new Set<string>();
	const providerModelCounts = new Map<string, number>();
	for (const model of allModels) {
		providerSet.add(model.provider);
		providerModelCounts.set(model.provider, (providerModelCounts.get(model.provider) ?? 0) + 1);
	}

	const discoverable = new Set(modelRegistry.getDiscoverableProviders());
	for (const p of discoverable) {
		providerSet.add(p);
	}

	const providers: RpcProviderStatus[] = [...providerSet].map(providerId => {
		const authenticated = modelRegistry.hasConcreteAuth(providerId);
		const isDiscoverable = discoverable.has(providerId);
		const discovery = modelRegistry.getProviderDiscoveryState(providerId);
		const modelCount = providerModelCounts.get(providerId) ?? 0;

		return {
			id: providerId,
			authenticated,
			discoverable: isDiscoverable,
			...(discovery ? { discovery } : {}),
			modelCount,
		};
	});

	// Present kinds among allModels
	const presentKindsSet = new Set<string>();
	for (const model of listed) {
		presentKindsSet.add(modelKind(model));
	}
	const kinds = MODEL_KINDS.filter(k => presentKindsSet.has(k));

	return {
		models,
		mruOrder,
		providers,
		kinds,
	};
}

export async function handleGetModelBrowser(
	session: AgentSession,
	_command: Extract<RpcCommand, { type: "get_model_browser" }>,
	id: string | undefined,
	_output: RpcOutput,
): Promise<RpcResponse> {
	const data = await buildModelBrowser(session);
	return success(id, "get_model_browser", data);
}

export async function handleRefreshModels(
	session: AgentSession,
	command: Extract<RpcCommand, { type: "refresh_models" }>,
	id: string | undefined,
	output: RpcOutput,
): Promise<RpcResponse> {
	const { provider } = command;
	const { modelRegistry } = session;

	if (provider !== undefined) {
		const discoverable = modelRegistry.getDiscoverableProviders();
		const hasProvider =
			modelRegistry.getAll("all").some(m => m.provider === provider) || discoverable.includes(provider);
		if (!hasProvider) {
			return errorResponse(id, "refresh_models", `Unknown provider: ${provider}`);
		}
		await modelRegistry.refreshProvider(provider, "online");
	} else {
		await modelRegistry.refresh("online");
	}

	output({ type: "config_update", models: true });
	const data = await buildModelBrowser(session);
	return success(id, "refresh_models", data);
}
