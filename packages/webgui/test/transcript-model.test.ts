import { describe, expect, it } from "bun:test";
import { transcriptFromMessages, applyTranscriptEvent, emptyTranscriptState } from "../src/lib/transcript-model";
import type { RpcSessionEvent } from "../src/lib/rpc-client";

// ---------------------------------------------------------------------------
// Fixtures: pi-ai shaped messages (as they arrive from get_messages)
// ---------------------------------------------------------------------------

const USER_MSG = {
	role: "user" as const,
	content: "Hello agent",
	timestamp: 1000,
};

const ASSISTANT_MSG = {
	role: "assistant" as const,
	content: [
		{ type: "text" as const, text: "Here is the answer" },
		{
			type: "toolCall" as const,
			id: "call-1",
			name: "read_file",
			arguments: { path: "foo.ts" },
			intent: "Reading foo",
		},
	],
	model: "test-model",
	provider: "test",
	api: "messages",
	usage: {
		input: 10,
		output: 20,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 30,
		cost: { total: 0.01 },
	},
	stopReason: "toolUse" as const,
	timestamp: 2000,
};

const TOOL_RESULT_MSG = {
	role: "toolResult" as const,
	toolCallId: "call-1",
	toolName: "read_file",
	content: [{ type: "text" as const, text: "file contents here" }],
	isError: false,
	timestamp: 3000,
};

// ---------------------------------------------------------------------------
// transcriptFromMessages
// ---------------------------------------------------------------------------

describe("transcriptFromMessages", () => {
	it("maps user, assistant, and tool result messages to entries", () => {
		const state = transcriptFromMessages([USER_MSG as any, ASSISTANT_MSG as any, TOOL_RESULT_MSG as any]);

		// 3 entries: user, assistant, toolResult
		expect(state.entries).toHaveLength(3);

		const userEntry = state.entries[0];
		expect(userEntry.type).toBe("message");
		if (userEntry.type === "message") {
			expect(userEntry.message.role).toBe("user");
			if (userEntry.message.role === "user") {
				expect(userEntry.message.content).toBe("Hello agent");
			}
		}

		const assistantEntry = state.entries[1];
		expect(assistantEntry.type).toBe("message");
		if (assistantEntry.type === "message") {
			expect(assistantEntry.message.role).toBe("assistant");
			if (assistantEntry.message.role === "assistant") {
				expect(assistantEntry.message.content).toHaveLength(2);
				const textBlock = assistantEntry.message.content[0];
				expect(textBlock.type).toBe("text");
				if (textBlock.type === "text") {
					expect(textBlock.text).toBe("Here is the answer");
				}
				const toolBlock = assistantEntry.message.content[1];
				expect(toolBlock.type).toBe("toolCall");
				if (toolBlock.type === "toolCall") {
					expect(toolBlock.name).toBe("read_file");
					expect(toolBlock.intent).toBe("Reading foo");
				}
			}
		}

		const toolEntry = state.entries[2];
		expect(toolEntry.type).toBe("message");
		if (toolEntry.type === "message") {
			expect(toolEntry.message.role).toBe("toolResult");
		}

		// No streaming state
		expect(state.stream).toBeNull();
		expect(state.streamDone).toBe(false);
		expect(state.activeTools.size).toBe(0);
		expect(state.working).toBe(false);
	});

	it("skips developer messages", () => {
		const dev = { role: "developer", content: "system text", timestamp: 500 };
		const state = transcriptFromMessages([dev as any, USER_MSG as any]);
		expect(state.entries).toHaveLength(1);
		expect(state.entries[0].type).toBe("message");
	});
});

// ---------------------------------------------------------------------------
// applyTranscriptEvent: streaming assistant message
// ---------------------------------------------------------------------------

