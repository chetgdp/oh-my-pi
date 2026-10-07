/**
 * Deterministic synthetic generator of exact RPC frames/events consumed by webgui.
 *
 * Conformance / Assumptions & File:Line Citations:
 * 1. WebSocket Frame Framing & NDJSON lines:
 *    - `src/lib/rpc-client.ts:313-366`: WebSocket `message` events contain newline-delimited JSON (`\n`).
 *    - `src/lib/rpc-client.ts:519-560`: Initial handshake on attach sends `ready` with `supportedProtocolVersions: [1, 2, 3]`,
 *      negotiates `negotiate_protocol` (v3), retrieves `get_state`, then requests `get_available_commands`,
 *      `get_agent_roster`, `get_plan_state`, etc.
 * 2. RPC Session State & History Result:
 *    - `packages/coding-agent/src/modes/rpc/rpc-v3-types.ts:43-50`: `RpcV3HistoryResult` contains `leafId`, `entries`,
 *      `hasMore`, `live`, optional `after`, optional `secrets`.
 *    - `src/lib/session-store.ts:919-940, 988-1002, 1036-1041`: History page is applied via `applyHistoryPage`.
 *      On cold attach, `client.history({})` returns newest page `RpcV3HistoryResult`.
 * 3. V3 Stream Events vs Ambient Session Events:
 *    - `src/lib/session-store.ts:838-848`: V3 event types are: `msg_start`, `block_start`, `delta`, `block_end`,
 *      `msg_end`, `entry`, `branch`, `tool_output`.
 *    - `src/lib/session-store.ts:1218-1240`: Dispatches `applyV3Event` for V3 events, `applyTranscriptEvent` otherwise,
 *      along with `applySubagentEvent`, `applyRegistryFrame`, `applySubagentProgress`, and `applySubagentLifecycle`.
 *    - `src/lib/transcript-model.ts:365-602`:
 *      * `msg_start` carries `{ sid, message: { role: 'assistant', ... } }` and initiates live stream.
 *      * `block_start` carries `{ sid, block, start: { type: 'text' | 'thinking' | 'toolCall', ... } }`.
 *      * `delta` carries `{ sid, block, text }`.
 *      * `block_end` carries `{ sid, block, content }`.
 *      * `msg_end` carries `{ sid, message }` and freezes the live stream.
 *      * `entry` carries `{ entry: SessionEntry, sid?: number }` and appends to `entries`, unlinking live stream `sid`.
 *      * `tool_output` carries `{ toolCallId, text, replace?: boolean, details?: unknown }`.
 *      * `tool_execution_start` / `tool_execution_end` (ambient frames) manage `activeTools`.
 * 4. Subagent Lifecycle & Progress Frames:
 *    - `src/lib/subagent-model.ts:72-132`: Consumes `subagent_lifecycle` and `subagent_progress` frames.
 *    - `src/lib/agent-hub-model.ts:72-130`: Consumes `agent_registry`, `subagent_progress`, and `subagent_lifecycle`.
 *    - `packages/wire/src/index.ts:254-356`: Defines wire shapes for `SubagentProgressPayload`,
 *      `SubagentLifecyclePayload`, and `AgentRegistryFrame`.
 */

