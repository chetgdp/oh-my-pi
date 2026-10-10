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
async function sendCommandOverSocket(
	endpoint: string,
	token: string,
	command: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const socket = net.connect(endpoint);
	const { promise, resolve, reject } = Promise.withResolvers<Record<string, unknown>>();
	const timer = setTimeout(() => reject(new Error(`${String(command.type)} timed out`)), 10_000);
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
			if (frame.type === "response" && (frame.command === command.type || frame.id === command.id)) {
				resolve(frame);
			}
		}
	});
	socket.once("connect", () => {
		socket.write(`${JSON.stringify({ type: "auth", token })}\n`);
		socket.write(`${JSON.stringify(command)}\n`);
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

	for (const signal of ["SIGTERM", "SIGHUP"] as const) {
		it(`on ${signal} flushes the session, then removes its registry entry, socket, and lock`, async () => {
			const sandbox = makeSandbox();
			const { sessionFile } = await writeSessionFile(sandbox);
			const { code, result } = await hostStart(sandbox, ["--resume", sessionFile]);
			expect(code).toBe(0);
			const lockPath = rpcSessionLockPath(result!.sessionId, { dir: sandbox.registryDir });
			expect(fs.existsSync(lockPath)).toBe(true);
			const entry = readRpcHost(result!.instanceId, { dir: sandbox.registryDir })!;
			const name = `named-before-${signal}`;
			const renamed = await sendCommandOverSocket(entry.endpoint, entry.token, {
				id: "n1",
				type: "set_session_name",
				name,
			});
			expect(renamed.success).toBe(true);

			process.kill(result!.pid, signal);
			expect(await waitFor(() => !pidAlive(result!.pid), 15_000)).toBe(true);
			expect(fs.existsSync(result!.endpoint)).toBe(false);
			expect(fs.existsSync(lockPath)).toBe(false);
			expect(fs.readdirSync(sandbox.registryDir).filter(file => file.endsWith(".json"))).toEqual([]);
			expect(fs.readFileSync(sessionFile, "utf8")).toContain(name);
		}, 60_000);
	}

	it("resumes a session whose host was killed with SIGKILL", async () => {
		const sandbox = makeSandbox();
		const { sessionId, sessionFile } = await writeSessionFile(sandbox);
		const first = await hostStart(sandbox, ["--resume", sessionFile]);
		expect(first.code).toBe(0);
		process.kill(first.result!.pid, "SIGKILL");
		hostPids.delete(first.result!.pid);
		expect(await waitFor(() => !pidAlive(first.result!.pid), 5_000)).toBe(true);
		const lockPath = rpcSessionLockPath(sessionId, { dir: sandbox.registryDir });
		// The killed host left its lock behind; the next host takes it over.
		expect(fs.existsSync(lockPath)).toBe(true);

		const second = await hostStart(sandbox, ["--resume", sessionFile]);
		expect(second.stderr).toBe("");
		expect(second.code).toBe(0);
		expect(second.result!.reused).toBe(false);
		expect(second.result!.sessionId).toBe(sessionId);
		expect(second.result!.pid).not.toBe(first.result!.pid);
		expect(fs.readFileSync(lockPath, "utf8").startsWith(String(second.result!.pid))).toBe(true);
	}, 60_000);

	it("sends connected clients the shutdown notice before closing on RPC shutdown", async () => {
		const sandbox = makeSandbox();
		const { code, result } = await hostStart(sandbox);
		expect(code).toBe(0);
		const entry = readRpcHost(result!.instanceId, { dir: sandbox.registryDir })!;

		const socket = net.connect(entry.endpoint);
		const frames: Record<string, unknown>[] = [];
		const closed = Promise.withResolvers<void>();
		let buffer = "";
		socket.on("error", () => {});
		socket.on("close", () => closed.resolve());
		socket.on("data", chunk => {
			buffer += chunk.toString("utf8");
			let newline = buffer.indexOf("\n");
			while (newline !== -1) {
				frames.push(JSON.parse(buffer.slice(0, newline)) as Record<string, unknown>);
				buffer = buffer.slice(newline + 1);
				newline = buffer.indexOf("\n");
			}
		});
		socket.once("connect", () => {
			socket.write(`${JSON.stringify({ type: "auth", token: entry.token })}\n`);
			socket.write(`${JSON.stringify({ id: "x1", type: "shutdown" })}\n`);
		});
		await closed.promise;

		expect(frames.some(frame => frame.type === "notice" && frame.source === "host")).toBe(true);
		expect(await waitFor(() => !pidAlive(result!.pid), 15_000)).toBe(true);
		// Only the host exited; this (client) process is still running.
		expect(pidAlive(process.pid)).toBe(true);
	}, 60_000);

	it("resumes a session while its previous host is shutting down", async () => {
		const sandbox = makeSandbox();
		const { sessionId, sessionFile } = await writeSessionFile(sandbox);
		const first = await hostStart(sandbox, ["--resume", sessionFile]);
		expect(first.code).toBe(0);
		const entry = readRpcHost(first.result!.instanceId, { dir: sandbox.registryDir })!;
		const shutdown = sendCommandOverSocket(entry.endpoint, entry.token, { id: "x1", type: "shutdown" });

		const second = await hostStart(sandbox, ["--resume", sessionFile]);
		await shutdown.catch(() => undefined);
		expect(second.code).toBe(0);
		expect(second.result!.sessionId).toBe(sessionId);
		expect(await waitFor(() => !pidAlive(first.result!.pid), 15_000)).toBe(true);
		// Whichever path won, the surviving host is live and is not the one that shut down.
		const survivor = readRpcHost(second.result!.instanceId, { dir: sandbox.registryDir });
		expect(second.result!.pid).not.toBe(first.result!.pid);
		expect(survivor && (await probeRpcHost(survivor))).toBe(true);
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
		expect(fs.readFileSync(lockPath, "utf8").startsWith(String(result!.pid))).toBe(true);
	}, 60_000);
});
describe("session swap guard", () => {
	it("refuses switch_session and open_session to another live host's session", async () => {
		const sandbox = makeSandbox();
		const sessionA = await writeSessionFile(sandbox);
		const sessionB = await writeSessionFile(sandbox);

		const hostAStart = await hostStart(sandbox, ["--resume", sessionA.sessionFile]);
		expect(hostAStart.code).toBe(0);
		const hostA = hostAStart.result!;

		const hostBStart = await hostStart(sandbox, ["--resume", sessionB.sessionFile]);
		expect(hostBStart.code).toBe(0);
		const hostB = hostBStart.result!;

		readRpcHost(hostA.instanceId, { dir: sandbox.registryDir });
		const entryB = readRpcHost(hostB.instanceId, { dir: sandbox.registryDir })!;

		// Host B switch_session to Host A's session file -> { cancelled: true, movedTo: { instanceId: A } }
		const switchResp = await sendCommandOverSocket(hostB.endpoint, entryB.token, {
			id: "sw1",
			type: "switch_session",
			sessionPath: sessionA.sessionFile,
		});
		expect(switchResp.success).toBe(true);
		const switchData = switchResp.data as { cancelled: boolean; movedTo?: { instanceId: string; sessionId: string } };
		expect(switchData.cancelled).toBe(true);
		expect(switchData.movedTo?.instanceId).toBe(hostA.instanceId);

		// Verify B's entry, lock, and sessionId unchanged
		const entryBAfter = readRpcHost(hostB.instanceId, { dir: sandbox.registryDir })!;
		expect(entryBAfter.sessionId).toBe(sessionB.sessionId);
		const lockBPath = rpcSessionLockPath(sessionB.sessionId, { dir: sandbox.registryDir });
		expect(fs.existsSync(lockBPath)).toBe(true);

		// Verify A's entry unchanged
		const entryAAfter = readRpcHost(hostA.instanceId, { dir: sandbox.registryDir })!;
		expect(entryAAfter.sessionId).toBe(sessionA.sessionId);

		// Switching to own session not refused
		const selfResp = await sendCommandOverSocket(hostB.endpoint, entryB.token, {
			id: "self1",
			type: "switch_session",
			sessionPath: sessionB.sessionFile,
		});
		expect(selfResp.success).toBe(true);
		const selfData = selfResp.data as { cancelled: boolean };
		expect(selfData.cancelled).toBe(false);

		// Target lock released after refusal: kill A -> B can switch to A's session
		process.kill(hostA.pid, "SIGKILL");
		hostPids.delete(hostA.pid);
		await waitFor(() => !pidAlive(hostA.pid), 5_000);
		// Remove A's lock and entry
		const lockAPath = rpcSessionLockPath(sessionA.sessionId, { dir: sandbox.registryDir });
		fs.rmSync(lockAPath, { force: true });
		fs.rmSync(path.join(sandbox.registryDir, `${hostA.instanceId}.json`), { force: true });
		const switchSuccess = await sendCommandOverSocket(hostB.endpoint, entryB.token, {
			id: "sw2",
			type: "switch_session",
			sessionPath: sessionA.sessionFile,
		});
		expect(switchSuccess.success).toBe(true);
		const switchSuccessData = switchSuccess.data as { cancelled: boolean };
		expect(switchSuccessData.cancelled).toBe(false);

		const entryBFinal = readRpcHost(hostB.instanceId, { dir: sandbox.registryDir })!;
		expect(entryBFinal.sessionId).toBe(sessionA.sessionId);
	}, 60_000);
});

