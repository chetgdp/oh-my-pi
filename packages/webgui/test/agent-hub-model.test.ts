import { describe, expect, test } from "bun:test";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { RpcServerSubagentMessagesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import {
	EMPTY_AGENT_HUB_STATE,
	applyRegistryFrame,
	agentIdLabel,
	applyRoster,
	applySubagentProgress,
	applyTranscriptChunk,
	buildHubRows,
	computeTotals,
	emptyHubTranscript,
	resolveParents,
} from "../src/lib/agent-hub-model";

function entry(id: string, over: Partial<AgentRosterEntry> = {}): AgentRosterEntry {
	return {
		id,
		displayName: id.slice(id.lastIndexOf(".") + 1),
		kind: id === "Main" ? "main" : "sub",
		status: "running",
		createdAt: 1,
		lastActivity: 1,
		...over,
	};
}

function stateOf(...entries: AgentRosterEntry[]) {
	return applyRoster(EMPTY_AGENT_HUB_STATE, entries);
}

describe("tree building", () => {
	test("nests three levels from registry parentId under Main", () => {
		const s = stateOf(
			entry("Main"),
			entry("A", { parentId: "Main", createdAt: 2 }),
			entry("A.B", { parentId: "A", createdAt: 3 }),
			entry("A.B.C", { parentId: "A.B", createdAt: 4 }),
			entry("D", { parentId: "Main", createdAt: 5 }),
		);
		const rows = buildHubRows(s.agents, { tree: true });
		expect(rows.map(r => [r.entry.id, r.depth])).toEqual([
			["Main", 0],
			["A", 1],
			["A.B", 2],
			["A.B.C", 3],
			["D", 1],
		]);
		expect(rows[0].childCount).toBe(2);
	});

	test("falls back to id prefix when parentId is absent or unknown", () => {
		const s = stateOf(entry("A"), entry("A.B"), entry("A.B.C", { parentId: "ghost" }));
		const parents = resolveParents(s.agents);
		expect(parents.get("A.B")).toBe("A");
		expect(parents.get("A.B.C")).toBe("A.B");
		expect(parents.get("A")).toBeUndefined();
	});

	test("orphans and cycles become roots", () => {
		const s = stateOf(
			entry("X", { parentId: "nowhere" }),
			entry("P", { parentId: "Q" }),
			entry("Q", { parentId: "P" }),
			entry("S", { parentId: "S" }),
		);
		const parents = resolveParents(s.agents);
		expect(parents.get("X")).toBeUndefined();
		expect(parents.get("P")).toBeUndefined();
		expect(parents.get("Q")).toBeUndefined();
		expect(parents.get("S")).toBeUndefined();
		expect(buildHubRows(s.agents, { tree: true })).toHaveLength(4);
	});

	test("filter keeps ancestors in tree mode and lists matches flat", () => {
		const s = stateOf(
			entry("Main"),
			entry("A", { parentId: "Main" }),
			entry("A.B", { parentId: "A", task: "needle" }),
			entry("Z"),
		);
		expect(buildHubRows(s.agents, { tree: true, filter: "needle" }).map(r => r.entry.id)).toEqual([
			"Main",
			"A",
			"A.B",
		]);
		expect(buildHubRows(s.agents, { tree: false, filter: "needle" }).map(r => r.entry.id)).toEqual(["A.B"]);
	});
});

describe("roster updates", () => {
	test("upsert replaces, removed deletes, roster keeps finished but drops stale running", () => {
		let s = stateOf(entry("A", { status: "parked" }), entry("B"));
		s = applyRegistryFrame(s, { type: "agent_registry", op: "upsert", agent: entry("C") });
		expect([...s.agents.keys()].sort()).toEqual(["A", "B", "C"]);
		s = applyRegistryFrame(s, { type: "agent_registry", op: "removed", id: "B" });
		expect(s.agents.has("B")).toBe(false);
		s = applyRoster(s, [entry("Main")]);
		expect([...s.agents.keys()].sort()).toEqual(["A", "Main"]);
	});

	test("progress keeps idle rows idle on terminal status and totals prefer progress metrics", () => {
		let s = stateOf(
			entry("A", { status: "idle", metrics: { tokens: 1, requests: 1, tools: 1, cost: 1, durationMs: 1 } }),
		);
		s = applySubagentProgress(s, {
			index: 0,
			agent: "task",
			agentSource: "bundled",
			task: "t",
			progress: {
				index: 0,
				id: "A",
				agent: "task",
				agentSource: "bundled",
				status: "completed",
				task: "t",
				recentTools: [],
				recentOutput: [],
				toolCount: 4,
				requests: 3,
				tokens: 200,
				cost: 0.5,
				durationMs: 10,
			},
		});
		expect(s.agents.get("A")?.status).toBe("idle");
		const totals = computeTotals(s.agents);
		expect([totals.cost, totals.tokens, totals.tools, totals.counts.idle]).toEqual([0.5, 200, 4, 1]);
	});
});

describe("transcript cursor", () => {
	const chunk = (over: Partial<RpcServerSubagentMessagesResult>): RpcServerSubagentMessagesResult => ({
		sessionFile: "/f.jsonl",
		fromByte: 0,
		nextByte: 0,
		fileId: "",
		sentinel: "",
		reset: false,
		entries: [],
		messages: [],
		...over,
	});
	const e = (id: string) => ({ type: "label", id, parentId: null, timestamp: "t", targetId: "x", label: id }) as never;

	test("appends contiguous chunks and ignores non-contiguous ones", () => {
		let t = applyTranscriptChunk(emptyHubTranscript("A"), chunk({ nextByte: 10, entries: [e("1")] }));
		t = applyTranscriptChunk(t, chunk({ fromByte: 10, nextByte: 20, entries: [e("2")] }));
		expect(t.entries).toHaveLength(2);
		expect(t.nextByte).toBe(20);
		expect(applyTranscriptChunk(t, chunk({ fromByte: 5, nextByte: 30, entries: [e("3")] }))).toBe(t);
	});

	test("reset replaces entries with the from-zero chunk; mid-file reset rewinds the cursor", () => {
		let t = applyTranscriptChunk(
			emptyHubTranscript("A"),
			chunk({ nextByte: 100, fileId: "1:1", sentinel: "s", entries: [e("1"), e("2")] }),
		);
		expect([t.fileId, t.sentinel]).toEqual(["1:1", "s"]);
		const rewound = applyTranscriptChunk(t, chunk({ reset: true, fromByte: 50, nextByte: 60, entries: [e("x")] }));
		expect([rewound.nextByte, rewound.fileId, rewound.sentinel]).toEqual([0, undefined, undefined]);
		expect(rewound.entries).toHaveLength(2);
		t = applyTranscriptChunk(rewound, chunk({ fromByte: 0, nextByte: 30, fileId: "2:2", entries: [e("n")] }));
		expect(t.entries).toHaveLength(1);
		expect(t.nextByte).toBe(30);
		expect(t.fileId).toBe("2:2");
		t = applyTranscriptChunk(t, chunk({ reset: true, fromByte: 0, nextByte: 5, entries: [e("m")] }));
		expect(t.entries).toHaveLength(1);
		expect(t.nextByte).toBe(5);
	});

	test("sessionFile change with a nonzero fromByte rewinds, then the from-zero chunk replaces", () => {
		let t = applyTranscriptChunk(emptyHubTranscript("A"), chunk({ nextByte: 100, entries: [e("1")] }));
		t = applyTranscriptChunk(t, chunk({ sessionFile: "/g.jsonl", fromByte: 100, nextByte: 120, entries: [e("x")] }));
		expect(t.nextByte).toBe(0);
		t = applyTranscriptChunk(
			t,
			chunk({ sessionFile: "/g.jsonl", fromByte: 0, nextByte: 20, entries: [e("y"), e("z")] }),
		);
		expect(t.entries).toHaveLength(2);
		expect(t.sessionFile).toBe("/g.jsonl");
	});
});

describe("agentIdLabel", () => {
	test("dot-nested ids render as breadcrumbs, top-level ids unchanged", () => {
		expect(agentIdLabel("A.B.C")).toBe("A>B>C");
		expect(agentIdLabel("Main")).toBe("Main");
	});
});
