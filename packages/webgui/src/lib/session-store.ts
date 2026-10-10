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
	RpcServerSessionState,
	RpcAvailableSlashCommand,
	RpcModelRolesResult,
	RpcAgentsResult,
	RpcModelBrowserResult,
	RpcAgentInfo,
	RpcConfigUpdateFrame,
	RpcLoginStatusResult,
	RpcLoginEventFrame,
	RpcPlanState,
	RpcPlanReview,
	RpcPlanStateFrame,
	RpcPlanReviewFrame,
	RpcPlanReviewAction,
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
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
import { defaultTranscriptCache, type CachedTranscript, type TranscriptCache } from "./transcript-cache";
import type { ComposerDraft } from "./session-actions";
import { notify } from "./notify";
import { extractTodoPhasesFromEvent, getLatestTodoPhasesFromEntries, type TodoPhase } from "./todo-model";
import { readCachedCommands, writeCachedCommands } from "./commands-cache";

/** Cadence of the safety poll while an agent is focused; events trigger earlier polls. */
const FOCUS_POLL_MS = 3000;
/** Delay between an event that persists entries and the poll that reads them. */
const FOCUS_EVENT_POLL_MS = 150;
/** Keeps brief app switches (a notification, a copied link) on the live socket; longer absences stop streaming events nobody sees. */
const SUSPEND_AFTER_HIDDEN_MS = 60_000;
/** Retry cadence while suspension waits for in-flight requests or echoed prompts to settle. */
const SUSPEND_RETRY_MS = 5_000;
/** contextUsage is the only get_state field a turn changes that no event carries, so mid-run refreshes are throttled to this. */
const TURN_STATE_REFRESH_MS = 15_000;
/** Collapses turn_end and the agent_end right behind it into one get_state. */
const STATE_REFRESH_DEBOUNCE_MS = 500;
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

