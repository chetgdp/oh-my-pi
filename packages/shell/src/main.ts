#!/usr/bin/env bun
/**
 * `omp-shell` — the `?` client. One process, one host connection, one turn.
 * input (argv, piped stdin) -> parse -> resolve attachment -> turn -> exit code.
 */
import { parseArgv, readPipedStdin } from "./commands";
import { HostSocket } from "./host-socket";
import { Chrome } from "./output";
import { encodePaneKey } from "./pane-key";
import { clearPaneState, paneClientId, paneStateDir, readPaneState, writePaneState } from "./pane-state";
import { readRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { hostRow, listLiveHosts, type RpcHostEntry, readLiveHost } from "./registry";
import { listPastSessions, sessionRow } from "./sessions";
import { runSetup } from "./setup";
import * as ttyUi from "./tty-ui";
import { buildPromptRequest, EXIT_FAIL, EXIT_OK, type PromptRequest, runTurn } from "./turn";

const EXIT_USAGE = 2;
const USAGE =
	"usage: ? <prompt> | ? /a [prompt] | ? /r [--all] [prompt] | ? /n [prompt]   (omp-shell --setup to install ?)";

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
	writeStdout(text: string): void;
	chrome: Chrome;
	interrupt: AbortSignal;
}

export async function run(deps: MainDeps): Promise<number> {
	const command = parseArgv(deps.argv, deps.stdin);
	const paneKey = deps.paneKey;
	if (command.kind === "prompt" && command.prompt === null) {
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

	if (command.prompt === null) {
		const registered = await registerAttachment(host, paneKey);
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
		return EXIT_OK;
	}
	return await promptHost(deps, paneKey, host, buildPromptRequest(command.prompt, deps.cwd));
}

/**
 * Sends `attach_shell` so a pane attached without a prompt still detaches
 * when another surface drives. Returns an error message, or null on success.
 */
async function registerAttachment(host: RpcHostEntry, paneKey: string): Promise<string | null> {
	const opened = await HostSocket.open(host.endpoint, {
		type: "auth",
		token: host.token,
		surface: "shell",
		clientId: paneClientId(paneKey),
		attachment: paneKey,
	});
	if (!opened.ok) return opened.error;
	try {
		opened.socket.send({ id: "attach", type: "attach_shell" });
		for (let i = 0; i < 10_000; i++) {
			const frame = await opened.socket.next();
			if (frame === null) return "host closed the connection";
			if (frame.type === "response" && frame.id === "attach") {
				return frame.success === true ? null : String(frame.error ?? "attach_shell failed");
			}
		}
		return "no attach_shell response";
	} finally {
		opened.socket.close();
	}
}

/** Auth, with one detach recovery: notice, picker, re-attach, then the held prompt. */
async function promptHost(
	deps: MainDeps,
	paneKey: string,
	first: RpcHostEntry,
	request: PromptRequest,
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
				return await runTurn(opened.socket, request, deps);
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
	// Buffered and flushed with an awaited write: process.exit can drop pending pipe writes.
	const stdout: string[] = [];
	process.on("SIGINT", () => controller.abort());
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
		writeStdout: text => stdout.push(text),
		chrome: new Chrome(),
		interrupt: controller.signal,
	});
	if (stdout.length > 0) await Bun.write(Bun.stdout, stdout.join(""));
	process.exit(code);
}

if (import.meta.main) await main();
