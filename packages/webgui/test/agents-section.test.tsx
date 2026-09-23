import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	AgentRow,
	describePrecedenceEntry,
	prewalkSegment,
	tierOptions,
} from "../src/components/models/AgentRow";
import { AgentsSection } from "../src/components/models/AgentsSection";
import type { RpcAgentInfo, RpcAgentsResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

function createAgent(overrides: Partial<RpcAgentInfo> = {}): RpcAgentInfo {
	return {
		name: "scout",
		description: "Read-only scout",
		source: "builtin",
		patterns: ["anthropic/claude-3-5-sonnet"],
		resolved: { provider: "anthropic", id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
		disabled: false,
		isDefaultTaskAgent: false,
		prewalk: { source: "none" },
		advisor: { source: "none" },
		precedence: {
			entries: [
				{ source: "override", selector: "anthropic/claude-3-5-sonnet" },
				{ source: "defaultRole", selector: "default" },
			],
			winner: 0,
		},
		...overrides,
	};
}

describe("prewalkSegment helper", () => {
	test("returns off for source none", () => {
		expect(prewalkSegment({ source: "none" })).toBe("off");
		expect(prewalkSegment(null)).toBe("off");
		expect(prewalkSegment(undefined)).toBe("off");
	});

	test("returns on for effective @smol from default", () => {
		expect(prewalkSegment({ effective: "@smol", source: "default" })).toBe("on");
		expect(prewalkSegment({ effective: "on", source: "default" })).toBe("on");
	});

	test("returns custom for another selector", () => {
		expect(prewalkSegment({ effective: "anthropic/claude-haiku", source: "override" })).toBe("custom");
		expect(prewalkSegment({ effective: "some-model", source: "frontmatter" })).toBe("custom");
	});

	test("returns off for effective off", () => {
		expect(prewalkSegment({ effective: "off", source: "override" })).toBe("off");
	});
});

describe("describePrecedenceEntry helper", () => {
	test("formats entry as source: selector", () => {
		expect(
			describePrecedenceEntry({ source: "override", selector: "openai/gpt-4o" }),
		).toBe("override: openai/gpt-4o");
		expect(
			describePrecedenceEntry({ source: "frontmatter", selector: "anthropic/sonnet" }),
		).toBe("frontmatter: anthropic/sonnet");
	});
});

describe("tierOptions helper", () => {
	test("contains all expected options including inherit/unset", () => {
		const values = tierOptions.map((opt) => opt.value);
		expect(values).toContain("");
		expect(values).toContain("inherit");
		expect(values).toContain("none");
		expect(values).toContain("auto");
		expect(values).toContain("default");
		expect(values).toContain("flex");
		expect(values).toContain("scale");
		expect(values).toContain("priority");
	});
});

describe("AgentRow and AgentsSection rendering", () => {
	test("disabled agent renders aria-checked false and a dimmed class", () => {
		const agent = createAgent({ disabled: true });
		const html = renderToStaticMarkup(
			<AgentRow
				agent={agent}
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);

		expect(html).toContain('aria-checked="false"');
		expect(html).toContain("ag-row--dimmed");
	});

	test("enabled agent renders aria-checked true and no dimmed class", () => {
		const agent = createAgent({ disabled: false });
		const html = renderToStaticMarkup(
			<AgentRow
				agent={agent}
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);

		expect(html).toContain('aria-checked="true"');
		expect(html).not.toContain("ag-row--dimmed");
	});

	test("default task agent renders the badge and others do not", () => {
		const defaultAgent = createAgent({ name: "task", isDefaultTaskAgent: true });
		const otherAgent = createAgent({ name: "scout", isDefaultTaskAgent: false });

		const defaultHtml = renderToStaticMarkup(
			<AgentRow
				agent={defaultAgent}
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);
		const otherHtml = renderToStaticMarkup(
			<AgentRow
				agent={otherAgent}
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);

		expect(defaultHtml).toContain("default task agent");
		expect(otherHtml).not.toContain("default task agent");
	});

	test("precedence winner row carries the winner marker class and others do not", () => {
		const agent = createAgent({
			precedence: {
				entries: [
					{ source: "override", selector: "anthropic/claude-3-5-sonnet" },
					{ source: "defaultRole", selector: "default" },
				],
				winner: 1,
			},
		});

		const html = renderToStaticMarkup(
			<AgentRow
				agent={agent}
				defaultExpanded
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);

		expect(html).toContain("ag-precedence-entry--winner");
		// Check that the winner entry has the checkmark and winner class
		expect(html).toContain("defaultRole: default");
		expect(html).toContain("✓");
	});

	test("service tier select reflects serviceTier", () => {
		const agentWithTier = createAgent({ serviceTier: "flex" });
		const htmlWithTier = renderToStaticMarkup(
			<AgentRow
				agent={agentWithTier}
				defaultExpanded
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);

		expect(htmlWithTier).toContain('value="flex" selected=""');

		const agentUnset = createAgent({ serviceTier: undefined });
		const htmlUnset = renderToStaticMarkup(
			<AgentRow
				agent={agentUnset}
				defaultExpanded
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);

		expect(htmlUnset).toContain('value="" selected=""');
	});

	test("AgentsSection renders list of agents", () => {
		const agents: RpcAgentsResult = {
			defaultAgent: "task",
			agents: [
				createAgent({ name: "task", isDefaultTaskAgent: true }),
				createAgent({ name: "scout", disabled: true, isDefaultTaskAgent: false }),
			],
		};

		const html = renderToStaticMarkup(
			<AgentsSection
				agents={agents}
				onPickAgent={() => {}}
				onSetEnabled={() => {}}
				onSetServiceTier={() => {}}
				onSetPrewalk={() => {}}
				onSetAdvisor={() => {}}
			/>,
		);

		expect(html).toContain("task");
		expect(html).toContain("scout");
		expect(html).toContain("ag-row--dimmed");
		expect(html).toContain("default task agent");
	});
});
