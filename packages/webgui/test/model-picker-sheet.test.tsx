import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
	RpcModelBrowserResult,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import {
	ModelPickerSheet,
	filterBrowserModels,
	groupPickerModels,
	moveHighlight,
	formatPerf,
} from "../src/components/models/ModelPickerSheet";
import type { ModelPickerSheetProps } from "../src/components/models/contract";

const BROWSER_FIXTURE: RpcModelBrowserResult = {
	mruOrder: ["anthropic/claude-3-7-sonnet", "openai/gpt-4o"],
	kinds: ["chat", "fast", "reasoning"],
	providers: [
		{ id: "anthropic", authenticated: true, discoverable: true, modelCount: 2 },
		{ id: "openai", authenticated: true, discoverable: false, modelCount: 1 },
		{ id: "ollama", authenticated: false, discoverable: true, modelCount: 1 },
	],
	models: [
		{
			provider: "anthropic",
			id: "claude-3-7-sonnet",
			name: "Claude 3.7 Sonnet",
			selector: "anthropic/claude-3-7-sonnet",
			kind: "reasoning",
			locked: false,
			perf: { samples: 5, tps: 64.2, ttftMs: 1234 },
			roles: [{ role: "default", auto: false }],
			tag: "recommended",
		},
		{
			provider: "anthropic",
			id: "claude-3-5-haiku",
			name: "Claude 3.5 Haiku",
			selector: "anthropic/claude-3-5-haiku",
			kind: "fast",
			locked: false,
			perf: { samples: 10, tps: 110.8, ttftMs: 850 },
			roles: [{ role: "fast", auto: true }],
		},
		{
			provider: "openai",
			id: "gpt-4o",
			name: "GPT-4o",
			selector: "openai/gpt-4o",
			kind: "chat",
			locked: false,
			roles: [],
		},
		{
			provider: "ollama",
			id: "llama3",
			name: "Llama 3",
			selector: "ollama/llama3",
			kind: "chat",
			locked: true,
			roles: [],
		},
	],
};

const noop = (): void => {};

describe("pure helpers", () => {
	test("moveHighlight wraps at both ends", () => {
		expect(moveHighlight(0, -1, 4)).toBe(3);
		expect(moveHighlight(3, 1, 4)).toBe(0);
		expect(moveHighlight(1, 1, 4)).toBe(2);
		expect(moveHighlight(2, -1, 4)).toBe(1);
		expect(moveHighlight(-1, 1, 4)).toBe(0);
		expect(moveHighlight(-1, -1, 4)).toBe(3);
	});

	test('formatPerf formats 1234ms as "1.2s" and 850ms as "850ms"', () => {
		const p1 = formatPerf({ samples: 1, tps: 64.2, ttftMs: 1234 });
		expect(p1).not.toBeNull();
		expect(p1?.tps).toBe("64 tps");
		expect(p1?.ttft).toBe("1.2s");

		const p2 = formatPerf({ samples: 1, tps: 110.8, ttftMs: 850 });
		expect(p2).not.toBeNull();
		expect(p2?.tps).toBe("111 tps");
		expect(p2?.ttft).toBe("850ms");
	});

	test("filterBrowserModels applies eligible filter before search", () => {
		const res = filterBrowserModels(BROWSER_FIXTURE, {
			eligible: ["anthropic/claude-3-7-sonnet"],
			query: "claude",
		});
		expect(res.map(m => m.selector)).toEqual(["anthropic/claude-3-7-sonnet"]);
	});

	test("filterBrowserModels hides non-eligible models", () => {
		const res = filterBrowserModels(BROWSER_FIXTURE, {
			eligible: ["openai/gpt-4o"],
		});
		expect(res.length).toBe(1);
		expect(res[0].selector).toBe("openai/gpt-4o");
	});

	test("groupPickerModels recent group appears first and contains only MRU models passing kind filter", () => {
		const fastModels = filterBrowserModels(BROWSER_FIXTURE, { kind: "fast" });
		const { recent, groups } = groupPickerModels(fastModels, BROWSER_FIXTURE);

		// claude-3-7-sonnet is reasoning, gpt-4o is chat, claude-3-5-haiku is fast
		// MRU has [claude-3-7-sonnet, gpt-4o]. Neither is "fast", so recent is empty.
		expect(recent.length).toBe(0);
		expect(groups.length).toBe(1);
		expect(groups[0].models[0].selector).toBe("anthropic/claude-3-5-haiku");

		// All kinds
		const allModels = filterBrowserModels(BROWSER_FIXTURE, { kind: "all" });
		const groupedAll = groupPickerModels(allModels, BROWSER_FIXTURE);
		expect(groupedAll.recent.map(m => m.selector)).toEqual([
			"anthropic/claude-3-7-sonnet",
			"openai/gpt-4o",
		]);
	});
});

