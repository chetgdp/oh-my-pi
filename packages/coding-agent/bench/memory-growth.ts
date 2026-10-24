/**
 * Memory-growth harness for an interactive omp TUI session.
 *
 * Launches the real TUI in a PTY against a scripted OpenAI-compatible mock
 * server (no network, no real LLM) and drives user turns whose shape is sampled
 * (seeded) from a profile of recorded sessions (memory-growth/session-profile.json,
 * produced by memory-growth/analyze-sessions.ts): requests per turn, tool mix and
 * result sizes, edits against real hashline tags, eval, todo, images, and
 * subagents (task + wait) whose own model requests the mock also scripts.
 * At checkpoints it records `footprint` breakdown, RSS, child process
 * footprint, and (unless --no-inspect) loaded script count and JSC heap
 * snapshot class aggregation via the WebKit inspector.
 *
 * Isolation: HOME and PI_CODING_AGENT_DIR point into a temp dir, so the user's
 * ~/.omp config, sessions, credentials, extensions and skills are never read
 * or written.
 *
 * Usage: bun packages/coding-agent/bench/memory-growth.ts --help
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { MAIN_MARKER, MODEL_ID, MockServer, type MockStats } from "./memory-growth/mock-server";
import {
	loadProfile,
	type PlanLimits,
	planTurn,
	Rng,
	scheduleFeatures,
	words,
	writeFixtures,
} from "./memory-growth/workload";

interface Options {
	/** Defaults to the profile's target session length. */
	turns: number | undefined;
	/** Defaults to ~25% of the run. */
	checkpointEvery: number | undefined;
	out: string;
	binary: boolean;
	keepSnapshots: boolean;
	profile: string;
	seed: number;
	inspect: boolean;
	subagents: boolean;
	images: boolean;
	contextWindow: number;
	maxMinutes: number;
	maxRequestsPerTurn: number;
	maxSubagentRequests: number;
	maxTasksPerCall: number;
	turnTimeoutSec: number;
	lingerMinutes: number;
	lingerEverySec: number;
	agentIdleTtlMs: number | undefined;
}

const USAGE = `Usage: bun packages/coding-agent/bench/memory-growth.ts [options]
  --profile median|heavy|<file.json>  workload profile (default median; see memory-growth/session-profile.json)
  --turns N                 user turns (default: profile target session length)
  --checkpoint-every K      checkpoint cadence in turns (default: ~25% of the run)
  --seed N                  RNG seed for the scripted workload (default 1)
  --out DIR                 report directory (default $TMPDIR/omp-memgrowth)
  --no-inspect              footprint-only; no inspector, heap snapshots or forced GC
  --no-subagents            drop task/subagent work from the workload
  --no-images               drop image reads from the workload
  --context-window N        mock model context window in tokens (default 1000000; smaller forces auto-compaction)
  --max-minutes M           stop starting turns after M minutes (default 25, 0 = no cap)
  --max-requests-per-turn N cap sampled requests per user turn (default 60)
  --max-subagent-requests N cap sampled requests per subagent (default 120)
  --max-tasks-per-call N    cap subagents per task call (default 4)
  --turn-timeout S          per-turn timeout in seconds (default 1200)
  --binary                  launch ~/.bun/bin/omp instead of source
  --keep-snapshots          keep heap snapshots under DIR/snapshots
  --linger-minutes M        after the last turn keep the TUI idle M minutes, sampling (default 0)
  --linger-every S          linger sampling interval in seconds (default 30)
  --agent-idle-ttl-ms N     write task.agentIdleTtlMs N into the isolated config (default: omp default)`;

