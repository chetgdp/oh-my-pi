import { describe, expect, it, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { handleLiveRequest, listLiveSessions, resolveLiveEndpoint } from "../src/server/live";
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
		const pub1 = publishRpcHost(
			{
				sessionId: "s1",
				sessionName: "Session 1",
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
		expect(sessions[0].origin).toBe("unknown");
	});

	it("GET /api/live returns JSON array", async () => {
		const opts = tmpOpts();
		const pub = publishRpcHost(
			{
				sessionId: "s1",
				sessionName: "Test",
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

	it("detects gui origin when pane is tagged with @ompgui", async () => {
		const opts = tmpOpts();
		const pub = publishRpcHost(
			{
				sessionId: "s-gui",
				sessionName: "GUI Session",
				model: "claude-3-5",
				cwd: "/tmp/gui",
				startedAt: Date.now(),
			},
			{ dir: opts.registryDir },
		);
		closers.push(pub);

		// Mock tmux runner returning a tagged pane matching this process pid
		opts.tmux = async argv => {
			if (argv[0] === "list-panes") {
				return {
					exitCode: 0,
					stdout: `${pub.entry.pid} @99 1\n`,
					stderr: "",
				};
			}
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const sessions = await listLiveSessions(opts);
		expect(sessions).toHaveLength(1);
		expect(sessions[0].origin).toBe("gui");
	});

	it("detects cli origin when pane is untagged", async () => {
		const opts = tmpOpts();
		const pub = publishRpcHost(
			{
				sessionId: "s-cli",
				sessionName: "CLI Session",
				model: "claude-3-5",
				cwd: "/tmp/cli",
				startedAt: Date.now(),
			},
			{ dir: opts.registryDir },
		);
		closers.push(pub);

		opts.tmux = async argv => {
			if (argv[0] === "list-panes") {
				return {
					exitCode: 0,
					stdout: `${pub.entry.pid} @100 \n`,
					stderr: "",
				};
			}
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const sessions = await listLiveSessions(opts);
		expect(sessions).toHaveLength(1);
		expect(sessions[0].origin).toBe("cli");
	});

	it("resolveLiveEndpoint returns endpoint+token for live, null for unknown", () => {
		const opts = tmpOpts();
		const pub = publishRpcHost(
			{
				sessionId: "s1",
				sessionName: "Test",
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
});
