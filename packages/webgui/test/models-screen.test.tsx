import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";
import { ModelsScreen } from "../src/components/models/ModelsScreen";
import { RoleRow } from "../src/components/models/RoleRow";
import { AgentRow } from "../src/components/models/AgentRow";
import type { RpcModelRolesResult, RpcAgentsResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

const ROLES_FIXTURE: RpcModelRolesResult = {
	storage: "global",
	roles: [
		{
			id: "default",
			name: "Default",
			section: "chat",
			source: "active",
			resolved: { provider: "anthropic", id: "claude-opus-4", name: "Claude Opus" },
			eligible: ["anthropic/claude-opus-4"],
		},
		{
			id: "smol",
			name: "Fast",
			section: "chat",
			source: "global",
			configured: "anthropic/claude-sonnet-4",
			resolved: { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet" },
			eligible: ["anthropic/claude-sonnet-4"],
		},
		{
			id: "task",
			name: "Task",
			section: "kind",
			source: "fallback",
			fallbackFrom: "default",
			resolved: { provider: "anthropic", id: "claude-opus-4", name: "Claude Opus" },
			eligible: [],
		},
		{
			id: "embeddings",
			name: "embeddings",
			section: "kind",
			source: "unset",
			eligible: [],
		},
	],
};

const AGENTS_FIXTURE: RpcAgentsResult = {
	defaultAgent: "task",
	agents: [
		{
			name: "task",
			description: "General purpose agent",
			source: "builtin",
			patterns: ["anthropic/claude-opus-4"],
			resolved: { provider: "anthropic", id: "claude-opus-4", name: "Claude Opus" },
			disabled: false,
		},
		{
			name: "scout",
			description: "Fast read-only agent",
			source: "builtin",
			override: "anthropic/claude-sonnet-4",
			patterns: ["anthropic/claude-sonnet-4"],
			resolved: { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet" },
			disabled: false,
		},
		{
			name: "disabled-agent",
			description: "An agent that is off",
			source: "project",
			patterns: [],
			disabled: true,
		},
	],
};

const noop = (): void => {};

describe("ModelsScreen", () => {
	test("renders role source badges", () => {
		const html = renderToStaticMarkup(
			<ModelsScreen roles={ROLES_FIXTURE} agents={AGENTS_FIXTURE} onPickRole={noop} onPickAgent={noop} />,
		);
		// Source badges present
		expect(html).toContain("md-badge--active");
		expect(html).toContain("md-badge--global");
		expect(html).toContain("md-badge--fallback");
		expect(html).toContain("md-badge--unset");
	});

	test("renders agent override badge", () => {
		const html = renderToStaticMarkup(
			<ModelsScreen roles={ROLES_FIXTURE} agents={AGENTS_FIXTURE} onPickRole={noop} onPickAgent={noop} />,
		);
		expect(html).toContain("md-badge--override");
		expect(html).toContain("override");
	});

	test("renders disabled agent with dimmed class", () => {
		const html = renderToStaticMarkup(
			<ModelsScreen roles={ROLES_FIXTURE} agents={AGENTS_FIXTURE} onPickRole={noop} onPickAgent={noop} />,
		);
		expect(html).toContain("md-row--disabled");
	});

	test("shows loading when roles/agents are null", () => {
		const html = renderToStaticMarkup(
			<ModelsScreen roles={null} agents={null} onPickRole={noop} onPickAgent={noop} />,
		);
		expect(html).toContain("loading...");
	});

	test("chat roles appear before kind roles", () => {
		const html = renderToStaticMarkup(
			<ModelsScreen roles={ROLES_FIXTURE} agents={AGENTS_FIXTURE} onPickRole={noop} onPickAgent={noop} />,
		);
		const defaultIdx = html.indexOf("Default");
		const taskIdx = html.indexOf("Task");
		expect(defaultIdx).toBeLessThan(taskIdx);
	});
});

describe("RoleRow", () => {
	test("shows fallbackFrom in source label", () => {
		const role = ROLES_FIXTURE.roles[2]; // task, fallback from default
		const html = renderToStaticMarkup(<RoleRow role={role} onClick={noop} />);
		expect(html).toContain("fallback from default");
	});

	test("shows resolved model name and thinking level", () => {
		const role = {
			...ROLES_FIXTURE.roles[0],
			resolved: { provider: "anthropic", id: "opus", name: "Opus", thinkingLevel: ThinkingLevel.High },
		};
		const html = renderToStaticMarkup(<RoleRow role={role} onClick={noop} />);
		expect(html).toContain("Opus");
		expect(html).toContain("(high)");
	});
});

describe("AgentRow", () => {
	test("shows effective model from resolved", () => {
		const html = renderToStaticMarkup(<AgentRow agent={AGENTS_FIXTURE.agents[0]} onClick={noop} />);
		expect(html).toContain("Claude Opus");
	});

	test("falls back to patterns[0] when no resolved", () => {
		const agent = { ...AGENTS_FIXTURE.agents[0], resolved: undefined };
		const html = renderToStaticMarkup(<AgentRow agent={agent} onClick={noop} />);
		expect(html).toContain("anthropic/claude-opus-4");
	});
});
