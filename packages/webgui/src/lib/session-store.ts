/**
 * Framework-free external store for one attached RPC session.
 *
 * Designed for React's useSyncExternalStore but has no React dependency.
 * Subscribes to the client's event, state-change, and resync callbacks;
 * produces an immutable snapshot on every change.
 */

import type { RpcWebClient, RpcConnectionState, RpcSessionEvent, RpcResponseFor } from "./rpc-client";
import { RpcCommandError } from "./rpc-client";
import type {
	RpcSessionState,
	RpcAvailableSlashCommand,
	RpcModelRolesResult,
	RpcAgentsResult,
	RpcModelBrowserResult,
	RpcAgentInfo,
	RpcConfigUpdateFrame,
	RpcLoginStatusResult,
	RpcLoginEventFrame,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3Event, RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import type { TranscriptState } from "./transcript-model";
import type { SubagentTreeState } from "./subagent-model";
import {
	applyHistoryPage,
	applyV3Event,
	oldestEntryId,
	currentLeafId,
	applyTranscriptEvent,
	emptyTranscriptState,
	addPendingUser,
	clearPendingUser,
	clearAllPendingUser,
	resetTranscriptForResync,
} from "./transcript-model";
import {
	EMPTY_SUBAGENT_STATE,
	applySubagentEvent,
	mergeSubagentSnapshots,
	subagentTreeFromSnapshots,
} from "./subagent-model";
import type { ComposerDraft } from "./session-actions";
import { notify } from "./notify";

const HISTORY_PAGE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LoginPendingState {
	requestId: string;
	kind: "prompt" | "manual_input";
	message?: string;
	placeholder?: string;
	secret?: boolean;
	allowEmpty?: boolean;
}

export type LoginResultState =
	| { kind: "done"; identity?: string }
	| { kind: "failed"; error: string; cancelled: boolean };

export interface LoginFlowState {
	loginId: string;
	providerId: string;
	url?: string;
	instructions?: string;
	progress: string[];
	pending?: LoginPendingState;
	result?: LoginResultState;
}

export interface SessionSnapshot {
	connection: RpcConnectionState;
	transcript: TranscriptState;
	subagents: SubagentTreeState;
	sessionState: RpcSessionState | null;
	stats: SessionStats | null;
	commands: readonly RpcAvailableSlashCommand[];
	streaming: boolean;
	roles: RpcModelRolesResult | null;
	agents: RpcAgentsResult | null;
	browser: RpcModelBrowserResult | null;
	loginStatus: RpcLoginStatusResult | null;
	login: LoginFlowState | null;
	restoredDraft: ComposerDraft | null;
}

export interface SessionStore {
	getSnapshot(): SessionSnapshot;
	subscribe(listener: () => void): () => void;
	/** Show a submitted prompt immediately; the session's echo replaces it. */
	echoUser(text: string, images?: readonly string[]): void;
	clearPendingUser(): void;
	clearAllPendingUser(): void;
	restoreDraft(draft: ComposerDraft): void;
	clearRestoredDraft(): void;
	/** Fetch one older history page; concurrent calls share the request. */
	loadOlder(): Promise<void>;
	refreshModelConfig(): void;
	applyRoles(result: RpcModelRolesResult): void;
	applyAgent(info: RpcAgentInfo): void;
	applyBrowser(result: RpcModelBrowserResult): void;
	beginLogin(state: { loginId: string; providerId: string }): void;
	clearLogin(): void;
	applyLoginStatus(result: RpcLoginStatusResult): void;
	refreshLoginStatus(): void;
	dispose(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSessionStore(client: RpcWebClient): SessionStore {
	const listeners = new Set<() => void>();

	let transcript: TranscriptState = emptyTranscriptState();
	let subagents: SubagentTreeState = EMPTY_SUBAGENT_STATE;
	let connection: RpcConnectionState = client.state;
	let sessionState: RpcSessionState | null = client.sessionState;
	let stats: SessionStats | null = null;
	let commands: readonly RpcAvailableSlashCommand[] = [];
	let roles: RpcModelRolesResult | null = null;
	let agents: RpcAgentsResult | null = null;
	let browser: RpcModelBrowserResult | null = null;
	let loginStatus: RpcLoginStatusResult | null = null;
	let login: LoginFlowState | null = null;
	let disposed = false;
	let restoredDraft: ComposerDraft | null = null;

	// Avoid duplicate error toasts for the same message
	let lastErrorMsg = "";

	let snapshot: SessionSnapshot = buildSnapshot();

	function buildSnapshot(): SessionSnapshot {
		return {
			connection,
			transcript,
			subagents,
			sessionState,
			stats,
			commands,
			streaming: transcript.working || (sessionState?.isStreaming ?? false),
			roles,
			agents,
			browser,
			loginStatus,
			login,
			restoredDraft,
		};
	}
	function emit(): void {
		snapshot = buildSnapshot();
		for (const fn of listeners) fn();
	}

	function notifyOnce(msg: string): void {
		if (msg !== lastErrorMsg) {
			lastErrorMsg = msg;
			notify("error", msg);
		}
	}

	function fetchStats(): void {
		if (disposed) return;
		client
			.request({ type: "get_session_stats" })
			.then((resp: RpcResponseFor<"get_session_stats">) => {
				if (disposed) return;
				stats = resp.data;
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}

	function fetchCommands(): void {
		if (disposed) return;
		client
			.request({ type: "get_available_commands" })
			.then((resp: RpcResponseFor<"get_available_commands">) => {
				if (disposed) return;
				commands = resp.data.commands;
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}

	/** `merge` keeps agents this client saw finish; a resync replaces the tree outright. */
	function fetchSubagents(merge = false): void {
		if (disposed) return;
		client
			.request({ type: "get_subagents" })
			.then((resp: RpcResponseFor<"get_subagents">) => {
				if (disposed) return;
				subagents = merge
					? mergeSubagentSnapshots(subagents, resp.data.subagents)
					: subagentTreeFromSnapshots(resp.data.subagents);
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}
	function fetchSessionState(): void {
		if (disposed) return;
		client
			.request({ type: "get_state" })
			.then((resp: RpcResponseFor<"get_state">) => {
				if (disposed) return;
				sessionState = resp.data;
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}

	function fetchRoles(): void {
		if (disposed) return;
		client
			.request({ type: "get_model_roles" })
			.then((resp: RpcResponseFor<"get_model_roles">) => {
				if (disposed) return;
				roles = resp.data;
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}

	function fetchAgentsConfig(): void {
		if (disposed) return;
		client
			.request({ type: "get_agents" })
			.then((resp: RpcResponseFor<"get_agents">) => {
				if (disposed) return;
				agents = resp.data;
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}

	function fetchBrowser(): void {
		if (disposed) return;
		client
			.request({ type: "get_model_browser" })
			.then((resp: RpcResponseFor<"get_model_browser">) => {
				if (disposed) return;
				browser = resp.data;
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}

	function fetchLoginStatus(): void {
		if (disposed) return;
		client
			.request({ type: "get_login_status" })
			.then((resp: RpcResponseFor<"get_login_status">) => {
				if (disposed) return;
				loginStatus = resp.data;
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}

	// Debounced stats refresh: 500ms window collapses rapid turn_end/agent_end bursts
	let statsTimer: ReturnType<typeof setTimeout> | undefined;

	function scheduleStatsRefresh(): void {
		if (statsTimer !== undefined) return;
		statsTimer = setTimeout(() => {
			statsTimer = undefined;
			fetchStats();
		}, 500);
	}

	// The store may be created before connect() so an incompatible state can
	// reach the UI; requests sent before "ready" reject with
	// RpcClientClosedError, so attach-time fetches wait for the handshake.
	function initialFetches(): void {
		// The store is created before the handshake, so its sessionState starts
		// null; without this a mid-turn attach shows an idle composer until the
		// next turn_end.
		fetchSessionState();
		fetchStats();
		fetchCommands();
		fetchSubagents();
		fetchRoles();
		fetchAgentsConfig();
		fetchBrowser();
		fetchLoginStatus();
	}
	const V3_EVENT_TYPES: Record<string, true> = {
		msg_start: true,
		block_start: true,
		delta: true,
		block_end: true,
		msg_end: true,
		entry: true,
		branch: true,
		tool_output: true,
	};
	function isV3Event(event: RpcSessionEvent): event is RpcV3Event {
		return event.type in V3_EVENT_TYPES;
	}

	let activeLoadId = 0;
	let reloadInProgress = false;
	let reloadPending = false;

	function triggerReload(): void {
		if (disposed) return;
		const loadId = ++activeLoadId;
		if (reloadInProgress) {
			reloadPending = true;
			return;
		}
		void doReload(loadId);
	}

	async function doReload(loadId: number): Promise<void> {
		reloadInProgress = true;
		try {
			await runHistoryCycle(loadId);
		} finally {
			reloadInProgress = false;
			if (reloadPending && !disposed) {
				reloadPending = false;
				const nextLoadId = ++activeLoadId;
				void doReload(nextLoadId);
			}
		}
	}

	// Oversized pages (large images) exceed the relay's reassembly cap; halve
	// the page until it fits so one heavy entry cannot block the transcript.
	async function fetchHistoryPage(opts: {
		before?: string;
		leafId?: string;
		limit?: number;
	}): Promise<RpcV3HistoryResult> {
		let request = opts;
		for (;;) {
			try {
				return await client.history(request);
			} catch (err) {
				const limit = request.limit ?? HISTORY_PAGE_LIMIT;
				const tooLarge = err instanceof Error && err.message.includes("exceeded the transport limit");
				if (!tooLarge || limit <= 1 || disposed) throw err;
				request = { ...request, limit: Math.max(1, Math.floor(limit / 2)) };
			}
		}
	}

	async function runHistoryCycle(loadId: number): Promise<void> {
		if (disposed || loadId !== activeLoadId) return;

		let newestPage: RpcV3HistoryResult;
		try {
			newestPage = await fetchHistoryPage({});
		} catch (err) {
			if (disposed || loadId !== activeLoadId) return;
			notifyOnce(err instanceof Error ? err.message : String(err));
			return;
		}

		if (disposed || loadId !== activeLoadId) return;
		transcript = applyHistoryPage(transcript, newestPage, { older: false });
		emit();
	}

	let olderInFlight: Promise<void> | undefined;

	async function fetchOlderPage(): Promise<void> {
		const loadId = activeLoadId;
		// A reload replaces the page set; paging from a stale oldest id would splice
		// pages from the previous branch.
		if (disposed || reloadInProgress || transcript.needsReload || !transcript.hasMore) return;
		const before = oldestEntryId(transcript);
		if (!before) return;
		const leafId = currentLeafId(transcript) ?? undefined;

		let olderPage: RpcV3HistoryResult;
		try {
			olderPage = await fetchHistoryPage({ before, leafId, limit: HISTORY_PAGE_LIMIT });
		} catch (err) {
			if (disposed || loadId !== activeLoadId) return;
			const isBranchChanged =
				(err instanceof RpcCommandError && err.code === "branch_changed") ||
				(err instanceof Error && err.message.includes("branch_changed"));
			if (isBranchChanged) {
				triggerReload();
				return;
			}
			notifyOnce(err instanceof Error ? err.message : String(err));
			return;
		}

		if (disposed || loadId !== activeLoadId || oldestEntryId(transcript) !== before) return;
		transcript = applyHistoryPage(transcript, olderPage, { older: true });
		emit();
	}

	let initialLoaded = false;
	if (client.state === "ready") {
		initialLoaded = true;
		initialFetches();
		triggerReload();
	}
	const unsubEvent = client.onEvent((event: RpcSessionEvent) => {
		const frame = event as { type: string; commands?: RpcAvailableSlashCommand[] };

		// available_commands_update arrives through the event stream
		if (frame.type === "available_commands_update" && frame.commands) {
			commands = frame.commands;
		}

		if (frame.type === "agent_start") {
			if (sessionState) sessionState = { ...sessionState, isStreaming: true };
		}
		if (frame.type === "agent_end") {
			if (sessionState) sessionState = { ...sessionState, isStreaming: false };
		}
		if (frame.type === "auto_compaction_start") {
			if (sessionState) sessionState = { ...sessionState, isCompacting: true };
		}
		if (frame.type === "auto_compaction_end") {
			if (sessionState) sessionState = { ...sessionState, isCompacting: false };
		}

		if (frame.type === "login_event") {
			const loginFrame = event as unknown as RpcLoginEventFrame;
			if (login && login.loginId === loginFrame.loginId) {
				const ev = loginFrame.event;
				if (ev.kind === "auth") {
					login = {
						...login,
						url: ev.url,
						instructions: ev.instructions,
					};
				} else if (ev.kind === "progress") {
					login = {
						...login,
						progress: [...login.progress, ev.message],
					};
				} else if (ev.kind === "prompt") {
					login = {
						...login,
						pending: {
							requestId: ev.requestId,
							kind: "prompt",
							message: ev.message,
							placeholder: ev.placeholder,
							secret: ev.secret,
							allowEmpty: ev.allowEmpty,
						},
					};
				} else if (ev.kind === "manual_input") {
					login = {
						...login,
						pending: {
							requestId: ev.requestId,
							kind: "manual_input",
						},
					};
				} else if (ev.kind === "done") {
					login = {
						...login,
						pending: undefined,
						result: {
							kind: "done",
							identity: ev.identity,
						},
					};
				} else if (ev.kind === "failed") {
					login = {
						...login,
						pending: undefined,
						result: {
							kind: "failed",
							error: ev.error,
							cancelled: ev.cancelled,
						},
					};
				}
				emit();
			}
		}

		if (isV3Event(event)) {
			const wasNeedsReload = transcript.needsReload;
			transcript = applyV3Event(transcript, event);
			if (frame.type === "branch" || (!wasNeedsReload && transcript.needsReload)) {
				triggerReload();
			}
		} else {
			transcript = applyTranscriptEvent(transcript, event);
		}
		subagents = applySubagentEvent(subagents, event);
		emit();

		if (frame.type === "turn_end" || frame.type === "agent_end") {
			scheduleStatsRefresh();
			fetchSessionState();
			fetchSubagents(true);
		}
		if (
			frame.type === "model_changed" ||
			frame.type === "thinking_level_changed" ||
			frame.type === "session_info_update"
		) {
			fetchSessionState();
			if (frame.type === "model_changed") {
				fetchRoles();
			}
		}
		if (frame.type === "config_update") {
			fetchSessionState();
			const cu = frame as unknown as RpcConfigUpdateFrame;
			if (cu.models || cu.modelRoles || cu.model) fetchRoles();
			if (cu.models || cu.modelRoles) fetchBrowser();
			if (cu.agents || cu.model) fetchAgentsConfig();
			if (cu.models) fetchLoginStatus();
		}
	});

	const unsubState = client.onStateChange((state: RpcConnectionState) => {
		connection = state;
		emit();
		if (!initialLoaded && state === "ready") {
			initialLoaded = true;
			initialFetches();
			triggerReload();
		}
	});

	const unsubResync = client.onResync((state: RpcSessionState) => {
		if (state) sessionState = state;
		transcript = resetTranscriptForResync(transcript);
		if (login && !login.result) {
			login = {
				...login,
				pending: undefined,
				result: { kind: "failed", error: "Connection lost", cancelled: true },
			};
		}
		emit();
		fetchSubagents();
		fetchStats();
		fetchCommands();
		fetchRoles();
		fetchAgentsConfig();
		fetchBrowser();
		fetchLoginStatus();
		triggerReload();
	});

	return {
		loadOlder(): Promise<void> {
			olderInFlight ??= fetchOlderPage().finally(() => {
				olderInFlight = undefined;
			});
			return olderInFlight;
		},
		getSnapshot(): SessionSnapshot {
			return snapshot;
		},

		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		echoUser(text: string, images?: readonly string[]): void {
			transcript = addPendingUser(transcript, text, images);
			emit();
		},
		clearPendingUser(): void {
			transcript = clearPendingUser(transcript);
			emit();
		},
		clearAllPendingUser(): void {
			transcript = clearAllPendingUser(transcript);
			emit();
		},
		restoreDraft(draft: ComposerDraft): void {
			restoredDraft = draft;
			emit();
		},
		clearRestoredDraft(): void {
			if (!restoredDraft) return;
			restoredDraft = null;
			emit();
		},
		refreshModelConfig(): void {
			fetchRoles();
			fetchAgentsConfig();
			fetchBrowser();
		},
		applyRoles(result: RpcModelRolesResult): void {
			roles = result;
			emit();
		},
		applyAgent(info: RpcAgentInfo): void {
			if (!agents) return;
			agents = {
				...agents,
				agents: agents.agents.map(a => (a.name === info.name ? info : a)),
			};
			emit();
		},
		applyBrowser(result: RpcModelBrowserResult): void {
			browser = result;
			emit();
		},
		beginLogin(state: { loginId: string; providerId: string }): void {
			login = {
				loginId: state.loginId,
				providerId: state.providerId,
				progress: [],
			};
			emit();
		},
		clearLogin(): void {
			login = null;
			emit();
		},
		applyLoginStatus(result: RpcLoginStatusResult): void {
			loginStatus = result;
			emit();
		},
		refreshLoginStatus(): void {
			fetchLoginStatus();
		},

		dispose(): void {
			disposed = true;
			activeLoadId++;
			if (statsTimer !== undefined) {
				clearTimeout(statsTimer);
				statsTimer = undefined;
			}
			unsubEvent();
			unsubState();
			unsubResync();
			listeners.clear();
		},
	};
}
