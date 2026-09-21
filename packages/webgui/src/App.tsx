import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from "react";
import type { ReactNode } from "react";
import { browserWindow } from "./lib/dom";
import { RpcWebClient } from "./lib/rpc-client";
import type { RpcConnectionState } from "./lib/rpc-client";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { createSessionStore } from "./lib/session-store";
import type { SessionStore, SessionSnapshot } from "./lib/session-store";
import { emptyTranscriptState } from "./lib/transcript-model";
import { EMPTY_SUBAGENT_STATE, SUBAGENT_SUBSCRIBE_COMMAND } from "./lib/subagent-model";
import {
	sendPrompt,
	steer,
	followUp,
	abort,
	getAvailableModels,
	setModel,
	setThinkingLevel,
} from "./lib/session-actions";
import type { ThinkingLevel } from "./lib/session-actions";
import { AppShell } from "./components/shell/AppShell";
import { HeaderBar } from "./components/shell/HeaderBar";
import { TranscriptView } from "./components/transcript/Transcript";
import { Composer } from "./components/shell/Composer";
import type { ComposerModel } from "./components/shell/Composer";
import { AgentDrawer } from "./components/agents/AgentDrawer";
import type { SessionListApi } from "./lib/sessions-api";
import { createSessionsApi } from "./lib/sessions-api";
import { SessionList } from "./components/shell/SessionList";
import "./styles/app.css";
import "./components/shell/shell.css";

// -------------------------------------------------------------------
// Hash routing
// -------------------------------------------------------------------

const SESSION_HASH_PREFIX = "#/s/";

function readInstanceId(): string | null {
	const hash = browserWindow.location.hash;
	if (hash.startsWith(SESSION_HASH_PREFIX)) {
		return hash.slice(SESSION_HASH_PREFIX.length) || null;
	}
	return null;
}

function setInstanceHash(id: string): void {
	browserWindow.location.hash = SESSION_HASH_PREFIX + id;
}

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
	streaming: false,
};

const NOOP_UNSUBSCRIBE = () => {};

// -------------------------------------------------------------------
// App
// -------------------------------------------------------------------

export function App(): ReactNode {
	const [instanceId, setInstanceId] = useState<string | null>(readInstanceId);
	const [sessionListOpen, setSessionListOpen] = useState(instanceId === null);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [models, setModels] = useState<ComposerModel[]>([]);

	// Track client + store; ref avoids stale closures in effect cleanup
	const attachRef = useRef<{ client: RpcWebClient; store: SessionStore } | null>(null);

	// Bumped on attach to invalidate useSyncExternalStore bindings
	const [attachKey, setAttachKey] = useState(0);

	// Hash change listener
	useEffect(() => {
		function onHashChange(): void {
			const id = readInstanceId();
			setInstanceId(id);
			if (id === null) setSessionListOpen(true);
		}
		browserWindow.addEventListener("hashchange", onHashChange);
		return () => browserWindow.removeEventListener("hashchange", onHashChange);
	}, []);

	// Attach to session when instanceId changes
	useEffect(() => {
		// Tear down previous
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

				// Subscribe to subagent events (best-effort)
				client.request(SUBAGENT_SUBSCRIBE_COMMAND as Parameters<typeof client.request>[0]).catch(() => {});

				const store = createSessionStore(client);
				attachRef.current = { client, store };
				setAttachKey(k => k + 1);

				// Fetch models (non-fatal)
				getAvailableModels(client)
					.then(resp => {
						if (
							resp &&
							typeof resp === "object" &&
							"data" in resp &&
							resp.data &&
							typeof resp.data === "object" &&
							"models" in resp.data
						) {
							setModels((resp.data as { models: ComposerModel[] }).models);
						}
					})
					.catch(() => {});
			})
			.catch(() => {
				// connection failed
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
		// attachKey forces re-bind when store changes
		[attachKey], // eslint-disable-line react-hooks/exhaustive-deps
	);
	const getSnapshot = useCallback(
		() => currentStore?.getSnapshot() ?? EMPTY_SNAPSHOT,
		[attachKey], // eslint-disable-line react-hooks/exhaustive-deps
	);
	const snap = useSyncExternalStore(subscribe, getSnapshot);

	// Session list API (stable across renders)
	const apiRef = useRef<SessionListApi>(createSessionsApi(browserWindow.location.origin));

	// Handlers
	function handleAttach(id: string): void {
		setInstanceHash(id);
		setSessionListOpen(false);
	}

	function handleSend(text: string, mode: "prompt" | "steer" | "followUp"): void {
		const client = attachRef.current?.client;
		if (!client) return;
		if (mode === "steer") steer(client, text);
		else if (mode === "followUp") followUp(client, text);
		else sendPrompt(client, text);
	}

	function handleAbort(): void {
		const client = attachRef.current?.client;
		if (client) abort(client);
	}

	function handleSetModel(provider: string, modelId: string): void {
		const client = attachRef.current?.client;
		if (client) setModel(client, provider, modelId);
	}

	function handleSetThinkingLevel(level: ThinkingLevel): void {
		const client = attachRef.current?.client;
		if (client) setThinkingLevel(client, level);
	}

	// Derive header values
	const ss: RpcSessionState | null = snap.sessionState;
	const title = ss?.sessionName ?? instanceId ?? "omp";
	const currentModel: ComposerModel | undefined = ss?.model
		? {
				id: ss.model.id,
				name: ss.model.name,
				provider: { id: ss.model.provider, name: ss.model.provider },
			}
		: undefined;

	return (
		<>
			<AppShell
				header={
					<>
						<HeaderBar
							title={title}
							connection={snap.connection === "reconnecting" ? "connecting" : snap.connection}
							onOpenSessions={() => setSessionListOpen(true)}
						/>
						<button
							type="button"
							className="sh-agents-btn"
							onClick={() => setDrawerOpen(o => !o)}
							aria-label="Toggle subagents"
						>
							&#x25A4;
						</button>
					</>
				}
				composer={
					<Composer
						busy={snap.streaming}
						models={models}
						currentModel={currentModel}
						thinkingLevel={ss?.thinkingLevel}
						onSend={handleSend}
						onAbort={handleAbort}
						onSetModel={handleSetModel}
						onSetThinkingLevel={handleSetThinkingLevel}
					/>
				}
			>
				<TranscriptView state={snap.transcript} streaming={snap.streaming} />
			</AppShell>
			<AgentDrawer state={snap.subagents} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
			<SessionList
				open={sessionListOpen}
				onClose={() => setSessionListOpen(false)}
				onAttach={handleAttach}
				api={apiRef.current}
			/>
		</>
	);
}