/** The subagent session shown in place of the main transcript (TUI focus). */
export interface BtwState {
	recordId: string;
	question: string;
	answer: string;
	status: "running" | "complete" | "error" | "cancelled" | "interrupted";
	error?: string;
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

/** Extension dialogs the webgui answers; the host awaits one `extension_ui_response` per id. */
export type PendingDialog = Extract<RpcExtensionUIRequest, { method: "select" | "confirm" | "input" | "editor" }>;

const DIALOG_METHODS: Record<string, true> = { select: true, confirm: true, input: true, editor: true };

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
	sessionState: RpcServerSessionState | null;
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
	/** Open extension dialogs, oldest first; the sheet shows `dialogs[0]`. */
	dialogs: readonly PendingDialog[];
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
	/** Send a dialog answer and drop the dialog locally. */
	answerDialog(response: RpcExtensionUIResponse): void;
	startBtw(state: {
		recordId: string;
		question: string;
		initialAnswer?: string;
		status?: "running" | "complete" | "error" | "cancelled" | "interrupted";
	}): void;
	updateBtwFromRecord(record: {
		id: string;
		question: string;
		answer: string;
		status: "running" | "complete" | "cancelled" | "error" | "interrupted";
		error?: string;
	}): void;
	clearBtw(): void;
	dispose(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/** The slice of `document` the store needs to follow page visibility. */
export interface PageVisibility {
	readonly hidden: boolean;
	addEventListener(type: "visibilitychange", listener: () => void): void;
	removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface SessionStoreOptions {
	instanceId?: string;
	cache?: TranscriptCache;
	/** Defaults to the global `document` when one exists. */
	page?: PageVisibility;
}

export function createSessionStore(client: RpcWebClient, options: SessionStoreOptions = {}): SessionStore {
	const { instanceId, cache = defaultTranscriptCache } = options;
	// coding-agent's browser worker types redeclare `document` as a trimmed shape; in the page it is the real Document.
	const browserDocument = typeof document === "undefined" ? undefined : (document as unknown as PageVisibility);
	const page = options.page ?? browserDocument;
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
	let sessionState: RpcServerSessionState | null = client.sessionState;
	let sessionStateResolved = false;
	let stats: SessionStats | null = null;
	// A cached catalog fills the slash menu before the socket is up; the host only resends it when it changed.
	let commands: readonly RpcAvailableSlashCommand[] = (instanceId && readCachedCommands(instanceId)?.commands) || [];
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
	let dialogs: readonly PendingDialog[] = [];
	let cachedSessionId: string | undefined;
	let cachedLoadPromise: Promise<CachedTranscript | null> | null = null;

	// Sticky per store: a flag seen before get_state names the session must still block the first save.
	let sawSecrets = false;
	function noteSecrets(): void {
		sawSecrets = true;
		const sid = sessionState?.sessionId ?? cachedSessionId;
		if (sid) void cache.markNoCache(sid, instanceId);
	}

	function persistCache(): void {
		if (!sessionStateResolved || transcript.needsReload || !historyLoaded) return;
		const sid = sessionState?.sessionId;
		if (!sid || transcript.entries.length === 0) return;
		if (sawSecrets) {
			void cache.markNoCache(sid, instanceId);
			return;
		}
		cache.saveSessionThrottled(
			sid,
			{
				leafId: transcript.leafId,
				entries: transcript.entries,
				hasMore: transcript.hasMore,
			},
			instanceId,
		);
	}
	// Avoid duplicate error toasts for the same message
	let lastErrorMsg = "";
	let snapshot: SessionSnapshot;
	snapshot = buildSnapshot();

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
		const streaming = transcript.working || (sessionState?.isStreaming ?? false);
		let currentFocus: FocusSnapshot | null = null;
		if (focus) {
			const todoPhases = focusedTodoPhases(focus.transcript.entries);
			if (
				snapshot &&
				snapshot.focus &&
				snapshot.focus.agentId === focus.agentId &&
				snapshot.focus.transcript === focus.transcript &&
				snapshot.focus.ready === focusReady &&
				snapshot.focus.loaded === focus.loaded &&
				snapshot.focus.error === focusError &&
				snapshot.focus.todoPhases === todoPhases
			) {
				currentFocus = snapshot.focus;
			} else {
				currentFocus = {
					agentId: focus.agentId,
					transcript: focus.transcript,
					ready: focusReady,
					loaded: focus.loaded,
					error: focusError,
					todoPhases,
				};
			}
		}

		if (
			snapshot &&
			snapshot.historyLoaded === historyLoaded &&
			snapshot.connection === connection &&
			snapshot.transcript === transcript &&
			snapshot.subagents === subagents &&
			snapshot.hub === hub &&
			snapshot.focus === currentFocus &&
			snapshot.focusDetach === focusDetach &&
			snapshot.sessionState === sessionState &&
			snapshot.stats === stats &&
			snapshot.commands === commands &&
			snapshot.streaming === streaming &&
			snapshot.roles === roles &&
			snapshot.agents === agents &&
			snapshot.browser === browser &&
			snapshot.loginStatus === loginStatus &&
			snapshot.login === login &&
			snapshot.restoredDraft === restoredDraft &&
			snapshot.planState === planState &&
			snapshot.planReview === planReview &&
			snapshot.btw === btw &&
			snapshot.dialogs === dialogs
		) {
			return snapshot;
		}

		return {
			historyLoaded,
			connection,
			transcript,
			subagents,
			hub,
			focus: currentFocus,
			focusDetach,
			sessionState,
			stats,
			commands,
			streaming,
			roles,
			agents,
			browser,
			loginStatus,
			login,
			restoredDraft,
			planState,
			planReview,
			btw,
			dialogs,
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
		const nextSnapshot = buildSnapshot();
		if (nextSnapshot === snapshot) return;
		snapshot = nextSnapshot;
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
		lastStatsFetchAt = Date.now();
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
			.request({ type: "set_subagent_subscription", level: "events", ids: [agentId], omitPartial: true })
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
		// A hidden page catches up with one poll when it becomes visible.
		if (focusEventTimer !== undefined || page?.hidden) return;
		focusEventTimer = setTimeout(() => {
			focusEventTimer = undefined;
			void pollFocus();
		}, FOCUS_EVENT_POLL_MS);
	}
	function startFocusPolling(): void {
		if (page?.hidden) return;
		focusPollTimer ??= setInterval(() => void pollFocus(), FOCUS_POLL_MS);
		void pollFocus();
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
		notify("info", viewingMessage(id));
		emit();
		startFocusPolling();
	}
	function unfocus(): void {
		// Leaving Main-ward explicitly cancels pending focus requests.
		focusSeq++;
		if (!focus) return;
		clearFocus();
		notify("info", "Returned to main session");
		emit();
	}
	let lastStateFetchAt = Number.NEGATIVE_INFINITY;
	let stateTimer: Timer | undefined;
	/** `force` (agent_end) always refreshes; a turn_end only once the throttle window has passed. */
	function scheduleSessionStateRefresh(force: boolean): void {
		if (stateTimer !== undefined) return;
		if (!force && Date.now() - lastStateFetchAt < TURN_STATE_REFRESH_MS) return;
		stateTimer = setTimeout(() => {
			stateTimer = undefined;
			if (client.state === "ready") fetchSessionState();
		}, STATE_REFRESH_DEBOUNCE_MS);
	}
	function fetchSessionState(): void {
		if (disposed) return;
		lastStateFetchAt = Date.now();
		client
			.request({ type: "get_state", light: true })
			.then((resp: RpcResponseFor<"get_state">) => {
				if (disposed) return;
				sessionStateResolved = true;
				const prevSessionId = sessionState?.sessionId;
				sessionState = resp.data;
				const currentSid = sessionState?.sessionId;
				const mismatch =
					(cachedSessionId !== undefined && currentSid !== undefined && currentSid !== cachedSessionId) ||
					(prevSessionId !== undefined && currentSid !== undefined && currentSid !== prevSessionId);
				if (mismatch) {
					if (cachedSessionId) {
						void cache.dropSession(cachedSessionId, instanceId);
					}
					if (prevSessionId && prevSessionId !== currentSid) {
						void cache.dropSession(prevSessionId, instanceId);
					}
					cachedSessionId = currentSid;
					cachedLoadPromise = null;
					triggerReload();
				} else if (currentSid) {
					cachedSessionId = currentSid;
					if (!mismatch) {
						persistCache();
					}
				}
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

	// Cost is the only stats field on screen; a run's turn_ends would each refetch it (~3.7 per prompt),
	// so mid-run refreshes share get_state's throttle and agent_end always refreshes.
	let statsTimer: Timer | undefined;
	let lastStatsFetchAt = Number.NEGATIVE_INFINITY;

	function scheduleStatsRefresh(force: boolean): void {
		if (statsTimer !== undefined) return;
		if (!force && Date.now() - lastStatsFetchAt < TURN_STATE_REFRESH_MS) return;
		statsTimer = setTimeout(() => {
			statsTimer = undefined;
			// A suspended socket would reject; resync refetches stats anyway.
			if (client.state === "ready") fetchStats();
		}, STATE_REFRESH_DEBOUNCE_MS);
	}

	// Model, agent, and login data (about 600KB per attach) load only when the models UI asks;
	// reset per connection so a resync refetches what was on screen.
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
		if (transcript.entries.length === 0) {
			const indexEntry = instanceId
				? cache.readIndex({ instanceId })
				: sessionState?.sessionId
					? cache.readIndex({ sessionId: sessionState.sessionId })
					: null;
			if (indexEntry?.sessionId && indexEntry.leafId) {
				cachedSessionId = indexEntry.sessionId;
				cachedLoadPromise = cache.loadSession(indexEntry.sessionId);
			}
		}
		triggerReload();
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
		if (commandsPushed) return;
		// The host stays silent when the presented hash matched; anything else means it never saw one.
		const cached = instanceId && client.sentCommandsHash ? readCachedCommands(instanceId) : null;
		if (cached && cached.hash === client.sentCommandsHash) {
			commands = cached.commands;
			emit();
		} else {
			fetchCommands();
		}
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
		historyLoaded = false;
		const loadId = ++activeLoadId;
		if (reloadInProgress) {
			reloadPending = true;
			return;
		}
		void doReload(loadId);
	}

	async function fetchHistoryPage(opts: {
		before?: string;
		after?: string;
		leafId?: string;
		limit?: number;
	}): Promise<RpcV3HistoryResult> {
		let request = opts;
		for (;;) {
			try {
				const page = await client.history(request);
				if (page.secrets) noteSecrets();
				return page;
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

		// 1. In-memory entries exist (reconnect) -> after = currentLeafId
		// If branch changed or reload is flagged, entries are not valid for an after-query.
		const inMemoryLeaf = !transcript.needsReload && transcript.entries.length > 0 ? transcript.leafId : null;
		if (inMemoryLeaf) {
			let page: RpcV3HistoryResult;
			try {
				page = await fetchHistoryPage({ after: inMemoryLeaf });
			} catch (err) {
				if (disposed || loadId !== activeLoadId) return;
				const isBranchChanged =
					(err instanceof RpcCommandError && err.code === "branch_changed") ||
					(err instanceof Error && err.message.includes("branch_changed"));
				if (isBranchChanged) {
					const sid = sessionState?.sessionId ?? cachedSessionId;
					if (sid) void cache.dropSession(sid, instanceId);
					await fetchNewestPage(loadId);
					return;
				}
				notifyOnce(err instanceof Error ? err.message : String(err));
				emit();
				afterFirstHistory();
				return;
			}

			if (disposed || loadId !== activeLoadId) return;
			if (page.after !== undefined) {
				if (page.after !== inMemoryLeaf) {
					await fetchNewestPage(loadId);
					return;
				}
				transcript = applyHistoryPage(transcript, page, { older: false });
				historyLoaded = true;
				emit();
				afterFirstHistory();
				persistCache();
				return;
			}
			// Result without after -> standard newest page replace
			transcript = applyHistoryPage(transcript, page, { older: false });
			historyLoaded = true;
			emit();
			afterFirstHistory();
			persistCache();
			return;
		}

		// 2. Cold attach with cached leafId in localStorage index
		const indexEntry = instanceId
			? cache.readIndex({ instanceId })
			: sessionState?.sessionId
				? cache.readIndex({ sessionId: sessionState.sessionId })
				: null;

		if (indexEntry?.leafId) {
			const cachedLeaf = indexEntry.leafId;
			if (indexEntry.sessionId) {
				cachedSessionId = indexEntry.sessionId;
			}
			const loadP = cachedLoadPromise ?? (cachedLoadPromise = cache.loadSession(indexEntry.sessionId!));

			let deltaPage: RpcV3HistoryResult;
			try {
				deltaPage = await fetchHistoryPage({ after: cachedLeaf });
			} catch (err) {
				if (disposed || loadId !== activeLoadId) return;
				const isBranchChanged =
					(err instanceof RpcCommandError && err.code === "branch_changed") ||
					(err instanceof Error && err.message.includes("branch_changed"));
				if (isBranchChanged) {
					const sid = sessionState?.sessionId ?? cachedSessionId;
					if (sid) void cache.dropSession(sid, instanceId);
					await fetchNewestPage(loadId);
					return;
				}
				notifyOnce(err instanceof Error ? err.message : String(err));
				emit();
				afterFirstHistory();
				return;
			}

			if (disposed || loadId !== activeLoadId) return;

			if (deltaPage.after !== undefined) {
				const { promise: timeoutP, resolve: resolveTimeout } = Promise.withResolvers<null>();
				const idbTimer: Timer = setTimeout(() => resolveTimeout(null), 500);
				const cachedData = await Promise.race([loadP, timeoutP])
					.catch(() => null)
					.finally(() => {
						clearTimeout(idbTimer);
					});
				if (disposed || loadId !== activeLoadId) return;

				if (
					cachedData &&
					cachedData.entries.length > 0 &&
					cachedData.leafId === cachedLeaf &&
					deltaPage.after === cachedLeaf
				) {
					// Seed transcript from cache if empty or if delta covers all in-memory entries
					const deltaIds = new Set(deltaPage.entries.map(e => e.id));
					const allCovered = transcript.entries.length === 0 || transcript.entries.every(e => deltaIds.has(e.id));
					if (allCovered) {
						transcript = {
							...transcript,
							entries: cachedData.entries,
							leafId: cachedData.leafId,
							hasMore: cachedData.hasMore,
						};
					}
					transcript = applyHistoryPage(transcript, deltaPage, { older: false });
					historyLoaded = true;
					emit();
					afterFirstHistory();
					persistCache();
					return;
				}
				// IDB read failed or missed -> discard delta and fetch newest page normally
				await fetchNewestPage(loadId);
				return;
			}

			// Server returned newest page without after
			transcript = applyHistoryPage(transcript, deltaPage, { older: false });
			historyLoaded = true;
			emit();
			afterFirstHistory();
			persistCache();
			return;
		}

		// 3. Normal newest page fetch
		await fetchNewestPage(loadId);
	}

	async function fetchNewestPage(loadId: number): Promise<void> {
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
		persistCache();
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
				const sid = sessionState?.sessionId ?? cachedSessionId;
				if (sid) void cache.dropSession(sid, instanceId);
				transcript = { ...transcript, needsReload: true };
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
		persistCache();
	}

	let initialLoaded = false;
	if (client.state === "ready") {
		initialLoaded = true;
		attach();
	}
	const unsubEvent = client.onEvent((event: RpcSessionEvent) => {
		const frame = event as { type: string; commands?: RpcAvailableSlashCommand[]; hash?: string };

		const prevTranscript = transcript;
		const prevSubagents = subagents;
		const prevHub = hub;
		const prevFocus = focus;
		const prevFocusReady = focusReady;
		const prevFocusError = focusError;
		const prevFocusDetach = focusDetach;
		const prevSessionState = sessionState;
		const prevStats = stats;
		const prevCommands = commands;
		const prevRoles = roles;
		const prevAgents = agents;
		const prevBrowser = browser;
		const prevLoginStatus = loginStatus;
		const prevLogin = login;
		const prevRestoredDraft = restoredDraft;
		const prevPlanState = planState;
		const prevPlanReview = planReview;
		const prevBtw = btw;
		const prevDialogs = dialogs;

		// available_commands_update arrives through the event stream
		if (frame.type === "available_commands_update" && frame.commands) {
			commands = frame.commands;
			commandsPushed = true;
			if (instanceId && frame.hash) writeCachedCommands(instanceId, frame.hash, frame.commands);
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
			}
		}
		if (frame.type === "btw_delta") {
			const deltaFrame = event as unknown as { type: "btw_delta"; recordId: string; delta: string };
			if (btw && btw.recordId === deltaFrame.recordId) {
				btw = {
					...btw,
					answer: btw.answer + deltaFrame.delta,
				};
			}
		}
		if (frame.type === "btw_record") {
			const recordFrame = event as unknown as {
				type: "btw_record";
				record: {
					id: string;
					question: string;
					answer: string;
					status: "running" | "complete" | "cancelled" | "error" | "interrupted";
					error?: string;
				};
			};
			const rec = recordFrame.record;
			if (btw && btw.recordId === rec.id) {
				btw = {
					...btw,
					question: rec.question,
					answer: rec.answer,
					status: rec.status,
					...(rec.error ? { error: rec.error } : {}),
				};
			}
		}

		if (isV3Event(event)) {
			const wasNeedsReload = transcript.needsReload;
			transcript = applyV3Event(transcript, event);
			if (frame.type === "branch" || (!wasNeedsReload && transcript.needsReload)) {
				const sid = sessionState?.sessionId ?? cachedSessionId;
				if (sid) void cache.dropSession(sid, instanceId);
				historyLoaded = false;
				triggerReload();
			} else if (frame.type === "entry") {
				if (event.type === "entry" && event.secrets) noteSecrets();
				else persistCache();
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
		if (frame.type === "extension_ui_request") {
			const req = frame as unknown as RpcExtensionUIRequest;
			if (req.method === "cancel") {
				if (dialogs.some(d => d.id === req.targetId)) dialogs = dialogs.filter(d => d.id !== req.targetId);
			} else if (DIALOG_METHODS[req.method]) {
				// The host re-sends a dialog on driver change or reconnect; keep one entry per id.
				const dialog = req as PendingDialog;
				const at = dialogs.findIndex(d => d.id === dialog.id);
				dialogs = at === -1 ? [...dialogs, dialog] : dialogs.with(at, dialog);
			}
		}

		if (
			prevTranscript !== transcript ||
			prevSubagents !== subagents ||
			prevHub !== hub ||
			prevFocus !== focus ||
			prevFocusReady !== focusReady ||
			prevFocusError !== focusError ||
			prevFocusDetach !== focusDetach ||
			prevSessionState !== sessionState ||
			prevStats !== stats ||
			prevCommands !== commands ||
			prevRoles !== roles ||
			prevAgents !== agents ||
			prevBrowser !== browser ||
			prevLoginStatus !== loginStatus ||
			prevLogin !== login ||
			prevRestoredDraft !== restoredDraft ||
			prevPlanState !== planState ||
			prevPlanReview !== planReview ||
			prevBtw !== btw ||
			prevDialogs !== dialogs
		) {
			emit();
		}
		if (registryId !== undefined && registryId === focus?.agentId) checkFocusWatch();
		if (frame.type === "turn_end" || frame.type === "agent_end") {
			scheduleStatsRefresh(frame.type === "agent_end");
			scheduleSessionStateRefresh(frame.type === "agent_end");
			// Lifecycle/progress frames keep the tree live (subscribed on attach); reconcile once per run.
			// plan_state is pushed by the host on change and at every turn boundary, so no poll here.
			if (frame.type === "agent_end") fetchSubagents(true);
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
		// Cleared at the drop, not at resync: the host pushes the catalog during the handshake, before onResync runs.
		if (state !== "ready") commandsPushed = false;
		// Answers cannot reach the host across a drop; it re-sends still-pending dialogs after reconnect.
		if (state !== "ready" && dialogs.length > 0) dialogs = [];
		emit();
		if (!initialLoaded && state === "ready") {
			initialLoaded = true;
			attach();
		}
	});

	const unsubResync = client.onResync((state: RpcServerSessionState) => {
		if (state) {
			sessionState = state;
			sessionStateResolved = true;
			lastStateFetchAt = Date.now();
		}
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
			startFocusPolling();
		}
		// Mounted screens asked for this data; refetch it for the new connection.
		if (hadModelData) ensureModelData();
		if (hadAgents) ensureAgents();
		if (hadLoginStatus) ensureLoginStatus();
	});

	let suspendTimer: Timer | undefined;
	function trySuspend(): void {
		suspendTimer = undefined;
		if (disposed || !page?.hidden) return;
		// Echoed prompts not yet landed as entries would be dropped by the resync, so wait for them.
		if (transcript.pendingUser.length > 0 || !client.suspend()) {
			suspendTimer = setTimeout(trySuspend, SUSPEND_RETRY_MS);
		}
	}
	function onVisibilityChange(): void {
		if (disposed || !page) return;
		if (page.hidden) {
			stopFocusTimers();
			suspendTimer ??= setTimeout(trySuspend, SUSPEND_AFTER_HIDDEN_MS);
			return;
		}
		if (suspendTimer !== undefined) {
			clearTimeout(suspendTimer);
			suspendTimer = undefined;
		}
		// Resuming resyncs history and restarts the focus poll from onResync.
		if (client.suspended) client.resume();
		else if (focus && focusReady) startFocusPolling();
	}
	page?.addEventListener("visibilitychange", onVisibilityChange);

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
			recordId: string;
			question: string;
			initialAnswer?: string;
			status?: "running" | "complete" | "error" | "cancelled" | "interrupted";
		}): void {
			btw = {
				recordId: state.recordId,
				question: state.question,
				answer: state.initialAnswer ?? "",
				status: state.status ?? "running",
			};
			emit();
		},
		updateBtwFromRecord(record: {
			id: string;
			question: string;
			answer: string;
			status: "running" | "complete" | "cancelled" | "error" | "interrupted";
			error?: string;
		}): void {
			btw = {
				recordId: record.id,
				question: record.question,
				answer: record.answer,
				status: record.status,
				...(record.error ? { error: record.error } : {}),
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
		answerDialog(response: RpcExtensionUIResponse): void {
			if (disposed) return;
			if (!client.sendUIResponse(response)) {
				notifyOnce("Not connected; the dialog will reappear after reconnect");
				return;
			}
			dialogs = dialogs.filter(d => d.id !== response.id);
			emit();
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
			clearTimeout(stateTimer);
			stateTimer = undefined;
			clearTimeout(suspendTimer);
			suspendTimer = undefined;
			page?.removeEventListener("visibilitychange", onVisibilityChange);
			unsubEvent();
			unsubState();
			unsubResync();
			listeners.clear();
		},
	};
}
