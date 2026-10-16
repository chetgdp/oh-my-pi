/**
 * omem mode adapter: binds the core store (`../omem`) to an AgentSession.
 *
 * Request layout per user message (cheisms/omem.md "Context layout"):
 *   [view blocks + per-turn state][current user message][this turn's tool loop]
 * Earlier turns never ride along; they return only as view lines.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { type } from "@oh-my-pi/omptype";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import {
	type AssistantMessage,
	completeSimple,
	type Message,
	type Model,
	retryTransientCompletion,
	type Tool,
	type UserMessage,
} from "@oh-my-pi/pi-ai";
import type { ToolDefinition } from "../extensibility/extensions";
import { isRecord } from "@oh-my-pi/pi-utils";
import { Omem, type OmemCompleteFn, OmemLockedError } from "../omem";
import type { AgentSessionEvent } from "./agent-session-events";

const HOLDER_FILE = "holder.json";
const COMPACTION_MAX_TOKENS = 8192;

/** Who holds the store lock; read by a second `--omem` process to name the holder. */
export interface OmemHolder {
	pid: number;
	sessionId?: string;
	mode?: string;
	startedAt: string;
}

function readHolder(dir: string): OmemHolder | undefined {
	try {
		return JSON.parse(fs.readFileSync(path.join(dir, HOLDER_FILE), "utf8")) as OmemHolder;
	} catch {
		return undefined;
	}
}

/**
 * Opens the global chat as its single writer. omp clients cannot attach a TUI
 * or print run to another process's live session, so a held lock is fatal here.
 */
export async function openOmemStore(options: {
	dir: string;
	complete: OmemCompleteFn;
	holder: Omit<OmemHolder, "pid" | "startedAt">;
	onError?: (err: unknown, node: { l: number; i: number }) => void;
}): Promise<Omem> {
	let omem: Omem;
	try {
		omem = await Omem.open({ dir: options.dir, complete: options.complete, onError: options.onError });
	} catch (error) {
		if (!(error instanceof OmemLockedError)) throw error;
		const holder = readHolder(options.dir);
		const who = holder
			? `pid ${holder.pid}${holder.mode ? ` (${holder.mode})` : ""}${holder.sessionId ? `, session ${holder.sessionId}` : ""}`
			: "another omp process";
		throw new Error(
			`omem chat at ${options.dir} is already open by ${who}. One writer only: use that process, or reach an \`omp host\` holder through omp-shell or the web GUI.`,
		);
	}
	const holder: OmemHolder = { ...options.holder, pid: process.pid, startedAt: new Date().toISOString() };
	try {
		fs.writeFileSync(path.join(options.dir, HOLDER_FILE), `${JSON.stringify(holder)}\n`);
	} catch {
		// Holder info only improves the lock error message.
	}
	return omem;
}

function userText(message: UserMessage): string {
	if (typeof message.content === "string") return message.content;
	return message.content.map(part => (part.type === "text" ? part.text : "[image]")).join("\n");
}

export interface OmemModeDeps {
	/** Volatile per-turn facts (date, cwd, repo context, model) kept out of the system prompt. */
	renderState(): Promise<string> | string;
	/**
	 * File recording which user messages of the latest turn are already in the log,
	 * so a resumed session that continues the same turn after a restart does not log them again.
	 */
	ledgerFile?: string;
}

/** Stable across processes: persisted messages keep their timestamp and text. */
function userKey(message: UserMessage): string {
	return `${message.timestamp}:${Bun.hash(userText(message)).toString(36)}`;
}

/** Turn-level adapter; one instance per main session. */
export class OmemMode {
	readonly omem: Omem;
	readonly #deps: OmemModeDeps;
	readonly #logged = new WeakSet<AgentMessage>();
	/** Keys of the latest turn's logged user messages; mirrors `ledgerFile`. */
	#turnKeys: Set<string>;
	#anchor: AgentMessage | undefined;
	#viewMessage: UserMessage | undefined;
	/** Index of the last whole 4-line view block inside the view message (-1: none). */
	#markIndex = -1;

	constructor(omem: Omem, deps: OmemModeDeps) {
		this.omem = omem;
		this.#deps = deps;
		this.#turnKeys = new Set(this.#readLedger());
	}

