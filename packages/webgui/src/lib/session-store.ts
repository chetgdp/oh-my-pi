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
	RpcBtwEventFrame,
	RpcPlanState,
	RpcPlanReview,
	RpcPlanStateFrame,
	RpcPlanReviewFrame,
	RpcPlanReviewAction,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3Event, RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import type { TranscriptState } from "./transcript-model";
import type { SubagentTreeState } from "./subagent-model";
import type { AgentHubState } from "./agent-hub-model";
import {
	applyFocusChunk,
	applyFocusEvent,
	applyFocusSnapshot,
	detachMessage,
	eventPersistsEntries,
	type FocusDetachReason,
	type FocusState,
	type FocusWatch,
	initialFocusWatch,
	isFocusable,
	resetFocusCursor,
	startFocus,
	viewingMessage,
	watchFocusedAgent,
} from "./focus-model";
import {
	EMPTY_AGENT_HUB_STATE,
	MAIN_AGENT_ID,
	applyRegistryFrame,
	applyRoster,
	applySubagentLifecycle,
	applySubagentProgress,
} from "./agent-hub-model";
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
import { browserWindow } from "./dom";
import { extractTodoPhasesFromEvent, getLatestTodoPhasesFromEntries, type TodoPhase } from "./todo-model";

/** Cadence of the safety poll while an agent is focused; events trigger earlier polls. */
const FOCUS_POLL_MS = 3000;
/** Delay between an event that persists entries and the poll that reads them. */
const FOCUS_EVENT_POLL_MS = 150;
const HISTORY_PAGE_LIMIT = 50;
/** Deadline for the post-attach idle prefetch; setTimeout delay when requestIdleCallback is absent. */
const IDLE_PREFETCH_TIMEOUT_MS = 2000;
const IDLE_PREFETCH_FALLBACK_MS = 300;

function scheduleIdle(fn: () => void): () => void {
	const { requestIdleCallback, cancelIdleCallback } = browserWindow;
	if (requestIdleCallback && cancelIdleCallback) {
		const handle = requestIdleCallback(() => fn(), { timeout: IDLE_PREFETCH_TIMEOUT_MS });
		return () => cancelIdleCallback(handle);
	}
	const timer = setTimeout(fn, IDLE_PREFETCH_FALLBACK_MS);
	return () => clearTimeout(timer);
}

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

/** The subagent session shown in place of the main transcript (TUI focus). */
export interface BtwState {
	btwId: string;
	agentId: string;
	question: string;
	answer: string;
	status: "running" | "complete" | "error" | "cancelled";
	error?: string;
	followUpOf?: string;
}

export interface FocusSnapshot {
	agentId: string;
	transcript: TranscriptState;
	/** True once revive (when the agent was parked) finished and the transcript cursor is running. */
	ready: boolean;
	/** Transcript chunk loaded at least once. */
	loaded: boolean;
	error: string | null;
	/** The agent's latest todo phases (TUI canonical rule over its saved entries); read-only, never sent via `set_todos`. */
	todoPhases: readonly TodoPhase[];
}

/** The focused agent was dropped without the user asking (gone, parked, aborted, focus failed). */
export interface FocusDetachNotice {
	agentId: string;
	message: string;
	nonce: number;
}

