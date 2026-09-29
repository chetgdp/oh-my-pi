import * as fs from "node:fs/promises";
import { isEnoent } from "@oh-my-pi/pi-utils";
import { type AgentRef, AgentRegistry } from "../../registry/agent-registry";
import type { AgentSession } from "../../session/agent-session";
import type { FileEntry, SessionMessageEntry } from "../../session/session-entries";
import { parseSessionEntries } from "../../session/session-loader";
import { type AgentProgress } from "@oh-my-pi/pi-tui/tools/task";
import {
	type SubagentEventPayload,
	type SubagentLifecyclePayload,
	type SubagentProgressPayload,
	TASK_SUBAGENT_EVENT_CHANNEL,
	TASK_SUBAGENT_LIFECYCLE_CHANNEL,
	TASK_SUBAGENT_PROGRESS_CHANNEL,
} from "../../task";
import type { EventBus } from "../../utils/event-bus";
import type {
	RpcSubagentEventFrame,
	RpcSubagentFrame,
	RpcSubagentMessagesResult,
	RpcSubagentSnapshot,
	RpcSubagentSubscriptionLevel,
} from "./rpc-types";

export interface RpcSubagentTranscriptSelector {
	subagentId?: string;
	sessionFile?: string;
	fromByte?: number;
}

type RpcSubagentOutput = (frame: RpcSubagentFrame) => void;

const MAX_RETAINED_TRANSCRIPT_REFERENCES = 256;

function isSessionMessageEntry(entry: FileEntry): entry is SessionMessageEntry {
	return entry.type === "message";
}

function statusFromLifecycle(status: SubagentLifecyclePayload["status"]): AgentProgress["status"] {
	return status === "started" ? "running" : status;
}

function isTerminalLifecycleStatus(status: SubagentLifecyclePayload["status"]): boolean {
	return status !== "started";
}

function hasSameOwner(
	payload: Pick<SubagentLifecyclePayload | SubagentProgressPayload, "parentToolCallId" | "sessionFile">,
	snapshot: RpcSubagentSnapshot,
): boolean {
	if (payload.parentToolCallId !== undefined && snapshot.parentToolCallId !== undefined) {
		return payload.parentToolCallId === snapshot.parentToolCallId;
	}
	if (payload.sessionFile !== undefined && snapshot.sessionFile !== undefined) {
		return payload.sessionFile === snapshot.sessionFile;
	}
	return true;
}

function addPruned(set: Set<string>, value: string, maxSize: number): void {
	set.delete(value);
	set.add(value);
	while (set.size > maxSize) {
		const oldest = set.keys().next();
		if (oldest.done) break;
		set.delete(oldest.value);
	}
}

const SENTINEL_BYTES = 64;

async function readSentinel(file: Bun.BunFile, endByte: number): Promise<Buffer> {
	const length = Math.min(SENTINEL_BYTES, endByte);
	if (length <= 0) return Buffer.alloc(0);
	return Buffer.from(await file.slice(endByte - length, endByte).arrayBuffer());
}

export interface RpcSubagentTranscriptCursor {
	fromByte?: number;
	fileId?: string;
	sentinel?: string;
}

/**
 * Reads complete JSONL entries from `fromByte`. SessionManager rewrites the
 * whole file atomically, so a byte offset alone cannot tell an append from a
 * rewrite that is at least as long. `fileId` (inode + birthtime) catches
 * rename-over rewrites and `sentinel` (the bytes ending at the cursor) catches
 * in-place ones; either mismatch restarts from byte 0 with `reset: true`.
 */
