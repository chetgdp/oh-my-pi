import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import {
	applyHistoryPage,
	buildTranscriptRows,
	emptyTranscriptState,
	flattenEntries,
	resetFinishedEntryCache,
	type AssistantTextItem,
	type LiveStream,
	type UserItem,
} from "../src/lib/transcript-model";
import { UserRow } from "../src/components/transcript/rows/UserRow";

function makeAssistantMessage(
	content: AssistantMessage["content"] = [],
	overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: 100,
		...overrides,
	};
}

const USER_ENTRY_1: SessionEntry = {
	id: "entry-u1",
	parentId: null,
	timestamp: "2026-09-28T12:00:00.000Z",
	type: "message",
	message: {
		role: "user",
		content: "Ship it?",
		timestamp: 1000,
	},
};

const USER_ENTRY_2: SessionEntry = {
	id: "entry-u2",
	parentId: "entry-a1",
	timestamp: "2026-09-28T12:05:00.000Z",
	type: "message",
	message: {
		role: "user",
		content: "Any updates?",
		timestamp: 2000,
	},
};

describe("agent reactions in transcript model", () => {
	it("reply opening with emoji sets reaction on preceding user item and strips it from assistant text", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a1",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "🚀 Shipping now." }]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistantEntry],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		expect(rows).toHaveLength(2);
		const userItem = rows[0] as UserItem;
		const assistantItem = rows[1] as AssistantTextItem;

		expect(userItem.kind).toBe("user");
		expect(userItem.reaction).toBe("🚀");

		expect(assistantItem.kind).toBe("assistant-text");
		expect(assistantItem.text).toBe("Shipping now.");
	});

	it("reply opening with lone emoji sets reaction and leaves assistant text empty", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a-lone",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "👍" }]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistantEntry],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		expect(rows).toHaveLength(2);
		const userItem = rows[0] as UserItem;
		const assistantItem = rows[1] as AssistantTextItem;

		expect(userItem.reaction).toBe("👍");
		expect(assistantItem.text).toBe("");
	});

	it("reply opening with emoji and following newline strips the newline", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a-newline",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "👍\nHere is the report." }]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistantEntry],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		const userItem = rows[0] as UserItem;
		const assistantItem = rows[1] as AssistantTextItem;

		expect(userItem.reaction).toBe("👍");
		expect(assistantItem.text).toBe("Here is the report.");
	});

	it("reply with plain text leaves both user and assistant unchanged", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a-plain",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "I will look into it." }]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistantEntry],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		const userItem = rows[0] as UserItem;
		const assistantItem = rows[1] as AssistantTextItem;

		expect(userItem.reaction).toBeUndefined();
		expect(assistantItem.text).toBe("I will look into it.");
	});

	it("emoji mid-text is not lifted to reaction badge", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a-mid",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "Hello 🚀 world" }]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistantEntry],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		const userItem = rows[0] as UserItem;
		const assistantItem = rows[1] as AssistantTextItem;

		expect(userItem.reaction).toBeUndefined();
		expect(assistantItem.text).toBe("Hello 🚀 world");
	});

	it("partial streaming emoji is withheld and not shown as reaction until complete", () => {
		const liveStreamPartial: LiveStream = {
			message: makeAssistantMessage([{ type: "text", text: "👨‍" }]),
			frozen: false,
		};
		const liveMapPartial = new Map<number, LiveStream>([[1, liveStreamPartial]]);

		const rowsPartial = flattenEntries([USER_ENTRY_1], new Map(), new Map(), liveMapPartial, false, [], new Map());

		const userPartial = rowsPartial[0] as UserItem;
		const assistantPartial = rowsPartial[1] as AssistantTextItem;

		expect(userPartial.reaction).toBeUndefined();
		expect(assistantPartial.text).toBe("");

		const liveStreamComplete: LiveStream = {
			message: makeAssistantMessage([{ type: "text", text: "👨‍💻 on it" }]),
			frozen: false,
		};
		const liveMapComplete = new Map<number, LiveStream>([[1, liveStreamComplete]]);

		const rowsComplete = flattenEntries([USER_ENTRY_1], new Map(), new Map(), liveMapComplete, false, [], new Map());

		const userComplete = rowsComplete[0] as UserItem;
		const assistantComplete = rowsComplete[1] as AssistantTextItem;

		expect(userComplete.reaction).toBe("👨‍💻");
		expect(assistantComplete.text).toBe("on it");
	});

	it("partial streaming regional indicator flag is withheld until complete", () => {
		const liveStreamPartial: LiveStream = {
			message: makeAssistantMessage([{ type: "text", text: "🇺" }]),
			frozen: false,
		};
		const liveMapPartial = new Map<number, LiveStream>([[1, liveStreamPartial]]);

		const rowsPartial = flattenEntries([USER_ENTRY_1], new Map(), new Map(), liveMapPartial, false, [], new Map());

		const userPartial = rowsPartial[0] as UserItem;
		const assistantPartial = rowsPartial[1] as AssistantTextItem;

		expect(userPartial.reaction).toBeUndefined();
		expect(assistantPartial.text).toBe("");

		const liveStreamComplete: LiveStream = {
			message: makeAssistantMessage([{ type: "text", text: "🇺🇸 All set" }]),
			frozen: false,
		};
		const liveMapComplete = new Map<number, LiveStream>([[1, liveStreamComplete]]);

		const rowsComplete = flattenEntries([USER_ENTRY_1], new Map(), new Map(), liveMapComplete, false, [], new Map());

		const userComplete = rowsComplete[0] as UserItem;
		const assistantComplete = rowsComplete[1] as AssistantTextItem;

		expect(userComplete.reaction).toBe("🇺🇸");
		expect(assistantComplete.text).toBe("All set");
	});

	it("assistant reply not preceded by a user message is left unchanged", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a-standalone",
			parentId: null,
			timestamp: "2026-09-28T12:00:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "🚀 System initialized." }]),
		};

		const rows = flattenEntries([assistantEntry], new Map(), new Map(), new Map(), false, [], new Map());

		expect(rows).toHaveLength(1);
		const assistantItem = rows[0] as AssistantTextItem;
		expect(assistantItem.text).toBe("🚀 System initialized.");
	});

	it("post-tool continuation keeps its emoji verbatim and does not react past earlier reply", () => {
		resetFinishedEntryCache();
		const assistantFirst: SessionEntry = {
			id: "entry-a1",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([
				{ type: "text", text: "Checking logs." },
				{ type: "toolCall", id: "call-1", name: "bash", arguments: { command: "uptime" } },
			]),
		};

		const toolResultEntry: SessionEntry = {
			id: "entry-tr1",
			parentId: "entry-a1",
			timestamp: "2026-09-28T12:02:00.000Z",
			type: "message",
			message: {
				role: "toolResult",
				toolCallId: "call-1",
				toolName: "bash",
				content: [{ type: "text", text: "up 5 days" }],
				isError: false,
				timestamp: 1500,
			},
		};

		const assistantContinuation: SessionEntry = {
			id: "entry-a2",
			parentId: "entry-tr1",
			timestamp: "2026-09-28T12:03:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "🎉 All green." }]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistantFirst, toolResultEntry, assistantContinuation],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		const userItem = rows[0] as UserItem;
		const textRows = rows.filter(r => r.kind === "assistant-text") as AssistantTextItem[];

		expect(userItem.reaction).toBeUndefined();
		expect(textRows[0].text).toBe("Checking logs.");
		expect(textRows[1].text).toBe("🎉 All green.");
	});

	it("assistant reply with thinking block preceding text still reacts to user message", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a-thinking",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([
				{ type: "thinking", thinking: "Pondering the solution..." },
				{ type: "text", text: "💡 Eureka!" },
			]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistantEntry],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		const userItem = rows[0] as UserItem;
		const textItem = rows.find(r => r.kind === "assistant-text") as AssistantTextItem;

		expect(userItem.reaction).toBe("💡");
		expect(textItem.text).toBe("Eureka!");
	});

	it("multiple user turns each receive their own assistant reaction", () => {
		resetFinishedEntryCache();
		const assistant1: SessionEntry = {
			id: "entry-a1",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "👍 Working on it." }]),
		};

		const assistant2: SessionEntry = {
			id: "entry-a2",
			parentId: "entry-u2",
			timestamp: "2026-09-28T12:06:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "✅ Done." }]),
		};

		const rows = flattenEntries(
			[USER_ENTRY_1, assistant1, USER_ENTRY_2, assistant2],
			new Map(),
			new Map(),
			new Map(),
			false,
			[],
			new Map(),
		);

		const userRows = rows.filter(r => r.kind === "user") as UserItem[];
		const textRows = rows.filter(r => r.kind === "assistant-text") as AssistantTextItem[];

		expect(userRows[0].reaction).toBe("👍");
		expect(textRows[0].text).toBe("Working on it.");

		expect(userRows[1].reaction).toBe("✅");
		expect(textRows[1].text).toBe("Done.");
	});

	it("memoization preserves derived reaction across multiple buildTranscriptRows calls", () => {
		resetFinishedEntryCache();
		const assistantEntry: SessionEntry = {
			id: "entry-a1",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "🚀 Deploying." }]),
		};

		const state = {
			...emptyTranscriptState(),
			entries: [USER_ENTRY_1, assistantEntry],
		};

		const firstRows = buildTranscriptRows(state);
		expect((firstRows[0] as UserItem).reaction).toBe("🚀");
		expect((firstRows[1] as AssistantTextItem).text).toBe("Deploying.");

		// Second call uses cached entry items
		const secondRows = buildTranscriptRows(state);
		expect((secondRows[0] as UserItem).reaction).toBe("🚀");
		expect((secondRows[1] as AssistantTextItem).text).toBe("Deploying.");
	});

	it("history page prepend preserves reactions on newer entries", () => {
		resetFinishedEntryCache();
		const assistant2: SessionEntry = {
			id: "entry-a2",
			parentId: "entry-u2",
			timestamp: "2026-09-28T12:06:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "✅ Done." }]),
		};

		let state = applyHistoryPage(
			emptyTranscriptState(),
			{
				leafId: assistant2.id,
				entries: [USER_ENTRY_2, assistant2],
				hasMore: true,
				live: [],
			},
			{ older: false },
		);

		const initialRows = buildTranscriptRows(state);
		expect((initialRows[0] as UserItem).reaction).toBe("✅");

		const assistant1: SessionEntry = {
			id: "entry-a1",
			parentId: "entry-u1",
			timestamp: "2026-09-28T12:01:00.000Z",
			type: "message",
			message: makeAssistantMessage([{ type: "text", text: "👍 Working on it." }]),
		};

		// Prepend older history page
		state = applyHistoryPage(
			state,
			{
				leafId: assistant2.id,
				entries: [USER_ENTRY_1, assistant1, USER_ENTRY_2, assistant2],
				hasMore: false,
				live: [],
			},
			{ older: true },
		);

		const prependedRows = buildTranscriptRows(state);
		const userRows = prependedRows.filter(r => r.kind === "user") as UserItem[];
		const textRows = prependedRows.filter(r => r.kind === "assistant-text") as AssistantTextItem[];

		expect(userRows[0].reaction).toBe("👍");
		expect(textRows[0].text).toBe("Working on it.");

		expect(userRows[1].reaction).toBe("✅");
		expect(textRows[1].text).toBe("Done.");
	});
});

describe("UserRow reaction badge rendering", () => {
	it("renders badge as last child of .tr-body when reaction exists and not pending", () => {
		const html = renderToStaticMarkup(
			React.createElement(UserRow, {
				content: "Hello",
				timestamp: "12:00",
				reaction: "👍",
				pending: false,
			}),
		);

		expect(html).toContain('class="tr-reaction"');
		expect(html).toContain('role="img"');
		expect(html).toContain('aria-label="Agent reacted 👍"');
		expect(html).toContain("👍</span></div>");
	});

	it("does not render reaction badge when pending is true", () => {
		const html = renderToStaticMarkup(
			React.createElement(UserRow, {
				content: "Hello",
				timestamp: "12:00",
				reaction: "👍",
				pending: true,
			}),
		);

		expect(html).not.toContain("tr-reaction");
	});

	it("does not render reaction badge when reaction is undefined", () => {
		const html = renderToStaticMarkup(
			React.createElement(UserRow, {
				content: "Hello",
				timestamp: "12:00",
				pending: false,
			}),
		);

		expect(html).not.toContain("tr-reaction");
	});
});
