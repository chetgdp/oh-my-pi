import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import {
	acquireSessionLock,
	listRpcHosts,
	probeRpcHost,
	readRpcHost,
	rpcSessionLockPath,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";

const cliEntry = path.resolve(import.meta.dir, "..", "src", "cli.ts");

interface StartResult {
	instanceId: string;
	sessionId: string;
	endpoint: string;
	pid: number;
	reused: boolean;
}

interface Sandbox {
	root: string;
	registryDir: string;
	sessionDir: string;
	env: Record<string, string>;
}

const tempDirs: TempDir[] = [];
const hostPids = new Set<number>();

function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function makeSandbox(env: Record<string, string> = {}): Sandbox {
	const dir = TempDir.createSync("@omp-rpc-host-");
	tempDirs.push(dir);
	const root = dir.path();
	const registryDir = path.join(root, "reg");
	const sessionDir = path.join(root, "sessions");
	const agentDir = path.join(root, "agent");
	const xdg = path.join(root, "xdg");
	for (const d of [sessionDir, agentDir, xdg]) fs.mkdirSync(d, { recursive: true });
	return {
		root,
		registryDir,
		sessionDir,
		env: {
			...(process.env as Record<string, string>),
			// HOME stays: Bun's transpile cache lives there. These isolate omp state.
			XDG_DATA_HOME: xdg,
			XDG_CONFIG_HOME: xdg,
			PI_CODING_AGENT_DIR: agentDir,
			PI_CODING_AGENT_SESSION_DIR: sessionDir,
			ANTHROPIC_API_KEY: "sk-ant-test-not-real",
			PI_NO_TITLE: "1",
			NO_COLOR: "1",
			...env,
		},
	};
}

async function hostStart(
	sandbox: Sandbox,
	extra: string[] = [],
): Promise<{ code: number; stdout: string; stderr: string; result?: StartResult }> {
	const proc = Bun.spawn(
		["bun", cliEntry, "host", "start", "--cwd", sandbox.root, "--registry-dir", sandbox.registryDir, ...extra],
		{ cwd: sandbox.root, env: sandbox.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
	);
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	let result: StartResult | undefined;
	if (code === 0) {
		result = JSON.parse(stdout) as StartResult;
		hostPids.add(result.pid);
	}
	return { code, stdout, stderr, result };
}

// The host is a separate detached process: its exit and file cleanup have no in-process signal to await.
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return true;
		await Bun.sleep(50);
	}
	return predicate();
}

/** Persist a resumable session file in the sandbox's session dir. */
async function writeSessionFile(sandbox: Sandbox): Promise<{ sessionId: string; sessionFile: string }> {
	const sm = SessionManager.create(sandbox.root, sandbox.sessionDir);
	sm.appendMessage({ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() });
	sm.appendMessage({
		role: "assistant",
		content: [{ type: "text", text: "hi" }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	});
	await sm.close();
	const sessionFile = sm.getSessionFile();
	if (!sessionFile || !fs.existsSync(sessionFile)) throw new Error("session file was not persisted");
	return { sessionId: sm.getSessionId(), sessionFile };
}

/** Authenticate on the host socket and return the `get_state` response frame. */
async function getStateOverSocket(endpoint: string, token: string): Promise<Record<string, unknown>> {
	const socket = net.connect(endpoint);
	const { promise, resolve, reject } = Promise.withResolvers<Record<string, unknown>>();
	const timer = setTimeout(() => reject(new Error("get_state timed out")), 10_000);
	let buffer = "";
	socket.on("error", reject);
	socket.on("data", chunk => {
		buffer += chunk.toString("utf8");
		let newline = buffer.indexOf("\n");
		while (newline !== -1) {
			const line = buffer.slice(0, newline);
			buffer = buffer.slice(newline + 1);
			newline = buffer.indexOf("\n");
			const frame = JSON.parse(line) as Record<string, unknown>;
			if (frame.type === "response" && frame.command === "get_state") resolve(frame);
		}
	});
	socket.once("connect", () => {
		socket.write(`${JSON.stringify({ type: "auth", token })}\n`);
		socket.write(`${JSON.stringify({ id: "s1", type: "get_state" })}\n`);
	});
	try {
		return await promise;
	} finally {
		clearTimeout(timer);
		socket.destroy();
	}
}

afterEach(async () => {
	for (const pid of hostPids) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			/* Already gone. */
		}
	}
	hostPids.clear();
	await Promise.all(tempDirs.splice(0).map(dir => dir.remove()));
});