function parseOptions(argv: string[]): Options {
	const opts: Options = {
		turns: undefined,
		checkpointEvery: undefined,
		out: path.join(os.tmpdir(), "omp-memgrowth"),
		binary: false,
		keepSnapshots: false,
		profile: "median",
		seed: 1,
		inspect: true,
		subagents: true,
		images: true,
		contextWindow: 1_000_000,
		maxMinutes: 25,
		maxRequestsPerTurn: 60,
		maxSubagentRequests: 120,
		maxTasksPerCall: 4,
		turnTimeoutSec: 1200,
		lingerMinutes: 0,
		lingerEverySec: 30,
		agentIdleTtlMs: undefined,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = (): string => {
			const v = argv[++i];
			if (v === undefined) throw new Error(`${arg} requires a value`);
			return v;
		};
		const int = (): number => {
			const n = Number.parseInt(next(), 10);
			if (!Number.isFinite(n) || n < 0) throw new Error(`${arg} requires a non-negative integer`);
			return n;
		};
		switch (arg) {
			case "--turns":
				opts.turns = int();
				break;
			case "--checkpoint-every":
				opts.checkpointEvery = int();
				break;
			case "--out":
				opts.out = path.resolve(next());
				break;
			case "--binary":
				opts.binary = true;
				break;
			case "--keep-snapshots":
				opts.keepSnapshots = true;
				break;
			case "--profile":
				opts.profile = next();
				break;
			case "--seed":
				opts.seed = int();
				break;
			case "--no-inspect":
				opts.inspect = false;
				break;
			case "--no-subagents":
				opts.subagents = false;
				break;
			case "--no-images":
				opts.images = false;
				break;
			case "--context-window":
				opts.contextWindow = int();
				break;
			case "--max-minutes":
				opts.maxMinutes = int();
				break;
			case "--max-requests-per-turn":
				opts.maxRequestsPerTurn = int();
				break;
			case "--max-subagent-requests":
				opts.maxSubagentRequests = int();
				break;
			case "--max-tasks-per-call":
				opts.maxTasksPerCall = int();
				break;
			case "--turn-timeout":
				opts.turnTimeoutSec = int();
				break;
			case "--linger-minutes":
				opts.lingerMinutes = int();
				break;
			case "--linger-every":
				opts.lingerEverySec = Math.max(1, int());
				break;
			case "--agent-idle-ttl-ms":
				opts.agentIdleTtlMs = int();
				break;
			case "--help":
				process.stdout.write(`${USAGE}\n`);
				process.exit(0);
				break;
			default:
				throw new Error(`Unknown argument: ${arg}\n${USAGE}`);
		}
	}
	if (opts.turns === 0 || opts.checkpointEvery === 0) throw new Error("--turns and --checkpoint-every must be > 0");
	return opts;
}

