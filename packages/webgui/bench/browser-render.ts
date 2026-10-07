/**
 * Automated browser rendering benchmark (`slice=render`).
 * Drives headless Chrome to benchmark webgui streaming performance.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import puppeteer from "puppeteer-core";
import type { BunPlugin } from "bun";
import { SourceMapConsumer } from "source-map-js";
import { generateSession, createRng, generateMarkdownText, generateToolOutputChunk } from "./lib/session-frames";
import { startFakeRpcHost } from "./fake-host";
import { createServer } from "../src/server/index";

export interface TimingStats {
	count: number;
	min: number;
	max: number;
	avg: number;
	p50: number;
	p95: number;
	p99: number;
}

export function computeStats(arr: number[]): TimingStats {
	if (!arr.length) return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
	const s = [...arr].sort((a, b) => a - b);
	const sum = s.reduce((a, b) => a + b, 0);
	return {
		count: s.length,
		min: s[0]!,
		max: s[s.length - 1]!,
		avg: sum / s.length,
		p50: s[Math.min(s.length - 1, Math.floor(s.length * 0.5))]!,
		p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]!,
		p99: s[Math.min(s.length - 1, Math.floor(s.length * 0.99))]!,
	};
}

export interface ScenarioResult {
	scenario: string;
	run: number;
	durationMs: number;
	scriptingMs: number;
	renderingMs: number;
	paintingMs: number;
	forcedLayoutCount: number;
	forcedLayoutCallers: string[];
	rafP50: number;
	rafP95: number;
	rafP99: number;
	rafMax: number;
	droppedFramePct: number;
	longTaskCount: number;
	longTaskTotalMs: number;
	reactCommits: number;
	topComponents: Array<{ name: string; durationMs: number }>;
	topProfileFunctions: Array<{ name: string; srcLocation: string; selfMs: number; totalMs: number }>;
	renderMarkdownMs: number;
	flattenEntriesMs: number;
	getMeasurementsMs: number;
	getMeasurementsCalls: number;
	getMaxScrollOffsetMs: number;
}

export function buildBenchSession(historyCount: number, assistantChars = 20000, toolChunks = 500, deltaChars = 512) {
	const base = generateSession({
		entries: historyCount * 2,
		assistantChars: 1000,
		deltaChars: 512,
		toolOutputChunks: 5,
		toolChunkChars: 100,
		subagents: 4,
		seed: 42,
	});

	const rng = createRng(42);
	const streamFrames: string[] = [];

	const sid = 99999;
	const currentTime = Date.now();
	const lastLeafId = base.history.historyResult.leafId;
	const userEntryId = "bench-stream-user-entry";
	const userEntry = {
		id: userEntryId,
		parentId: lastLeafId,
		timestamp: new Date(currentTime).toISOString(),
		type: "message",
		message: {
			role: "user",
			content: "Benchmarking stream performance with large markdown and tool output chunks.",
			timestamp: currentTime,
		},
	};

	streamFrames.push(JSON.stringify({ type: "turn_start" }) + "\n");
	streamFrames.push(JSON.stringify({ type: "entry", entry: userEntry }) + "\n");
	streamFrames.push(JSON.stringify({ type: "agent_start" }) + "\n");

	const toolCallId = "bench_call_stream_1";
	const fullMarkdown = generateMarkdownText(rng, assistantChars);

	streamFrames.push(
		JSON.stringify({
			type: "msg_start",
			sid,
			message: { role: "assistant", content: [], timestamp: currentTime },
		}) + "\n",
	);

	streamFrames.push(
		JSON.stringify({
			type: "block_start",
			sid,
			block: 0,
			start: { type: "text" },
		}) + "\n",
	);

	const deltaSize = deltaChars;
	let offset = 0;
	while (offset < fullMarkdown.length) {
		const chunk = fullMarkdown.slice(offset, offset + deltaSize);
		offset += deltaSize;
		streamFrames.push(
			JSON.stringify({
				type: "delta",
				sid,
				block: 0,
				text: chunk,
			}) + "\n",
		);
	}

	streamFrames.push(
		JSON.stringify({
			type: "block_end",
			sid,
			block: 0,
			content: { type: "text", text: fullMarkdown },
		}) + "\n",
	);

	streamFrames.push(
		JSON.stringify({
			type: "block_start",
			sid,
			block: 1,
			start: { type: "toolCall", id: toolCallId, name: "benchmark_runner" },
		}) + "\n",
	);

	const toolCallContent = {
		type: "toolCall",
		id: toolCallId,
		name: "benchmark_runner",
		arguments: { runs: toolChunks, size: 500 },
		intent: "Running synthetic benchmarks",
	};

	streamFrames.push(
		JSON.stringify({
			type: "block_end",
			sid,
			block: 1,
			content: toolCallContent,
		}) + "\n",
	);

	streamFrames.push(
		JSON.stringify({
			type: "tool_execution_start",
			toolCallId,
			toolName: "benchmark_runner",
			args: toolCallContent.arguments,
			intent: toolCallContent.intent,
		}) + "\n",
	);

	let accumulatedToolOutput = "";
	for (let c = 0; c < toolChunks; c++) {
		const chunkText = generateToolOutputChunk(rng, 500, c);
		accumulatedToolOutput += chunkText + "\n";
		streamFrames.push(
			JSON.stringify({
				type: "tool_output",
				toolCallId,
				text: chunkText + "\n",
				details: { progress: ((c + 1) / toolChunks) * 100, chunkIndex: c },
			}) + "\n",
		);
	}

	streamFrames.push(
		JSON.stringify({
			type: "tool_execution_end",
			toolCallId,
			toolName: "benchmark_runner",
			result: accumulatedToolOutput,
			isError: false,
		}) + "\n",
	);

	const toolResultEntry = {
		id: "bench-stream-tool-result",
		parentId: userEntryId,
		timestamp: new Date(currentTime).toISOString(),
		type: "message",
		message: {
			role: "toolResult",
			toolCallId,
			toolName: "benchmark_runner",
			content: [{ type: "text", text: accumulatedToolOutput }],
			isError: false,
			timestamp: currentTime,
		},
	};

	streamFrames.push(JSON.stringify({ type: "entry", entry: toolResultEntry }) + "\n");

	streamFrames.push(
		JSON.stringify({
			type: "msg_end",
			sid,
			message: {
				role: "assistant",
				content: [{ type: "text", text: fullMarkdown }, toolCallContent],
				timestamp: currentTime,
			},
		}) + "\n",
	);

	streamFrames.push(JSON.stringify({ type: "turn_end" }) + "\n");
	streamFrames.push(JSON.stringify({ type: "agent_end" }) + "\n");

	return {
		history: base.history,
		stream: streamFrames,
	};
}

// Build webgui for benchmarking with profiling & sourcemap support
export async function ensureBenchBuild(outdir: string): Promise<string> {
	const pkgRoot = path.resolve(import.meta.dir, "..");
	if (fs.existsSync(path.join(outdir, "index.html"))) {
		return outdir;
	}
	await fs.promises.rm(outdir, { recursive: true, force: true });
	await fs.promises.mkdir(outdir, { recursive: true });

	const katexDedupePlugin: BunPlugin = {
		name: "katex-dedupe",
		setup(build) {
			build.onResolve({ filter: /katex(?:\/dist\/katex)?\.(?:m?js|css)$/ }, () => ({
				path: path.resolve(pkgRoot, "node_modules/katex/dist/katex.mjs"),
			}));
		},
	};

	const reactProfilingPlugin: BunPlugin = {
		name: "react-profiling-plugin",
		setup(build) {
			build.onResolve({ filter: /^react-dom\/client$/ }, () => ({
				path: require.resolve("react-dom/profiling"),
			}));
		},
	};

	const buildResult = await Bun.build({
		entrypoints: [path.resolve(pkgRoot, "src/main.tsx")],
		outdir,
		minify: false,
		sourcemap: "external",
		splitting: true,
		naming: {
			entry: "[name].[hash].[ext]",
			chunk: "[name].[hash].[ext]",
			asset: "[name].[hash].[ext]",
		},
		define: {
			"process.env.NODE_ENV": '"production"',
		},
		target: "browser",
		metafile: true,
		plugins: [katexDedupePlugin, reactProfilingPlugin],
	});

	if (!buildResult.success) {
		throw new Error("Build failed: " + buildResult.logs.map(l => l.message).join("\n"));
	}

	const entryOutput = buildResult.outputs.find(o => o.kind === "entry-point");
	if (!entryOutput) throw new Error("No entry point output");
	const entryFileName = path.basename(entryOutput.path);
	const cssOutputs = buildResult.outputs.filter(o => o.path.endsWith(".css"));
	const cssFiles = cssOutputs.map(o => path.basename(o.path)).sort();

	const srcHtml = await Bun.file(path.resolve(pkgRoot, "index.html")).text();
	let html = srcHtml.replace(
		/<script\b[^>]*\bsrc=["'](?:\.\/)?src\/main\.tsx["'][^>]*>(?:<\/script>)?/i,
		`<script type="module" src="./${entryFileName}"></script>`,
	);
	const headTags = cssFiles.map(c => `\t\t<link rel="stylesheet" href="./${c}" />`);
	html = html.replace(/\t*<\/head>/, `${headTags.join("\n")}\n\t</head>`);
	await Bun.write(path.join(outdir, "index.html"), html);
	return outdir;
}

interface RawTraceEvent {
	name: string;
	cat: string;
	dur?: number;
	args?: {
		beginData?: {
			stackTrace?: Array<{
				functionName: string;
				url: string;
				lineNumber: number;
				columnNumber: number;
			}>;
		};
	};
}

interface RawProfileNode {
	id: number;
	callFrame: {
		functionName: string;
		url: string;
		lineNumber: number;
		columnNumber: number;
	};
}

interface RawProfile {
	nodes: RawProfileNode[];
	samples?: number[];
	timeDeltas?: number[];
}

export async function runScenario(
	scenarioName: "idle" | "stream-1000" | "stream-4000" | "stream-text",
	runIdx: number,
	benchDistDir: string,
	sourcemaps: Map<string, SourceMapConsumer>,
): Promise<ScenarioResult> {
	console.log(`[bench] Running ${scenarioName} run #${runIdx}...`);
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-render-"));
	const registryDir = path.join(tmpDir, "registry");
	fs.mkdirSync(registryDir, { recursive: true });

	const isIdle = scenarioName === "idle";
	const isTextHeavy = scenarioName === "stream-text";
	const historyCount = scenarioName === "stream-4000" ? 4000 : 1000;
	// stream-text: BENCH_TEXT_CHARS (default 20000) chars markdown, 64-char delta chunks, 0 tool chunks
	const textChars = Number(process.env.BENCH_TEXT_CHARS ?? "20000");
	const sessionData = isTextHeavy
		? buildBenchSession(1000, textChars, 0, 64)
		: buildBenchSession(historyCount, 20000, 500, 512);

	const fakeHost = startFakeRpcHost({
		registryDir,
		session: isIdle ? { history: sessionData.history, stream: [] } : sessionData,
		paceMs: 16,
	});

	const server = createServer({
		registryDir,
		distDir: benchDistDir,
		port: 0,
	});

	const browser = await puppeteer.launch({
		executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		headless: "new",
		args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
	});

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 900 });

		const cdp = await page.createCDPSession();
		await cdp.send("Page.enable");

		await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
			source: `
				window.__commitCount = 0;
				window.__componentDurations = {};

				function getFiberName(fiber) {
					if (!fiber) return '';
					const type = fiber.elementType || fiber.type;
					if (!type) return '';
					if (typeof type === 'string') return type;
					if (typeof type === 'function') return type.displayName || type.name || 'Component';
					if (typeof type === 'object') {
						if (type.displayName) return type.displayName;
						if (type.render) return type.render.displayName || type.render.name || 'ForwardRef';
						if (type.type) return getFiberName({ type: type.type });
					}
					return '';
				}

				function traverseFiber(fiber) {
					if (!fiber) return;
					try {
						const name = getFiberName(fiber);
						if (name && typeof fiber.actualDuration === 'number' && fiber.actualDuration > 0) {
							window.__componentDurations[name] = (window.__componentDurations[name] || 0) + fiber.actualDuration;
						}
					} catch {}
					let child = fiber.child;
					while (child) {
						traverseFiber(child);
						child = child.sibling;
					}
				}

				window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
					supportsFiber: true,
					renderers: new Map(),
					onCommitFiberRoot: (rendererID, root) => {
						window.__commitCount++;
						if (root && root.current) {
							traverseFiber(root.current);
						}
					},
					onCommitFiberUnmount: () => {},
					inject: () => {}
				};

				window.__longTasks = [];
				try {
					const po = new PerformanceObserver(list => {
						for (const e of list.getEntries()) {
							window.__longTasks.push({ duration: e.duration, startTime: e.startTime });
						}
					});
					po.observe({ type: 'longtask', buffered: true });
				} catch {}

				window.__rafs = [];
				let last = performance.now();
				function rafLoop(now) {
					window.__rafs.push(now - last);
					last = now;
					requestAnimationFrame(rafLoop);
				}
				requestAnimationFrame(rafLoop);
			`,
		});

		await cdp.send("Page.navigate", { url: `http://127.0.0.1:${server.port}/#/s/${fakeHost.instanceId}` });
		// Wait for initial load and attach
		await new Promise(r => setTimeout(r, 2000));

		// Reset counters before benchmark window
		await cdp.send("Runtime.evaluate", {
			expression: `
				window.__commitCount = 0;
				window.__componentDurations = {};
				window.__longTasks = [];
				window.__rafs = [];
			`,
		});

		await cdp.send("Profiler.enable");
		await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
		await cdp.send("Profiler.start");

		const traceEvents: RawTraceEvent[] = [];
		cdp.on("Tracing.dataCollected", (e: { value: RawTraceEvent[] }) => traceEvents.push(...e.value));
		const tracingComplete = new Promise(resolve => cdp.on("Tracing.tracingComplete", resolve));
		await cdp.send("Tracing.start", {
			traceConfig: {
				includedCategories: [
					"devtools.timeline",
					"disabled-by-default-devtools.timeline",
					"disabled-by-default-devtools.timeline.stack",
				],
			},
		});

		const t0 = performance.now();
		if (isIdle) {
			console.log("[bench] Observing 5s idle baseline...");
			await new Promise(r => setTimeout(r, 5000));
		} else {
			console.log(`[bench] Streaming ${sessionData.stream.length} frames...`);
			fakeHost.startStreaming();
			await fakeHost.waitForStreamComplete();
			// Short settle
			await new Promise(r => setTimeout(r, 200));
		}
		const durationMs = performance.now() - t0;

		const profileResponse = (await cdp.send("Profiler.stop")) as { profile: RawProfile };
		await cdp.send("Tracing.end");
		await tracingComplete;

		const browserMetrics = (await cdp.send("Runtime.evaluate", {
			expression: `JSON.stringify({
				commits: window.__commitCount,
				components: window.__componentDurations,
				longTasks: window.__longTasks,
				rafs: window.__rafs
			})`,
			returnByValue: true,
		})) as { result: { value: string } };

		const parsedMetrics = JSON.parse(browserMetrics.result.value) as {
			commits: number;
			components: Record<string, number>;
			longTasks: Array<{ duration: number; startTime: number }>;
			rafs: number[];
		};

		// 1. Process Timeline Tracing
		let scriptingMs = 0;
		let renderingMs = 0;
		let paintingMs = 0;
		let forcedLayoutCount = 0;
		const forcedLayoutCallers: string[] = [];

		for (const ev of traceEvents) {
			const durMs = (ev.dur ?? 0) / 1000;
			if (ev.name === "RunTask" || ev.name === "EvaluateScript" || ev.name === "FunctionCall") {
				scriptingMs += durMs;
			} else if (ev.name === "Layout") {
				renderingMs += durMs;
				const st = ev.args?.beginData?.stackTrace;
				if (st && st.length > 0) {
					forcedLayoutCount++;
					const top = st[0]!;
					forcedLayoutCallers.push(`${top.functionName || "(anon)"} (${top.url}:${top.lineNumber})`);
				}
			} else if (ev.name === "UpdateLayoutTree" || ev.name === "ScheduleStyleRecalculation") {
				renderingMs += durMs;
			} else if (ev.name === "Paint" || ev.name === "RasterTask" || ev.name === "CompositeLayers") {
				paintingMs += durMs;
			}
		}

		// 2. Process rAF frame intervals & long tasks
		const rafStats = computeStats(parsedMetrics.rafs.slice(3));
		// Dropped frames: intervals > 24ms (assuming standard 60fps / 16.6ms)
		const droppedCount = parsedMetrics.rafs.filter(d => d > 24).length;
		const droppedFramePct = parsedMetrics.rafs.length > 0 ? (droppedCount / parsedMetrics.rafs.length) * 100 : 0;

		const longTaskCount = parsedMetrics.longTasks.length;
		const longTaskTotalMs = parsedMetrics.longTasks.reduce((acc, t) => acc + t.duration, 0);

		// 3. Process React Fiber top components
		const topComponents = Object.entries(parsedMetrics.components)
			.map(([name, durationMs]) => ({ name, durationMs }))
			.sort((a, b) => b.durationMs - a.durationMs)
			.slice(0, 15);

		// 4. Process CPU Profile & Sourcemap
		const profile = profileResponse.profile;
		const samples = profile.samples ?? [];
		const timeDeltas = profile.timeDeltas ?? [];
		const selfTimes = new Map<number, number>();
		for (let i = 0; i < samples.length; i++) {
			const nid = samples[i]!;
			const deltaUs = timeDeltas[i] ?? 0;
			selfTimes.set(nid, (selfTimes.get(nid) ?? 0) + deltaUs);
		}

		const nodeMap = new Map<number, RawProfileNode>(profile.nodes.map(n => [n.id, n]));

		function resolveSrc(url: string, line: number, col: number): string {
			if (!url) return "";
			const fileName = path.basename(url.split("?")[0]!);
			const smc = sourcemaps.get(fileName);
			if (smc) {
				const orig = smc.originalPositionFor({ line: Math.max(1, line), column: Math.max(0, col) });
				if (orig.source) {
					const cleanSrc = orig.source.replace(/^(\.\.\/)+/, "");
					return `${cleanSrc}:${orig.line ?? 0}`;
				}
			}
			return `${fileName}:${line}`;
		}

		let renderMarkdownMs = 0;
		let flattenEntriesMs = 0;
		let getMeasurementsMs = 0;
		let getMeasurementsCalls = 0;
		let getMaxScrollOffsetMs = 0;

		const profileList = Array.from(selfTimes.entries()).map(([nid, selfUs]) => {
			const n = nodeMap.get(nid);
			const fnName = n?.callFrame.functionName || "(anonymous)";
			const url = n?.callFrame.url || "";
			const line = (n?.callFrame.lineNumber ?? 0) + 1;
			const col = n?.callFrame.columnNumber ?? 0;
			const srcLocation = resolveSrc(url, line, col);
			const selfMs = selfUs / 1000;

			if (fnName === "renderMarkdown" || srcLocation.includes("Markdown.tsx")) {
				renderMarkdownMs += selfMs;
			}
			if (fnName === "flattenEntries" || srcLocation.includes("transcript-model.ts")) {
				flattenEntriesMs += selfMs;
			}
			if (fnName === "getMeasurements" || fnName.includes("Measurements") || srcLocation.includes("virtual")) {
				getMeasurementsMs += selfMs;
				getMeasurementsCalls++;
			}
			if (
				fnName === "getMaxScrollOffset" ||
				fnName.includes("getMaxScrollOffset") ||
				(srcLocation.includes("virtual") && fnName.includes("ScrollOffset"))
			) {
				getMaxScrollOffsetMs += selfMs;
			}

			return {
				name: fnName,
				srcLocation,
				selfMs,
				totalMs: selfMs,
			};
		});

		const topProfileFunctions = profileList.sort((a, b) => b.selfMs - a.selfMs).slice(0, 25);

		return {
			scenario: scenarioName,
			run: runIdx,
			durationMs,
			scriptingMs,
			renderingMs,
			paintingMs,
			forcedLayoutCount,
			forcedLayoutCallers,
			rafP50: rafStats.p50,
			rafP95: rafStats.p95,
			rafP99: rafStats.p99,
			rafMax: rafStats.max,
			droppedFramePct,
			longTaskCount,
			longTaskTotalMs,
			reactCommits: parsedMetrics.commits,
			topComponents,
			topProfileFunctions,
			renderMarkdownMs,
			flattenEntriesMs,
			getMeasurementsMs,
			getMeasurementsCalls,
			getMaxScrollOffsetMs,
		};
	} finally {
		await browser.close();
		await fakeHost.close();
		server.stop();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

async function main(): Promise<void> {
	console.log("=== BROWSER RENDER BENCHMARK START ===");
	const benchDistDir = process.env.BENCH_OUTDIR
		? path.resolve(process.env.BENCH_OUTDIR)
		: path.resolve(import.meta.dir, "../dist-bench");
	await ensureBenchBuild(benchDistDir);

	// Pre-load sourcemaps
	const sourcemaps = new Map<string, SourceMapConsumer>();
	const files = fs.readdirSync(benchDistDir);
	for (const f of files) {
		if (f.endsWith(".js.map")) {
			const jsName = f.slice(0, -4);
			const rawMap = JSON.parse(fs.readFileSync(path.join(benchDistDir, f), "utf8")) as Record<string, unknown>;
			sourcemaps.set(jsName, new SourceMapConsumer(rawMap as never));
		}
	}

	const allScenarios: Array<"idle" | "stream-1000" | "stream-4000" | "stream-text"> = [
		"idle",
		"stream-1000",
		"stream-4000",
		"stream-text",
	];
	const only = process.env.BENCH_SCENARIOS?.split(",");
	const scenarios = only ? allScenarios.filter(s => only.includes(s)) : allScenarios;
	const allResults: Record<string, ScenarioResult[]> = {
		idle: [],
		"stream-1000": [],
		"stream-4000": [],
		"stream-text": [],
	};

	for (const sc of scenarios) {
		for (let run = 1; run <= 3; run++) {
			const res = await runScenario(sc, run, benchDistDir, sourcemaps);
			allResults[sc]!.push(res);
		}
	}

	// Compute medians
	function median(nums: number[]): number {
		const s = [...nums].sort((a, b) => a - b);
		return s[Math.floor(s.length / 2)]!;
	}

	function medianResult(runs: ScenarioResult[]): ScenarioResult {
		const mid = runs.slice().sort((a, b) => a.durationMs - b.durationMs)[1]!;
		return {
			...mid,
			scriptingMs: median(runs.map(r => r.scriptingMs)),
			renderingMs: median(runs.map(r => r.renderingMs)),
			paintingMs: median(runs.map(r => r.paintingMs)),
			rafP50: median(runs.map(r => r.rafP50)),
			rafP95: median(runs.map(r => r.rafP95)),
			rafP99: median(runs.map(r => r.rafP99)),
			rafMax: median(runs.map(r => r.rafMax)),
			droppedFramePct: median(runs.map(r => r.droppedFramePct)),
			longTaskCount: median(runs.map(r => r.longTaskCount)),
			longTaskTotalMs: median(runs.map(r => r.longTaskTotalMs)),
			reactCommits: median(runs.map(r => r.reactCommits)),
			renderMarkdownMs: median(runs.map(r => r.renderMarkdownMs)),
			flattenEntriesMs: median(runs.map(r => r.flattenEntriesMs)),
			getMeasurementsMs: median(runs.map(r => r.getMeasurementsMs)),
			getMaxScrollOffsetMs: median(runs.map(r => r.getMaxScrollOffsetMs)),
		};
	}

	const medians: Record<string, ScenarioResult> = {};
	for (const sc of scenarios) medians[sc] = medianResult(allResults[sc]!);

	console.log("\n=== BENCHMARK COMPLETED SUCCESSFULLY ===");
	console.log(JSON.stringify(medians, null, 2));

	// Write complete output to a json artifact for inspection
	await Bun.write(path.resolve(import.meta.dir, "browser-render-results.json"), JSON.stringify(medians, null, 2));
}

if (import.meta.main) {
	void main();
}
