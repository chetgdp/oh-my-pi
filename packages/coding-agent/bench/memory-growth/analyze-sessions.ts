/**
 * Read-only aggregate profile of past omp sessions, used to drive the
 * memory-growth bench workload. Never prints message content; emits sizes,
 * counts and percentiles only.
 *
 * Usage: bun packages/coding-agent/bench/memory-growth/analyze-sessions.ts <sessionDir>... [--out file.json]
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface ContentBlock {
	type: string;
	text?: string;
	thinking?: string;
	data?: string;
	name?: string;
	arguments?: Record<string, unknown>;
}

interface Entry {
	type: string;
	message?: {
		role: string;
		content?: string | ContentBlock[];
		toolName?: string;
		usage?: { output?: number };
	};
	summary?: string;
}

/** Per user turn: one user prompt and everything until the next prompt. */
interface TurnStat {
	requests: number;
	toolCalls: Record<string, number>;
	textBytes: number;
	thinkingBytes: number;
	outputTokens: number;
}

interface SessionStat {
	file: string;
	bytes: number;
	turns: TurnStat[];
	compactions: number;
	firstCompactionTurn: number | undefined;
	images: number;
	toolResultBytes: Record<string, number[]>;
	toolArgBytes: Record<string, number[]>;
	taskCalls: number;
	tasksPerCall: number[];
	subagents: Array<{ bytes: number; requests: number; toolCalls: number }>;
	bytesByCategory: Record<string, number>;
}

const blockBytes = (b: ContentBlock): number =>
	(b.text?.length ?? 0) + (b.thinking?.length ?? 0) + (b.data?.length ?? 0);

function contentBytes(content: string | ContentBlock[] | undefined): number {
	if (content === undefined) return 0;
	if (typeof content === "string") return content.length;
	let n = 0;
	for (const b of content) n += blockBytes(b);
	return n;
}

function countImages(content: string | ContentBlock[] | undefined): number {
	return Array.isArray(content) ? content.filter(b => b.type === "image").length : 0;
}

async function parseLines(file: string): Promise<{ bytes: number; entries: Array<{ entry: Entry; size: number }> }> {
	const text = await Bun.file(file).text();
	const entries: Array<{ entry: Entry; size: number }> = [];
	for (const line of text.split("\n")) {
		if (!line) continue;
		try {
			entries.push({ entry: JSON.parse(line) as Entry, size: line.length });
		} catch {}
	}
	return { bytes: text.length, entries };
}

async function subagentStats(file: string): Promise<{ bytes: number; requests: number; toolCalls: number }> {
	const { bytes, entries } = await parseLines(file);
	let requests = 0;
	let toolCalls = 0;
	for (const { entry } of entries) {
		const m = entry.message;
		if (entry.type !== "message" || m?.role !== "assistant") continue;
		requests++;
		if (Array.isArray(m.content)) toolCalls += m.content.filter(b => b.type === "toolCall").length;
	}
	return { bytes, requests, toolCalls };
}

