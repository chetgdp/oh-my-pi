import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import type { AgentSessionEvent } from "../../session/agent-session-events";
import { deobfuscateAgentMessages, deobfuscateAssistantContent } from "../../secrets/message-transform";
import type { SecretObfuscator } from "../../secrets/obfuscator";
import type { SessionEntry } from "../../session/session-entries";
import type { SessionManager } from "../../session/session-manager";
import type { RpcV3BlockStart, RpcV3Event, RpcV3HistoryCommand, RpcV3HistoryResult, RpcV3Live } from "./rpc-v3-types";

export interface RpcV3TranslatorHost {
	readonly sessionManager: SessionManager;
	readonly obfuscator?: SecretObfuscator;
	readonly agent: {
		readonly state: {
			readonly streamMessage: AgentMessage | null;
		};
	};
}

/** Ended assistant streams kept for sid matching; unsaved turns (empty errors, refusals) age out. */
const MAX_PENDING_ENTRIES = 16;
const OVERLAP_PROBE_LENGTH = 256;

/**
 * Length of the longest suffix of `previous` that is also a prefix of `next`.
 * Anchors on a tail probe so a 50 KiB window costs a few indexOf scans, not a quadratic walk;
 * overlaps shorter than the probe report 0 and the caller resends `next` whole.
 */
function overlapLength(previous: string, next: string): number {
	const probe = previous.slice(-OVERLAP_PROBE_LENGTH);
	if (probe.length === 0) return 0;
	let at = next.lastIndexOf(probe);
	while (at !== -1) {
		const len = at + probe.length;
		if (previous.endsWith(next.slice(0, len))) return len;
		if (at === 0) break;
		at = next.lastIndexOf(probe, at - 1);
	}
	return 0;
}

function extractToolExecutionText(partialResult: unknown): string {
	if (typeof partialResult === "string") return partialResult;
	if (!partialResult || typeof partialResult !== "object") return "";
	const rec = partialResult as Record<string, unknown>;
	if (Array.isArray(rec.content)) {
		let text = "";
		for (const item of rec.content) {
			if (
				item &&
				typeof item === "object" &&
				"type" in item &&
				item.type === "text" &&
				"text" in item &&
				typeof item.text === "string"
			) {
				text += item.text;
			}
		}
		return text;
	}
	if (typeof rec.text === "string") return rec.text;
	return "";
}

/** Stream state for a partial the browser already holds: its existing blocks must not be restarted. */
function streamFromPartial(sid: number, message: AgentMessage): ActiveAssistantStream {
	const count = message.role === "assistant" ? message.content.length : 0;
	return { sid, startedBlocks: new Set(Array.from({ length: count }, (_, i) => i)) };
}

interface ActiveAssistantStream {
	readonly sid: number;
	readonly startedBlocks: Set<number>;
}

export class RpcV3Translator {
	readonly #host: RpcV3TranslatorHost;
	readonly #output: (frame: object) => void;
	#active = false;
	#nextSid = 1;
	#activeAssistantStream: ActiveAssistantStream | null = null;
	#pendingEntries: Array<{ sid: number; message: AssistantMessage }> = [];
	#toolOutputs = new Map<string, string>();
	// Returned background tools keep emitting updates with no later terminal frame; the browser drops them.
	#endedTools = new Set<string>();
	#currentLeaf: string | null = null;
	#unsubscribeEntry?: () => void;
	#unsubscribeLeaf?: () => void;

	constructor(host: RpcV3TranslatorHost, output: (frame: object) => void) {
		this.#host = host;
		this.#output = output;
	}

	get active(): boolean {
		return this.#active;
	}

