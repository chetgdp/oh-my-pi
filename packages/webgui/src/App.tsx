import { useState, useEffect, useRef, useSyncExternalStore, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { browserWindow, browserDocument } from "./lib/dom";
import { RpcWebClient, RpcIncompatibleError } from "./lib/rpc-client";
import type { RpcConnectionState } from "./lib/rpc-client";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { createSessionStore } from "./lib/session-store";
import type { SessionStore, SessionSnapshot } from "./lib/session-store";
import { emptyTranscriptState } from "./lib/transcript-model";
import { EMPTY_SUBAGENT_STATE } from "./lib/subagent-model";
import {
	sendPrompt,
	steer,
	followUp,
	abort,
	branch,
	retry,
	setModel,
	setSessionName,
	setThinkingLevel,
	restoreClearedMessagesToDraft,
	setPlanMode,
} from "./lib/session-actions";
import type { ThinkingLevel, ComposerDraft } from "./lib/session-actions";
import { parseRoute, navigate } from "./lib/route";
import type { Route } from "./lib/route";
import { notify } from "./lib/notify";
import { AppShell } from "./components/shell/AppShell";
import { TopBar } from "./components/shell/TopBar";
import { StatusStrip } from "./components/shell/StatusStrip";
import { ConnectionBanner } from "./components/shell/ConnectionBanner";
import { Toasts } from "./components/shell/Toasts";
import { TranscriptView } from "./components/transcript/Transcript";
import { Composer } from "./components/composer/Composer";
import { PlanReviewSheet } from "./components/plan/PlanReviewSheet";
import { extractUserPrompts } from "./lib/prompt-history";
import type { ComposerModel } from "./components/composer/Composer";
import { useModelsHub } from "./components/models/useModelsHub";
import { AgentsPanel } from "./components/agents/AgentsPanel";
import { TodoPanel } from "./components/todos/TodoPanel";
import { SessionsScreen } from "./components/sessions/SessionsScreen";
import { UsageScreen } from "./components/usage/UsageScreen";
import type { SessionListApi } from "./lib/sessions-api";
import { createSessionsApi } from "./lib/sessions-api";
import "./styles/app.css";
import "./components/shell/shell.css";

// -------------------------------------------------------------------
// WebSocket URL derivation
// -------------------------------------------------------------------

function wsUrl(instanceId: string): string {
	const proto = browserWindow.location.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${browserWindow.location.host}/ws/${instanceId}`;
}

// -------------------------------------------------------------------
// Empty snapshot constant
// -------------------------------------------------------------------

const EMPTY_SNAPSHOT: SessionSnapshot = {
	historyLoaded: false,
	connection: "closed" as RpcConnectionState,
	transcript: emptyTranscriptState(),
	subagents: EMPTY_SUBAGENT_STATE,
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
};

const NOOP_UNSUBSCRIBE = () => {};

// -------------------------------------------------------------------
// Hooks
// -------------------------------------------------------------------

function useRoute(): Route {
	const [route, setRoute] = useState<Route>(() => parseRoute(browserWindow.location.hash));

	useEffect(() => {
		function onHashChange(): void {
			setRoute(parseRoute(browserWindow.location.hash));
		}
		browserWindow.addEventListener("hashchange", onHashChange);
		return () => browserWindow.removeEventListener("hashchange", onHashChange);
	}, []);

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

	useViewportHeight();

	// Track client + store
	const attachRef = useRef<{
		client: RpcWebClient;
		store: SessionStore;
	} | null>(null);
	const lastPromptRef = useRef<ComposerDraft | null>(null);

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

		const client = new RpcWebClient({
			url: wsUrl(instanceId),
			reconnect: { enabled: true },
		} as ConstructorParameters<typeof RpcWebClient>[0]);
		const store = createSessionStore(client);
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

		let disposed = false;

		client.connect().catch(err => {
			if (disposed) return;
			if (!(err instanceof RpcIncompatibleError)) {
				notify("error", "Failed to connect to session");
			}
		});

		return () => {
			disposed = true;
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
	const loadOlder = useCallback(
		() => currentStore?.loadOlder() ?? Promise.resolve(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[attachKey],
	);
	const [expandAll, setExpandAll] = useState(false);

	const routeKey = route.kind === "session" ? `${route.id}:${route.panel}` : route.kind;
	const hub = useModelsHub({
		sink: attachRef.current?.client ?? null,
		snap,
		store: attachRef.current?.store ?? null,
		routeKey,
	});

	const composerModels: ComposerModel[] = snap.browser
		? snap.browser.models.map(m => ({
				id: m.id,
				name: m.name,
				provider: { id: m.provider, name: m.provider },
			}))
		: [];
	const promptHistory = useMemo(() => extractUserPrompts(snap.transcript), [snap.transcript]);
	const apiRef = useRef<SessionListApi>(createSessionsApi(browserWindow.location.origin));
	const composerDraftRef = useRef<ComposerDraft>({ text: "", images: [] });

	// The RPC session state carries no cwd; the daemon registry does.
	const [liveCwd, setLiveCwd] = useState<string | null>(null);
	useEffect(() => {
		setLiveCwd(null);
		if (instanceId === null) return;
		const ctrl = new AbortController();
		apiRef.current
			.listLive(ctrl.signal)
			.then(entries => setLiveCwd(entries.find(e => e.instanceId === instanceId)?.cwd ?? null))
			.catch(() => {});
		return () => ctrl.abort();
	}, [instanceId]);
	// Global keyboard shortcuts: Ctrl+P / Shift+Ctrl+P to cycle models
	useEffect(() => {
		function handleKeyDown(e: unknown) {
			const ev = e as KeyboardEvent;
			// Match Ctrl+P or Cmd+P (Mac)
			if ((ev.ctrlKey || ev.metaKey) && (ev.key === "p" || ev.key === "P")) {
				ev.preventDefault();
				ev.stopPropagation();
				hub.cycleRoleModel(ev.shiftKey ? "backward" : "forward");
			}
		}

		browserWindow.addEventListener("keydown", handleKeyDown);
		return () => browserWindow.removeEventListener("keydown", handleKeyDown);
	}, [hub]);

	// Handlers
	function handleAttach(id: string): void {
		navigate({ kind: "session", id, panel: null });
	}

	function handleSend(text: string, mode: "prompt" | "steer" | "followUp", images?: readonly string[]): void {
		const attached = attachRef.current;
		if (!attached) return;
		const { client } = attached;
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
	}

	function restoreFailedSend(store: SessionStore, draft: ComposerDraft): void {
		store.clearPendingUser();
		const current = composerDraftRef.current;
		store.restoreDraft({
			text: [draft.text, current.text].filter(t => t.trim().length > 0).join("\n\n"),
			images: [...(draft.images ?? []), ...(current.images ?? [])],
		});
	}

	function handleAbort(): void {
		const attached = attachRef.current;
		if (!attached) return;
		const { client, store } = attached;
		abort(client, { clearQueue: true })
			.then(resp => {
				// Keep pending rows if server returned no data (older omp ignoring clearQueue),
				// because the messages may still run. Only clear pending rows and restore to draft
				// when the server returns the cleared message list.
				const cleared =
					resp?.data?.cleared ??
					(resp?.data?.steering || resp?.data?.followUp
						? [...(resp.data.steering ?? []), ...(resp.data.followUp ?? [])]
						: undefined);
				if (cleared !== undefined) {
					store.clearAllPendingUser();
					const newDraft = restoreClearedMessagesToDraft(composerDraftRef.current, cleared);
					store.restoreDraft(newDraft);
				}
			})
			.catch(() => {
				notify("error", "Failed to abort");
			});
	}

	function handleReconnect(): void {
		const client = attachRef.current?.client;
		if (client) {
			notify("info", "Reconnecting to host...");
			client.reconnectNow();
		}
	}
	async function handleRename(newName: string): Promise<boolean> {
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
	}

	async function handleRewind(entryId: string): Promise<void> {
		const attached = attachRef.current;
		if (!attached) return;
		const { client } = attached;
		try {
			await branch(client, entryId);
			notify("info", "Rewound session");
		} catch (err: unknown) {
			notify("error", err instanceof Error ? err.message : String(err));
		}
	}

	async function handleRetry(): Promise<void> {
		const attached = attachRef.current;
		if (!attached) return;
		const { client } = attached;
		try {
			await retry(client);
		} catch (err: unknown) {
			notify("error", err instanceof Error ? err.message : String(err));
		}
	}

	// Derive header values
	const ss: RpcSessionState | null = snap.sessionState;
	const title = ss?.sessionName ?? liveCwd?.split("/").filter(Boolean).pop() ?? instanceId ?? "ompgui";
	const currentModel: ComposerModel | undefined = ss?.model
		? {
				id: ss.model.id,
				name: ss.model.name,
				provider: {
					id: ss.model.provider,
					name: ss.model.provider,
				},
			}
		: undefined;

	// Panel rendering for narrow screens
	const narrowPanel = route.kind === "session" && route.panel !== null ? route.panel : null;

	const isSessionsPage = route.kind === "sessions";

	return (
		<>
			<AppShell
				topbar={
					<TopBar
						title={isSessionsPage ? "ompgui" : title}
						connection={snap.connection === "reconnecting" ? "connecting" : snap.connection}
						route={route}
						subagentCount={snap.subagents.agents.size}
						sessionState={ss}
						streaming={snap.streaming}
						sink={attachRef.current?.client ?? null}
						onReconnect={handleReconnect}
						onRename={instanceId ? handleRename : undefined}
					/>
				}
				sidebar={
					isSessionsPage ? undefined : (
						<SessionsScreen
							api={apiRef.current}
							variant="sidebar"
							currentInstanceId={instanceId}
							currentSessionName={ss?.sessionName ?? null}
							onAttach={handleAttach}
						/>
					)
				}
				inspector={
					route.kind === "session" && route.panel === "todos" ? (
						<TodoPanel
							phases={snap.sessionState?.todoPhases ?? []}
							onUpdateTodos={phases => attachRef.current?.store.setTodos(phases) ?? Promise.resolve()}
						/>
					) : route.kind === "session" && route.panel !== "models" && route.panel !== "usage" ? (
						<AgentsPanel state={snap.subagents} />
					) : route.kind === "session" && route.panel === "models" ? (
						hub.screen
					) : undefined
				}
				statusStrip={
					instanceId ? (
						<StatusStrip
							sessionState={ss}
							stats={snap.stats}
							streaming={snap.streaming}
							expandAll={expandAll}
							onToggleExpand={() => setExpandAll(v => !v)}
							onPickModel={hub.openActivePicker}
							onPickThinking={hub.openActivePicker}
							onOpenTodos={() => {
								if (route.kind === "session") {
									navigate({ kind: "session", id: route.id, panel: "todos" });
								}
							}}
							planState={snap.planState}
							onTogglePlan={() => {
								const client = attachRef.current?.client;
								const cur = snap.planState;
								if (!client || !cur) return;
								setPlanMode(client, !cur.enabled).catch(err => {
									notify(
										"error",
										`Failed to set plan mode: ${err instanceof Error ? err.message : String(err)}`,
									);
								});
							}}
						/>
					) : undefined
				}
				composer={
					instanceId ? (
						<Composer
							busy={snap.streaming}
							models={composerModels}
							currentModel={currentModel}
							thinkingLevel={ss?.thinkingLevel}
							commands={snap.commands}
							promptHistory={promptHistory}
							restoredDraft={snap.restoredDraft}
							onDraftRestored={() => attachRef.current?.store.clearRestoredDraft()}
							onDraftChange={d => {
								composerDraftRef.current = d;
							}}
							onSend={handleSend}
							onAbort={handleAbort}
							onSetModel={(p: string, id: string) => {
								const client = attachRef.current?.client;
								if (client) setModel(client, p, id).catch(() => notify("error", "Failed to set model"));
							}}
							onSetThinkingLevel={(level: ThinkingLevel) => {
								const client = attachRef.current?.client;
								if (client)
									setThinkingLevel(client, level).catch(() => notify("error", "Failed to set thinking level"));
							}}
						/>
					) : (
						<div />
					)
				}
			>
				{currentStore && <ConnectionBanner connection={snap.connection} onReconnect={handleReconnect} />}
				{isSessionsPage ? (
					<SessionsScreen
						api={apiRef.current}
						variant="page"
						currentInstanceId={instanceId}
						onAttach={handleAttach}
					/>
				) : (
					<TranscriptView
						state={snap.transcript}
						historyLoaded={snap.historyLoaded}
						connection={snap.connection}
						streaming={snap.streaming}
						expandAll={expandAll}
						onLoadOlder={loadOlder}
						onRewind={handleRewind}
						onRetry={handleRetry}
					/>
				)}
			</AppShell>

			{/* Narrow-screen panel overlays */}
			{narrowPanel === "agents" && (
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
						<span className="sh-panel-title">Agents</span>
					</div>
					<div className="sh-panel-body">
						<AgentsPanel state={snap.subagents} />
					</div>
				</div>
			)}
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

			<Toasts />
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
	sessionState: RpcSessionState | null;
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