async function analyzeSession(file: string): Promise<SessionStat> {
	const { bytes, entries } = await parseLines(file);
	const s: SessionStat = {
		file,
		bytes,
		turns: [],
		compactions: 0,
		firstCompactionTurn: undefined,
		images: 0,
		toolResultBytes: {},
		toolArgBytes: {},
		taskCalls: 0,
		tasksPerCall: [],
		subagents: [],
		bytesByCategory: {},
	};
	const addCat = (k: string, n: number): void => {
		s.bytesByCategory[k] = (s.bytesByCategory[k] ?? 0) + n;
	};
	let turn: TurnStat | undefined;
	for (const { entry, size } of entries) {
		const m = entry.message;
		if (entry.type === "compaction") {
			s.compactions++;
			s.firstCompactionTurn ??= s.turns.length;
			addCat("compaction", size);
			continue;
		}
		if (entry.type !== "message" || !m) {
			addCat(`entry:${entry.type}`, size);
			continue;
		}
		s.images += countImages(m.content);
		if (m.role === "user") {
			turn = { requests: 0, toolCalls: {}, textBytes: 0, thinkingBytes: 0, outputTokens: 0 };
			s.turns.push(turn);
			addCat("user", size);
		} else if (m.role === "assistant") {
			if (!turn) continue;
			turn.requests++;
			turn.outputTokens += m.usage?.output ?? 0;
			for (const b of Array.isArray(m.content) ? m.content : []) {
				if (b.type === "text") turn.textBytes += b.text?.length ?? 0;
				else if (b.type === "thinking") turn.thinkingBytes += b.thinking?.length ?? 0;
				else if (b.type === "toolCall" && b.name) {
					turn.toolCalls[b.name] = (turn.toolCalls[b.name] ?? 0) + 1;
					(s.toolArgBytes[b.name] ??= []).push(JSON.stringify(b.arguments ?? {}).length);
					if (b.name === "task") {
						s.taskCalls++;
						const tasks = b.arguments?.tasks;
						s.tasksPerCall.push(Array.isArray(tasks) ? tasks.length : 1);
					}
				}
			}
			addCat("assistant", size);
		} else if (m.role === "toolResult") {
			const name = m.toolName ?? "unknown";
			(s.toolResultBytes[name] ??= []).push(contentBytes(m.content));
			addCat(`toolResult:${name}`, size);
		} else addCat(`message:${m.role}`, size);
	}
	const artifactsDir = file.slice(0, -".jsonl".length);
	const children = await fs.readdir(artifactsDir).catch(() => [] as string[]);
	for (const child of children) {
		if (child.endsWith(".jsonl")) s.subagents.push(await subagentStats(path.join(artifactsDir, child)));
	}
	return s;
}

function pct(values: number[]): { n: number; p50: number; p90: number; max: number; mean: number } {
	if (values.length === 0) return { n: 0, p50: 0, p90: 0, max: 0, mean: 0 };
	const v = [...values].sort((a, b) => a - b);
	const at = (q: number): number => v[Math.min(v.length - 1, Math.floor(q * v.length))]!;
	return {
		n: v.length,
		p50: at(0.5),
		p90: at(0.9),
		max: v[v.length - 1]!,
		mean: v.reduce((a, b) => a + b, 0) / v.length,
	};
}

