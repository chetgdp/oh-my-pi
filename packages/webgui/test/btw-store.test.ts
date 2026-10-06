import { describe, expect, it } from "bun:test";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcWebClient } from "../src/lib/rpc-client";
import { btw, btwCancel, getBtwHistory } from "../src/lib/session-actions";
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
			if (command.type === "btw") {
				return {
					id: "1",
					type: "response",
					command: "btw",
					success: true,
					data: {
						record: {
							id: (command.recordId as string) ?? "test-btw-123",
							question: command.question as string,
							answer: "",
							status: "running",
							createdAt: 1000,
							updatedAt: 1000,
							leafId: "l1",
						},
					},
				};
			}
			if (command.type === "btw_cancel") {
				return {
					id: "2",
					type: "response",
					command: "btw_cancel",
					success: true,
					data: { cancelled: true },
				};
			}
			if (command.type === "get_btw_history") {
				return {
					id: "3",
					type: "response",
					command: "get_btw_history",
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
	it("btw and btwCancel issue correct RPC commands", async () => {
		const { client, sent } = createMockClient();

		const startResp = await btw(client, "What is this?");
		expect(startResp.success).toBe(true);
		expect(startResp.data.record.id).toBe("test-btw-123");
		expect(sent[0]).toEqual({
			type: "btw",
			question: "What is this?",
		});

		const cancelResp = await btwCancel(client, "test-btw-123");
		expect(cancelResp.success).toBe(true);
		expect(cancelResp.data.cancelled).toBe(true);
		expect(sent[1]).toEqual({
			type: "btw_cancel",
			recordId: "test-btw-123",
		});
	});

	it("folds btw events into store state", () => {
		const { client, fireEvent } = createMockClient();
		const store = createSessionStore(client);

		expect(store.getSnapshot().btw).toBeNull();

		store.startBtw({
			recordId: "rec-1",
			question: "Tell me something",
		});

		expect(store.getSnapshot().btw).toEqual({
			recordId: "rec-1",
			question: "Tell me something",
			answer: "",
			status: "running",
		});

		fireEvent({
			type: "btw_delta",
			recordId: "rec-1",
			delta: "Hello ",
		});
		expect(store.getSnapshot().btw?.answer).toBe("Hello ");

		fireEvent({
			type: "btw_delta",
			recordId: "rec-1",
			delta: "there!",
		});
		expect(store.getSnapshot().btw?.answer).toBe("Hello there!");

		fireEvent({
			type: "btw_record",
			record: {
				id: "rec-1",
				question: "Tell me something",
				answer: "Hello there!",
				status: "complete",
			},
		});
		expect(store.getSnapshot().btw?.status).toBe("complete");
		store.clearBtw();
		expect(store.getSnapshot().btw).toBeNull();
	});

	it("ignores events for unknown recordIds", () => {
		const { client, fireEvent } = createMockClient();
		const store = createSessionStore(client);

		store.startBtw({
			recordId: "my-rec",
			question: "Q?",
		});

		fireEvent({
			type: "btw_delta",
			recordId: "other-rec",
			delta: "Stray text",
		});

		expect(store.getSnapshot().btw?.answer).toBe("");
	});

	it("folds btw_record cancel and error states", () => {
		const { client, fireEvent } = createMockClient();
		const store = createSessionStore(client);

		store.startBtw({ recordId: "b1", question: "Q1" });
		fireEvent({
			type: "btw_record",
			record: {
				id: "b1",
				question: "Q1",
				answer: "",
				status: "cancelled",
			},
		});
		expect(store.getSnapshot().btw?.status).toBe("cancelled");

		store.startBtw({ recordId: "b2", question: "Q2" });
		fireEvent({
			type: "btw_record",
			record: {
				id: "b2",
				question: "Q2",
				answer: "",
				status: "error",
				error: "Model failure",
			},
		});
		expect(store.getSnapshot().btw?.status).toBe("error");
		expect(store.getSnapshot().btw?.error).toBe("Model failure");
	});

	it("supports recordId follow-up in btw and issues getBtwHistory", async () => {
		const { client, sent } = createMockClient();

		const startResp = await btw(client, "Follow-up question?", "rec-1");
		expect(startResp.success).toBe(true);
		expect(sent[0]).toEqual({
			type: "btw",
			question: "Follow-up question?",
			recordId: "rec-1",
		});

		const histResp = await getBtwHistory(client);
		expect(histResp.success).toBe(true);
		expect(histResp.data.records).toHaveLength(1);
		expect(sent[1]).toEqual({
			type: "get_btw_history",
		});
	});
	it("updateBtwFromRecord updates store state", () => {
		const { client } = createMockClient();
		const store = createSessionStore(client);

		store.updateBtwFromRecord({
			id: "rec-root",
			question: "Root Q?",
			answer: "Root A",
			status: "complete",
		});

		expect(store.getSnapshot().btw).toEqual({
			recordId: "rec-root",
			question: "Root Q?",
			answer: "Root A",
			status: "complete",
		});
	});
});
