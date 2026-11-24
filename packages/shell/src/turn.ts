import type { Frame, HostSocket } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-client-socket";
import { assistantText, type Chrome, finalAssistantText } from "./output";
import type { ProgramStatus } from "./program-status";

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_INTERRUPTED = 130;

/** Dialog methods that expect an `extension_ui_response`; the rest are fire-and-forget. */
const DIALOG_METHODS: Record<string, true> = { select: true, confirm: true, input: true, editor: true };
const PROMPT_ID = "shell-prompt";
const LAST_ID = "shell-last";
const BOOKMARK_ID = "shell-bookmark";
const REPLAY_ID = "shell-replay";
const STATE_ID = "shell-state";
const COMPACT_STATE_ID = "shell-compact-state";
const COMPACT_DONE_ID = "shell-compact-done";

export interface TurnDeps {
	answerUiRequest(req: Record<string, unknown>): Promise<Record<string, unknown>>;
	chrome: Chrome;
	/** Writes final assistant text to stdout now, rendered when stdout is a terminal; resolves once written. */
	writeStdout(text: string): Promise<void>;
	/** Writes builtin command output to stdout unrendered: `shell.render` is a markdown renderer and reflows its columns. */
	writeCommandOutput(text: string): Promise<void>;
	/** Fires on Ctrl-C: the client detaches and exits 130; the agent keeps running, so the pane is free to steer it. */
	interrupt: AbortSignal;
	/** Fires on a second Ctrl-C: stop waiting for the bookmark reply and exit at once. */
	forceExit: AbortSignal;
	/** Stores the session leaf id read on detach, so the next `?` replays what this pane missed. */
	saveBookmark(leafId: string): void;
	/** OSC 7501 root record; reported only once the agent runs, so host-only slash commands leave none. */
	reportStatus(status: ProgramStatus): void;
}

/** Prompt fields sent to an idle host. Plain prompts carry the pane cwd as hidden context. */
export interface PromptRequest {
	message: string;
	context?: { paneCwd: string };
}

/** How a prompt joins a turn that is already running. */
export type BusyBehavior = "steer" | "followUp";

/** Slash prompts go verbatim with no context; others attach the pane cwd out of band. */
export function buildPromptRequest(prompt: string, cwd: string): PromptRequest {
	if (prompt.startsWith("/")) return { message: prompt };
	return { message: prompt, context: { paneCwd: cwd } };
}

/**
 * The frame for the session's current state. The host refuses `context` together with
 * `streamingBehavior`, so a prompt into a running turn goes without the pane cwd.
 */
function promptFrame(id: string, request: PromptRequest, busy: BusyBehavior | null): Frame {
	if (busy === null) return { id, type: "prompt", ...request };
	return { id, type: "prompt", message: request.message, streamingBehavior: busy };
}

/** `/last`: prints the session's last assistant text without starting a turn. */
export async function printLastText(
	socket: HostSocket,
	deps: Pick<TurnDeps, "chrome" | "writeStdout">,
): Promise<number> {
	socket.send({ id: LAST_ID, type: "get_last_assistant_text" });
	for (;;) {
		const frame = await socket.next();
		if (frame === null) {
			deps.chrome.line("omp-shell: host closed the connection");
			return EXIT_FAIL;
		}
		if (frame.type !== "response" || frame.id !== LAST_ID) continue;
		if (frame.success === false) {
			deps.chrome.line(`omp-shell: ${String(frame.error ?? "get_last_assistant_text failed")}`);
			return EXIT_FAIL;
		}
		const text = (frame.data as { text?: unknown } | undefined)?.text;
		if (typeof text !== "string" || text.length === 0) {
			deps.chrome.line("no assistant reply yet");
			return EXIT_FAIL;
		}
		await deps.writeStdout(text.endsWith("\n") ? text : `${text}\n`);
		return EXIT_OK;
	}
}

/**
 * Runs one prompt on an authenticated socket and returns the process exit code.
 *
 * The session state is read first: an idle session gets a normal prompt with the pane
 * cwd, a running turn gets it as steering or a follow-up. Every step runs inside the
 * one frame loop, so Ctrl-C and host dialogs are handled while any of them is pending.
 */
