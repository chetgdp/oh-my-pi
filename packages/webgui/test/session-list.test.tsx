import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SessionListView } from "../src/components/shell/SessionList";
import type { LiveSessionEntry } from "../src/server/live";
import type { PastSessionSummary } from "../src/server/past";

const noop = (): void => {};

const LIVE: LiveSessionEntry[] = [
	{
		version: 1,
		instanceId: "inst-1",
		pid: 1234,
		cwd: "/Users/dev/project",
		startedAt: Date.now() - 60_000,
		createdAt: Date.now() - 120_000,
		sessionId: "s1",
		sessionName: "My Session",
		model: "claude-opus-4",
	},
];

const PAST: PastSessionSummary[] = [
	{
		id: "past-1",
		path: "/sessions/past-1.jsonl",
		cwd: "/Users/dev/other",
		name: null,
		createdAt: Date.now() - 86_400_000,
		modifiedAt: Date.now() - 3_600_000,
		messageCount: 12,
		firstUserMessage: "Fix the build",
	},
];

describe("SessionListView", () => {
	it("renders live session rows", () => {
		const html = renderToStaticMarkup(
			createElement(SessionListView, {
				live: LIVE,
				past: [],
				onAttach: noop,
				onResume: noop,
				onShutdown: noop,
				onLaunch: noop,
				shuttingDown: null,
				launchCwd: "/tmp",
				onLaunchCwdChange: noop,
				pendingAction: null,
			}),
		);
		expect(html).toContain("My Session");
		expect(html).toContain("dev/project");
		expect(html).toContain("claude-opus-4");
		expect(html).toContain("pid 1234");
		expect(html).toContain("Shut down");
	});

	it("renders past session rows", () => {
		const html = renderToStaticMarkup(
			createElement(SessionListView, {
				live: [],
				past: PAST,
				onAttach: noop,
				onResume: noop,
				onShutdown: noop,
				onLaunch: noop,
				shuttingDown: null,
				launchCwd: "/tmp",
				onLaunchCwdChange: noop,
				pendingAction: null,
			}),
		);
		expect(html).toContain("Fix the build");
		expect(html).toContain("dev/other");
	});

	it("shows no-live-sessions text when list is empty", () => {
		const html = renderToStaticMarkup(
			createElement(SessionListView, {
				live: [],
				past: [],
				onAttach: noop,
				onResume: noop,
				onShutdown: noop,
				onLaunch: noop,
				shuttingDown: null,
				launchCwd: "",
				onLaunchCwdChange: noop,
				pendingAction: null,
			}),
		);
		expect(html).toContain("No live sessions");
	});

	it("shows shutdown button per live row", () => {
		const html = renderToStaticMarkup(
			createElement(SessionListView, {
				live: LIVE,
				past: [],
				onAttach: noop,
				onResume: noop,
				onShutdown: noop,
				onLaunch: noop,
				shuttingDown: null,
				launchCwd: "",
				onLaunchCwdChange: noop,
				pendingAction: null,
			}),
		);
		expect(html).toContain("Shut down");
	});

	it("shows confirm text when shutting down", () => {
		const html = renderToStaticMarkup(
			createElement(SessionListView, {
				live: LIVE,
				past: [],
				onAttach: noop,
				onResume: noop,
				onShutdown: noop,
				onLaunch: noop,
				shuttingDown: "inst-1",
				launchCwd: "",
				onLaunchCwdChange: noop,
				pendingAction: null,
			}),
		);
		expect(html).toContain("Confirm?");
		expect(html).not.toContain("Shut down");
	});

	it("renders new session section with start button", () => {
		const html = renderToStaticMarkup(
			createElement(SessionListView, {
				live: [],
				past: [],
				onAttach: noop,
				onResume: noop,
				onShutdown: noop,
				onLaunch: noop,
				shuttingDown: null,
				launchCwd: "/home/dev",
				onLaunchCwdChange: noop,
				pendingAction: null,
			}),
		);
		expect(html).toContain("New session");
		expect(html).toContain("Start");
		expect(html).toContain('value="/home/dev"');
	});

	it("shows pending action text", () => {
		const html = renderToStaticMarkup(
			createElement(SessionListView, {
				live: [],
				past: [],
				onAttach: noop,
				onResume: noop,
				onShutdown: noop,
				onLaunch: noop,
				shuttingDown: null,
				launchCwd: "",
				onLaunchCwdChange: noop,
				pendingAction: "Started; waiting for it to appear\u2026",
			}),
		);
		expect(html).toContain("Started; waiting");
	});
});