export async function readRpcSubagentTranscript(
	sessionFile: string,
	cursor: RpcSubagentTranscriptCursor = {},
): Promise<RpcSubagentMessagesResult> {
	const { fromByte = 0, fileId: priorFileId, sentinel: priorSentinel } = cursor;
	let startByte = Number.isFinite(fromByte) ? Math.max(0, Math.trunc(fromByte)) : 0;
	const file = Bun.file(sessionFile);
	let size: number;
	let fileId: string;
	try {
		const stat = await fs.stat(sessionFile);
		size = stat.size;
		fileId = `${stat.ino}:${stat.birthtimeMs}`;
	} catch (err) {
		if (!isEnoent(err)) throw err;
		return {
			sessionFile,
			fromByte: startByte,
			nextByte: startByte,
			reset: false,
			fileId: priorFileId ?? "",
			sentinel: priorSentinel ?? "",
			entries: [],
			messages: [],
		};
	}
	let reset = false;
	if (startByte > 0) {
		if (startByte > size || (priorFileId !== undefined && priorFileId !== fileId)) {
			reset = true;
		} else if (priorSentinel !== undefined) {
			const current = await readSentinel(file, startByte);
			if (!current.equals(Buffer.from(priorSentinel, "base64"))) reset = true;
		}
		if (reset) startByte = 0;
	}

	const text = startByte >= size ? "" : await file.slice(startByte).text();
	const lastNewline = text.lastIndexOf("\n");
	const completeText = lastNewline >= 0 ? text.slice(0, lastNewline + 1) : "";
	const entries = completeText.length > 0 ? parseSessionEntries(completeText) : [];
	const nextByte = startByte + Buffer.byteLength(completeText, "utf8");
	const sentinel = (await readSentinel(file, nextByte)).toString("base64");

	return {
		sessionFile,
		fromByte: startByte,
		nextByte,
		reset,
		fileId,
		sentinel,
		entries,
		messages: entries.filter(isSessionMessageEntry).map(entry => entry.message),
	};
}

export interface RpcSubagentSink {
	lifecycle(payload: SubagentLifecyclePayload): void;
	progress(payload: SubagentProgressPayload): void;
	event(payload: SubagentEventPayload): void;
}

/**
 * Subagent snapshots for one observability bus, shared by every RPC
 * connection on it. Snapshot state must outlive a connection: a client that
 * reconnects (a phone WebSocket drop, a page reload) asks `get_subagents` for
 * agents that started before it attached, and a per-connection snapshot map
 * would answer with nothing and then drop that agent's progress frames.
 */
class RpcSubagentTracker {
	static #byBus = new WeakMap<EventBus, RpcSubagentTracker>();

	static for(bus: EventBus): RpcSubagentTracker {
		let tracker = RpcSubagentTracker.#byBus.get(bus);
		if (!tracker) {
			tracker = new RpcSubagentTracker(bus);
			RpcSubagentTracker.#byBus.set(bus, tracker);
		}
		return tracker;
	}

	#subagents = new Map<string, RpcSubagentSnapshot>();
	#transcriptSessionFilesBySubagentId = new Map<string, string>();
	#staleSubagentIds = new Set<string>();
	#sinks = new Set<RpcSubagentSink>();

	// Subscriptions live as long as the bus: frames emitted while no client is
	// connected still have to land in the snapshot a later client fetches.
	constructor(bus: EventBus) {
		bus.on(TASK_SUBAGENT_LIFECYCLE_CHANNEL, data => {
			this.#handleLifecycle(data as SubagentLifecyclePayload);
		});
		bus.on(TASK_SUBAGENT_PROGRESS_CHANNEL, data => {
			this.#handleProgress(data as SubagentProgressPayload);
		});
		bus.on(TASK_SUBAGENT_EVENT_CHANNEL, data => {
			this.#handleEvent(data as SubagentEventPayload);
		});
	}

	addSink(sink: RpcSubagentSink): () => void {
		this.#sinks.add(sink);
		return () => this.#sinks.delete(sink);
	}

