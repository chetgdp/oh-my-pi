/**
 * Scripted OpenAI-compatible (chat completions, SSE) server for the
 * memory-growth bench. Routes each request to the main conversation, a
 * subagent conversation (marker `MGSUB:<id>` in its user prompt), or an
 * auxiliary call (no tools: compaction summary, title, ...), and streams the
 * planned assistant turn with tool calls the real omp tools then execute.
 */
import {
	EDIT_TARGETS,
	GREP_BUCKETS,
	IMAGE_COUNT,
	type PlanLimits,
	type PlannedCall,
	type PlannedRequest,
	planSubagent,
	READ_SIZES,
	Rng,
	textOfSize,
	type WorkloadProfile,
	words,
} from "./workload";

export const MODEL_ID = "mock-1";
export const MAIN_MARKER = "MGMAIN";
export const SUB_MARKER = "MGSUB:";

interface ChatMessage {
	role: string;
	content?: unknown;
	tool_call_id?: string;
}

interface ToolDef {
	type: string;
	function: { name: string; description?: string; parameters?: { properties?: Record<string, unknown> } };
}

interface ChatBody {
	messages?: ChatMessage[];
	tools?: ToolDef[];
}

interface WireCall {
	name: string;
	args: Record<string, unknown>;
	/** Stats key when it differs from the tool name (image reads). */
	label?: string;
}

interface SubagentState {
	plan: PlannedRequest[];
	step: number;
	yielded: boolean;
	editSlot: number;
}

export interface MockStats {
	requests: { main: number; subagent: number; aux: number };
	auxSummaryLike: number;
	callsEmitted: Record<string, number>;
	resultsReceived: Record<string, { count: number; bytes: number; errorish: number }>;
	subagentsSpawned: number;
	subagentsYielded: number;
	streamedBytes: number;
	maxPromptTokens: number;
	/** First few result heads per tool (synthetic bench data) to verify tools really ran. */
	resultSamples: Record<string, string[]>;
}

const encoder = new TextEncoder();

function messageText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map(p => (p && typeof p === "object" && "text" in p && typeof p.text === "string" ? p.text : ""))
			.join("");
	}
	return "";
}

function chunks(text: string, size: number): string[] {
	const out: string[] = [];
	for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
	return out;
}

/** Markdown assistant text of roughly `bytes` bytes, with a code fence once it is long enough. */
function assistantText(bytes: number, seed: number): string {
	if (bytes < 200) return words(seed, Math.max(4, Math.round(bytes / 7)));
	const prose = textOfSize(Math.round(bytes * 0.5), seed, "-");
	const code = textOfSize(Math.round(bytes * 0.4), seed + 1, "const x =");
	return `## Step ${seed}\n\n${prose}\n\n\`\`\`ts\n${code}\n\`\`\`\n`;
}

export class MockServer {
	server: Bun.Server<undefined> | undefined;
	stats: MockStats = {
		requests: { main: 0, subagent: 0, aux: 0 },
		auxSummaryLike: 0,
		callsEmitted: {},
		resultsReceived: {},
		subagentsSpawned: 0,
		subagentsYielded: 0,
		streamedBytes: 0,
		maxPromptTokens: 0,
		resultSamples: {},
	};
	#turn = 0;
	#plan: PlannedRequest[] = [];
	#step = 0;
	#turnDone: PromiseWithResolvers<void> | undefined;
	#lastMainCallWasWaitable = false;
	#consecutiveWaits = 0;
	/** Owner marker prefixed to assistant text of the reply being built ("" = none). */
	#marker = "";
	#subagents = new Map<string, SubagentState>();
	#pendingSubagents = new Set<string>();
	#callTool = new Map<string, string>();
	#seenResults = new Set<string>();
	#seq = 0;

	constructor(
		readonly profile: WorkloadProfile,
		readonly seed: number,
		readonly limits: PlanLimits,
	) {}

