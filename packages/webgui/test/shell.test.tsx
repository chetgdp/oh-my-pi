import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { TopBar, formatElapsed } from "../src/components/shell/TopBar";
import type { LiveLine } from "../src/lib/live-line";
import { AppShell } from "../src/components/shell/AppShell";

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
const busyLine: LiveLine = {
	tone: "normal",
	activity: "bash",
	elapsedFrom: 1_000_000,
	ctxPercent: 41,
	ctxLevel: "normal",
	cost: "$0.47",
	retryAt: null,
};

describe("TopBar", () => {
	test("renders title, live line, elapsed, context and cost", () => {
		const html = renderToStaticMarkup(
			<TopBar
				title="my-session"
				line={busyLine}
				now={1_000_000 + 134_000}
				onBack={() => {}}
				ccOpen={false}
				onToggleCc={() => {}}
			/>,
		);
		expect(html).toContain("my-session");
		expect(html).toContain("bash");
		expect(html).toContain("2m14s");
		expect(html).toContain("41%");
		expect(html).toContain("$0.47");
		expect(html).toContain('data-running="true"');
		expect(html).toContain('aria-label="Open control center"');
		expect(html).toContain("tb-grabber");
	});

	test("sessions list (no control center) shows only the title", () => {
		const html = renderToStaticMarkup(<TopBar title="omp" line={null} ccOpen={false} />);
		expect(html).toContain("omp");
		expect(html).not.toContain("tb-back");
		expect(html).not.toContain("tb-pull");
	});

	test("back button has accessible label and no icon/menu buttons remain", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" line={busyLine} now={1_000_000} onBack={() => {}} ccOpen={false} onToggleCc={() => {}} />,
		);
		expect(html).toContain('aria-label="Back to sessions"');
		expect(html).not.toContain("Session actions");
		expect(html).not.toContain("Toggle agent hub");
		expect(html).not.toContain("Toggle info panel");
	});

	test("wait tone and hot context are flagged; offline omits tail", () => {
		const wait = renderToStaticMarkup(
			<TopBar
				title="t"
				line={{ ...busyLine, tone: "wait", activity: "needs you · question", ctxPercent: 88, ctxLevel: "danger" }}
				now={1_060_000}
				ccOpen={false}
				onToggleCc={() => {}}
			/>,
		);
		expect(wait).toContain('data-tone="wait"');
		expect(wait).toContain('data-level="danger"');
		expect(wait).toContain("needs you · question");
		expect(wait).toContain("1m00s");
		const offline = renderToStaticMarkup(
			<TopBar
				title="t"
				line={{
					tone: "normal",
					activity: "reconnect 2",
					elapsedFrom: null,
					ctxPercent: null,
					ctxLevel: "normal",
					cost: null,
					retryAt: 1_004_000,
				}}
				now={1_000_100}
				ccOpen={false}
				onToggleCc={() => {}}
			/>,
		);
		expect(offline).toContain("reconnect 2 in 4s");
		expect(offline).not.toContain("offline");
		expect(offline).not.toContain("tb-live-sep");
	});

	test("open state flips the pull button and hides grabber", () => {
		const html = renderToStaticMarkup(
			<TopBar title="t" line={busyLine} now={1_000_000} ccOpen={true} onToggleCc={() => {}} />,
		);
		expect(html).toContain('aria-label="Close control center"');
		expect(html).toContain('aria-expanded="true"');
		expect(html).not.toContain("tb-grabber");
	});

	test("pull and title buttons toggle the control center", () => {
		let toggles = 0;
		const t = mount(
			<TopBar title="t" line={busyLine} ccOpen={false} onToggleCc={() => toggles++} onBack={() => {}} />,
		);
		const pull = t.container.querySelector(".tb-pull") as unknown as { click(): void };
		const title = t.container.querySelector(".tb-title-btn") as unknown as { click(): void };
		act(() => {
			pull.click();
			title.click();
		});
		expect(toggles).toBe(2);
		t.cleanup();
	});
});

describe("formatElapsed", () => {
	test("formats whole seconds", () => {
		expect(formatElapsed(12_400)).toBe("12s");
		expect(formatElapsed(134_000)).toBe("2m14s");
		expect(formatElapsed(14 * 60_000)).toBe("14m");
		expect(formatElapsed(65 * 60_000)).toBe("1h05m");
		expect(formatElapsed(-5)).toBe("0s");
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

	test("alert sits above the transcript and the now strip below it", () => {
		const html = renderToStaticMarkup(
			<AppShell
				topbar={<div>Top</div>}
				alert={<div className="alert-strip">A</div>}
				now={<div className="now-strip">N</div>}
				composer={<div>Comp</div>}
			>
				<div className="tr-root">Transcript</div>
			</AppShell>,
		);
		const alertAt = html.indexOf('class="alert-strip"');
		const transcriptAt = html.indexOf('class="sh-transcript"');
		const nowAt = html.indexOf('class="now-strip"');
		expect(alertAt).toBeGreaterThan(-1);
		expect(alertAt).toBeLessThan(transcriptAt);
		expect(nowAt).toBeGreaterThan(transcriptAt);
	});
});