describe("ModelPickerSheet component", () => {
	const baseProps: ModelPickerSheetProps = {
		open: true,
		title: "Select model",
		browser: BROWSER_FIXTURE,
		mode: { kind: "active" },
		refreshing: null,
		onPick: noop,
		onRefresh: noop,
		onClose: noop,
	};

	test("recent group appears first in rendered output", () => {
		const html = renderToStaticMarkup(<ModelPickerSheet {...baseProps} />);
		const recentIdx = html.indexOf('data-group="recent"');
		const anthropicIdx = html.indexOf('data-provider="anthropic"');
		expect(recentIdx).toBeGreaterThan(-1);
		expect(anthropicIdx).toBeGreaterThan(-1);
		expect(recentIdx).toBeLessThan(anthropicIdx);
	});

	test("eligible filter hides non-eligible", () => {
		const html = renderToStaticMarkup(
			<ModelPickerSheet
				{...baseProps}
				eligible={["anthropic/claude-3-7-sonnet"]}
			/>,
		);
		expect(html).toContain("Claude 3.7 Sonnet");
		expect(html).not.toContain("GPT-4o");
		expect(html).not.toContain("Llama 3");
	});

	test("role chip markup differs between auto and configured (distinct class names)", () => {
		const html = renderToStaticMarkup(<ModelPickerSheet {...baseProps} />);
		expect(html).toContain("mps-role-chip--configured");
		expect(html).toContain("mps-role-chip--auto");
		expect(html).toContain("mps-role-chip-dot--filled");
		expect(html).toContain("mps-role-chip-dot--hollow");
	});

	test("locked row has the disabled marker and dimmed class", () => {
		const html = renderToStaticMarkup(<ModelPickerSheet {...baseProps} />);
		expect(html).toContain("mps-row--dimmed");
		expect(html).toContain("disabled");
		expect(html).toContain('aria-label="locked"');
	});

	test("scope row shows Project/Global only for role mode with project storage", () => {
		// 1. active mode: no Project/Global segmented buttons
		const activeHtml = renderToStaticMarkup(
			<ModelPickerSheet {...baseProps} mode={{ kind: "active" }} />,
		);
		expect(activeHtml).toContain("This session");
		expect(activeHtml).toContain("Persist");
		expect(activeHtml).not.toContain("mps-storage-segmented");
		expect(activeHtml).not.toContain("Project");
		expect(activeHtml).not.toContain("Global");

		// 2. role mode with global storage: no Project/Global buttons
		const roleGlobalHtml = renderToStaticMarkup(
			<ModelPickerSheet
				{...baseProps}
				mode={{
					kind: "role",
					role: {
						id: "default",
						name: "Default",
						section: "chat",
						source: "global",
						provenance: "default",
						custom: false,
						eligible: [],
					},
					storage: "global",
				}}
			/>,
		);
		expect(roleGlobalHtml).not.toContain("mps-storage-segmented");

		// 3. role mode with project storage: when rendered initially (persist false), Project/Global isn't shown until persist is true.
		// Let's verify that the container logic is present for role mode.
		const roleProjectHtml = renderToStaticMarkup(
			<ModelPickerSheet
				{...baseProps}
				mode={{
					kind: "role",
					role: {
						id: "default",
						name: "Default",
						section: "chat",
						source: "global",
						provenance: "default",
						custom: false,
						eligible: [],
					},
					storage: "project",
				}}
			/>,
		);
		expect(roleProjectHtml).toContain("mps-scope-container");
		expect(roleProjectHtml).toContain("This session");
		expect(roleProjectHtml).toContain("Persist");

		// 4. agent mode: no scope row at all
		const agentHtml = renderToStaticMarkup(
			<ModelPickerSheet
				{...baseProps}
				mode={{
					kind: "agent",
					agent: {
						name: "task",
						description: "General task agent",
						source: "built-in",
						patterns: [],
						disabled: false,
						prewalk: { source: "none" },
						advisor: { source: "none" },
						isDefaultTaskAgent: true,
						precedence: { entries: [], winner: 0 },
					},
				}}
			/>,
		);
		expect(agentHtml).not.toContain("mps-scope-container");
		expect(agentHtml).not.toContain("This session");
		expect(agentHtml).not.toContain("Persist");
	});

	test("clear button labels", () => {
		// Role mode shows "Reset to auto"
		const roleHtml = renderToStaticMarkup(
			<ModelPickerSheet
				{...baseProps}
				mode={{
					kind: "role",
					role: {
						id: "default",
						name: "Default",
						section: "chat",
						source: "global",
						provenance: "default",
						custom: false,
						eligible: [],
					},
					storage: "project",
				}}
				onClear={noop}
			/>,
		);
		expect(roleHtml).toContain("Reset to auto");

		// Agent with override shows "Clear override"
		const agentWithOverrideHtml = renderToStaticMarkup(
			<ModelPickerSheet
				{...baseProps}
				mode={{
					kind: "agent",
					agent: {
						name: "task",
						description: "General task agent",
						source: "built-in",
						override: "anthropic/claude-3-5-haiku",
						patterns: [],
						disabled: false,
						prewalk: { source: "none" },
						advisor: { source: "none" },
						isDefaultTaskAgent: true,
						precedence: { entries: [], winner: 0 },
					},
				}}
				onClear={noop}
			/>,
		);
		expect(agentWithOverrideHtml).toContain("Clear override");

		// Agent without override has no clear button
		const agentNoOverrideHtml = renderToStaticMarkup(
			<ModelPickerSheet
				{...baseProps}
				mode={{
					kind: "agent",
					agent: {
						name: "task",
						description: "General task agent",
						source: "built-in",
						patterns: [],
						disabled: false,
						prewalk: { source: "none" },
						advisor: { source: "none" },
						isDefaultTaskAgent: true,
						precedence: { entries: [], winner: 0 },
					},
				}}
				onClear={noop}
			/>,
		);
		expect(agentNoOverrideHtml).not.toContain("Clear override");
	});
});
