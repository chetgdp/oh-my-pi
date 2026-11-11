import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";
import { RPC_HOST_TUI_HOLDER_ERROR, startRpcHost } from "../src/modes/rpc/rpc-host-launch";
import {
	getProcessStartTime,
	isSessionLockHeld,
	isSessionLockOwnedByThisProcess,
	publishRpcHost,
	type RpcHostPublication,
	readSessionLockHolder,
	rpcSessionLockPath,
	sessionLockHolderPath,
} from "../src/modes/rpc/rpc-registry";
import {
	claimStartupSession,
	type TakeoverPhase,
	TuiSessionLock,
	takeOverSessionLock,
} from "../src/modes/rpc/tui-session-lock";
import { SessionManager } from "../src/session/session-manager";

/** A live process other than this one, so its lock is neither stale nor re-entrant for us. */
function spawnHolder(): Bun.Subprocess {
	return Bun.spawn(["sleep", "60"], { stdio: ["ignore", "ignore", "ignore"] });
}

async function lockFor(child: Bun.Subprocess, sessionId: string, dir: string): Promise<void> {
	let start: string | null = null;
	for (let i = 0; i < 50 && !start; i++) {
		start = getProcessStartTime(child.pid);
		// `ps` may not list a just-spawned child yet; the lock needs its real start time.
		if (!start) await Bun.sleep(20);
	}
	fs.writeFileSync(rpcSessionLockPath(sessionId, { dir }), start ? `${child.pid}:${start}\n` : `${child.pid}\n`);
}

interface FakeHost {
	publication: RpcHostPublication;
	received: string[];
	setBusy(busy: boolean): void;
	close(): void;
}

/** Speaks just enough of the host socket protocol: auth, get_state, shutdown. */
async function startFakeHost(
	dir: string,
	sessionId: string,
	onShutdown: () => void,
	onStateQuery?: () => void,
): Promise<FakeHost> {
	const publication = publishRpcHost(
		{ sessionId, sessionName: "fake", sessionFile: null, cwd: dir, model: null, startedAt: Date.now() },
		{ dir },
	);
	const received: string[] = [];
	const clients = new Set<net.Socket>();
	let busy = false;
	const server = net.createServer(socket => {
		clients.add(socket);
		socket.on("close", () => clients.delete(socket));
		let buffer = "";
		socket.setEncoding("utf8");
		socket.on("data", (chunk: string) => {
			buffer += chunk;
			let nl = buffer.indexOf("\n");
			while (nl !== -1) {
				const frame = JSON.parse(buffer.slice(0, nl)) as Record<string, unknown>;
				buffer = buffer.slice(nl + 1);
				nl = buffer.indexOf("\n");
				received.push(String(frame.type));
				const reply = (data: object) => socket.write(`${JSON.stringify(data)}\n`);
				if (frame.type === "auth") reply({ type: "ready" });
				else if (frame.type === "get_state") {
					reply({
						type: "response",
						id: frame.id,
						command: "get_state",
						success: true,
						data: { isStreaming: busy, isSettled: !busy },
					});
					onStateQuery?.();
				} else if (frame.type === "shutdown") {
					reply({ type: "response", id: frame.id, command: "shutdown", success: true });
					onShutdown();
				}
			}
		});
	});
	const { promise, resolve } = Promise.withResolvers<void>();
	server.listen(publication.endpoint, () => resolve());
	await promise;
	return {
		publication,
		received,
		setBusy(next) {
			busy = next;
			if (!next) for (const client of clients) client.write(`${JSON.stringify({ type: "session_settled" })}\n`);
		},
		close() {
			for (const client of clients) client.destroy();
			server.close();
			publication.close();
		},
	};
}

