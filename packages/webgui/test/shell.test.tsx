import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusStrip } from "../src/components/shell/StatusStrip";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { TopBar } from "../src/components/shell/TopBar";
import { AppShell } from "../src/components/shell/AppShell";

describe("TopBar", () => {
	test("renders session name as title", () => {
		const html = renderToStaticMarkup(
			<TopBar
				title="my-session"
				connection="ready"
				route={{ kind: "session", id: "x", panel: null }}
			/>,
		);
		expect(html).toContain("my-session");
		expect(html).toContain("tb-dot-ready");
	});

	test("sessions route shows only the title", () => {
		const html = renderToStaticMarkup(
			<TopBar
				title="omp"
				connection="closed"
				route={{ kind: "sessions" }}
			/>,
		);
		expect(html).toContain("omp");
		expect(html).not.toContain("tb-dot");
		expect(html).not.toContain("tb-panel-btn");
		expect(html).not.toContain("tb-back");
	});

	test("connecting state uses connecting dot class", () => {
		const html = renderToStaticMarkup(
			<TopBar
				title="t"
				connection="connecting"
				route={{ kind: "session", id: "x", panel: null }}
			/>,
		);
		expect(html).toContain("tb-dot-connecting");
	});

	test("back button has accessible label", () => {
		const html = renderToStaticMarkup(
			<TopBar
				title="t"
				connection="ready"
				route={{ kind: "session", id: "x", panel: null }}
			/>,
		);
		expect(html).toContain('aria-label="Back to sessions"');
	});

	test("agents panel button shows active state", () => {
		const html = renderToStaticMarkup(
			<TopBar
				title="t"
				connection="ready"
				route={{ kind: "session", id: "x", panel: "agents" }}
			/>,
		);
		expect(html).toContain('data-active="true"');
	});

	test("info panel button shows active state", () => {
		const html = renderToStaticMarkup(
			<TopBar
				title="t"
				connection="ready"
				route={{ kind: "session", id: "x", panel: "info" }}
			/>,
		);
		// Both panel buttons rendered; one should be active
		expect(html).toContain('data-active="true"');
		expect(html).toContain('aria-label="Toggle info panel"');
	});
});

describe("AppShell", () => {
	test("renders grid areas with slots", () => {
		const html = renderToStaticMarkup(
			<AppShell
				topbar={<div>Top</div>}
				composer={<div>Comp</div>}
			>
				<p>transcript content</p>
			</AppShell>,
		);
		expect(html).toContain("Top");
		expect(html).toContain("transcript content");
		expect(html).toContain("Comp");
		expect(html).toContain("sh-app");
		expect(html).toContain("sh-topbar");
		expect(html).toContain("sh-transcript");
		expect(html).toContain("sh-composer");
	});

	test("renders sidebar and inspector when provided", () => {
		const html = renderToStaticMarkup(
			<AppShell
				topbar={<div>Top</div>}
				sidebar={<div>Side</div>}
				inspector={<div>Inspect</div>}
				composer={<div>Comp</div>}
			>
				<p>main</p>
			</AppShell>,
		);
		expect(html).toContain("sh-sidebar");
		expect(html).toContain("Side");
		expect(html).toContain("sh-inspector");
		expect(html).toContain("Inspect");
	});
});

function makeSessionState(overrides?: Partial<RpcSessionState>): RpcSessionState {
	return {
		model: { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", provider: "google" },
		thinkingLevel: "medium",
		isStreaming: false,
		isCompacting: false,
		steeringMode: "one-at-a-time",
		followUpMode: "one-at-a-time",
		interruptMode: "immediate",
		sessionFile: "/tmp/test.json",
		sessionId: "s1",
		sessionName: "Test Session",
		autoCompactionEnabled: true,
		queuedMessageCount: 0,
		todoPhases: [],
		fastModeEnabled: false,
		tokensPerSecond: null,
		fastModeActive: false,
		messageCount: 5,
		systemPrompt: [],
		dumpTools: [],
		contextUsage: { tokens: 1000, contextWindow: 200000, percent: 1 },
		...overrides,
	} as unknown as RpcSessionState;
}

function makeStats(overrides?: Partial<SessionStats>): SessionStats {
	return {
		cost: 0.09,
		tokens: {
			total: 522400,
			input: 500000,
			output: 22400,
			cacheRead: 0,
			cacheWrite: 0,
		},
		...overrides,
	} as unknown as SessionStats;
}

describe("StatusStrip", () => {
	test("renders left and right groups with model, thinking, cost, and tokens", () => {
		const html = renderToStaticMarkup(
			<StatusStrip
				sessionState={makeSessionState()}
				stats={makeStats()}
				streaming={false}
				expandAll={false}
				onToggleExpand={() => {}}
				onPickModel={() => {}}
				onPickThinking={() => {}}
			/>,
		);

		expect(html).toContain("ss-group--left");
		expect(html).toContain("ss-group--right");
		expect(html).toContain("Gemini 3.8 Flash");
		expect(html).toContain("ss-model");
		expect(html).toContain("medium");
		expect(html).toContain("$0.09");
		expect(html).toContain("522.4k");
		expect(html).not.toContain("522.4k tok");
		expect(html).toContain("▶ tools");
		expect(html).not.toContain("streaming");
	});

	test("shows streaming indicator and pulse dot when streaming is true", () => {
		const html = renderToStaticMarkup(
			<StatusStrip
				sessionState={makeSessionState()}
				stats={makeStats()}
				streaming={true}
				expandAll={false}
				onToggleExpand={() => {}}
				onPickModel={() => {}}
				onPickThinking={() => {}}
			/>,
		);

		expect(html).toContain("ss-indicator");
		expect(html).toContain("ss-dot");
		expect(html).toContain("streaming");
	});

	test("shows compacting indicator when isCompacting is true", () => {
		const html = renderToStaticMarkup(
			<StatusStrip
				sessionState={makeSessionState({ isCompacting: true })}
				stats={makeStats()}
				streaming={false}
				expandAll={false}
				onToggleExpand={() => {}}
				onPickModel={() => {}}
				onPickThinking={() => {}}
			/>,
		);

		expect(html).toContain("ss-indicator");
		expect(html).toContain("compacting");
	});

	test("shows expanded tools indicator when expandAll is true", () => {
		const html = renderToStaticMarkup(
			<StatusStrip
				sessionState={makeSessionState()}
				stats={null}
				streaming={false}
				expandAll={true}
				onToggleExpand={() => {}}
				onPickModel={() => {}}
				onPickThinking={() => {}}
			/>,
		);

		expect(html).toContain("▼ tools");
	});
});
