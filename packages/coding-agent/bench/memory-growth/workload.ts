/**
 * Profile-driven workload model for the memory-growth bench: loads the session
 * profile, samples per-turn / per-subagent plans with a seeded RNG, and writes
 * the temp-cwd fixtures the planned tool calls operate on.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as zlib from "node:zlib";

export interface Dist {
	n: number;
	p50: number;
	p90: number;
	max: number;
	mean: number;
}

export interface ToolProfile {
	callsPerTurn: Dist;
	resultBytes: Dist;
	argBytes: Dist;
}

export interface WorkloadProfile {
	targetTurns?: number;
	sessionTurns: Dist;
	turn: {
		requests: Dist;
		toolCalls: Dist;
		textBytesPerRequest: Dist;
		thinkingBytesPerRequest: Dist;
	};
	tools: Record<string, ToolProfile>;
	subagents: {
		taskCallsPerTurn: number;
		tasksPerCall: Dist;
		sessionsPerParent: Dist;
		requests: Dist;
		toolCalls: Dist;
	};
	imagesPerTurn: number;
}

interface ProfileFile extends WorkloadProfile {
	cohorts?: Record<string, WorkloadProfile>;
}

export const DEFAULT_PROFILE_PATH = path.join(import.meta.dir, "session-profile.json");

/** `median` / `heavy` select a cohort of the bundled profile; anything else is a profile JSON path. */
export async function loadProfile(spec: string): Promise<{ name: string; profile: WorkloadProfile }> {
	const isCohort = spec === "median" || spec === "heavy";
	const file = (await Bun.file(isCohort ? DEFAULT_PROFILE_PATH : path.resolve(spec)).json()) as ProfileFile;
	if (isCohort) {
		const cohort = file.cohorts?.[spec];
		if (!cohort) throw new Error(`profile ${DEFAULT_PROFILE_PATH} has no cohort ${spec}`);
		return { name: spec, profile: cohort };
	}
	return { name: spec, profile: file };
}

// ─── RNG ─────────────────────────────────────────────────────────────────────

export class Rng {
	#state: number;

	constructor(seed: number) {
		this.#state = seed >>> 0 || 0x9e3779b9;
	}

	/** Independent stream derived from `seed` and a label (turn, subagent id). */
	static derive(seed: number, label: string): Rng {
		return new Rng(Number(Bun.hash.wyhash(`${seed}:${label}`) & 0xffffffffn));
	}

	/** mulberry32 */
	next(): number {
		this.#state = (this.#state + 0x6d2b79f5) >>> 0;
		let t = this.#state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	int(maxExclusive: number): number {
		return Math.floor(this.next() * maxExclusive);
	}

	/**
	 * Log-normal fitted to the distribution's p50 and p90, clamped to [min, max].
	 * A zero median falls back to the mean so sparse distributions still sample.
	 */
	sample(d: Dist, min = 0, cap = Number.POSITIVE_INFINITY): number {
		const median = d.p50 > 0 ? d.p50 : d.mean;
		if (!(median > 0)) return min;
		const sigma = d.p90 > median ? Math.log(d.p90 / median) / 1.2816 : 0.25;
		const u1 = Math.max(this.next(), 1e-12);
		const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * this.next());
		const v = median * Math.exp(sigma * z);
		return Math.max(min, Math.min(d.max > 0 ? d.max : v, cap, v));
	}
}

// ─── Plans ───────────────────────────────────────────────────────────────────

/** Tools the mock can drive for real in an isolated temp cwd. `find` maps to `glob`. */
export const SUPPORTED_TOOLS = ["bash", "read", "grep", "edit", "eval", "write", "todo", "glob"] as const;
export type SupportedTool = (typeof SUPPORTED_TOOLS)[number];

/** Recorded tools the bench does not reproduce (network, interactive, harness-specific). */
export const SKIPPED_TOOLS = ["hub", "think", "web_search", "ask"];

