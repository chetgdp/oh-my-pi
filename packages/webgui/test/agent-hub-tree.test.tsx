import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import { HubTree } from "../src/components/agent-hub/HubTree";
import { buildHubRows } from "../src/lib/agent-hub-model";

const mk = (id: string, over: Partial<AgentRosterEntry> = {}): AgentRosterEntry => ({
	id,
	displayName: "task",
	kind: "sub",
	status: "running",
	agent: "task",
	createdAt: 1,
	lastActivity: 1,
	...over,
});

describe("HubTree rows", () => {
	test("primary label is the A>B id, role chip is the agent name, line 2 is description", () => {
		const agents = new Map([
			["A", mk("A", { description: "outer work" })],
			["A.B", mk("A.B", { parentId: "A", agent: "scout", description: "inner work" })],
		]);
		const html = renderToStaticMarkup(
			<HubTree rows={buildHubRows(agents, { tree: true })} tree selectedId="A.B" onSelect={() => {}} onOpen={() => {}} />,
		);
		expect(html).toContain("A&gt;B");
		expect(html).toContain('<span class="ah-chip">scout</span>');
		expect(html).toContain("inner work");
	});
});