	get #sessionManager(): SessionManager {
		return this.#host.sessionManager;
	}

	enable(): void {
		if (this.#active) return;
		this.#active = true;
		this.#currentLeaf = this.#sessionManager.getLeafId();
		this.#unsubscribeEntry = this.#sessionManager.onEntry(entry => this.#handleSessionEntry(entry));
		this.#unsubscribeLeaf = this.#sessionManager.onLeafChange(leafId => this.#handleLeafChange(leafId));
	}

	dispose(): void {
		this.#unsubscribeEntry?.();
		this.#unsubscribeLeaf?.();
		this.#unsubscribeEntry = undefined;
		this.#unsubscribeLeaf = undefined;
		this.#activeAssistantStream = null;
		this.#pendingEntries = [];
		this.#toolOutputs.clear();
		this.#endedTools.clear();
		this.#active = false;
	}

	handleEvent(event: AgentSessionEvent): boolean {
		if (!this.#active) return false;

		switch (event.type) {
			case "message_start":
				this.#handleMessageStart(event);
				return true;
			case "message_update":
				this.#handleMessageUpdate(event);
				return true;
			case "message_end":
				this.#handleMessageEnd(event);
				return true;
			case "tool_execution_update":
				this.#handleToolExecutionUpdate(event);
				return true;
			case "tool_execution_end":
				this.#toolOutputs.delete(event.toolCallId);
				this.#endedTools.add(event.toolCallId);
				return false;
			case "agent_end": {
				this.#activeAssistantStream = null;
				// v3 already delivered every message; resending them costs megabytes on long runs.
				const { messages: _messages, ...signal } = event;
				this.#output(signal);
				return true;
			}
			case "turn_end": {
				const { message: _message, toolResults: _toolResults, ...signal } = event;
				this.#output(signal);
				return true;
			}
			default:
				return false;
		}
	}

	handleHistory(
		command: RpcV3HistoryCommand,
	): { success: true; data: RpcV3HistoryResult } | { success: false; error: string } {
		const currentLeaf = this.#sessionManager.getLeafId();
		const branch = this.#sessionManager.getBranch();
		// Only a cursor that left the current path is a branch change; appends past it are not.
		if (command.leafId !== undefined && !branch.some(e => e.id === command.leafId)) {
			return { success: false, error: "branch_changed" };
		}

		let limit = command.limit ?? 50;
		if (typeof limit !== "number" || limit < 1) limit = 50;
		if (limit > 200) limit = 200;

		let entries: SessionEntry[];
		let hasMore: boolean;
		let live: RpcV3Live[] = [];

		if (command.before !== undefined) {
			const beforeIndex = branch.findIndex(e => e.id === command.before);
			if (beforeIndex === -1) {
				return { success: false, error: "branch_changed" };
			}
			const startIndex = Math.max(0, beforeIndex - limit);
			entries = branch.slice(startIndex, beforeIndex).map(e => this.#deobfuscateEntry(e));
			hasMore = startIndex > 0;
		} else {
			const startIndex = Math.max(0, branch.length - limit);
			entries = branch.slice(startIndex).map(e => this.#deobfuscateEntry(e));
			hasMore = startIndex > 0;
			const streamMsg = this.#host.agent.state.streamMessage;
			if (streamMsg && streamMsg.role === "assistant") {
				if (!this.#activeAssistantStream) {
					this.#activeAssistantStream = streamFromPartial(this.#nextSid++, streamMsg);
				}
				live = [{ sid: this.#activeAssistantStream.sid, message: this.#deobfuscateMessage(streamMsg) }];
			}
		}
		return {
			success: true,
			data: {
				leafId: currentLeaf,
				entries,
				hasMore,
				live,
			},
		};
	}

	#handleMessageStart(event: Extract<AgentSessionEvent, { type: "message_start" }>): void {
		if (event.message.role !== "assistant") return;
		const sid = this.#nextSid++;
		this.#activeAssistantStream = { sid, startedBlocks: new Set() };
		this.#output({
			type: "msg_start",
			sid,
			message: this.#deobfuscateMessage(event.message),
		});
	}

	#handleMessageUpdate(event: Extract<AgentSessionEvent, { type: "message_update" }>): void {
		if (event.message.role !== "assistant") return;
		let sid: number;
		let stream = this.#activeAssistantStream;
		if (stream) {
			sid = stream.sid;
		} else {
			sid = this.#nextSid++;
			stream = streamFromPartial(sid, event.message);
			this.#activeAssistantStream = stream;
			this.#output({ type: "msg_start", sid, message: this.#deobfuscateMessage(event.message) });
			// The partial already contains this event's start/delta; only a block end adds the final block.
			const kind = event.assistantMessageEvent.type;
			if (kind !== "text_end" && kind !== "thinking_end" && kind !== "toolcall_end" && kind !== "image_end") return;
		}

		const ev = event.assistantMessageEvent;
		switch (ev.type) {
			case "text_start": {
				stream.startedBlocks.add(ev.contentIndex);
				this.#output({
					type: "block_start",
					sid,
					block: ev.contentIndex,
					start: { type: "text" },
				});
				break;
			}

			case "thinking_start": {
				stream.startedBlocks.add(ev.contentIndex);
				const block = ev.partial.content[ev.contentIndex];
				let start: RpcV3BlockStart = { type: "thinking" };
				if (block?.type === "redactedThinking") {
					start = { type: "redactedThinking", data: block.data };
				} else if ("kind" in ev && ev.kind === "redactedThinking") {
					const data =
						block && typeof block === "object" && "data" in block && typeof block.data === "string"
							? block.data
							: "";
					start = { type: "redactedThinking", data };
				}
				this.#output({
					type: "block_start",
					sid,
					block: ev.contentIndex,
					start,
				});
				break;
			}

			case "toolcall_start": {
				stream.startedBlocks.add(ev.contentIndex);
				const block = ev.partial.content[ev.contentIndex];
				const id = block?.type === "toolCall" ? block.id : "";
				const name = block?.type === "toolCall" ? block.name : "";
				this.#output({
					type: "block_start",
					sid,
					block: ev.contentIndex,
					start: { type: "toolCall", id, name },
				});
				break;
			}

			case "text_delta": {
				if (!stream.startedBlocks.has(ev.contentIndex)) {
					stream.startedBlocks.add(ev.contentIndex);
					this.#output({
						type: "block_start",
						sid,
						block: ev.contentIndex,
						start: { type: "text" },
					});
				}
				this.#output({
					type: "delta",
					sid,
					block: ev.contentIndex,
					text: ev.delta,
				});
				break;
			}

			case "thinking_delta": {
				if (!stream.startedBlocks.has(ev.contentIndex)) {
					stream.startedBlocks.add(ev.contentIndex);
					this.#output({
						type: "block_start",
						sid,
						block: ev.contentIndex,
						start: { type: "thinking" },
					});
				}
				this.#output({
					type: "delta",
					sid,
					block: ev.contentIndex,
					text: ev.delta,
				});
				break;
			}

			case "toolcall_delta": {
				if (!stream.startedBlocks.has(ev.contentIndex)) {
					stream.startedBlocks.add(ev.contentIndex);
					const block = ev.partial.content[ev.contentIndex];
					const id = block?.type === "toolCall" ? block.id : "";
					const name = block?.type === "toolCall" ? block.name : "";
					this.#output({
						type: "block_start",
						sid,
						block: ev.contentIndex,
						start: { type: "toolCall", id, name },
					});
				}
				break;
			}

			case "text_end": {
				if (!stream.startedBlocks.has(ev.contentIndex)) {
					stream.startedBlocks.add(ev.contentIndex);
					this.#output({
						type: "block_start",
						sid,
						block: ev.contentIndex,
						start: { type: "text" },
					});
				}
				const block = ev.partial.content[ev.contentIndex] ?? { type: "text", text: ev.content };
				this.#output({
					type: "block_end",
					sid,
					block: ev.contentIndex,
					content: this.#deobfuscateBlock(block),
				});
				break;
			}

			case "thinking_end": {
				if (!stream.startedBlocks.has(ev.contentIndex)) {
					stream.startedBlocks.add(ev.contentIndex);
					this.#output({
						type: "block_start",
						sid,
						block: ev.contentIndex,
						start: { type: "thinking" },
					});
				}
				const block = ev.partial.content[ev.contentIndex] ?? { type: "thinking", thinking: ev.content };
				this.#output({
					type: "block_end",
					sid,
					block: ev.contentIndex,
					content: this.#deobfuscateBlock(block),
				});
				break;
			}

			case "toolcall_end": {
				if (!stream.startedBlocks.has(ev.contentIndex)) {
					stream.startedBlocks.add(ev.contentIndex);
					this.#output({
						type: "block_start",
						sid,
						block: ev.contentIndex,
						start: { type: "toolCall", id: ev.toolCall.id, name: ev.toolCall.name },
					});
				}
				const block = ev.partial.content[ev.contentIndex] ?? ev.toolCall;
				this.#output({
					type: "block_end",
					sid,
					block: ev.contentIndex,
					content: this.#deobfuscateBlock(block),
				});
				break;
			}

			case "image_end": {
				const block = ev.partial.content[ev.contentIndex] ?? ev.content;
				this.#output({
					type: "block_end",
					sid,
					block: ev.contentIndex,
					content: this.#deobfuscateBlock(block),
				});
				break;
			}

			default:
				break;
		}
	}

	#handleMessageEnd(event: Extract<AgentSessionEvent, { type: "message_end" }>): void {
		const message = event.message;
		if (message.role !== "assistant") return;
		const sid = this.#activeAssistantStream?.sid ?? this.#nextSid++;
		this.#activeAssistantStream = null;
		this.#pendingEntries.push({ sid, message });
		if (this.#pendingEntries.length > MAX_PENDING_ENTRIES) this.#pendingEntries.shift();
		this.#output({
			type: "msg_end",
			sid,
			message: this.#deobfuscateMessage(message),
		});
	}

	#handleToolExecutionUpdate(event: Extract<AgentSessionEvent, { type: "tool_execution_update" }>): void {
		if (this.#endedTools.has(event.toolCallId)) return;
		const newText = extractToolExecutionText(event.partialResult);
		const lastSeen = this.#toolOutputs.get(event.toolCallId) ?? "";
		this.#toolOutputs.set(event.toolCallId, newText);
		// Rolling windows (bash tail buffer) trim the head, so newText may only overlap lastSeen's tail.
		const overlap = newText.startsWith(lastSeen) ? lastSeen.length : overlapLength(lastSeen, newText);
		const delta = newText.slice(overlap);
		if (delta.length === 0) return;
		// No overlap with shown text means a rewrite (snapshot tools), not a continuation.
		if (overlap === 0 && lastSeen.length > 0) {
			this.#output({ type: "tool_output", toolCallId: event.toolCallId, text: newText, replace: true });
			return;
		}
		this.#output({
			type: "tool_output",
			toolCallId: event.toolCallId,
			text: delta,
		});
	}

	#handleSessionEntry(entry: SessionEntry): void {
		if (!this.#active) return;

		if (entry.type === "compaction") {
			this.#currentLeaf = entry.id;
			this.#output({ type: "branch", leafId: entry.id });
			return;
		}

		if (entry.parentId !== this.#currentLeaf) {
			return;
		}

		this.#currentLeaf = entry.id;

		let matchingSid: number | undefined;
		if (entry.type === "message" && entry.message.role === "assistant") {
			const saved = entry.message;
			const matchIndex = this.#pendingEntries.findIndex(
				item => item.message === saved || item.message.timestamp === saved.timestamp,
			);
			if (matchIndex !== -1) {
				matchingSid = this.#pendingEntries[matchIndex].sid;
				this.#pendingEntries.splice(matchIndex, 1);
			}
		}

		const shown = this.#deobfuscateEntry(entry);
		const event: RpcV3Event =
			matchingSid !== undefined
				? { type: "entry", entry: shown, sid: matchingSid }
				: { type: "entry", entry: shown };
		this.#output(event);
	}

	#handleLeafChange(leafId: string | null): void {
		if (!this.#active) return;
		this.#currentLeaf = leafId;
		// Pending sids survive: a save landing after the move still resolves its frozen row, and the
		// parentId check already drops entries that are off the new branch.
		this.#output({ type: "branch", leafId });
	}

	// v2 and the TUI show secrets restored; entries and live rows must match what msg_end showed.
	#deobfuscateMessage(message: AgentMessage): AgentMessage {
		const obfuscator = this.#host.obfuscator;
		if (!obfuscator?.hasSecrets()) return message;
		return deobfuscateAgentMessages(obfuscator, [message])[0];
	}

	#deobfuscateBlock(block: AssistantMessage["content"][number]): AssistantMessage["content"][number] {
		const obfuscator = this.#host.obfuscator;
		if (!obfuscator?.hasSecrets()) return block;
		return deobfuscateAssistantContent(obfuscator, [block])[0];
	}

	#deobfuscateEntry(entry: SessionEntry): SessionEntry {
		const obfuscator = this.#host.obfuscator;
		if (!obfuscator?.hasSecrets()) return entry;
		switch (entry.type) {
			case "message": {
				const message = this.#deobfuscateMessage(entry.message);
				return message === entry.message ? entry : { ...entry, message };
			}
			case "branch_summary": {
				const summary = obfuscator.deobfuscate(entry.summary);
				return summary === entry.summary ? entry : { ...entry, summary };
			}
			case "compaction": {
				const summary = obfuscator.deobfuscate(entry.summary);
				const shortSummary =
					entry.shortSummary === undefined ? undefined : obfuscator.deobfuscate(entry.shortSummary);
				if (summary === entry.summary && shortSummary === entry.shortSummary) return entry;
				return { ...entry, summary, shortSummary };
			}
			default:
				return entry;
		}
	}
}