import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import type { RpcServerSessionState, RpcServerSessionEventFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3BlockStart, RpcV3Event, RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import type { AgentProgress, AgentRosterEntry } from "@oh-my-pi/pi-wire";
// ---------------------------------------------------------------------------
// PRNG Helper (Deterministic Mulberry32 / LCG)
// ---------------------------------------------------------------------------

export function createRng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ---------------------------------------------------------------------------
// Markdown Generator
// ---------------------------------------------------------------------------

const MARKDOWN_WORDS = [
	"function",
	"optimize",
	"benchmark",
	"dispatch",
	"reducer",
	"stream",
	"latency",
	"throughput",
	"buffer",
	"protocol",
	"connection",
	"runtime",
	"performance",
	"concurrency",
	"handler",
	"interface",
	"payload",
	"pipeline",
	"subscriber",
	"observer",
	"execution",
	"snapshot",
	"metric",
	"allocation",
];

const CODE_LANGUAGES = ["ts", "js", "rust", "go", "python", "json", "bash"];

/**
 * Generates structured markdown text (code fences, bullet lists, markdown tables, headings)
 * deterministically to hit approximately `targetChars` length.
 */
export function generateMarkdownText(rng: () => number, targetChars: number): string {
	const sections: string[] = [];
	let currentChars = 0;
	let sectionIndex = 1;

	while (currentChars < targetChars) {
		const choice = Math.floor(rng() * 5);
		let block = "";

		switch (choice) {
			case 0: {
				// Code fence
				const lang = CODE_LANGUAGES[Math.floor(rng() * CODE_LANGUAGES.length)];
				const lines: string[] = [`\`\`\`${lang}`];
				const lineCount = 3 + Math.floor(rng() * 8);
				for (let i = 0; i < lineCount; i++) {
					const w1 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
					const w2 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
					const w3 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
					lines.push(`  const ${w1} = await ${w2}(${i}); // ${w3}`);
				}
				lines.push("```");
				block = lines.join("\n");
				break;
			}
			case 1: {
				// Bullet list
				const itemCount = 3 + Math.floor(rng() * 5);
				const items: string[] = [];
				for (let i = 0; i < itemCount; i++) {
					const w1 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
					const w2 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
					items.push(`- **${w1}**: verification of ${w2} step ${i + 1} with deterministic seeds.`);
				}
				block = items.join("\n");
				break;
			}
			case 2: {
				// Table
				const rowCount = 2 + Math.floor(rng() * 4);
				const rows: string[] = ["| Metric | Target | Status | Rate |", "| :--- | :--- | :--- | :--- |"];
				for (let i = 0; i < rowCount; i++) {
					const w = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
					rows.push(`| ${w}_${i} | ${100 + i * 50}ms | pass | ${(rng() * 100).toFixed(1)} op/s |`);
				}
				block = rows.join("\n");
				break;
			}
			case 3: {
				// Heading + paragraph
				const w1 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
				const w2 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
				const w3 = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
				block = `### Phase ${sectionIndex++}: ${w1.toUpperCase()} Verification\n\nDetailed analysis indicates ${w2} is within bounds while ${w3} maintains optimal cache hit ratios across iterations.`;
				break;
			}
			default: {
				// Blockquote / text
				const words: string[] = [];
				const count = 10 + Math.floor(rng() * 15);
				for (let i = 0; i < count; i++) {
					words.push(MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)]);
				}
				block = `> Note: ${words.join(" ")}.`;
				break;
			}
		}

		sections.push(block);
		currentChars += block.length + 2;
	}

	let result = sections.join("\n\n");
	if (result.length > targetChars) {
		result = result.slice(0, targetChars);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Tool Output Content Generator
// ---------------------------------------------------------------------------

export function generateToolOutputChunk(rng: () => number, chunkSize: number, chunkIndex: number): string {
	const lines: string[] = [];
	let chars = 0;
	while (chars < chunkSize) {
		const w = MARKDOWN_WORDS[Math.floor(rng() * MARKDOWN_WORDS.length)];
		const line = `[chunk-${chunkIndex}] output line checking ${w} offset=${chars}`;
		lines.push(line);
		chars += line.length + 1;
	}
	return lines.join("\n").slice(0, chunkSize);
}

// ---------------------------------------------------------------------------
// Session Generator Types
// ---------------------------------------------------------------------------

export interface GenerateSessionOptions {
	entries: number;
	assistantChars: number;
	deltaChars: number;
	toolOutputChunks: number;
	toolChunkChars: number;
	subagents: number;
	seed: number;
}

export interface SessionHistoryPayload {
	sessionState: RpcServerSessionState;
	historyResult: RpcV3HistoryResult;
	roster: AgentRosterEntry[];
}

export interface GeneratedSession {
	/** Whatever the store loads on attach. */
	history: SessionHistoryPayload;
	/** Ordered array of raw JSON-line frames as the websocket would deliver them (each ended in \n). */
	stream: string[];
}

export const PRESETS = {
	small: {
		entries: 10,
		assistantChars: 1000,
		deltaChars: 128,
		toolOutputChunks: 5,
		toolChunkChars: 120,
		subagents: 2,
		seed: 42,
	},
	long: {
		entries: 150,
		assistantChars: 6000,
		deltaChars: 256,
		toolOutputChunks: 40,
		toolChunkChars: 250,
		subagents: 8,
		seed: 1337,
	},
	huge: {
		entries: 2000,
		assistantChars: 20000,
		deltaChars: 512,
		toolOutputChunks: 500,
		toolChunkChars: 500,
		subagents: 24,
		seed: 9999,
	},
} as const satisfies Record<string, GenerateSessionOptions>;

// ---------------------------------------------------------------------------
// Helper Builders
// ---------------------------------------------------------------------------

function makeInitialSessionState(sessionId: string): RpcServerSessionState {
	return {
		sessionId,
		isStreaming: false,
		isCompacting: false,
		steeringMode: "all",
		followUpMode: "all",
		interruptMode: "immediate",
		autoCompactionEnabled: false,
		fastModeEnabled: false,
		fastModeActive: false,
		tokensPerSecond: 120,
		messageCount: 0,
		queuedMessageCount: 0,
		todoPhases: [],
		thinkingLevel: "low",
	} as unknown as RpcServerSessionState;
}

function makeAssistantMessage(content: AssistantMessage["content"] = [], timestamp: number = Date.now()): AgentMessage {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet",
		usage: {
			input: 100,
			output: 200,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 300,
			cost: {
				input: 0.0003,
				output: 0.003,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0.0033,
			},
		},
		stopReason: "stop",
		timestamp,
	} as unknown as AgentMessage;
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

export function generateSession(opts: GenerateSessionOptions): GeneratedSession {
	const rng = createRng(opts.seed);
	const sessionId = `bench-session-${opts.seed}`;
	const baseTime = 1770000000000;
	let currentTime = baseTime;
	let currentEntryIndex = 0;
	let lastLeafId: string | null = null;

	const allEntries: SessionEntry[] = [];
	const streamFrames: (RpcServerSessionEventFrame | RpcV3Event | Record<string, unknown>)[] = [];

	// Initial root user message
	const rootId = `entry-${currentEntryIndex++}`;
	const rootEntry: SessionEntry = {
		id: rootId,
		parentId: null,
		timestamp: new Date(currentTime).toISOString(),
		type: "message",
		message: {
			role: "user",
			content: "Run synthetic benchmark across full pipeline.",
			timestamp: currentTime,
		},
	};
	allEntries.push(rootEntry);
	lastLeafId = rootId;

	// Divide the remaining target entries:
	// A portion belongs to history (loaded on attach), and the rest is produced
	// dynamically in the stream (simulating a live running session).
	// We want history to have a realistic subset (e.g. half or up to 50 if entries > 50).
	const streamEntryCount = Math.max(2, Math.floor(opts.entries / 2));
	const historyEntryCount = Math.max(1, opts.entries - streamEntryCount);

	// Generate history entries (pairs of user -> assistant or toolResult)
	for (let i = 1; i < historyEntryCount; i++) {
		currentTime += 1000;
		const entryId = `entry-${currentEntryIndex++}`;
		const isAssistant = i % 2 === 1;

		if (isAssistant) {
			const md = generateMarkdownText(rng, Math.min(opts.assistantChars, 400));
			const entry: SessionEntry = {
				id: entryId,
				parentId: lastLeafId,
				timestamp: new Date(currentTime).toISOString(),
				type: "message",
				message: makeAssistantMessage([{ type: "text", text: md }], currentTime),
			};
			allEntries.push(entry);
			lastLeafId = entryId;
		} else {
			const entry: SessionEntry = {
				id: entryId,
				parentId: lastLeafId,
				timestamp: new Date(currentTime).toISOString(),
				type: "message",
				message: {
					role: "user",
					content: `Follow-up verification prompt ${i}`,
					timestamp: currentTime,
				},
			};
			allEntries.push(entry);
			lastLeafId = entryId;
		}
	}

	// Subagent Roster for history & stream
	const roster: AgentRosterEntry[] = [
		{
			id: "Main",
			displayName: "Main",
			kind: "main",
			status: "running",
			createdAt: baseTime,
			lastActivity: currentTime,
		},
	];

	for (let s = 1; s <= opts.subagents; s++) {
		const subId = `agent-${s}`;
		roster.push({
			id: subId,
			displayName: `Worker-${s}`,
			kind: "sub",
			parentId: "Main",
			status: s % 2 === 0 ? "running" : "parked",
			agent: "task",
			description: `Subagent worker ${s}`,
			task: `Execute verification task slice ${s}`,
			createdAt: baseTime + s * 100,
			lastActivity: currentTime,
		});
	}

	// History payload returned when the store attaches
	const historyResult: RpcV3HistoryResult = {
		leafId: lastLeafId,
		entries: [...allEntries],
		hasMore: false,
		live: [],
	};

	const sessionState = makeInitialSessionState(sessionId);
	sessionState.messageCount = allEntries.length;

	// -------------------------------------------------------------------------
	// STREAM FRAMES GENERATION
	// -------------------------------------------------------------------------

	let sidCounter = 1;

	// 1. Subagent Lifecycle & Progress frames for subagents
	for (let s = 1; s <= opts.subagents; s++) {
		const subId = `agent-${s}`;
		// subagent_lifecycle start
		streamFrames.push({
			type: "subagent_lifecycle",
			payload: {
				id: subId,
				agent: "task",
				description: `Worker ${s} started`,
				status: "started",
				index: s,
			},
		});

		// subagent_progress
		const progress: AgentProgress = {
			index: s,
			id: subId,
			agent: "task",
			status: "running",
			task: `Synthetic task slice ${s}`,
			toolCount: s * 2,
			requests: s,
			tokens: s * 1500,
			cost: 0.001 * s,
			durationMs: 5000 * s,
			recentTools: [
				{
					tool: "read",
					args: JSON.stringify({ path: `src/slice-${s}.ts` }),
					endMs: currentTime,
				},
			],
			recentOutput: [`slice ${s} processed`],
		};

		streamFrames.push({
			type: "subagent_progress",
			payload: {
				index: s,
				agent: "task",
				task: `Synthetic task slice ${s}`,
				progress,
			},
		});
	}

	// 2. Stream dynamic entries up to opts.entries
	// Each turn will have:
	// - turn_start (ambient)
	// - user entry
	// - agent_start (ambient)
	// - assistant streaming:
	//     msg_start
	//     block_start (text)
	//     multiple text deltas with markdown
	//     block_end
	//     block_start (toolCall)
	//     block_end (toolCall)
	//     tool_execution_start (ambient)
	//     multiple tool_output frames (streamed chunks)
	//     tool_execution_end (ambient)
	//     toolResult entry
	//     msg_end
	//     assistant entry (with sid matching)
	// - turn_end / agent_end
	while (allEntries.length < opts.entries) {
		const sid = sidCounter++;
		currentTime += 1000;

		// Turn start signal
		streamFrames.push({ type: "turn_start" });

		// User message entry
		const userEntryId = `entry-${currentEntryIndex++}`;
		const userMsgEntry: SessionEntry = {
			id: userEntryId,
			parentId: lastLeafId,
			timestamp: new Date(currentTime).toISOString(),
			type: "message",
			message: {
				role: "user",
				content: `Evaluate iteration ${allEntries.length}`,
				timestamp: currentTime,
			},
		};
		allEntries.push(userMsgEntry);
		lastLeafId = userEntryId;

		streamFrames.push({
			type: "entry",
			entry: userMsgEntry,
		});

		if (allEntries.length >= opts.entries) break;

		// Agent starts processing
		streamFrames.push({ type: "agent_start" });

		// Assistant streaming begins
		const assistantMsgId = `entry-${currentEntryIndex++}`;
		const toolCallId = `call_${sid}_${Math.floor(rng() * 100000)}`;

		const fullMarkdown = generateMarkdownText(rng, opts.assistantChars);
		const initialAssistantMsg = makeAssistantMessage([], currentTime);

		streamFrames.push({
			type: "msg_start",
			sid,
			message: initialAssistantMsg,
		});

		// Block 0: Markdown Text
		const textBlockStart: RpcV3BlockStart = { type: "text" };
		streamFrames.push({
			type: "block_start",
			sid,
			block: 0,
			start: textBlockStart,
		});

		// Stream text in deltas of approx deltaChars
		const deltaSize = Math.max(1, opts.deltaChars);
		let offset = 0;
		while (offset < fullMarkdown.length) {
			const chunk = fullMarkdown.slice(offset, offset + deltaSize);
			offset += deltaSize;
			streamFrames.push({
				type: "delta",
				sid,
				block: 0,
				text: chunk,
			});
		}

		streamFrames.push({
			type: "block_end",
			sid,
			block: 0,
			content: { type: "text", text: fullMarkdown },
		});

		// Block 1: Tool Call
		const toolBlockStart: RpcV3BlockStart = {
			type: "toolCall",
			id: toolCallId,
			name: "benchmark_runner",
		};
		streamFrames.push({
			type: "block_start",
			sid,
			block: 1,
			start: toolBlockStart,
		});

		const toolCallContent = {
			type: "toolCall",
			id: toolCallId,
			name: "benchmark_runner",
			arguments: { runs: opts.toolOutputChunks, size: opts.toolChunkChars },
			intent: "Running synthetic verification benchmarks",
		};
		streamFrames.push({
			type: "block_end",
			sid,
			block: 1,
			content: toolCallContent,
		});

		// Tool execution start ambient frame
		streamFrames.push({
			type: "tool_execution_start",
			toolCallId,
			toolName: "benchmark_runner",
			args: toolCallContent.arguments,
			intent: toolCallContent.intent,
		});

		// Stream tool output chunks
		const chunksCount = Math.max(1, Math.min(opts.toolOutputChunks, 20));
		let accumulatedToolOutput = "";
		for (let c = 0; c < chunksCount; c++) {
			const chunkText = generateToolOutputChunk(rng, opts.toolChunkChars, c);
			accumulatedToolOutput += chunkText + "\n";
			streamFrames.push({
				type: "tool_output",
				toolCallId,
				text: chunkText + "\n",
				details: { progress: ((c + 1) / chunksCount) * 100, chunkIndex: c },
			});
		}

		// Tool execution end ambient frame
		streamFrames.push({
			type: "tool_execution_end",
			toolCallId,
			toolName: "benchmark_runner",
			result: accumulatedToolOutput,
			isError: false,
		});

		// Save toolResult entry
		const toolResultEntryId = `entry-${currentEntryIndex++}`;
		const toolResultEntry: SessionEntry = {
			id: toolResultEntryId,
			parentId: lastLeafId,
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
		allEntries.push(toolResultEntry);
		lastLeafId = toolResultEntryId;

		streamFrames.push({
			type: "entry",
			entry: toolResultEntry,
		});

		// Final Assistant Message End
		const completedAssistantMsg = makeAssistantMessage(
			[{ type: "text", text: fullMarkdown }, toolCallContent as never],
			currentTime,
		);

		streamFrames.push({
			type: "msg_end",
			sid,
			message: completedAssistantMsg,
		});

		// Assistant message saved as entry
		const assistantEntry: SessionEntry = {
			id: assistantMsgId,
			parentId: lastLeafId,
			timestamp: new Date(currentTime).toISOString(),
			type: "message",
			message: completedAssistantMsg,
		};
		allEntries.push(assistantEntry);
		lastLeafId = assistantMsgId;

		streamFrames.push({
			type: "entry",
			entry: assistantEntry,
			sid,
		});

		// Complete turn & agent run
		streamFrames.push({ type: "turn_end" });
		streamFrames.push({ type: "agent_end" });
	}

	// Format stream frames as raw newline-delimited JSON strings
	const rawJsonLines = streamFrames.map(frame => JSON.stringify(frame) + "\n");

	return {
		history: {
			sessionState,
			historyResult,
			roster,
		},
		stream: rawJsonLines,
	};
}
