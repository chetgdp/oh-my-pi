/**
 * Framework-free external store for one attached RPC session.
 *
 * Designed for React's useSyncExternalStore but has no React dependency.
 * Subscribes to the client's event, state-change, and resync callbacks;
 * produces an immutable snapshot on every change.
 */

import type { RpcWebClient, RpcConnectionState, RpcSessionEvent, RpcResponseFor } from "./rpc-client";
import type { RpcSessionState, RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import type { TranscriptState } from "./transcript-model";
import type { SubagentTreeState } from "./subagent-model";
import { transcriptFromMessages, applyTranscriptEvent, emptyTranscriptState, addPendingUser } from "./transcript-model";
import { EMPTY_SUBAGENT_STATE, applySubagentEvent, subagentTreeFromSnapshots } from "./subagent-model";
import { notify } from "./notify";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SessionSnapshot {
	connection: RpcConnectionState;
	transcript: TranscriptState;
	subagents: SubagentTreeState;
	sessionState: RpcSessionState | null;
	stats: SessionStats | null;
	commands: readonly RpcAvailableSlashCommand[];
	streaming: boolean;
}

export interface SessionStore {
	getSnapshot(): SessionSnapshot;
	subscribe(listener: () => void): () => void;
	/** Show a submitted prompt immediately; the session's echo replaces it. */
	echoUser(text: string): void;
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

		transcript = applyTranscriptEvent(transcript, event);
		subagents = applySubagentEvent(subagents, event);
		emit();

		if (frame.type === "turn_end" || frame.type === "agent_end") {
			scheduleStatsRefresh();
			fetchSessionState();
		}
		if (frame.type === "model_changed" || frame.type === "thinking_level_changed" || frame.type === "config_update") {
			fetchSessionState();
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
		emit();
		// Re-fetch server-side state instead of resetting to empty
		fetchSubagents();
		fetchStats();
		fetchCommands();
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