/** Workload distributions for one set of sessions; the bench samples these. */
function workload(used: SessionStat[]): Record<string, unknown> {
	const allTurns = used.flatMap(s => s.turns);
	const toolNames = new Set<string>();
	for (const t of allTurns) for (const k of Object.keys(t.toolCalls)) toolNames.add(k);
	const tools: Record<string, unknown> = {};
	for (const name of toolNames) {
		const perTurn = allTurns.map(t => t.toolCalls[name] ?? 0);
		tools[name] = {
			callsPerTurn: pct(perTurn),
			turnsUsingFraction: perTurn.filter(n => n > 0).length / allTurns.length,
			sessionsUsingFraction: used.filter(s => s.turns.some(t => (t.toolCalls[name] ?? 0) > 0)).length / used.length,
			resultBytes: pct(used.flatMap(s => s.toolResultBytes[name] ?? [])),
			argBytes: pct(used.flatMap(s => s.toolArgBytes[name] ?? [])),
		};
	}
	const subs = used.flatMap(s => s.subagents);
	const images = used.reduce((a, s) => a + s.images, 0);
	return {
		sessions: used.length,
		sessionTurns: pct(used.map(s => s.turns.length)),
		sessionBytes: pct(used.map(s => s.bytes)),
		turn: {
			requests: pct(allTurns.map(t => t.requests)),
			toolCalls: pct(allTurns.map(t => Object.values(t.toolCalls).reduce((a, b) => a + b, 0))),
			textBytesPerRequest: pct(allTurns.filter(t => t.requests > 0).map(t => t.textBytes / t.requests)),
			thinkingBytesPerRequest: pct(allTurns.filter(t => t.requests > 0).map(t => t.thinkingBytes / t.requests)),
			outputTokens: pct(allTurns.map(t => t.outputTokens)),
		},
		tools,
		subagents: {
			taskCallsPerSession: pct(used.map(s => s.taskCalls)),
			taskCallsPerTurn: allTurns.length === 0 ? 0 : used.reduce((a, s) => a + s.taskCalls, 0) / allTurns.length,
			tasksPerCall: pct(used.flatMap(s => s.tasksPerCall)),
			sessionsPerParent: pct(used.map(s => s.subagents.length)),
			bytes: pct(subs.map(s => s.bytes)),
			requests: pct(subs.map(s => s.requests)),
			toolCalls: pct(subs.map(s => s.toolCalls)),
		},
		compaction: {
			perSession: pct(used.map(s => s.compactions)),
			sessionsWithCompactionFraction: used.filter(s => s.compactions > 0).length / used.length,
			firstCompactionTurn: pct(
				used.flatMap(s => (s.firstCompactionTurn === undefined ? [] : [s.firstCompactionTurn])),
			),
		},
		imagesPerSession: pct(used.map(s => s.images)),
		imagesPerTurn: allTurns.length === 0 ? 0 : images / allTurns.length,
	};
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const outIdx = args.indexOf("--out");
	const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : undefined;
	const sessions: SessionStat[] = [];
	for (const dir of args) {
		for (const f of await fs.readdir(dir)) {
			if (f.endsWith(".jsonl")) sessions.push(await analyzeSession(path.join(dir, f)));
		}
	}
	const used = sessions.filter(s => s.turns.length > 0);
	const largest = [...used]
		.sort((a, b) => b.bytes - a.bytes)
		.slice(0, 10)
		.map(s => ({
			file: path.basename(s.file),
			bytes: s.bytes,
			turns: s.turns.length,
			subagentBytes: s.subagents.reduce((a, b) => a + b.bytes, 0),
			topCategories: Object.entries(s.bytesByCategory)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([k, v]) => ({ category: k, bytes: v, fraction: v / s.bytes })),
		}));
	const sessionTurns = pct(used.map(s => s.turns.length));
	const turnsSorted = used.map(s => s.turns.length).sort((a, b) => a - b);
	const p25 = turnsSorted[Math.floor(0.25 * turnsSorted.length)] ?? 0;
	const p75 = turnsSorted[Math.floor(0.75 * turnsSorted.length)] ?? 0;
	const pickNear = (target: number): SessionStat =>
		[...used].sort((a, b) => Math.abs(a.turns.length - target) - Math.abs(b.turns.length - target))[0]!;
	const representative = (s: SessionStat): Record<string, unknown> => ({
		file: path.basename(s.file),
		bytes: s.bytes,
		turns: s.turns.length,
		requests: s.turns.reduce((a, t) => a + t.requests, 0),
		compactions: s.compactions,
		firstCompactionTurn: s.firstCompactionTurn,
		taskCalls: s.taskCalls,
		subagents: s.subagents.length,
	});
	const profile = {
		generatedAt: new Date().toISOString(),
		sessionDirs: args.map(d => path.basename(d)),
		emptySessions: sessions.length - used.length,
		...workload(used),
		largest,
		representative: {
			median: representative(pickNear(sessionTurns.p50)),
			heavy: representative(pickNear(sessionTurns.p90)),
		},
		/** Per-turn distributions from median (p25..p75 turns) and heavy (> p75 turns) sessions; run length p50 / p90. */
		cohorts: {
			median: {
				targetTurns: sessionTurns.p50,
				turnRange: [p25, p75],
				...workload(used.filter(s => s.turns.length >= p25 && s.turns.length <= p75)),
			},
			heavy: {
				targetTurns: sessionTurns.p90,
				turnRange: [p75 + 1, sessionTurns.max],
				...workload(used.filter(s => s.turns.length > p75)),
			},
		},
	};
	const json = JSON.stringify(profile, null, 2);
	if (out) await Bun.write(out, json);
	else process.stdout.write(json);
}

await main();