	clear(): void {
		for (const subagentId of this.#subagents.keys()) {
			addPruned(this.#staleSubagentIds, subagentId, MAX_RETAINED_TRANSCRIPT_REFERENCES);
		}
		for (const subagentId of this.#transcriptSessionFilesBySubagentId.keys()) {
			addPruned(this.#staleSubagentIds, subagentId, MAX_RETAINED_TRANSCRIPT_REFERENCES);
		}
		this.#subagents.clear();
		this.#transcriptSessionFilesBySubagentId.clear();
	}


	getSubagents(): RpcSubagentSnapshot[] {
		return [...this.#subagents.values()].sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
	}

	#rememberTranscriptSession(subagentId: string, sessionFile: string | undefined): void {
		if (!sessionFile) return;
		this.#transcriptSessionFilesBySubagentId.delete(subagentId);
		this.#transcriptSessionFilesBySubagentId.set(subagentId, sessionFile);
		while (this.#transcriptSessionFilesBySubagentId.size > MAX_RETAINED_TRANSCRIPT_REFERENCES) {
			const oldest = this.#transcriptSessionFilesBySubagentId.keys().next();
			if (oldest.done) break;
			this.#transcriptSessionFilesBySubagentId.delete(oldest.value);
		}
	}

	#hasTranscriptSessionFile(sessionFile: string): boolean {
		for (const snapshot of this.#subagents.values()) {
			if (snapshot.sessionFile === sessionFile) return true;
		}
		for (const transcriptSessionFile of this.#transcriptSessionFilesBySubagentId.values()) {
			if (transcriptSessionFile === sessionFile) return true;
		}
		return false;
	}

	#handleLifecycle(payload: SubagentLifecyclePayload): void {
		const existing = this.#subagents.get(payload.id);
		if (existing && !hasSameOwner(payload, existing)) return;
		if (!existing && payload.status !== "started") return;
		if (payload.status === "started") {
			this.#staleSubagentIds.delete(payload.id);
		}
		const sessionFile = payload.sessionFile ?? existing?.sessionFile;
		const snapshot: RpcSubagentSnapshot = {
			id: payload.id,
			index: payload.index,
			agent: payload.agent,
			agentSource: payload.agentSource,
			description: payload.description ?? existing?.description,
			status: statusFromLifecycle(payload.status),
			task: existing?.task,
			assignment: existing?.assignment,
			sessionFile,
			parentToolCallId: payload.parentToolCallId ?? existing?.parentToolCallId,
			lastUpdate: Date.now(),
			progress: existing?.progress,
			detached: payload.detached ?? existing?.detached,
		};
		this.#rememberTranscriptSession(payload.id, sessionFile);
		if (isTerminalLifecycleStatus(payload.status)) {
			this.#subagents.delete(payload.id);
		} else {
			this.#subagents.set(payload.id, snapshot);
		}
		for (const sink of this.#sinks) sink.lifecycle(payload);
	}

	#handleProgress(payload: SubagentProgressPayload): void {
		const progress = payload.progress;
		if (this.#staleSubagentIds.has(progress.id)) return;
		const existing = this.#subagents.get(progress.id);
		if (!existing) return;
		if (!hasSameOwner(payload, existing)) return;
		const sessionFile = payload.sessionFile ?? existing?.sessionFile;
		this.#rememberTranscriptSession(progress.id, sessionFile);
		this.#subagents.set(progress.id, {
			id: progress.id,
			index: payload.index,
			agent: payload.agent,
			agentSource: payload.agentSource,
			description: progress.description ?? existing?.description,
			status: progress.status,
			task: payload.task,
			assignment: payload.assignment,
			sessionFile,
			lastUpdate: Date.now(),
			parentToolCallId: payload.parentToolCallId ?? existing?.parentToolCallId,
			progress,
			detached: payload.detached ?? existing?.detached,
		});
		for (const sink of this.#sinks) sink.progress(payload);
	}

