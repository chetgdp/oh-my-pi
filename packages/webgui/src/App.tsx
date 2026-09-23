import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from "react";
import type { ReactNode } from "react";
import { browserWindow, browserDocument } from "./lib/dom";
import { RpcWebClient } from "./lib/rpc-client";
import type { RpcConnectionState } from "./lib/rpc-client";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { createSessionStore } from "./lib/session-store";
import type { SessionStore, SessionSnapshot } from "./lib/session-store";
import { emptyTranscriptState } from "./lib/transcript-model";
import { EMPTY_SUBAGENT_STATE } from "./lib/subagent-model";
import { sendPrompt, steer, followUp, abort, setModel, setThinkingLevel } from "./lib/session-actions";
import type { ThinkingLevel } from "./lib/session-actions";
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
import type { ComposerModel } from "./components/composer/Composer";
import { useModelsHub } from "./components/models/useModelsHub";
import { AgentsPanel } from "./components/agents/AgentsPanel";
import { SessionsScreen } from "./components/sessions/SessionsScreen";
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

		let disposed = false;

		client
			.connect()
			.then(() => {
				if (disposed) {
					client.close();
					return;
				}

				const store = createSessionStore(client);
				attachRef.current = { client, store };
				setAttachKey(k => k + 1);
			})
			.catch(() => {
				notify("error", "Failed to connect to session");
			});

		return () => {
			disposed = true;
			if (attachRef.current) {
				attachRef.current.store.dispose();
				attachRef.current.client.close();
				attachRef.current = null;
			} else {
				client.close();
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
	const apiRef = useRef<SessionListApi>(createSessionsApi(browserWindow.location.origin));

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
		attached.store.echoUser(text);
		const promise =
			mode === "steer"
				? steer(client, text, images)
				: mode === "followUp"
					? followUp(client, text, images)
					: sendPrompt(client, text, { images }).then(resp => {
							if (resp.success && resp.data && resp.data.agentInvoked === false) {
								attached.store.clearPendingUser();
							}
						});
		promise.catch(() => {
			attached.store.clearPendingUser();
			notify("error", `Failed to send ${mode}`);
		});
	}

	function handleAbort(): void {
		const client = attachRef.current?.client;
		if (client) {
			abort(client).catch(() => {
				notify("error", "Failed to abort");
			});
		}
	}

	function handleReconnect(): void {
		const client = attachRef.current?.client;
		if (client) {
			notify("info", "Reconnecting to host...");
			client.reconnectNow();
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
						onReconnect={handleReconnect}
					/>
				}
				sidebar={
					<SessionsScreen
						api={apiRef.current}
						variant="sidebar"
						currentInstanceId={instanceId}
						onAttach={handleAttach}
					/>
				}
				inspector={
					route.kind === "session" && route.panel !== "models" ? (
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
				{snap.connection !== "ready" && (
					<ConnectionBanner connection={snap.connection} onReconnect={handleReconnect} />
				)}
				{isSessionsPage ? (
					<SessionsScreen
						api={apiRef.current}
						variant="page"
						currentInstanceId={instanceId}
						onAttach={handleAttach}
					/>
				) : (
					<TranscriptView state={snap.transcript} streaming={snap.streaming} expandAll={expandAll} />
				)}
			</AppShell>

			{/* Narrow-screen panel overlays */}
			{narrowPanel === "agents" && (
				<div className="sh-panel-overlay">
					<div className="sh-panel-header">
						<button
							type="button"
							className="tb-back"
							style={{ display: "flex" }}
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
			{narrowPanel === "info" && (
				<div className="sh-panel-overlay">
					<div className="sh-panel-header">
						<button
							type="button"
							className="tb-back"
							style={{ display: "flex" }}
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
						<SessionInfo title={title} sessionState={ss} stats={snap.stats} instanceId={instanceId} />
					</div>
				</div>
			)}
			{narrowPanel === "models" && (
				<div className="sh-panel-overlay">
					<div className="sh-panel-header">
						<button
							type="button"
							className="tb-back"
							style={{ display: "flex" }}
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

			{hub.sheet}

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
}: {
	title: string;
	sessionState: RpcSessionState | null;
	stats: SessionStats | null;
	instanceId: string | null;
}): ReactNode {
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
						padding: "8px 0",
						borderBottom: "1px solid var(--border)",
						fontSize: 14,
					}}
				>
					<span style={{ color: "var(--fg-muted)" }}>{k}</span>
					<span
						style={{
							fontFamily: "var(--font-mono)",
							fontSize: 13,
							textAlign: "right",
							maxWidth: "60%",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{v}
					</span>
				</div>
			))}
		</div>
	);
}