/** A persistent host connection that records every frame it receives. */
class HostClient {
	readonly frames: Array<Record<string, unknown>> = [];
	readonly closed: Promise<void>;
	readonly #socket: net.Socket;
	#buffer = "";
	#waiters: Array<{
		match: (frame: Record<string, unknown>) => boolean;
		resolve: (f: Record<string, unknown>) => void;
	}> = [];

	constructor(endpoint: string, token: string, identity: Record<string, unknown>) {
		this.#socket = net.connect(endpoint);
		const closed = Promise.withResolvers<void>();
		this.closed = closed.promise;
		this.#socket.on("error", () => {});
		this.#socket.on("close", () => closed.resolve());
		this.#socket.on("data", chunk => {
			this.#buffer += chunk.toString("utf8");
			let newline = this.#buffer.indexOf("\n");
			while (newline !== -1) {
				const frame = JSON.parse(this.#buffer.slice(0, newline)) as Record<string, unknown>;
				this.#buffer = this.#buffer.slice(newline + 1);
				newline = this.#buffer.indexOf("\n");
				this.frames.push(frame);
				this.#waiters = this.#waiters.filter(waiter => {
					if (!waiter.match(frame)) return true;
					waiter.resolve(frame);
					return false;
				});
			}
		});
		this.#socket.write(`${JSON.stringify({ type: "auth", token, ...identity })}\n`);
	}

	next(match: (frame: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
		const seen = this.frames.find(match);
		if (seen) return Promise.resolve(seen);
		const { promise, resolve, reject } = Promise.withResolvers<Record<string, unknown>>();
		const timer = setTimeout(() => reject(new Error("frame timed out")), 10_000);
		this.#waiters.push({
			match,
			resolve: frame => {
				clearTimeout(timer);
				resolve(frame);
			},
		});
		return promise;
	}

	async command(command: Record<string, unknown>): Promise<Record<string, unknown>> {
		this.#socket.write(`${JSON.stringify(command)}\n`);
		return this.next(frame => frame.type === "response" && frame.id === command.id);
	}

	close(): void {
		this.#socket.destroy();
	}
}