export interface PlannedCall {
	tool: SupportedTool | "task" | "image";
	/** Target tool-result bytes. */
	resultBytes: number;
	/** Target argument bytes (edit/write/eval/task payloads). */
	argBytes: number;
	/** task: number of subagents in the call. */
	tasks?: number;
}

export interface PlannedRequest {
	textBytes: number;
	thinkingBytes: number;
	calls: PlannedCall[];
}

export interface PlanLimits {
	maxRequestsPerTurn: number;
	maxSubagentRequests: number;
	maxTasksPerCall: number;
	subagents: boolean;
	images: boolean;
}

function toolWeights(profile: WorkloadProfile, exclude: string[]): Array<[SupportedTool, number]> {
	const weights: Array<[SupportedTool, number]> = [];
	for (const tool of SUPPORTED_TOOLS) {
		if (exclude.includes(tool)) continue;
		let w = profile.tools[tool]?.callsPerTurn.mean ?? 0;
		if (tool === "glob") w += profile.tools.find?.callsPerTurn.mean ?? 0;
		if (w > 0) weights.push([tool, w]);
	}
	return weights;
}

function pickTool(rng: Rng, weights: Array<[SupportedTool, number]>): SupportedTool {
	const total = weights.reduce((a, [, w]) => a + w, 0);
	let r = rng.next() * total;
	for (const [tool, w] of weights) {
		r -= w;
		if (r <= 0) return tool;
	}
	return weights[weights.length - 1]![0];
}

function plannedCall(rng: Rng, profile: WorkloadProfile, tool: SupportedTool): PlannedCall {
	const tp = profile.tools[tool] ?? profile.tools.find;
	return {
		tool,
		resultBytes: Math.round(tp ? rng.sample(tp.resultBytes, 16, 160_000) : 512),
		argBytes: Math.round(tp ? rng.sample(tp.argBytes, 16, 16_000) : 128),
	};
}

function textAndThinking(rng: Rng, profile: WorkloadProfile): { textBytes: number; thinkingBytes: number } {
	const t = profile.turn;
	return {
		textBytes: Math.round(rng.sample(t.textBytesPerRequest, 40, 16_000)),
		thinkingBytes:
			t.thinkingBytesPerRequest.p90 > 0 ? Math.round(rng.sample(t.thinkingBytesPerRequest, 0, 16_000)) : 0,
	};
}

/** Turns (1-based) that get a task call / an image read, spread over the run at the profile's per-turn rates. */
export interface FeatureSchedule {
	taskTurns: Set<number>;
	imageTurns: Set<number>;
}

/**
 * Session-level placement: expected count = rate x turns (at least one when the rate is non-zero),
 * evenly spaced with seeded jitter. Per-turn coin flips leave whole runs without subagents.
 */
export function scheduleFeatures(seed: number, profile: WorkloadProfile, turns: number): FeatureSchedule {
	const place = (label: string, rate: number): Set<number> => {
		const rng = Rng.derive(seed, `schedule:${label}`);
		const count = rate > 0 ? Math.min(turns, Math.max(1, Math.round(rate * turns))) : 0;
		const out = new Set<number>();
		for (let k = 0; k < count; k++) {
			const lo = Math.floor((k * turns) / count);
			const hi = Math.max(lo + 1, Math.floor(((k + 1) * turns) / count));
			out.add(1 + lo + rng.int(hi - lo));
		}
		return out;
	};
	// Recorded subagent transcripts per parent exceed task calls x tasks per call (advisor and
	// other spawns also write transcripts), so size the task calls to the transcript rate.
	const sp = profile.subagents;
	const subagentsPerTurn = sp.sessionsPerParent.mean / Math.max(1, profile.sessionTurns.mean);
	const taskCallsPerTurn = Math.max(sp.taskCallsPerTurn, subagentsPerTurn / Math.max(1, sp.tasksPerCall.mean));
	return {
		taskTurns: place("task", taskCallsPerTurn),
		imageTurns: place("image", profile.imagesPerTurn),
	};
}