const log = (msg: string): void => {
	process.stderr.write(`[memgrowth ${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
};

// ─── WebKit inspector client ─────────────────────────────────────────────────

class Inspector {
	#ws: WebSocket;
	#nextId = 1;
	#pending = new Map<number, PromiseWithResolvers<Record<string, unknown>>>();
	#listeners = new Set<(method: string, params: Record<string, unknown>) => void>();

	private constructor(ws: WebSocket) {
		this.#ws = ws;
		ws.addEventListener("message", ev => {
			const msg = JSON.parse(String(ev.data)) as {
				id?: number;
				result?: Record<string, unknown>;
				error?: { message: string };
				method?: string;
				params?: Record<string, unknown>;
			};
			if (msg.id !== undefined) {
				const p = this.#pending.get(msg.id);
				if (!p) return;
				this.#pending.delete(msg.id);
				if (msg.error) p.reject(new Error(msg.error.message));
				else p.resolve(msg.result ?? {});
			} else if (msg.method) {
				for (const l of this.#listeners) l(msg.method, msg.params ?? {});
			}
		});
		ws.addEventListener("close", () => {
			for (const p of this.#pending.values()) p.reject(new Error("inspector closed"));
			this.#pending.clear();
		});
	}

	static async connect(url: string, timeoutMs: number): Promise<Inspector> {
		const deadline = Date.now() + timeoutMs;
		let lastErr: unknown;
		while (Date.now() < deadline) {
			const ws = new WebSocket(url);
			const opened = Promise.withResolvers<void>();
			ws.addEventListener("open", () => opened.resolve());
			ws.addEventListener("error", () => opened.reject(new Error(`ws error connecting ${url}`)));
			try {
				await opened.promise;
				return new Inspector(ws);
			} catch (err) {
				lastErr = err;
				await Bun.sleep(250);
			}
		}
		throw lastErr instanceof Error ? lastErr : new Error(`inspector connect timeout ${url}`);
	}

	send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
		const id = this.#nextId++;
		const p = Promise.withResolvers<Record<string, unknown>>();
		this.#pending.set(id, p);
		this.#ws.send(JSON.stringify({ id, method, params }));
		return p.promise;
	}

	on(listener: (method: string, params: Record<string, unknown>) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	close(): void {
		this.#ws.close();
	}
}

// ─── Process sampling ────────────────────────────────────────────────────────

interface FootprintRow {
	dirty: number;
	reclaimable: number;
	regions: number;
}

interface Footprint {
	total: number;
	categories: Record<string, FootprintRow>;
}

const UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

function parseSize(n: string, unit: string): number {
	return Math.round(Number.parseFloat(n) * (UNITS[unit] ?? 1));
}

async function footprint(pid: number): Promise<Footprint | undefined> {
	const proc = Bun.spawn(["footprint", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	const categories: Record<string, FootprintRow> = {};
	let total = 0;
	const rowRe = /^\s*([\d.]+) (B|KB|MB|GB)\s+([\d.]+) (B|KB|MB|GB)\s+([\d.]+) (B|KB|MB|GB)\s+(\d+)\s+(.+?)\s*$/;
	for (const line of text.split("\n")) {
		const m = rowRe.exec(line);
		if (!m) continue;
		const row = { dirty: parseSize(m[1]!, m[2]!), reclaimable: parseSize(m[5]!, m[6]!), regions: Number(m[7]) };
		if (m[8] === "TOTAL") total = row.dirty;
		else categories[m[8]!] = row;
	}
	return total > 0 ? { total, categories } : undefined;
}

async function rssBytes(pid: number): Promise<number> {
	const proc = Bun.spawn(["ps", "-o", "rss=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return (Number.parseInt(text.trim(), 10) || 0) * 1024;
}

async function childPids(pid: number): Promise<number[]> {
	const proc = Bun.spawn(["pgrep", "-P", String(pid)], { stdout: "pipe", stderr: "ignore" });
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return text
		.split("\n")
		.map(s => Number.parseInt(s, 10))
		.filter(n => n > 0);
}

async function descendants(pid: number): Promise<number[]> {
	const out: number[] = [];
	const queue = [pid];
	while (queue.length > 0) {
		const kids = await childPids(queue.shift()!);
		out.push(...kids);
		queue.push(...kids);
	}
	return out;
}

async function commandOf(pid: number): Promise<string> {
	const proc = Bun.spawn(["ps", "-o", "command=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return text.trim().slice(0, 300);
}

// ─── Heap snapshot aggregation ───────────────────────────────────────────────

interface ClassStat {
	bytes: number;
	count: number;
}

interface HeapAggregate {
	totalBytes: number;
	totalNodes: number;
	classes: Record<string, ClassStat>;
}

function aggregateSnapshot(json: string): HeapAggregate {
	const snap = JSON.parse(json) as {
		nodes: number[];
		nodeClassNames: string[];
		nodeFields?: string[];
	};
	const stride = snap.nodeFields?.length ?? 4;
	const sizeIdx = snap.nodeFields ? snap.nodeFields.indexOf("size") : 1;
	const classIdx = snap.nodeFields ? snap.nodeFields.indexOf("classNameIndex") : 2;
	const bytes = new Float64Array(snap.nodeClassNames.length);
	const counts = new Uint32Array(snap.nodeClassNames.length);
	let totalBytes = 0;
	const nodes = snap.nodes;
	for (let i = 0; i < nodes.length; i += stride) {
		const c = nodes[i + classIdx]!;
		const s = nodes[i + sizeIdx]!;
		bytes[c]! += s;
		counts[c]!++;
		totalBytes += s;
	}
	const classes: Record<string, ClassStat> = {};
	for (let c = 0; c < snap.nodeClassNames.length; c++) {
		if (counts[c]! === 0) continue;
		const name = snap.nodeClassNames[c]!;
		const prev = classes[name];
		if (prev) {
			prev.bytes += bytes[c]!;
			prev.count += counts[c]!;
		} else classes[name] = { bytes: bytes[c]!, count: counts[c]! };
	}
	return { totalBytes, totalNodes: nodes.length / stride, classes };
}

// ─── PTY driver ──────────────────────────────────────────────────────────────

class PtySession {
	proc: Bun.Subprocess;
	#lastOutputAt = Date.now();
	#tail = "";
	totalOutput = 0;

	constructor(cmd: string[], cwd: string, env: Record<string, string>) {
		const decoder = new TextDecoder();
		this.proc = Bun.spawn(cmd, {
			cwd,
			env,
			terminal: {
				cols: 160,
				rows: 48,
				data: (_t, data) => {
					this.#lastOutputAt = Date.now();
					this.totalOutput += data.byteLength;
					this.#tail = (this.#tail + decoder.decode(data, { stream: true })).slice(-200_000);
				},
			},
		});
	}

	get pid(): number {
		return this.proc.pid;
	}

	/** Plain text of recent output with ANSI escapes stripped. */
	recentText(): string {
		return Bun.stripANSI(this.#tail);
	}

	write(text: string): void {
		this.proc.terminal!.write(text);
	}

	async waitFor(pred: () => boolean, timeoutMs: number, what: string): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (!pred()) {
			const exited = this.proc.exitCode !== null;
			if (exited || Date.now() > deadline) {
				const reason = exited ? `omp exited (${this.proc.exitCode}) while waiting for` : "timeout waiting for";
				throw new Error(`${reason} ${what}; output tail:\n${this.recentText().slice(-4000)}`);
			}
			await Bun.sleep(100);
		}
	}

	waitQuiet(quietMs: number, timeoutMs: number): Promise<void> {
		return this.waitFor(() => Date.now() - this.#lastOutputAt >= quietMs, timeoutMs, `${quietMs}ms of quiet output`);
	}
}

// ─── Checkpoints ─────────────────────────────────────────────────────────────

interface ChildSample {
	pid: number;
	command: string;
	footprint: number | undefined;
}

interface Checkpoint {
	turn: number;
	at: string;
	elapsedMs: number;
	footprint: Footprint | undefined;
	rss: number;
	children: ChildSample[];
	scriptCount: number | undefined;
	heap: HeapAggregate | undefined;
	snapshotMs: number | undefined;
	/** Cumulative mock workload counters at this checkpoint. */
	workload: MockStats;
}

async function countScripts(insp: Inspector): Promise<number> {
	const urls = new Set<string>();
	let lastEventAt = Date.now();
	const off = insp.on((method, params) => {
		if (method === "Debugger.scriptParsed") {
			urls.add(String(params.scriptId ?? params.url));
			lastEventAt = Date.now();
		}
	});
	await insp.send("Debugger.enable");
	while (Date.now() - lastEventAt < 500) await Bun.sleep(100);
	off();
	await insp.send("Debugger.disable");
	return urls.size;
}

async function takeCheckpoint(
	turn: number,
	pty: PtySession,
	insp: Inspector | undefined,
	startedAt: number,
	snapshotDir: string | undefined,
	mock: MockServer,
): Promise<Checkpoint> {
	log(`checkpoint at turn ${turn}`);
	if (insp) {
		await insp.send("Heap.gc");
		await Bun.sleep(500);
		await insp.send("Heap.gc");
		await Bun.sleep(500);
	}
	// Footprint BEFORE the snapshot: serializing the snapshot inflates the heap.
	const fp = await footprint(pty.pid);
	const rss = await rssBytes(pty.pid);
	const children: ChildSample[] = [];
	for (const pid of await descendants(pty.pid)) {
		children.push({ pid, command: await commandOf(pid), footprint: (await footprint(pid))?.total });
	}
	let scriptCount: number | undefined;
	let heap: HeapAggregate | undefined;
	let snapshotMs: number | undefined;
	if (insp) {
		scriptCount = await countScripts(insp);
		const t0 = Date.now();
		const res = await insp.send("Heap.snapshot");
		const data = String(res.snapshotData);
		snapshotMs = Date.now() - t0;
		heap = aggregateSnapshot(data);
		if (snapshotDir) await Bun.write(path.join(snapshotDir, `turn-${String(turn).padStart(4, "0")}.heapsnapshot`), data);
		// Collect garbage produced by the snapshot so it does not skew the next checkpoint.
		await insp.send("Heap.gc");
	}
	return {
		turn,
		at: new Date().toISOString(),
		elapsedMs: Date.now() - startedAt,
		footprint: fp,
		rss,
		children,
		scriptCount,
		heap,
		snapshotMs,
		workload: structuredClone(mock.stats),
	};
}

// ─── Report ──────────────────────────────────────────────────────────────────

const mb = (n: number | undefined): string => (n === undefined ? "n/a" : `${(n / 1024 / 1024).toFixed(1)}`);
const signedMb = (n: number): string => `${n >= 0 ? "+" : ""}${(n / 1024 / 1024).toFixed(2)}`;

function cat(fp: Footprint | undefined, name: string): number | undefined {
	return fp ? (fp.categories[name]?.dirty ?? 0) : undefined;
}

function renderReport(meta: Record<string, unknown>, cps: Checkpoint[]): string {
	const out: string[] = [];
	out.push("# omp memory growth report", "");
	for (const [k, v] of Object.entries(meta)) {
		if (k !== "mock") out.push(`- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
	}
	const gcNote = cps[0]?.heap ? "taken after forced GC and before heap snapshot" : "no forced GC (no inspector)";
	out.push("", `## Checkpoints (MB; footprint dirty, ${gcNote})`, "");
	out.push(
		"| turn | elapsed s | footprint total | Δ total | JSC heap (tag 1) | MALLOC_SMALL | MALLOC_LARGE | JS JIT code | RSS | children footprint | requests main/sub/aux | subagents | heap snapshot bytes | heap nodes | scripts |",
	);
	out.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
	const base = cps[0]?.footprint?.total ?? 0;
	for (const c of cps) {
		const kids = c.children.reduce((s, k) => s + (k.footprint ?? 0), 0);
		const r = c.workload.requests;
		out.push(
			`| ${c.turn} | ${(c.elapsedMs / 1000).toFixed(0)} | ${mb(c.footprint?.total)} | ${c.footprint ? signedMb(c.footprint.total - base) : "n/a"} | ${mb(cat(c.footprint, "app-specific tag 1"))} | ${mb(cat(c.footprint, "MALLOC_SMALL"))} | ${mb(cat(c.footprint, "MALLOC_LARGE"))} | ${mb(cat(c.footprint, "JS JIT generated code"))} | ${mb(c.rss)} | ${mb(kids)} (${c.children.length}) | ${r.main}/${r.subagent}/${r.aux} | ${c.workload.subagentsYielded}/${c.workload.subagentsSpawned} | ${mb(c.heap?.totalBytes)} | ${c.heap?.totalNodes ?? "n/a"} | ${c.scriptCount ?? "n/a"} |`,
		);
	}
	const lastWorkload = cps[cps.length - 1]?.workload;
	if (lastWorkload) {
		out.push("", "## Workload executed (cumulative)", "");
		out.push(
			`- streamed SSE bytes: ${mb(lastWorkload.streamedBytes)} MB; max prompt tokens (chars/4): ${lastWorkload.maxPromptTokens}; aux requests mentioning "summar": ${lastWorkload.auxSummaryLike}`,
			"",
			"| tool | calls emitted | results received | result MB | errorish results |",
			"| --- | ---: | ---: | ---: | ---: |",
		);
		const tools = new Set([...Object.keys(lastWorkload.callsEmitted), ...Object.keys(lastWorkload.resultsReceived)]);
		for (const t of [...tools].sort()) {
			const res = lastWorkload.resultsReceived[t];
			out.push(
				`| ${t} | ${lastWorkload.callsEmitted[t] ?? 0} | ${res?.count ?? 0} | ${mb(res?.bytes ?? 0)} | ${res?.errorish ?? 0} |`,
			);
		}
	}
	const first = cps[0];
	const last = cps[cps.length - 1];
	if (first?.footprint && last?.footprint && cps.length > 1) {
		out.push("", "## Footprint category growth (first → last, top 10 by dirty delta)", "");
		out.push("| category | first MB | last MB | delta MB |", "| --- | ---: | ---: | ---: |");
		const names = new Set([...Object.keys(first.footprint.categories), ...Object.keys(last.footprint.categories)]);
		const rows = [...names]
			.map(n => ({
				n,
				a: first.footprint!.categories[n]?.dirty ?? 0,
				b: last.footprint!.categories[n]?.dirty ?? 0,
			}))
			.sort((x, y) => y.b - y.a - (x.b - x.a))
			.slice(0, 10);
		for (const r of rows) out.push(`| ${r.n} | ${mb(r.a)} | ${mb(r.b)} | ${signedMb(r.b - r.a)} |`);
	}
	if (first?.heap && last?.heap && cps.length > 1) {
		out.push("", "## Top 25 heap classes by byte growth (first → last checkpoint)", "");
		out.push(
			"| class | first MB | last MB | delta MB | first count | last count | delta count |",
			"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
		);
		const names = new Set([...Object.keys(first.heap.classes), ...Object.keys(last.heap.classes)]);
		const rows = [...names]
			.map(n => {
				const a = first.heap!.classes[n] ?? { bytes: 0, count: 0 };
				const b = last.heap!.classes[n] ?? { bytes: 0, count: 0 };
				return { n, a, b };
			})
			.sort((x, y) => y.b.bytes - y.a.bytes - (x.b.bytes - x.a.bytes))
			.slice(0, 25);
		for (const r of rows) {
			out.push(
				`| ${r.n.replaceAll("|", "\\|")} | ${mb(r.a.bytes)} | ${mb(r.b.bytes)} | ${signedMb(r.b.bytes - r.a.bytes)} | ${r.a.count} | ${r.b.count} | ${r.b.count - r.a.count} |`,
			);
		}
	}
	if (last && last.children.length > 0) {
		out.push("", "## Child processes at last checkpoint", "");
		for (const k of last.children) out.push(`- ${k.pid} ${mb(k.footprint)} MB: \`${k.command}\``);
	}
	out.push("");
	return out.join("\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(import.meta.dir, "../../..");
const CLI_ENTRY = path.join(REPO_ROOT, "packages/coding-agent/src/cli.ts");
const BINARY = path.join(os.homedir(), ".bun/bin/omp");

async function killTree(pid: number): Promise<void> {
	const pids = [...(await descendants(pid)), pid];
	for (const p of pids) {
		try {
			process.kill(p, "SIGTERM");
		} catch {}
	}
	await Bun.sleep(1000);
	for (const p of pids) {
		try {
			process.kill(p, "SIGKILL");
		} catch {}
	}
}

async function main(): Promise<void> {
	const opts = parseOptions(process.argv.slice(2));
	if (process.platform !== "darwin") throw new Error("footprint sampling requires macOS");
	const { name: profileName, profile } = await loadProfile(opts.profile);
	const turns = opts.turns ?? profile.targetTurns ?? profile.sessionTurns.p50;
	const checkpointEvery = opts.checkpointEvery ?? Math.max(1, Math.ceil(turns / 4));
	const limits: PlanLimits = {
		maxRequestsPerTurn: opts.maxRequestsPerTurn,
		maxSubagentRequests: opts.maxSubagentRequests,
		maxTasksPerCall: opts.maxTasksPerCall,
		subagents: opts.subagents,
		images: opts.images,
	};
	const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "omp-memgrowth-"));
	const home = path.join(tmpRoot, "home");
	const agentDir = path.join(home, ".omp", "agent");
	const cwd = path.join(tmpRoot, "cwd");
	await fs.mkdir(agentDir, { recursive: true });
	await fs.mkdir(cwd, { recursive: true });
	await fs.mkdir(opts.out, { recursive: true });
	const snapshotDir = opts.keepSnapshots && opts.inspect ? path.join(opts.out, "snapshots") : undefined;
	if (snapshotDir) await fs.mkdir(snapshotDir, { recursive: true });

	const mock = new MockServer(profile, opts.seed, limits);
	const tracePath = path.join(opts.out, "requests.jsonl");
	await Bun.write(tracePath, "");
	const traceWriter = Bun.file(tracePath).writer();
	mock.trace = line => {
		traceWriter.write(`${new Date().toISOString()} ${line}\n`);
		traceWriter.flush();
	};
	let pty: PtySession | undefined;
	let insp: Inspector | undefined;
	let cleaned = false;
	const cleanup = async (): Promise<void> => {
		if (cleaned) return;
		cleaned = true;
		insp?.close();
		if (pty) await killTree(pty.pid);
		mock.stop();
		await traceWriter.end();
		await fs.rm(tmpRoot, { recursive: true, force: true });
	};
	const onSignal = (): void => {
		log("interrupted; cleaning up");
		void cleanup().finally(() => process.exit(130));
	};
	process.on("SIGINT", onSignal);
	process.on("SIGTERM", onSignal);

	try {
		const port = mock.start();
		await Bun.write(
			path.join(agentDir, "models.yml"),
			[
				"providers:",
				"  mock:",
				`    baseUrl: http://127.0.0.1:${port}/v1`,
				"    auth: none",
				"    api: openai-completions",
				"    models:",
				`      - id: ${MODEL_ID}`,
				"        name: Mock One",
				"        reasoning: true",
				"        input: [text, image]",
				`        contextWindow: ${opts.contextWindow}`,
				"        maxTokens: 32000",
				"",
			].join("\n"),
		);
		// Skip the first-run setup wizard and splash (CURRENT_SETUP_VERSION in pi-tui setup-version.ts);
		// pin hashline edits so the mock can address lines by the tags it sees in read/edit results.
		await Bun.write(
			path.join(agentDir, "config.yml"),
			[
				"setupVersion: 999",
				"startup:",
				"  setupWizard: false",
				"  showSplash: false",
				"edit:",
				"  mode: hashline",
				...(opts.agentIdleTtlMs !== undefined ? ["task:", `  agentIdleTtlMs: ${opts.agentIdleTtlMs}`] : []),
				"",
			].join("\n"),
		);
		await writeFixtures(cwd);

		const inspectPort = 20000 + Math.floor(Math.random() * 20000);
		const inspectUrl = `ws://127.0.0.1:${inspectPort}/omp`;
		const ompArgs = [
			"--model",
			`mock/${MODEL_ID}`,
			"--yolo",
			"--no-extensions",
			"--no-skills",
			"--no-rules",
			"--no-title",
			"--no-lsp",
		];
		// Minimal env: no inherited provider keys; HOME isolation keeps ~/.omp untouched.
		const env: Record<string, string> = {
			HOME: home,
			PI_CODING_AGENT_DIR: agentDir,
			PATH: process.env.PATH ?? "/usr/bin:/bin",
			TERM: "xterm-256color",
			COLORTERM: "truecolor",
			LANG: process.env.LANG ?? "en_US.UTF-8",
			TMPDIR: path.join(tmpRoot, "tmp"),
		};
		await fs.mkdir(env.TMPDIR!, { recursive: true });
		let cmd: string[];
		if (opts.binary) {
			// Compiled binaries ignore `--inspect`; BUN_INSPECT is the env equivalent and may or may not be honored.
			cmd = [BINARY, ...ompArgs];
			if (opts.inspect) env.BUN_INSPECT = `127.0.0.1:${inspectPort}/omp`;
		} else {
			cmd = [
				process.execPath,
				...(opts.inspect ? [`--inspect=127.0.0.1:${inspectPort}/omp`] : []),
				CLI_ENTRY,
				...ompArgs,
			];
		}
		log(
			`tmp=${tmpRoot} mock=:${port} profile=${profileName} seed=${opts.seed} turns=${turns} launching ${opts.binary ? "binary" : "source"}${opts.inspect ? " with inspector" : ""}`,
		);
		const startedAt = Date.now();
		pty = new PtySession(cmd, cwd, env);
		if (opts.inspect) {
			try {
				insp = await Inspector.connect(inspectUrl, 30_000);
				await insp.send("Heap.enable");
				log("inspector connected");
			} catch (err) {
				if (!opts.binary) throw err;
				insp = undefined;
				log(`inspector unavailable in binary mode (${String(err)}); footprint-only`);
			}
		}
		await pty.waitFor(
			() => pty!.recentText().includes(MODEL_ID) || pty!.recentText().includes("Mock One"),
			90_000,
			"TUI ready",
		);
		await pty.waitQuiet(2000, 60_000);
		const startupMs = Date.now() - startedAt;
		log(`TUI ready in ${startupMs}ms`);

		const checkpoints: Checkpoint[] = [await takeCheckpoint(0, pty, insp, startedAt, snapshotDir, mock)];
		const deadline = opts.maxMinutes > 0 ? startedAt + opts.maxMinutes * 60_000 : Number.POSITIVE_INFINITY;
		let completedTurns = 0;
		let capped = false;
		const schedule = scheduleFeatures(opts.seed, profile, turns);
		for (let turn = 1; turn <= turns; turn++) {
			if (Date.now() > deadline) {
				capped = true;
				log(`wall-time cap of ${opts.maxMinutes} min reached after ${completedTurns} turns`);
				break;
			}
			const plan = planTurn(Rng.derive(opts.seed, `turn:${turn}`), profile, limits, {
				task: schedule.taskTurns.has(turn),
				image: schedule.imageTurns.has(turn),
			});
			const done = mock.startTurn(turn, plan);
			pty.write(`${MAIN_MARKER} turn ${turn}: ${words(turn, 30)}`);
			await Bun.sleep(150);
			pty.write("\r");
			let finished = false;
			void done.then(() => {
				finished = true;
			});
			await pty.waitFor(() => finished, opts.turnTimeoutSec * 1000, `turn ${turn} final response`);
			await pty.waitQuiet(1500, 120_000);
			completedTurns = turn;
			const s = mock.stats;
			log(
				`turn ${turn}/${turns} done: planned requests=${plan.length} main=${s.requests.main} sub=${s.requests.subagent} aux=${s.requests.aux} subagents=${s.subagentsYielded}/${s.subagentsSpawned}`,
			);
			if (turn % checkpointEvery === 0 || turn === turns) {
				checkpoints.push(await takeCheckpoint(turn, pty, insp, startedAt, snapshotDir, mock));
			}
		}
		if (capped && checkpoints[checkpoints.length - 1]?.turn !== completedTurns) {
			checkpoints.push(await takeCheckpoint(completedTurns, pty, insp, startedAt, snapshotDir, mock));
		}
		if (opts.lingerMinutes > 0) {
			const lingerEnd = Date.now() + opts.lingerMinutes * 60_000;
			log(`lingering ${opts.lingerMinutes} min, sampling every ${opts.lingerEverySec}s`);
			while (Date.now() < lingerEnd) {
				await Bun.sleep(opts.lingerEverySec * 1000);
				const cp = await takeCheckpoint(completedTurns, pty, insp, startedAt, snapshotDir, mock);
				checkpoints.push(cp);
				const kids = cp.children.reduce((s, k) => s + (k.footprint ?? 0), 0);
				log(`linger t=${(cp.elapsedMs / 1000).toFixed(0)}s children=${cp.children.length} kidsMB=${(kids / 1048576).toFixed(1)}`);
			}
		}

		const meta = {
			date: new Date().toISOString(),
			mode: `${opts.binary ? `binary (${BINARY})` : "source (bun src/cli.ts)"}; ${insp ? "inspector attached (forced GC before footprint; inflates baseline)" : "no inspector (footprint without forced GC)"}`,
			bun: Bun.version,
			platform: `${process.platform} ${process.arch}`,
			profile: profileName,
			seed: opts.seed,
			turnsPlanned: turns,
			turnsCompleted: completedTurns,
			wallTimeCapped: capped ? `yes (${opts.maxMinutes} min)` : "no",
			checkpointEvery,
			contextWindow: opts.contextWindow,
			limits,
			startupMs,
			heapSnapshots: insp ? "yes" : "no",
			scheduledTaskTurns: [...schedule.taskTurns].sort((a, b) => a - b),
			scheduledImageTurns: [...schedule.imageTurns].sort((a, b) => a - b),
			mock: mock.stats,
		};
		await Bun.write(path.join(opts.out, "report.json"), JSON.stringify({ meta, checkpoints }, null, 2));
		await Bun.write(path.join(opts.out, "report.md"), renderReport(meta, checkpoints));
		log(`wrote ${path.join(opts.out, "report.md")}`);
	} finally {
		await cleanup();
	}
}

try {
	await main();
	process.exit(0);
} catch (err) {
	log(`failed: ${err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err)}`);
	process.exit(1);
}
