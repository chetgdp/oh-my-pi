/**
 * Pure model for the pinned "Subagents" list (TUI `renderSubagentHudLines` /
 * `layoutPinnedHud`): running agents only, a few rows collapsed, then an expander.
 */
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import { agentIdLabel, type AgentHubState } from "./agent-hub-model";
import type { SubagentTreeState } from "./subagent-model";

/** Item rows a collapsed list shows before the expander. */
export const PINNED_COLLAPSED_LIMIT = 3;
const TASK_PREVIEW_LENGTH = 40;

export interface PinnedAgentRow {
	id: string;
	label: string;
	/** Definition name (role chip). */
	role?: string;
	/** Model without its provider prefix. */
	model?: string;
	/** Description, or a muted task preview when the spawn gave none. */
	text?: string;
	textIsPreview: boolean;
}

export interface PinnedLayout {
	itemRows: number;
	toggle: "expand" | "collapse" | undefined;
}

/** Same rule as the TUI: at most the collapsed limit without an expander, everything when expanded. */
export function layoutPinned(runningTotal: number, expanded: boolean): PinnedLayout {
	if (runningTotal <= PINNED_COLLAPSED_LIMIT) return { itemRows: runningTotal, toggle: undefined };
	if (!expanded) return { itemRows: PINNED_COLLAPSED_LIMIT, toggle: "expand" };
	return { itemRows: runningTotal, toggle: "collapse" };
}

/** Mirror of the TUI `labelEchoesHandle`: a label that is just the spawn handle (or `Name-2`) adds nothing. */
export function labelEchoesHandle(handle: string, label: string): boolean {
	if (label.localeCompare(handle, undefined, { sensitivity: "accent" }) === 0) return true;
	const separator = handle.lastIndexOf("-");
	if (separator <= 0) return false;
	const suffix = handle.slice(separator + 1);
	return (
		/^\d+$/.test(suffix) &&
		handle.slice(0, separator).localeCompare(label, undefined, { sensitivity: "accent" }) === 0
	);
}

function shortModel(model: string | undefined): string | undefined {
	if (!model) return undefined;
	return model.slice(model.lastIndexOf("/") + 1);
}

function oneLine(text: string): string {
	return text.replace(/\s*[\r\n]+\s*/g, " ↵ ");
}

function buildRow(
	id: string,
	role: string | undefined,
	model: string | undefined,
	description?: string,
	task?: string,
): PinnedAgentRow {
	const desc = description?.trim();
	if (desc && !labelEchoesHandle(id, desc)) {
		return { id, label: agentIdLabel(id), role, model: shortModel(model), text: oneLine(desc), textIsPreview: false };
	}
	const preview = task?.trim();
	if (preview && !labelEchoesHandle(id, preview)) {
		const line = oneLine(preview);
		const text = line.length > TASK_PREVIEW_LENGTH ? `${line.slice(0, TASK_PREVIEW_LENGTH - 1)}…` : line;
		return { id, label: agentIdLabel(id), role, model: shortModel(model), text, textIsPreview: true };
	}
	return { id, label: agentIdLabel(id), role, model: shortModel(model), textIsPreview: false };
}

function fromRoster(entry: AgentRosterEntry): PinnedAgentRow {
	const p = entry.progress;
	return buildRow(
		entry.id,
		entry.agent ?? p?.agent,
		p?.resolvedModel ?? entry.resolvedModel,
		entry.description ?? p?.description,
		entry.task ?? p?.task,
	);
}

/**
 * Running subagents in creation order. The roster is authoritative once it has
 * loaded; before that (it loads only while the hub or a focus is open) the live
 * subagent frames stand in.
 */
export function pinnedRows(hub: AgentHubState, subagents: SubagentTreeState): PinnedAgentRow[] {
	if (hub.loaded) {
		return [...hub.agents.values()]
			.filter(e => e.kind === "sub" && e.status === "running")
			.sort((a, b) => a.createdAt - b.createdAt)
			.map(fromRoster);
	}
	return [...subagents.agents.values()]
		.filter(n => n.snapshot.kind === "sub" && n.snapshot.status === "running")
		.sort((a, b) => a.snapshot.createdAt - b.snapshot.createdAt)
		.map(n => {
			const p = n.progress?.progress;
			return buildRow(
				n.snapshot.id,
				n.progress?.agent ?? p?.agent,
				p?.resolvedModel,
				p?.description ?? n.lifecycle?.description,
				p?.task,
			);
		});
}