export async function runTurn(
	socket: HostSocket,
	request: PromptRequest,
	busyBehavior: BusyBehavior,
	deps: TurnDeps,
): Promise<number> {
	const { chrome, interrupt } = deps;
	const interrupted = Promise.withResolvers<"interrupt">();
	const onAbort = () => interrupted.resolve("interrupt");
	if (interrupt.aborted) onAbort();
	interrupt.addEventListener("abort", onAbort, { once: true });

	socket.send({ id: STATE_ID, type: "get_state" });
	chrome.start();
	// Each attempt has its own id, so late frames for a refused attempt cannot end the retry.
	let attempt = 0;
	let promptId: string | null = null;
	let sentBusy = false;
	let refusal: string | null = null;
	const sendPrompt = (busy: boolean) => {
		attempt++;
		promptId = `${PROMPT_ID}-${attempt}`;
		sentBusy = busy;
		socket.send(promptFrame(promptId, request, busy ? busyBehavior : null));
	};
	let reported = false;
	let finished = false;
	let queued = false;
	// `prompt_result` with sessionSettled:false: background work (e.g. subagents) will wake the agent again.
	let pending: Frame | null = null;
	const compactPrompt = /^\/compact(?:\s|$)/i.test(request.message.trim());
	let sawCommandOutput = false;
	let awaitingManualCompact = false;
	let manualCompactEnd: Frame | null = null;
	// A dialog answered after prompt_result must not turn `done` back into `working`.
	const report = (status: ProgramStatus) => {
		if (finished) return;
		reported = true;
		deps.reportStatus(status);
	};
	const fail = (message: string) => {
		chrome.stop();
		chrome.line(`omp-shell: ${message}`);
		if (reported) report({ state: "error", msg: message });
		return EXIT_FAIL;
	};
	const finishCompaction = (end: Frame): number => {
		chrome.stop();
		if (end.result !== undefined) {
			report({ state: "done" });
			return EXIT_OK;
		}
		if (end.aborted === true) {
			report({ state: "idle" });
			return EXIT_INTERRUPTED;
		}
		const message =
			typeof end.errorMessage === "string" && end.errorMessage.length > 0 ? end.errorMessage : "compaction failed";
		report({ state: "error", msg: message });
		return EXIT_FAIL;
	};
	const live = new LiveView(socket, deps, report);
	try {
		for (;;) {
			const frame = await Promise.race([socket.next(), interrupted.promise]);
			if (frame === "interrupt") return await detach(socket, deps, reported ? report : null);
			if (frame === null) return fail("host closed the connection");
			switch (frame.type) {
				case "response": {
					if (frame.id === STATE_ID) {
						if (frame.success === false) return fail(String(frame.error ?? "could not read the session state"));
						const streaming = (frame.data as { isStreaming?: unknown } | undefined)?.isStreaming === true;
						if (promptId === null) sendPrompt(streaming);
						// A turn started between the state read and the prompt (subagent results,
						// goal continuations, queued follow-ups): retry once into that turn.
						else if (streaming && !sentBusy) sendPrompt(true);
						else return fail(refusal ?? "prompt refused");
						break;
					}
					if (frame.id === COMPACT_STATE_ID) {
						if (awaitingManualCompact || manualCompactEnd !== null) break;
						const compacting =
							frame.success === true &&
							(frame.data as { isCompacting?: unknown } | undefined)?.isCompacting === true;
						if (compacting) {
							awaitingManualCompact = true;
							chrome.startCompacting();
							report({ state: "working" });
							break;
						}
						chrome.stop();
						return EXIT_OK;
					}
					if (frame.id === COMPACT_DONE_ID) {
						if (manualCompactEnd !== null) return finishCompaction(manualCompactEnd);
						break;
					}
					if (frame.id !== promptId) break;
					if (frame.success === false) {
						refusal = String(frame.error ?? "prompt refused");
						if (sentBusy) return fail(refusal);
						socket.send({ id: STATE_ID, type: "get_state" });
						break;
					}
					const data = frame.data as Record<string, unknown> | undefined;
					if (data?.agentInvoked === false) {
						// `/compact` runs in the background over RPC and answers before `manual_compaction_start`.
						// Stay attached while it runs; invalid args emit `command_output` before this response and exit.
						if (awaitingManualCompact || manualCompactEnd !== null) break;
						if (compactPrompt && !sawCommandOutput) {
							socket.send({ id: COMPACT_STATE_ID, type: "get_state", light: true });
							break;
						}
						chrome.stop();
						return EXIT_OK;
					}
					break;
				}
				case "command_output":
					if (typeof frame.text === "string") {
						sawCommandOutput = true;
						// Hosts older than the RPC-side strip send theme colour escapes; none may reach a pipe or drive the terminal.
						const clean = Bun.stripANSI(frame.text).replace(/[\x00-\x08\x0b-\x1f\x7f\x9b]/g, "");
						chrome.stop();
						await deps.writeCommandOutput(clean.endsWith("\n") ? clean : `${clean}\n`);
						if (manualCompactEnd !== null) return finishCompaction(manualCompactEnd);
						chrome.start();
					}
					break;
				case "auto_compaction_start":
					chrome.startCompacting();
					break;
				case "auto_compaction_end":
					chrome.stopCompacting();
					break;
				case "manual_compaction_start":
					chrome.startCompacting();
					if (compactPrompt && !awaitingManualCompact) {
						awaitingManualCompact = true;
						report({ state: "working" });
					}
					break;
				case "manual_compaction_end":
					chrome.stopCompacting();
					if (awaitingManualCompact) {
						awaitingManualCompact = false;
						manualCompactEnd = frame;
						// The host emits the result `command_output` right after this event, except on an abort.
						// Probe the queue so we print that line if it arrives, and exit if none is coming.
						socket.send({ id: COMPACT_DONE_ID, type: "get_state", light: true });
					}
					break;
				case "queue_update":
					if (!queued && isQueued(frame, request.message)) {
						queued = true;
						chrome.line("queued");
						report({ state: "working" });
					}
					break;
				case "prompt_result":
					if (frame.id !== promptId) break;
					if (frame.sessionSettled === false) {
						pending = frame;
						break;
					}
					return await finish(frame);
				case "session_settled":
					if (pending !== null) return await finish(pending);
					break;
				default:
					await live.handle(frame);
					break;
			}
		}
	} finally {
		finished = true;
		interrupt.removeEventListener("abort", onAbort);
	}

	/** Prints a reply no `agent_end` carried, and maps the prompt's outcome to an exit code. */
	async function finish(result: Frame): Promise<number> {
		chrome.stop();
		const lastText = live.lastText;
		if (lastText !== null) await deps.writeStdout(lastText.endsWith("\n") ? lastText : `${lastText}\n`);
		if (result.status === "completed") {
			report({ state: "done" });
			return EXIT_OK;
		}
		if (result.status === "aborted") {
			report({ state: "idle" });
			return EXIT_INTERRUPTED;
		}
		const error = result.error as Record<string, unknown> | undefined;
		const message = String(error?.message ?? "turn failed");
		report({ state: "error", msg: message });
		// A failed slash command already printed its own text as command_output.
		if (!(result.agentInvoked === false && sawCommandOutput)) chrome.line(`omp-shell: ${message}`);
		return EXIT_FAIL;
	}
}

