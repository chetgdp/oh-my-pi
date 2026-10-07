import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Server } from "bun";
import { createServer } from "../src/server/index";
import type { RelayData } from "../src/server/relay";
import { resolvePastSessionPath } from "../src/server/past";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { TmuxRunner } from "../src/server/tmux";

interface TimingStats {
	count: number;
	min: number;
	max: number;
	avg: number;
	p50: number;
	p95: number;
	cpuUserMsPerReq: number;
	cpuSysMsPerReq: number;
}

interface BenchmarkMeasurement {
	cold: number;
	stats: TimingStats;
}

function computeStats(times: number[], cpuUserMicros: number, cpuSysMicros: number): TimingStats {
	if (times.length === 0) {
		return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, cpuUserMsPerReq: 0, cpuSysMsPerReq: 0 };
	}
	const sorted = [...times].sort((a, b) => a - b);
	const sum = sorted.reduce((acc, v) => acc + v, 0);
	const min = sorted[0];
	const max = sorted[sorted.length - 1];
	const avg = sum / sorted.length;
	const p50 = sorted[Math.floor(sorted.length * 0.5)];
	const p95 = sorted[Math.floor(sorted.length * 0.95)];
	const cpuUserMsPerReq = cpuUserMicros / 1000 / sorted.length;
	const cpuSysMsPerReq = cpuSysMicros / 1000 / sorted.length;
	return { count: sorted.length, min, max, avg, p50, p95, cpuUserMsPerReq, cpuSysMsPerReq };
}

async function measure<T>(fn: () => Promise<T>, iterations: number, warmup = 0): Promise<BenchmarkMeasurement> {
	const t0 = performance.now();
	await fn();
	const cold = performance.now() - t0;

	for (let i = 0; i < warmup; i++) {
		await fn();
	}

	const times: number[] = [];
	const startCpu = process.cpuUsage();
	for (let i = 0; i < iterations; i++) {
		const s = performance.now();
		await fn();
		times.push(performance.now() - s);
	}
	const cpuDiff = process.cpuUsage(startCpu);
	return {
		cold,
		stats: computeStats(times, cpuDiff.user, cpuDiff.system),
	};
}

interface TestFixtures {
	baseDir: string;
	sessionsDir: string;
	registryDir: string;
	distDir: string;
	sampleSessionId: string;
	sampleSessionFile: string;
	cleanup: () => void;
}

function createFixtures(numSessions: number): TestFixtures {
	const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-bench-past-id-"));
	const sessionsDir = path.join(baseDir, "sessions");
	const registryDir = path.join(baseDir, "registry");
	const distDir = path.join(baseDir, "dist");
	fs.mkdirSync(sessionsDir, { recursive: true });
	fs.mkdirSync(registryDir, { recursive: true });
	fs.mkdirSync(distDir, { recursive: true });
	fs.writeFileSync(path.join(distDir, "index.html"), "<html></html>");

	const numProjects = 5;
	const projectDirs: string[] = [];
	for (let p = 0; p < numProjects; p++) {
		const pDir = path.join(sessionsDir, `proj-${p}`);
		fs.mkdirSync(pDir, { recursive: true });
		projectDirs.push(pDir);
	}

	let sampleSessionId = "";
	let sampleSessionFile = "";
	const targetIdx = Math.floor(numSessions / 2);

	for (let i = 0; i < numSessions; i++) {
		const pDir = projectDirs[i % numProjects];
		const sessId = `bench-sess-${i.toString().padStart(6, "0")}`;
		const ts = new Date(Date.now() - (numSessions - i) * 60_000).toISOString();
		const filePath = path.join(pDir, `${ts.replace(/[:.]/g, "-")}_${sessId}.jsonl`);

		const lines = [
			JSON.stringify({ type: "session", id: sessId, timestamp: ts, cwd: `/workspace/proj-${i % numProjects}` }),
			JSON.stringify({
				type: "message",
				id: `msg-${i}-1`,
				parentId: null,
				timestamp: ts,
				message: { role: "user", content: `User query ${i}` },
			}),
			JSON.stringify({
				type: "message",
				id: `msg-${i}-2`,
				parentId: `msg-${i}-1`,
				timestamp: ts,
				message: { role: "assistant", content: [{ type: "text", text: `Assistant reply ${i}` }] },
			}),
		];
		fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
		if (i === targetIdx) {
			sampleSessionId = sessId;
			sampleSessionFile = filePath;
		}
	}

	return {
		baseDir,
		sessionsDir,
		registryDir,
		distDir,
		sampleSessionId,
		sampleSessionFile,
		cleanup: () => {
			fs.rmSync(baseDir, { recursive: true, force: true });
		},
	};
}

