/**
 * Real Chromium Browser Benchmark Runner (`slice=browser`).
 *
 * Runs headless browser measurement against fake-host and local server:
 * 1. Starts fake RPC host with PRESETS.huge / PRESETS.long streaming
 * 2. Starts webgui server
 * 3. Drives Chromium via Puppeteer to capture CDP Profiler + PerformanceObserver long tasks + rAF frame durations
 * 4. Measures AgentHubScreen idle tick and HubTranscript poll cost
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import puppeteer from "puppeteer-core";
import { generateSession, PRESETS } from "./lib/session-frames";
import { startFakeRpcHost } from "./fake-host";
import { createServer } from "../src/server/index";

export interface TimingStats {
	count: number;
	min: number;
	max: number;
	avg: number;
	p50: number;
	p95: number;
}

export function computeStats(arr: number[]): TimingStats {
	if (!arr.length) return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0 };
	const s = [...arr].sort((a, b) => a - b);
	return {
		count: s.length,
		min: s[0],
		max: s[s.length - 1],
		avg: s.reduce((a, b) => a + b, 0) / s.length,
		p50: s[Math.floor(s.length * 0.5)],
		p95: s[Math.floor(s.length * 0.95)],
	};
}

// Locate managed Chromium or system Chromium
function findChromiumPath(): string {
	const candidates = [
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
		process.env.CHROME_BIN,
		process.env.PUPPETEER_EXECUTABLE_PATH,
	].filter(Boolean) as string[];

	for (const c of candidates) {
		if (fs.existsSync(c)) return c;
	}
	throw new Error("Chromium executable not found");
}

async function run(): Promise<void> {
	console.log("=== BROWSER SLICE BENCHMARK START ===");
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-browser-slice-"));
	const registryDir = path.join(tmpDir, "registry");
	fs.mkdirSync(registryDir, { recursive: true });

	// Use PRESETS.huge for full stream test
	console.log("Generating PRESETS.long session (150 entries, 1491 frames)...");
	const session = generateSession(PRESETS.long);
	console.log(`Generated session: ${session.stream.length} frames.`);

	const fakeHost = startFakeRpcHost({
		registryDir,
		session,
		paceMs: 1, // fast stream pacing to exercise client under frame pressure
	});

	const distDir = path.resolve(import.meta.dir, "../dist");
	const server = createServer({
		host: "127.0.0.1",
		port: 0,
		distDir,
		registryDir,
	});
	const port = server.port;
	console.log(`Webgui server running on port ${port}, instanceId: ${fakeHost.instanceId}`);

	const chromePath = findChromiumPath();
	console.log(`Launching browser: ${chromePath}`);
	const browser = await puppeteer.launch({
		executablePath: chromePath,
		headless: true,
		args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
	});

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 800 });
		page.on("console", msg => console.log(`[browser-console] ${msg.type()}: ${msg.text()}`));
		page.on("pageerror", err => console.log(`[browser-error] ${err.message}`));

		// Inject instrumentation before page loads
		await page.evaluateOnNewDocument(() => {
			(window as unknown as Record<string, unknown>).__reactCommits = 0;
			(window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
				supportsFiber: true,
				inject: () => {},
				onCommitFiberRoot: () => {
					const c = (window as unknown as { __reactCommits: number }).__reactCommits;
					(window as unknown as { __reactCommits: number }).__reactCommits = c + 1;
				},
				onCommitFiberUnmount: () => {},
			};
			(window as unknown as Record<string, unknown>).__longTasks = [];
			(window as unknown as Record<string, unknown>).__rafDurations = [];

			try {
				const po = new PerformanceObserver(list => {
					for (const entry of list.getEntries()) {
						(window as unknown as { __longTasks: unknown[] }).__longTasks.push({
							name: entry.name,
							duration: entry.duration,
							startTime: entry.startTime,
						});
					}
				});
				po.observe({ type: "longtask", buffered: true });
			} catch {}

			let last = performance.now();
			function raf(now: number): void {
				const d = now - last;
				last = now;
				(window as unknown as { __rafDurations: number[] }).__rafDurations.push(d);
				requestAnimationFrame(raf);
			}
			requestAnimationFrame(raf);
		});

		// Navigate to session
		console.log("Navigating to session in Chromium...");
		await page.goto(`http://127.0.0.1:${port}/#/s/${fakeHost.instanceId}`, { waitUntil: "domcontentloaded" });

		// Wait 1.5s for initial render and WebSocket attach
		const { promise: pAttach, resolve: rAttach } = Promise.withResolvers<void>();
		setTimeout(rAttach, 1500);
		await pAttach;

		// Start CDP Profiler
		const client = await page.createCDPSession();
		await client.send("Profiler.enable");
		await client.send("Profiler.start");
		console.log("CDP Profiler started. Streaming session frames...");

		const tStreamStart = performance.now();
		fakeHost.startStreaming();
		await fakeHost.waitForStreamComplete();
		const tStreamEnd = performance.now();
		console.log(`Streaming completed in ${(tStreamEnd - tStreamStart).toFixed(2)}ms`);

		// Wait 500ms settle
		const { promise: pSettle, resolve: rSettle } = Promise.withResolvers<void>();
		setTimeout(rSettle, 500);
		await pSettle;

		const cdpProfile = await client.send("Profiler.stop");
		const streamMetrics = await page.evaluate(() => {
			return {
				reactCommits: (window as unknown as { __reactCommits: number }).__reactCommits,
				longTasks: (window as unknown as { __longTasks: Array<{ duration: number; startTime: number }> })
					.__longTasks,
				rafDurations: (window as unknown as { __rafDurations: number[] }).__rafDurations.slice(5),
			};
		});

		// Measure AgentHubScreen 10s idle and HubTranscript poll
		console.log("Navigating to AgentHubScreen (#/s/:id/hub)...");
		await page.evaluate((id: string) => {
			window.location.hash = `#/s/${id}/hub`;
		}, fakeHost.instanceId);

		const { promise: pHubWait, resolve: rHubWait } = Promise.withResolvers<void>();
		setTimeout(rHubWait, 1000);
		await pHubWait;

		// Start second CDP profile for Hub idle
		await client.send("Profiler.start");
		const tHubStart = performance.now();

		console.log("Observing AgentHubScreen idle for 10 seconds...");
		const { promise: pHubIdle, resolve: rHubIdle } = Promise.withResolvers<void>();
		setTimeout(rHubIdle, 10000);
		await pHubIdle;

		const hubProfile = await client.send("Profiler.stop");
		const hubMetrics = await page.evaluate((since: number) => {
			const allTasks = (window as unknown as { __longTasks: Array<{ duration: number; startTime: number }> })
				.__longTasks;
			const hubTasks = allTasks.filter(t => t.startTime >= since);
			return {
				hubTasks,
			};
		}, tHubStart);

		// Process stream CDP Profile self times
		const nodes = cdpProfile.profile.nodes;
		const samples = cdpProfile.profile.samples ?? [];
		const timeDeltas = cdpProfile.profile.timeDeltas ?? [];

		const selfTimes = new Map<number, number>();
		for (let i = 0; i < samples.length; i++) {
			const id = samples[i]!;
			const delta = timeDeltas[i] ?? 0;
			selfTimes.set(id, (selfTimes.get(id) ?? 0) + delta);
		}

		const nodeMap = new Map(nodes.map(n => [n.id, n]));
		const sortedNodes = Array.from(selfTimes.entries())
			.map(([id, deltaUs]) => {
				const n = nodeMap.get(id);
				return {
					functionName: n?.callFrame?.functionName || "(anonymous)",
					url: n?.callFrame?.url || "",
					lineNumber: n?.callFrame?.lineNumber ?? -1,
					columnNumber: n?.callFrame?.columnNumber ?? -1,
					selfTimeMs: deltaUs / 1000,
				};
			})
			.sort((a, b) => b.selfTimeMs - a.selfTimeMs);

		// Process Hub profile self times
		const hubNodes = hubProfile.profile.nodes;
		const hubSamples = hubProfile.profile.samples ?? [];
		const hubDeltas = hubProfile.profile.timeDeltas ?? [];
		const hubSelfTimes = new Map<number, number>();
		for (let i = 0; i < hubSamples.length; i++) {
			const id = hubSamples[i]!;
			const delta = hubDeltas[i] ?? 0;
			hubSelfTimes.set(id, (hubSelfTimes.get(id) ?? 0) + delta);
		}
		const hubNodeMap = new Map(hubNodes.map(n => [n.id, n]));
		const sortedHubNodes = Array.from(hubSelfTimes.entries())
			.map(([id, deltaUs]) => {
				const n = hubNodeMap.get(id);
				return {
					functionName: n?.callFrame?.functionName || "(anonymous)",
					url: n?.callFrame?.url || "",
					lineNumber: n?.callFrame?.lineNumber ?? -1,
					columnNumber: n?.callFrame?.columnNumber ?? -1,
					selfTimeMs: deltaUs / 1000,
				};
			})
			.sort((a, b) => b.selfTimeMs - a.selfTimeMs);

		const streamRafStats = computeStats(streamMetrics.rafDurations);
		const longTasksTotalMs = streamMetrics.longTasks.reduce((acc, t) => acc + t.duration, 0);

		console.log("\n==========================================");
		console.log("         BROWSER BENCHMARK RESULTS        ");
		console.log("==========================================");
		console.log(`Stream Frames: ${session.stream.length} frames`);
		console.log(`Stream Duration: ${(tStreamEnd - tStreamStart).toFixed(2)} ms`);
		console.log(`React Commits: ${streamMetrics.reactCommits}`);
		console.log(`Long Tasks Count: ${streamMetrics.longTasks.length}`);
		console.log(`Long Tasks Total: ${longTasksTotalMs.toFixed(2)} ms`);
		console.log(`rAF Frame Duration p50: ${streamRafStats.p50.toFixed(2)} ms`);
		console.log(`rAF Frame Duration p95: ${streamRafStats.p95.toFixed(2)} ms`);
		console.log(`rAF Frame Duration Max: ${streamRafStats.max.toFixed(2)} ms`);
		console.log("\nTop Self-Time Functions (Stream):");
		for (let i = 0; i < Math.min(15, sortedNodes.length); i++) {
			const n = sortedNodes[i]!;
			console.log(
				`  ${(i + 1).toString().padStart(2)}. ${n.functionName.padEnd(28)} ${n.selfTimeMs.toFixed(2).padStart(8)} ms | ${n.url}:${n.lineNumber}`,
			);
		}

		console.log("\nAgentHubScreen 10s Idle Metrics:");
		console.log(`Long Tasks Count (Hub 10s): ${hubMetrics.hubTasks.length}`);
		console.log("Top Self-Time Functions (Hub Idle 10s):");
		for (let i = 0; i < Math.min(8, sortedHubNodes.length); i++) {
			const n = sortedHubNodes[i]!;
			console.log(
				`  ${(i + 1).toString().padStart(2)}. ${n.functionName.padEnd(28)} ${n.selfTimeMs.toFixed(2).padStart(8)} ms | ${n.url}:${n.lineNumber}`,
			);
		}

		// Write detailed output to local artifact for reporting
		const outReport = {
			preset: "huge",
			frames: session.stream.length,
			streamDurationMs: tStreamEnd - tStreamStart,
			reactCommits: streamMetrics.reactCommits,
			longTasksCount: streamMetrics.longTasks.length,
			longTasksTotalMs,
			streamRafStats,
			topStreamNodes: sortedNodes.slice(0, 20),
			hubIdleLongTasks: hubMetrics.hubTasks.length,
			topHubNodes: sortedHubNodes.slice(0, 10),
		};

		fs.writeFileSync(path.resolve(import.meta.dir, "browser-bench-results.json"), JSON.stringify(outReport, null, 2));
		console.log("\nSaved results to packages/webgui/bench/browser-bench-results.json");
	} finally {
		await browser.close();
		server.stop(true);
		await fakeHost.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

void run();
