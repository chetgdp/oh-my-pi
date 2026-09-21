/**
 * Pure state model for RPC subagent frames.
 *
 * Consumes RpcSubagentFrame events and produces props compatible
 * with collab-web AgentsPanel / AgentDrawer.
 */
import type { AgentSnapshot, SubagentLifecyclePayload, SubagentProgressPayload } from "@oh-my-pi/pi-wire";
import type {
	RpcCommand,
	RpcSessionEventFrame,
	RpcSubagentLifecycleFrame,
	RpcSubagentProgressFrame,
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
				parentId: p.parentToolCallId,
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
				status: snapshotStatus(
					p.progress.status === "running"
						? "started"
						: p.progress.status === "pending"
							? "started"
							: p.progress.status,
				),
				lastActivity: now,
			}
		: {
				id,
				displayName: p.agent,
				kind: "sub",
				parentId: p.parentToolCallId,
				status: "running",
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

// ---------------------------------------------------------------------------
// Projection to collab-web AgentsPanel props
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
