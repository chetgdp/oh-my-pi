import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	RolesSection,
	sortedRoles,
	validateRoleId,
	toggleCycleRole,
	moveCycleRole,
} from "../src/components/models/RolesSection";
import type {
	RpcModelRolesResult,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

const ROLES_FIXTURE: RpcModelRolesResult = {
	storage: "project",
	roles: [
		{
			id: "default",
			name: "Default",
			section: "chat",
			source: "active",
			provenance: "runtime",
			custom: false,
			resolved: { provider: "anthropic", id: "claude-opus-4", name: "Claude Opus" },
			eligible: ["anthropic/claude-opus-4"],
		},
		{
			id: "smol",
			name: "Fast",
			section: "chat",
			source: "project",
			provenance: "project",
			configured: "anthropic/claude-sonnet-4",
			custom: false,
			resolved: { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet" },
			eligible: ["anthropic/claude-sonnet-4"],
		},
		{
			id: "custom-reviewer",
			name: "custom-reviewer",
			section: "chat",
			source: "global",
			provenance: "global",
			configured: "openai/gpt-4o",
			custom: true,
			resolved: { provider: "openai", id: "gpt-4o", name: "GPT-4o" },
			eligible: ["openai/gpt-4o"],
		},
		{
			id: "task",
			name: "Task",
			section: "kind",
			source: "unset",
			provenance: "default",
			custom: false,
			autoSelected: { provider: "anthropic", id: "claude-haiku-3", name: "Claude Haiku" },
			eligible: ["anthropic/claude-haiku-3"],
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
	cycleOrder: ["default", "smol"],
	modelTags: {},
};

const noop = (): void => {};

describe("RolesSection helpers", () => {
	test("sortedRoles puts chat roles before kind roles", () => {
		const sorted = sortedRoles(ROLES_FIXTURE);
		expect(sorted.map(r => r.id)).toEqual([
			"default",
			"smol",
			"custom-reviewer",
			"task",
			"embeddings",
		]);
	});

	test("toggleCycleRole adds at end / removes", () => {
		const initial = ["default", "smol"];
		const added = toggleCycleRole(initial, "custom-reviewer");
		expect(added).toEqual(["default", "smol", "custom-reviewer"]);

		const removed = toggleCycleRole(added, "smol");
		expect(removed).toEqual(["default", "custom-reviewer"]);
	});

	test("moveCycleRole clamps at ends", () => {
		const order = ["default", "smol", "task"];
		// Moving first item up clamps at 0 (no change)
		expect(moveCycleRole(order, "default", -1)).toEqual(["default", "smol", "task"]);
		// Moving last item down clamps at end (no change)
		expect(moveCycleRole(order, "task", 1)).toEqual(["default", "smol", "task"]);
		// Moving middle item up swaps with first
		expect(moveCycleRole(order, "smol", -1)).toEqual(["smol", "default", "task"]);
		// Moving middle item down swaps with last
		expect(moveCycleRole(order, "smol", 1)).toEqual(["default", "task", "smol"]);
		// Non-existent item returns order unchanged
		expect(moveCycleRole(order, "unknown", 1)).toEqual(["default", "smol", "task"]);
	});

	test("validateRoleId rejects '1abc', 'a b', duplicates, and accepts valid ids", () => {
		const existing = ["default", "smol", "task"];
		expect(validateRoleId("1abc", existing)).not.toBeNull();
		expect(validateRoleId("a b", existing)).not.toBeNull();
		expect(validateRoleId("default", existing)).not.toBeNull();
		expect(validateRoleId("planner", existing)).toBeNull();
		expect(validateRoleId("planner-1_a", existing)).toBeNull();
	});
});

describe("RolesSection rendering", () => {
	test("unconfigured role renders the autoSelected model with the auto badge", () => {
		const html = renderToStaticMarkup(
			<RolesSection
				roles={ROLES_FIXTURE}
				onPickRole={noop}
				onClearRole={noop}
				onCreateRole={noop}
				onDeleteRole={noop}
				onSetCycleOrder={noop}
				onSetTag={noop}
			/>
		);
		expect(html).toContain("Claude Haiku");
		expect(html).toContain("md-badge--auto");
		expect(html).toContain(">auto<");
	});

	test("unconfigured role with neither resolved nor autoSelected renders 'unset'", () => {
		const html = renderToStaticMarkup(
			<RolesSection
				roles={ROLES_FIXTURE}
				onPickRole={noop}
				onClearRole={noop}
				onCreateRole={noop}
				onDeleteRole={noop}
				onSetCycleOrder={noop}
				onSetTag={noop}
			/>
		);
		expect(html).toContain("md-row-unset");
		expect(html).toContain(">unset<");
	});

	test("runtime provenance renders 'session only'", () => {
		const html = renderToStaticMarkup(
			<RolesSection
				roles={ROLES_FIXTURE}
				onPickRole={noop}
				onClearRole={noop}
				onCreateRole={noop}
				onDeleteRole={noop}
				onSetCycleOrder={noop}
				onSetTag={noop}
			/>
		);
		expect(html).toContain("session only");
		expect(html).toContain("md-badge--runtime");
	});

	test("custom role renders Delete control and builtin does not", () => {
		const html = renderToStaticMarkup(
			<RolesSection
				roles={ROLES_FIXTURE}
				onPickRole={noop}
				onClearRole={noop}
				onCreateRole={noop}
				onDeleteRole={noop}
				onSetCycleOrder={noop}
				onSetTag={noop}
			/>
		);
		// custom-reviewer is custom
		expect(html).toContain("Delete custom-reviewer");
		// builtin roles do not have delete buttons
		expect(html).not.toContain("Delete default");
		expect(html).not.toContain("Delete smol");
	});

	test("project-storage configured role renders tappable scope control while global storage renders static badge", () => {
		// In ROLES_FIXTURE, storage === "project" and smol is configured:
		const projectHtml = renderToStaticMarkup(
			<RolesSection
				roles={ROLES_FIXTURE}
				onPickRole={noop}
				onClearRole={noop}
				onCreateRole={noop}
				onDeleteRole={noop}
				onSetCycleOrder={noop}
				onSetTag={noop}
			/>
		);
		expect(projectHtml).toContain("md-badge--scope-control");

		// When storage is "global":
		const globalFixture: RpcModelRolesResult = {
			...ROLES_FIXTURE,
			storage: "global",
		};
		const globalHtml = renderToStaticMarkup(
			<RolesSection
				roles={globalFixture}
				onPickRole={noop}
				onClearRole={noop}
				onCreateRole={noop}
				onDeleteRole={noop}
				onSetCycleOrder={noop}
				onSetTag={noop}
			/>
		);
		expect(globalHtml).not.toContain("md-badge--scope-control");
		expect(globalHtml).toContain("md-badge--project");
	});
});
