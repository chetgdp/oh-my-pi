import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import "../../collab-web/test/transcript-dom-shim";
import { Transcript } from "../../collab-web/src/components/transcript/Transcript";
import type { SessionEntry } from "@oh-my-pi/pi-wire";
import type { ActiveTool } from "../../collab-web/src/lib/client";
import {
	transcriptFromMessages,
	applyTranscriptEvent,
	emptyTranscriptState,
} from "../src/lib/transcript-model";
import type { RpcSessionEvent } from "../src/lib/rpc-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderState(state: {
	entries: readonly SessionEntry[];
	stream: Parameters<typeof Transcript>[0]["stream"];
	streamDone: boolean;
	activeTools: ReadonlyMap<string, ActiveTool>;
	working: boolean;
}): string {
	return renderToStaticMarkup(
		<Transcript
			entries={state.entries}
			stream={state.stream}
			streamDone={state.streamDone}
			activeTools={state.activeTools}
			working={state.working}
		/>,
	);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_MSG = {
	role: "user" as const,
	content: "Hello from user",
	timestamp: 1000,
};

const ASSISTANT_MSG = {
	role: "assistant" as const,
	content: [
		{ type: "text" as const, text: "Agent reply with **bold**" },
		{
			type: "toolCall" as const,
			id: "tc-render",
			name: "read_file",
			arguments: { path: "test.ts" },
			intent: "Reading test file",
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
		cost: { total: 0 },
	},
	stopReason: "toolUse" as const,
	timestamp: 2000,
};

const TOOL_RESULT_MSG = {
	role: "toolResult" as const,
	toolCallId: "tc-render",
	toolName: "read_file",
	content: [{ type: "text" as const, text: "file content" }],
	isError: false,
	timestamp: 3000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Transcript render", () => {
	it("renders user text, assistant markdown, and a tool card", () => {
		const state = transcriptFromMessages([
			USER_MSG as any,
			ASSISTANT_MSG as any,
			TOOL_RESULT_MSG as any,
		]);
		const html = renderState(state);

		// User message text appears
		expect(html).toContain("Hello from user");

		// Assistant markdown rendered (bold -> <strong>)
		expect(html).toContain("<strong>bold</strong>");

		// Tool card: tool name appears
		expect(html).toContain("read_file");
	});

	it("renders a streaming assistant message", () => {
		let state = emptyTranscriptState();

		state = applyTranscriptEvent(state, {
			type: "message_start",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Streaming..." }],
				model: "m",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { total: 0 } },
				stopReason: "stop",
				timestamp: 100,
			},
		} as unknown as RpcSessionEvent);

		const html = renderState(state);
		expect(html).toContain("Streaming...");
	});
});
