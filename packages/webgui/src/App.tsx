import { useState, useEffect, useRef, useSyncExternalStore, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { readCachedCommands } from "./lib/commands-cache";
import { browserWindow, browserDocument, triggerBlobDownload } from "./lib/dom";
import { RpcWebClient } from "./lib/rpc-client";
import type { RpcConnectionState } from "./lib/rpc-client";
import type { RpcServerSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import type { BtwHistoryRecord } from "@oh-my-pi/pi-coding-agent/session/btw-history";
import { createSessionStore } from "./lib/session-store";
import type { SessionStore, SessionSnapshot } from "./lib/session-store";
import { emptyTranscriptState } from "./lib/transcript-model";
import { EMPTY_SUBAGENT_STATE } from "./lib/subagent-model";
import { agentIdLabel, EMPTY_AGENT_HUB_STATE, entryMetrics } from "./lib/agent-hub-model";
import type { ToolRenderHost } from "./components/transcript/tool-views/types";
import {
	sendPrompt,
	steer,
	followUp,
	abortAndRestoreQueue,
	branch,
	retry,
	getAvailableThinkingLevels,
	removeQueuedMessage,
	compact,
	handoff,
	setSessionName,
	setThinkingLevel,
	restoreClearedMessagesToDraft,
	setPlanMode,
	steerAgent,
	interruptAgent,
	btw,
	btwCancel,
	getBtwHistory,
} from "./lib/session-actions";
import { ThinkingLevel as Thinking } from "@oh-my-pi/pi-agent-core/thinking";
import type { ThinkingLevel, ComposerDraft } from "./lib/session-actions";
import { draftKey } from "./lib/drafts";
import { navigate, parseRoute, routeHash, subscribeRoute, syncRouteHistory } from "./lib/route";
import type { Route } from "./lib/route";
import { dismissNotice, getNotices, notify, subscribeNotices } from "./lib/notify";
import { AppShell } from "./components/shell/AppShell";
import { TopBar } from "./components/shell/TopBar";
import { gateFocusedSubmit } from "./lib/focus-model";
import { AlertStrip } from "./components/shell/AlertStrip";
import { NowStrip } from "./components/shell/NowStrip";
import { ControlCenter } from "./components/shell/ControlCenter";
import type { ControlCenterPanel, ThinkingOption } from "./components/shell/ControlCenter";
import { pickAlert } from "./lib/alert-priority";
import { isOffline, liveLine } from "./lib/live-line";
import type { LiveLineFocus } from "./lib/live-line";
import type * as AgentHubModule from "./components/agent-hub/AgentHubScreen";
import type { AgentHubScreenProps } from "./components/agent-hub/AgentHubScreen";
import { LazyModule } from "./lib/lazy-module";
import { contextLevel } from "./lib/context-usage";
import { countTodoProgress } from "./lib/todo-model";
import { fmtCost, fmtTokens } from "./lib/format";
import { claimOnInput, disableVoice, enableVoice, getWrenState, subscribeWren } from "./lib/wren";
import { TranscriptView } from "./components/transcript/Transcript";
import { Composer } from "./components/composer/Composer";
import { PlanReviewSheet } from "./components/plan/PlanReviewSheet";
import { ExtensionDialogSheet } from "./components/dialog/ExtensionDialogSheet";
import { BtwSheet } from "./components/btw/BtwSheet";
import { extractUserPrompts } from "./lib/prompt-history";
import { useModelsHub } from "./components/models/useModelsHub";
import { PinnedSubagents } from "./components/agents/PinnedSubagents";
import { pinnedRows } from "./lib/pinned-subagents-model";
import { loadDismissed, saveDismissed } from "./lib/pinned-dismissed";
import { BP_LG } from "./lib/layout";
import { useCodeWrap } from "./lib/code-wrap";

// React.lazy keeps a rejected import forever; LazyModule retries a failed chunk load.
const agentHub = new LazyModule<typeof AgentHubModule>(() => import("./components/agent-hub/AgentHubScreen"));

function AgentHubScreen(props: AgentHubScreenProps): ReactNode {
	const mod = useSyncExternalStore(agentHub.subscribe, agentHub.snapshot, agentHub.snapshot);
	useEffect(() => {
		if (mod === null) agentHub.request();
	}, [mod]);
	if (mod === null) return <div className="ah-empty">Loading agent hub...</div>;
	return <mod.AgentHubScreen {...props} />;
}
import { TodoPanel } from "./components/todos/TodoPanel";
import { SessionsScreen } from "./components/sessions/SessionsScreen";
import { UsageScreen } from "./components/usage/UsageScreen";
import { createServerOperator, parseSessionKey } from "./lib/servers";
import "./styles/app.css";
import "./components/shell/shell.css";

// -------------------------------------------------------------------
// Empty snapshot constant
// -------------------------------------------------------------------

const EMPTY_SNAPSHOT: SessionSnapshot = {
	historyLoaded: false,
	connection: "closed" as RpcConnectionState,
	transcript: emptyTranscriptState(),
	subagents: EMPTY_SUBAGENT_STATE,
	hub: EMPTY_AGENT_HUB_STATE,
	focus: null,
	focusDetach: null,
	sessionState: null,
	stats: null,
	commands: [],
	streaming: false,
	roles: null,
	agents: null,
	browser: null,
	loginStatus: null,
	login: null,
	restoredDraft: null,
	planState: null,
	planReview: null,
	btw: null,
	dialogs: [],
	turnStartedAt: null,
	idleSince: null,
	compactionStartedAt: null,
	attentionSince: null,
	hostTools: new Map(),
	queue: { steering: [], followUp: [] },
	dialogSheetOpen: false,
};

const NOOP_UNSUBSCRIBE = () => {};
const EMPTY_COMMANDS: SessionSnapshot["commands"] = [];
/** Shown until the session reports the model's supported levels. */
const FALLBACK_THINKING: readonly ThinkingLevel[] = [Thinking.Off, Thinking.Low, Thinking.Medium, Thinking.High];
const THINKING_LABEL: Record<ThinkingLevel, string> = {
	inherit: "Inherit",
	off: "Off",
	minimal: "Minimal",
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "XHigh",
	max: "Max",
};

// -------------------------------------------------------------------
// Hooks
// -------------------------------------------------------------------

function useRoute(): Route {
	const [route, setRoute] = useState<Route>(() => {
		syncRouteHistory();
		return parseRoute(browserWindow.location.hash);
	});

	useEffect(
		() =>
			subscribeRoute(() => {
				const next = parseRoute(browserWindow.location.hash);
				// Traversal can fire both hashchange and popstate; skip the echo.
				setRoute(prev => (routeHash(prev) === routeHash(next) ? prev : next));
			}),
		[],
	);

	return route;
}

/**
 * iOS standalone (home-screen) mode misreports visualViewport at rest and
 * scrolls the layout viewport instead of resizing it when the keyboard opens.
 * The app is sized by CSS at rest; visualViewport is trusted only while a
 * text field has focus.
 */
function useViewportHeight(): void {
	useEffect(() => {
		const vv = browserWindow.visualViewport;
		if (!vv) return;
		const root = browserDocument.documentElement;
		const style = root.style;
		function update(): void {
			const tag = browserDocument.activeElement?.tagName;
			if (tag === "TEXTAREA" || tag === "INPUT") {
				style.setProperty("--viewport-height", `${vv!.height}px`);
				style.setProperty("--viewport-offset", `${vv!.offsetTop}px`);
				root.dataset.keyboard = "true";
			} else {
				style.removeProperty("--viewport-height");
				style.removeProperty("--viewport-offset");
				delete root.dataset.keyboard;
			}
		}
		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		browserDocument.addEventListener("focusin", update);
		browserDocument.addEventListener("focusout", update);
		update();
		return () => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
			browserDocument.removeEventListener("focusin", update);
			browserDocument.removeEventListener("focusout", update);
		};
	}, []);
}

// -------------------------------------------------------------------
// App
// -------------------------------------------------------------------

export function App(): ReactNode {
	const route = useRoute();
	const instanceId = route.kind === "session" ? route.id : null;
	const [servers] = useState(() =>
		createServerOperator({ storage: browserWindow.localStorage ?? null, origin: browserWindow.location.origin }),
	);

	useViewportHeight();

	// Any local interaction claims Wren voice playback for this device.
	useEffect(() => {
		const opts = { capture: true, passive: true } as const;
		browserWindow.addEventListener("pointerdown", claimOnInput, opts);
		browserWindow.addEventListener("keydown", claimOnInput, opts);
		return () => {
			browserWindow.removeEventListener("pointerdown", claimOnInput, opts);
			browserWindow.removeEventListener("keydown", claimOnInput, opts);
		};
	}, []);

	// Track client + store
	const attachRef = useRef<{
		client: RpcWebClient;
		store: SessionStore;
	} | null>(null);
	const lastPromptRef = useRef<ComposerDraft | null>(null);
	const [btwHistoryRecords, setBtwHistoryRecords] = useState<readonly BtwHistoryRecord[]>([]);

	const [attachKey, setAttachKey] = useState(0);

	// Attach to session when instanceId changes
	useEffect(() => {
		if (attachRef.current) {
			attachRef.current.store.dispose();
			attachRef.current.client.close();
			attachRef.current = null;
		}

		if (instanceId === null) {
			setAttachKey(k => k + 1);
			return;
		}

		const url = servers.wsUrl(parseSessionKey(instanceId));
		// The route names a server that was removed from this browser's list.
		if (url === null) {
			notify("error", "Unknown server for this session");
			navigate({ kind: "sessions" });
			return;
		}
		const client = new RpcWebClient({
			url,
			reconnect: { enabled: true },
			commandsHash: () => readCachedCommands(instanceId)?.hash,
		} as ConstructorParameters<typeof RpcWebClient>[0]);
		const store = createSessionStore(client, { instanceId });
		attachRef.current = { client, store };
		setAttachKey(k => k + 1);
		// `prompt` acks before its run starts; a failure afterwards arrives as a
		// second response the request promise can no longer deliver.
		const unsubLateError = client.onLateError(err => {
			if (err.command === "prompt" && lastPromptRef.current) {
				restoreFailedSend(store, lastPromptRef.current);
				lastPromptRef.current = null;
			}
			notify("error", `Failed: ${err.message}`);
		});

		// A failed connect surfaces as the offline alert; the client keeps retrying.
		client.connect().catch(() => {});

		return () => {
			unsubLateError();
			if (attachRef.current) {
				attachRef.current.store.dispose();
				attachRef.current.client.close();
				attachRef.current = null;
			}
		};
	}, [instanceId]);

	// useSyncExternalStore with the current store
	const currentStore = attachRef.current?.store ?? null;
	const subscribe = useCallback(
		(fn: () => void) => (currentStore ? currentStore.subscribe(fn) : NOOP_UNSUBSCRIBE),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[attachKey],
	);
	const getSnapshot = useCallback(
		() => currentStore?.getSnapshot() ?? EMPTY_SNAPSHOT,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[attachKey],
	);
	const snap = useSyncExternalStore(subscribe, getSnapshot);
	const snapRef = useRef(snap);
	snapRef.current = snap;
	const loadOlder = useCallback(
		() => currentStore?.loadOlder() ?? Promise.resolve(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[attachKey],
	);
	const [expandAll, setExpandAll] = useState(false);
	const dismissKey = snap.sessionState?.sessionId ?? (route.kind === "session" ? route.id : null);
	const [dismissed, setDismissed] = useState<{ key: string | null; ids: Set<string> }>({ key: null, ids: new Set() });
	const storedDismissed = useMemo(() => (dismissKey ? loadDismissed(dismissKey) : new Set<string>()), [dismissKey]);
	const dismissedIds = dismissed.key === dismissKey ? dismissed.ids : storedDismissed;
	const dismissAgents = useCallback(
		(ids: readonly string[]) => {
			if (!dismissKey || ids.length === 0) return;
			const next = new Set(dismissedIds);
			for (const id of ids) next.add(id);
			saveDismissed(dismissKey, next);
			setDismissed({ key: dismissKey, ids: next });
		},
		[dismissKey, dismissedIds],
	);
	const dismissAgent = useCallback((id: string) => dismissAgents([id]), [dismissAgents]);

	const routeKey = route.kind === "session" ? `${route.id}:${route.panel}` : route.kind;
	const hub = useModelsHub({
		sink: attachRef.current?.client ?? null,
		snap,
		store: attachRef.current?.store ?? null,
		routeKey,
	});

	const promptHistory = useMemo(
		() => extractUserPrompts({ entries: snap.transcript.entries, pendingUser: snap.transcript.pendingUser }),
		[snap.transcript.entries, snap.transcript.pendingUser],
	);
	const pinnedRowsList = useMemo(
		() => pinnedRows(snap.hub, snap.subagents, dismissedIds),
		[snap.hub, snap.subagents, dismissedIds],
	);
	const composerDraftRef = useRef<ComposerDraft>({ text: "", images: [] });

	// The RPC session state carries no cwd; the daemon registry does.
	const [liveCwd, setLiveCwd] = useState<string | null>(null);
	useEffect(() => {
		setLiveCwd(null);
		if (instanceId === null) return;
		const ref = parseSessionKey(instanceId);
		if (!servers.get(ref.serverId)) return;
		const ctrl = new AbortController();
		servers
			.apiFor(ref.serverId)
			.listLive(ctrl.signal)
			.then(entries => setLiveCwd(entries.find(e => e.instanceId === ref.instanceId)?.cwd ?? null))
			.catch(() => {});
		return () => ctrl.abort();
	}, [instanceId, servers]);
	const isHubRoute = route.kind === "session" && route.panel === "hub";
	useEffect(() => {
		if (!currentStore || !isHubRoute) return;
		currentStore.setHubOpen(true);
		return () => currentStore.setHubOpen(false);
	}, [currentStore, isHubRoute]);

	const [wide, setWide] = useState(() => browserWindow.matchMedia(`(min-width: ${BP_LG}px)`).matches);
	useEffect(() => {
		const update = () => setWide(browserWindow.matchMedia(`(min-width: ${BP_LG}px)`).matches);
		browserWindow.addEventListener("resize", update);
		return () => browserWindow.removeEventListener("resize", update);
	}, []);
	const pinnedVisible =
		route.kind === "session" &&
		(route.panel === "subagents" ||
			(wide && !isHubRoute && route.panel !== "todos" && route.panel !== "models" && route.panel !== "usage"));
	useEffect(() => {
		if (!currentStore || !pinnedVisible) return;
		currentStore.setPinnedOpen(true);
		return () => currentStore.setPinnedOpen(false);
	}, [currentStore, pinnedVisible]);

	// Agent links in task cards focus the agent in the main view (TUI focus parity).
	const jobs = currentStore?.jobs;
	const toolHost = useMemo<ToolRenderHost>(
		() => ({
			openAgent: agent => {
				if (instanceId !== null) navigate({ kind: "session", id: instanceId, panel: "agent", agent });
			},
			...(jobs ? { jobs } : {}),
		}),
		[instanceId, jobs],
	);

	// The route is the source of truth for which agent is focused; the store owns the transcript stream.
	const focusRouteAgent = route.kind === "session" && route.panel === "agent" ? route.agent : undefined;
	useEffect(() => {
		if (!currentStore) return;
		if (focusRouteAgent !== undefined) void currentStore.focusAgent(focusRouteAgent);
		else currentStore.unfocus();
	}, [currentStore, focusRouteAgent]);

	// The store detached without a route change (agent gone, parked, aborted, revive failed): back to Main.
	const detachNonce = snap.focusDetach?.nonce;
	useEffect(() => {
		if (detachNonce === undefined || instanceId === null) return;
		const current = parseRoute(browserWindow.location.hash);
		if (current.kind === "session" && current.panel === "agent") {
			navigate({ kind: "session", id: instanceId, panel: null });
		}
		// Only a new detach notice may navigate.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [detachNonce]);

	// Esc returns to Main from anywhere outside a text field; the composer handles its own Esc.
	useEffect(() => {
		if (focusRouteAgent === undefined || instanceId === null) return;
		function handleEscape(e: unknown) {
			const ev = e as KeyboardEvent;
			if (
				ev.key !== "Escape" ||
				ev.defaultPrevented ||
				(ev.target as { tagName?: string } | null)?.tagName !== "BODY"
			)
				return;
			ev.preventDefault();
			navigate({ kind: "session", id: instanceId!, panel: null });
		}
		browserWindow.addEventListener("keydown", handleEscape);
		return () => browserWindow.removeEventListener("keydown", handleEscape);
	}, [focusRouteAgent, instanceId]);

	// Alt+A toggles the Agent Hub.
	useEffect(() => {
		function handleHubKey(e: unknown) {
			const ev = e as KeyboardEvent & { code?: string };
			if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.code !== "KeyA" || instanceId === null) return;
			ev.preventDefault();
			navigate({ kind: "session", id: instanceId, panel: isHubRoute ? null : "hub" });
		}
		browserWindow.addEventListener("keydown", handleHubKey);
		return () => browserWindow.removeEventListener("keydown", handleHubKey);
	}, [instanceId, isHubRoute]);

	// Global keyboard shortcuts: Ctrl+P / Shift+Ctrl+P to cycle models
	useEffect(() => {
		function handleKeyDown(e: unknown) {
			const ev = e as KeyboardEvent;
			// Match Ctrl+P or Cmd+P (Mac)
			if ((ev.ctrlKey || ev.metaKey) && (ev.key === "p" || ev.key === "P")) {
				ev.preventDefault();
				ev.stopPropagation();
				if (focusRouteAgent !== undefined) {
					notify("info", "Model changes run in the main session; press Esc to return first");
					return;
				}
				hub.cycleRoleModel(ev.shiftKey ? "backward" : "forward");
			}
		}

		browserWindow.addEventListener("keydown", handleKeyDown);
		return () => browserWindow.removeEventListener("keydown", handleKeyDown);
	}, [hub, focusRouteAgent]);

	// Handlers
	function handleAttach(id: string): void {
		navigate({ kind: "session", id, panel: null });
	}

	const focus = snap.focus;
	const focusEntry = focus ? snap.hub.agents.get(focus.agentId) : undefined;
	const focusMetrics = focusEntry ? entryMetrics(focusEntry) : undefined;
	const focusStreaming = focus?.transcript.working ?? false;

	const exitFocus = useCallback((): void => {
		if (instanceId !== null) navigate({ kind: "session", id: instanceId, panel: null });
	}, [instanceId]);

	// Returns false for a refused focused submit so the composer keeps the draft.
	const handleSend = useCallback(
		(text: string, mode: "prompt" | "steer" | "followUp", images?: readonly string[]): boolean | void => {
			const attached = attachRef.current;
			if (!attached) return;
			const { client } = attached;
			const curFocus = snapRef.current.focus;
			if (curFocus) {
				const gate = gateFocusedSubmit(text);
				if (gate.kind === "refuse") {
					notify("info", gate.message);
					return false;
				}
				if (gate.kind === "usage") {
					if (instanceId !== null) navigate({ kind: "session", id: instanceId, panel: "usage" });
					return;
				}
				if (gate.kind === "export") {
					if (instanceId === null) return;
					const ref = parseSessionKey(instanceId);
					const base = servers.baseUrl(ref.serverId);
					if (base === null) return;
					const agentId = curFocus.agentId;
					notify("info", "Exporting HTML...");
					fetch(`${base}/api/live/${encodeURIComponent(ref.instanceId)}/export`, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ agentId }),
					})
						.then(async res => {
							if (!res.ok) {
								const msg = await res.text();
								throw new Error(msg || `Export failed with HTTP ${res.status}`);
							}
							const blob = await res.blob();
							const disposition = res.headers.get("content-disposition") || "";
							const match = disposition.match(/filename[*]?=["']?([^"';\n]+)/i);
							const filename = match?.[1] || `${agentId}-${new Date().toISOString().slice(0, 10)}.html`;
							triggerBlobDownload(blob, filename);
							notify("info", `Exported to ${filename}`);
						})
						.catch((err: unknown) => {
							notify("error", `Export failed: ${err instanceof Error ? err.message : String(err)}`);
						});
					return;
				}
				attached.store.echoUser(text, images);
				// steer_agent starts a turn on an idle agent and queues on a busy one, like the TUI's prompt().
				steerAgent(client, curFocus.agentId, text, mode === "followUp" ? "followUp" : "steer", images).catch(
					(err: unknown) => {
						attached.store.clearPendingUser();
						attached.store.restoreDraft({ text, images });
						notify("error", `Failed to send${err instanceof Error ? `: ${err.message}` : ""}`);
					},
				);
				return;
			}
			const btwMatch = /^\/btw(?:\s+(.*))?$/s.exec(text);
			if (btwMatch) {
				const q = (btwMatch[1] ?? "").trim();
				if (!q) {
					notify("info", "Usage: /btw <question>");
					return;
				}
				btw(client, q)
					.then(resp => {
						if (resp.success && resp.data?.record) {
							attached.store.startBtw({
								recordId: resp.data.record.id,
								question: resp.data.record.question,
								initialAnswer: resp.data.record.answer,
								status: resp.data.record.status,
							});
						}
					})
					.catch((err: unknown) => {
						notify("error", `Failed to start /btw: ${err instanceof Error ? err.message : String(err)}`);
					});
				return;
			}
			attached.store.echoUser(text, images);
			const promise =
				mode === "steer"
					? steer(client, text, images)
					: mode === "followUp"
						? followUp(client, text, images)
						: // Matches the TUI: if a turn started since the composer rendered idle
							// (or the idle state was stale), the prompt queues as a steer
							// instead of failing with AgentBusyError after the ack.
							sendPrompt(client, text, { images, streamingBehavior: "steer" }).then(resp => {
								if (resp.success && resp.data && resp.data.agentInvoked === false) {
									attached.store.clearPendingUser();
								}
							});
			if (mode === "prompt") lastPromptRef.current = { text, images };
			promise.catch((err: unknown) => {
				restoreFailedSend(attached.store, { text, images });
				notify("error", `Failed to send ${mode}${err instanceof Error ? `: ${err.message}` : ""}`);
			});
		},
		[instanceId, servers],
	);

	function restoreFailedSend(store: SessionStore, draft: ComposerDraft): void {
		store.clearPendingUser();
		const current = composerDraftRef.current;
		store.restoreDraft({
			text: [draft.text, current.text].filter(t => t.trim().length > 0).join("\n\n"),
			images: [...(draft.images ?? []), ...(current.images ?? [])],
		});
	}

	const handleAbort = useCallback((): void => {
		const attached = attachRef.current;
		if (!attached) return;
		const { client, store } = attached;
		const curFocus = snapRef.current.focus;
		if (curFocus) {
			// Interrupts only the focused agent's current turn; Stop never kills it.
			interruptAgent(client, curFocus.agentId).catch((err: unknown) => {
				notify("error", err instanceof Error ? err.message : "Failed to interrupt agent");
			});
			return;
		}
		abortAndRestoreQueue(client)
			.then(resp => {
				if (resp?.success && resp.data) {
					const cleared = [...(resp.data.steering ?? []), ...(resp.data.followUp ?? [])];
					store.clearAllPendingUser();
					const newDraft = restoreClearedMessagesToDraft(composerDraftRef.current, cleared);
					store.restoreDraft(newDraft);
				}
			})
			.catch(() => {
				notify("error", "Failed to abort");
			});
	}, []);

	const handleRename = useCallback(async (newName: string): Promise<boolean> => {
		const attached = attachRef.current;
		if (!attached) return false;
		const { client, store } = attached;
		try {
			const res = await setSessionName(client, newName);
			if (res.success) {
				store.refreshSessionState();
				notify("info", "Session renamed");
				return true;
			}
		} catch (err: unknown) {
			notify("error", err instanceof Error ? err.message : String(err));
		}
		return false;
	}, []);

	const handleRewind = useCallback(async (entryId: string): Promise<void> => {
		const attached = attachRef.current;
		if (!attached) return;
		const { client } = attached;
		try {
			await branch(client, entryId);
			notify("info", "Rewound session");
		} catch (err: unknown) {
			notify("error", err instanceof Error ? err.message : String(err));
		}
	}, []);

	const handleRetry = useCallback(async (): Promise<void> => {
		const attached = attachRef.current;
		if (!attached) return;
		const { client } = attached;
		try {
			await retry(client);
		} catch (err: unknown) {
			notify("error", err instanceof Error ? err.message : String(err));
		}
	}, []);

	// Derive header values
	const ss: RpcServerSessionState | null = snap.sessionState;
	const title = ss?.sessionName ?? liveCwd?.split("/").filter(Boolean).pop() ?? instanceId ?? "ompgui";
	const handleDraftRestored = useCallback(() => {
		attachRef.current?.store.clearRestoredDraft();
	}, []);

	const handleDraftChange = useCallback((d: ComposerDraft) => {
		composerDraftRef.current = d;
	}, []);
	const handleComplete = useCallback(
		(text: string, cursor: number, force: boolean, signal: AbortSignal) => {
			if (instanceId === null) return Promise.resolve(null);
			const ref = parseSessionKey(instanceId);
			if (!servers.get(ref.serverId)) return Promise.resolve(null);
			return servers.apiFor(ref.serverId).complete(ref.instanceId, text, cursor, force, signal);
		},
		[instanceId, servers],
	);

	const handleSetThinkingLevel = useCallback((level: ThinkingLevel) => {
		const client = attachRef.current?.client;
		if (client) setThinkingLevel(client, level).catch(() => notify("error", "Failed to set thinking level"));
	}, []);

	const sessionId = route.kind === "session" ? route.id : null;
	const handlePinnedFocusAgent = useCallback(
		(agent: string) => {
			if (sessionId !== null) navigate({ kind: "session", id: sessionId, panel: "agent", agent });
		},
		[sessionId],
	);

	const handlePinnedOpenHub = useCallback(() => {
		if (sessionId !== null) navigate({ kind: "session", id: sessionId, panel: "hub" });
	}, [sessionId]);

	const handlePinnedBack = useCallback(() => {
		if (sessionId !== null) navigate({ kind: "session", id: sessionId, panel: null });
	}, [sessionId]);

	// Panel rendering for narrow screens
	const narrowPanel = route.kind === "session" && route.panel !== null ? route.panel : null;

	const isSessionsPage = route.kind === "sessions";
	const client = attachRef.current?.client ?? null;
	const compacting = snap.compactionStartedAt !== null;

	const [ccOpen, setCcOpen] = useState(false);
	const closeCc = useCallback(() => setCcOpen(false), []);
	const toggleCc = useCallback(() => setCcOpen(v => !v), []);
	const [nowExpanded, setNowExpanded] = useState(false);
	const toggleNow = useCallback(() => setNowExpanded(v => !v), []);
	const wrenState = useSyncExternalStore(subscribeWren, getWrenState, getWrenState);
	const notices = useSyncExternalStore(subscribeNotices, getNotices, getNotices);
	const toggleVoice = useCallback(() => {
		if (getWrenState().enabled) disableVoice();
		else void enableVoice();
	}, []);
	const toggleExpandAll = useCallback(() => setExpandAll(v => !v), []);
	const [codeWrap, toggleCodeWrap] = useCodeWrap();

	// The thinking segment offers what the current model supports.
	const modelKey = ss?.model ? `${ss.model.provider}/${ss.model.id}` : null;
	const ready = snap.connection === "ready";
	const [thinkingLevels, setThinkingLevels] = useState<readonly ThinkingLevel[]>(FALLBACK_THINKING);
	useEffect(() => {
		setThinkingLevels(FALLBACK_THINKING);
		if (!client || !ready || modelKey === null) return;
		let live = true;
		getAvailableThinkingLevels(client)
			.then(resp => {
				if (live && resp.success && resp.data && resp.data.levels.length > 0) setThinkingLevels(resp.data.levels);
			})
			.catch(() => {});
		return () => {
			live = false;
		};
	}, [client, ready, modelKey]);
	const thinkingOptions = useMemo<ThinkingOption[]>(
		() => thinkingLevels.filter(level => level !== "inherit").map(level => ({ level, label: THINKING_LABEL[level] })),
		[thinkingLevels],
	);

	const handleTogglePlan = useCallback(() => {
		const c = attachRef.current?.client;
		const cur = snapRef.current.planState;
		if (!c || !cur) return;
		setPlanMode(c, !cur.enabled).catch(err => {
			notify("error", `Failed to set plan mode: ${err instanceof Error ? err.message : String(err)}`);
		});
	}, []);

	const handleAlertAction = useCallback(
		(id: string) => {
			const attached = attachRef.current;
			if (id === "dismiss") {
				const notice = getNotices().at(-1);
				if (notice) dismissNotice(notice.id);
			} else if (id === "back") exitFocus();
			else if (id === "retry") attached?.client.reconnectNow();
			else if (id === "open") attached?.store.reopenDialogSheet();
			else if ((id === "handoff" || id === "compact") && attached) {
				(id === "handoff" ? handoff(attached.client) : compact(attached.client)).catch((err: unknown) => {
					notify("error", err instanceof Error ? err.message : String(err));
				});
			}
		},
		[exitFocus],
	);

	const handleRemoveQueued = useCallback((message: string, queue: "steering" | "followUp") => {
		const c = attachRef.current?.client;
		if (!c) return;
		removeQueuedMessage(c, message, queue).catch((err: unknown) => {
			notify("error", `Failed to remove queued message${err instanceof Error ? `: ${err.message}` : ""}`);
		});
	}, []);

	const handleOpenPanel = useCallback(
		(panel: ControlCenterPanel) => {
			if (instanceId === null) return;
			const cur = parseRoute(browserWindow.location.hash);
			// A focused agent's todos are its own, shown read-only over the focus view.
			if (panel === "todos" && cur.kind === "session" && cur.panel === "agent" && cur.agent) {
				navigate({ ...cur, todos: true });
				return;
			}
			navigate({ kind: "session", id: instanceId, panel });
		},
		[instanceId],
	);

	// Live line + alert: the focused subagent replaces Main's activity and context.
	let lineFocus: LiveLineFocus | null = null;
	if (focus) {
		let tool: { toolName: string; startedAt: number } | null = null;
		for (const t of focus.transcript.activeTools.values()) {
			if (!tool || t.startedAt >= tool.startedAt) tool = t;
		}
		const window = focusMetrics?.contextWindow;
		lineFocus = {
			parentTitle: title,
			tool: tool?.toolName ?? null,
			since: tool?.startedAt ?? null,
			ctxPercent: window && focusMetrics?.contextTokens != null ? (focusMetrics.contextTokens / window) * 100 : null,
			cost: focusMetrics?.cost ?? null,
		};
	}
	const sessionView = instanceId !== null && !isSessionsPage;
	const line = sessionView
		? liveLine({
				snapshot: snap,
				focus: lineFocus,
				retry: client ? { attempt: client.reconnectAttempt, nextRetryAt: client.nextRetryAt } : undefined,
			})
		: null;
	const ctxPercent = ss?.contextUsage?.percent ?? null;
	const sessionAlerts = sessionView && currentStore !== null;
	const alert = pickAlert({
		notice: notices.at(-1) ?? null,
		...(sessionAlerts
			? {
					focusLabel: focus ? agentIdLabel(focus.agentId) : null,
					focusDetail: focus ? (focus.error ?? (focus.ready ? null : "Reviving agent...")) : null,
					offline: isOffline(snap),
					dialogCount: snap.dialogs.length,
					planTitle: snap.planReview ? snap.planReview.title || "Plan review" : null,
					dialogSheetOpen: snap.dialogSheetOpen,
					compacting,
					ctxPercent,
				}
			: {
					focusLabel: null,
					focusDetail: null,
					offline: false,
					dialogCount: 0,
					planTitle: null,
					dialogSheetOpen: false,
					compacting: false,
					ctxPercent: null,
				}),
	});

	const todoPhases = focus ? focus.todoPhases : (ss?.todoPhases ?? []);
	const todoProgress = countTodoProgress(todoPhases);
	const ccTodos =
		todoProgress.total > 0
			? {
					done: todoProgress.closed,
					total: todoProgress.total,
					current: todoPhases.flatMap(p => p.tasks).find(t => t.status === "in_progress")?.content ?? null,
				}
			: null;
	const runningAgents = pinnedRowsList.filter(r => r.status === "running");
	const contextWindow = ss?.contextUsage?.contextWindow;

	const topBar = (open: boolean) => (
		<TopBar
			title={isSessionsPage ? "ompgui" : title}
			line={line}
			onBack={route.kind === "session" ? () => navigate({ kind: "sessions" }) : undefined}
			ccOpen={open}
			onToggleCc={sessionView ? toggleCc : undefined}
		/>
	);

	return (
		<>
			<AppShell
				topbar={topBar(false)}
				sidebar={
					isSessionsPage
						? undefined
						: (collapseToggle: ReactNode) => (
								<SessionsScreen
									servers={servers}
									variant="sidebar"
									currentInstanceId={instanceId}
									currentSessionName={ss?.sessionName ?? null}
									onAttach={handleAttach}
									onShutdown={id => {
										if (id === instanceId) navigate({ kind: "sessions" });
									}}
									collapseToggle={collapseToggle}
								/>
							)
				}
				inspector={
					isHubRoute ? undefined : route.kind === "session" && route.panel === "todos" ? (
						<TodoPanel
							phases={snap.sessionState?.todoPhases ?? []}
							onUpdateTodos={phases => attachRef.current?.store.setTodos(phases) ?? Promise.resolve()}
						/>
					) : route.kind === "session" && route.panel !== "models" && route.panel !== "usage" ? (
						(collapseToggle: ReactNode) => (
							<PinnedSubagents
								rows={pinnedRowsList}
								onFocusAgent={handlePinnedFocusAgent}
								onDismiss={dismissAgent}
								onDismissAll={dismissAgents}
								onOpenHub={handlePinnedOpenHub}
								leading={collapseToggle}
							/>
						)
					) : route.kind === "session" && route.panel === "models" ? (
						hub.screen
					) : undefined
				}
				alert={alert ? <AlertStrip alert={alert} onAction={handleAlertAction} /> : undefined}
				now={
					sessionView && !wide && !isHubRoute ? (
						<NowStrip
							phases={todoPhases}
							agents={pinnedRowsList}
							expanded={nowExpanded}
							onToggle={toggleNow}
							onFocusAgent={handlePinnedFocusAgent}
						/>
					) : undefined
				}
				composer={
					instanceId && !isHubRoute ? (
						<Composer
							busy={focus ? focusStreaming : snap.streaming}
							compacting={compacting}
							commands={focus ? EMPTY_COMMANDS : snap.commands}
							focusedAgentId={focus?.agentId}
							draftKey={draftKey(instanceId, focus?.agentId)}
							onExitFocus={exitFocus}
							promptHistory={promptHistory}
							restoredDraft={snap.restoredDraft}
							onDraftRestored={handleDraftRestored}
							onDraftChange={handleDraftChange}
							onSend={handleSend}
							onAbort={handleAbort}
							complete={handleComplete}
						/>
					) : (
						<div />
					)
				}
			>
				{isSessionsPage ? (
					<SessionsScreen
						servers={servers}
						variant="page"
						currentInstanceId={instanceId}
						onAttach={handleAttach}
					/>
				) : isHubRoute && route.kind === "session" ? (
					<AgentHubScreen
						hub={snap.hub}
						sink={attachRef.current?.client ?? null}
						instanceId={route.id}
						focusAgentId={route.agent}
						onFocusAgent={agent => navigate({ kind: "session", id: route.id, panel: "agent", agent })}
						onClose={() => navigate({ kind: "session", id: route.id, panel: null })}
					/>
				) : (
					<>
						<TranscriptView
							key={focus ? `focus:${focus.agentId}` : "main"}
							toolHost={toolHost}
							state={focus ? focus.transcript : snap.transcript}
							historyLoaded={focus ? focus.loaded : snap.historyLoaded}
							connection={snap.connection}
							streaming={focus ? focusStreaming : snap.streaming}
							expandAll={expandAll}
							onLoadOlder={focus ? undefined : loadOlder}
							onRewind={focus ? undefined : handleRewind}
							onRetry={focus ? undefined : handleRetry}
							queue={focus ? undefined : snap.queue}
							onRemoveQueued={focus ? undefined : handleRemoveQueued}
						/>
					</>
				)}
			</AppShell>

			{sessionView && (
				<ControlCenter
					open={ccOpen}
					onClose={closeCc}
					header={topBar(true)}
					title={title}
					todos={ccTodos}
					agents={{ running: runningAgents.length, names: runningAgents.map(r => r.label) }}
					ctx={{
						percent: ctxPercent,
						level: ctxPercent === null ? "normal" : contextLevel(ctxPercent),
						cost: snap.stats ? fmtCost(snap.stats.cost) : null,
						window: contextWindow ? fmtTokens(contextWindow) : null,
					}}
					model={ss?.model?.name ?? null}
					thinking={ss?.thinkingLevel ?? null}
					thinkingOptions={thinkingOptions}
					onSetThinking={handleSetThinkingLevel}
					planMode={snap.planState?.enabled ?? false}
					onTogglePlan={handleTogglePlan}
					voice={wrenState.enabled}
					onToggleVoice={toggleVoice}
					expandAll={expandAll}
					onToggleExpandAll={toggleExpandAll}
					codeWrap={codeWrap}
					onToggleCodeWrap={toggleCodeWrap}
					busy={snap.streaming || compacting}
					sink={client}
					onRename={handleRename}
					onOpenPanel={handleOpenPanel}
					agentsPanel={wide ? "hub" : "subagents"}
				/>
			)}

			{/* Focused agent's todos: read-only, never routed through set_todos (that acts on Main). */}
			{route.kind === "session" && route.panel === "agent" && route.todos && focus && (
				<div className="sh-panel-overlay">
					<div className="sh-panel-header">
						<button
							type="button"
							className="tb-back"
							onClick={() => navigate({ kind: "session", id: route.id, panel: "agent", agent: route.agent })}
							aria-label="Back"
						>
							&#x2190;
						</button>
						<span className="sh-panel-title">Todos: {focus.agentId}</span>
					</div>
					<div className="sh-panel-body">
						<TodoPanel phases={focus.todoPhases} readOnly />
					</div>
				</div>
			)}
			{/* Narrow-screen panel overlays */}
			{narrowPanel === "todos" && (
				<div className="sh-panel-overlay">
					<div className="sh-panel-header">
						<button
							type="button"
							className="tb-back"
							onClick={() => {
								if (instanceId) {
									navigate({ kind: "session", id: instanceId, panel: null });
								}
							}}
							aria-label="Back"
						>
							&#x2190;
						</button>
						<span className="sh-panel-title">Todos</span>
					</div>
					<div className="sh-panel-body">
						<TodoPanel
							phases={snap.sessionState?.todoPhases ?? []}
							onUpdateTodos={phases => attachRef.current?.store.setTodos(phases) ?? Promise.resolve()}
						/>
					</div>
				</div>
			)}
			{narrowPanel === "info" && (
				<div className="sh-panel-overlay">
					<div className="sh-panel-header">
						<button
							type="button"
							className="tb-back"
							onClick={() =>
								navigate({
									kind: "session",
									id: (route as { id: string }).id,
									panel: null,
								})
							}
							aria-label="Back"
						>
							&#x2190;
						</button>
						<span className="sh-panel-title">Info</span>
					</div>
					<div className="sh-panel-body">
						<SessionInfo
							title={title}
							sessionState={ss}
							stats={snap.stats}
							instanceId={instanceId}
							onRename={instanceId ? handleRename : undefined}
						/>
					</div>
				</div>
			)}
			{narrowPanel === "models" && (
				<div className="sh-panel-overlay">
					<div className="sh-panel-header">
						<button
							type="button"
							className="tb-back"
							onClick={() =>
								navigate({
									kind: "session",
									id: (route as { id: string }).id,
									panel: null,
								})
							}
							aria-label="Back"
						>
							&#x2190;
						</button>
						<span className="sh-panel-title">Models</span>
					</div>
					<div className="sh-panel-body">{hub.screen}</div>
				</div>
			)}
			{narrowPanel === "subagents" && route.kind === "session" && (
				<div className="sh-panel-overlay">
					<PinnedSubagents
						rows={pinnedRowsList}
						onFocusAgent={handlePinnedFocusAgent}
						onDismiss={dismissAgent}
						onOpenHub={handlePinnedOpenHub}
						onBack={handlePinnedBack}
					/>
				</div>
			)}
			{narrowPanel === "usage" && (
				<div className="sh-panel-overlay">
					<UsageScreen
						sink={attachRef.current?.client ?? null}
						sessionState={ss}
						stats={snap.stats}
						onBack={() => {
							if (instanceId) {
								navigate({ kind: "session", id: instanceId, panel: null });
							}
						}}
					/>
				</div>
			)}

			{hub.sheet}
			{hub.loginSheet}
			<PlanReviewSheet review={snap.planReview} sink={attachRef.current?.client ?? null} />
			<ExtensionDialogSheet
				dialog={snap.dialogs[0] ?? null}
				queued={Math.max(0, snap.dialogs.length - 1)}
				onAnswer={response => attachRef.current?.store.answerDialog(response)}
			/>
			<BtwSheet
				btw={snap.btw}
				historyRecords={btwHistoryRecords}
				onCancel={() => {
					if (snap.btw && attachRef.current?.client) {
						btwCancel(attachRef.current.client, snap.btw.recordId).catch(() => {});
					}
				}}
				onClose={() => {
					attachRef.current?.store.clearBtw();
				}}
				onLoadHistory={() => {
					const client = attachRef.current?.client;
					if (!client) return;
					getBtwHistory(client)
						.then(resp => {
							if (resp.success && resp.data) {
								setBtwHistoryRecords(resp.data.records);
							}
						})
						.catch(() => {});
				}}
				onSelectRecord={record => {
					if (!snap.btw) return;
					attachRef.current?.store.startBtw({
						recordId: record.id,
						question: record.question,
						initialAnswer: record.answer,
						status: record.status,
					});
				}}
				onFollowUp={(question, recordId) => {
					const client = attachRef.current?.client;
					if (!client || !snap.btw) return;
					btw(client, question, recordId)
						.then(resp => {
							if (resp.success && resp.data?.record) {
								attachRef.current?.store.updateBtwFromRecord(resp.data.record);
							}
						})
						.catch((err: unknown) => {
							notify("error", `Failed to send follow-up: ${err instanceof Error ? err.message : String(err)}`);
						});
				}}
			/>
		</>
	);
}

// -------------------------------------------------------------------
// SessionInfo panel (simple key-value display)
// -------------------------------------------------------------------

function SessionInfo({
	title,
	sessionState,
	stats,
	instanceId,
	onRename,
}: {
	title: string;
	sessionState: RpcServerSessionState | null;
	stats: SessionStats | null;
	instanceId: string | null;
	onRename?: (newName: string) => Promise<boolean | void>;
}): ReactNode {
	const [editing, setEditing] = useState(false);
	const [editTitle, setEditTitle] = useState(title);

	if (!sessionState && !instanceId) {
		return <div style={{ padding: 16, color: "var(--fg-muted)" }}>No session</div>;
	}
	const rows: Array<[string, string]> = [];
	if (title) rows.push(["Title", title]);
	if (instanceId) rows.push(["Instance", instanceId]);
	if (sessionState?.sessionId) rows.push(["Session ID", sessionState.sessionId]);
	if (sessionState?.sessionFile) rows.push(["Session file", sessionState.sessionFile]);
	if (sessionState?.model) rows.push(["Model", sessionState.model.name]);
	if (stats) {
		rows.push(["Messages", String(stats.totalMessages)]);
		rows.push(["Cost", `$${stats.cost.toFixed(2)}`]);
		rows.push(["Tokens", String(stats.tokens.total)]);
	}
	return (
		<div style={{ padding: 16 }}>
			{rows.map(([k, v]) => (
				<div
					key={k}
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "8px 0",
						borderBottom: "1px solid var(--border)",
						fontSize: 14,
					}}
				>
					<span style={{ color: "var(--fg-muted)" }}>{k}</span>
					{k === "Title" && editing ? (
						<form
							onSubmit={async e => {
								e.preventDefault();
								const trimmed = editTitle.trim();
								if (trimmed && trimmed !== title) {
									await onRename?.(trimmed);
								}
								setEditing(false);
							}}
							style={{ display: "flex", gap: 6, maxWidth: "70%" }}
						>
							<input
								type="text"
								value={editTitle}
								autoFocus
								onChange={e => setEditTitle(e.target.value)}
								style={{
									padding: "2px 6px",
									background: "var(--bg)",
									border: "1px solid var(--border)",
									borderRadius: "var(--radius-sm)",
									color: "var(--fg)",
									// iOS Safari zooms into focused inputs below 16px and never zooms back.
									fontSize: 16,
									width: "140px",
								}}
							/>
							<button
								type="submit"
								disabled={!editTitle.trim()}
								style={{
									padding: "2px 8px",
									background: "var(--accent)",
									color: "var(--accent-fg, #fff)",
									border: "none",
									borderRadius: "var(--radius-sm)",
									fontSize: 12,
									cursor: "pointer",
								}}
							>
								Save
							</button>
							<button
								type="button"
								onClick={() => {
									setEditTitle(title);
									setEditing(false);
								}}
								style={{
									padding: "2px 6px",
									background: "none",
									color: "var(--fg-muted)",
									border: "1px solid var(--border)",
									borderRadius: "var(--radius-sm)",
									fontSize: 12,
									cursor: "pointer",
								}}
							>
								✕
							</button>
						</form>
					) : (
						<span
							style={{
								fontFamily: "var(--font-mono)",
								fontSize: 13,
								textAlign: "right",
								maxWidth: "60%",
								overflow: "hidden",
								textOverflow: "ellipsis",
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
							}}
						>
							<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
							{k === "Title" && onRename && (
								<button
									type="button"
									onClick={() => {
										setEditTitle(title);
										setEditing(true);
									}}
									style={{
										background: "none",
										border: "none",
										color: "var(--accent)",
										cursor: "pointer",
										fontSize: 12,
										padding: "2px 4px",
										textDecoration: "underline",
									}}
									aria-label="Rename session"
								>
									Edit
								</button>
							)}
						</span>
					)}
				</div>
			))}
		</div>
	);
}
