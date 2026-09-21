import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AgentDrawer } from "./components/agents/AgentDrawer";
import { AgentsPanel } from "./components/agents/AgentsPanel";
import { Banners } from "./components/shell/Banners";
import { Composer } from "./components/shell/Composer";
import { ConnectScreen } from "./components/shell/ConnectScreen";
import { HeaderBar } from "./components/shell/HeaderBar";
import { Toasts } from "./components/shell/Toasts";
import { Transcript } from "./components/transcript/Transcript";
import { GuestClient } from "./lib/client";
import { RpcWebClient } from "./lib/rpc-web-client";
import type { SessionClient } from "./lib/session-client";
import type { ToolRenderHost } from "./tool-render";
import "./components/shell/shell.css";

const NAME_KEY = "omp.collab.name";

interface Creds {
	link: string;
	name: string;
}

function storedName(): string {
	try {
		return localStorage.getItem(NAME_KEY) ?? "guest";
	} catch {
		return "guest";
	}
}

/** Deep link = everything after the FIRST `#` (legacy links carry a second `#` inside the fragment). */
function hashLink(): string | null {
	const href = window.location.href;
	const i = href.indexOf("#");
	if (i < 0 || i + 1 >= href.length) return null;
	return href.slice(i + 1);
}

export function App(): ReactNode {
	const link = hashLink();
	// Direct RPC mode when no collab link in the URL hash
	if (!link) return <DirectApp />;
	return <CollabApp initialLink={link} />;
}

/** Direct connection to a local OMP daemon via WebSocket RPC. */
function DirectApp(): ReactNode {
	const [client] = useState(() => {
		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		const host = window.location.port === "5173" ? "localhost:8081" : window.location.host;
		return new RpcWebClient(`${proto}//${host}/ws`);
	});
	const snap = useSyncExternalStore(
		cb => client.subscribe(cb),
		() => client.getSnapshot(),
		() => client.getSnapshot(),
	);

	useEffect(() => {
		document.title = snap.state?.sessionName ? `${snap.state.sessionName} · omp` : "omp";
	}, [snap.state?.sessionName]);

	useEffect(() => () => client.close(), [client]);

	return (
		<Session
			client={client}
			rpcClient={client}
			onLeave={() => {}}
			onRejoin={() => {
				client.close();
				window.location.reload();
			}}
		/>
	);
}

/** Collab mode: join a shared session via relay link. */
function CollabApp({ initialLink }: { initialLink: string }): ReactNode {
	const [client, setClient] = useState<GuestClient | null>(null);
	const [connectError, setConnectError] = useState<string | null>(null);
	const credsRef = useRef<Creds | null>(null);

	const connect = useCallback((lnk: string, name: string): void => {
		let next: GuestClient;
		try {
			next = new GuestClient(lnk, name);
		} catch (err) {
			setConnectError(err instanceof Error ? err.message : String(err));
			return;
		}
		next.connect();
		try {
			localStorage.setItem(NAME_KEY, name);
		} catch {
			// storage unavailable (private mode)
		}
		credsRef.current = { link: lnk, name };
		window.location.hash = lnk;
		setConnectError(null);
		setClient(prev => {
			prev?.close();
			return next;
		});
	}, []);

	const leave = useCallback((): void => {
		setClient(prev => {
			prev?.close();
			return null;
		});
		history.replaceState(null, "", window.location.pathname + window.location.search);
	}, []);

	const rejoin = useCallback((): void => {
		const creds = credsRef.current;
		if (creds) connect(creds.link, creds.name);
	}, [connect]);

	// Visual Viewport mobile keyboard handling
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const updateHeight = () => {
			document.documentElement.style.setProperty("--viewport-height", `${vv.height}px`);
			window.scrollTo(0, 0);
		};
		updateHeight();
		vv.addEventListener("resize", updateHeight);
		vv.addEventListener("scroll", updateHeight);
		return () => {
			vv.removeEventListener("resize", updateHeight);
			vv.removeEventListener("scroll", updateHeight);
		};
	}, []);

	// Deep link auto-connect
	useEffect(() => {
		if (initialLink) connect(initialLink, storedName());
	}, [connect, initialLink]);

	useEffect(() => {
		if (!client) document.title = "omp collab";
	}, [client]);

	if (!client) {
		return <ConnectScreen defaultName={storedName()} error={connectError} onConnect={connect} />;
	}
	return <Session client={client} onLeave={leave} onRejoin={rejoin} />;
}

interface SessionProps {
	client: SessionClient;
	rpcClient?: RpcWebClient;
	onLeave(): void;
	onRejoin(): void;
}

