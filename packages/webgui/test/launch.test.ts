import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test } from "bun:test";

import type { TmuxRunner } from "../src/server/tmux";
import { handleLaunchRequest, launchSessionWith } from "../src/server/launch";

function makeFakeRunner(): {
	runner: TmuxRunner;
	calls: string[][];
} {
	const calls: string[][] = [];
	const runner: TmuxRunner = async argv => {
		calls.push(argv);
		return { exitCode: 0, stdout: "@99\n", stderr: "" };
	};
	return { runner, calls };
}

describe("launchSessionWith", () => {
	test("nonexistent cwd throws 400", async () => {
		const { runner } = makeFakeRunner();
		try {
			await launchSessionWith({ tmux: runner }, { cwd: "/no/such/path/ever" });
			expect.unreachable("should have thrown");
		} catch (err: unknown) {
			const e = err as { status: number };
			expect(e.status).toBe(400);
		}
	});

	test("relative cwd throws 400", async () => {
		const { runner } = makeFakeRunner();
		try {
			await launchSessionWith({ tmux: runner }, { cwd: "relative/path" });
			expect.unreachable("should have thrown");
		} catch (err: unknown) {
			const e = err as { status: number };
			expect(e.status).toBe(400);
		}
	});

	test("existing dir returns windowId, no instanceId when registry empty", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "launch-test-"));
		const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "reg-test-"));
		try {
			const { runner, calls } = makeFakeRunner();
			const result = await launchSessionWith({ tmux: runner, registryDir }, { cwd: tmpDir }, { pollTimeoutMs: 300 });
			expect(result.windowId).toBe("@99");
			expect(result.instanceId).toBeUndefined();
			expect(calls.some(c => c[0] === "has-session")).toBe(true);
			const nwCall = calls.find(c => c[0] === "new-window");
			expect(nwCall).toBeDefined();
			expect(nwCall).toContain("ompgui:");
			expect(calls.some(c => c[0] === "set-option" && c.includes("@ompgui"))).toBe(true);
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
			fs.rmSync(registryDir, { recursive: true, force: true });
		}
	});

	test("passes initialPrompt to tmux new-window as positional argument", async () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "launch-test-prompt-"));
		try {
			const { runner, calls } = makeFakeRunner();
			const prompt = "hello 'world'; rm -rf /; echo $VAR\nline2";
			await launchSessionWith({ tmux: runner }, { cwd: tmpDir, initialPrompt: prompt }, { pollTimeoutMs: 100 });
			const nwCall = calls.find(c => c[0] === "new-window");
			expect(nwCall).toBeDefined();
			const shellCommand = nwCall![nwCall!.length - 1];
			expect(shellCommand).toContain("omp 'hello \\'world\\'; rm -rf /; echo $VAR\nline2'; exit");
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});

describe("handleLaunchRequest", () => {
	test("nonexistent cwd returns 400", async () => {
		const { runner } = makeFakeRunner();
		const req = new Request("http://localhost/api/launch", {
			method: "POST",
			body: JSON.stringify({ cwd: "/no/such/dir/xyz" }),
			headers: { "content-type": "application/json" },
		});
		const resp = await handleLaunchRequest(req, new URL(req.url), { tmux: runner });
		expect(resp).not.toBeNull();
		expect(resp!.status).toBe(400);
	});

	test("invalid JSON returns 400", async () => {
		const { runner } = makeFakeRunner();
		const req = new Request("http://localhost/api/launch", {
			method: "POST",
			body: "not json",
			headers: { "content-type": "application/json" },
		});
		const resp = await handleLaunchRequest(req, new URL(req.url), { tmux: runner });
		expect(resp).not.toBeNull();
		expect(resp!.status).toBe(400);
	});

	test("resume unknown id returns 404", async () => {
		const { runner } = makeFakeRunner();
		const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "sess-test-"));
		try {
			const req = new Request("http://localhost/api/past/nonexistent-id/resume", { method: "POST" });
			const resp = await handleLaunchRequest(req, new URL(req.url), { tmux: runner, sessionsDir });
			expect(resp).not.toBeNull();
			expect(resp!.status).toBe(404);
		} finally {
			fs.rmSync(sessionsDir, { recursive: true, force: true });
		}
	});

	test("unmatched path returns null", async () => {
		const { runner } = makeFakeRunner();
		const req = new Request("http://localhost/api/other", {
			method: "GET",
		});
		const resp = await handleLaunchRequest(req, new URL(req.url), { tmux: runner });
		expect(resp).toBeNull();
	});
});