	#handleEvent(payload: SubagentEventPayload): void {
		if (this.#staleSubagentIds.has(payload.id)) return;
		for (const sink of this.#sinks) sink.event(payload);
	}

	resolveSessionFile(selector: RpcSubagentTranscriptSelector): string {
		if (selector.subagentId) {
			const snapshot = this.#subagents.get(selector.subagentId);
			const sessionFile = snapshot?.sessionFile ?? this.#transcriptSessionFilesBySubagentId.get(selector.subagentId);
			if (!sessionFile) {
				throw new Error(`Unknown subagent or session file unavailable: ${selector.subagentId}`);
			}
			return sessionFile;
		}

		if (selector.sessionFile) {
			if (this.#hasTranscriptSessionFile(selector.sessionFile)) return selector.sessionFile;
			throw new Error("Unknown subagent session file");
		}

		throw new Error("get_subagent_messages requires subagentId or sessionFile");
	}
}

/**
 * Start recording subagent snapshots on `bus` before any client connects, so
 * the first `get_subagents` also reports agents that were already running.
 */
export function trackRpcSubagents(bus: EventBus): void {
	RpcSubagentTracker.for(bus);
}

/** One RPC connection's view of the shared subagent snapshots, plus its frame subscription. */
export class RpcSubagentRegistry {
	#tracker: RpcSubagentTracker;
	#removeSink: (() => void) | undefined;
	#output: RpcSubagentOutput;
	#subscriptionLevel: RpcSubagentSubscriptionLevel = "off";

	constructor(observabilityBus: EventBus, output: RpcSubagentOutput) {
		this.#output = output;
		this.#tracker = RpcSubagentTracker.for(observabilityBus);
		this.#removeSink = this.#tracker.addSink({
			lifecycle: payload => {
				if (this.#subscriptionLevel !== "off") this.#output({ type: "subagent_lifecycle", payload });
			},
			progress: payload => {
				if (this.#subscriptionLevel !== "off") this.#output({ type: "subagent_progress", payload });
			},
			event: payload => {
				if (this.#subscriptionLevel !== "events") return;
				this.#output({ type: "subagent_event", payload } satisfies RpcSubagentEventFrame);
			},
		});
	}

	/** Detaches this connection; the shared snapshots stay for other and future connections. */
	dispose(): void {
		this.#removeSink?.();
		this.#removeSink = undefined;
	}

	/** Forgets every tracked subagent: the active session changed for all connections. */
	clear(): void {
		this.#tracker.clear();
	}

	/** Observe tracker lifecycle/progress/event traffic independent of the frame subscription level. */
	addSink(sink: RpcSubagentSink): () => void {
		return this.#tracker.addSink(sink);
	}

	setSubscriptionLevel(level: RpcSubagentSubscriptionLevel): void {
		this.#subscriptionLevel = level;
	}

	getSubscriptionLevel(): RpcSubagentSubscriptionLevel {
		return this.#subscriptionLevel;
	}

	getSubagents(): RpcSubagentSnapshot[] {
		return this.#tracker.getSubagents();
	}

	resolveSessionFile(selector: RpcSubagentTranscriptSelector): string {
		return this.#tracker.resolveSessionFile(selector);
	}
}

/** A running subagent from this session's roster, bound to its live registry ref. */
export interface RpcOwnedSubagent {
	ref: AgentRef;
	session: AgentSession;
}

/**
 * Resolve a `get_subagents` id to its running, live registry ref, or
 * `undefined` when the host must not reach it (unknown, finished, accepted,
 * parked, aborted, or another session's agent).
 *
 * Agent ids are unique only within one parent session's artifacts scope, and
 * the process-global registry keeps the latest ref per id, so the ref must
 * carry the transcript file this session's roster recorded
 * (`<artifactsDir>/<id>.jsonl`). The ref must also still be `running`: it goes
 * `idle` once the parent accepts its result, before the terminal lifecycle
 * frame prunes the roster, and a running ref always holds a live session.
 */
export function resolveOwnedLiveSubagent(
	subagentRegistry: Pick<RpcSubagentRegistry, "getSubagents">,
	subagentId: string,
): RpcOwnedSubagent | undefined {
	const snapshot = subagentRegistry.getSubagents().find(candidate => candidate.id === subagentId);
	// Progress can briefly report a terminal status before the terminal
	// lifecycle frame prunes the snapshot; treat that as not running.
	if ((snapshot?.status !== "running" && snapshot?.status !== "pending") || !snapshot.sessionFile) return undefined;
	const ref = AgentRegistry.global().get(subagentId);
	if (ref?.kind !== "sub" || ref.status !== "running" || !ref.session || ref.sessionFile !== snapshot.sessionFile) {
		return undefined;
	}
	return { ref, session: ref.session };
}
