/**
 * Pure state model for RPC subagent frames.
 *
 * Consumes RpcSubagentFrame events and produces props for
 * webgui AgentsPanel.
 */
import type { AgentSnapshot, SubagentLifecyclePayload, SubagentProgressPayload } from "@oh-my-pi/pi-wire";
import type {
	RpcCommand,
	RpcSessionEventFrame,
	RpcSubagentLifecycleFrame,
	RpcSubagentProgressFrame,
	RpcSubagentSnapshot,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface SubagentNode {
	snapshot: AgentSnapshot;
	lifecycle: SubagentLifecyclePayload | undefined;
	progress: SubagentProgressPayload | undefined;
}

export interface SubagentTreeState {
	/** Keyed by subagent id. */
	readonly agents: ReadonlyMap<string, SubagentNode>;
}

export const EMPTY_SUBAGENT_STATE: SubagentTreeState = {
	agents: new Map(),
};

// ---------------------------------------------------------------------------
// Command the client sends on attach to receive subagent frames
// ---------------------------------------------------------------------------

export const SUBAGENT_SUBSCRIBE_COMMAND: RpcCommand = {
	type: "set_subagent_subscription",
	level: "progress",
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/** Registry parent from the dot-nested id (`A.B.C` -> `A.B`); top-level agents hang off Main. */
export function parentFromAgentId(id: string): string | undefined {
	const dot = id.lastIndexOf(".");
	return dot > 0 ? id.slice(0, dot) : undefined;
}

function snapshotStatus(status: SubagentLifecyclePayload["status"]): AgentSnapshot["status"] {
	switch (status) {
		case "started":
			return "running";
		case "completed":
			return "parked";
		case "failed":
			return "aborted";
		case "aborted":
			return "aborted";
	}
}

function progressSnapshotStatus(status: SubagentProgressPayload["progress"]["status"]): AgentSnapshot["status"] {
	if (status === "pending" || status === "running") return "running";
	return status === "completed" ? "parked" : "aborted";
}

function applyLifecycle(state: SubagentTreeState, frame: RpcSubagentLifecycleFrame): SubagentTreeState {
	const p = frame.payload;
	const existing = state.agents.get(p.id);
	const now = Date.now();

	const snapshot: AgentSnapshot = existing
		? {
				...existing.snapshot,
				status: snapshotStatus(p.status),
				lastActivity: now,
			}
		: {
				id: p.id,
				displayName: p.description ?? p.agent,
				kind: "sub",
				parentId: parentFromAgentId(p.id),
				status: snapshotStatus(p.status),
				hasSessionFile: p.sessionFile !== undefined,
				createdAt: now,
				lastActivity: now,
			};

	const next = new Map(state.agents);
	next.set(p.id, {
		snapshot,
		lifecycle: p,
		progress: existing?.progress,
	});
	return { agents: next };
}

function applyProgress(state: SubagentTreeState, frame: RpcSubagentProgressFrame): SubagentTreeState {
	const p = frame.payload;
	const id = p.progress.id;
	const existing = state.agents.get(id);
	const now = Date.now();

	const snapshot: AgentSnapshot = existing
		? {
				...existing.snapshot,
				status: progressSnapshotStatus(p.progress.status),
				lastActivity: now,
			}
		: {
				id,
				displayName: p.agent,
				kind: "sub",
				parentId: parentFromAgentId(id),
				status: progressSnapshotStatus(p.progress.status),
				hasSessionFile: p.sessionFile !== undefined,
				createdAt: now,
				lastActivity: now,
			};

	const next = new Map(state.agents);
	next.set(id, {
		snapshot,
		lifecycle: existing?.lifecycle,
		progress: p,
	});
	return { agents: next };
}

export function applySubagentEvent(state: SubagentTreeState, event: RpcSessionEventFrame): SubagentTreeState {
	switch (event.type) {
		case "subagent_lifecycle":
			return applyLifecycle(state, event);
		case "subagent_progress":
			return applyProgress(state, event);
		default:
			return state;
	}
}

// Projection: tree children map keyed by parent id
// ---------------------------------------------------------------------------

export interface AgentsPanelData {
	agents: readonly AgentSnapshot[];
	progress: ReadonlyMap<string, SubagentProgressPayload>;
	lifecycle: ReadonlyMap<string, SubagentLifecyclePayload>;
}

export function toAgentsPanelData(state: SubagentTreeState): AgentsPanelData {
	const agents: AgentSnapshot[] = [];
	const progress = new Map<string, SubagentProgressPayload>();
	const lifecycle = new Map<string, SubagentLifecyclePayload>();

	for (const [id, node] of state.agents) {
		agents.push(node.snapshot);
		if (node.progress) progress.set(id, node.progress);
		if (node.lifecycle) lifecycle.set(id, node.lifecycle);
	}

	return { agents, progress, lifecycle };
}

// ---------------------------------------------------------------------------
// Children projection: parent id -> child-ids map
// ---------------------------------------------------------------------------

/**
 * Build a map from parent agent id to child agent ids.
 * Agents without a parent are roots (value under key "").
 */
export function buildChildrenMap(state: SubagentTreeState): ReadonlyMap<string, string[]> {
	const children = new Map<string, string[]>();
	for (const [id, node] of state.agents) {
		const parentKey = node.snapshot.parentId ?? "";
		let list = children.get(parentKey);
		if (!list) {
			list = [];
			children.set(parentKey, list);
		}
		list.push(id);
	}
	return children;
}

// ---------------------------------------------------------------------------
// Rebuild SubagentTreeState from RpcSubagentSnapshot[] (resync / get_subagents)
// ---------------------------------------------------------------------------

export function subagentTreeFromSnapshots(snapshots: readonly RpcSubagentSnapshot[]): SubagentTreeState {
	const agents = new Map<string, SubagentNode>();
	for (let i = 0; i < snapshots.length; i++) {
		const s = snapshots[i];
		const agentSnapshot: AgentSnapshot = {
			id: s.id,
			displayName: s.description ?? s.agent,
			kind: "sub",
			parentId: parentFromAgentId(s.id),
			status: progressSnapshotStatus(s.status),
			hasSessionFile: s.sessionFile !== undefined,
			createdAt: s.lastUpdate,
			lastActivity: s.lastUpdate,
		};
		agents.set(s.id, {
			snapshot: agentSnapshot,
			lifecycle: undefined,
			progress: s.progress
				? {
						index: i,
						agent: s.agent,
						task: s.task ?? "",
						assignment: s.assignment,
						parentToolCallId: s.parentToolCallId,
						sessionFile: s.sessionFile,
						progress: s.progress,
					}
				: undefined,
		});
	}
	return { agents };
}

/**
 * Refresh from `get_subagents` without losing finished agents. The server
 * drops terminal agents from its snapshot, so a plain replace would erase an
 * agent from the sidebar the moment its parent's turn ended. Agents this
 * client saw finish stay; an agent last seen running but absent from the
 * snapshot ended while frames were missed, with an unknown outcome, so it
 * is dropped rather than shown with a guessed status.
 */
export function mergeSubagentSnapshots(
	prev: SubagentTreeState,
	snapshots: readonly RpcSubagentSnapshot[],
): SubagentTreeState {
	const fresh = subagentTreeFromSnapshots(snapshots);
	const agents = new Map(fresh.agents);
	for (const [id, node] of prev.agents) {
		if (!agents.has(id) && node.snapshot.status !== "running") agents.set(id, node);
	}
	return { agents };
}
