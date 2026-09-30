import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test, vi } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { StatusStrip } from "../src/components/shell/StatusStrip";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { TopBar } from "../src/components/shell/TopBar";
import { AppShell } from "../src/components/shell/AppShell";
import { ConnectionBanner } from "../src/components/shell/ConnectionBanner";

// Exception: react-dom/client must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

interface TestMount {
	container: HTMLElement;
	rerender(nextUi: ReactElement): void;
	cleanup(): void;
}
function mount(ui: ReactElement): TestMount {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		rerender(nextUi: ReactElement) {
			act(() => {
				root.render(nextUi);
			});
		},
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
}
describe("TopBar", () => {
	test("renders session name as title", () => {
		const html = renderToStaticMarkup(
			<TopBar title="my-session" connection="ready" route={{ kind: "session", id: "x", panel: null }} />,
		);
		expect(html).toContain("my-session");
		expect(html).toContain("tb-dot-ready");
	});

	test("sessions route shows only the title", () => {
		const html = renderToStaticMarkup(<TopBar title="omp" connection="closed" route={{ kind: "sessions" }} />);
		expect(html).toContain("omp");
		expect(html).not.toContain("tb-dot");
		expect(html).not.toContain("tb-panel-btn");
		expect(html).not.toContain("tb-back");
	});

	test("connecting state uses connecting dot class and renders connecting label", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" connection="connecting" route={{ kind: "session", id: "x", panel: null }} />,
		);
		expect(html).toContain("tb-dot-connecting");
		expect(html).toContain("tb-conn-label--connecting");
		expect(html).toContain("Connecting");
	});

	test("closed state renders disconnected label with closed modifier", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" connection="closed" route={{ kind: "session", id: "x", panel: null }} />,
		);
		expect(html).toContain("tb-dot-closed");
		expect(html).toContain("tb-conn-label--closed");
		expect(html).toContain("Disconnected");
	});

	test("ready state renders connected label with ready modifier", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" connection="ready" route={{ kind: "session", id: "x", panel: null }} />,
		);
		expect(html).toContain("tb-dot-ready");
		expect(html).toContain("tb-conn-label--ready");
		expect(html).toContain("Connected");
	});
	test("back button has accessible label", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" connection="ready" route={{ kind: "session", id: "x", panel: null }} />,
		);
		expect(html).toContain('aria-label="Back to sessions"');
	});

	test("hub button shows active state", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" connection="ready" route={{ kind: "session", id: "x", panel: "hub" }} />,
		);
		expect(html).toContain('data-active="true"');
	});

	test("info panel button shows active state", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" connection="ready" route={{ kind: "session", id: "x", panel: "info" }} />,
		);
		// Both panel buttons rendered; one should be active
		expect(html).toContain('data-active="true"');
		expect(html).toContain('aria-label="Toggle info panel"');
	});
});

