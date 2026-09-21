import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
	publishRpcHost,
	listRpcHosts,
	readRpcHost,
	tokenMatches,
	RPC_HOST_REGISTRY_VERSION,
	type RpcHostSnapshot,
} from "../src/modes/rpc/rpc-registry";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-registry-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

const snapshot: RpcHostSnapshot = {
	sessionId: "sess-1",
	sessionName: "my session",
	cwd: "/tmp/test",
	model: "claude-sonnet",
	startedAt: Date.now(),
};

describe("publishRpcHost", () => {
	test("writes a 0600 JSON file with all entry fields", () => {
		const pub = publishRpcHost(snapshot, { dir: tmpDir });
		try {
			const files = fs.readdirSync(tmpDir).filter(f => f.endsWith(".json"));
			expect(files).toHaveLength(1);

			const stat = fs.statSync(path.join(tmpDir, files[0]));
			expect(stat.mode & 0o777).toBe(0o600);

			const entry = pub.entry;
			expect(entry.version).toBe(RPC_HOST_REGISTRY_VERSION);
			expect(entry.instanceId).toMatch(/^[a-z0-9]{16}$/);
			expect(entry.pid).toBe(process.pid);
			expect(entry.endpoint).toBeTruthy();
			expect(entry.token).toMatch(/^[a-f0-9]{64}$/);
			expect(entry.createdAt).toBeGreaterThan(0);
			expect(entry.sessionId).toBe("sess-1");
			expect(entry.sessionName).toBe("my session");
			expect(entry.cwd).toBe("/tmp/test");
			expect(entry.model).toBe("claude-sonnet");
			expect(entry.startedAt).toBe(snapshot.startedAt);
		} finally {
			pub.close();
		}
	});
});

describe("listRpcHosts", () => {
	test("returns published entry with all fields", () => {
		const pub = publishRpcHost(snapshot, { dir: tmpDir });
		try {
			const hosts = listRpcHosts({ dir: tmpDir });
			expect(hosts).toHaveLength(1);
			expect(hosts[0].instanceId).toBe(pub.entry.instanceId);
			expect(hosts[0].sessionId).toBe("sess-1");
			expect(hosts[0].cwd).toBe("/tmp/test");
			expect(hosts[0].model).toBe("claude-sonnet");
		} finally {
			pub.close();
		}
	});

	test("returns empty array for nonexistent directory", () => {
		expect(listRpcHosts({ dir: path.join(tmpDir, "nonexistent") })).toEqual([]);
	});

	test("omits dead-pid entries and removes their files", () => {
		// Spawn a process that exits immediately to get a dead pid.
		const proc = Bun.spawnSync(["true"]);
		const deadPid = proc.pid;

		// Write a fake entry with the dead pid.
		const entryId = "deadbeef01234567";
		const entry = {
			version: RPC_HOST_REGISTRY_VERSION,
			instanceId: "dead0000dead0000",
			pid: deadPid,
			endpoint: path.join(tmpDir, `${entryId}.sock`),
			token: "a".repeat(64),
			createdAt: Date.now(),
			sessionId: null,
			sessionName: null,
			cwd: "/tmp",
			model: null,
			startedAt: Date.now(),
		};
		const filePath = path.join(tmpDir, `${entryId}.json`);
		fs.writeFileSync(filePath, JSON.stringify(entry), { mode: 0o600 });

		const hosts = listRpcHosts({ dir: tmpDir });
		expect(hosts).toHaveLength(0);
		// File should have been pruned.
		expect(fs.existsSync(filePath)).toBe(false);
	});
});

describe("readRpcHost", () => {
	test("finds entry by instanceId", () => {
		const pub = publishRpcHost(snapshot, { dir: tmpDir });
		try {
			const found = readRpcHost(pub.entry.instanceId, { dir: tmpDir });
			expect(found).not.toBeNull();
			expect(found!.instanceId).toBe(pub.entry.instanceId);
		} finally {
			pub.close();
		}
	});

	test("returns null for unknown instanceId", () => {
		expect(readRpcHost("nonexistent0000a", { dir: tmpDir })).toBeNull();
	});
});

describe("update", () => {
	test("changes snapshot fields while keeping identity", () => {
		const pub = publishRpcHost(snapshot, { dir: tmpDir });
		try {
			const origId = pub.entry.instanceId;
			const origToken = pub.entry.token;

			pub.update({
				sessionId: "sess-2",
				sessionName: "renamed",
				cwd: "/tmp/test",
				model: "gpt-4",
				startedAt: snapshot.startedAt,
			});

			const hosts = listRpcHosts({ dir: tmpDir });
			expect(hosts).toHaveLength(1);
			expect(hosts[0].instanceId).toBe(origId);
			expect(hosts[0].token).toBe(origToken);
			expect(hosts[0].sessionId).toBe("sess-2");
			expect(hosts[0].sessionName).toBe("renamed");
			expect(hosts[0].model).toBe("gpt-4");
		} finally {
			pub.close();
		}
	});
});

describe("close", () => {
	test("removes the registry file and is idempotent", () => {
		const pub = publishRpcHost(snapshot, { dir: tmpDir });
		const filesBefore = fs.readdirSync(tmpDir).filter(f => f.endsWith(".json"));
		expect(filesBefore).toHaveLength(1);

		pub.close();
		const filesAfter = fs.readdirSync(tmpDir).filter(f => f.endsWith(".json"));
		expect(filesAfter).toHaveLength(0);

		// Second close is a no-op.
		pub.close();
	});
});

describe("long dir path triggers fallback endpoint", () => {
	test("endpoint uses /tmp fallback when dir path exceeds sun_path", () => {
		// Build a directory path long enough to exceed sun_path (104 on macOS).
		const longName = "a".repeat(20);
		const deepDir = path.join(tmpDir, longName, longName, longName, longName, longName);
		fs.mkdirSync(deepDir, { recursive: true });

		const pub = publishRpcHost(snapshot, { dir: deepDir });
		try {
			// The endpoint should not be under deepDir since the path is too long.
			expect(pub.endpoint.startsWith("/tmp/omp-rpc-")).toBe(true);
		} finally {
			pub.close();
		}
	});
});

describe("tokenMatches", () => {
	test("matches identical tokens", () => {
		expect(tokenMatches("abc123", "abc123")).toBe(true);
	});

	test("rejects different tokens of same length", () => {
		expect(tokenMatches("abc123", "abc124")).toBe(false);
	});

	test("rejects different-length tokens", () => {
		expect(tokenMatches("abc", "abcd")).toBe(false);
	});
});