	#readLedger(): string[] {
		if (!this.#deps.ledgerFile) return [];
		try {
			const keys: unknown = JSON.parse(fs.readFileSync(this.#deps.ledgerFile, "utf8"));
			return Array.isArray(keys) ? keys.filter(key => typeof key === "string") : [];
		} catch {
			return [];
		}
	}

	#writeLedger(): void {
		if (!this.#deps.ledgerFile) return;
		try {
			fs.writeFileSync(this.#deps.ledgerFile, JSON.stringify([...this.#turnKeys]));
		} catch {
			// Losing the ledger only risks a duplicate log line after a restart.
		}
	}

	/** The context transform: replaces history with [view+state][this turn]. */
	async transform(messages: AgentMessage[], signal?: AbortSignal): Promise<AgentMessage[]> {
		let promptIndex = -1;
		for (let index = messages.length - 1; index >= 0; index--) {
			const message = messages[index];
			if (message.role === "user" && (message as UserMessage).steering !== true) {
				promptIndex = index;
				break;
			}
		}
		if (promptIndex === -1) return messages;

		const prompt = messages[promptIndex];
		let anchorIndex = this.#anchor ? messages.indexOf(this.#anchor) : -1;
		if (!this.#logged.has(prompt) || anchorIndex === -1 || !this.#viewMessage) {
			// A prompt the ledger knows is the same turn continuing after a restart, not a new message.
			if (!this.#turnKeys.has(userKey(prompt as UserMessage))) this.#turnKeys = new Set();
			// Summaries of every earlier message come first; the view is rendered before this message is logged.
			await this.omem.settle(signal);
			const blocks = this.omem.viewBlocks();
			const state = await this.#deps.renderState();
			const content: UserMessage["content"] = blocks.map(text => ({ type: "text" as const, text }));
			if (state) content.push({ type: "text", text: state });
			this.#viewMessage = { role: "user", content, timestamp: Date.now() };
			this.#markIndex = this.omem.viewWholeBlocks() - 1;
			this.#anchor = prompt;
			anchorIndex = promptIndex;
		}

		for (let index = anchorIndex; index < messages.length; index++) {
			const message = messages[index];
			if (message.role !== "user" || this.#logged.has(message)) continue;
			this.#logged.add(message);
			const key = userKey(message as UserMessage);
			if (this.#turnKeys.has(key)) continue;
			const text = userText(message as UserMessage);
			if (text) this.omem.append("user", text);
			this.#turnKeys.add(key);
			this.#writeLedger();
		}
		return [this.#viewMessage as AgentMessage, ...messages.slice(anchorIndex)];
	}

	/** Logs replies, tool calls and tool results; thinking never enters the store. */
	observe(event: AgentSessionEvent): void {
		if (event.type !== "message_end") return;
		const message = event.message;
		if (message.role === "assistant") {
			let text = "";
			for (const part of (message as AssistantMessage).content) {
				if (part.type === "text") {
					text += part.text;
				} else if (part.type === "toolCall") {
					if (text.trim()) this.omem.append("agent", text);
					text = "";
					this.omem.append("tool", `${part.name} ${JSON.stringify(part.arguments)}`);
				}
			}
			if (text.trim()) this.omem.append("agent", text);
		} else if (message.role === "toolResult") {
			const text = message.content.map(part => (part.type === "text" ? part.text : "[image]")).join("");
			this.omem.append("echo", text || "(empty)");
		}
	}

	/**
	 * Anthropic cache marks: the provider already marks tools, system and the
	 * request tail; message-interior marks move to the last whole view block so
	 * the next message's request reuses the view prefix. 5-minute entries only.
	 */
	markPayload(payload: unknown): unknown {
		if (!isRecord(payload) || !Array.isArray(payload.messages)) return payload;
		const first: unknown = payload.messages[0];
		if (!isRecord(first) || first.role !== "user" || !Array.isArray(first.content)) return payload;
		const head: unknown = first.content[0];
		if (!isRecord(head) || typeof head.text !== "string" || !head.text.startsWith("<chat>\n")) return payload;

		for (const group of [payload.system, payload.tools]) {
			if (!Array.isArray(group)) continue;
			for (const block of group) {
				if (isRecord(block) && block.cache_control != null) block.cache_control = { type: "ephemeral" };
			}
		}
		// Keep only the newest message mark (the request end); older ones would exceed the 4-mark budget.
		let keptTail = false;
		for (let index = payload.messages.length - 1; index >= 0; index--) {
			const message: unknown = payload.messages[index];
			if (!isRecord(message) || !Array.isArray(message.content)) continue;
			for (let blockIndex = message.content.length - 1; blockIndex >= 0; blockIndex--) {
				const block: unknown = message.content[blockIndex];
				if (!isRecord(block) || block.cache_control == null) continue;
				if (keptTail) delete block.cache_control;
				else block.cache_control = { type: "ephemeral" };
				keptTail = true;
			}
		}
		const target: unknown = this.#markIndex >= 0 ? first.content[this.#markIndex] : undefined;
		if (isRecord(target) && target.type === "text") target.cache_control = { type: "ephemeral" };
		return payload;
	}

	/** `zoom` and `date` tools (gist §6). */
	tools(): ToolDefinition[] {
		const omem = this.omem;
		const zoomSchema = type({
			id: type("number").describe("message id from a view line `id+n|...`"),
			n: type("number").describe("message count from the same line"),
		});
		const dateSchema = type({ id: type("number").describe("message id") });
		const zoom: ToolDefinition<typeof zoomSchema> = {
			name: "zoom",
			label: "Zoom",
			description:
				"Expand the chat range `id+n` one level deeper: its two halves, or the raw message once n is 1. Use before acting on a summary line.",
			parameters: zoomSchema,
			approval: "read",
			loadMode: "essential",
			async execute(_id, params) {
				return { content: [{ type: "text", text: omem.zoom(params.id, params.n) }], details: undefined };
			},
		};
		const date: ToolDefinition<typeof dateSchema> = {
			name: "date",
			label: "Date",
			description: "When chat message `id` was written.",
			parameters: dateSchema,
			approval: "read",
			loadMode: "essential",
			async execute(_id, params) {
				return { content: [{ type: "text", text: omem.date(params.id) }], details: undefined };
			},
		};
		return [zoom as unknown as ToolDefinition, date as unknown as ToolDefinition];
	}
}

export interface OmemCompleteDeps {
	/** Resolves the cheap model and its key per call so role changes apply. */
	resolveModel(): Promise<{ model: Model; apiKey: string | undefined; role: string } | undefined>;
	/** The turns' live system prompt and tools, so compaction reads their cache. */
	systemPrompt(): string[];
	tools(): Tool[];
	sessionId(): string;
	recordUsage(message: AssistantMessage, role: string): void;
}

/** Compactor model call (spec §4): same system prompt and tools as turns; tools are never called. */
export function createOmemCompleteFn(deps: OmemCompleteDeps): OmemCompleteFn {
	return async ({ view, task, retries, signal }) => {
		const resolved = await deps.resolveModel();
		if (!resolved) throw new Error("omem compaction: no model for the smol role");
		const { model, apiKey, role } = resolved;
		const now = Date.now();
		const messages: Message[] = [{ role: "user", content: `${view}\n\n${task}`, timestamp: now }];
		for (const retry of retries) {
			messages.push({
				role: "assistant",
				content: [{ type: "text", text: retry.reply }],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: now,
			} as AssistantMessage);
			messages.push({ role: "user", content: retry.feedback, timestamp: now });
		}
		const sessionId = deps.sessionId();
		const response = await retryTransientCompletion(
			() =>
				completeSimple(
					model,
					{ systemPrompt: deps.systemPrompt(), messages, tools: deps.tools() },
					{ apiKey, sessionId, maxTokens: COMPACTION_MAX_TOKENS, signal },
				),
			{ signal, provider: model.provider },
		);
		deps.recordUsage(response, role);
		if (response.stopReason === "error") throw new Error(response.errorMessage ?? "omem compaction failed");
		if (response.stopReason === "aborted") throw new Error("omem compaction aborted");
		return response.content.map(part => (part.type === "text" ? part.text : "")).join("");
	};
}
