#!/usr/bin/env bun
/**
 * `omp-shell` — the `?` client. One process, one host connection, one turn.
 * input (argv, piped stdin) -> parse -> resolve attachment -> turn -> exit code.
 */
import { parseArgv, readPipedStdin } from "./commands";
import { HostSocket } from "./host-socket";
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
import { hostRow, listLiveHosts, type RpcHostEntry, readLiveHost } from "./registry";
import { listPastSessions, sessionRow } from "./sessions";
import { runSetup } from "./setup";
import * as ttyUi from "./tty-ui";
import { globalConfig, parseToolLines, readGlobalConfig, toolLinesOf, writeShellSetting } from "./config";
import { type ProgramStatus, ttyStatusReporter } from "./program-status";
import { emitOutput, loadRenderCommand, runRenderCommand } from "./render";
import { buildPromptRequest, EXIT_FAIL, EXIT_OK, printLastText, replayMissed, runTurn } from "./turn";

const EXIT_USAGE = 2;
const USAGE =
	"usage: ? [/f] <prompt> | ? /a [prompt|/l] | ? /r [--all] [prompt|/l] | ? /n [prompt|/l] | ? /last (/l) | ? /u | ? /m [model] | ? /output [default|N|all]   (omp-shell --setup to install ?)";

export interface MainDeps {
	argv: string[];
	stdin: string | null;
	cwd: string;
	paneKey: string | null;
	paneDir: string;
	/** Registry dir override (tests); undefined uses the default. */
	registryDir?: string;
	pickHost(rows: ttyUi.HostRow[]): Promise<ttyUi.HostRow | null>;
	answerUiRequest(req: Record<string, unknown>): Promise<Record<string, unknown>>;
	printNotice(text: string): void;
	/** `omp host start`; with `resume`, the host for that session file (reused when live). */
	startHost(cwd: string, resume?: string): Promise<{ instanceId: string }>;
	/** Sessions root override (tests); undefined uses the default. */
	sessionsRoot?: string;
	/** Global config dir override (tests); undefined uses the omp agent dir. */
	agentDir?: string;
	writeStdout(text: string): Promise<void>;
	chrome: Chrome;
	interrupt: AbortSignal;
	/** Second Ctrl-C: skip the detach bookmark and exit. */
	forceExit: AbortSignal;
	reportStatus(status: ProgramStatus): void;
}

export async function run(deps: MainDeps): Promise<number> {
	const command = parseArgv(deps.argv, deps.stdin);
	const paneKey = deps.paneKey;
	if (command.kind === "prompt" && command.prompt === null) {
		deps.printNotice(USAGE);
		return EXIT_USAGE;
	}
	if (command.kind === "output") return await runOutput(command.prompt, deps);
	if (paneKey === null) {
		deps.printNotice("omp-shell: no tmux pane or tty identifies this shell");
		return EXIT_FAIL;
	}

	let host: RpcHostEntry | null;
	if (command.kind === "new") {
		host = await startAndAttach(deps, paneKey, deps.cwd);
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
		host = await pickAndAttach(deps, paneKey);
	} else {
		const state = readPaneState(paneKey, deps.paneDir);
		host = state ? await readLiveHost(state.instanceId, deps.registryDir) : null;
		if (!host) {
			deps.printNotice("no session attached (? /a to attach, ? /n to start one)");
			return EXIT_FAIL;
		}
	}
	if (!host) return EXIT_FAIL;

	if (command.kind === "last") return await withHost(deps, paneKey, host, socket => printLastText(socket, deps));
	if (command.prompt === null) {
		const registered = await registerAttachment(host, paneKey, deps);
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
		return EXIT_OK;
	}
	const request = buildPromptRequest(command.prompt, deps.cwd);
	return await withHost(deps, paneKey, host, (socket, connected) =>
		runTurn(socket, request, command.followUp ? "followUp" : "steer", {
			...deps,
			saveBookmark: leafId => setPaneBookmark(paneKey, connected.instanceId, leafId, deps.paneDir),
		}),
	);
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
	const host = await readLiveHost(started.instanceId, deps.registryDir);
	if (!host) {
		// `host start --resume` answers with whatever live process holds the session, including a TUI.
		const holder = readRpcHost(
			started.instanceId,
			deps.registryDir === undefined ? undefined : { dir: deps.registryDir },
		)?.kind;
		deps.printNotice(
			holder === "tui"
				? "omp-shell: that session is open in a TUI; quit it there first"
				: `omp-shell: host ${started.instanceId} did not come up`,
		);
		return null;
	}
	writePaneState(paneKey, host.instanceId, deps.paneDir);
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
	writePaneState(paneKey, host.instanceId, deps.paneDir);
	return host;
}

function describe(host: RpcHostEntry): string {
	return host.sessionName ? `${host.sessionName} (${host.instanceId})` : host.instanceId;
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
	const code = await run({
		argv,
		stdin,
		cwd: process.cwd(),
		paneKey: encodePaneKey({ tmuxPane: Bun.env.TMUX_PANE, tmuxSocket: Bun.env.TMUX, tty: controllingTty() }),
		paneDir: paneStateDir(),
		pickHost: ttyUi.pickHost,
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
				writeRaw: async raw => {
					await Bun.write(Bun.stdout, raw);
				},
				notice: ttyUi.printNotice,
			}),
		chrome: new Chrome({ toolLines: toolLinesOf(config) }),
		interrupt: controller.signal,
		forceExit: forceExit.signal,
		reportStatus: programStatus ? ttyStatusReporter() : () => {},
	});
	process.exit(code);
}

if (import.meta.main) await main();