async function runBenchmark() {
	const nValues = [100, 788, 1000, 5000];
	const results: Record<string, unknown>[] = [];

	for (const N of nValues) {
		const fixtures = createFixtures(N);

		// Fake tmux that creates matching host immediately to avoid 8000ms polling timeout!
		const fakeTmux: TmuxRunner = async () => {
			publishRpcHost(
				{
					sessionId: fixtures.sampleSessionId,
					sessionName: "Resumed",
					sessionFile: fixtures.sampleSessionFile,
					cwd: `/workspace/proj-${Math.floor(N / 2) % 5}`,
					model: "anthropic/claude-3-7-sonnet",
					startedAt: Date.now(),
				},
				{ dir: fixtures.registryDir },
			);
			return { exitCode: 0, stdout: "@100\n", stderr: "" };
		};

		const server: Server<RelayData> = createServer({
			host: "127.0.0.1",
			port: 0,
			distDir: fixtures.distDir,
			registryDir: fixtures.registryDir,
			sessionsDir: fixtures.sessionsDir,
			tmux: fakeTmux,
		});

		const baseUrl = `http://${server.hostname}:${server.port}`;
		const iters = N >= 5000 ? 5 : 10;

		// 1. GET /api/past/:path (encoded filepath, prior bench)
		const encodedPath = encodeURIComponent(fixtures.sampleSessionFile);
		const pathRes = await measure(
			async () => {
				const r = await fetch(`${baseUrl}/api/past/${encodedPath}`);
				await r.json();
			},
			iters,
			1,
		);

		// 2. GET /api/past/:bare_id (bare session ID)
		const bareRes = await measure(
			async () => {
				const r = await fetch(`${baseUrl}/api/past/${fixtures.sampleSessionId}`);
				await r.json();
			},
			iters,
			1,
		);

		// 3. POST /api/past/:id/resume lookup
		const resumeRes = await measure(
			async () => {
				const r = await fetch(`${baseUrl}/api/past/${fixtures.sampleSessionId}/resume`, {
					method: "POST",
				});
				await r.json();
			},
			iters,
			1,
		);

		// 4. Direct resolvePastSessionPath(bare_id)
		const resolveRes = await measure(
			async () => {
				await resolvePastSessionPath(fixtures.sampleSessionId, { sessionsDir: fixtures.sessionsDir });
			},
			iters,
			1,
		);

		// 5. DELETE /api/past/:bare_id
		const deleteTimes: number[] = [];
		const startDeleteCpu = process.cpuUsage();
		const delIters = N >= 5000 ? 3 : 5;
		for (let d = 0; d < delIters; d++) {
			const delId = `del-sess-${d}`;
			const delFile = path.join(fixtures.sessionsDir, "proj-0", `2026-09-01T00-00-00-000Z_${delId}.jsonl`);
			fs.writeFileSync(delFile, `${JSON.stringify({ type: "session", id: delId, cwd: "/tmp" })}\n`);

			const s = performance.now();
			const r = await fetch(`${baseUrl}/api/past/${delId}`, { method: "DELETE" });
			await r.json();
			deleteTimes.push(performance.now() - s);
		}
		const deleteCpu = process.cpuUsage(startDeleteCpu);
		const deleteStats = computeStats(deleteTimes, deleteCpu.user, deleteCpu.system);

		server.stop(true);
		fixtures.cleanup();

		const summary = {
			N,
			pathLookup: pathRes,
			bareIdLookup: bareRes,
			resumeLookup: resumeRes,
			resolveFunction: resolveRes,
			deleteLookup: deleteStats,
		};
		results.push(summary);

		console.log(`[N=${N}]`);
		console.log(
			`  Path (:path):    p50=${pathRes.stats.p50.toFixed(2)}ms, p95=${pathRes.stats.p95.toFixed(2)}ms, CPU=${(pathRes.stats.cpuUserMsPerReq + pathRes.stats.cpuSysMsPerReq).toFixed(2)}ms`,
		);
		console.log(
			`  Bare ID (:id):   p50=${bareRes.stats.p50.toFixed(2)}ms, p95=${bareRes.stats.p95.toFixed(2)}ms, CPU=${(bareRes.stats.cpuUserMsPerReq + bareRes.stats.cpuSysMsPerReq).toFixed(2)}ms`,
		);
		console.log(
			`  Resume (:id):    p50=${resumeRes.stats.p50.toFixed(2)}ms, p95=${resumeRes.stats.p95.toFixed(2)}ms, CPU=${(resumeRes.stats.cpuUserMsPerReq + resumeRes.stats.cpuSysMsPerReq).toFixed(2)}ms`,
		);
		console.log(
			`  DELETE (:id):    p50=${deleteStats.p50.toFixed(2)}ms, p95=${deleteStats.p95.toFixed(2)}ms, CPU=${(deleteStats.cpuUserMsPerReq + deleteStats.cpuSysMsPerReq).toFixed(2)}ms`,
		);
	}

	fs.writeFileSync(path.join(__dirname, "past-id-results.json"), JSON.stringify(results, null, 2));
}

runBenchmark().catch(err => {
	console.error(err);
	process.exit(1);
});