describe("omp host start", () => {
	it("prints one JSON line and serves get_state over the token handshake", async () => {
		const sandbox = makeSandbox();
		const { code, stdout, stderr, result } = await hostStart(sandbox);
		expect(stderr).toBe("");
		expect(code).toBe(0);
		expect(stdout.trimEnd().split("\n")).toHaveLength(1);
		expect(result).toMatchObject({ reused: false });
		expect(typeof result?.instanceId).toBe("string");
		expect(typeof result?.sessionId).toBe("string");
		expect(result?.pid).not.toBe(process.pid);

		const entry = readRpcHost(result!.instanceId, { dir: sandbox.registryDir });
		expect(entry?.kind).toBe("host");
		expect(entry?.sessionId).toBe(result!.sessionId);
		expect(entry?.endpoint).toBe(result!.endpoint);
		expect(await probeRpcHost(entry!)).toBe(true);

		const response = await getStateOverSocket(entry!.endpoint, entry!.token);
		expect(response.success).toBe(true);
		expect((response.data as Record<string, unknown>).sessionId).toBe(result!.sessionId);
	}, 60_000);

	it("returns the live host with reused:true when resuming its session", async () => {
		const sandbox = makeSandbox();
		const first = await hostStart(sandbox);
		expect(first.code).toBe(0);
		const second = await hostStart(sandbox, ["--resume", first.result!.sessionId]);
		expect(second.code).toBe(0);
		expect(second.result).toEqual({ ...first.result!, reused: true });
		expect(listRpcHosts({ dir: sandbox.registryDir })).toHaveLength(1);
	}, 60_000);

	it("yields a single host for concurrent starts of one session", async () => {
		const sandbox = makeSandbox();
		const { sessionId, sessionFile } = await writeSessionFile(sandbox);
		const [a, b] = await Promise.all([
			hostStart(sandbox, ["--resume", sessionFile]),
			hostStart(sandbox, ["--resume", sessionFile]),
		]);
		expect([a.code, b.code, a.stderr, b.stderr]).toEqual([0, 0, "", ""]);
		expect(a.result!.pid).toBe(b.result!.pid);
		expect(a.result!.sessionId).toBe(sessionId);
		expect([a.result!.reused, b.result!.reused].sort()).toEqual([false, true]);
		// The losing child exits on the lock; only the winner remains registered.
		expect(await waitFor(() => listRpcHosts({ dir: sandbox.registryDir }).length === 1, 5_000)).toBe(true);
	}, 60_000);

	it("exits when idle and removes its registry entry, socket, and lock", async () => {
		const sandbox = makeSandbox({ PI_RPC_HOST_IDLE_TIMEOUT_MS: "500" });
		const { code, result } = await hostStart(sandbox);
		expect(code).toBe(0);
		const lockPath = rpcSessionLockPath(result!.sessionId, { dir: sandbox.registryDir });
		expect(fs.existsSync(lockPath)).toBe(true);

		expect(await waitFor(() => !pidAlive(result!.pid), 15_000)).toBe(true);
		expect(fs.existsSync(result!.endpoint)).toBe(false);
		expect(fs.existsSync(lockPath)).toBe(false);
		expect(fs.readdirSync(sandbox.registryDir).filter(name => name.endsWith(".json"))).toEqual([]);
	}, 60_000);

	it("takes over a lock left by a dead process", async () => {
		const sandbox = makeSandbox();
		const { sessionId, sessionFile } = await writeSessionFile(sandbox);
		const dead = Bun.spawn(["true"]);
		await dead.exited;
		fs.mkdirSync(sandbox.registryDir, { recursive: true, mode: 0o700 });
		const lockPath = rpcSessionLockPath(sessionId, { dir: sandbox.registryDir });
		fs.writeFileSync(lockPath, String(dead.pid));

		const { code, stderr, result } = await hostStart(sandbox, ["--resume", sessionFile]);
		expect(stderr).toBe("");
		expect(code).toBe(0);
		expect(result?.reused).toBe(false);
		expect(fs.readFileSync(lockPath, "utf8")).toBe(String(result!.pid));
	}, 60_000);
});

describe("session lock", () => {
	it("refuses a lock held by a live process", () => {
		const dir = TempDir.createSync("@omp-rpc-lock-");
		tempDirs.push(dir);
		const lockPath = rpcSessionLockPath("s-live", { dir: dir.path() });
		// pid 1 is always alive and never this test process.
		fs.writeFileSync(lockPath, "1");
		expect(acquireSessionLock("s-live", { dir: dir.path() })).toBe(false);
		expect(fs.readFileSync(lockPath, "utf8")).toBe("1");
	});
});