describe("applyTranscriptEvent streaming", () => {
	it("message_start + two updates + message_end yields one assistant item", () => {
		let state = emptyTranscriptState();

		// message_start with initial empty content
		state = applyTranscriptEvent(state, {
			type: "message_start",
			message: {
				role: "assistant",
				content: [],
				model: "m",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { total: 0 } },
				stopReason: "stop",
				timestamp: 100,
			},
		} as unknown as RpcSessionEvent);
		expect(state.stream).not.toBeNull();
		expect(state.streamDone).toBe(false);

		// First text delta (full accumulating message)
		state = applyTranscriptEvent(state, {
			type: "message_update",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Hello" }],
				model: "m",
				usage: { input: 0, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 5, cost: { total: 0 } },
				stopReason: "stop",
				timestamp: 100,
			},
		} as unknown as RpcSessionEvent);
		expect(state.stream!.content).toHaveLength(1);
		if (state.stream!.content[0].type === "text") {
			expect(state.stream!.content[0].text).toBe("Hello");
		}

		// Second text delta (accumulated)
		state = applyTranscriptEvent(state, {
			type: "message_update",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Hello world" }],
				model: "m",
				usage: { input: 0, output: 11, cacheRead: 0, cacheWrite: 0, totalTokens: 11, cost: { total: 0 } },
				stopReason: "stop",
				timestamp: 100,
			},
		} as unknown as RpcSessionEvent);
		if (state.stream!.content[0].type === "text") {
			expect(state.stream!.content[0].text).toBe("Hello world");
		}

		// message_end commits the entry
		state = applyTranscriptEvent(state, {
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Hello world" }],
				model: "m",
				usage: { input: 0, output: 11, cacheRead: 0, cacheWrite: 0, totalTokens: 11, cost: { total: 0 } },
				stopReason: "stop",
				timestamp: 100,
			},
		} as unknown as RpcSessionEvent);
		expect(state.streamDone).toBe(true);
		expect(state.entries).toHaveLength(1);
		const entry = state.entries[0];
		if (entry.type === "message" && entry.message.role === "assistant") {
			expect(entry.message.content).toHaveLength(1);
			if (entry.message.content[0].type === "text") {
				expect(entry.message.content[0].text).toBe("Hello world");
			}
		}
	});
});

// ---------------------------------------------------------------------------
// applyTranscriptEvent: tool execution
// ---------------------------------------------------------------------------

describe("applyTranscriptEvent tool execution", () => {
	it("tool_execution_start/end yields a tracked active tool", () => {
		let state = emptyTranscriptState();

		state = applyTranscriptEvent(state, {
			type: "tool_execution_start",
			toolCallId: "tc-1",
			toolName: "bash",
			args: { command: "ls" },
			intent: "Listing files",
		} as unknown as RpcSessionEvent);
		expect(state.activeTools.size).toBe(1);
		const tool = state.activeTools.get("tc-1")!;
		expect(tool.toolName).toBe("bash");
		expect(tool.intent).toBe("Listing files");

		// update with partial result
		state = applyTranscriptEvent(state, {
			type: "tool_execution_update",
			toolCallId: "tc-1",
			toolName: "bash",
			args: { command: "ls" },
			partialResult: "partial output",
		} as unknown as RpcSessionEvent);
		expect(state.activeTools.get("tc-1")!.partialResult).toBe("partial output");

		// end removes it
		state = applyTranscriptEvent(state, {
			type: "tool_execution_end",
			toolCallId: "tc-1",
			toolName: "bash",
			result: "full output",
			isError: false,
		} as unknown as RpcSessionEvent);
		expect(state.activeTools.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// applyTranscriptEvent: agent lifecycle
// ---------------------------------------------------------------------------

describe("applyTranscriptEvent agent lifecycle", () => {
	it("agent_start/end toggle working", () => {
		let state = emptyTranscriptState();
		expect(state.working).toBe(false);

		state = applyTranscriptEvent(state, {
			type: "agent_start",
		} as unknown as RpcSessionEvent);
		expect(state.working).toBe(true);

		state = applyTranscriptEvent(state, {
			type: "agent_end",
		} as unknown as RpcSessionEvent);
		expect(state.working).toBe(false);
	});

	it("turn_end resets stream state", () => {
		let state = emptyTranscriptState();
		state = applyTranscriptEvent(state, {
			type: "message_start",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "hi" }],
				model: "m",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { total: 0 } },
				stopReason: "stop",
				timestamp: 0,
			},
		} as unknown as RpcSessionEvent);
		expect(state.stream).not.toBeNull();

		state = applyTranscriptEvent(state, {
			type: "turn_end",
		} as unknown as RpcSessionEvent);
		expect(state.stream).toBeNull();
		expect(state.streamDone).toBe(false);
	});

	it("unknown event types are ignored", () => {
		const state = emptyTranscriptState();
		const next = applyTranscriptEvent(state, {
			type: "model_changed",
		} as unknown as RpcSessionEvent);
		expect(next).toBe(state); // same reference
	});
});
