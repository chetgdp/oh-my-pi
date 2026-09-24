import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { applyHistoryPage, emptyTranscriptState } from "../src/lib/transcript-model";
import { DeveloperRow } from "../src/components/transcript/rows/DeveloperRow";
import { ThinkingRow } from "../src/components/transcript/rows/ThinkingRow";

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
