import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { ConfiguredThinkingLevel } from "../../lib/session-actions";
import type { RpcModelRole } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionSnapshot, SessionStore } from "../../lib/session-store";
import type { SessionCommandSink } from "../../lib/session-actions";
import {
	cycleRoleModel,
	deleteModelRole,
	loginCancel,
	loginInput,
	loginStart,
	logout,
	refreshModels,
	setAgentAdvisor,
	setAgentEnabled,
	setAgentModel,
	setAgentPrewalk,
	setAgentServiceTier,
	setCycleOrder,
	setModel,
	setModelRole,
	setModelTag,
} from "../../lib/session-actions";
import { toSelector } from "../../lib/model-selector";
import { notify } from "../../lib/notify";
import type {
	ActiveSectionProps,
	AgentsSectionProps,
	ModelPickerSheetProps,
	PickerMode,
	PickerSelection,
	ProvidersSectionProps,
	RolesSectionProps,
	RoleStorage,
} from "./contract";
import { ModelsScreen } from "./ModelsScreen";
import { ModelPickerSheet } from "./ModelPickerSheet";
import { LoginSheet } from "./LoginSheet";

export interface UseModelsHubOptions {
	sink: SessionCommandSink | null;
	snap: SessionSnapshot;
	store: SessionStore | null;
	routeKey?: string | number | null;
}

export interface UseModelsHubResult {
	screen: ReactNode;
	sheet: ReactNode;
	loginSheet: ReactNode;
	openActivePicker(): void;
	cycleRoleModel(direction?: "forward" | "backward"): void;
	close(): void;
}

