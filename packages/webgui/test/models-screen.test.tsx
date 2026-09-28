import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";
import { ModelsScreen } from "../src/components/models/ModelsScreen";
import { ActiveSection, explainModelSource } from "../src/components/models/ActiveSection";
import type {
	RpcModelRolesResult,
	RpcAgentsResult,
	RpcModelBrowserResult,
	RpcSessionState,
	RpcModelSource,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { Model } from "@oh-my-pi/pi-ai";
import type {
	ActiveSectionProps,
	RolesSectionProps,
	AgentsSectionProps,
	ProvidersSectionProps,
} from "../src/components/models/contract";

const ROLES_FIXTURE: RpcModelRolesResult = {
	storage: "global",
	cycleOrder: ["default", "smol"],
	modelTags: {},
	roles: [
		{
			id: "default",
			name: "Default",
			section: "chat",
			source: "active",
			provenance: "default",
			custom: false,
			resolved: { provider: "anthropic", id: "claude-opus-4", name: "Claude Opus" },
			eligible: ["anthropic/claude-opus-4"],
		},
		{
			id: "smol",
			name: "Fast",
			section: "chat",
			source: "global",
			provenance: "global",
			custom: false,
			configured: "anthropic/claude-sonnet-4",
			resolved: { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet" },
			eligible: ["anthropic/claude-sonnet-4"],
		},
		{
			id: "task",
			name: "Task",
			section: "kind",
			source: "fallback",
			provenance: "default",
			custom: false,
			fallbackFrom: "default",
			resolved: { provider: "anthropic", id: "claude-opus-4", name: "Claude Opus" },
			eligible: [],
		},
		{
			id: "embeddings",
			name: "embeddings",
			section: "kind",
			source: "unset",
			provenance: "default",
			custom: false,
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
			isDefaultTaskAgent: true,
			prewalk: { source: "default" },
			advisor: { source: "none" },
			precedence: {
				entries: [{ source: "defaultRole", selector: "anthropic/claude-opus-4" }],
				winner: 0,
			},
		},
		{
			name: "scout",
			description: "Fast read-only agent",
			source: "builtin",
			override: "anthropic/claude-sonnet-4",
			patterns: ["anthropic/claude-sonnet-4"],
			resolved: { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet" },
			disabled: false,
			isDefaultTaskAgent: false,
			prewalk: { source: "default" },
			advisor: { source: "none" },
			precedence: {
				entries: [{ source: "override", selector: "anthropic/claude-sonnet-4" }],
				winner: 0,
			},
		},
		{
			name: "disabled-agent",
			description: "An agent that is off",
			source: "project",
			patterns: [],
			disabled: true,
			isDefaultTaskAgent: false,
			prewalk: { source: "none" },
			advisor: { source: "none" },
			precedence: {
				entries: [],
				winner: -1,
			},
		},
	],
};

const BROWSER_FIXTURE: RpcModelBrowserResult = {
	models: [
		{
			provider: "anthropic",
			id: "claude-opus-4",
			name: "Claude Opus",
			selector: "anthropic/claude-opus-4",
			kind: "chat",
			locked: false,
			roles: [{ role: "default", auto: false }],
		},
	],
	mruOrder: ["anthropic/claude-opus-4"],
	providers: [
		{
			id: "anthropic",
			authenticated: true,
			discoverable: true,
			modelCount: 1,
		},
	],
	kinds: ["chat"],
};

const SESSION_STATE_FIXTURE: RpcSessionState = {
	sessionId: "sess-1",
	isStreaming: false,
	isCompacting: false,
	steeringMode: "all",
	followUpMode: "all",
	interruptMode: "immediate",
	autoCompactionEnabled: false,
	fastModeEnabled: false,
	fastModeActive: false,
	hasPendingAsyncWork: false,
	isSettled: true,
	tokensPerSecond: null,
	messageCount: 0,
	queuedMessageCount: 0,
	todoPhases: [],
	model: {
		id: "claude-opus-4",
		name: "Claude Opus",
		provider: "anthropic",
	} as unknown as Model,
	thinkingLevel: ThinkingLevel.High,
	modelSource: {
		kind: "role",
		role: "default",
	},
};

const noop = (): void => {};

function createScreenProps(overrides?: {
	active?: Partial<ActiveSectionProps>;
	roles?: Partial<RolesSectionProps>;
	agents?: Partial<AgentsSectionProps>;
	providers?: Partial<ProvidersSectionProps>;
}) {
	const active: ActiveSectionProps = {
		state: SESSION_STATE_FIXTURE,
		roles: ROLES_FIXTURE,
		streaming: false,
		onPick: noop,
		onCycle: noop,
		...overrides?.active,
	};
	const roles: RolesSectionProps = {
		roles: ROLES_FIXTURE,
		onPickRole: noop,
		onClearRole: noop,
		onCreateRole: noop,
		onDeleteRole: noop,
		onSetCycleOrder: noop,
		onSetTag: noop,
		...overrides?.roles,
	};
	const agents: AgentsSectionProps = {
		agents: AGENTS_FIXTURE,
		onPickAgent: noop,
		onSetEnabled: noop,
		onSetServiceTier: noop,
		onSetPrewalk: noop,
		onSetAdvisor: noop,
		...overrides?.agents,
	};
	const providers: ProvidersSectionProps = {
		browser: BROWSER_FIXTURE,
		refreshing: null,
		onRefresh: noop,
		...overrides?.providers,
	};
	return { active, roles, agents, providers };
}

describe("ModelsScreen", () => {
	test("renders sections in order: Active, Roles, Agents, Providers", () => {
		const props = createScreenProps();
		const html = renderToStaticMarkup(<ModelsScreen {...props} />);

		const activeIdx = html.indexOf(">Active<");
		const rolesIdx = html.indexOf(">Roles<");
		const agentsIdx = html.indexOf(">Agents<");
		const providersIdx = html.indexOf(">Providers<");

		expect(activeIdx).toBeGreaterThanOrEqual(0);
		expect(rolesIdx).toBeGreaterThan(activeIdx);
		expect(agentsIdx).toBeGreaterThan(rolesIdx);
		expect(providersIdx).toBeGreaterThan(agentsIdx);
	});

	test("collapsible sections toggle visibility", () => {
		const props = createScreenProps();
		const collapsedProps = {
			...props,
			collapsed: { active: true, roles: false, agents: false, providers: false },
		};
		const html = renderToStaticMarkup(<ModelsScreen {...collapsedProps} />);
		expect(html).not.toContain("md-active-card");
		expect(html).toContain("md-roles-section");
	});
});

describe("ActiveSection", () => {
	test("explanation text per modelSource kind: 5 cases", () => {
		// 1. kind role with role "default" -> "Default role"
		const srcDefaultRole: RpcModelSource = { kind: "role", role: "default" };
		expect(explainModelSource(srcDefaultRole)).toBe("Default role");

		// 2. kind role other -> "Role <role>"
		const srcOtherRole: RpcModelSource = { kind: "role", role: "smol" };
		expect(explainModelSource(srcOtherRole)).toBe("Role smol");

		// 3. temporary -> "Session override (/switch)"
		const srcTemporary: RpcModelSource = { kind: "temporary" };
		expect(explainModelSource(srcTemporary)).toBe("Session override (/switch)");

		// 4. ephemeral -> "Ephemeral override"
		const srcEphemeral: RpcModelSource = { kind: "ephemeral" };
		expect(explainModelSource(srcEphemeral)).toBe("Ephemeral override");

		// 5. fallback -> "Fallback from <fallbackFrom>"
		const srcFallback: RpcModelSource = { kind: "fallback", fallbackFrom: "anthropic/claude-opus-4" };
		expect(explainModelSource(srcFallback)).toBe("Fallback from anthropic/claude-opus-4");

		// Bonus undefined -> "Session model"
		expect(explainModelSource(undefined)).toBe("Session model");
	});

	test("cycle buttons disabled when cycleOrder.length < 2", () => {
		const rolesWithOneCycle: RpcModelRolesResult = {
			...ROLES_FIXTURE,
			cycleOrder: ["default"],
		};
		const props: ActiveSectionProps = {
			state: SESSION_STATE_FIXTURE,
			roles: rolesWithOneCycle,
			streaming: false,
			onPick: noop,
			onCycle: noop,
		};

		const html = renderToStaticMarkup(<ActiveSection {...props} />);
		// Both prev and next cycle buttons should be disabled
		expect(html).toContain('disabled=""');
	});

	test("cycle buttons enabled when cycleOrder.length >= 2", () => {
		const props: ActiveSectionProps = {
			state: SESSION_STATE_FIXTURE,
			roles: ROLES_FIXTURE, // has cycleOrder: ["default", "smol"]
			streaming: false,
			onPick: noop,
			onCycle: noop,
		};

		const html = renderToStaticMarkup(<ActiveSection {...props} />);
		expect(html).not.toContain('disabled=""');
	});

	test("shows hint when streaming is true", () => {
		const props: ActiveSectionProps = {
			state: SESSION_STATE_FIXTURE,
			roles: ROLES_FIXTURE,
			streaming: true,
			onPick: noop,
			onCycle: noop,
		};

		const html = renderToStaticMarkup(<ActiveSection {...props} />);
		expect(html).toContain("applies at next request");
	});
});
