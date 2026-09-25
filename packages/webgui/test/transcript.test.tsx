import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { applyHistoryPage, emptyTranscriptState } from "../src/lib/transcript-model";
import { DeveloperRow } from "../src/components/transcript/rows/DeveloperRow";
import { ThinkingRow } from "../src/components/transcript/rows/ThinkingRow";
import { UserRow } from "../src/components/transcript/rows/UserRow";
import { flattenEntries, shouldAdjustScrollOnItemSizeChange } from "../src/components/transcript/Transcript";
import { dataUrlToImage } from "../src/lib/session-actions";

/**
 * TranscriptView uses @tanstack/react-virtual which requires a real DOM with
 * layout measurements (scrollHeight, clientHeight, getBoundingClientRect).
 * Bun's test DOM (via renderToStaticMarkup / happy-dom) does not provide these,
 * so we test the row components directly rather than fighting virtualizer mocks.
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
		const img = dataUrlToImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
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
			[{ text: "", images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="] }],
			new Map(),
		);
		expect(items).toHaveLength(2);
		expect(items[0].kind).toBe("user");
		expect(items[1].kind).toBe("shimmer");
		const userItem = items[0] as { kind: "user"; content: Parameters<typeof UserRow>[0]["content"]; pending: boolean };
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

describe("transcript scroll anchoring and paging threshold", () => {
	it("suppresses scroll adjustment on first measurement of newly prepended rows", () => {
		// First measurements of items entering the viewport from above must return false
		// so that the viewport is not shifted downward while the user scrolls up.
		const adjust = shouldAdjustScrollOnItemSizeChange(
			{ end: 400 },
			false, // no cached size (first measurement)
			1000,
			0,
			"backward",
		);
		expect(adjust).toBe(false);
	});

	it("allows scroll adjustment on subsequent resize of row above viewport when not scrolling up", () => {
		// When a row above the viewport resizes (e.g. an image loads or a tool card expands)
		// while the user is stationary or scrolling down, adjust scroll to keep reading position stable.
		const adjust = shouldAdjustScrollOnItemSizeChange(
			{ end: 400 },
			true, // previously measured
			1000, // scrollOffset is below item.end
			0,
			null, // stationary
		);
		expect(adjust).toBe(true);
	});

	it("suppresses scroll adjustment during backward scroll even for previously measured rows", () => {
		// When actively scrolling upward, never push the viewport downward.
		const adjust = shouldAdjustScrollOnItemSizeChange(
			{ end: 400 },
			true,
			1000,
			0,
			"backward",
		);
		expect(adjust).toBe(false);
	});

	it("suppresses scroll adjustment for rows below or spanning the fold", () => {
		// Rows below the top fold do not displace content above them.
		const adjust = shouldAdjustScrollOnItemSizeChange(
			{ end: 1200 },
			true,
			1000,
			0,
			null,
		);
		expect(adjust).toBe(false);
	});
});
