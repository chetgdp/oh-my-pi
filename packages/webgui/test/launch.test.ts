import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { handleLaunchRequest, LaunchError, launchSession, resumeSession } from "../src/server/launch";
import type { DaemonOptions } from "../src/server/options";
import { writeFakeOmp } from "./fake-omp";

const HOST = { instanceId: "inst-1", sessionId: "sess-1", endpoint: "/tmp/x.sock", pid: 4242, reused: false };

let tmp: string;

beforeEach(() => {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), "launch-test-"));
});

afterEach(() => {
	fs.rmSync(tmp, { recursive: true, force: true });
});

function writeSessionFile(dir: string, cwd: string): string {
	const sessionsDir = path.join(dir, "sessions");
	fs.mkdirSync(path.join(sessionsDir, "proj"), { recursive: true });
	const file = path.join(sessionsDir, "proj", "s.jsonl");
	fs.writeFileSync(
		file,
		`${JSON.stringify({ type: "session", version: 3, id: "sess-1", timestamp: "2026-01-01T00:00:00.000Z", cwd })}\n`,
	);
	return file;
}

async function expectLaunchError(promise: Promise<unknown>, status: number, message?: RegExp): Promise<void> {
	try {
		await promise;
		expect.unreachable("should have thrown");
	} catch (err: unknown) {
		expect(err).toBeInstanceOf(LaunchError);
		expect((err as LaunchError).status).toBe(status);
		if (message) expect((err as LaunchError).message).toMatch(message);
	}
}

describe("launchSession", () => {
	test("nonexistent and relative cwd throw 400 without running omp", async () => {
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stdout: JSON.stringify(HOST) });
		await expectLaunchError(launchSession({ ompBin: omp.bin }, { cwd: "/no/such/path/ever" }), 400);
		await expectLaunchError(launchSession({ ompBin: omp.bin }, { cwd: "relative/path" }), 400);
		expect(omp.calls()).toEqual([]);
	});

	test("runs `omp host start --cwd` and returns the host description", async () => {
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stdout: `${JSON.stringify(HOST)}\n` });
		const result = await launchSession({ ompBin: omp.bin }, { cwd: tmp });
		expect(result).toEqual({ instanceId: "inst-1", sessionId: "sess-1", reused: false });
		expect(omp.calls()).toEqual([["host", "start", "--cwd", tmp]]);
	});

	test("passes initialPrompt as one argv element, unquoted", async () => {
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stdout: JSON.stringify(HOST) });
		const prompt = "hello 'world'; rm -rf /; echo $VAR\nline2";
		await launchSession({ ompBin: omp.bin }, { cwd: tmp, initialPrompt: prompt });
		expect(omp.calls()).toEqual([["host", "start", "--cwd", tmp, "--prompt", prompt]]);
	});

	test("nonzero exit is 502 carrying trimmed stderr", async () => {
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stderr: "  host did not become ready\n", exitCode: 3 });
		await expectLaunchError(launchSession({ ompBin: omp.bin }, { cwd: tmp }), 502, /: host did not become ready$/);
	});

	test("unparseable stdout is 502", async () => {
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stdout: "not json\n" });
		await expectLaunchError(launchSession({ ompBin: omp.bin }, { cwd: tmp }), 502);
	});

	test("missing binary is 500", async () => {
		await expectLaunchError(launchSession({ ompBin: path.join(tmp, "absent", "omp") }, { cwd: tmp }), 500);
	});

	test("WEBGUI_OMP_BIN selects the binary when no option is given", async () => {
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stdout: JSON.stringify(HOST) });
		const prev = process.env.WEBGUI_OMP_BIN;
		process.env.WEBGUI_OMP_BIN = omp.bin;
		try {
			expect((await launchSession({}, { cwd: tmp })).instanceId).toBe("inst-1");
		} finally {
			if (prev === undefined) delete process.env.WEBGUI_OMP_BIN;
			else process.env.WEBGUI_OMP_BIN = prev;
		}
	});
});

describe("resumeSession", () => {
	test("runs `omp host start --resume <path>` and reports reuse", async () => {
		const file = writeSessionFile(tmp, tmp);
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stdout: JSON.stringify({ ...HOST, reused: true }) });
		const opts: DaemonOptions = { ompBin: omp.bin, sessionsDir: path.join(tmp, "sessions") };
		const result = await resumeSession(opts, file);
		expect(result).toEqual({ instanceId: "inst-1", sessionId: "sess-1", reused: true });
		expect(omp.calls()).toEqual([["host", "start", "--resume", fs.realpathSync(file)]]);
	});
});

describe("handleLaunchRequest", () => {
	test("invalid JSON returns 400", async () => {
		const req = new Request("http://localhost/api/launch", {
			method: "POST",
			body: "not json",
			headers: { "content-type": "application/json" },
		});
		const resp = await handleLaunchRequest(req, new URL(req.url), {});
		expect(resp!.status).toBe(400);
	});

	test("resume unknown id returns 404", async () => {
		const req = new Request("http://localhost/api/past/nonexistent-id/resume", { method: "POST" });
		const resp = await handleLaunchRequest(req, new URL(req.url), { sessionsDir: tmp });
		expect(resp!.status).toBe(404);
	});

	test("resume of a session path outside sessionsDir returns 404 without running omp", async () => {
		const omp = writeFakeOmp(path.join(tmp, "bin"), { stdout: JSON.stringify(HOST) });
		const sessionsDir = path.join(tmp, "sessions");
		fs.mkdirSync(path.join(sessionsDir, "proj"), { recursive: true });
		const outsideFile = path.join(tmp, "evil.jsonl");
		fs.writeFileSync(
			outsideFile,
			`${JSON.stringify({ type: "session", version: 3, id: "evil", timestamp: "2026-01-01T00:00:00.000Z", cwd: tmp })}\n`,
		);
		for (const target of [outsideFile, path.join(sessionsDir, "proj", "..", "..", "evil.jsonl")]) {
			const req = new Request(`http://localhost/api/past/${encodeURIComponent(target)}/resume`, {
				method: "POST",
			});
			const resp = await handleLaunchRequest(req, new URL(req.url), { ompBin: omp.bin, sessionsDir });
			expect(resp!.status).toBe(404);
		}
		expect(omp.calls()).toEqual([]);
	});

	test("unmatched path returns null", async () => {
		const req = new Request("http://localhost/api/other", { method: "GET" });
		expect(await handleLaunchRequest(req, new URL(req.url), {})).toBeNull();
	});
});
