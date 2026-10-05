/**
 * Pure state model for the Agent Hub screen.
 *
 * The server roster (`get_agent_roster` + `agent_registry` frames) is the
 * source of truth; `subagent_progress` frames only refine rows between
 * registry pushes. Finished agents are retained client-side so a row does not
 * vanish when the host stops reporting it.
 */
import type {
	AgentProgress,
	AgentRegistryFrame,
	AgentRosterEntry,
	AgentRosterMetrics,
	SubagentLifecyclePayload,
	SubagentProgressPayload,
} from "@oh-my-pi/pi-wire";
import type { RpcServerSubagentMessagesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { parentFromAgentId } from "./subagent-model";

export const MAIN_AGENT_ID = "Main";

/** "A.B.C" -> "A>B>C"; displayName is not unique (many agents are just "task"), the id is. */
export function agentIdLabel(id: string): string {
	return id.split(".").join(">");
}

export type AgentStatus = AgentRosterEntry["status"];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface AgentHubState {
	readonly agents: ReadonlyMap<string, AgentRosterEntry>;
	/** True once a roster response or registry frame arrived; progress frames before that are ignored by the store. */
	readonly loaded: boolean;
}

export const EMPTY_AGENT_HUB_STATE: AgentHubState = { agents: new Map(), loaded: false };

/** Resolve the metrics the TUI projection shows: progress first, then the roster's own. */
export function entryMetrics(entry: AgentRosterEntry): AgentRosterMetrics | undefined {
	const p = entry.progress;
	if (p) {
		return {
			tokens: p.tokens,
			requests: p.requests,
			tools: p.toolCount,
			cost: p.cost,
			durationMs: p.durationMs,
			contextTokens: p.contextTokens,
			contextWindow: p.contextWindow,
		};
	}
	return entry.metrics;
}

/**
 * Replace the roster with a full server snapshot. Agents this client has
 * that the server no longer lists are kept when they were finished; one last
 * seen running has an unknown outcome and is dropped.
 */
export function applyRoster(state: AgentHubState, entries: readonly AgentRosterEntry[]): AgentHubState {
	const agents = new Map<string, AgentRosterEntry>();
	for (const entry of entries) agents.set(entry.id, entry);
	for (const [id, prev] of state.agents) {
		if (!agents.has(id) && prev.status !== "running" && prev.kind !== "main") agents.set(id, prev);
	}
	return { agents, loaded: true };
}

export function applyRegistryFrame(state: AgentHubState, frame: AgentRegistryFrame): AgentHubState {
	const agents = new Map(state.agents);
	if (frame.op === "removed") {
		if (!agents.delete(frame.id)) return state;
		return { agents, loaded: state.loaded };
	}
	const prev = agents.get(frame.agent.id);
	// A registry upsert can omit progress the row already accumulated.
	agents.set(
		frame.agent.id,
		prev && !frame.agent.progress && prev.progress ? { ...frame.agent, progress: prev.progress } : frame.agent,
	);
	return { agents, loaded: true };
}

function statusFromProgress(status: AgentProgress["status"]): AgentStatus {
	if (status === "pending" || status === "running") return "running";
	return status === "completed" ? "parked" : "aborted";
}

function statusFromLifecycle(status: SubagentLifecyclePayload["status"]): AgentStatus {
	return status === "started" ? "running" : status === "completed" ? "parked" : "aborted";
}

function newSubEntry(id: string, agent: string, now: number): AgentRosterEntry {
	return {
		id,
		displayName: id.slice(id.lastIndexOf(".") + 1),
		kind: "sub",
		parentId: parentFromAgentId(id) ?? MAIN_AGENT_ID,
		status: "running",
		agent,
		createdAt: now,
		lastActivity: now,
	};
}

export function applySubagentProgress(
	state: AgentHubState,
	payload: SubagentProgressPayload,
	now: number = Date.now(),
): AgentHubState {
	const id = payload.progress.id;
	const prev = state.agents.get(id) ?? newSubEntry(id, payload.agent, now);
	const p = payload.progress;
	// Registry `idle` is a live-but-waiting agent; a terminal progress frame must not overwrite it.
	const status =
		p.status === "pending" || p.status === "running"
			? "running"
			: prev.status === "idle"
				? "idle"
				: statusFromProgress(p.status);
	const next: AgentRosterEntry = {
		...prev,
		status,
		agent: prev.agent ?? payload.agent,
		description: prev.description ?? p.description,
		task: prev.task ?? payload.progress.task,
		activity: p.currentTool ?? p.lastIntent ?? prev.activity,
		sessionFile: prev.sessionFile ?? payload.sessionFile,
		lastActivity: now,
		detached: payload.detached ?? prev.detached,
		progress: p,
	};
	const agents = new Map(state.agents);
	agents.set(id, next);
	return { agents, loaded: state.loaded };
}

export function applySubagentLifecycle(
	state: AgentHubState,
	payload: SubagentLifecyclePayload,
	now: number = Date.now(),
): AgentHubState {
	const prev = state.agents.get(payload.id) ?? newSubEntry(payload.id, payload.agent, now);
	const status = statusFromLifecycle(payload.status);
	const agents = new Map(state.agents);
	agents.set(payload.id, {
		...prev,
		status: status === "parked" && prev.status === "idle" ? "idle" : status,
		description: prev.description ?? payload.description,
		sessionFile: prev.sessionFile ?? payload.sessionFile,
		detached: payload.detached ?? prev.detached,
		lastActivity: now,
	});
	return { agents, loaded: state.loaded };
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

/**
 * Parent of an agent for display: the registry parent when it is known,
 * otherwise the id prefix, otherwise none. Self-parents, unknown parents and
 * members of a parent cycle yield undefined so they render as roots.
 */
export function resolveParents(agents: ReadonlyMap<string, AgentRosterEntry>): Map<string, string | undefined> {
	const direct = new Map<string, string | undefined>();
	for (const [id, entry] of agents) {
		if (entry.kind === "main" || id === MAIN_AGENT_ID) {
			direct.set(id, undefined);
			continue;
		}
		let parent = entry.parentId ?? parentFromAgentId(id) ?? MAIN_AGENT_ID;
		if (parent === id || !agents.has(parent)) {
			const prefix = parentFromAgentId(id);
			parent = prefix !== undefined && agents.has(prefix) && prefix !== id ? prefix : MAIN_AGENT_ID;
		}
		direct.set(id, parent !== id && agents.has(parent) ? parent : undefined);
	}
	const resolved = new Map<string, string | undefined>();
	for (const [id, parent] of direct) {
		let cursor = parent;
		let inCycle = false;
		for (let hops = 0; cursor !== undefined && hops <= direct.size; hops++) {
			if (cursor === id) {
				inCycle = true;
				break;
			}
			cursor = direct.get(cursor);
		}
		resolved.set(id, inCycle ? undefined : parent);
	}
	return resolved;
}

export interface HubRow {
	entry: AgentRosterEntry;
	depth: number;
	hasChildren: boolean;
	childCount: number;
}

function byCreated(a: AgentRosterEntry, b: AgentRosterEntry): number {
	if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
	return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function matchesFilter(entry: AgentRosterEntry, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (q === "") return true;
	const hay = [
		entry.id,
		entry.displayName,
		entry.agent,
		entry.description,
		entry.task,
		entry.status,
		entry.resolvedModel,
	]
		.filter((v): v is string => typeof v === "string")
		.join("\n")
		.toLowerCase();
	return hay.includes(q);
}

export interface BuildRowsOptions {
	tree: boolean;
	filter?: string;
}

/**
 * Flatten the roster into display rows. Tree mode nests by parent (matching
 * rows keep their ancestors so context stays visible under a filter); flat
 * mode lists matches by most recent activity.
 */
export function buildHubRows(agents: ReadonlyMap<string, AgentRosterEntry>, opts: BuildRowsOptions): HubRow[] {
	const filter = opts.filter ?? "";
	const parents = resolveParents(agents);
	const children = new Map<string, AgentRosterEntry[]>();
	const roots: AgentRosterEntry[] = [];
	for (const entry of agents.values()) {
		const parent = parents.get(entry.id);
		if (parent === undefined) {
			roots.push(entry);
			continue;
		}
		const list = children.get(parent);
		if (list) list.push(entry);
		else children.set(parent, [entry]);
	}

	if (!opts.tree) {
		const flat = [...agents.values()].filter(e => matchesFilter(e, filter));
		flat.sort((a, b) => b.lastActivity - a.lastActivity || byCreated(a, b));
		return flat.map(entry => ({
			entry,
			depth: 0,
			hasChildren: false,
			childCount: children.get(entry.id)?.length ?? 0,
		}));
	}

	const visible = new Set<string>();
	if (filter.trim() === "") {
		for (const id of agents.keys()) visible.add(id);
	} else {
		for (const entry of agents.values()) {
			if (!matchesFilter(entry, filter)) continue;
			for (let id: string | undefined = entry.id; id !== undefined && !visible.has(id); id = parents.get(id)) {
				visible.add(id);
			}
		}
	}

	roots.sort(byCreated);
	const rows: HubRow[] = [];
	const walk = (entry: AgentRosterEntry, depth: number): void => {
		if (!visible.has(entry.id)) return;
		const kids = (children.get(entry.id) ?? []).filter(k => visible.has(k.id)).sort(byCreated);
		rows.push({ entry, depth, hasChildren: kids.length > 0, childCount: kids.length });
		for (const kid of kids) walk(kid, depth + 1);
	};
	for (const root of roots) walk(root, 0);
	return rows;
}

export function childrenOf(agents: ReadonlyMap<string, AgentRosterEntry>, id: string): AgentRosterEntry[] {
	const parents = resolveParents(agents);
	const out: AgentRosterEntry[] = [];
	for (const entry of agents.values()) if (parents.get(entry.id) === id) out.push(entry);
	return out.sort(byCreated);
}

export function parentOf(agents: ReadonlyMap<string, AgentRosterEntry>, id: string): AgentRosterEntry | undefined {
	const parent = resolveParents(agents).get(id);
	return parent === undefined ? undefined : agents.get(parent);
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface HubTotals {
	cost: number;
	requests: number;
	tools: number;
	tokens: number;
	counts: Record<AgentStatus, number>;
}

export function computeTotals(agents: ReadonlyMap<string, AgentRosterEntry>): HubTotals {
	const totals: HubTotals = {
		cost: 0,
		requests: 0,
		tools: 0,
		tokens: 0,
		counts: { running: 0, idle: 0, parked: 0, aborted: 0 },
	};
	for (const entry of agents.values()) {
		totals.counts[entry.status]++;
		const m = entryMetrics(entry);
		if (!m) continue;
		totals.cost += m.cost;
		totals.requests += m.requests;
		totals.tools += m.tools;
		totals.tokens += m.tokens;
	}
	return totals;
}

// ---------------------------------------------------------------------------
// Transcript cursor
// ---------------------------------------------------------------------------

export type TranscriptEntry = RpcServerSubagentMessagesResult["entries"][number];

export interface HubTranscriptState {
	/** Agent this cursor belongs to; a different id starts from byte 0. */
	readonly agentId: string;
	readonly sessionFile: string | undefined;
	readonly nextByte: number;
	/** Host file identity and trailing bytes at `nextByte`, echoed back so the host detects in-place rewrites. */
	readonly fileId?: string;
	readonly sentinel?: string;
	readonly entries: readonly TranscriptEntry[];
}

export function emptyHubTranscript(agentId: string): HubTranscriptState {
	return { agentId, sessionFile: undefined, nextByte: 0, entries: [] };
}

/**
 * Fold one `get_subagent_messages` chunk into the cursor. `reset` means the
 * file shrank or was replaced: the host re-read from byte 0, so the chunk is
 * the whole transcript and prior entries are discarded. A chunk that does not
 * start at our cursor (a stale response after a reset) is ignored.
 */
export function applyTranscriptChunk(
	state: HubTranscriptState,
	chunk: RpcServerSubagentMessagesResult,
): HubTranscriptState {
	if (chunk.reset || state.sessionFile !== chunk.sessionFile) {
		if (chunk.fromByte !== 0) {
			// Clearing sessionFile makes the refetched from-zero chunk replace entries even when the path is unchanged.
			return { ...state, sessionFile: undefined, nextByte: 0, fileId: undefined, sentinel: undefined };
		}
		return {
			...state,
			sessionFile: chunk.sessionFile,
			nextByte: chunk.nextByte,
			fileId: chunk.fileId,
			sentinel: chunk.sentinel,
			entries: chunk.entries,
		};
	}
	if (chunk.fromByte !== state.nextByte) return state;
	if (chunk.entries.length === 0 && chunk.nextByte === state.nextByte) {
		if (chunk.fileId === state.fileId && chunk.sentinel === state.sentinel) return state;
		return { ...state, fileId: chunk.fileId, sentinel: chunk.sentinel };
	}
	return {
		...state,
		nextByte: chunk.nextByte,
		fileId: chunk.fileId,
		sentinel: chunk.sentinel,
		entries: [...state.entries, ...chunk.entries],
	};
}