function Session({ client, rpcClient, onLeave, onRejoin }: SessionProps): ReactNode {
	const snap = useSyncExternalStore(
		cb => client.subscribe(cb),
		() => client.getSnapshot(),
		() => client.getSnapshot(),
	);
	const [railOpen, setRailOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [sessionModalOpen, setSessionModalOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const autoOpenedRef = useRef(false);

	const subCount = useMemo(() => snap.agents.filter(a => a.kind === "sub").length, [snap.agents]);

	// Task-card agent chips drill into the same drawer the rail uses.
	const agentIds = useMemo(() => new Set(snap.agents.map(a => a.id)), [snap.agents]);
	const toolHost = useMemo<ToolRenderHost>(
		() => ({
			hasAgent: id => agentIds.has(id),
			openAgent: id => {
				if (agentIds.has(id)) setSelectedId(id);
			},
		}),
		[agentIds],
	);

	// Auto-open the rail the first time a subagent appears.
	useEffect(() => {
		if (subCount > 0 && !autoOpenedRef.current) {
			autoOpenedRef.current = true;
			setRailOpen(true);
		}
	}, [subCount]);

	const title = snap.header?.title ?? snap.state?.sessionName ?? "session";
	useEffect(() => {
		document.title = `${title} · omp`;
	}, [title]);

	const drawerAgent = selectedId != null ? snap.agents.find(a => a.id === selectedId) : undefined;
	const toggleRail = useCallback(() => setRailOpen(open => !open), []);
	const closeDrawer = useCallback(() => setSelectedId(null), []);

	// Global keyboard shortcuts
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

			if (e.key === "Escape") {
				if (shortcutsOpen) {
					setShortcutsOpen(false);
					return;
				}
				if (sessionModalOpen) {
					setSessionModalOpen(false);
					return;
				}
				return;
			}

			if (inInput) return;

			if (e.key === "?") {
				e.preventDefault();
				setShortcutsOpen(prev => !prev);
				return;
			}
			if (e.key === "n") {
				e.preventDefault();
				rpcClient?.newSession();
				return;
			}
			if (e.key === "k") {
				e.preventDefault();
				setSessionModalOpen(true);
				return;
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [rpcClient, shortcutsOpen, sessionModalOpen]);

	return (
		<div className="sh-app">
			<div className="sh-ambient" />
			<HeaderBar
				header={snap.header}
				state={snap.state}
				phase={snap.phase}
				readOnly={snap.readOnly}
				subCount={subCount}
				railOpen={railOpen}
				onToggleRail={toggleRail}
				onLeave={onLeave}
				rpcClient={rpcClient}
				sessionModalOpen={sessionModalOpen}
				onSessionModalChange={setSessionModalOpen}
			/>
			<main className="sh-main">
				<section className="sh-panel" data-rail={railOpen ? "true" : "false"}>
					<div className="sh-transcript">
						<Transcript
							entries={snap.entries}
							stream={snap.stream}
							streamDone={snap.streamDone}
							activeTools={snap.activeTools}
							working={snap.working}
							host={toolHost}
							phase={snap.phase}
						/>
					</div>
					<Composer
						client={client}
						phase={snap.phase}
						readOnly={snap.readOnly}
						uiRequest={snap.uiRequest}
						working={snap.working}
						queuedMessageCount={snap.state?.queuedMessageCount ?? 0}
					/>
				</section>
				{railOpen && (
					<>
						<div className="sh-rail-backdrop" onClick={() => setRailOpen(false)} />
						<aside className="sh-rail">
							<AgentsPanel
								agents={snap.agents}
								progress={snap.progress}
								lifecycle={snap.lifecycle}
								selectedId={selectedId}
								onSelect={setSelectedId}
							/>
						</aside>
					</>
				)}
			</main>
			{drawerAgent && (
				<>
					<div className="ag-drawer-backdrop" onClick={closeDrawer} />
					<AgentDrawer
						agent={drawerAgent}
						progress={snap.progress.get(drawerAgent.id)}
						lifecycle={snap.lifecycle.get(drawerAgent.id)}
						client={client}
						readOnly={snap.readOnly}
						host={toolHost}
						onClose={closeDrawer}
					/>
				</>
			)}
			<Banners
				phase={snap.phase}
				endedReason={snap.endedReason}
				loading={snap.loading}
				onRejoin={onRejoin}
				onNewLink={onLeave}
			/>
			<Toasts notices={snap.notices} />
			{shortcutsOpen && <KeyboardShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
		</div>
	);
}

const SHORTCUTS: ReadonlyArray<{ key: string; label: string }> = [
	{ key: "?", label: "Toggle keyboard shortcuts" },
	{ key: "n", label: "New session" },
	{ key: "k", label: "Open session switcher" },
	{ key: "Esc", label: "Close overlay" },
];

function KeyboardShortcutsOverlay({ onClose }: { onClose(): void }): ReactNode {
	return (
		<div className="ss-backdrop" onClick={onClose}>
			<div
				className="sh-shortcuts-dialog"
				onClick={e => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="Keyboard Shortcuts"
			>
				<h3 style={{ margin: "0 0 12px", fontSize: "var(--text-base)", color: "var(--fg)" }}>Keyboard Shortcuts</h3>
				{SHORTCUTS.map(s => (
					<div key={s.key} className="sh-shortcut-row">
						<span>{s.label}</span>
						<kbd className="sh-shortcut-key">{s.key}</kbd>
					</div>
				))}
			</div>
		</div>
	);
}