export interface SessionSnapshot {
	historyLoaded: boolean;
	connection: RpcConnectionState;
	transcript: TranscriptState;
	subagents: SubagentTreeState;
	/** Agent Hub roster; empty until the hub has been opened or an agent focused on this connection. */
	hub: AgentHubState;
	/** Focused subagent view; null while Main is shown. */
	focus: FocusSnapshot | null;
	/** Set when the focused agent was dropped without the user asking; the shell navigates back to Main. */
	focusDetach: FocusDetachNotice | null;
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
	planState: RpcPlanState | null;
	planReview: RpcPlanReview | null;
	btw: BtwState | null;
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
	/** Deliver pending listener notifications now instead of at the next frame. */
	flushNotifications(): void;
	/** Fetch roles and the model browser once per connection; config pushes refresh them. */
	ensureModelData(): void;
	/** Fetch the agents config once per connection; config pushes refresh it. */
	ensureAgents(): void;
	/**
	 * Agent Hub visibility. Open subscribes to registry frames and fetches the
	 * roster (re-done after every reconnect); close unsubscribes. Idempotent.
	 */
	setHubOpen(open: boolean): void;
	/** Pinned Subagents list visibility; holds the roster like the hub does, so finished agents stay listed. */
	setPinnedOpen(open: boolean): void;
	/**
	 * Focus the main view on a subagent (TUI `focusAgent`): revives a parked agent, streams its
	 * transcript and events. A newer request supersedes an older one still in flight.
	 */
	focusAgent(agentId: string): Promise<void>;
	/** Return to Main. No-op when unfocused. */
	unfocus(): void;
	/** Fetch provider login status once per connection; config pushes refresh it. */
	ensureLoginStatus(): void;
	refreshModelConfig(): void;
	refreshSessionState(): void;
	applyRoles(result: RpcModelRolesResult): void;
	applyAgent(info: RpcAgentInfo): void;
	applyBrowser(result: RpcModelBrowserResult): void;
	beginLogin(state: { loginId: string; providerId: string }): void;
	clearLogin(): void;
	applyLoginStatus(result: RpcLoginStatusResult): void;
	refreshLoginStatus(): void;
	setTodos(phases: TodoPhase[]): Promise<void>;
	refreshPlanState(): void;
	setPlanMode(enabled: boolean): Promise<void>;
	approvePlan(reviewId: string, action: RpcPlanReviewAction, feedback?: string): Promise<void>;
	startBtw(state: {
		btwId: string;
		agentId: string;
		question: string;
		followUpOf?: string;
		initialAnswer?: string;
		status?: "running" | "complete" | "error" | "cancelled";
	}): void;
	clearBtw(): void;
	dispose(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSessionStore(client: RpcWebClient): SessionStore {
	const listeners = new Set<() => void>();

	let transcript: TranscriptState = emptyTranscriptState();
	let subagents: SubagentTreeState = EMPTY_SUBAGENT_STATE;
	let hub: AgentHubState = EMPTY_AGENT_HUB_STATE;
	let hubOpen = false;
	let pinnedOpen = false;
	let rosterSubscribed = false;
	let focus: FocusState | null = null;
	let focusReady = false;
	let focusWatch: FocusWatch = { sawLive: false };
	let focusSeq = 0;
	/** Identifies the latest `set_subagent_subscription`; bumped on leave/refocus so stale snapshots are dropped. */
	let focusSubscribeToken = 0;
	let focusError: string | null = null;
	let focusDetach: FocusDetachNotice | null = null;
	let focusPollInFlight = false;
	let focusPollDirty = false;
	let focusPollTimer: ReturnType<typeof setInterval> | undefined;
	let focusEventTimer: ReturnType<typeof setTimeout> | undefined;
	/** Focus requested before the handshake finished (deep link / reload); resumed once ready. */
	let deferredFocus: string | undefined;
	let connection: RpcConnectionState = client.state;
	let sessionState: RpcSessionState | null = client.sessionState;
	let stats: SessionStats | null = null;
	let commands: readonly RpcAvailableSlashCommand[] = [];
	let roles: RpcModelRolesResult | null = null;
	let agents: RpcAgentsResult | null = null;
	let browser: RpcModelBrowserResult | null = null;
	let loginStatus: RpcLoginStatusResult | null = null;
	let login: LoginFlowState | null = null;
	let historyLoaded = false;
	let disposed = false;
	let restoredDraft: ComposerDraft | null = null;
	let planState: RpcPlanState | null = null;
	let planReview: RpcPlanReview | null = null;
	let btw: BtwState | null = null;

	// Avoid duplicate error toasts for the same message
	let lastErrorMsg = "";

	let snapshot: SessionSnapshot = buildSnapshot();

	// Todo phases are re-derived only when the focused transcript's entries array is replaced
	// (applyFocusChunk keeps the reference while nothing new was saved), never per snapshot.
	let focusTodoSource: readonly unknown[] | undefined;
	let focusTodoPhases: readonly TodoPhase[] = [];
	function focusedTodoPhases(entries: readonly unknown[]): readonly TodoPhase[] {
		if (entries !== focusTodoSource) {
			focusTodoSource = entries;
			focusTodoPhases = getLatestTodoPhasesFromEntries(entries);
		}
		return focusTodoPhases;
	}

	function buildSnapshot(): SessionSnapshot {
		return {
			historyLoaded,
			connection,
			transcript,
			subagents,
			hub,
			focus: focus
				? {
						agentId: focus.agentId,
						transcript: focus.transcript,
						ready: focusReady,
						loaded: focus.loaded,
						error: focusError,
						todoPhases: focusedTodoPhases(focus.transcript.entries),
					}
				: null,
			focusDetach,
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
			planState,
			planReview,
			btw,
		};
	}
	// Snapshot updates synchronously so getSnapshot() is never stale; listeners
	// run once per frame so bursts of stream deltas cost one render.
	let notifyScheduled = false;
	function flushNotifications(): void {
		if (!notifyScheduled) return;
		notifyScheduled = false;
		for (const fn of listeners) fn();
	}
	function emit(): void {
		snapshot = buildSnapshot();
		if (notifyScheduled || disposed) return;
		notifyScheduled = true;
		if (typeof globalThis.requestAnimationFrame === "function") {
			globalThis.requestAnimationFrame(flushNotifications);
		} else {
			queueMicrotask(flushNotifications);
		}
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
	function rosterWanted(): boolean {
		return hubOpen || pinnedOpen || focus !== null;
	}
	/** Subscribe first so nothing between the snapshot and the first frame is lost. */
	function startHub(force = false): Promise<void> {
		if (disposed || !rosterWanted() || client.state !== "ready") return Promise.resolve();
		if (!rosterSubscribed || force) {
			rosterSubscribed = true;
			client.request({ type: "set_agent_roster_subscription", enabled: true }).catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
		}
		return client
			.request({ type: "get_agent_roster" })
			.then((resp: RpcResponseFor<"get_agent_roster">) => {
				if (disposed || !rosterWanted()) return;
				hub = applyRoster(hub, resp.data.agents);
				emit();
				checkFocusWatch();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}
	function releaseRoster(): void {
		if (rosterWanted() || !rosterSubscribed) return;
		rosterSubscribed = false;
		if (client.state === "ready") {
			client.request({ type: "set_agent_roster_subscription", enabled: false }).catch(() => {});
		}
	}
	function setHubOpen(open: boolean): void {
		if (open === hubOpen || disposed) return;
		hubOpen = open;
		if (open) {
			void startHub();
			return;
		}
		releaseRoster();
	}
	function setPinnedOpen(open: boolean): void {
		if (open === pinnedOpen || disposed) return;
		pinnedOpen = open;
		if (open) {
			void startHub();
			return;
		}
		releaseRoster();
	}

	// ---- Focused agent ----------------------------------------------------
	function stopFocusTimers(): void {
		if (focusPollTimer !== undefined) clearInterval(focusPollTimer);
		if (focusEventTimer !== undefined) clearTimeout(focusEventTimer);
		focusPollTimer = undefined;
		focusEventTimer = undefined;
	}
	function resetSubagentSubscription(): void {
		if (client.state === "ready") {
			client.request({ type: "set_subagent_subscription", level: "progress" }).catch(() => {});
		}
	}
	function subscribeFocusEvents(agentId: string): void {
		const token = ++focusSubscribeToken;
		client
			.request({ type: "set_subagent_subscription", level: "events", ids: [agentId] })
			.then((resp: RpcResponseFor<"set_subagent_subscription">) => {
				// The host subscribed before snapshotting, so every later frame follows this response in order.
				// The token is bumped by every subscribe and by clearFocus/focusAgent, so a response that outlived
				// its focus (or was superseded by a re-subscribe after reconnect) is dropped.
				if (disposed || !focus || token !== focusSubscribeToken || focus.agentId !== agentId) return;
				const snapshot = resp.data?.snapshots?.[agentId];
				if (!snapshot) return;
				focus = applyFocusSnapshot(focus, snapshot);
				emit();
			})
			.catch((err: Error) => {
				if (!disposed) notifyOnce(err.message);
			});
	}
	function clearFocus(): void {
		const wasReady = focusReady;
		stopFocusTimers();
		focusSubscribeToken++;
		focus = null;
		deferredFocus = undefined;
		focusReady = false;
		focusError = null;
		focusPollDirty = false;
		if (wasReady) resetSubagentSubscription();
		releaseRoster();
	}
	function detachFocus(agentId: string, message: string): void {
		clearFocus();
		focusDetach = { agentId, message, nonce: (focusDetach?.nonce ?? 0) + 1 };
		notify("info", message);
		emit();
	}
	function checkFocusWatch(): void {
		if (!focus || !focusReady) return;
		const next = watchFocusedAgent(focusWatch, hub.agents.get(focus.agentId));
		focusWatch = next.watch;
		if (next.detach)
			detachFocus(focus.agentId, detachMessage(focus.agentId, next.detach satisfies FocusDetachReason));
	}
	async function pollFocus(): Promise<void> {
		const seq = focus?.seq;
		if (seq === undefined || !focusReady || disposed) return;
		if (focusPollInFlight) {
			focusPollDirty = true;
			return;
		}
		focusPollInFlight = true;
		try {
			do {
				focusPollDirty = false;
				const current = focus;
				if (!current || current.seq !== seq) return;
				const resp = await client.request({
					type: "get_subagent_messages",
					subagentId: current.agentId,
					fromByte: current.cursor.nextByte,
					fileId: current.cursor.fileId,
					sentinel: current.cursor.sentinel,
				});
				if (disposed || !focus || focus.seq !== seq) return;
				focus = applyFocusChunk(focus, resp.data);
				focusError = null;
				// A reset chunk cleared the cursor; the whole file has to be refetched from byte 0.
				if (focus.cursor.nextByte === 0 && resp.data.fromByte !== 0) focusPollDirty = true;
				emit();
			} while (focusPollDirty);
		} catch (err) {
			if (!disposed && focus?.seq === seq) {
				focusError = err instanceof Error ? err.message : String(err);
				focus = { ...focus, loaded: true };
				emit();
			}
		} finally {
			focusPollInFlight = false;
		}
	}
	function scheduleFocusPoll(): void {
		if (focusEventTimer !== undefined) return;
		focusEventTimer = setTimeout(() => {
			focusEventTimer = undefined;
			void pollFocus();
		}, FOCUS_EVENT_POLL_MS);
	}
	function failFocus(agentId: string, message: string): void {
		clearFocus();
		focusDetach = { agentId, message, nonce: (focusDetach?.nonce ?? 0) + 1 };
		notify("error", message);
		emit();
	}
	async function focusAgent(id: string): Promise<void> {
		if (disposed) return;
		if (id === MAIN_AGENT_ID) {
			unfocus();
			return;
		}
		// Reaffirming the current agent must win over an older still-reviving request.
		if (focus?.agentId === id && focusReady) {
			focusSeq++;
			focus = { ...focus, seq: focusSeq };
			return;
		}
		const request = ++focusSeq;
		stopFocusTimers();
		if (focusReady) resetSubagentSubscription();
		focusReady = false;
		focusError = null;
		focusDetach = null;
		focusSubscribeToken++;
		focus = startFocus(id, request, hub.agents.get(id)?.status === "running");
		emit();
		if (client.state !== "ready") {
			deferredFocus = id;
			return;
		}
		// Always refresh: the hub may have released the roster subscription on its way out, and a cached roster can be stale.
		await startHub();
		if (request === focusSeq && !disposed && !hub.loaded) {
			failFocus(id, "Agent roster unavailable");
			return;
		}
		if (request !== focusSeq || disposed) return;
		const entry = hub.agents.get(id);
		if (!entry || !isFocusable(entry)) {
			const why =
				entry === undefined
					? `Agent ${id} is gone`
					: entry.kind !== "sub"
						? `Agent ${id} is read-only; open it in the Agent Hub`
						: `Agent ${id} is aborted`;
			failFocus(id, why);
			return;
		}
		if (entry.status === "parked") {
			try {
				await client.request({ type: "revive_agent", agentId: id });
			} catch (err) {
				// A newer request owns the view; a stale revive failure must not surface.
				if (request !== focusSeq || disposed) return;
				failFocus(id, err instanceof Error ? err.message : String(err));
				return;
			}
			if (request !== focusSeq || disposed) return;
		}
		const live = hub.agents.get(id);
		focusWatch = initialFocusWatch(live);
		focus = { ...focus!, transcript: { ...focus!.transcript, working: live?.status === "running" } };
		focusReady = true;
		subscribeFocusEvents(id);
		focusPollTimer = setInterval(() => void pollFocus(), FOCUS_POLL_MS);
		notify("info", viewingMessage(id));
		emit();
		void pollFocus();
	}
	function unfocus(): void {
		// Leaving Main-ward explicitly cancels pending focus requests.
		focusSeq++;
		if (!focus) return;
		clearFocus();
		notify("info", "Returned to main session");
		emit();
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

	function fetchPlanState(): void {
		if (disposed) return;
		client
			.request({ type: "get_plan_state" })
			.then((resp: RpcResponseFor<"get_plan_state">) => {
				if (disposed) return;
				if (resp.data) {
					planState = resp.data.state ?? null;
					planReview = resp.data.review ?? null;
					emit();
				}
			})
			.catch((err: Error) => {
				// Hosts started before plan-mode RPC existed; the chip stays hidden.
				if (err instanceof RpcCommandError && err.message.endsWith("Unknown command: get_plan_state")) return;
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

	// Deferred model/agent/login data: fetched on demand (screen or picker mount)
	// or on idle after first paint; reset per connection so a resync refetches.
	let modelDataRequested = false;
	let agentsRequested = false;
	let loginStatusRequested = false;
	function ensureModelData(): void {
		if (modelDataRequested || disposed || client.state !== "ready") return;
		modelDataRequested = true;
		fetchRoles();
		fetchBrowser();
	}
	function ensureAgents(): void {
		if (agentsRequested || disposed || client.state !== "ready") return;
		agentsRequested = true;
		fetchAgentsConfig();
	}
	function ensureLoginStatus(): void {
		if (loginStatusRequested || disposed || client.state !== "ready") return;
		loginStatusRequested = true;
		fetchLoginStatus();
	}

	let cancelIdlePrefetch: (() => void) | undefined;
	function scheduleIdlePrefetch(): void {
		cancelIdlePrefetch?.();
		cancelIdlePrefetch = scheduleIdle(() => {
			cancelIdlePrefetch = undefined;
			ensureModelData();
			ensureAgents();
			ensureLoginStatus();
		});
	}

	// The host pushes available_commands_update before it reads any request, so
	// the push precedes the history response; request only when it did not come.
	let commandsPushed = false;
	let postHistoryPending = false;

	// The store may be created before connect() so an incompatible state can
	// reach the UI; requests sent before "ready" reject with
	// RpcClientClosedError, so attach-time fetches wait for the handshake.
	// History goes first: the host answers strictly in order.
	function attach(): void {
		postHistoryPending = true;
		triggerReload();
		// The store is created before the handshake, so its sessionState starts
		// null; without this a mid-turn attach shows an idle composer until the
		// next turn_end.
		fetchSessionState();
		fetchStats();
		fetchPlanState();
		fetchSubagents();
		void startHub();
		if (deferredFocus !== undefined) {
			const id = deferredFocus;
			deferredFocus = undefined;
			void focusAgent(id);
		}
	}

	function afterFirstHistory(): void {
		if (!postHistoryPending) return;
		postHistoryPending = false;
		if (!commandsPushed) fetchCommands();
		scheduleIdlePrefetch();
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
		historyLoaded = false;
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
			emit();
			afterFirstHistory();
			return;
		}

		if (disposed || loadId !== activeLoadId) return;
		transcript = applyHistoryPage(transcript, newestPage, { older: false });
		historyLoaded = true;
		emit();
		afterFirstHistory();
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
		const loadedIds = new Set(transcript.entries.map(e => e.id));
		const overlap = olderPage.entries.find(e => e.id === before || loadedIds.has(e.id));
		if (overlap) {
			notifyOnce(`History page before ${before} overlaps loaded entry ${overlap.id}`);
			return;
		}
		transcript = applyHistoryPage(transcript, olderPage, { older: true });
		emit();
	}

	let initialLoaded = false;
	if (client.state === "ready") {
		initialLoaded = true;
		attach();
	}
	const unsubEvent = client.onEvent((event: RpcSessionEvent) => {
		const frame = event as { type: string; commands?: RpcAvailableSlashCommand[] };

		// available_commands_update arrives through the event stream
		if (frame.type === "available_commands_update" && frame.commands) {
			commands = frame.commands;
			commandsPushed = true;
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
		if (frame.type === "btw_event") {
			const btwFrame = event as unknown as RpcBtwEventFrame;
			if (btw && btw.btwId === btwFrame.btwId) {
				const ev = btwFrame.event;
				if (ev.kind === "delta") {
					btw = {
						...btw,
						answer: btw.answer + ev.text,
					};
				} else if (ev.kind === "done") {
					btw = {
						...btw,
						answer: ev.text,
						status: "complete",
					};
				} else if (ev.kind === "error") {
					btw = {
						...btw,
						status: "error",
						error: ev.message,
					};
				} else if (ev.kind === "cancelled") {
					btw = {
						...btw,
						status: "cancelled",
					};
				}
				emit();
			}
		}

		if (isV3Event(event)) {
			const wasNeedsReload = transcript.needsReload;
			transcript = applyV3Event(transcript, event);
			if (frame.type === "branch" || (!wasNeedsReload && transcript.needsReload)) {
				historyLoaded = false;
				triggerReload();
			}
		} else {
			transcript = applyTranscriptEvent(transcript, event);
		}
		subagents = applySubagentEvent(subagents, event);
		if (event.type === "agent_registry") {
			hub = applyRegistryFrame(hub, event);
		} else if (hub.loaded && event.type === "subagent_progress") {
			hub = applySubagentProgress(hub, event.payload);
		} else if (hub.loaded && event.type === "subagent_lifecycle") {
			hub = applySubagentLifecycle(hub, event.payload);
		}
		// Only registry frames drive detach: progress-derived statuses (a finished turn reads "completed") are not registry state.
		const registryId =
			event.type === "agent_registry" ? (event.op === "removed" ? event.id : event.agent.id) : undefined;
		if (event.type === "subagent_event" && focus && focusReady && event.payload.id === focus.agentId) {
			focus = applyFocusEvent(focus, event.payload.event);
			if (eventPersistsEntries(event.payload.event)) scheduleFocusPoll();
		}
		const pushedPhases = extractTodoPhasesFromEvent(event);
		if (pushedPhases !== undefined) {
			if (sessionState) sessionState = { ...sessionState, todoPhases: pushedPhases };
		}
		if (frame.type === "plan_state") {
			planState = (frame as unknown as RpcPlanStateFrame).state;
		}
		if (frame.type === "plan_review") {
			planReview = (frame as unknown as RpcPlanReviewFrame).review;
		}
		emit();
		if (registryId !== undefined && registryId === focus?.agentId) checkFocusWatch();

		if (frame.type === "turn_end" || frame.type === "agent_end") {
			scheduleStatsRefresh();
			fetchSessionState();
			fetchSubagents(true);
			fetchPlanState();
		}
		if (
			frame.type === "model_changed" ||
			frame.type === "thinking_level_changed" ||
			frame.type === "session_info_update"
		) {
			fetchSessionState();
			if (frame.type === "model_changed" && modelDataRequested) {
				fetchRoles();
			}
		}
		if (frame.type === "config_update") {
			fetchSessionState();
			const cu = frame as unknown as RpcConfigUpdateFrame;
			if (modelDataRequested && (cu.models || cu.modelRoles || cu.model)) fetchRoles();
			if (modelDataRequested && (cu.models || cu.modelRoles)) fetchBrowser();
			if (agentsRequested && (cu.agents || cu.model)) fetchAgentsConfig();
			if (loginStatusRequested && cu.models) fetchLoginStatus();
		}
	});

	const unsubState = client.onStateChange((state: RpcConnectionState) => {
		connection = state;
		emit();
		if (!initialLoaded && state === "ready") {
			initialLoaded = true;
			attach();
		}
	});

	const unsubResync = client.onResync((state: RpcSessionState) => {
		if (state) sessionState = state;
		if (login && !login.result) {
			login = {
				...login,
				pending: undefined,
				result: { kind: "failed", error: "Connection lost", cancelled: true },
			};
			emit();
		}
		historyLoaded = false;
		transcript = resetTranscriptForResync(transcript);
		commandsPushed = false;
		const hadModelData = modelDataRequested;
		const hadAgents = agentsRequested;
		const hadLoginStatus = loginStatusRequested;
		modelDataRequested = false;
		agentsRequested = false;
		loginStatusRequested = false;
		postHistoryPending = true;
		triggerReload();
		fetchSubagents();
		fetchStats();
		fetchPlanState();
		rosterSubscribed = false;
		void startHub(true);
		if (focus && focusReady) {
			// The host forgot this connection's subscription and the transcript file may have been replaced.
			focus = resetFocusCursor(focus);
			subscribeFocusEvents(focus.agentId);
			void pollFocus();
		}
		// Mounted screens asked for this data; refetch it for the new connection.
		if (hadModelData) ensureModelData();
		if (hadAgents) ensureAgents();
		if (hadLoginStatus) ensureLoginStatus();
	});

	return {
		loadOlder(): Promise<void> {
			olderInFlight ??= fetchOlderPage().finally(() => {
				olderInFlight = undefined;
			});
			return olderInFlight;
		},
		flushNotifications,
		ensureModelData,
		ensureAgents,
		setHubOpen,
		setPinnedOpen,
		focusAgent,
		unfocus,
		ensureLoginStatus,
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
			if (focus) focus = { ...focus, transcript: addPendingUser(focus.transcript, text, images) };
			else transcript = addPendingUser(transcript, text, images);
			emit();
		},
		clearPendingUser(): void {
			if (focus) focus = { ...focus, transcript: clearPendingUser(focus.transcript) };
			else transcript = clearPendingUser(transcript);
			emit();
		},
		clearAllPendingUser(): void {
			if (focus) focus = { ...focus, transcript: clearAllPendingUser(focus.transcript) };
			else transcript = clearAllPendingUser(transcript);
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
			modelDataRequested = true;
			agentsRequested = true;
			fetchRoles();
			fetchAgentsConfig();
			fetchBrowser();
		},
		refreshSessionState(): void {
			fetchSessionState();
			fetchPlanState();
		},
		refreshPlanState(): void {
			fetchPlanState();
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
		startBtw(state: {
			btwId: string;
			agentId: string;
			question: string;
			followUpOf?: string;
			initialAnswer?: string;
			status?: "running" | "complete" | "error" | "cancelled";
		}): void {
			btw = {
				btwId: state.btwId,
				agentId: state.agentId,
				question: state.question,
				answer: state.initialAnswer ?? "",
				status: state.status ?? "running",
				...(state.followUpOf ? { followUpOf: state.followUpOf } : {}),
			};
			emit();
		},
		clearBtw(): void {
			btw = null;
			emit();
		},
		applyLoginStatus(result: RpcLoginStatusResult): void {
			loginStatus = result;
			emit();
		},
		refreshLoginStatus(): void {
			loginStatusRequested = true;
			fetchLoginStatus();
		},
		async setTodos(phases: TodoPhase[]): Promise<void> {
			if (disposed) return;
			if (sessionState) {
				sessionState = { ...sessionState, todoPhases: phases };
				emit();
			}
			try {
				const resp = await client.request({ type: "set_todos", phases });
				if (resp.data?.todoPhases) {
					if (sessionState) {
						sessionState = { ...sessionState, todoPhases: resp.data.todoPhases };
					}
					emit();
				}
			} catch (err) {
				notifyOnce(err instanceof Error ? err.message : String(err));
				throw err;
			} finally {
				fetchSessionState();
			}
		},
		async setPlanMode(enabled: boolean): Promise<void> {
			if (disposed) return;
			try {
				const resp = await client.request({ type: "set_plan_mode", enabled });
				if (resp.data?.state) {
					planState = resp.data.state;
					emit();
				}
			} catch (err) {
				notifyOnce(err instanceof Error ? err.message : String(err));
				throw err;
			}
		},
		async approvePlan(reviewId: string, action: RpcPlanReviewAction, feedback?: string): Promise<void> {
			if (disposed) return;
			try {
				const resp = await client.request(
					feedback !== undefined
						? { type: "approve_plan", reviewId, action, feedback }
						: { type: "approve_plan", reviewId, action },
				);
				if (resp.data?.state) {
					planState = resp.data.state;
					emit();
				}
			} catch (err) {
				notifyOnce(err instanceof Error ? err.message : String(err));
				throw err;
			}
		},

		dispose(): void {
			disposed = true;
			stopFocusTimers();
			activeLoadId++;
			if (statsTimer !== undefined) {
				clearTimeout(statsTimer);
				statsTimer = undefined;
			}
			cancelIdlePrefetch?.();
			cancelIdlePrefetch = undefined;
			unsubEvent();
			unsubState();
			unsubResync();
			listeners.clear();
		},
	};
}