/** One user turn: N requests, tool calls spread over all but the last, final request text-only. */
export function planTurn(
	rng: Rng,
	profile: WorkloadProfile,
	limits: PlanLimits,
	features: { task: boolean; image: boolean },
): PlannedRequest[] {
	const requests = Math.round(rng.sample(profile.turn.requests, 1, limits.maxRequestsPerTurn));
	const toolRequests = requests - 1;
	const plan: PlannedRequest[] = [];
	for (let i = 0; i < requests; i++) plan.push({ ...textAndThinking(rng, profile), calls: [] });
	if (toolRequests > 0) {
		const totalCalls = Math.max(toolRequests, Math.round(rng.sample(profile.turn.toolCalls, 1, toolRequests * 6)));
		const weights = toolWeights(profile, []);
		for (let i = 0; i < totalCalls; i++) {
			const slot = i < toolRequests ? i : rng.int(toolRequests);
			plan[slot]!.calls.push(plannedCall(rng, profile, pickTool(rng, weights)));
		}
	}
	// Optional features draw from their own stream, so ablations keep the same base plan.
	const extras = new Rng(Math.floor(rng.next() * 2 ** 32));
	const tasks = Math.round(extras.sample(profile.subagents.tasksPerCall, 1, limits.maxTasksPerCall));
	const taskArgBytes = profile.tools.task ? extras.sample(profile.tools.task.argBytes, 512, 16_000) : 4000;
	const taskPick = extras.next();
	const imagePick = extras.next();
	const wantTask = limits.subagents && features.task;
	const wantImage = limits.images && features.image;
	if ((wantTask || wantImage) && toolRequests === 0) plan.unshift({ ...textAndThinking(extras, profile), calls: [] });
	const slots = plan.length - 1;
	if (wantTask) {
		plan[Math.floor(taskPick * slots)]!.calls.push({
			tool: "task",
			tasks,
			resultBytes: 0,
			argBytes: Math.round(taskArgBytes),
		});
	}
	if (wantImage) plan[Math.floor(imagePick * slots)]!.calls.push({ tool: "image", resultBytes: 0, argBytes: 0 });
	return plan;
}

