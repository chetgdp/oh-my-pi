/**
 * Pure model for the pinned "Subagents" list: subagents as TUI Agent Hub cards
 * (name, type and model, task, metrics). The desktop inspector has the full
 * screen height, so finished agents stay until the user dismisses them.
 */
import type { AgentProgress, AgentRosterEntry, AgentRosterMetrics } from "@oh-my-pi/pi-wire";
import { agentIdLabel, type AgentHubState, entryMetrics } from "./agent-hub-model";
import type { SubagentTreeState } from "./subagent-model";

export interface PinnedAgentRow {
	id: string;
	label: string;
	status: AgentRosterEntry["status"];
	/** Definition name (type chip). */
	role?: string;
	/** Model id without provider prefix or thinking suffix. */
	model?: string;
	/** Explicit thinking level, shown after the model. */
	level?: string;
	/** Assignment on one line. */
	task?: string;
	metrics?: AgentRosterMetrics;
	lastActivity: number;
}

/** `resolvedModel` may carry a `:level` suffix; the identity never does, so prefer it as the TUI does. */
function shortModel(identity: string | undefined, resolved: string | undefined): string | undefined {
	const model = identity ?? resolved;
	if (!model) return undefined;
	return model.slice(model.lastIndexOf("/") + 1);
}

function oneLine(text: string | undefined): string | undefined {
	const trimmed = text?.trim();
	return trimmed ? trimmed.replace(/\s*[\r\n]+\s*/g, " ") : undefined;
}

function progressMetrics(p: AgentProgress): AgentRosterMetrics {
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

function fromRoster(entry: AgentRosterEntry): PinnedAgentRow {
	const p = entry.progress;
	return {
		id: entry.id,
		label: agentIdLabel(entry.id),
		status: entry.status,
		role: entry.agent ?? p?.agent ?? entry.displayName,
		model: shortModel(p?.resolvedModelIdentity, p?.resolvedModel ?? entry.resolvedModel),
		level: p?.resolvedThinkingLevel,
		task: oneLine(p?.task ?? entry.task),
		metrics: entryMetrics(entry),
		lastActivity: entry.lastActivity,
	};
}

/**
 * Subagents newest first (descending createdAt, tie-broken by id), minus dismissed
 * ones. A dismissed agent that is running again (revived) comes back. The roster is
 * authoritative once it has loaded; before that (it loads only while the hub or a
 * focus is open) the live subagent frames stand in.
 */
export function pinnedRows(
	hub: AgentHubState,
	subagents: SubagentTreeState,
	dismissed: ReadonlySet<string> = new Set(),
): PinnedAgentRow[] {
	const shown = (id: string, status: string) => status === "running" || !dismissed.has(id);
	if (hub.loaded) {
		return [...hub.agents.values()]
			.filter(e => e.kind === "sub" && shown(e.id, e.status))
			.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
			.map(fromRoster);
	}
	return [...subagents.agents.values()]
		.filter(n => n.snapshot.kind === "sub" && shown(n.snapshot.id, n.snapshot.status))
		.sort((a, b) => b.snapshot.createdAt - a.snapshot.createdAt || a.snapshot.id.localeCompare(b.snapshot.id))
		.map(n => {
			const p = n.progress?.progress;
			return {
				id: n.snapshot.id,
				label: agentIdLabel(n.snapshot.id),
				status: n.snapshot.status,
				role: n.progress?.agent ?? p?.agent,
				model: shortModel(p?.resolvedModelIdentity, p?.resolvedModel),
				level: p?.resolvedThinkingLevel,
				task: oneLine(p?.task),
				metrics: p ? progressMetrics(p) : undefined,
				lastActivity: n.snapshot.lastActivity,
			};
		});
}