export function useModelsHub({ sink, snap, store, routeKey }: UseModelsHubOptions): UseModelsHubResult {
	// Picker state
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerMode, setPickerMode] = useState<PickerMode>({ kind: "active" });
	const [pickerTitle, setPickerTitle] = useState("Model");
	const [pickerEligible, setPickerEligible] = useState<string[] | undefined>(undefined);
	const [pickerCurrent, setPickerCurrent] = useState<
		{ provider: string; id: string; thinkingLevel?: ConfiguredThinkingLevel } | undefined
	>(undefined);

	// Login sheet state
	const [loginOpen, setLoginOpen] = useState(false);

	// Provider refreshing status: provider id, "all", or null
	const [refreshing, setRefreshing] = useState<string | null>(null);

	// Collapsible sections state: all default expanded (true)
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
		active: false,
		roles: false,
		agents: false,
		providers: false,
	});

	const toggleSection = useCallback((section: string) => {
		setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
	}, []);

	const close = useCallback(() => {
		setPickerOpen(false);
	}, []);

	// Reset picker and login on route change
	useEffect(() => {
		setPickerOpen(false);
		setLoginOpen(false);
	}, [routeKey]);
	// The picker reads the browser and roles; the store defers them past first paint.
	useEffect(() => {
		if (!pickerOpen || !store) return;
		store.ensureModelData();
		store.ensureLoginStatus();
	}, [pickerOpen, store]);
	// Open active picker
	const openActivePicker = useCallback(() => {
		const ss = snap.sessionState;
		const m = ss?.model;
		setPickerMode({ kind: "active" });
		setPickerTitle("Model");
		setPickerEligible(undefined);
		setPickerCurrent(m ? { provider: m.provider, id: m.id, thinkingLevel: ss?.thinkingLevel } : undefined);
		setPickerOpen(true);
	}, [snap.sessionState]);

	// Open role picker
	const openRolePicker = useCallback(
		(roleId: string) => {
			const role = snap.roles?.roles.find(r => r.id === roleId);
			if (!role) return;
			const storage: RoleStorage = snap.roles?.storage ?? "global";
			setPickerMode({ kind: "role", role, storage });
			setPickerTitle(`Role: ${role.name}`);
			setPickerEligible(role.eligible.length > 0 ? role.eligible : undefined);
			setPickerCurrent(
				role.resolved
					? {
							provider: role.resolved.provider,
							id: role.resolved.id,
							thinkingLevel: role.resolved.thinkingLevel,
						}
					: undefined,
			);
			setPickerOpen(true);
		},
		[snap.roles],
	);

	// Open agent picker
	const openAgentPicker = useCallback(
		(agentName: string) => {
			const agent = snap.agents?.agents.find(a => a.name === agentName);
			if (!agent) return;
			setPickerMode({ kind: "agent", agent });
			setPickerTitle(`Agent: ${agent.name}`);
			setPickerEligible(undefined);
			setPickerCurrent(
				agent.resolved
					? {
							provider: agent.resolved.provider,
							id: agent.resolved.id,
							thinkingLevel: agent.resolved.thinkingLevel,
						}
					: undefined,
			);
			setPickerOpen(true);
		},
		[snap.agents],
	);

	// Create custom role: opens picker in role mode for a synthetic role
	const handleCreateRole = useCallback(
		(roleId: string) => {
			const storage: RoleStorage = snap.roles?.storage ?? "global";
			const syntheticRole: RpcModelRole = {
				id: roleId,
				name: roleId,
				section: "chat",
				source: "unset",
				provenance: "default",
				custom: true,
				eligible: [],
			};
			setPickerMode({ kind: "role", role: syntheticRole, storage });
			setPickerTitle(`Role: ${roleId}`);
			setPickerEligible(undefined);
			setPickerCurrent(undefined);
			setPickerOpen(true);
		},
		[snap.roles?.storage],
	);

	// Login handlers
	const handledLoginIdRef = useRef<string | null>(null);

	useEffect(() => {
		const login = snap.login;
		if (!login || !login.result) return;
		if (handledLoginIdRef.current === login.loginId) return;
		handledLoginIdRef.current = login.loginId;

		if (login.result.kind === "done") {
			const provider = snap.loginStatus?.providers.find(p => p.id === login.providerId);
			const providerName = provider?.name ?? login.providerId;
			const identityText = login.result.identity ? ` as ${login.result.identity}` : "";
			notify("info", `Logged in to ${providerName}${identityText}`);
			store?.refreshLoginStatus();
		} else if (login.result.kind === "failed" && !login.result.cancelled) {
			notify("error", login.result.error);
		}
	}, [snap.login, snap.loginStatus?.providers, store]);

	const openLogin = useCallback(
		(providerId: string) => {
			if (!sink) return;
			loginStart(sink, providerId)
				.then(resp => {
					store?.beginLogin({ loginId: resp.data.loginId, providerId });
					setLoginOpen(true);
				})
				.catch(err => {
					notify("error", `Failed to start login: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	const submitLoginInput = useCallback(
		(value: string) => {
			if (!sink || !snap.login?.pending) return;
			loginInput(sink, snap.login.loginId, snap.login.pending.requestId, value).catch(err => {
				notify("error", `Failed to submit input: ${err instanceof Error ? err.message : String(err)}`);
			});
		},
		[sink, snap.login],
	);

	const cancelLogin = useCallback(() => {
		if (sink && snap.login) {
			loginCancel(sink, snap.login.loginId).catch(() => {});
		}
		setLoginOpen(false);
		store?.clearLogin();
	}, [sink, snap.login, store]);

	const closeLogin = useCallback(() => {
		setLoginOpen(false);
		store?.clearLogin();
	}, [store]);

	const handleLogout = useCallback(
		(providerId: string, credentialId: number) => {
			if (!sink) return;
			logout(sink, providerId, credentialId)
				.then(() => {
					store?.refreshLoginStatus();
					store?.refreshModelConfig();
					const provider = snap.loginStatus?.providers.find(p => p.id === providerId);
					const providerName = provider?.name ?? providerId;
					notify("info", `Logged out from ${providerName}`);
				})
				.catch(err => {
					notify("error", `Failed to log out: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store, snap.loginStatus?.providers],
	);
	// Handle picking a model
	const handlePick = useCallback(
		(selection: PickerSelection) => {
			if (!sink) return;

			// Check locked status in browser
			const browserModel = snap.browser?.models.find(
				m => m.provider === selection.provider && m.id === selection.id,
			);
			if (browserModel?.locked) {
				const isOAuthProvider = snap.loginStatus?.providers.some(
					p => p.id === selection.provider || p.storeCredentialsAs === selection.provider,
				);
				if (isOAuthProvider) {
					openLogin(selection.provider);
				} else {
					notify("error", `No API key for ${selection.provider}`);
				}
				return;
			}

			const selector = toSelector(selection.provider, selection.id, selection.thinkingLevel);

			if (pickerMode.kind === "active") {
				// When selection.persist and mode is active with storage === "project" in roles,
				// use setModelRole(sink, "default", selector, { storage }) instead so project scope is honored.
				const rolesStorage = snap.roles?.storage;
				if (selection.persist && rolesStorage === "project") {
					setModelRole(sink, "default", selector, { storage: "project" })
						.then(resp => {
							store?.refreshModelConfig();
							if (resp.data?.warning) {
								notify("info", resp.data.warning);
							}
							setPickerOpen(false);
						})
						.catch(err => {
							notify("error", `Failed to set default role: ${err instanceof Error ? err.message : String(err)}`);
						});
				} else {
					setModel(sink, selection.provider, selection.id, {
						persist: selection.persist,
						thinkingLevel: selection.thinkingLevel,
					})
						.then(() => {
							setPickerOpen(false);
						})
						.catch(err => {
							notify("error", `Failed to set model: ${err instanceof Error ? err.message : String(err)}`);
						});
				}
			} else if (pickerMode.kind === "role") {
				setModelRole(sink, pickerMode.role.id, selector, {
					persist: selection.persist,
					storage: selection.storage,
				})
					.then(resp => {
						store?.refreshModelConfig();
						if (resp.data?.warning) {
							notify("info", resp.data.warning);
						}
						setPickerOpen(false);
					})
					.catch(err => {
						notify("error", `Failed to set role: ${err instanceof Error ? err.message : String(err)}`);
					});
			} else if (pickerMode.kind === "agent") {
				setAgentModel(sink, pickerMode.agent.name, selector)
					.then(resp => {
						store?.applyAgent(resp.data);
						setPickerOpen(false);
					})
					.catch(err => {
						notify("error", `Failed to set agent model: ${err instanceof Error ? err.message : String(err)}`);
					});
			}
		},
		[sink, snap.browser?.models, snap.loginStatus?.providers, snap.roles?.storage, pickerMode, store, openLogin],
	);

	// Handle clearing a model in picker
	const handleClear = useCallback(() => {
		if (!sink) return;
		if (pickerMode.kind === "role") {
			setModelRole(sink, pickerMode.role.id, null)
				.then(() => {
					store?.refreshModelConfig();
					setPickerOpen(false);
				})
				.catch(err => {
					notify("error", `Failed to clear role: ${err instanceof Error ? err.message : String(err)}`);
				});
		} else if (pickerMode.kind === "agent") {
			setAgentModel(sink, pickerMode.agent.name, null)
				.then(resp => {
					store?.applyAgent(resp.data);
					setPickerOpen(false);
				})
				.catch(err => {
					notify("error", `Failed to clear agent override: ${err instanceof Error ? err.message : String(err)}`);
				});
		}
	}, [sink, pickerMode, store]);

	// Refresh models handler
	const handleRefresh = useCallback(
		(provider?: string) => {
			if (!sink) return;
			setRefreshing(provider ?? "all");
			refreshModels(sink, provider)
				.then(resp => {
					store?.applyBrowser(resp.data);
				})
				.catch(err => {
					notify("error", `Failed to refresh models: ${err instanceof Error ? err.message : String(err)}`);
				})
				.finally(() => {
					setRefreshing(null);
				});
		},
		[sink, store],
	);

	// ActiveSection handlers
	const handleCycle = useCallback(
		(direction: "forward" | "backward") => {
			if (!sink) return;
			cycleRoleModel(sink, direction)
				.then(() => {})
				.catch(err => {
					notify("error", `Failed to cycle role: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink],
	);

	// RolesSection handlers
	const handleClearRole = useCallback(
		(roleId: string, storage?: RoleStorage) => {
			if (!sink) return;
			setModelRole(sink, roleId, null, { storage })
				.then(() => {
					store?.refreshModelConfig();
				})
				.catch(err => {
					notify("error", `Failed to clear role: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	const handleDeleteRole = useCallback(
		(roleId: string) => {
			if (!sink) return;
			deleteModelRole(sink, roleId)
				.then(resp => {
					store?.applyRoles(resp.data);
				})
				.catch(err => {
					notify("error", `Failed to delete role: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	const handleSetCycleOrder = useCallback(
		(order: string[]) => {
			if (!sink) return;
			setCycleOrder(sink, order)
				.then(resp => {
					store?.applyRoles(resp.data);
				})
				.catch(err => {
					notify("error", `Failed to update cycle order: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	const handleSetTag = useCallback(
		(model: string, tag: string | null) => {
			if (!sink) return;
			setModelTag(sink, model, tag)
				.then(resp => {
					store?.applyRoles(resp.data);
				})
				.catch(err => {
					notify("error", `Failed to set model tag: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	// AgentsSection handlers
	const handleSetEnabled = useCallback(
		(agentName: string, enabled: boolean) => {
			if (!sink) return;
			setAgentEnabled(sink, agentName, enabled)
				.then(resp => {
					store?.applyAgent(resp.data);
				})
				.catch(err => {
					notify(
						"error",
						`Failed to set agent enabled state: ${err instanceof Error ? err.message : String(err)}`,
					);
				});
		},
		[sink, store],
	);

	const handleSetServiceTier = useCallback(
		(agentName: string, tier: string | null) => {
			if (!sink) return;
			setAgentServiceTier(sink, agentName, tier)
				.then(resp => {
					store?.applyAgent(resp.data);
				})
				.catch(err => {
					notify("error", `Failed to set agent service tier: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	const handleSetPrewalk = useCallback(
		(agentName: string, value: string | null) => {
			if (!sink) return;
			setAgentPrewalk(sink, agentName, value)
				.then(resp => {
					store?.applyAgent(resp.data);
				})
				.catch(err => {
					notify("error", `Failed to set agent prewalk: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	const handleSetAdvisor = useCallback(
		(agentName: string, value: string | null) => {
			if (!sink) return;
			setAgentAdvisor(sink, agentName, value)
				.then(resp => {
					store?.applyAgent(resp.data);
				})
				.catch(err => {
					notify("error", `Failed to set agent advisor: ${err instanceof Error ? err.message : String(err)}`);
				});
		},
		[sink, store],
	);

	// Section props
	const activeProps: ActiveSectionProps = {
		state: snap.sessionState,
		roles: snap.roles,
		streaming: snap.streaming,
		onPick: openActivePicker,
		onCycle: handleCycle,
	};

	const rolesProps: RolesSectionProps = {
		roles: snap.roles,
		onPickRole: openRolePicker,
		onClearRole: handleClearRole,
		onCreateRole: handleCreateRole,
		onDeleteRole: handleDeleteRole,
		onSetCycleOrder: handleSetCycleOrder,
		onSetTag: handleSetTag,
	};

	const agentsProps: AgentsSectionProps = {
		agents: snap.agents,
		onPickAgent: openAgentPicker,
		onSetEnabled: handleSetEnabled,
		onSetServiceTier: handleSetServiceTier,
		onSetPrewalk: handleSetPrewalk,
		onSetAdvisor: handleSetAdvisor,
	};

	const providersProps: ProvidersSectionProps = {
		browser: snap.browser,
		loginStatus: snap.loginStatus,
		refreshing,
		onRefresh: handleRefresh,
		onLogin: openLogin,
		onLogout: handleLogout,
	};

	// ModelsScreen node
	const screen = (
		<>
			<ModelDataLoader store={store} />
			<ModelsScreen
				snap={snap}
				active={activeProps}
				roles={rolesProps}
				agents={agentsProps}
				providers={providersProps}
				collapsed={collapsed}
				onToggleSection={toggleSection}
			/>
		</>
	);

	// ModelPickerSheet node
	const sheetProps: ModelPickerSheetProps = {
		open: pickerOpen,
		title: pickerTitle,
		browser: snap.browser,
		eligible: pickerEligible,
		current: pickerCurrent,
		mode: pickerMode,
		refreshing,
		onPick: handlePick,
		onClear: pickerMode.kind !== "active" ? handleClear : undefined,
		onRefresh: handleRefresh,
		onClose: close,
		onLogin: openLogin,
	};

	const sheet = <ModelPickerSheet {...sheetProps} />;

	const loginProvider = snap.loginStatus?.providers.find(
		p => p.id === snap.login?.providerId || p.storeCredentialsAs === snap.login?.providerId,
	);
	const loginProviderName = loginProvider?.name ?? snap.login?.providerId ?? "";

	const loginSheet = (
		<LoginSheet
			open={loginOpen && snap.login !== null}
			providerName={loginProviderName}
			url={snap.login?.url}
			instructions={snap.login?.instructions}
			progress={snap.login?.progress}
			pending={snap.login?.pending}
			result={snap.login?.result}
			onSubmitInput={submitLoginInput}
			onCancel={cancelLogin}
			onClose={closeLogin}
		/>
	);

	return {
		screen,
		sheet,
		loginSheet,
		openActivePicker,
		cycleRoleModel: handleCycle,
		close,
	};
}

/** Requests the deferred model, agent, and login data when the models screen mounts. */
function ModelDataLoader({ store }: { store: SessionStore | null }): null {
	useEffect(() => {
		if (!store) return;
		store.ensureModelData();
		store.ensureAgents();
		store.ensureLoginStatus();
	}, [store]);
	return null;
}
