import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { applyHistoryPage, emptyTranscriptState } from "../src/lib/transcript-model";
import { DeveloperRow } from "../src/components/transcript/rows/DeveloperRow";
import { ThinkingRow } from "../src/components/transcript/rows/ThinkingRow";
import { UserRow } from "../src/components/transcript/rows/UserRow";
import { TranscriptView, flattenEntries, scrollCompensation } from "../src/components/transcript/Transcript";
import { dataUrlToImage } from "../src/lib/session-actions";

/**
 * Happy-dom has no layout, so pinned and scrolled-up behavior of the
 * bottom-anchored scroller is verified in bench/verify-scroll.ts; the
 * compensation rule is unit-tested below.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ENTRY: SessionEntry = {
	id: "entry-u1",
	parentId: null,
	timestamp: "2024-01-01T00:00:00Z",
	type: "message",
	message: {
		role: "user",
		content: "Hello from user",
		timestamp: 1000,
	},
};

const DEVELOPER_ENTRY: SessionEntry = {
	id: "entry-d1",
	parentId: null,
	timestamp: "2024-01-01T00:00:00Z",
	type: "message",
	message: {
		role: "developer",
		content: "System recap text for the session",
		timestamp: 500,
	},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Transcript row components", () => {
	it("developer row renders with content", () => {
		const html = renderToStaticMarkup(<DeveloperRow content="recap text here" timestamp="2024-01-01T00:00:00Z" />);
		expect(html).toContain("system");
		expect(html).toContain("recap text here");
	});

	it("developer row is collapsed by default (preview shown)", () => {
		const html = renderToStaticMarkup(<DeveloperRow content="recap text" timestamp="2024-01-01T00:00:00Z" />);
		// Should show the preview in the toggle button
		expect(html).toContain("tr-developer-preview");
		// Should NOT show the expanded body
		expect(html).not.toContain("tr-developer-body");
	});

	it("thinking row is collapsed by default", () => {
		const html = renderToStaticMarkup(<ThinkingRow text="internal reasoning" />);
		expect(html).toContain("thinking");
		expect(html).not.toContain("internal reasoning");
	});

	it("thinking row expands when expandAll is true", () => {
		const html = renderToStaticMarkup(<ThinkingRow text="internal reasoning" expandAll />);
		expect(html).toContain("internal reasoning");
	});

	it("image-only pending item renders an <img>", () => {
		const img = dataUrlToImage(
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		);
		expect(img).not.toBeNull();
		const html = renderToStaticMarkup(<UserRow content={[img!]} timestamp="" pending={true} />);
		expect(html).toContain("tr-row--pending");
		expect(html).toContain("<img");
		expect(html).toContain('class="tr-msg-img"');
		expect(html).toContain('src="data:image/png;base64,');
	});

	it("flattenEntries converts image-only pending user message to visible image row", () => {
		const items = flattenEntries(
			[],
			new Map(),
			new Map(),
			new Map(),
			false,
			[
				{
					text: "",
					images: [
						"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
					],
				},
			],
			new Map(),
		);
		expect(items).toHaveLength(2);
		expect(items[0].kind).toBe("user");
		expect(items[1].kind).toBe("shimmer");
		const userItem = items[0] as {
			kind: "user";
			content: Parameters<typeof UserRow>[0]["content"];
			pending: boolean;
		};
		expect(userItem.pending).toBe(true);
		const html = renderToStaticMarkup(<UserRow content={userItem.content} timestamp="" pending={userItem.pending} />);
		expect(html).toContain("<img");
		expect(html).toContain('class="tr-msg-img"');
	});
});

describe("transcript-model developer inclusion", () => {
	it("developer messages produce entries", () => {
		const state = applyHistoryPage(
			emptyTranscriptState(),
			{
				leafId: "entry-u1",
				entries: [DEVELOPER_ENTRY, USER_ENTRY],
				hasMore: false,
				live: [],
			},
			{ older: false },
		);
		expect(state.entries).toHaveLength(2);
		expect(state.entries[0].type).toBe("message");
		if (state.entries[0].type === "message") {
			expect(state.entries[0].message.role).toBe("developer");
		}
	});
});

describe("transcript scroll compensation (column-reverse scroller)", () => {
	const viewportTop = 100;

	it("compensates growth of a row below the viewport", () => {
		expect(scrollCompensation(900, 40, viewportTop)).toBe(40);
	});

	it("compensates growth of a visible row so it grows downward", () => {
		expect(scrollCompensation(300, 40, viewportTop)).toBe(40);
	});

	it("compensates a streaming row that spans the whole viewport", () => {
		// Its top is far above, but it grows at its bottom edge, below the viewport top.
		expect(scrollCompensation(800, 40, viewportTop)).toBe(40);
	});

	it("ignores rows ending above the viewport, including first renders of prepended rows", () => {
		expect(scrollCompensation(-500, 300, viewportTop)).toBe(0);
		expect(scrollCompensation(99, 300, viewportTop)).toBe(0);
	});

	it("returns negative corrections for rows shrinking or removed below the viewport top", () => {
		expect(scrollCompensation(900, -30, viewportTop)).toBe(-30);
	});
});

describe("TranscriptView loading states", () => {
	it("renders Loading history… spinner when historyLoaded is false and connection is ready", () => {
		const html = renderToStaticMarkup(
			<TranscriptView
				state={emptyTranscriptState()}
				historyLoaded={false}
				connection="ready"
				streaming={false}
				expandAll={false}
			/>,
		);
		expect(html).toContain("Loading history…");
		expect(html).toContain("tr-spin");
		expect(html).not.toContain("no activity yet");
	});

	it("renders Connecting… spinner when historyLoaded is false and connection is connecting", () => {
		const html = renderToStaticMarkup(
			<TranscriptView
				state={emptyTranscriptState()}
				historyLoaded={false}
				connection="connecting"
				streaming={false}
				expandAll={false}
			/>,
		);
		expect(html).toContain("Connecting…");
		expect(html).toContain("tr-spin");
		expect(html).not.toContain("no activity yet");
	});

	it("renders 'no activity yet' only after history loaded and empty", () => {
		const html = renderToStaticMarkup(
			<TranscriptView
				state={emptyTranscriptState()}
				historyLoaded={true}
				connection="ready"
				streaming={false}
				expandAll={false}
			/>,
		);
		expect(html).toContain("no activity yet");
		expect(html).not.toContain("Loading history…");
		expect(html).not.toContain("Connecting…");
	});
});
