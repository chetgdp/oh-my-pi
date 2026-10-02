import { describe, expect, it } from "bun:test";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcWebClient } from "../src/lib/rpc-client";
import { btwBranch, btwCancel, btwHistory, btwStart } from "../src/lib/session-actions";
function createMockClient(): {
	client: RpcWebClient;
	sent: Array<{ type: string; [key: string]: unknown }>;
	fireEvent: (frame: unknown) => void;
} {
	const listeners = new Set<(event: unknown) => void>();
	const sent: Array<{ type: string; [key: string]: unknown }> = [];

	const client = {
		state: "ready",
		onEvent(fn: (event: unknown) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		onLateError() {
			return () => {};
		},
		onStateChange() {
			return () => {};
		},
		onResync() {
			return () => {};
		},
		getHistory() {
			return Promise.resolve({ leafId: "l1", entries: [] });
		},
		async request(command: { type: string; [key: string]: unknown }) {
			sent.push(command);
			if (command.type === "btw_start") {
				return {
					id: "1",
					type: "response",
					command: "btw_start",
					success: true,
					data: { btwId: "test-btw-123" },
				};
			}
			if (command.type === "btw_cancel") {
				return {
					id: "2",
					type: "response",
					command: "btw_cancel",
					success: true,
					data: {},
				};
			}
			if (command.type === "btw_history") {
				return {
					id: "3",
					type: "response",
					command: "btw_history",
					success: true,
					data: {
						records: [
							{
								id: "rec-1",
								question: "Saved Q",
								answer: "Saved A",
								status: "complete",
								createdAt: 1000,
								updatedAt: 2000,
								leafId: "l1",
							},
						],
					},
				};
			}
			if (command.type === "btw_branch") {
				return {
					id: "4",
					type: "response",
					command: "btw_branch",
					success: true,
					data: {
						sessionFile: "/tmp/session-branch.jsonl",
						cancelled: false,
					},
				};
			}
			return {
				id: "0",
				type: "response",
				command: command.type,
				success: true,
				data: {},
			};
		},
	} as unknown as RpcWebClient;

	return {
		client,
		sent,
		fireEvent(frame: unknown) {
			for (const fn of listeners) fn(frame);
		},
	};
}

describe("webgui btw store and actions", () => {
	it("btwStart and btwCancel issue correct RPC commands", async () => {
		const { client, sent } = createMockClient();

		const startResp = await btwStart(client, "What is this?", "agent-42");
		expect(startResp.success).toBe(true);
		expect(startResp.data.btwId).toBe("test-btw-123");
		expect(sent[0]).toEqual({
			type: "btw_start",
			question: "What is this?",
			agentId: "agent-42",
		});

		const cancelResp = await btwCancel(client, "test-btw-123");
		expect(cancelResp.success).toBe(true);
		expect(sent[1]).toEqual({
			type: "btw_cancel",
			btwId: "test-btw-123",
		});
	});

	it("folds btw events into store state", () => {
		const { client, fireEvent } = createMockClient();
		const store = createSessionStore(client);

		expect(store.getSnapshot().btw).toBeNull();

		store.startBtw({
			btwId: "btw-1",
			agentId: "main",
			question: "Tell me something",
		});

		expect(store.getSnapshot().btw).toEqual({
			btwId: "btw-1",
			agentId: "main",
			question: "Tell me something",
			answer: "",
			status: "running",
		});

		fireEvent({
			type: "btw_event",
			btwId: "btw-1",
			agentId: "main",
			event: { kind: "delta", text: "Hello " },
		});
		expect(store.getSnapshot().btw?.answer).toBe("Hello ");

		fireEvent({
			type: "btw_event",
			btwId: "btw-1",
			agentId: "main",
			event: { kind: "delta", text: "there!" },
		});
		expect(store.getSnapshot().btw?.answer).toBe("Hello there!");

		fireEvent({
			type: "btw_event",
			btwId: "btw-1",
			agentId: "main",
			event: { kind: "done", text: "Hello there!" },
		});
		expect(store.getSnapshot().btw?.status).toBe("complete");

		store.clearBtw();
		expect(store.getSnapshot().btw).toBeNull();
	});

	it("ignores events for unknown btwIds", () => {
		const { client, fireEvent } = createMockClient();
		const store = createSessionStore(client);

		store.startBtw({
			btwId: "my-btw",
			agentId: "subagent-1",
			question: "Q?",
		});

		fireEvent({
			type: "btw_event",
			btwId: "other-btw",
			agentId: "subagent-1",
			event: { kind: "delta", text: "Stray text" },
		});

		expect(store.getSnapshot().btw?.answer).toBe("");
	});

	it("folds cancel and error events", () => {
		const { client, fireEvent } = createMockClient();
		const store = createSessionStore(client);

		store.startBtw({ btwId: "b1", agentId: "main", question: "Q1" });
		fireEvent({
			type: "btw_event",
			btwId: "b1",
			agentId: "main",
			event: { kind: "cancelled" },
		});
		expect(store.getSnapshot().btw?.status).toBe("cancelled");

		store.startBtw({ btwId: "b2", agentId: "main", question: "Q2" });
		fireEvent({
			type: "btw_event",
			btwId: "b2",
			agentId: "main",
			event: { kind: "error", message: "Model failure" },
		});
		expect(store.getSnapshot().btw?.status).toBe("error");
		expect(store.getSnapshot().btw?.error).toBe("Model failure");
	});
	it("supports followUpOf in btwStart and issues btwHistory and btwBranch", async () => {
		const { client, sent } = createMockClient();

		const startResp = await btwStart(client, "Follow-up question?", "main", "rec-1");
		expect(startResp.success).toBe(true);
		expect(sent[0]).toEqual({
			type: "btw_start",
			question: "Follow-up question?",
			agentId: "main",
			followUpOf: "rec-1",
		});

		const histResp = await btwHistory(client, "worker-1");
		expect(histResp.success).toBe(true);
		expect(histResp.data.records).toHaveLength(1);
		expect(sent[1]).toEqual({
			type: "btw_history",
			agentId: "worker-1",
		});

		const branchResp = await btwBranch(client, "rec-1", "main");
		expect(branchResp.success).toBe(true);
		expect(branchResp.data.cancelled).toBe(false);
		expect(sent[2]).toEqual({
			type: "btw_branch",
			recordId: "rec-1",
			agentId: "main",
		});
	});

	it("startBtw store action tracks followUpOf and initialAnswer", () => {
		const { client } = createMockClient();
		const store = createSessionStore(client);

		store.startBtw({
			btwId: "btw-follow-up",
			agentId: "main",
			question: "Follow up?",
			followUpOf: "rec-root",
			initialAnswer: "Preloaded answer",
			status: "complete",
		});

		expect(store.getSnapshot().btw).toEqual({
			btwId: "btw-follow-up",
			agentId: "main",
			question: "Follow up?",
			answer: "Preloaded answer",
			status: "complete",
			followUpOf: "rec-root",
		});
	});
});
