import { describe, expect, it, afterEach, setSystemTime } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { publishListeningHost } from "./listening-host";
import { handleLiveRequest, invalidateLiveSessions, listLiveSessions, resolveLiveEndpoint } from "../src/server/live";
import { launchSession } from "../src/server/launch";
import { writeFakeOmp } from "./fake-omp";
import { handleRequest } from "../src/server/index";
import type { DaemonOptions } from "../src/server/options";

function makeTmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-test-"));
	return dir;
}

describe("live endpoint", () => {
	const dirs: string[] = [];
	const closers: Array<{ close(): void }> = [];

	function tmpOpts(): DaemonOptions {
		const dir = makeTmpDir();
		dirs.push(dir);
		return { registryDir: dir };
	}

	afterEach(() => {
		for (const c of closers) {
			try {
				c.close();
			} catch {}
		}
		closers.length = 0;
		for (const d of dirs) {
			try {
				fs.rmSync(d, { recursive: true });
			} catch {}
		}
		dirs.length = 0;
	});

	it("lists live sessions, strips token/endpoint, prunes dead pids", async () => {
		const opts = tmpOpts();

		// Live entry (this process)
		const pub1 = await publishListeningHost(
			{
				sessionId: "s1",
				sessionName: "Session 1",
				sessionFile: null,
				cwd: "/tmp/a",
				model: "claude",
				startedAt: Date.now(),
			},
			{ dir: opts.registryDir },
		);
		closers.push(pub1);
		const liveInstanceId = pub1.entry.instanceId;

		// Dead entry: publish then overwrite the pid
		const pub2 = publishRpcHost(
			{
				sessionId: "s2",
				sessionName: "Session 2",
				sessionFile: null,
				cwd: "/tmp/b",
				model: "opus",
				startedAt: Date.now(),
			},
			{ dir: opts.registryDir },
		);
		// Overwrite the file with a dead pid — entryId !== instanceId,
		// so scan the directory for the file containing this instanceId.
		const deadInstanceId = pub2.entry.instanceId;
		const files = fs.readdirSync(opts.registryDir!).filter(f => f.endsWith(".json"));
		const entryFile = files.find(f => {
			const content = JSON.parse(fs.readFileSync(path.join(opts.registryDir!, f), "utf-8"));
			return content.instanceId === deadInstanceId;
		})!;
		const entryPath = path.join(opts.registryDir!, entryFile);
		const raw = JSON.parse(fs.readFileSync(entryPath, "utf-8"));
		raw.pid = 999999; // almost certainly dead
		fs.writeFileSync(entryPath, JSON.stringify(raw));
		// Don't close pub2 — we want the file to stay with a dead pid
		// but we need to clean up the socket
		closers.push(pub2);

		const sessions = await listLiveSessions(opts);
		expect(sessions).toHaveLength(1);
		expect(sessions[0].instanceId).toBe(liveInstanceId);
		// token and endpoint must not appear
		const keys = Object.keys(sessions[0]);
		expect(keys).not.toContain("token");
		expect(keys).not.toContain("endpoint");
		expect(sessions[0].origin).toBe("cli");
	});

	it("GET /api/live returns JSON array", async () => {
		const opts = tmpOpts();
		const pub = await publishListeningHost(
			{
				sessionId: "s1",
				sessionName: "Test",
				sessionFile: null,
				cwd: "/tmp/c",
				model: "claude",
				startedAt: Date.now(),
			},
			{ dir: opts.registryDir },
		);
		closers.push(pub);

		const url = new URL("http://localhost/api/live");
		const req = new Request(url.href);
		const res = await handleLiveRequest(req, url, opts);
		expect(res).not.toBeNull();
		expect(res!.status).toBe(200);
		const body = (await res!.json()) as Array<Record<string, unknown>>;
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(1);
		expect(body[0].instanceId).toBe(pub.entry.instanceId);
		expect(body[0]).not.toHaveProperty("token");
		expect(body[0]).not.toHaveProperty("endpoint");
	});

	it("returns null for non-matching requests", async () => {
		const opts = tmpOpts();
		const url1 = new URL("http://localhost/api/past");
		expect(await handleLiveRequest(new Request(url1.href), url1, opts)).toBeNull();

		const url2 = new URL("http://localhost/api/live");
		const post = new Request(url2.href, { method: "POST" });
		expect(await handleLiveRequest(post, url2, opts)).toBeNull();
	});

	it("reports headless hosts as gui and TUIs as cli", async () => {
		const opts = tmpOpts();
		const host = await publishListeningHost(
			{ sessionId: "s-gui", sessionName: "G", sessionFile: null, model: null, cwd: "/tmp/gui", startedAt: 2 },
			{ dir: opts.registryDir, kind: "host" },
		);
		const tui = await publishListeningHost(
			{ sessionId: "s-cli", sessionName: "C", sessionFile: null, model: null, cwd: "/tmp/cli", startedAt: 1 },
			{ dir: opts.registryDir, kind: "tui" },
		);
		closers.push(host, tui);
		const sessions = await listLiveSessions(opts);
		expect(sessions.map(s => [s.instanceId, s.origin])).toEqual([
			[host.entry.instanceId, "gui"],
			[tui.entry.instanceId, "cli"],
		]);
	});

	it("omits entries whose pid is alive but socket refuses connections", async () => {
		const opts = tmpOpts();
		const listening = await publishListeningHost(
			{ sessionId: "up", sessionName: null, sessionFile: null, model: null, cwd: "/tmp", startedAt: 1 },
			{ dir: opts.registryDir },
		);
		const unbound = publishRpcHost(
			{ sessionId: "down", sessionName: null, sessionFile: null, model: null, cwd: "/tmp", startedAt: 1 },
			{ dir: opts.registryDir },
		);
		closers.push(listening, unbound);
		const sessions = await listLiveSessions(opts);
		expect(sessions.map(s => s.sessionId)).toEqual(["up"]);
	});

	it("resolveLiveEndpoint returns endpoint+token for live, null for unknown", () => {
		const opts = tmpOpts();
		const pub = publishRpcHost(
			{
				sessionId: "s1",
				sessionName: "Test",
				sessionFile: null,
				cwd: "/tmp/d",
				model: "claude",
				startedAt: Date.now(),
			},
			{ dir: opts.registryDir },
		);
		closers.push(pub);

		const result = resolveLiveEndpoint(pub.entry.instanceId, opts);
		expect(result).not.toBeNull();
		expect(result!.endpoint).toBe(pub.entry.endpoint);
		expect(result!.token).toBe(pub.entry.token);

		expect(resolveLiveEndpoint("nonexistent-id", opts)).toBeNull();
	});

	describe("scan cache", () => {
		afterEach(() => {
			setSystemTime();
			invalidateLiveSessions();
		});

		async function publish(opts: DaemonOptions, sessionId: string) {
			const pub = await publishListeningHost(
				{ sessionId, sessionName: sessionId, sessionFile: null, cwd: "/tmp/c", model: "m", startedAt: Date.now() },
				{ dir: opts.registryDir },
			);
			closers.push(pub);
			return pub;
		}

		it("serves repeat calls within the TTL from one scan", async () => {
			const opts = tmpOpts();
			const a = await publish(opts, "a");
			await listLiveSessions(opts);
			await publish(opts, "b");
			expect(await listLiveSessions(opts)).toHaveLength(1);
			expect(a.connections()).toBe(1);
		});

		it("dedupes concurrent calls onto one scan", async () => {
			const opts = tmpOpts();
			const a = await publish(opts, "a");
			const [x, y] = await Promise.all([listLiveSessions(opts), listLiveSessions(opts)]);
			expect(x).toBe(y);
			expect(a.connections()).toBe(1);
		});

		it("rescans once the TTL has passed", async () => {
			const opts = tmpOpts();
			const a = await publish(opts, "a");
			await listLiveSessions(opts);
			await publish(opts, "b");
			setSystemTime(new Date(Date.now() + 2_500));
			expect(await listLiveSessions(opts)).toHaveLength(2);
			expect(a.connections()).toBe(2);
		});

		it("rescans after launch", async () => {
			const binDir = makeTmpDir();
			dirs.push(binDir);
			const omp = writeFakeOmp(binDir, {
				stdout: JSON.stringify({ instanceId: "i", sessionId: "s", endpoint: "/x", pid: 1, reused: false }),
			});
			const opts = { ...tmpOpts(), ompBin: omp.bin };
			await publish(opts, "a");
			await listLiveSessions(opts);
			await publish(opts, "b");
			await launchSession(opts, { cwd: os.tmpdir() });
			expect(await listLiveSessions(opts)).toHaveLength(2);
		});

		it("rescans after a shutdown request", async () => {
			const opts = tmpOpts();
			await publish(opts, "a");
			await listLiveSessions(opts);
			await publish(opts, "b");
			const req = new Request("http://localhost/api/live/unknown/shutdown", {
				method: "POST",
				headers: { host: "localhost" },
			});
			await handleRequest(req, opts);
			expect(await listLiveSessions(opts)).toHaveLength(2);
		});
	});
});
