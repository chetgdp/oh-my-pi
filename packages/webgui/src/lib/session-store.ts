/**
 * Framework-free external store for one attached RPC session.
 *
 * Designed for React's useSyncExternalStore but has no React dependency.
 * Subscribes to the client's event, state-change, and resync callbacks;
 * produces an immutable snapshot on every change.
 */

import type { RpcWebClient, RpcConnectionState, RpcSessionEvent } from "./rpc-client";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { TranscriptState } from "./transcript-model";
import type { SubagentTreeState } from "./subagent-model";
import { transcriptFromMessages, applyTranscriptEvent, emptyTranscriptState } from "./transcript-model";
import { EMPTY_SUBAGENT_STATE, applySubagentEvent } from "./subagent-model";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SessionSnapshot {
	connection: RpcConnectionState;
	transcript: TranscriptState;
	subagents: SubagentTreeState;
	sessionState: RpcSessionState | null;
	streaming: boolean;
}

export interface SessionStore {
	getSnapshot(): SessionSnapshot;
	subscribe(listener: () => void): () => void;
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

	let snapshot: SessionSnapshot = {
		connection,
		transcript,
		subagents,
		sessionState,
		streaming: transcript.working || (sessionState?.isStreaming ?? false),
	};

	function emit(): void {
		snapshot = {
			connection,
			transcript,
			subagents,
			sessionState,
			streaming: transcript.working || (sessionState?.isStreaming ?? false),
		};
		for (const fn of listeners) fn();
	}

	const unsubEvent = client.onEvent((event: RpcSessionEvent) => {
		transcript = applyTranscriptEvent(transcript, event);
		subagents = applySubagentEvent(subagents, event);
		emit();
	});

	const unsubState = client.onStateChange((state: RpcConnectionState) => {
		connection = state;
		emit();
	});

	// T21 adds onResync; call it if available, otherwise skip
	const unsubResync = (
		client as RpcWebClient & {
			onResync?: (fn: (messages: AgentMessage[], state: RpcSessionState) => void) => () => void;
		}
	).onResync?.((messages: AgentMessage[], state: RpcSessionState) => {
		transcript = transcriptFromMessages(messages);
		subagents = EMPTY_SUBAGENT_STATE;
		sessionState = state;
		emit();
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

		dispose(): void {
			unsubEvent();
			unsubState();
			unsubResync?.();
			listeners.clear();
		},
	};
}
