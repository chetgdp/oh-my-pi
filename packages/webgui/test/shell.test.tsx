import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../src/components/shell/AppShell";
import { HeaderBar } from "../src/components/shell/HeaderBar";

describe("HeaderBar", () => {
	test("renders title and connection class", () => {
		const html = renderToStaticMarkup(
			<HeaderBar
				title="my-session"
				connection="ready"
				onOpenSessions={() => {}}
			/>,
		);
		expect(html).toContain("my-session");
		expect(html).toContain("sh-dot-ready");
	});

	test("renders subtitle when provided", () => {
		const html = renderToStaticMarkup(
			<HeaderBar
				title="t"
				subtitle="sub-info"
				connection="connecting"
				onOpenSessions={() => {}}
			/>,
		);
		expect(html).toContain("sub-info");
		expect(html).toContain("sh-dot-connecting");
	});

	test("closed connection state", () => {
		const html = renderToStaticMarkup(
			<HeaderBar
				title="t"
				connection="closed"
				onOpenSessions={() => {}}
			/>,
		);
		expect(html).toContain("sh-dot-closed");
	});

	test("sessions button has accessible label", () => {
		const html = renderToStaticMarkup(
			<HeaderBar
				title="t"
				connection="ready"
				onOpenSessions={() => {}}
			/>,
		);
		expect(html).toContain('aria-label="Open sessions"');
	});
});

describe("AppShell", () => {
	test("renders header, children, and composer slots", () => {
		const html = renderToStaticMarkup(
			<AppShell
				header={<div data-testid="h">Header</div>}
				composer={<div data-testid="c">Composer</div>}
			>
				<p>transcript content</p>
			</AppShell>,
		);
		expect(html).toContain("Header");
		expect(html).toContain("transcript content");
		expect(html).toContain("Composer");
		expect(html).toContain("sh-app");
		expect(html).toContain("sh-transcript");
		expect(html).toContain("sh-composer");
	});
});
