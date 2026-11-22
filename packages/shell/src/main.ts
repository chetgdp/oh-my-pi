#!/usr/bin/env bun
/**
 * `omp-shell` — the `?` client. One process, one host connection, one turn.
 * input (argv, piped stdin) -> parse -> resolve attachment -> turn -> exit code.
 */
import * as path from "node:path";
import {
	type ApprovalMode,
	type ChainStep,
	type ExportRequest,
	mergeStdin,
	parseArgv,
	parseExportArgs,
	readPipedStdin,
} from "./commands";
import { transcriptMarkdown } from "./export";
import { type Frame, HostSocket } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-client-socket";
import { RpcFrameDecoder } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-frame";
import type { RpcPlanState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-fork-types";
import { Chrome } from "./output";
import { encodePaneKey } from "./pane-key";
import {
	clearPaneState,
	paneClientId,
	paneStateDir,
	readPaneState,
	setPaneBookmark,
	writePaneState,
} from "./pane-state";
import { readRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { resolveLiveSession } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-session-list";
import { hostKind, hostRow, listLiveHosts, type RpcHostEntry, readLiveHost } from "./registry";
import { listPastSessions, resolvePastSession, sessionRow } from "./sessions";
import { runSetup } from "./setup";
import * as ttyUi from "./tty-ui";
import {
	globalConfig,
	globalConfigPath,
	parseToolLines,
	readGlobalConfig,
	toolLinesOf,
	writeShellSetting,
} from "./config";
import { type ProgramStatus, ttyStatusReporter } from "./program-status";
import { emitOutput, loadRenderCommand, runRenderCommand } from "./render";
import { buildPromptRequest, EXIT_FAIL, EXIT_OK, printLastText, replayMissed, runTurn } from "./turn";

const EXIT_USAGE = 2;
const USAGE =
	"usage: ? [/f] <prompt> | ? /a [--id <session>] [prompt|/l] | ? /r [--all|--id <session>] [prompt|/l] | ? /new (/n) [prompt|/l] | ? /last (/l) | ? [/l|/m <model>|--ask|--ask-cached|--write|--yolo]... [/f] <prompt> | ? /u | ? /m [model] | ? /clear (/c) | ? /output [default|N|all] | ? /status (/st) | ? /plan [prompt] | ? /diff [instruction] | ? /export [N|--html [path]] | ? /perms | ? --ask|--ask-cached|--write|--yolo [prompt]   (omp-shell --setup to install ?)";

export interface MainDeps {
	argv: string[];
	stdin: string | null;
	cwd: string;
	paneKey: string | null;
	paneDir: string;
	/** Registry dir override (tests); undefined uses the default. */
	registryDir?: string;
	pickHost(rows: ttyUi.HostRow[]): Promise<ttyUi.HostRow | null>;
	/** null = cancelled, "no-tty" = no terminal to ask on. */
	pickApprovalMode(current: ApprovalMode): Promise<ApprovalMode | null | "no-tty">;
	answerUiRequest(req: Record<string, unknown>): Promise<Record<string, unknown>>;
	printNotice(text: string): void;
	/** `omp host start`; with `resume`, the host for that session file (reused when live). */
	startHost(cwd: string, resume?: string): Promise<{ instanceId: string }>;
	/** Sessions root override (tests); undefined uses the default. */
	sessionsRoot?: string;
	/** Global config dir override (tests); undefined uses the omp agent dir. */
	agentDir?: string;
	/** `/status` colors; undefined = auto (stderr is a tty and NO_COLOR is unset). */
	color?: boolean;
	writeStdout(text: string): Promise<void>;
	/** Builtin command output: preformatted text that goes to stdout without `shell.render`. */
	writeCommandOutput(text: string): Promise<void>;
	chrome: Chrome;
	interrupt: AbortSignal;
	/** Second Ctrl-C: skip the detach bookmark and exit. */
	forceExit: AbortSignal;
	reportStatus(status: ProgramStatus): void;
}

export async function run(deps: MainDeps): Promise<number> {
	const command = parseArgv(deps.argv, deps.stdin);
	const paneKey = deps.paneKey;
	if (
		command.usage ||
		(command.kind === "prompt" &&
			command.prompt === null &&
			command.mode === undefined &&
			command.steps === undefined)
	) {
		deps.printNotice(USAGE);
		return EXIT_USAGE;
	}
	if (command.kind === "output") return await runOutput(command.prompt, deps);
	if (command.kind === "status") return await runStatus(deps);
	let exportRequest: ExportRequest | null = null;
	if (command.kind === "export") {
		exportRequest = parseExportArgs(command.prompt);
		if (exportRequest === null) {
			const words = command.prompt?.split(/\s+/) ?? [];
			if (words.includes("--html") && words.some(word => /^\d+$/.test(word))) {
				deps.printNotice(
					"omp-shell: --html always exports the whole session; a turn count works only for plain text (? /export N)",
				);
				return EXIT_FAIL;
			}
			deps.printNotice("usage: ? /export [N] | ? /export --html [path]   (N: a positive number of turns)");
			return EXIT_FAIL;
		}
		if (exportRequest.html && exportRequest.path !== undefined) {
			// The host resolves a relative path against its own cwd; the user means the pane's.
			const absolute = path.resolve(deps.cwd, exportRequest.path);
			if (/\s/.test(absolute)) {
				deps.printNotice(`omp-shell: the host's /export cannot take a path with spaces: ${absolute}`);
				return EXIT_FAIL;
			}
			exportRequest = { html: true, path: absolute };
		}
	}
	if (command.kind === "diff") {
		const prompt = await diffPrompt(command.prompt, deps);
		if (prompt === null) return EXIT_FAIL;
		command.prompt = prompt;
	}
	if (command.sessionId === "") {
		deps.printNotice(USAGE);
		return EXIT_USAGE;
	}
	if (paneKey === null) {
		deps.printNotice("omp-shell: no tmux pane or tty identifies this shell");
		return EXIT_FAIL;
	}

	let host: RpcHostEntry | null;
	if (command.kind === "new") {
		host = await startAndAttach(deps, paneKey, deps.cwd);
	} else if (command.kind === "resume" && command.sessionId !== undefined) {
		host = await resumeById(deps, paneKey, command.sessionId);
	} else if (command.kind === "resume") {
		const sessions = await listPastSessions(deps.cwd, command.all, deps.sessionsRoot);
		if (sessions.length === 0) {
			deps.printNotice(command.all ? "no past sessions" : "no past sessions here (? /r --all for every project)");
			return EXIT_FAIL;
		}
		const picked = await deps.pickHost(sessions.map(sessionRow));
		const session = picked ? sessions.find(entry => entry.path === picked.instanceId) : undefined;
		if (!session) return EXIT_FAIL;
		host = await startAndAttach(deps, paneKey, session.cwd || deps.cwd, session.path);
	} else if (command.kind === "attach") {
		host =
			command.sessionId !== undefined
				? await attachById(deps, paneKey, command.sessionId)
				: await pickAndAttach(deps, paneKey);
	} else {
		const state = readPaneState(paneKey, deps.paneDir);
		host = state ? await readLiveHost(state.instanceId, deps.registryDir) : null;
		if (!host && state?.sessionId !== undefined) {
			host = await reattachBySession(deps, paneKey, state.sessionId);
			if (host) deps.printNotice(`re-attached to ${describe(host)}`);
		}
		if (!host) {
			deps.printNotice("no session attached");
			host = await pickAndAttach(deps, paneKey);
			if (host) deps.printNotice(`attached to ${describe(host)}`);
		}
	}
	if (!host) return EXIT_FAIL;

	if (command.kind === "last") return await withHost(deps, paneKey, host, socket => printLastText(socket, deps));
	const steps = command.steps;
	if (steps !== undefined && (command.prompt !== null || command.kind === "prompt")) {
		const prompt = command.prompt;
		return await withHost(deps, paneKey, host, async (socket, connected) => {
			const turnDeps = {
				...deps,
				saveBookmark: (leafId: string) => setPaneBookmark(paneKey, connected.instanceId, leafId, deps.paneDir),
			};
			if (!(await runChain(socket, steps, turnDeps))) return EXIT_FAIL;
			if (prompt === null) return EXIT_OK;
			return await runTurn(
				socket,
				buildPromptRequest(prompt, deps.cwd),
				command.followUp ? "followUp" : "steer",
				turnDeps,
			);
		});
	}
	if (exportRequest?.html) {
		const message = exportRequest.path === undefined ? "/export" : `/export ${exportRequest.path}`;
		return await withHost(deps, paneKey, host, (socket, connected) =>
			runTurn(socket, buildPromptRequest(message, deps.cwd), "steer", {
				...deps,
				saveBookmark: leafId => setPaneBookmark(paneKey, connected.instanceId, leafId, deps.paneDir),
			}),
		);
	}
	if (exportRequest) {
		const turns = exportRequest.turns;
		return await withHost(deps, paneKey, host, socket => printTranscript(socket, turns, deps));
	}
	if (command.kind === "plan") {
		const prompt = command.prompt;
		return await withHost(deps, paneKey, host, (socket, connected) =>
			runPlan(socket, prompt, {
				...deps,
				saveBookmark: leafId => setPaneBookmark(paneKey, connected.instanceId, leafId, deps.paneDir),
			}),
		);
	}
	if (command.kind === "perms") return await withHost(deps, paneKey, host, socket => runPerms(socket, deps));
	const mode = command.mode;
	if (mode !== undefined && command.prompt === null) {
		return await withHost(deps, paneKey, host, async socket =>
			(await setApprovalMode(socket, mode, deps)) ? EXIT_OK : EXIT_FAIL,
		);
	}
	if (command.prompt === null) {
		// TUIs have no shell attachments to register: like the web GUI, the pane just drives the socket.
		const registered = hostKind(host) === "tui" ? null : await registerAttachment(host, paneKey, deps);
		if (registered !== null) {
			// An unregistered pane would never detach; leave it unattached instead.
			clearPaneState(paneKey, deps.paneDir);
			const outdated = registered.includes("Unknown command");
			deps.printNotice(
				outdated
					? `omp-shell: host ${host.instanceId} runs an omp build without attach_shell; restart it with a current omp`
					: `omp-shell: ${registered}`,
			);
			return EXIT_FAIL;
		}
		deps.printNotice(`attached to ${describe(host)}`);
		if (command.last) return await withHost(deps, paneKey, host, socket => printLastText(socket, deps));
		if (steps !== undefined) {
			return await withHost(deps, paneKey, host, async (socket, connected) =>
				(await runChain(socket, steps, {
					...deps,
					saveBookmark: leafId => setPaneBookmark(paneKey, connected.instanceId, leafId, deps.paneDir),
				}))
					? EXIT_OK
					: EXIT_FAIL,
			);
		}
		return EXIT_OK;
	}
	const request = buildPromptRequest(command.prompt, deps.cwd);
	return await withHost(deps, paneKey, host, async (socket, connected) => {
		if (mode !== undefined && !(await setApprovalMode(socket, mode, deps))) return EXIT_FAIL;
		return await runTurn(socket, request, command.followUp ? "followUp" : "steer", {
			...deps,
			saveBookmark: leafId => setPaneBookmark(paneKey, connected.instanceId, leafId, deps.paneDir),
		});
	});
}

/**
 * Chain steps in order on one connection; false at the first failure, after its notice.
 * `/model` output goes to stderr: in a chain, stdout carries only replies.
 */
async function runChain(
	socket: HostSocket,
	steps: readonly ChainStep[],
	deps: MainDeps & { saveBookmark(leafId: string): void },
): Promise<boolean> {
	for (const step of steps) {
		if (step.kind === "last") {
			if ((await printLastText(socket, deps)) !== EXIT_OK) return false;
		} else if (step.kind === "mode") {
			if (!(await setApprovalMode(socket, step.mode, deps))) return false;
		} else {
			// A failed `/model` ends with a prompt_result error, which runTurn maps to a non-zero exit.
			const code = await runTurn(socket, buildPromptRequest(`/model ${step.model}`, deps.cwd), "steer", {
				...deps,
				writeCommandOutput: async text => {
					for (const line of text.replace(/\n+$/, "").split("\n")) deps.printNotice(line);
				},
			});
			if (code !== EXIT_OK) return false;
		}
	}
	return true;
}

const APPROVAL_GET_ID = "shell-approval-get";
const APPROVAL_SET_ID = "shell-approval-set";
const APPROVAL_FORCED = "omp-shell: host runs with --yolo/--auto-approve; approval mode cannot change";

/** Session-only override over `set_approval_mode`; false after printing the host's error. */
async function setApprovalMode(socket: HostSocket, mode: ApprovalMode, deps: MainDeps): Promise<boolean> {
	const set = (await requestData(socket, { id: APPROVAL_SET_ID, type: "set_approval_mode", mode }, deps)) as {
		mode?: unknown;
	} | null;
	if (set === null) return false;
	deps.printNotice(`perms: ${typeof set.mode === "string" ? set.mode : mode}`);
	return true;
}

/** `/perms`: picker of the four approval modes, the current one preselected; a forced host gets no picker. */
async function runPerms(socket: HostSocket, deps: MainDeps): Promise<number> {
	const current = (await requestData(socket, { id: APPROVAL_GET_ID, type: "get_approval_mode" }, deps)) as {
		mode?: ApprovalMode;
		forced?: boolean;
	} | null;
	if (!current?.mode) return EXIT_FAIL;
	if (current.forced) {
		deps.printNotice(APPROVAL_FORCED);
		return EXIT_FAIL;
	}
	const picked = await deps.pickApprovalMode(current.mode);
	if (picked === "no-tty") {
		deps.printNotice("omp-shell: no tty for the picker; use ? --ask, --ask-cached, --write or --yolo");
		return EXIT_FAIL;
	}
	if (picked === null) return EXIT_OK;
	return (await setApprovalMode(socket, picked, deps)) ? EXIT_OK : EXIT_FAIL;
}

const DEFAULT_DIFF_INSTRUCTION = "summarize this diff";

/**
 * `/diff [instruction]`: instruction, then the pane cwd's uncommitted diff, then piped stdin.
 * Null (after a notice) when there is no repository or nothing to diff.
 */
async function diffPrompt(instruction: string | null, deps: MainDeps): Promise<string | null> {
	// Loaded here, not at the top: the native module is only needed by `/diff`.
	const vcs = await import("@oh-my-pi/pi-natives/vcs");
	const repo = vcs.repo(deps.cwd);
	if (!repo) {
		deps.printNotice(`omp-shell: ${deps.cwd} is not in a repository`);
		return null;
	}
	const diff = (await repo.uncommittedDiff([])).replace(/\s+$/, "");
	if (diff.length === 0) {
		deps.printNotice("omp-shell: no uncommitted changes");
		return null;
	}
	return mergeStdin(`${instruction ?? DEFAULT_DIFF_INSTRUCTION}\n\n${diff}`, deps.stdin);
}

const EXPORT_ID = "shell-export";

const EXPORT_NEGOTIATE_ID = "shell-export-protocol";
const EXPORT_TOO_LARGE = "omp-shell: transcript too large to export (over 64 MiB)";

/**
 * `/export [N]`: the active branch as markdown on stdout, unrendered; no turn.
 * `get_entries` of a long session exceeds the 1 MiB v1 frame, so this connection
 * negotiates protocol v2 and reassembles `rpc_chunk` frames (up to 64 MiB).
 */
async function printTranscript(socket: HostSocket, turns: number | undefined, deps: MainDeps): Promise<number> {
	const negotiated = (await requestData(
		socket,
		{ id: EXPORT_NEGOTIATE_ID, type: "negotiate_protocol", protocolVersion: 2 },
		deps,
	)) as { protocolVersion?: unknown } | null;
	if (negotiated?.protocolVersion !== 2) {
		if (negotiated !== null) deps.printNotice("omp-shell: the host did not accept RPC protocol v2");
		return EXIT_FAIL;
	}
	socket.send({ id: EXPORT_ID, type: "get_entries" });
	const decoder = new RpcFrameDecoder();
	let response: Frame | undefined;
	try {
		while (response === undefined) {
			const raw = await socket.next();
			if (raw === null) {
				deps.printNotice("omp-shell: host closed the connection");
				return EXIT_FAIL;
			}
			const frame = decoder.push(raw) as Frame | undefined;
			if (frame?.type === "response" && frame.id === EXPORT_ID) response = frame;
		}
	} catch (error) {
		deps.printNotice(`omp-shell: ${error instanceof Error ? error.message : String(error)}`);
		return EXIT_FAIL;
	}
	if (response.success === false) {
		const error = String(response.error ?? "get_entries failed");
		deps.printNotice(error.includes("transport limit") ? EXPORT_TOO_LARGE : `omp-shell: ${error}`);
		return EXIT_FAIL;
	}
	const data = response.data as { entries?: unknown; leafId?: unknown } | undefined;
	if (!data || !Array.isArray(data.entries)) return EXIT_FAIL;
	const text = transcriptMarkdown(data.entries, typeof data.leafId === "string" ? data.leafId : null, turns);
	if (text.length === 0) {
		deps.printNotice("the session has no transcript yet");
		return EXIT_FAIL;
	}
	await deps.writeCommandOutput(text);
	return EXIT_OK;
}

const PLAN_STATE_ID = "shell-plan-state";
const PLAN_SET_ID = "shell-plan-set";

/** A response's data, or null after printing its error. */
async function requestData(socket: HostSocket, frame: Frame, deps: MainDeps): Promise<unknown> {
	socket.send(frame);
	const response = await socket.response(String(frame.id));
	if (response === null) {
		deps.printNotice("omp-shell: host closed the connection");
		return null;
	}
	if (response.success === false) {
		deps.printNotice(`omp-shell: ${String(response.error ?? `${String(frame.type)} failed`)}`);
		return null;
	}
	return response.data ?? null;
}

/**
 * `/plan [prompt]`: the TUI `/plan` toggle over `set_plan_mode`. On: turn it off (the TUI
 * drops the prompt then too). Off: turn it on and send the prompt as the first plan-mode
 * turn; a paused plan mode without a prompt is cleared instead, like the TUI's third toggle.
 */
async function runPlan(
	socket: HostSocket,
	prompt: string | null,
	deps: MainDeps & { saveBookmark(leafId: string): void },
): Promise<number> {
	const current = (await requestData(socket, { id: PLAN_STATE_ID, type: "get_plan_state" }, deps)) as {
		state?: RpcPlanState;
	} | null;
	if (!current?.state) return EXIT_FAIL;
	const enable = !current.state.enabled && !(current.state.paused && prompt === null);
	const set = (await requestData(socket, { id: PLAN_SET_ID, type: "set_plan_mode", enabled: enable }, deps)) as {
		state?: RpcPlanState;
	} | null;
	if (!set?.state) return EXIT_FAIL;
	const file = set.state.planFilePath;
	deps.printNotice(set.state.enabled ? `plan mode: on${file ? ` (${file})` : ""}` : "plan mode: off");
	if (prompt === null) return EXIT_OK;
	if (!enable) {
		deps.printNotice("omp-shell: plan mode was on; the prompt was not sent");
		return EXIT_FAIL;
	}
	return await runTurn(socket, buildPromptRequest(prompt, deps.cwd), "steer", deps);
}

/** `/output [default|N|all]`: show or set `shell.toolLines`, the result lines under each tool line. */
async function runOutput(arg: string | null, deps: MainDeps): Promise<number> {
	if (arg === null) {
		const lines = toolLinesOf(await readGlobalConfig(deps.agentDir));
		deps.printNotice(`tool result lines: ${lines} (? /output default|N|all to change)`);
		return EXIT_OK;
	}
	const lines = parseToolLines(arg);
	if (lines === null) {
		deps.printNotice(`omp-shell: /output takes default, a line count (0 or more) or all, not "${arg}"`);
		return EXIT_USAGE;
	}
	await writeShellSetting("toolLines", lines, deps.agentDir);
	deps.printNotice(`tool result lines: ${lines}`);
	return EXIT_OK;
}

const STATUS_ID = "status";
/** `/status` label column: the longest label (`toolLines`) plus three spaces. */
const STATUS_LABEL_WIDTH = "toolLines".length + 3;

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

/** Style of a `/status` value; null keeps it plain. */
function statusValueStyle(label: string, value: string): string | null {
	if (label === "none" || (label === "key" && value.startsWith("none "))) return DIM;
	if (label === "state") return value === "settled" ? GREEN : YELLOW;
	if (label === "bookmark") return value === "pending" ? YELLOW : DIM;
	if (label === "context") {
		const percent = Number(/\((\d+)%\)$/.exec(value)?.[1] ?? 0);
		return percent >= 80 ? RED : percent >= 50 ? YELLOW : null;
	}
	return null;
}

/** Formats `/status` rows; escapes only when `color`, and always added after the width math. */
function statusPrinter(color: boolean) {
	const paint = (style: string, text: string) => (color ? `${style}${text}${RESET}` : text);
	return {
		header: (name: string) => paint(BOLD, name),
		row(label: string, value: string): string {
			const pad = " ".repeat(Math.max(0, STATUS_LABEL_WIDTH - label.length));
			const style = statusValueStyle(label, value);
			let shown = style ? paint(style, value) : value;
			if (label === "attached" && value.endsWith(" (tui)")) shown = `${value.slice(0, -5)}${paint(CYAN, "(tui)")}`;
			return `  ${paint(DIM, label)}${pad}${shown}`;
		},
	};
}

/**
 * `/status` (`/st`): shell settings, the pane binding, and one `get_state` of the
 * attached session. Read-only: no turn, no prompt, no picker, no bookmark replay.
 */
async function runStatus(deps: MainDeps): Promise<number> {
	const config = await readGlobalConfig(deps.agentDir);
	const render = config?.shell?.render;
	// Loaded here, not at the top: render-utils costs ~100ms and every other `?` skips it.
	const print = statusPrinter(deps.color ?? (process.stderr.isTTY === true && !Bun.env.NO_COLOR));
	const statusRow = print.row;
	const { shortenPath, truncateMiddleToWidth } = await import("@oh-my-pi/pi-tui/render/render-utils");
	deps.printNotice(print.header("shell"));
	deps.printNotice(statusRow("config", shortenPath(globalConfigPath(deps.agentDir))));
	deps.printNotice(statusRow("toolLines", String(toolLinesOf(config))));
	deps.printNotice(statusRow("render", typeof render === "string" && render.trim() ? render : "unset"));
	deps.printNotice(statusRow("status", config?.terminal?.programStatus === false ? "off" : "on"));
	deps.printNotice(print.header("pane"));
	const unattached = () => {
		deps.printNotice(print.header("session"));
		deps.printNotice(statusRow("none", "no session attached (? /a to pick one)"));
		return EXIT_OK;
	};
	if (deps.paneKey === null) {
		deps.printNotice(statusRow("key", "none (no tmux pane or tty identifies this shell)"));
		return unattached();
	}
	deps.printNotice(statusRow("key", deps.paneKey));
	const state = readPaneState(deps.paneKey, deps.paneDir);
	if (!state) return unattached();
	const entry = readRpcHost(state.instanceId, deps.registryDir === undefined ? undefined : { dir: deps.registryDir });
	deps.printNotice(statusRow("attached", `${state.instanceId}${entry ? ` (${hostKind(entry)})` : ""}`));
	deps.printNotice(statusRow("session", state.sessionId ?? entry?.sessionId ?? "unknown"));
	deps.printNotice(statusRow("bookmark", state.bookmark === undefined ? "none" : "pending"));
	const host = await readLiveHost(state.instanceId, deps.registryDir);
	if (!host) {
		deps.printNotice(`omp-shell: attached instance ${state.instanceId} is not running`);
		return EXIT_FAIL;
	}
	const opened = await HostSocket.open(host.endpoint, {
		type: "auth",
		token: host.token,
		surface: "shell",
		clientId: paneClientId(deps.paneKey),
		attachment: deps.paneKey,
	});
	if (!opened.ok) {
		deps.printNotice(`omp-shell: ${opened.error}`);
		return EXIT_FAIL;
	}
	try {
		opened.socket.send({ id: STATUS_ID, type: "get_state", light: true });
		for (;;) {
			const frame = await opened.socket.next();
			if (frame === null) {
				deps.printNotice("omp-shell: host closed the connection");
				return EXIT_FAIL;
			}
			if (frame.type !== "response" || frame.id !== STATUS_ID) continue;
			if (frame.success === false) {
				deps.printNotice(`omp-shell: ${String(frame.error ?? "get_state failed")}`);
				return EXIT_FAIL;
			}
			const columns = process.stderr.columns || 80;
			const shortFile = (file: string) => {
				const short = shortenPath(file);
				const slash = short.lastIndexOf("/") + 1;
				// Row: indent + label column + value, kept under the terminal width; only the basename is cut.
				const room = columns - 1 - 2 - STATUS_LABEL_WIDTH - slash;
				return short.slice(0, slash) + truncateMiddleToWidth(short.slice(slash), Math.max(16, room));
			};
			deps.printNotice(print.header("session"));
			const rows = sessionRows(frame.data as Partial<RpcSessionState>, host, shortenPath, shortFile);
			// An older host answers "Unknown command": the row is omitted.
			opened.socket.send({ id: APPROVAL_GET_ID, type: "get_approval_mode" });
			const approval = await opened.socket.response(APPROVAL_GET_ID);
			const perms = approval?.success === true ? (approval.data as { mode?: unknown; forced?: unknown }) : null;
			if (typeof perms?.mode === "string") {
				rows.push(["perms", `${perms.mode}${perms.forced === true ? " (forced by --yolo)" : ""}`]);
			}
			for (const [label, value] of rows) deps.printNotice(statusRow(label, value));
			return EXIT_OK;
		}
	} finally {
		opened.socket.close();
	}
}

function sessionRows(
	state: Partial<RpcSessionState>,
	host: RpcHostEntry,
	shortenPath: (file: string) => string,
	shortFile: (file: string) => string,
): Array<[string, string]> {
	const rows: Array<[string, string]> = [["name", state.sessionName || "(unnamed)"]];
	const model = state.model ? `${state.model.provider}/${state.model.id}` : "none";
	rows.push(["model", `${model}${state.thinkingLevel ? ` (thinking ${state.thinkingLevel})` : ""}`]);
	rows.push(["cwd", shortenPath(host.cwd)]);
	rows.push(["file", state.sessionFile ? shortFile(state.sessionFile) : "none"]);
	const usage = state.contextUsage;
	rows.push([
		"context",
		usage && typeof usage.tokens === "number"
			? `${usage.tokens.toLocaleString("en-US")} / ${usage.contextWindow.toLocaleString("en-US")} tokens (${Math.round(usage.percent)}%)`
			: "unknown",
	]);
	const queued = state.queuedMessageCount ? `, ${state.queuedMessageCount} queued` : "";
	rows.push(["messages", `${state.messageCount ?? 0}${queued}`]);
	const tasks = (state.todoPhases ?? []).flatMap(phase => phase.tasks);
	if (tasks.length > 0) {
		const done = tasks.filter(task => task.status === "completed").length;
		const current = tasks.find(task => task.status === "in_progress");
		rows.push(["todos", `${done}/${tasks.length} done${current ? ` (now: ${current.content})` : ""}`]);
	}
	const busy = state.isCompacting ? "busy (compacting)" : state.isStreaming ? "busy (running)" : null;
	rows.push(["state", busy ?? (state.isSettled === false ? "idle, background work pending" : "settled")]);
	return rows;
}

/**
 * Sends `attach_shell` so a pane attached without a prompt still detaches
 * when another surface drives. Returns an error message, or null on success.
 */
async function registerAttachment(host: RpcHostEntry, paneKey: string, deps: MainDeps): Promise<string | null> {
	const auth = {
		type: "auth",
		token: host.token,
		surface: "shell",
		clientId: paneClientId(paneKey),
		attachment: paneKey,
	} as const;
	let opened = await HostSocket.open(host.endpoint, auth);
	// The host refuses a detached pane once; the user just picked this host, so that refusal is already answered.
	if (!opened.ok && opened.code === "attachment_detached") opened = await HostSocket.open(host.endpoint, auth);
	if (!opened.ok) return opened.error;
	try {
		opened.socket.send({ id: "attach", type: "attach_shell" });
		for (let i = 0; i < 10_000; i++) {
			const frame = await opened.socket.next();
			if (frame === null) return "host closed the connection";
			if (frame.type === "response" && frame.id === "attach") {
				if (frame.success !== true) return String(frame.error ?? "attach_shell failed");
				await replayBookmark(opened.socket, deps, paneKey, host);
				return null;
			}
		}
		return "no attach_shell response";
	} finally {
		opened.socket.close();
	}
}

/** Auth, with one detach recovery: notice, picker, re-attach, then the held action. */
async function withHost(
	deps: MainDeps,
	paneKey: string,
	first: RpcHostEntry,
	action: (socket: HostSocket, host: RpcHostEntry) => Promise<number>,
): Promise<number> {
	let host = first;
	for (let attempt = 0; attempt < 2; attempt++) {
		const opened = await HostSocket.open(host.endpoint, {
			type: "auth",
			token: host.token,
			surface: "shell",
			clientId: paneClientId(paneKey),
			attachment: paneKey,
		});
		if (opened.ok) {
			try {
				await replayBookmark(opened.socket, deps, paneKey, host);
				return await action(opened.socket, host);
			} finally {
				opened.socket.close();
			}
		}
		if (opened.code !== "attachment_detached" || attempt > 0) {
			deps.printNotice(`omp-shell: ${opened.error}`);
			return EXIT_FAIL;
		}
		deps.printNotice(`pane detached from ${opened.instanceId ?? host.instanceId}`);
		clearPaneState(paneKey, deps.paneDir);
		const picked = await pickAndAttach(deps, paneKey);
		if (!picked) return EXIT_FAIL;
		host = picked;
	}
	throw new Error("unreachable: detach recovery is bounded to one retry");
}

/**
 * Prints what this pane missed since Ctrl-C detached it, once: the bookmark is
 * cleared before the fetch so a failing replay or command never repeats it.
 */
async function replayBookmark(socket: HostSocket, deps: MainDeps, paneKey: string, host: RpcHostEntry): Promise<void> {
	const state = readPaneState(paneKey, deps.paneDir);
	if (state?.instanceId !== host.instanceId || state.bookmark === undefined) return;
	setPaneBookmark(paneKey, host.instanceId, null, deps.paneDir);
	const outcome = await replayMissed(socket, state.bookmark, deps);
	if (outcome === "unknown_since") deps.chrome.line("omp-shell: the session moved on; nothing to replay since detach");
	else if (outcome === "failed") deps.chrome.line("omp-shell: could not replay what this pane missed");
}

/** Starts (or, for a live `resume`, reuses) a host and attaches the pane to it. */
async function startAndAttach(
	deps: MainDeps,
	paneKey: string,
	cwd: string,
	resume?: string,
): Promise<RpcHostEntry | null> {
	let started: { instanceId: string };
	try {
		started = await deps.startHost(cwd, resume);
	} catch (error) {
		deps.printNotice(`omp-shell: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
	// `host start --resume` answers with whatever live process holds the session, including a TUI,
	// which the pane then drives over its socket.
	const host = await readLiveHost(started.instanceId, deps.registryDir);
	if (!host) {
		const holder = readRpcHost(
			started.instanceId,
			deps.registryDir === undefined ? undefined : { dir: deps.registryDir },
		);
		deps.printNotice(
			holder && hostKind(holder) === "tui"
				? "omp-shell: the TUI holding that session does not answer on its socket"
				: `omp-shell: host ${started.instanceId} did not come up`,
		);
		return null;
	}
	writePaneState(paneKey, host.instanceId, deps.paneDir, host.sessionId);
	return host;
}

async function pickAndAttach(deps: MainDeps, paneKey: string): Promise<RpcHostEntry | null> {
	const hosts = await listLiveHosts(deps.registryDir);
	if (hosts.length === 0) {
		deps.printNotice("no live sessions (? /n to start one)");
		return null;
	}
	const picked = await deps.pickHost(hosts.map(hostRow));
	const host = picked ? hosts.find(entry => entry.instanceId === picked.instanceId) : undefined;
	if (!host) return null;
	writePaneState(paneKey, host.instanceId, deps.paneDir, host.sessionId);
	return host;
}

/** `printNotice` flattens newlines; candidate lists need one session per line. */
function printMultiline(deps: MainDeps, text: string): void {
	for (const line of text.split("\n")) deps.printNotice(line);
}

/** `/a --id`: the live session (TUI or host) whose session id equals or uniquely starts with `query`. */
async function attachById(deps: MainDeps, paneKey: string, query: string): Promise<RpcHostEntry | null> {
	const match = resolveLiveSession(await listLiveHosts(deps.registryDir), query);
	if (!match.ok) {
		printMultiline(deps, `omp-shell: ${match.error}`);
		return null;
	}
	writePaneState(paneKey, match.entry.instanceId, deps.paneDir, match.entry.sessionId);
	return match.entry;
}

/** `/r --id`: a live session with that id is attached as is; otherwise the past session is resumed in a host. */
async function resumeById(deps: MainDeps, paneKey: string, query: string): Promise<RpcHostEntry | null> {
	const live = await listLiveHosts(deps.registryDir);
	const liveMatch = resolveLiveSession(live, query);
	if (liveMatch.ok) {
		writePaneState(paneKey, liveMatch.entry.instanceId, deps.paneDir, liveMatch.entry.sessionId);
		return liveMatch.entry;
	}
	if (live.some(entry => entry.sessionId?.startsWith(query))) {
		printMultiline(deps, `omp-shell: ${liveMatch.error}`);
		return null;
	}
	const past = await resolvePastSession(query, deps.sessionsRoot);
	if (!past.ok) {
		printMultiline(deps, `omp-shell: ${past.error}`);
		return null;
	}
	return await startAndAttach(deps, paneKey, past.session.cwd || deps.cwd, past.session.path);
}

/**
 * The bound instance is gone (e.g. a TUI took the session over and shut its host down):
 * rebinds to the one live process now serving the same session id, keeping the bookmark.
 */
async function reattachBySession(deps: MainDeps, paneKey: string, sessionId: string): Promise<RpcHostEntry | null> {
	const matches = (await listLiveHosts(deps.registryDir)).filter(entry => entry.sessionId === sessionId);
	// The session lock allows one writer; several entries means the registry is mid-handover, so let the user pick.
	if (matches.length !== 1) return null;
	const host = matches[0]!;
	writePaneState(paneKey, host.instanceId, deps.paneDir, host.sessionId);
	return host;
}

function describe(host: RpcHostEntry): string {
	const label = host.sessionName ? `${host.sessionName} (${host.instanceId})` : host.instanceId;
	return hostKind(host) === "tui" ? `${label} [tui]` : label;
}

/** `omp host start --cwd <cwd> [--resume <file>]`; the last stdout line is the JSON result. */
export async function startHostProcess(cwd: string, resume?: string): Promise<{ instanceId: string }> {
	const omp = Bun.env.OMP_SHELL_OMP_BIN ?? "omp";
	const argv = [omp, "host", "start", "--cwd", cwd];
	if (resume !== undefined) argv.push("--resume", resume);
	const child = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (code !== 0) throw new Error(`omp host start failed (${code}): ${stderr.trim()}`);
	const lines = stdout.trim().split("\n");
	const parsed: unknown = JSON.parse(lines[lines.length - 1] ?? "");
	if (typeof parsed !== "object" || parsed === null) throw new Error("omp host start: no JSON result");
	const instanceId = (parsed as Record<string, unknown>).instanceId;
	if (typeof instanceId !== "string") throw new Error("omp host start: result has no instanceId");
	return { instanceId };
}

/** Path of the shell's controlling tty, from the parent process (stdin may be a pipe). */
function controllingTty(): string | undefined {
	const result = Bun.spawnSync(["ps", "-o", "tty=", "-p", String(process.ppid)]);
	const name = result.stdout.toString().trim();
	if (result.exitCode !== 0 || name.length === 0 || name === "?" || name === "??") return undefined;
	return name.startsWith("/dev/") ? name : `/dev/${name}`;
}

async function main(): Promise<never> {
	const argv = process.argv.slice(2);
	if (argv[0] === "--setup" || argv[0] === "--uninstall") process.exit(runSetup(argv));
	const stdin = await readPipedStdin();
	const controller = new AbortController();
	const forceExit = new AbortController();
	process.on("SIGINT", () => {
		if (controller.signal.aborted) forceExit.abort();
		else controller.abort();
	});
	// An unreadable config is reported by the render path; status reporting stays on.
	const config = await globalConfig().catch(() => null);
	const programStatus = config?.terminal?.programStatus !== false;
	const writeRaw = async (raw: string) => {
		await Bun.write(Bun.stdout, raw);
	};
	const code = await run({
		argv,
		stdin,
		cwd: process.cwd(),
		paneKey: encodePaneKey({ tmuxPane: Bun.env.TMUX_PANE, tmuxSocket: Bun.env.TMUX, tty: controllingTty() }),
		paneDir: paneStateDir(),
		pickHost: ttyUi.pickHost,
		pickApprovalMode: ttyUi.pickApprovalMode,
		answerUiRequest: ttyUi.answerUiRequest,
		printNotice: ttyUi.printNotice,
		startHost: startHostProcess,
		// Awaited per reply so each one is on the terminal before the next run streams; an
		// awaited write also survives process.exit, which can drop pending pipe writes.
		writeStdout: text =>
			emitOutput(text, {
				tty: process.stdout.isTTY === true,
				renderCommand: loadRenderCommand,
				runRender: runRenderCommand,
				writeRaw,
				notice: ttyUi.printNotice,
			}),
		writeCommandOutput: writeRaw,
		chrome: new Chrome({ toolLines: toolLinesOf(config) }),
		interrupt: controller.signal,
		forceExit: forceExit.signal,
		reportStatus: programStatus ? ttyStatusReporter() : () => {},
	});
	process.exit(code);
}

if (import.meta.main) await main();
