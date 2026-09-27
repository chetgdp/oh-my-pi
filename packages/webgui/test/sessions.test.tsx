import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { LiveSessionRow, PastSessionRow } from "../src/components/sessions/SessionRow";
import type { LiveSessionEntry } from "../src/server/live";
import type { PastSessionSummary } from "../src/server/past";

const noop = (): void => {};

const LIVE_ENTRY: LiveSessionEntry = {
	version: 1,
	instanceId: "inst-1",
	pid: 1234,
	cwd: "/Users/dev/project",
	startedAt: Date.now() - 60_000,
	createdAt: Date.now() - 120_000,
	sessionId: "s1",
	sessionName: "My Session",
	model: "claude-opus-4",
	origin: "cli",
	recap: null,
};

const PAST_ENTRY: PastSessionSummary = {
	id: "past-1",
	path: "/sessions/past-1.json",
	cwd: "/Users/dev/old-project",
	name: "Old Session",
	createdAt: Date.now() - 86_400_000,
	modifiedAt: Date.now() - 86_400_000,
	messageCount: 10,
	firstUserMessage: "Hello there",
};

describe("LiveSessionRow", () => {
	it("renders session name and model", () => {
		const html = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: LIVE_ENTRY,
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(html).toContain("My Session");
		expect(html).toContain("claude-opus-4");
	});

	it("renders the recap and its age only when present", () => {
		const render = (entry: LiveSessionEntry): string =>
			renderToStaticMarkup(createElement(LiveSessionRow, { entry, current: false, onAttach: noop, onShutdown: noop }));
		const withRecap = render({ ...LIVE_ENTRY, recap: { text: "Fixing the home page.", createdAt: Date.now() - 300_000 } });
		expect(withRecap).toContain("Fixing the home page.");
		expect(withRecap).toContain("recap 5m ago");
		expect(render(LIVE_ENTRY)).not.toContain("ses-recap");
	});

	it("highlights current session", () => {
		const html = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: LIVE_ENTRY,
				current: true,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(html).toContain("ses-row--current");
	});

	it("shows Stop button in unarmed state", () => {
		const html = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: LIVE_ENTRY,
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(html).toContain("Stop");
		expect(html).not.toContain("Confirm?");
	});

	it("does not use alert or confirm dialogs", () => {
		const html = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: LIVE_ENTRY,
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(html).not.toContain("alert(");
		expect(html).not.toContain("confirm(");
	});

	it("shows busy indicator", () => {
		const html = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: LIVE_ENTRY,
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(html).toContain("ses-busy-dot");
	});

	it("shows shortened cwd", () => {
		const html = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: LIVE_ENTRY,
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(html).toContain("project");
	});

	it("renders GUI badge when origin is gui", () => {
		const html = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: { ...LIVE_ENTRY, origin: "gui" },
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(html).toContain("ses-badge--gui");
		expect(html).toContain("GUI");
	});

	it("omits GUI badge when origin is cli or unknown", () => {
		const htmlCli = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: { ...LIVE_ENTRY, origin: "cli" },
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(htmlCli).not.toContain("ses-badge--gui");

		const htmlUnknown = renderToStaticMarkup(
			createElement(LiveSessionRow, {
				entry: { ...LIVE_ENTRY, origin: "unknown" },
				current: false,
				onAttach: noop,
				onShutdown: noop,
			}),
		);
		expect(htmlUnknown).not.toContain("ses-badge--gui");
	});
});

describe("PastSessionRow", () => {
	it("renders session name", () => {
		const html = renderToStaticMarkup(
			createElement(PastSessionRow, {
				entry: PAST_ENTRY,
				pending: false,
				onResume: noop,
			}),
		);
		expect(html).toContain("Old Session");
	});

	it("shows pending state on the row only", () => {
		const html = renderToStaticMarkup(
			createElement(PastSessionRow, {
				entry: PAST_ENTRY,
				pending: true,
				onResume: noop,
			}),
		);
		expect(html).toContain("ses-row--pending");
		expect(html).toContain("Resuming...");
	});

	it("does not show pending when not resuming", () => {
		const html = renderToStaticMarkup(
			createElement(PastSessionRow, {
				entry: PAST_ENTRY,
				pending: false,
				onResume: noop,
			}),
		);
		expect(html).not.toContain("ses-row--pending");
		expect(html).not.toContain("Resuming...");
	});

	it("uses displayName for entries without name", () => {
		const noName: PastSessionSummary = {
			...PAST_ENTRY,
			name: null,
			firstUserMessage: "Fix the bug in auth",
		};
		const html = renderToStaticMarkup(
			createElement(PastSessionRow, {
				entry: noName,
				pending: false,
				onResume: noop,
			}),
		);
		expect(html).toContain("Fix the bug in auth");
	});
});
