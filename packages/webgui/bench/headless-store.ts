/**
 * Headless store benchmark harness.
 * Measures session-store, reducers, transcript-cache, and derived views
 * across presets and scaling sweep.
 */

import "../test/dom-setup";
import { spyOn } from "bun:test";
import { IDBKeyRange as FakeKeyRange, indexedDB as fakeIndexedDB } from "fake-indexeddb";
import { win } from "../test/dom-setup";

// Install fake-indexeddb and localStorage
Object.assign(globalThis, {
	indexedDB: fakeIndexedDB,
	IDBKeyRange: FakeKeyRange,
	localStorage: win.localStorage,
});

import { generateSession, PRESETS, type GenerateSessionOptions, type GeneratedSession } from "./lib/session-frames";
import { createSessionStore } from "../src/lib/session-store";
import * as transcriptModel from "../src/lib/transcript-model";
import * as promptHistory from "../src/lib/prompt-history";
import * as transcriptCacheModule from "../src/lib/transcript-cache";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import type { RpcServerSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";

// ---------------------------------------------------------------------------
// Headless Harness Client
// ---------------------------------------------------------------------------
class HeadlessHarnessClient {
	state: RpcConnectionState = "ready";
	sessionState: RpcServerSessionState;
	#eventListeners: Array<(e: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];
	#resyncListeners: Array<(s: RpcServerSessionState) => void> = [];
	#historyResult: RpcV3HistoryResult;
	#roster: unknown[];

	constructor(sessionState: RpcServerSessionState, historyResult: RpcV3HistoryResult, roster: unknown[]) {
		this.sessionState = sessionState;
		this.#historyResult = historyResult;
		this.#roster = roster;
	}

	history(
		_opts: { before?: string; after?: string; leafId?: string; limit?: number } = {},
	): Promise<RpcV3HistoryResult> {
		return Promise.resolve(this.#historyResult);
	}

	request(cmd: { type: string }): Promise<unknown> {
		switch (cmd.type) {
			case "get_state":
				return Promise.resolve({ data: this.sessionState });
			case "get_agent_roster":
				return Promise.resolve({ data: { agents: this.#roster } });
			case "get_available_commands":
				return Promise.resolve({ data: { commands: [] } });
			case "get_plan_state":
				return Promise.resolve({ data: { state: null, review: null } });
			case "set_subagent_subscription":
			case "set_agent_roster_subscription":
				return Promise.resolve({ data: {} });
			default:
				return Promise.resolve({ data: {} });
		}
	}

	onEvent(fn: (e: RpcSessionEvent) => void): () => void {
		this.#eventListeners.push(fn);
		return () => {
			const i = this.#eventListeners.indexOf(fn);
			if (i !== -1) this.#eventListeners.splice(i, 1);
		};
	}

	onStateChange(fn: (s: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(fn);
		return () => {
			const i = this.#stateListeners.indexOf(fn);
			if (i !== -1) this.#stateListeners.splice(i, 1);
		};
	}

	onResync(fn: (s: RpcServerSessionState) => void): () => void {
		this.#resyncListeners.push(fn);
		return () => {
			const i = this.#resyncListeners.indexOf(fn);
			if (i !== -1) this.#resyncListeners.splice(i, 1);
		};
	}

	emitFrame(frame: RpcSessionEvent): void {
		for (const fn of this.#eventListeners) fn(frame);
	}
}

// ---------------------------------------------------------------------------
// Stats calculation helpers
// ---------------------------------------------------------------------------
export interface LatencyStats {
	count: number;
	totalMs: number;
	p50: number;
	p95: number;
	max: number;
}

export interface SuiteBenchmarkResult {
	stageTimings: Record<string, LatencyStats>;
	v3ByEventType: Record<string, LatencyStats>;
	transcriptByEventType: Record<string, LatencyStats>;
	cacheTimings: {
		saveSessionThrottled: LatencyStats;
		flush: LatencyStats;
	};
	totalPumpMs: number;
	frameCount: number;
}

function calcStats(durationsMs: number[]): LatencyStats {
	if (durationsMs.length === 0) {
		return { count: 0, totalMs: 0, p50: 0, p95: 0, max: 0 };
	}
	const sorted = [...durationsMs].sort((a, b) => a - b);
	const count = sorted.length;
	const totalMs = sorted.reduce((sum, val) => sum + val, 0);
	const p50 = sorted[Math.floor(count * 0.5)] ?? 0;
	const p95 = sorted[Math.min(count - 1, Math.floor(count * 0.95))] ?? 0;
	const max = sorted[count - 1] ?? 0;
	return { count, totalMs, p50, p95, max };
}

function computeMedian(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
	}
	return sorted[mid] ?? 0;
}

function medianStats(statRuns: LatencyStats[]): LatencyStats {
	if (statRuns.length === 0) return { count: 0, totalMs: 0, p50: 0, p95: 0, max: 0 };
	return {
		count: Math.round(computeMedian(statRuns.map(s => s.count))),
		totalMs: computeMedian(statRuns.map(s => s.totalMs)),
		p50: computeMedian(statRuns.map(s => s.p50)),
		p95: computeMedian(statRuns.map(s => s.p95)),
		max: computeMedian(statRuns.map(s => s.max)),
	};
}

// ---------------------------------------------------------------------------
// Benchmark execution per run
// ---------------------------------------------------------------------------
interface BenchmarkRunResult {
	stageTimings: Record<string, LatencyStats>;
	v3ByEventType: Record<string, LatencyStats>;
	transcriptByEventType: Record<string, LatencyStats>;
	cacheTimings: {
		saveSessionThrottled: LatencyStats;
		flush: LatencyStats;
		evictOverflow: LatencyStats;
	};
	totalPumpMs: number;
	frameCount: number;
}

async function runSessionBenchmark(
	session: GeneratedSession,
	fillCacheFirst: boolean = false,
): Promise<BenchmarkRunResult> {
	// 1. Setup isolated DB and transcript-cache
	const uniqueDbName = `bench-cache-${Math.random().toString(36).slice(2)}`;
	const cache = transcriptCacheModule.createTranscriptCache({
		dbName: uniqueDbName,
		listenLifecycle: false,
	});

	// Pre-fill cache with 10 dummy sessions if requested
	if (fillCacheFirst) {
		for (let i = 0; i < 10; i++) {
			const dummyId = `prefill-session-${i}`;
			const dummyEntries: SessionEntry[] = Array.from({ length: 15 }, (_, idx) => ({
				id: `entry-${i}-${idx}`,
				parentId: idx === 0 ? null : `entry-${i}-${idx - 1}`,
				timestamp: new Date().toISOString(),
				type: "message",
				message: {
					role: "user",
					content: [{ type: "text", text: `Prefill dummy message ${idx}` }],
					timestamp: Date.now(),
				},
			}));
			cache.saveSessionThrottled(dummyId, {
				leafId: dummyEntries[dummyEntries.length - 1]?.id ?? null,
				entries: dummyEntries,
				hasMore: false,
			});
		}
		await cache.flush();
	}

	// Collectors
	const stageDurations: Record<string, number[]> = {
		applyV3Event: [],
		applyTranscriptEvent: [],
		buildSnapshot: [],
		emit: [],
		extractUserPrompts: [],
		flattenEntries: [],
		extractToolResults: [],
	};
	const v3TypeDurations: Record<string, number[]> = {};
	const transcriptTypeDurations: Record<string, number[]> = {};
	const cacheDurations = {
		saveSessionThrottled: [] as number[],
		flush: [] as number[],
		evictOverflow: [] as number[],
	};

	// Save original functions
	const origApplyV3Event = transcriptModel.applyV3Event;
	const origApplyTranscriptEvent = transcriptModel.applyTranscriptEvent;
	const origFlattenEntries = transcriptModel.flattenEntries;
	const origExtractToolResults = transcriptModel.extractToolResults;
	const origExtractUserPrompts = promptHistory.extractUserPrompts;

	// Spies
	const spyApplyV3 = spyOn(transcriptModel, "applyV3Event").mockImplementation((state, ev) => {
		const t0 = performance.now();
		const res = origApplyV3Event(state, ev);
		const dur = performance.now() - t0;
		stageDurations.applyV3Event!.push(dur);
		(v3TypeDurations[ev.type] ??= []).push(dur);
		return res;
	});

	const spyApplyTranscript = spyOn(transcriptModel, "applyTranscriptEvent").mockImplementation((state, ev) => {
		const t0 = performance.now();
		const res = origApplyTranscriptEvent(state, ev);
		const dur = performance.now() - t0;
		stageDurations.applyTranscriptEvent!.push(dur);
		(transcriptTypeDurations[ev.type] ??= []).push(dur);
		return res;
	});

	const spyFlatten = spyOn(transcriptModel, "flattenEntries").mockImplementation((...args) => {
		const t0 = performance.now();
		const res = origFlattenEntries(...args);
		const dur = performance.now() - t0;
		stageDurations.flattenEntries!.push(dur);
		return res;
	});

	const spyExtractTool = spyOn(transcriptModel, "extractToolResults").mockImplementation((...args) => {
		const t0 = performance.now();
		const res = origExtractToolResults(...args);
		const dur = performance.now() - t0;
		stageDurations.extractToolResults!.push(dur);
		return res;
	});

	const spyExtractPrompts = spyOn(promptHistory, "extractUserPrompts").mockImplementation((...args) => {
		const t0 = performance.now();
		const res = origExtractUserPrompts(...args);
		const dur = performance.now() - t0;
		stageDurations.extractUserPrompts!.push(dur);
		return res;
	});

	// Wrap cache methods on the instance
	const origSaveThrottled = cache.saveSessionThrottled.bind(cache);
	const origFlush = cache.flush.bind(cache);
	cache.saveSessionThrottled = function (...args) {
		const t0 = performance.now();
		origSaveThrottled(...args);
		const dur = performance.now() - t0;
		cacheDurations.saveSessionThrottled.push(dur);
	};
	cache.flush = async function () {
		const t0 = performance.now();
		await origFlush();
		const dur = performance.now() - t0;
		cacheDurations.flush.push(dur);
	};

	// Create headless client & store
	const client = new HeadlessHarnessClient(
		session.history.sessionState,
		session.history.historyResult,
		session.history.roster,
	);

	const store = createSessionStore(client as never, { cache });

	// Wait for store attach
	for (let i = 0; i < 20; i++) await Promise.resolve();

	// Listen to store updates to measure getSnapshot / buildSnapshot / derived views
	let _emitCallCount = 0;
	store.subscribe(() => {
		_emitCallCount++;
		// Measure snapshot read & derived view computation as a UI component would
		const tSnap = performance.now();
		const snap = store.getSnapshot();
		stageDurations.buildSnapshot!.push(performance.now() - tSnap);

		promptHistory.extractUserPrompts(snap.transcript);

		const toolResults = transcriptModel.extractToolResults(snap.transcript.entries);

		transcriptModel.flattenEntries(
			snap.transcript.entries,
			toolResults,
			snap.transcript.activeTools,
			snap.transcript.live,
			snap.transcript.working,
			snap.transcript.pendingUser,
			snap.transcript.entryKeys,
		);
	});

	// Pump stream frames
	const pumpStart = performance.now();
	let frameCount = 0;

	for (const rawLine of session.stream) {
		const trimmed = rawLine.trim();
		if (!trimmed) continue;
		const parsed = JSON.parse(trimmed) as RpcSessionEvent;
		const tEmit0 = performance.now();
		client.emitFrame(parsed);
		stageDurations.emit!.push(performance.now() - tEmit0);
		frameCount++;
	}

	// Explicit cache flush to measure cache save & evictOverflow
	await cache.flush();

	const totalPumpMs = performance.now() - pumpStart;

	// Restore spies
	spyApplyV3.mockRestore();
	spyApplyTranscript.mockRestore();
	spyFlatten.mockRestore();
	spyExtractTool.mockRestore();
	spyExtractPrompts.mockRestore();

	// Calculate stats
	const stageTimings: Record<string, LatencyStats> = {};
	for (const [k, v] of Object.entries(stageDurations)) {
		stageTimings[k] = calcStats(v);
	}

	const v3ByEventType: Record<string, LatencyStats> = {};
	for (const [k, v] of Object.entries(v3TypeDurations)) {
		v3ByEventType[k] = calcStats(v);
	}

	const transcriptByEventType: Record<string, LatencyStats> = {};
	for (const [k, v] of Object.entries(transcriptTypeDurations)) {
		transcriptByEventType[k] = calcStats(v);
	}

	store.dispose();

	return {
		stageTimings,
		v3ByEventType,
		transcriptByEventType,
		cacheTimings: {
			saveSessionThrottled: calcStats(cacheDurations.saveSessionThrottled),
			flush: calcStats(cacheDurations.flush),
			evictOverflow: calcStats(cacheDurations.evictOverflow),
		},
		totalPumpMs,
		frameCount,
	};
}

// ---------------------------------------------------------------------------
// Multi-run aggregator
// ---------------------------------------------------------------------------
async function benchmarkSuite(
	sessionGen: () => GeneratedSession,
	runs: number = 5,
	fillCache: boolean = true,
): Promise<SuiteBenchmarkResult> {
	const allResults: BenchmarkRunResult[] = [];
	for (let r = 0; r < runs; r++) {
		const session = sessionGen();
		const result = await runSessionBenchmark(session, fillCache);
		allResults.push(result);
	}

	// Aggregate median of stats
	const stageKeys = Object.keys(allResults[0]!.stageTimings);
	const stageTimings: Record<string, LatencyStats> = {};
	for (const key of stageKeys) {
		stageTimings[key] = medianStats(allResults.map(r => r.stageTimings[key]!));
	}

	const v3KeySet = new Set(allResults.flatMap(r => Object.keys(r.v3ByEventType)));
	const v3Keys = Array.from(v3KeySet);
	const v3ByEventType: Record<string, LatencyStats> = {};
	for (const key of v3Keys) {
		v3ByEventType[key] = medianStats(allResults.map(r => r.v3ByEventType[key] ?? calcStats([])));
	}

	const transcriptKeySet = new Set(allResults.flatMap(r => Object.keys(r.transcriptByEventType)));
	const transcriptKeys = Array.from(transcriptKeySet);
	const transcriptByEventType: Record<string, LatencyStats> = {};
	for (const key of transcriptKeys) {
		transcriptByEventType[key] = medianStats(allResults.map(r => r.transcriptByEventType[key] ?? calcStats([])));
	}

	return {
		stageTimings,
		v3ByEventType,
		transcriptByEventType,
		cacheTimings: {
			saveSessionThrottled: medianStats(allResults.map(r => r.cacheTimings.saveSessionThrottled)),
			flush: medianStats(allResults.map(r => r.cacheTimings.flush)),
		},
		totalPumpMs: computeMedian(allResults.map(r => r.totalPumpMs)),
		frameCount: allResults[0]!.frameCount,
	};
}

async function main(): Promise<void> {
	console.log("=== HEADLESS SESSION STORE BENCHMARK ===");
	console.log("Environment: Bun, happy-dom, fake-indexeddb");
	console.log("Runs per configuration: 5 (reporting median)\n");

	// 1. PRESETS: small, long, huge
	console.log(">>> Running PRESETS benchmarks...");
	const presetConfigs = [
		{ name: "small (10 entries)", opts: PRESETS.small },
		{ name: "long (150 entries)", opts: PRESETS.long },
		{ name: "huge (2000 entries)", opts: PRESETS.huge },
	];

	const presetResults: Record<string, SuiteBenchmarkResult> = {};
	for (const p of presetConfigs) {
		console.log(`Running preset ${p.name}...`);
		const res = await benchmarkSuite(() => generateSession(p.opts), 5, true);
		presetResults[p.name] = res;
		console.log(`  Done: frames=${res.frameCount}, totalPumpMs=${res.totalPumpMs.toFixed(2)}ms`);
	}

	// 2. Scaling sweep: entries = 250, 500, 1000, 2000, 4000
	console.log("\n>>> Running SCALING SWEEP (entries = 250, 500, 1000, 2000, 4000)...");
	const sweepEntries = [250, 500, 1000, 2000, 4000];
	const sweepResults: Record<number, SuiteBenchmarkResult> = {};

	for (const entries of sweepEntries) {
		console.log(`Running scaling sweep entries=${entries}...`);
		const opts: GenerateSessionOptions = {
			entries,
			assistantChars: 2000,
			deltaChars: 256,
			toolOutputChunks: 10,
			toolChunkChars: 150,
			subagents: 4,
			seed: 5000 + entries,
		};
		const res = await benchmarkSuite(() => generateSession(opts), 5, true);
		sweepResults[entries] = res;
		console.log(`  Done: frames=${res.frameCount}, totalPumpMs=${res.totalPumpMs.toFixed(2)}ms`);
	}

	// 3. Format & print JSON results for parsing
	console.log("\n=== BENCHMARK COMPLETE ===");
	const finalOutput = {
		presets: presetResults,
		sweep: sweepResults,
	};
	console.log(JSON.stringify(finalOutput, null, 2));
}

main().catch(err => {
	console.error("Benchmark execution error:", err);
	process.exit(1);
});