describe("TUI session lock", () => {
	let dir: string;
	let children: Bun.Subprocess[];
	let fakeHost: FakeHost | undefined;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "tui-session-lock-test-"));
		children = [];
	});

	afterEach(() => {
		fakeHost?.close();
		fakeHost = undefined;
		for (const child of children) child.kill("SIGKILL");
		removeSyncWithRetries(dir);
	});

	test("holder marker follows the lock across session switches and is removed on release", () => {
		const lock = new TuiSessionLock({ dir });
		const opts = { dir };
		expect(lock.follow("session-a")).toBe(true);
		expect(isSessionLockOwnedByThisProcess("session-a", opts)).toBe(true);
		expect(readSessionLockHolder("session-a", opts)).toBe("tui");

		expect(lock.follow("session-b")).toBe(true);
		expect(fs.existsSync(rpcSessionLockPath("session-a", opts))).toBe(false);
		expect(fs.existsSync(sessionLockHolderPath("session-a", opts))).toBe(false);
		expect(readSessionLockHolder("session-b", opts)).toBe("tui");

		lock.release();
		expect(fs.existsSync(rpcSessionLockPath("session-b", opts))).toBe(false);
		expect(fs.existsSync(sessionLockHolderPath("session-b", opts))).toBe(false);
	});

	test("a pending switch target that never commits is released", () => {
		const lock = new TuiSessionLock({ dir });
		lock.follow("current");
		expect(lock.tryAcquire("target")).toBe(true);
		lock.setPending("target");
		lock.dropPending();
		expect(fs.existsSync(rpcSessionLockPath("target", { dir }))).toBe(false);
		expect(isSessionLockOwnedByThisProcess("current", { dir })).toBe(true);
		lock.release();
	});

	test("a holder marker older than the lock is ignored", async () => {
		const child = spawnHolder();
		children.push(child);
		fs.writeFileSync(sessionLockHolderPath("s", { dir }), "tui\n");
		const past = new Date(Date.now() - 60_000);
		fs.utimesSync(sessionLockHolderPath("s", { dir }), past, past);
		await lockFor(child, "s", dir);
		expect(readSessionLockHolder("s", { dir })).toBe("host");
	});

	test("takeover waits for the host's turn, sends shutdown, then owns the lock", async () => {
		const child = spawnHolder();
		children.push(child);
		await lockFor(child, "busy", dir);
		fakeHost = await startFakeHost(dir, "busy", () => {
			fs.rmSync(rpcSessionLockPath("busy", { dir }), { force: true });
		});
		fakeHost.setBusy(true);
		const phases: TakeoverPhase["kind"][] = [];
		const lock = new TuiSessionLock({ dir });
		const pending = lock.acquire("busy", {
			onPhase: phase => {
				phases.push(phase.kind);
				if (phase.kind === "waiting-turn") queueMicrotask(() => fakeHost?.setBusy(false));
			},
		});
		const result = await pending;
		expect(result).toEqual({ ok: true });
		expect(phases).toEqual(["waiting-turn", "stopping"]);
		expect(fakeHost.received.filter(type => type === "shutdown")).toHaveLength(1);
		lock.adopt("busy");
		expect(isSessionLockOwnedByThisProcess("busy", { dir })).toBe(true);
		expect(readSessionLockHolder("busy", { dir })).toBe("tui");
		lock.release();
	});

	test("cancelling while the host is busy never sends shutdown", async () => {
		const child = spawnHolder();
		children.push(child);
		await lockFor(child, "busy", dir);
		fakeHost = await startFakeHost(dir, "busy", () => {});
		fakeHost.setBusy(true);
		const controller = new AbortController();
		const result = await takeOverSessionLock("busy", {
			registry: { dir },
			signal: controller.signal,
			onPhase: phase => {
				if (phase.kind === "waiting-turn") queueMicrotask(() => controller.abort());
			},
		});
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.reason).toBe("cancelled");
		expect(fakeHost.received).not.toContain("shutdown");
		expect(isSessionLockHeld("busy", { dir })).toBe(true);
	});

	test("another TUI's session opens without the lock, and the lock on the session left is released", async () => {
		const child = spawnHolder();
		children.push(child);
		await lockFor(child, "other-tui", dir);
		fs.writeFileSync(sessionLockHolderPath("other-tui", { dir }), "tui\n");
		const result = await takeOverSessionLock("other-tui", { registry: { dir } });
		expect(result.ok === false && result.reason).toBe("tui");

		const lock = new TuiSessionLock({ dir });
		expect(lock.follow("mine")).toBe(true);
		expect(lock.follow("other-tui")).toBe(false);
		expect(isSessionLockHeld("mine", { dir })).toBe(false);
		expect(readSessionLockHolder("other-tui", { dir })).toBe("tui");
		expect(isSessionLockOwnedByThisProcess("other-tui", { dir })).toBe(false);
	});

	test("an unregistered holder is waited out, bounded by the timeout", async () => {
		const child = spawnHolder();
		children.push(child);
		await lockFor(child, "orphan", dir);
		// The bound itself is under test, so it runs on the real clock (kept short).
		const timedOut = await takeOverSessionLock("orphan", { registry: { dir }, lockTimeoutMs: 200 });
		expect(timedOut.ok === false && timedOut.reason).toBe("timeout");

		const phases: TakeoverPhase["kind"][] = [];
		const freed = takeOverSessionLock("orphan", {
			registry: { dir },
			onPhase: phase => {
				phases.push(phase.kind);
				queueMicrotask(() => child.kill("SIGKILL"));
			},
		});
		expect(await freed).toEqual({ ok: true });
		expect(phases).toEqual(["waiting-lock"]);
		expect(isSessionLockOwnedByThisProcess("orphan", { dir })).toBe(true);
	});

	test("startup takeover re-reads what the host appended while we waited", async () => {
		const userTurn = (text: string) => ({ role: "user" as const, content: text, timestamp: Date.now() });
		const creator = SessionManager.create(dir, dir);
		await creator.ensureOnDisk();
		const sessionFile = creator.getSessionFile();
		if (!sessionFile) throw new Error("Expected session file");
		const sessionId = creator.getSessionId();
		creator.appendMessage(userTurn("host turn"));
		await creator.close();

		// The TUI parses the file to learn the session id before it claims the lock.
		const tui = await SessionManager.open(sessionFile, dir, undefined, { suppressBreadcrumb: true });
		const host = await SessionManager.open(sessionFile, dir, undefined, { suppressBreadcrumb: true });
		const hostReply = host.appendMessage(userTurn("host's final reply"));
		await host.close();

		const child = spawnHolder();
		children.push(child);
		await lockFor(child, sessionId, dir);
		fakeHost = await startFakeHost(
			dir,
			sessionId,
			() => fs.rmSync(rpcSessionLockPath(sessionId, { dir }), { force: true }),
			// The turn ends once the TUI has seen it busy, so the wait path is taken.
			() => queueMicrotask(() => fakeHost?.setBusy(false)),
		);
		fakeHost.setBusy(true);
		const lock = new TuiSessionLock({ dir });
		try {
			expect(await claimStartupSession(tui, lock)).toEqual({ kind: "open" });
			expect(tui.getLeafId()).toBe(hostReply);
			const next = tui.appendMessage(userTurn("after takeover"));
			expect(tui.getEntries().find(entry => entry.id === next)?.parentId).toBe(hostReply);
		} finally {
			await tui.close();
			lock.release();
		}
	});

	test("launcher fails fast when a TUI without rpc.serve holds the session", async () => {
		const home = path.join(dir, "home");
		fs.mkdirSync(home);
		const sessionId = "0190f000-0000-7000-8000-000000000001";
		const sessionFile = path.join(dir, "session.jsonl");
		fs.writeFileSync(
			sessionFile,
			`${JSON.stringify({ type: "session", version: 3, id: sessionId, timestamp: new Date().toISOString(), cwd: dir })}\n`,
		);
		const registryDir = path.join(dir, "registry");
		fs.mkdirSync(registryDir, { mode: 0o700 });
		const lock = new TuiSessionLock({ dir: registryDir });
		expect(lock.follow(sessionId)).toBe(true);
		// The host child must not touch the developer's real config.
		const savedHome = process.env.HOME;
		const savedAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.HOME = home;
		process.env.PI_CODING_AGENT_DIR = path.join(home, ".omp", "agent");
		try {
			const started = Date.now();
			await expect(startRpcHost({ cwd: dir, resume: sessionFile, registryDir, timeoutMs: 20_000 })).rejects.toThrow(
				RPC_HOST_TUI_HOLDER_ERROR,
			);
			// Fails on the first poll after the child exits, not at the 20s deadline.
			expect(Date.now() - started).toBeLessThan(15_000);
		} finally {
			if (savedHome === undefined) delete process.env.HOME;
			else process.env.HOME = savedHome;
			if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
			lock.release();
		}
	}, 30_000);
});