/**
 * Renders the events every live turn shares: tools, dialogs, replies, compaction.
 * Owns the reply printed at `agent_end`, so a prompt's own finish can flush what no `agent_end` carried.
 */
class LiveView {
	lastText: string | null = null;
	readonly #socket: HostSocket;
	readonly #deps: TurnDeps;
	readonly #report: (status: ProgramStatus) => void;

	constructor(socket: HostSocket, deps: TurnDeps, report: (status: ProgramStatus) => void) {
		this.#socket = socket;
		this.#deps = deps;
		this.#report = report;
	}

	async handle(frame: Frame): Promise<void> {
		const { chrome } = this.#deps;
		switch (frame.type) {
			case "auto_compaction_start":
				chrome.startCompacting();
				break;
			case "auto_compaction_end":
				chrome.stopCompacting();
				break;
			case "agent_start":
				this.#report({ state: "working" });
				break;
			case "message_end":
				this.lastText = assistantText(frame.message) ?? this.lastText;
				break;
			case "agent_end":
				// Each run's reply prints when the run ends: background work can wake the agent
				// for more runs before the session settles, and every reply answers something.
				if (Array.isArray(frame.messages)) this.lastText = finalAssistantText(frame.messages) ?? this.lastText;
				if (this.lastText !== null) {
					const text = this.lastText;
					this.lastText = null;
					// Stdout and the spinner share the terminal: stop it for the write, resume after.
					chrome.stop();
					await this.#deps.writeStdout(text.endsWith("\n") ? text : `${text}\n`);
					chrome.start();
				}
				break;
			case "tool_execution_start":
				chrome.tool(String(frame.toolName ?? "tool"), frame.args);
				break;
			case "tool_execution_end":
				chrome.toolResult(frame.result, frame.isError === true, String(frame.toolName ?? ""));
				break;
			case "extension_ui_request":
				handleUiRequest(this.#socket, frame, this.#deps, this.#report);
				break;
		}
	}
}

/** Ctrl-C: bookmark the leaf so the next `?` replays what this pane missed; the agent keeps running. */
async function detach(
	socket: HostSocket,
	deps: TurnDeps,
	report: ((status: ProgramStatus) => void) | null,
): Promise<number> {
	deps.chrome.stop();
	const leafId = await readLeafId(socket, deps.forceExit);
	if (leafId !== null) deps.saveBookmark(leafId);
	deps.chrome.line("detached; the agent keeps running");
	report?.({ state: "idle" });
	return EXIT_INTERRUPTED;
}

/** Tool calls a bare attach shows from a running turn before streaming the rest. */
const WATCH_TOOL_CALLS = 3;
/** Entries fetched to find them: tool calls interleave with results and assistant text. */
const WATCH_ENTRY_LIMIT = 50;
const WATCH_STATE_ID = "shell-watch-state";
const WATCH_ENTRIES_ID = "shell-watch-entries";

/**
 * Bare `? /a`: an idle session returns at once; a running turn shows its last tool
 * calls with their results, then streams until `agent_end` without sending a prompt.
 */
export async function watchRunningTurn(socket: HostSocket, deps: TurnDeps): Promise<number> {
	const { chrome, interrupt } = deps;
	const interrupted = Promise.withResolvers<"interrupt">();
	const onAbort = () => interrupted.resolve("interrupt");
	if (interrupt.aborted) onAbort();
	interrupt.addEventListener("abort", onAbort, { once: true });
	let finished = false;
	const report = (status: ProgramStatus) => {
		if (!finished) deps.reportStatus(status);
	};
	const closed = () => {
		chrome.stop();
		chrome.line("omp-shell: host closed the connection");
		return EXIT_FAIL;
	};
	try {
		// `response` holds live frames back, so events from before the history print stream after it.
		socket.send({ id: WATCH_STATE_ID, type: "get_state" });
		const state = await Promise.race([socket.response(WATCH_STATE_ID), interrupted.promise]);
		if (state === "interrupt") return EXIT_INTERRUPTED;
		if (state === null) return closed();
		if (state.success === false) {
			chrome.line(`omp-shell: ${String(state.error ?? "could not read the session state")}`);
			return EXIT_FAIL;
		}
		if ((state.data as { isStreaming?: unknown } | undefined)?.isStreaming !== true) return EXIT_OK;

		socket.send({ id: WATCH_ENTRIES_ID, type: "get_entries", limit: WATCH_ENTRY_LIMIT });
		const entries = await Promise.race([socket.response(WATCH_ENTRIES_ID), interrupted.promise]);
		if (entries === "interrupt") return await detach(socket, deps, null);
		if (entries === null) return closed();
		if (entries.success !== false) {
			const list = (entries.data as { entries?: unknown } | undefined)?.entries;
			// Older hosts ignore `limit` and send the whole session.
			if (Array.isArray(list)) printRecentToolCalls(list.slice(-WATCH_ENTRY_LIMIT), deps);
		}

		const live = new LiveView(socket, deps, report);
		report({ state: "working" });
		chrome.start();
		for (;;) {
			const frame = await Promise.race([socket.next(), interrupted.promise]);
			if (frame === "interrupt") return await detach(socket, deps, report);
			if (frame === null) {
				closed();
				report({ state: "error", msg: "host closed the connection" });
				return EXIT_FAIL;
			}
			if (frame.type === "manual_compaction_start") chrome.startCompacting();
			else if (frame.type === "manual_compaction_end") chrome.stopCompacting();
			else await live.handle(frame);
			if (frame.type === "agent_end") {
				chrome.stop();
				report({ state: "done" });
				return EXIT_OK;
			}
		}
	} finally {
		finished = true;
		interrupt.removeEventListener("abort", onAbort);
	}
}

/** Last tool calls in `entries` with their results, in session order; results match by `toolCallId`. */
function printRecentToolCalls(entries: readonly unknown[], deps: Pick<TurnDeps, "chrome">): void {
	const calls: { id: unknown; name: string; args: unknown }[] = [];
	const results = new Map<unknown, Record<string, unknown>>();
	for (const entry of entries) {
		const message = entryMessage(entry);
		if (message === null) continue;
		if (message.role === "toolResult") {
			results.set(message.toolCallId, message);
		} else if (message.role === "assistant" && Array.isArray(message.content)) {
			for (const block of message.content) {
				if (typeof block !== "object" || block === null) continue;
				const b = block as Record<string, unknown>;
				if (b.type === "toolCall") calls.push({ id: b.id, name: String(b.name ?? "tool"), args: b.arguments });
			}
		}
	}
	for (const call of calls.slice(-WATCH_TOOL_CALLS)) {
		deps.chrome.tool(call.name, call.args);
		const result = call.id === undefined ? undefined : results.get(call.id);
		if (result) deps.chrome.toolResult(result, result.isError === true, String(result.toolName ?? ""));
	}
}

function entryMessage(entry: unknown): Record<string, unknown> | null {
	if (typeof entry !== "object" || entry === null) return null;
	const e = entry as Record<string, unknown>;
	if (e.type !== "message" || typeof e.message !== "object" || e.message === null) return null;
	return e.message as Record<string, unknown>;
}

/** `get_state` leaf id; null on a second Ctrl-C, a closed socket, a failure, or a host without `leafId`. */
async function readLeafId(socket: HostSocket, forceExit: AbortSignal): Promise<string | null> {
	if (forceExit.aborted) return null;
	const forced = Promise.withResolvers<"force">();
	const onForce = () => forced.resolve("force");
	forceExit.addEventListener("abort", onForce, { once: true });
	try {
		socket.send({ id: BOOKMARK_ID, type: "get_state" });
		for (;;) {
			const frame = await Promise.race([socket.next(), forced.promise]);
			if (frame === "force" || frame === null) return null;
			if (frame.type !== "response" || frame.id !== BOOKMARK_ID) continue;
			if (frame.success === false) return null;
			const leafId = (frame.data as { leafId?: unknown } | undefined)?.leafId;
			return typeof leafId === "string" && leafId.length > 0 ? leafId : null;
		}
	} finally {
		forceExit.removeEventListener("abort", onForce);
	}
}

export type ReplayOutcome = "replayed" | "unknown_since" | "failed";

/**
 * Prints the session entries after `since` the way a live turn would have:
 * assistant text on stdout, tool calls and results as chrome lines. User and
 * non-message entries are skipped; the pane typed the prompts itself.
 */
export async function replayMissed(
	socket: HostSocket,
	since: string,
	deps: Pick<TurnDeps, "chrome" | "writeStdout">,
): Promise<ReplayOutcome> {
	socket.send({ id: REPLAY_ID, type: "get_entries", since });
	const frame = await socket.response(REPLAY_ID);
	if (frame === null) return "failed";
	if (frame.success === false) return frame.code === "unknown_since" ? "unknown_since" : "failed";
	const entries = (frame.data as { entries?: unknown } | undefined)?.entries;
	if (Array.isArray(entries)) for (const entry of entries) await replayEntry(entry, deps);
	return "replayed";
}

async function replayEntry(entry: unknown, deps: Pick<TurnDeps, "chrome" | "writeStdout">): Promise<void> {
	const message = entryMessage(entry);
	if (message === null) return;
	if (message.role === "assistant") {
		const text = assistantText(message);
		if (text !== null) await deps.writeStdout(text.endsWith("\n") ? text : `${text}\n`);
		if (!Array.isArray(message.content)) return;
		for (const block of message.content) {
			if (typeof block !== "object" || block === null) continue;
			const b = block as Record<string, unknown>;
			if (b.type === "toolCall") deps.chrome.tool(String(b.name ?? "tool"), b.arguments);
		}
	} else if (message.role === "toolResult") {
		// The message carries `content`/`details` like a live `tool_execution_end` result.
		deps.chrome.toolResult(message, message.isError === true, String(message.toolName ?? ""));
	}
}

/** Dialogs are answered off the frame loop so a host `cancel` can still arrive meanwhile. */
function handleUiRequest(
	socket: HostSocket,
	frame: Frame,
	deps: TurnDeps,
	report: (status: ProgramStatus) => void,
): void {
	const method = frame.method;
	if (method === "notify" && typeof frame.message === "string") {
		deps.chrome.line(frame.message);
		return;
	}
	if (method === "cancel") {
		void deps.answerUiRequest(frame);
		return;
	}
	if (typeof method !== "string" || DIALOG_METHODS[method] !== true) return;
	deps.chrome.stop();
	const msg = typeof frame.title === "string" ? frame.title : undefined;
	report({ state: "blocked", kind: method === "confirm" ? "permission" : "question", msg });
	void deps.answerUiRequest(frame).then(
		response => {
			socket.send(response);
			report({ state: "working" });
			deps.chrome.start();
		},
		() => {
			socket.send({ type: "extension_ui_response", id: frame.id, cancelled: true });
			report({ state: "working" });
		},
	);
}

function isQueued(frame: Frame, message: string): boolean {
	return (
		(Array.isArray(frame.steering) && frame.steering.includes(message)) ||
		(Array.isArray(frame.followUp) && frame.followUp.includes(message))
	);
}
