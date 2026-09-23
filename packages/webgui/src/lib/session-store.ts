/**
 * Framework-free external store for one attached RPC session.
 *
 * Designed for React's useSyncExternalStore but has no React dependency.
 * Subscribes to the client's event, state-change, and resync callbacks;
 * produces an immutable snapshot on every change.
 */

import type { RpcWebClient, RpcConnectionState, RpcSessionEvent, RpcResponseFor } from "./rpc-client";
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
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import type { TranscriptState } from "./transcript-model";
import type { SubagentTreeState } from "./subagent-model";
import {
	transcriptFromMessages,
	applyTranscriptEvent,
	emptyTranscriptState,
	addPendingUser,
	clearPendingUser,
} from "./transcript-model";
import { EMPTY_SUBAGENT_STATE, applySubagentEvent, subagentTreeFromSnapshots } from "./subagent-model";
import { notify } from "./notify";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";

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
}

export interface SessionStore {
	getSnapshot(): SessionSnapshot;
	subscribe(listener: () => void): () => void;
	/** Show a submitted prompt immediately; the session's echo replaces it. */
	echoUser(text: string): void;
	clearPendingUser(): void;
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

	let transcript: TranscriptState = client.messages ? transcriptFromMessages(client.messages) : emptyTranscriptState();
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

	function fetchSubagents(): void {
		if (disposed) return;
		client
			.request({ type: "get_subagents" })
			.then((resp: RpcResponseFor<"get_subagents">) => {
				if (disposed) return;
				subagents = subagentTreeFromSnapshots(resp.data.subagents);
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

	// Initial attach-time fetches
	fetchStats();
	fetchCommands();
	fetchSubagents();
	fetchRoles();
	fetchAgentsConfig();
	fetchBrowser();
	fetchLoginStatus();
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

		transcript = applyTranscriptEvent(transcript, event);
		subagents = applySubagentEvent(subagents, event);
		emit();

		if (frame.type === "turn_end" || frame.type === "agent_end") {
			scheduleStatsRefresh();
			fetchSessionState();
			fetchSubagents();
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
	});

	const unsubResync = client.onResync((messages: AgentMessage[], state: RpcSessionState) => {
		// Atomic swap: build new transcript then replace -- no intermediate empty frame
		transcript = transcriptFromMessages(messages);
		sessionState = state;
		if (login && !login.result) {
			login = {
				...login,
				pending: undefined,
				result: { kind: "failed", error: "Connection lost", cancelled: true },
			};
		}
		emit();
		// Re-fetch server-side state instead of resetting to empty
		fetchSubagents();
		fetchStats();
		fetchCommands();
		fetchRoles();
		fetchAgentsConfig();
		fetchBrowser();
		fetchLoginStatus();
	});

	return {
		getSnapshot(): SessionSnapshot {
			return snapshot;
		},

		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		echoUser(text: string): void {
			transcript = addPendingUser(transcript, text);
			emit();
		},
		clearPendingUser(): void {
			transcript = clearPendingUser(transcript);
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
