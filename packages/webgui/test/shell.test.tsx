import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
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