const isDriverChanged = (clientId: string) => (frame: Record<string, unknown>) =>
	frame.type === "driver_changed" && (frame.driver as Record<string, unknown> | null)?.clientId === clientId;

describe("session host driver", () => {
	// Prompts fail fast against a closed local port instead of reaching a real provider.
	const startHost = async () => {
		const sandbox = makeSandbox({ ANTHROPIC_BASE_URL: "http://127.0.0.1:9" });
		const started = await hostStart(sandbox);
		expect(started.code).toBe(0);
		const entry = readRpcHost(started.result!.instanceId, { dir: sandbox.registryDir })!;
		return { entry, instanceId: started.result!.instanceId };
	};

	it("a prompt makes its sender the driver, announced to every client and in get_state", async () => {
		const { entry } = await startHost();
		const a = new HostClient(entry.endpoint, entry.token, { surface: "tui", clientId: "client-a" });
		const b = new HostClient(entry.endpoint, entry.token, { surface: "web", clientId: "client-b" });
		try {
			await a.next(frame => frame.type === "ready");
			await b.next(frame => frame.type === "ready");
			const before = await a.command({ id: "s0", type: "get_state" });
			expect((before.data as Record<string, unknown>).driver).toBeNull();

			await b.command({ id: "p1", type: "prompt", message: "hi" });
			const seenByA = await a.next(isDriverChanged("client-b"));
			const seenByB = await b.next(isDriverChanged("client-b"));
			expect(seenByA.driver).toEqual({ surface: "web", clientId: "client-b" });
			expect(seenByB.driver).toEqual({ surface: "web", clientId: "client-b" });

			const state = await a.command({ id: "s1", type: "get_state" });
			expect((state.data as Record<string, unknown>).driver).toEqual({ surface: "web", clientId: "client-b" });
		} finally {
			a.close();
			b.close();
		}
	}, 60_000);

	it("detaches a shell pane once after another client takes over", async () => {
		const { entry, instanceId } = await startHost();
		const shellIdentity = { surface: "shell", clientId: "pane-1", attachment: "pane-1" };
		const shell = new HostClient(entry.endpoint, entry.token, shellIdentity);
		await shell.command({ id: "a1", type: "abort" });
		await shell.next(isDriverChanged("pane-1"));
		shell.close();
		await shell.closed;

		// The same pane driving again is not a detach.
		const again = new HostClient(entry.endpoint, entry.token, shellIdentity);
		await again.command({ id: "a2", type: "abort" });
		again.close();

		const web = new HostClient(entry.endpoint, entry.token, { surface: "web", clientId: "phone" });
		try {
			await web.command({ id: "p1", type: "prompt", message: "from the phone" });
			await web.next(isDriverChanged("phone"));

			const refused = new HostClient(entry.endpoint, entry.token, shellIdentity);
			await refused.closed;
			expect(refused.frames).toEqual([
				{ type: "error", error: expect.any(String), code: "attachment_detached", instanceId },
			]);

			const reattached = new HostClient(entry.endpoint, entry.token, shellIdentity);
			try {
				const ready = await reattached.next(frame => frame.type === "ready" || frame.type === "error");
				expect(ready.type).toBe("ready");
			} finally {
				reattached.close();
			}
		} finally {
			web.close();
		}
	}, 60_000);

	it("never detaches clients without a shell surface", async () => {
		const { entry } = await startHost();
		// Same attachment key, but no declared surface: treated as unknown.
		const unknown = new HostClient(entry.endpoint, entry.token, { clientId: "u1", attachment: "pane-2" });
		await unknown.command({ id: "a1", type: "abort" });
		unknown.close();
		await unknown.closed;

		const web = new HostClient(entry.endpoint, entry.token, { surface: "web", clientId: "phone" });
		try {
			await web.command({ id: "a2", type: "abort" });
			await web.next(isDriverChanged("phone"));
			const next = new HostClient(entry.endpoint, entry.token, { clientId: "u1", attachment: "pane-2" });
			try {
				const first = await next.next(frame => frame.type === "ready" || frame.type === "error");
				expect(first.type).toBe("ready");
			} finally {
				next.close();
			}
		} finally {
			web.close();
		}
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