describe("AppShell", () => {
	test("renders grid areas with slots", () => {
		const html = renderToStaticMarkup(
			<AppShell topbar={<div>Top</div>} composer={<div>Comp</div>}>
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

	test("collapses to one column only when both side slots are absent", () => {
		const solo = renderToStaticMarkup(
			<AppShell topbar={<div />} composer={<div />}>
				<p />
			</AppShell>,
		);
		const sided = renderToStaticMarkup(
			<AppShell topbar={<div />} sidebar={<div />} composer={<div />}>
				<p />
			</AppShell>,
		);
		expect(solo).toContain('class="sh-app sh-app--solo"');
		const inspected = renderToStaticMarkup(
			<AppShell topbar={<div />} sidebar={<div />} inspector={<div />} composer={<div />}>
				<p />
			</AppShell>,
		);
		// A sidebar without an inspector must not reserve the inspector track.
		expect(sided).toContain('class="sh-app sh-app--no-inspector"');
		expect(inspected).toContain('class="sh-app"');
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
	test("renders left and right groups with model, thinking, cost, and context usage", () => {
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
		expect(html).toContain("1% / 200K");
		expect(html).toContain("ss-ctx--normal");
		expect(html).toContain("$0.09");
		expect(html).not.toContain("522.4k");
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

describe("ConnectionBanner", () => {
	test("does not render when connection is ready", () => {
		const m = mount(<ConnectionBanner connection="ready" />);
		expect(m.container.querySelector(".conn-banner")).toBeNull();
		m.cleanup();
	});

	test("shows incompatible immediately without delay", () => {
		const m = mount(<ConnectionBanner connection="incompatible" />);
		const banner = m.container.querySelector(".conn-banner");
		expect(banner).not.toBeNull();
		expect(banner?.textContent).toContain("This omp is too old, restart it");
		expect(m.container.querySelector(".conn-banner-btn")).toBeNull();
		m.cleanup();
	});

	test("shows closed immediately without delay", () => {
		const onReconnect = vi.fn();
		const m = mount(<ConnectionBanner connection="closed" onReconnect={onReconnect} />);
		const banner = m.container.querySelector(".conn-banner");
		expect(banner).not.toBeNull();
		expect(banner?.textContent).toContain("WebSocket disconnected from host");
		const btn = m.container.querySelector(".conn-banner-btn") as HTMLButtonElement | null;
		expect(btn).not.toBeNull();
		btn?.click();
		expect(onReconnect).toHaveBeenCalledTimes(1);
		m.cleanup();
	});

	test("reconnecting banner not rendered before 1s, rendered after", () => {
		vi.useFakeTimers();
		try {
			const m = mount(<ConnectionBanner connection="reconnecting" />);
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(500);
			});
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(500);
			});
			expect(m.container.querySelector(".conn-banner")).not.toBeNull();
			expect(m.container.querySelector(".conn-banner")?.textContent).toContain("Reconnecting to host...");
			m.cleanup();
		} finally {
			vi.useRealTimers();
		}
	});

	test("connecting banner not rendered before 1s, rendered after", () => {
		vi.useFakeTimers();
		try {
			const m = mount(<ConnectionBanner connection="connecting" />);
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(999);
			});
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(1);
			});
			expect(m.container.querySelector(".conn-banner")).not.toBeNull();
			expect(m.container.querySelector(".conn-banner")?.textContent).toContain("Connecting to host...");
			m.cleanup();
		} finally {
			vi.useRealTimers();
		}
	});

	test("clears timer and stays hidden on rapid reconnect before 1s", () => {
		vi.useFakeTimers();
		try {
			const m = mount(<ConnectionBanner connection="reconnecting" />);
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(300);
			});
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			m.rerender(<ConnectionBanner connection="ready" />);
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(1000);
			});
			expect(m.container.querySelector(".conn-banner")).toBeNull();
			m.cleanup();
		} finally {
			vi.useRealTimers();
		}
	});

	test("injected delayMs works for custom delay timing", () => {
		vi.useFakeTimers();
		try {
			const m = mount(<ConnectionBanner connection="reconnecting" delayMs={200} />);
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(199);
			});
			expect(m.container.querySelector(".conn-banner")).toBeNull();

			act(() => {
				vi.advanceTimersByTime(1);
			});
			expect(m.container.querySelector(".conn-banner")).not.toBeNull();
			m.cleanup();
		} finally {
			vi.useRealTimers();
		}
	});

	test("injected delayMs <= 0 renders immediately", () => {
		const m = mount(<ConnectionBanner connection="reconnecting" delayMs={0} />);
		expect(m.container.querySelector(".conn-banner")).not.toBeNull();
		m.cleanup();
	});

	test("shows attempt count suffix when attempt > 1", () => {
		const m = mount(<ConnectionBanner connection="reconnecting" attempt={3} delayMs={0} />);
		expect(m.container.querySelector(".conn-banner")?.textContent).toContain("Reconnecting to host... (attempt 3)");
		m.cleanup();
	});

	test("reconnect action fires callback", () => {
		const onReconnect = vi.fn();
		const m = mount(<ConnectionBanner connection="reconnecting" onReconnect={onReconnect} delayMs={0} />);
		const btn = m.container.querySelector(".conn-banner-btn") as HTMLButtonElement | null;
		expect(btn).not.toBeNull();
		btn?.click();
		expect(onReconnect).toHaveBeenCalledTimes(1);
		m.cleanup();
	});

	test("banner element is not in transcript flow and CSS positions absolutely", () => {
		const css = readFileSync(new URL("../src/components/shell/shell.css", import.meta.url), "utf-8");
		const transcriptCss = readFileSync(
			new URL("../src/components/transcript/transcript.css", import.meta.url),
			"utf-8",
		);
		expect(css).toMatch(/\.sh-transcript\s*\{[^}]*position:\s*relative/);
		expect(css).toMatch(/\.sh-transcript\s*\{[^}]*overflow:\s*hidden/);
		expect(css).toMatch(/\.conn-banner\s*\{[^}]*position:\s*absolute/);
		expect(transcriptCss).toMatch(/\.tr-root\s*\{[^}]*overflow-y:\s*auto/);

		const html = renderToStaticMarkup(
			<AppShell topbar={<div>Top</div>} composer={<div>Comp</div>}>
				<ConnectionBanner connection="incompatible" />
				<div className="tr-root">Transcript</div>
			</AppShell>,
		);
		expect(html).toContain('class="sh-transcript"');
		expect(html).toContain('class="conn-banner"');
		expect(html).toContain('class="tr-root"');
	});
});
