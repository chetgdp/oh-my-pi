/**
 * `? /sub`: one row per running subagent for the picker, its transcript replayed
 * like a turn, and its own events streamed until its lifecycle ends.
 */
import type { HostSocket } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-client-socket";
import { assistantText, finalAssistantText } from "./output";
import { EXIT_FAIL, EXIT_INTERRUPTED, EXIT_OK, printTranscriptEntries, type TurnDeps } from "./turn";

export interface SubagentRow {
	id: string;
	agent: string;
	status: string;
	elapsedMs: number;
	toolCount: number;
	tokens: number;
	currentTool?: string;
	description?: string;
}

/** One picker row from a `get_subagents` snapshot; null when it has no id or agent. */
export function subagentRow(snapshot: unknown): SubagentRow | null {
	const s = record(snapshot);
	if (s === null) return null;
	const id = typeof s.id === "string" ? s.id : "";
	const agent = typeof s.agent === "string" ? s.agent : "";
	if (id.length === 0 || agent.length === 0) return null;
	const progress = record(s.progress);
	const row: SubagentRow = {
		id,
		agent,
		status: typeof s.status === "string" ? s.status : "unknown",
		elapsedMs: count(progress?.durationMs),
		toolCount: count(progress?.toolCount),
		tokens: count(progress?.tokens),
	};
	const currentTool = text(progress?.currentTool);
	if (currentTool !== null) row.currentTool = currentTool;
	const description = text(s.description) ?? text(progress?.description);
	if (description !== null) row.description = description;
	return row;
}

export function subagentLabel(row: SubagentRow): string {
	const parts = [
		row.id,
		row.agent,
		row.status,
		formatElapsed(row.elapsedMs),
		`${row.toolCount} tools`,
		`${row.tokens.toLocaleString("en-US")} tok`,
	];
	if (row.currentTool !== undefined) parts.push(row.currentTool);
	if (row.description !== undefined) parts.push(row.description);
	return parts.join("  ");
}

function formatElapsed(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.floor(s / 60)}m`;
	return `${Math.floor(s / 3600)}h`;
}

/** The transcript `get_subagent_messages` returned, printed the way a turn shows it. */
export async function printSubagentTranscript(
	data: unknown,
	deps: Pick<TurnDeps, "chrome" | "writeStdout">,
): Promise<void> {
	const result = record(data);
	const entries = result?.entries;
	if (Array.isArray(entries) && entries.length > 0) {
		await printTranscriptEntries(entries, deps);
		return;
	}
	const messages = result?.messages;
	if (Array.isArray(messages)) {
		await printTranscriptEntries(
			messages.map(message => ({ type: "message", message })),
			deps,
		);
	}
}

/** Streams one subagent's events until its lifecycle is terminal; Ctrl-C only detaches. */
export async function streamSubagentEvents(
	socket: HostSocket,
	id: string,
	deps: Pick<TurnDeps, "chrome" | "writeStdout" | "interrupt">,
): Promise<number> {
	const { chrome, interrupt } = deps;
	const interrupted = Promise.withResolvers<"interrupt">();
	const onAbort = () => interrupted.resolve("interrupt");
	if (interrupt.aborted) onAbort();
	interrupt.addEventListener("abort", onAbort, { once: true });
	let lastText: string | null = null;
	chrome.start();
	try {
		for (;;) {
			const frame = await Promise.race([socket.next(), interrupted.promise]);
			if (frame === "interrupt") {
				chrome.stop();
				chrome.line("detached; the subagent keeps running");
				return EXIT_INTERRUPTED;
			}
			if (frame === null) {
				chrome.stop();
				chrome.line("omp-shell: host closed the connection");
				return EXIT_FAIL;
			}
			if (frame.type === "subagent_lifecycle") {
				const payload = record(frame.payload);
				if (payload?.id !== id) continue;
				const status = typeof payload.status === "string" ? payload.status : "";
				if (status === "started") continue;
				chrome.stop();
				if (lastText !== null) await deps.writeStdout(lastText.endsWith("\n") ? lastText : `${lastText}\n`);
				return status === "completed" ? EXIT_OK : EXIT_FAIL;
			}
			if (frame.type !== "subagent_event") continue;
			const payload = record(frame.payload);
			if (payload?.id !== id) continue;
			const event = record(payload.event);
			if (event === null) continue;
			switch (event.type) {
				case "message_end":
					lastText = assistantText(event.message) ?? lastText;
					break;
				case "agent_end":
					if (Array.isArray(event.messages)) lastText = finalAssistantText(event.messages) ?? lastText;
					if (lastText !== null) {
						const text = lastText;
						lastText = null;
						chrome.stop();
						await deps.writeStdout(text.endsWith("\n") ? text : `${text}\n`);
						chrome.start();
					}
					break;
				case "tool_execution_start":
					chrome.tool(String(event.toolName ?? "tool"), event.args);
					break;
				case "tool_execution_end":
					chrome.toolResult(event.result, event.isError === true, String(event.toolName ?? ""));
					break;
				case "auto_compaction_start":
				case "manual_compaction_start":
					chrome.startCompacting();
					break;
				case "auto_compaction_end":
				case "manual_compaction_end":
					chrome.stopCompacting();
					break;
			}
		}
	} finally {
		interrupt.removeEventListener("abort", onAbort);
	}
}

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function count(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Single-line non-empty string, or null. */
function text(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.replace(/\s+/g, " ").trim();
	return trimmed.length > 0 ? trimmed : null;
}
