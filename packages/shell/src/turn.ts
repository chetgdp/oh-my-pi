import type { Frame, HostSocket } from "./host-socket";
import { assistantText, type Chrome, finalAssistantText } from "./output";

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_INTERRUPTED = 130;

/** Dialog methods that expect an `extension_ui_response`; the rest are fire-and-forget. */
const DIALOG_METHODS: Record<string, true> = { select: true, confirm: true, input: true, editor: true };
const PROMPT_ID = "shell-prompt";
const ABORT_ID = "shell-abort";

export interface TurnDeps {
	answerUiRequest(req: Record<string, unknown>): Promise<Record<string, unknown>>;
	chrome: Chrome;
	writeStdout(text: string): void;
	/** Fires on Ctrl-C: the turn sends `abort` and ends with 130. */
	interrupt: AbortSignal;
}

/** Prompt fields sent to the host. Plain prompts carry the pane cwd as hidden context. */
export interface PromptRequest {
	message: string;
	context?: { paneCwd: string };
}

/** Slash prompts go verbatim with no context; others attach the pane cwd out of band. */
export function buildPromptRequest(prompt: string, cwd: string): PromptRequest {
	if (prompt.startsWith("/")) return { message: prompt };
	return { message: prompt, context: { paneCwd: cwd } };
}

/** Runs one prompt on an authenticated socket and returns the process exit code. */
export async function runTurn(socket: HostSocket, request: PromptRequest, deps: TurnDeps): Promise<number> {
	const { chrome, interrupt } = deps;
	const interrupted = Promise.withResolvers<"interrupt">();
	const onAbort = () => interrupted.resolve("interrupt");
	if (interrupt.aborted) onAbort();
	interrupt.addEventListener("abort", onAbort, { once: true });

	socket.send({ id: PROMPT_ID, type: "prompt", ...request });
	chrome.start();
	let lastText: string | null = null;
	try {
		for (;;) {
			const frame = await Promise.race([socket.next(), interrupted.promise]);
			if (frame === "interrupt") {
				socket.send({ id: ABORT_ID, type: "abort" });
				chrome.stop();
				chrome.line("interrupted");
				return EXIT_INTERRUPTED;
			}
			if (frame === null) {
				chrome.stop();
				chrome.line("omp-shell: host closed the connection");
				return EXIT_FAIL;
			}
			switch (frame.type) {
				case "response": {
					if (frame.id !== PROMPT_ID) break;
					if (frame.success === false) {
						chrome.stop();
						chrome.line(`omp-shell: ${String(frame.error ?? "prompt refused")}`);
						return EXIT_FAIL;
					}
					const data = frame.data as Record<string, unknown> | undefined;
					if (data?.agentInvoked === false) {
						chrome.stop();
						return EXIT_OK;
					}
					break;
				}
				case "command_output":
					if (typeof frame.text === "string") {
						deps.writeStdout(frame.text.endsWith("\n") ? frame.text : `${frame.text}\n`);
					}
					break;
				case "message_end":
					lastText = assistantText(frame.message) ?? lastText;
					break;
				case "agent_end":
					if (Array.isArray(frame.messages)) lastText = finalAssistantText(frame.messages) ?? lastText;
					break;
				case "tool_execution_start":
					chrome.tool(String(frame.toolName ?? "tool"), frame.args);
					break;
				case "tool_execution_end":
					chrome.toolResult(frame.result, frame.isError === true);
					break;
				case "extension_ui_request":
					handleUiRequest(socket, frame, deps);
					break;
				case "prompt_result": {
					if (frame.id !== PROMPT_ID) break;
					chrome.stop();
					if (lastText !== null) deps.writeStdout(lastText.endsWith("\n") ? lastText : `${lastText}\n`);
					if (frame.status === "completed") return EXIT_OK;
					if (frame.status === "aborted") return EXIT_INTERRUPTED;
					const error = frame.error as Record<string, unknown> | undefined;
					chrome.line(`omp-shell: ${String(error?.message ?? "turn failed")}`);
					return EXIT_FAIL;
				}
			}
		}
	} finally {
		interrupt.removeEventListener("abort", onAbort);
	}
}

/** Dialogs are answered off the frame loop so a host `cancel` can still arrive meanwhile. */
function handleUiRequest(socket: HostSocket, frame: Frame, deps: TurnDeps): void {
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
	void deps.answerUiRequest(frame).then(
		response => {
			socket.send(response);
			deps.chrome.start();
		},
		() => socket.send({ type: "extension_ui_response", id: frame.id, cancelled: true }),
	);
}
