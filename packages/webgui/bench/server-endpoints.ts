import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as net from "node:net";
import type { Server } from "bun";
import { createServer } from "../src/server/index";
import type { RelayData } from "../src/server/relay";
import {
	publishRpcHost,
	type RpcHostEntry,
	type RpcHostPublication,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { runTmux } from "../src/server/tmux";

export interface TimingStats {
	count: number;
	min: number;
	max: number;
	avg: number;
	p50: number;
	p95: number;
	cpuUserMsPerReq: number;
	cpuSysMsPerReq: number;
}

export interface EndpointMeasurement {
	cold: number;
	stats: TimingStats;
}

export interface MatrixPointResult {
	N: number;
	H: number;
	liveWithTmux: EndpointMeasurement;
	liveNoTmux: EndpointMeasurement;
	pastAll: EndpointMeasurement;
	pastId: EndpointMeasurement;
	staticIndex: EndpointMeasurement;
	spaFallback: EndpointMeasurement;
	wsUpgrade: EndpointMeasurement;
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

async function measure<T>(fn: () => Promise<T>, iterations: number, warmup: number = 0): Promise<EndpointMeasurement> {
	// Cold run
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

interface FixtureEnv {
	baseDir: string;
	registryDir: string;
	distDir: string;
	sessionsDir: string;
	fakeSocketServer: net.Server;
	fakeSocketPath: string;
	publications: RpcHostPublication[];
	sampleSessionFile: string;
	cleanup: () => Promise<void>;
}

async function setupFakeSocket(tmpBase: string): Promise<{ server: net.Server; socketPath: string }> {
	const socketPath = path.join(tmpBase, "fake.sock");
	const { promise, resolve } = Promise.withResolvers<void>();
	const server = net.createServer(conn => {
		let buffer = "";
		let authenticated = false;
		conn.on("data", (chunk: Buffer) => {
			buffer += chunk.toString();
			let nl: number;
			while ((nl = buffer.indexOf("\n")) !== -1) {
				const line = buffer.slice(0, nl);
				buffer = buffer.slice(nl + 1);
				if (!authenticated) {
					authenticated = true;
					conn.write(JSON.stringify({ type: "ready", version: 1 }) + "\n");
					continue;
				}
				try {
					const parsed = JSON.parse(line) as { id?: number };
					conn.write(JSON.stringify({ type: "response", id: parsed.id ?? 1 }) + "\n");
				} catch {}
			}
		});
	});
	server.listen(socketPath, resolve);
	await promise;
	return { server, socketPath };
}

async function createFixtures(numSessions: number, numHosts: number): Promise<FixtureEnv> {
	const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-bench-webgui-"));
	const registryDir = path.join(baseDir, "registry");
	const distDir = path.join(baseDir, "dist");
	const sessionsDir = path.join(baseDir, "sessions");

	fs.mkdirSync(registryDir, { recursive: true });
	fs.mkdirSync(distDir, { recursive: true });
	fs.mkdirSync(sessionsDir, { recursive: true });

	// index.html for static tests
	fs.writeFileSync(
		path.join(distDir, "index.html"),
		'<!DOCTYPE html><html><head><title>Bench</title></head><body><div id="root"></div></body></html>',
	);

	const { server: fakeSocketServer, socketPath: fakeSocketPath } = await setupFakeSocket(baseDir);

	// Distribute sessions across projects (e.g. 5 projects)
	const numProjects = 5;
	let sampleSessionFile = "";
	const projectDirs: string[] = [];
	for (let p = 0; p < numProjects; p++) {
		const pDir = path.join(sessionsDir, `proj-${p}`);
		fs.mkdirSync(pDir, { recursive: true });
		projectDirs.push(pDir);
	}

	for (let i = 0; i < numSessions; i++) {
		const pDir = projectDirs[i % numProjects];
		const sessId = `bench-sess-${i.toString().padStart(6, "0")}`;
		const ts = new Date(Date.now() - (numSessions - i) * 60_000).toISOString();
		const filePath = path.join(pDir, `${ts.replace(/[:.]/g, "-")}_${sessId}.jsonl`);

		// Session header + 2 messages
		const lines = [
			JSON.stringify({ type: "session", id: sessId, timestamp: ts, cwd: `/workspace/proj-${i % numProjects}` }),
			JSON.stringify({
				type: "message",
				id: `msg-${i}-1`,
				parentId: null,
				timestamp: ts,
				message: { role: "user", content: `User query ${i} for benchmarking` },
			}),
			JSON.stringify({
				type: "message",
				id: `msg-${i}-2`,
				parentId: `msg-${i}-1`,
				timestamp: ts,
				message: { role: "assistant", content: [{ type: "text", text: `Assistant reply ${i} here` }] },
			}),
		];
		fs.writeFileSync(filePath, lines.join("\n") + "\n");
		if (i === Math.floor(numSessions / 2)) {
			sampleSessionFile = filePath;
		}
	}
	if (!sampleSessionFile && numSessions > 0) {
		sampleSessionFile = path.join(projectDirs[0], fs.readdirSync(projectDirs[0])[0]);
	}

	// Fake registry hosts
	const publications: RpcHostPublication[] = [];
	for (let h = 0; h < numHosts; h++) {
		const sessId = `live-sess-${h}`;
		const sessFile = path.join(projectDirs[h % numProjects], `live-${h}.jsonl`);
		fs.writeFileSync(
			sessFile,
			[
				JSON.stringify({ type: "session", id: sessId, timestamp: new Date().toISOString(), cwd: "/workspace" }),
				JSON.stringify({
					type: "message",
					id: `live-m1-${h}`,
					parentId: null,
					timestamp: new Date().toISOString(),
					message: { role: "assistant", content: [{ type: "text", text: `Live content ${h}` }] },
				}),
			].join("\n") + "\n",
		);

		const pub = publishRpcHost(
			{
				sessionId: sessId,
				sessionName: `Live Session ${h}`,
				sessionFile: sessFile,
				cwd: `/workspace/live-${h}`,
				model: "anthropic/claude-3-7-sonnet",
				startedAt: Date.now() - 30_000,
			},
			{ dir: registryDir },
		);

		// Overwrite endpoint in registry file
		const files = fs.readdirSync(registryDir).filter(f => f.endsWith(".json"));
		for (const f of files) {
			const p = path.join(registryDir, f);
			const entry = JSON.parse(fs.readFileSync(p, "utf8")) as RpcHostEntry;
			if (entry.instanceId === pub.entry.instanceId) {
				entry.endpoint = fakeSocketPath;
				fs.writeFileSync(p, JSON.stringify(entry), { mode: 0o600 });
				pub.entry.endpoint = fakeSocketPath;
				break;
			}
		}
		publications.push(pub);
	}

	const cleanup = async () => {
		for (const p of publications) {
			p.close();
		}
		const { promise, resolve } = Promise.withResolvers<void>();
		fakeSocketServer.close(() => resolve());
		await promise;
		fs.rmSync(baseDir, { recursive: true, force: true });
	};

	return {
		baseDir,
		registryDir,
		distDir,
		sessionsDir,
		fakeSocketServer,
		fakeSocketPath,
		publications,
		sampleSessionFile,
		cleanup,
	};
}

export async function runBenchmarkMatrix(): Promise<{ hasTmux: boolean; resultsTable: MatrixPointResult[] }> {
	const nValues = [100, 1000, 5000];
	const hValues = [1, 5, 20];

	// Check if tmux is functional
	let hasTmux = false;
	try {
		const res = await runTmux(["list-sessions"]);
		hasTmux = res.exitCode === 0;
	} catch {
		hasTmux = false;
	}
	process.stdout.write(`[Setup] tmux available: ${hasTmux}\n`);

	const resultsTable: MatrixPointResult[] = [];

	for (const N of nValues) {
		for (const H of hValues) {
			process.stdout.write(`\n=== Running Matrix Point: N=${N} sessions, H=${H} hosts ===\n`);
			const fixtures = await createFixtures(N, H);

			const server: Server<RelayData> = createServer({
				host: "127.0.0.1",
				port: 0,
				distDir: fixtures.distDir,
				registryDir: fixtures.registryDir,
				sessionsDir: fixtures.sessionsDir,
				tmux: hasTmux ? runTmux : undefined,
			});

			const baseUrl = `http://${server.hostname}:${server.port}`;
			const liveHost = fixtures.publications[0];

			// 1. GET /api/live (with tmux if available)
			const liveRes = await measure(
				async () => {
					const r = await fetch(`${baseUrl}/api/live`);
					await r.json();
				},
				30,
				5,
			);

			// 1b. GET /api/live (without tmux)
			const serverNoTmux: Server<RelayData> = createServer({
				host: "127.0.0.1",
				port: 0,
				distDir: fixtures.distDir,
				registryDir: fixtures.registryDir,
				sessionsDir: fixtures.sessionsDir,
			});
			const baseNoTmuxUrl = `http://${serverNoTmux.hostname}:${serverNoTmux.port}`;
			const liveNoTmuxRes = await measure(
				async () => {
					const r = await fetch(`${baseNoTmuxUrl}/api/live`);
					await r.json();
				},
				30,
				5,
			);
			serverNoTmux.stop(true);

			// 2. GET /api/past?all=true
			// Past scan does disk stats / header scans on every session
			const pastIters = N >= 5000 ? 5 : 20;
			const pastRes = await measure(
				async () => {
					const r = await fetch(`${baseUrl}/api/past?all=true`);
					await r.json();
				},
				pastIters,
				2,
			);

			// 3. GET /api/past/:id
			const encodedId = encodeURIComponent(fixtures.sampleSessionFile);
			const pastIdRes = await measure(
				async () => {
					const r = await fetch(`${baseUrl}/api/past/${encodedId}`);
					await r.json();
				},
				50,
				5,
			);

			// 4. GET / (static index.html)
			const staticRes = await measure(
				async () => {
					const r = await fetch(`${baseUrl}/`);
					await r.text();
				},
				100,
				10,
			);

			// 5. GET /spa-fallback (SPA fallback static index.html)
			const spaRes = await measure(
				async () => {
					const r = await fetch(`${baseUrl}/app/routes/subview`);
					await r.text();
				},
				100,
				10,
			);

			// 6. WebSocket upgrade + ready frame
			const wsIters = 20;
			const wsRes = await measure(
				async () => {
					const { promise, resolve, reject } = Promise.withResolvers<void>();
					const ws = new WebSocket(`ws://${server.hostname}:${server.port}/ws/${liveHost.entry.instanceId}`);
					ws.onmessage = () => {
						ws.close();
						resolve();
					};
					ws.onerror = e => reject(e);
					await promise;
				},
				wsIters,
				2,
			);

			const pointData: MatrixPointResult = {
				N,
				H,
				liveWithTmux: liveRes,
				liveNoTmux: liveNoTmuxRes,
				pastAll: pastRes,
				pastId: pastIdRes,
				staticIndex: staticRes,
				spaFallback: spaRes,
				wsUpgrade: wsRes,
			};
			resultsTable.push(pointData);

			process.stdout.write(`[Results N=${N}, H=${H}]\n`);
			process.stdout.write(
				`  live (no tmux): p50=${liveNoTmuxRes.stats.p50.toFixed(2)}ms, p95=${liveNoTmuxRes.stats.p95.toFixed(2)}ms, CPU=${(liveNoTmuxRes.stats.cpuUserMsPerReq + liveNoTmuxRes.stats.cpuSysMsPerReq).toFixed(2)}ms\n`,
			);
			process.stdout.write(
				`  live (with tmux): p50=${liveRes.stats.p50.toFixed(2)}ms, p95=${liveRes.stats.p95.toFixed(2)}ms, CPU=${(liveRes.stats.cpuUserMsPerReq + liveRes.stats.cpuSysMsPerReq).toFixed(2)}ms\n`,
			);
			process.stdout.write(
				`  past?all=true: cold=${pastRes.cold.toFixed(2)}ms, p50=${pastRes.stats.p50.toFixed(2)}ms, p95=${pastRes.stats.p95.toFixed(2)}ms, CPU=${(pastRes.stats.cpuUserMsPerReq + pastRes.stats.cpuSysMsPerReq).toFixed(2)}ms\n`,
			);
			process.stdout.write(
				`  past/:id: p50=${pastIdRes.stats.p50.toFixed(2)}ms, p95=${pastIdRes.stats.p95.toFixed(2)}ms, CPU=${(pastIdRes.stats.cpuUserMsPerReq + pastIdRes.stats.cpuSysMsPerReq).toFixed(2)}ms\n`,
			);
			process.stdout.write(
				`  static /: p50=${staticRes.stats.p50.toFixed(2)}ms, p95=${staticRes.stats.p95.toFixed(2)}ms, CPU=${(staticRes.stats.cpuUserMsPerReq + staticRes.stats.cpuSysMsPerReq).toFixed(2)}ms\n`,
			);
			process.stdout.write(
				`  spa fallback: p50=${spaRes.stats.p50.toFixed(2)}ms, p95=${spaRes.stats.p95.toFixed(2)}ms, CPU=${(spaRes.stats.cpuUserMsPerReq + spaRes.stats.cpuSysMsPerReq).toFixed(2)}ms\n`,
			);
			process.stdout.write(
				`  ws upgrade: p50=${wsRes.stats.p50.toFixed(2)}ms, p95=${wsRes.stats.p95.toFixed(2)}ms, CPU=${(wsRes.stats.cpuUserMsPerReq + wsRes.stats.cpuSysMsPerReq).toFixed(2)}ms\n`,
			);

			server.stop(true);
			await fixtures.cleanup();
		}
	}

	return { hasTmux, resultsTable };
}

if (import.meta.main) {
	runBenchmarkMatrix()
		.then(out => {
			process.stdout.write(`\nFinished matrix benchmark. Output points: ${out.resultsTable.length}\n`);
		})
		.catch(err => {
			process.stderr.write(`Benchmark failed: ${String(err)}\n`);
			process.exit(1);
		});
}