/** A subagent conversation: tool requests then a final `yield`. */
export function planSubagent(rng: Rng, profile: WorkloadProfile, limits: PlanLimits): PlannedRequest[] {
	const sp = profile.subagents;
	const requests = Math.round(rng.sample(sp.requests, 2, limits.maxSubagentRequests));
	const callsPerRequest = Math.max(1, sp.toolCalls.p50 / Math.max(1, sp.requests.p50));
	const weights = toolWeights(profile, ["todo"]);
	const plan: PlannedRequest[] = [];
	for (let i = 0; i < requests - 1; i++) {
		const n = Math.max(1, Math.round(callsPerRequest + (rng.next() - 0.5)));
		const calls: PlannedCall[] = [];
		for (let k = 0; k < n; k++) calls.push(plannedCall(rng, profile, pickTool(rng, weights)));
		plan.push({ ...textAndThinking(rng, profile), calls });
	}
	plan.push({ ...textAndThinking(rng, profile), calls: [] });
	return plan;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const GREP_BUCKETS = 13;
const GREP_LINES = 1 << GREP_BUCKETS;
const GREP_FILES = 16;
export const EDIT_TARGETS = 20;
export const IMAGE_COUNT = 4;

const WORDS = [
	"buffer",
	"render",
	"session",
	"token",
	"stream",
	"module",
	"retain",
	"heap",
	"closure",
	"layout",
	"event",
	"cache",
	"diff",
	"widget",
	"frame",
	"queue",
];

export function words(seed: number, count: number): string {
	const out: string[] = [];
	for (let i = 0; i < count; i++) out.push(WORDS[(seed * 31 + i * 7 + (i >> 3)) % WORDS.length]!);
	return out.join(" ");
}

/** Text of roughly `bytes` bytes made of numbered lines. */
export function textOfSize(bytes: number, seed: number, prefix = "line"): string {
	const lines: string[] = [];
	let n = 0;
	for (let i = 0; n < bytes; i++) {
		const line = `${prefix} ${seed}.${i}: ${words(seed + i, 9)}`;
		lines.push(line);
		n += line.length + 1;
	}
	return lines.join("\n");
}

/** Read-pool file sizes: geometric 256 B .. ~190 KB. */
export const READ_SIZES: number[] = Array.from({ length: 17 }, (_, k) => Math.round(256 * 1.5 ** k));

function crc32(data: Uint8Array): number {
	return Bun.hash.crc32(data) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

/** Screenshot-like PNG (gradient + noise) so image payloads have realistic size. */
function makePng(width: number, height: number, seed: number): Uint8Array {
	const rng = new Rng(seed);
	const raw = new Uint8Array((width * 3 + 1) * height);
	for (let y = 0; y < height; y++) {
		const row = y * (width * 3 + 1);
		for (let x = 0; x < width; x++) {
			const o = row + 1 + x * 3;
			const band = ((x >> 6) + (y >> 5)) % 4 === 0;
			const noise = rng.int(6);
			raw[o] = band ? 240 : (x * 255) / width + noise;
			raw[o + 1] = band ? 240 : (y * 255) / height + noise;
			raw[o + 2] = band ? 250 : 128 + noise;
		}
	}
	const ihdr = new Uint8Array(13);
	const v = new DataView(ihdr.buffer);
	v.setUint32(0, width);
	v.setUint32(4, height);
	ihdr.set([8, 2, 0, 0, 0], 8);
	const parts = [
		new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
		pngChunk("IHDR", ihdr),
		pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
		pngChunk("IEND", new Uint8Array(0)),
	];
	const total = parts.reduce((a, p) => a + p.length, 0);
	const out = new Uint8Array(total);
	let off = 0;
	for (const p of parts) {
		out.set(p, off);
		off += p.length;
	}
	return out;
}

export async function writeFixtures(cwd: string): Promise<void> {
	for (const dir of ["data/read", "data/grep", "data/img", "src", "work"]) {
		await fs.mkdir(path.join(cwd, dir), { recursive: true });
	}
	await Bun.write(path.join(cwd, "data/corpus.txt"), textOfSize(400_000, 1, "out"));
	for (const size of READ_SIZES) {
		await Bun.write(path.join(cwd, `data/read/r-${size}.txt`), textOfSize(size, size));
	}
	// Bucket b matches 2^b lines across the grep corpus (token `mk<b>_`).
	const perFile = GREP_LINES / GREP_FILES;
	for (let f = 0; f < GREP_FILES; f++) {
		const lines: string[] = [];
		for (let i = 0; i < perFile; i++) {
			const j = f * perFile + i;
			const tags: string[] = [];
			for (let b = 0; b < GREP_BUCKETS; b++) if (j % (GREP_LINES >> b) === 0) tags.push(`mk${b}_`);
			lines.push(`${String(j).padStart(5, "0")} ${tags.join(" ")} ${words(j, 10)}`);
		}
		await Bun.write(path.join(cwd, `data/grep/g-${f}.txt`), lines.join("\n"));
	}
	for (let i = 0; i < EDIT_TARGETS * 2; i++) {
		const name = i < EDIT_TARGETS ? `e${i}` : `s${i - EDIT_TARGETS}`;
		const body = Array.from({ length: 60 }, (_, k) => `export const ${name}_${k} = ${k}; // ${words(i + k, 6)}`);
		await Bun.write(path.join(cwd, `src/${name}.ts`), `${body.join("\n")}\n`);
	}
	for (let i = 0; i < IMAGE_COUNT; i++) {
		await Bun.write(path.join(cwd, `data/img/shot-${i}.png`), makePng(1280, 800, 1000 + i));
	}
}