	start(): number {
		this.server = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			idleTimeout: 0,
			fetch: req => this.#handle(req),
		});
		return this.server.port!;
	}

	/** Optional per-request trace sink (one JSON line per request, no message content). */
	trace: ((line: string) => void) | undefined;

	stop(): void {
		this.server?.stop(true);
	}

	/** Arms the main conversation with the next turn's plan; resolves when its final reply has streamed. */
	startTurn(turn: number, plan: PlannedRequest[]): Promise<void> {
		this.#turn = turn;
		this.#plan = plan;
		this.#step = 0;
		this.#lastMainCallWasWaitable = false;
		this.#turnDone = Promise.withResolvers<void>();
		return this.#turnDone.promise;
	}

	get pendingSubagents(): number {
		return this.#pendingSubagents.size;
	}

	async #handle(req: Request): Promise<Response> {
		const url = new URL(req.url);
		if (req.method === "GET" && url.pathname.endsWith("/models")) {
			return Response.json({ object: "list", data: [{ id: MODEL_ID, object: "model" }] });
		}
		if (req.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
			return new Response("not found", { status: 404 });
		}
		const raw = await req.text();
		const body = JSON.parse(raw) as ChatBody;
		const promptTokens = Math.round(raw.length / 4);
		this.stats.maxPromptTokens = Math.max(this.stats.maxPromptTokens, promptTokens);
		const messages = body.messages ?? [];
		const tools = body.tools ?? [];
		this.#recordResults(messages);

		let events: object[];
		let onDone: (() => void) | undefined;
		let kind: string;
		const owner = this.#owner(messages);
		const last = messages[messages.length - 1];
		const lastText = last?.role === "user" ? messageText(last.content) : "";
		const summaryPrompt =
			lastText !== "" &&
			!lastText.includes(MAIN_MARKER) &&
			!lastText.includes(SUB_MARKER) &&
			/summar|compact/i.test(lastText);
		this.#marker = owner === undefined ? "" : owner === "main" ? MAIN_MARKER : `${SUB_MARKER}${owner}`;
		if (tools.length === 0 || owner === undefined || summaryPrompt) {
			// Compaction summaries, titles, probes. The reply echoes the owner's marker so a
			// compacted conversation still routes to its owner afterwards.
			kind = summaryPrompt ? "aux:summary" : "aux";
			this.stats.requests.aux++;
			if (summaryPrompt) this.stats.auxSummaryLike++;
			events = this.#textEvents(assistantText(2500, this.#seq), "", "stop", promptTokens);
		} else if (owner !== "main") {
			kind = `sub:${owner}`;
			this.stats.requests.subagent++;
			events = this.#subagentReply(owner, messages, tools, promptTokens);
		} else {
			kind = `main:t${this.#turn}s${this.#step}`;
			this.stats.requests.main++;
			const reply = this.#mainReply(messages, tools, promptTokens);
			events = reply.events;
			if (reply.final) {
				kind += ":final";
				const done = this.#turnDone;
				onDone = () => done?.resolve();
			}
		}
		this.trace?.(
			JSON.stringify({
				kind,
				messages: messages.length,
				tools: tools.length,
				promptTokens,
				lastRole: messages[messages.length - 1]?.role,
				pending: this.#pendingSubagents.size,
			}),
		);
		const stats = this.stats;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				for (const ev of events) {
					const bytes = encoder.encode(`data: ${JSON.stringify(ev)}\n\n`);
					stats.streamedBytes += bytes.length;
					controller.enqueue(bytes);
				}
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
				onDone?.();
			},
		});
		return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
	}

	#recordResults(messages: ChatMessage[]): void {
		for (const m of messages) {
			if (m.role !== "tool" || !m.tool_call_id || this.#seenResults.has(m.tool_call_id)) continue;
			this.#seenResults.add(m.tool_call_id);
			const tool = this.#callTool.get(m.tool_call_id) ?? "unknown";
			const text = messageText(m.content);
			const r = (this.stats.resultsReceived[tool] ??= { count: 0, bytes: 0, errorish: 0 });
			r.count++;
			r.bytes += typeof m.content === "string" ? m.content.length : JSON.stringify(m.content ?? "").length;
			if (/^(error|.{0,40}\berror\b)/i.test(text.slice(0, 120))) r.errorish++;
			const samples = (this.stats.resultSamples[tool] ??= []);
			if (samples.length < 3) samples.push(text.slice(0, 200));
		}
	}

	/**
	 * Conversation owner from the newest prompt carrying a marker: `"main"`, a subagent id,
	 * or undefined. Subagents may inherit the parent history, so the newest marker wins.
	 */
	#owner(messages: ChatMessage[]): string | undefined {
		const subRe = new RegExp(`${SUB_MARKER}(\\w+)`);
		for (let i = messages.length - 1; i >= 0; i--) {
			const m = messages[i]!;
			if (m.role === "tool") continue;
			const text = messageText(m.content);
			const sub = subRe.exec(text)?.[1];
			if (sub) return sub;
			if (text.includes(MAIN_MARKER)) return "main";
		}
		return undefined;
	}

	#mainReply(messages: ChatMessage[], tools: ToolDef[], promptTokens: number): { events: object[]; final: boolean } {
		const seed = this.#turn * 1000 + this.#step;
		const lastMsg = messages[messages.length - 1];
		if (lastMsg?.role === "tool" && /Nothing to wait for/i.test(messageText(lastMsg.content))) {
			// omp has no running jobs: whatever the mock still counts as pending ended some other way.
			this.#pendingSubagents.clear();
		}
		const next = this.#plan[this.#step];
		const nextIsFinal = !next || next.calls.length === 0;
		if (
			this.#pendingSubagents.size > 0 &&
			(this.#lastMainCallWasWaitable || nextIsFinal) &&
			this.#consecutiveWaits < 200
		) {
			// Block on outstanding subagents before moving on / finishing the turn.
			this.#lastMainCallWasWaitable = true;
			this.#consecutiveWaits++;
			const calls = [{ name: "wait", args: { i: "Waiting for subagents" } }];
			return { events: this.#callEvents("m", calls, assistantText(120, seed), "", promptTokens), final: false };
		}
		this.#consecutiveWaits = 0;
		this.#step++;
		if (!next || next.calls.length === 0) {
			const text = assistantText(next?.textBytes ?? 300, seed);
			const thinking = next ? textOfSize(next.thinkingBytes, seed, "think") : "";
			return { events: this.#textEvents(text, thinking, "stop", promptTokens), final: true };
		}
		const planned = next;
		const ctx: CallContext = { messages, tools, editPrefix: "e", editSlot: seed, seed, owner: "main" };
		const calls = planned.calls.map(c => this.#wireCall(c, ctx));
		this.#lastMainCallWasWaitable = calls.some(c => c.name === "task");
		const thinking = textOfSize(planned.thinkingBytes, seed, "think");
		return {
			events: this.#callEvents("m", calls, assistantText(planned.textBytes, seed), thinking, promptTokens),
			final: false,
		};
	}

	#subagentReply(id: string, messages: ChatMessage[], tools: ToolDef[], promptTokens: number): object[] {
		let state = this.#subagents.get(id);
		if (!state) {
			state = {
				plan: planSubagent(Rng.derive(this.seed, `sub:${id}`), this.profile, this.limits),
				step: 0,
				yielded: false,
				editSlot: Number(Bun.hash.wyhash(id) % BigInt(EDIT_TARGETS)),
			};
			this.#subagents.set(id, state);
		}
		const seed = 7_000_000 + state.editSlot * 10_000 + state.step;
		const planned = state.plan[state.step++];
		if (!planned || planned.calls.length === 0 || state.yielded) {
			if (!state.yielded) {
				state.yielded = true;
				this.stats.subagentsYielded++;
				this.#pendingSubagents.delete(id);
			}
			// Final answer carries no marker: it is delivered into the parent conversation.
			this.#marker = "";
			const data = assistantText(planned?.textBytes ?? 800, seed);
			// Unstructured subagents have no `yield` tool and finish with a plain final answer.
			if (!tools.some(t => t.function.name === "yield")) return this.#textEvents(data, "", "stop", promptTokens);
			return this.#callEvents("s", [{ name: "yield", args: { type: "result", data } }], "", "", promptTokens);
		}
		const ctx: CallContext = { messages, tools, editPrefix: "s", editSlot: state.editSlot, seed, owner: id };
		const calls = planned.calls.map(c => this.#wireCall(c, ctx));
		const thinking = textOfSize(planned.thinkingBytes, seed, "think");
		return this.#callEvents("s", calls, assistantText(planned.textBytes, seed), thinking, promptTokens);
	}

	/** Translates a planned call into concrete tool arguments sized to the profile targets. */
	#wireCall(c: PlannedCall, ctx: CallContext): WireCall {
		const i = `Bench ${c.tool} call`;
		switch (c.tool) {
			case "bash":
				return { name: "bash", args: { i, command: `head -c ${c.resultBytes} data/corpus.txt` } };
			case "read": {
				const want = c.resultBytes / 1.15;
				const size = READ_SIZES.reduce((best, s) => (Math.abs(s - want) < Math.abs(best - want) ? s : best));
				return { name: "read", args: { i, path: `data/read/r-${size}.txt` } };
			}
			case "image":
				return {
					name: "read",
					label: "read(image)",
					args: { i, path: `data/img/shot-${ctx.seed % IMAGE_COUNT}.png` },
				};
			case "grep": {
				const bucket = Math.max(
					0,
					Math.min(GREP_BUCKETS - 1, Math.round(Math.log2(Math.max(1, c.resultBytes / 110)))),
				);
				return { name: "grep", args: { i, pattern: `mk${bucket}_`, path: "data/grep" } };
			}
			case "glob":
				return { name: "glob", args: { i, path: ctx.seed % 2 === 0 ? "data/read/*.txt" : "src/*.ts" } };
			case "write":
				return {
					name: "write",
					args: { i, path: `work/w-${ctx.owner}-${ctx.seed}.txt`, content: textOfSize(c.argBytes, ctx.seed, "w") },
				};
			case "todo": {
				const items = Math.max(1, Math.round(c.argBytes / 60));
				const list = [
					{ phase: "Bench", items: Array.from({ length: items }, (_, k) => `Item ${k}: ${words(k, 5)}`) },
				];
				return { name: "todo", args: { i, op: "init", list } };
			}
			case "eval":
				return { name: "eval", args: { i, ...this.#evalArgs(c, ctx) } };
			case "edit":
				return this.#editCall(c, ctx);
			case "task":
				return { name: "task", args: this.#taskArgs(c, ctx) };
		}
	}

	#evalArgs(c: PlannedCall, ctx: CallContext): Record<string, unknown> {
		const evalTool = ctx.tools.find(t => t.function.name === "eval");
		const langSchema = JSON.stringify(evalTool?.function.parameters?.properties?.language ?? {});
		const hasPy = langSchema.includes('"py"');
		const hasJs = langSchema.includes('"js"');
		const language = hasPy && (!hasJs || ctx.seed % 2 === 0) ? "py" : "js";
		const rows = Math.max(1, Math.round(c.resultBytes / 46));
		const body =
			language === "py"
				? `print("\\n".join(f"row {i} lorem ipsum dolor sit amet consectetur" for i in range(${rows})))`
				: `const rows = [];\nfor (let i = 0; i < ${rows}; i++) rows.push(\`row \${i} lorem ipsum dolor sit amet consectetur\`);\nprint(rows.join("\\n"));`;
		const pad = Math.max(0, c.argBytes - body.length - 40);
		const comment = language === "py" ? "#" : "//";
		const filler = pad > 0 ? `${textOfSize(pad, ctx.seed, comment)}\n` : "";
		return { language, code: `${filler}${body}`, title: "bench" };
	}

	/** Hashline edit against the newest `[path#TAG]` the agent has seen; falls back to a read to obtain one. */
	#editCall(c: PlannedCall, ctx: CallContext): WireCall {
		const file = `src/${ctx.editPrefix}${ctx.editSlot % EDIT_TARGETS}.ts`;
		ctx.editSlot++;
		const tagRe = new RegExp(`\\[${file.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}#([0-9A-Z]{4})\\]`, "g");
		let tag: string | undefined;
		for (const m of ctx.messages) {
			if (m.role !== "tool") continue;
			for (const match of messageText(m.content).matchAll(tagRe)) tag = match[1];
		}
		if (!tag) return { name: "read", args: { i: "Reading edit target", path: file } };
		const lines = Math.max(1, Math.round(c.argBytes / 48));
		const body = Array.from(
			{ length: lines },
			(_, k) => `+export const add_${ctx.seed}_${k} = ${k}; // ${words(k, 3)}`,
		);
		return { name: "edit", args: { i: "Bench edit", input: `[${file}#${tag}]\nPUT >1:\n${body.join("\n")}\n` } };
	}

	#taskArgs(c: PlannedCall, ctx: CallContext): Record<string, unknown> {
		const n = c.tasks ?? 1;
		const taskTool = ctx.tools.find(t => t.function.name === "task");
		const batch = Boolean(taskTool?.function.parameters?.properties?.tasks);
		const perTask = Math.max(200, Math.round(c.argBytes / (n + 1)));
		const items = Array.from({ length: n }, (_, k) => {
			const id = `b${this.#turn}x${ctx.seed}x${k}`;
			this.#pendingSubagents.add(id);
			this.stats.subagentsSpawned++;
			return {
				name: `Bench${id}`,
				task: `${SUB_MARKER}${id}\n# Target\n${textOfSize(perTask, ctx.seed + k, "-")}`,
				solutionSpace: "scripted bench subagent",
			};
		});
		if (batch) return { i: "Delegating bench work", context: textOfSize(perTask, ctx.seed, "ctx"), tasks: items };
		return { i: "Delegating bench work", ...items[0] };
	}

	#base(): { id: string; object: string; created: number; model: string } {
		return { id: `chatcmpl-${this.#seq}`, object: "chat.completion.chunk", created: 0, model: MODEL_ID };
	}

	#textEvents(rawText: string, thinking: string, finish: string, promptTokens: number): object[] {
		const text = this.#marker ? `${this.#marker}\n${rawText}` : rawText;
		const evs: object[] = [{ ...this.#base(), choices: [{ index: 0, delta: { role: "assistant" } }] }];
		for (const c of thinking ? chunks(thinking, 64) : []) {
			evs.push({ ...this.#base(), choices: [{ index: 0, delta: { reasoning_content: c } }] });
		}
		for (const c of chunks(text, 64)) evs.push({ ...this.#base(), choices: [{ index: 0, delta: { content: c } }] });
		evs.push({ ...this.#base(), choices: [{ index: 0, delta: {}, finish_reason: finish }] });
		const completion = Math.round((text.length + thinking.length) / 4);
		evs.push({
			...this.#base(),
			choices: [],
			usage: { prompt_tokens: promptTokens, completion_tokens: completion, total_tokens: promptTokens + completion },
		});
		this.#seq++;
		return evs;
	}

	#callEvents(prefix: string, calls: WireCall[], text: string, thinking: string, promptTokens: number): object[] {
		const evs = this.#textEvents(text, thinking, "tool_calls", promptTokens);
		const tail = evs.splice(evs.length - 2, 2);
		calls.forEach((call, index) => {
			const id = `call_${prefix}${this.#seq}_${index}`;
			const label = call.label ?? call.name;
			this.#callTool.set(id, label);
			this.stats.callsEmitted[label] = (this.stats.callsEmitted[label] ?? 0) + 1;
			evs.push({
				...this.#base(),
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index, id, type: "function", function: { name: call.name, arguments: "" } }],
						},
					},
				],
			});
			for (const c of chunks(JSON.stringify(call.args), 512)) {
				evs.push({
					...this.#base(),
					choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: c } }] } }],
				});
			}
		});
		evs.push(...tail);
		return evs;
	}
}

interface CallContext {
	messages: ChatMessage[];
	tools: ToolDef[];
	editPrefix: "e" | "s";
	editSlot: number;
	seed: number;
	owner: string;
}
