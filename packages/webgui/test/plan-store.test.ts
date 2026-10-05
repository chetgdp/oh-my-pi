import { describe, expect, it } from "bun:test";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcConnectionState, RpcSessionEvent, RpcWebClient } from "../src/lib/rpc-client";
import { RpcCommandError } from "../src/lib/rpc-client";
import type { RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";
import type {
	RpcServerSessionState,
	RpcPlanState,
	RpcPlanReview,
	RpcPlanStateFrame,
	RpcPlanReviewFrame,
	RpcServerCommand,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { dismissNotice, getNotices } from "../src/lib/notify";
import type { SessionCommandSink } from "../src/lib/session-actions";
import { getPlanState, setPlanMode, approvePlan } from "../src/lib/session-actions";

async function flush(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

class FakeClient {
	state: RpcConnectionState = "ready";
	sessionState: RpcServerSessionState | null = null;

	#eventListeners: Array<(e: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];
	#resyncListeners: Array<(s: RpcServerSessionState) => void> = [];

	requestLog: RpcServerCommand[] = [];
	requestResolvers: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];
	historyLog: Array<{ before?: string; leafId?: string; limit?: number }> = [];
	historyResolvers: Array<{ resolve: (v: RpcV3HistoryResult) => void; reject: (e: Error) => void }> = [];

	history(opts: { before?: string; leafId?: string; limit?: number } = {}): Promise<RpcV3HistoryResult> {
		this.historyLog.push(opts);
		const { promise, resolve, reject } = Promise.withResolvers<RpcV3HistoryResult>();
		this.historyResolvers.push({ resolve, reject });
		return promise;
	}

	resolveHistory(index: number, value: RpcV3HistoryResult): void {
		this.historyResolvers[index]?.resolve(value);
	}

	onEvent(fn: (e: RpcSessionEvent) => void): () => void {
		this.#eventListeners.push(fn);
		return () => {
			const i = this.#eventListeners.indexOf(fn);
			if (i !== -1) this.#eventListeners.splice(i, 1);
		};
	}

	onStateChange(fn: (s: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(fn);
		return () => {
			const i = this.#stateListeners.indexOf(fn);
			if (i !== -1) this.#stateListeners.splice(i, 1);
		};
	}

	onResync(fn: (s: RpcServerSessionState) => void): () => void {
		this.#resyncListeners.push(fn);
		return () => {
			const i = this.#resyncListeners.indexOf(fn);
			if (i !== -1) this.#resyncListeners.splice(i, 1);
		};
	}

	request: SessionCommandSink["request"] = cmd => {
		this.requestLog.push(cmd);
		const { promise, resolve, reject } = Promise.withResolvers<unknown>();
		this.requestResolvers.push({ resolve, reject });
		return promise as never;
	};

	emitEvent(event: RpcSessionEvent): void {
		for (const fn of this.#eventListeners) fn(event);
	}

	emitStateChange(s: RpcConnectionState): void {
		for (const fn of this.#stateListeners) fn(s);
	}

	emitResync(state: RpcServerSessionState): void {
		for (const fn of this.#resyncListeners) fn(state);
	}

	resolveRequest(index: number, value: unknown): void {
		this.requestResolvers[index]?.resolve(value);
	}

	rejectRequest(index: number, err: Error): void {
		this.requestResolvers[index]?.reject(err);
	}
}

describe("SessionStore plan mode support", () => {
	it("initializes snapshot with planState: null and planReview: null", () => {
		const client = new FakeClient();
		client.state = "connecting";
		const store = createSessionStore(client as unknown as RpcWebClient);
		const snap = store.getSnapshot();
		expect(snap.planState).toBeNull();
		expect(snap.planReview).toBeNull();
		store.dispose();
	});

	it("plan_state frame updates snapshot.planState and notifies subscribers", () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);
		let notified = 0;
		store.subscribe(() => {
			notified++;
		});

		const planState: RpcPlanState = {
			available: true,
			enabled: true,
			paused: false,
			planFilePath: "/path/to/plan.md",
		};
		const frame: RpcPlanStateFrame = {
			type: "plan_state",
			state: planState,
		};

		client.emitEvent(frame as unknown as RpcSessionEvent);

		const snap = store.getSnapshot();
		expect(snap.planState).toEqual(planState);
		expect(snap.planState?.available).toBe(true);
		expect(snap.planState?.enabled).toBe(true);
		expect(snap.planState?.paused).toBe(false);
		expect(snap.planState?.planFilePath).toBe("/path/to/plan.md");
		store.flushNotifications();
		expect(notified).toBe(1);

		store.dispose();
	});

	it("handles plan_state frame transitions (enabled -> paused -> off)", () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);

		// Transition 1: enabled
		client.emitEvent({
			type: "plan_state",
			state: { available: true, enabled: true, paused: false },
		} as unknown as RpcSessionEvent);
		expect(store.getSnapshot().planState).toEqual({ available: true, enabled: true, paused: false });

		// Transition 2: paused
		client.emitEvent({
			type: "plan_state",
			state: { available: true, enabled: true, paused: true },
		} as unknown as RpcSessionEvent);
		expect(store.getSnapshot().planState?.paused).toBe(true);

		// Transition 3: off
		client.emitEvent({
			type: "plan_state",
			state: { available: true, enabled: false, paused: false },
		} as unknown as RpcSessionEvent);
		expect(store.getSnapshot().planState?.enabled).toBe(false);

		store.dispose();
	});

	it("plan_review frame sets planReview and clearing with review: null clears it", () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);

		const review: RpcPlanReview = {
			reviewId: "rev-123",
			title: "Refactor architecture",
			planFilePath: "/path/to/plan.md",
			markdown: "# Refactor Plan\n\n1. Step one\n2. Step two",
		};

		// Review frame arrives
		const reviewFrame: RpcPlanReviewFrame = {
			type: "plan_review",
			review,
		};
		client.emitEvent(reviewFrame as unknown as RpcSessionEvent);

		expect(store.getSnapshot().planReview).toEqual(review);
		expect(store.getSnapshot().planReview?.reviewId).toBe("rev-123");
		expect(store.getSnapshot().planReview?.title).toBe("Refactor architecture");

		// Plan approved or dropped -> review: null pushed
		const clearFrame: RpcPlanReviewFrame = {
			type: "plan_review",
			review: null,
		};
		client.emitEvent(clearFrame as unknown as RpcSessionEvent);

		expect(store.getSnapshot().planReview).toBeNull();

		store.dispose();
	});

	it("initialFetches on attach issues get_plan_state and updates snapshot", async () => {
		const client = new FakeClient();
		client.state = "connecting";
		const store = createSessionStore(client as unknown as RpcWebClient);

		client.state = "ready";
		client.emitStateChange("ready");

		const planIdx = client.requestLog.findIndex(r => r.type === "get_plan_state");
		expect(planIdx).toBeGreaterThanOrEqual(0);

		client.resolveRequest(planIdx, {
			success: true,
			command: "get_plan_state",
			data: {
				state: { available: true, enabled: true, paused: false, planFilePath: "/plans/p1.md" },
				review: {
					reviewId: "rev-attach",
					title: "Pending plan",
					planFilePath: "/plans/p1.md",
					markdown: "Pending review text",
				},
			},
		});
		await flush();

		const snap = store.getSnapshot();
		expect(snap.planState?.enabled).toBe(true);
		expect(snap.planReview?.reviewId).toBe("rev-attach");

		store.dispose();
	});

	it("older host without plan RPC: no notice, chip stays hidden; other errors still notify", async () => {
		for (const n of getNotices()) dismissNotice(n.id);
		const client = new FakeClient();
		client.state = "connecting";
		const store = createSessionStore(client as unknown as RpcWebClient);
		client.state = "ready";
		client.emitStateChange("ready");
		const planIdx = client.requestLog.findIndex(r => r.type === "get_plan_state");
		client.requestResolvers[planIdx]?.reject(
			new RpcCommandError("get_plan_state", "Unknown command: get_plan_state"),
		);
		await flush();
		expect(store.getSnapshot().planState).toBeNull();
		expect(getNotices().some(n => n.message.includes("get_plan_state"))).toBe(false);

		client.emitResync({ sessionId: "s" } as unknown as RpcServerSessionState);
		const retryIdx = client.requestLog.findLastIndex(r => r.type === "get_plan_state");
		client.requestResolvers[retryIdx]?.reject(new Error("socket closed"));
		await flush();
		expect(getNotices().some(n => n.message === "socket closed")).toBe(true);
		store.dispose();
	});

	it("onResync issues get_plan_state and updates snapshot", async () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);

		const initialCount = client.requestLog.length;

		client.emitResync({ sessionId: "resynced-session" } as unknown as RpcServerSessionState);

		const resyncRequests = client.requestLog.slice(initialCount);
		const planReq = resyncRequests.findIndex(r => r.type === "get_plan_state");
		expect(planReq).toBeGreaterThanOrEqual(0);

		client.resolveRequest(initialCount + planReq, {
			success: true,
			command: "get_plan_state",
			data: {
				state: { available: true, enabled: false, paused: false },
				review: null,
			},
		});
		await flush();

		expect(store.getSnapshot().planState?.enabled).toBe(false);
		expect(store.getSnapshot().planReview).toBeNull();

		store.dispose();
	});

	it("turn_end and agent_end frames trigger fetchPlanState", async () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);
		const initialCount = client.requestLog.length;

		client.emitEvent({ type: "turn_end" } as unknown as RpcSessionEvent);
		const turnRequests = client.requestLog.slice(initialCount);
		const planReq1 = turnRequests.findIndex(r => r.type === "get_plan_state");
		expect(planReq1).toBeGreaterThanOrEqual(0);

		const countAfterTurn = client.requestLog.length;
		client.emitEvent({ type: "agent_end" } as unknown as RpcSessionEvent);
		const agentRequests = client.requestLog.slice(countAfterTurn);
		const planReq2 = agentRequests.findIndex(r => r.type === "get_plan_state");
		expect(planReq2).toBeGreaterThanOrEqual(0);

		store.dispose();
	});

	it("store.setPlanMode sends set_plan_mode request and updates snapshot on success", async () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);

		const setPromise = store.setPlanMode(true);
		const reqIdx = client.requestLog.findIndex(r => r.type === "set_plan_mode");
		expect(reqIdx).toBeGreaterThanOrEqual(0);
		expect(client.requestLog[reqIdx]).toEqual({ type: "set_plan_mode", enabled: true });

		client.resolveRequest(reqIdx, {
			success: true,
			command: "set_plan_mode",
			data: {
				state: { available: true, enabled: true, paused: false },
			},
		});

		await setPromise;
		expect(store.getSnapshot().planState?.enabled).toBe(true);

		store.dispose();
	});

	it("store.setPlanMode rethrows and notifies when request fails", async () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);

		const setPromise = store.setPlanMode(true);
		const reqIdx = client.requestLog.findIndex(r => r.type === "set_plan_mode");
		client.rejectRequest(reqIdx, new RpcCommandError("set_plan_mode", "Plan mode disabled in config"));

		await expect(setPromise).rejects.toThrow("Plan mode disabled in config");
		store.dispose();
	});

	it("store.approvePlan sends approve_plan request and updates snapshot on success", async () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);

		const approvePromise = store.approvePlan("rev-99", "execute");
		const reqIdx = client.requestLog.findIndex(r => r.type === "approve_plan");
		expect(reqIdx).toBeGreaterThanOrEqual(0);
		expect(client.requestLog[reqIdx]).toEqual({
			type: "approve_plan",
			reviewId: "rev-99",
			action: "execute",
		});

		client.resolveRequest(reqIdx, {
			success: true,
			command: "approve_plan",
			data: {
				state: { available: true, enabled: false, paused: false },
			},
		});

		await approvePromise;
		expect(store.getSnapshot().planState?.enabled).toBe(false);

		store.dispose();
	});

	it("store.approvePlan with refine and feedback sends feedback field", async () => {
		const client = new FakeClient();
		const store = createSessionStore(client as unknown as RpcWebClient);

		const approvePromise = store.approvePlan("rev-99", "refine", "Use SQLite instead");
		const reqIdx = client.requestLog.findIndex(r => r.type === "approve_plan");
		expect(reqIdx).toBeGreaterThanOrEqual(0);
		expect(client.requestLog[reqIdx]).toEqual({
			type: "approve_plan",
			reviewId: "rev-99",
			action: "refine",
			feedback: "Use SQLite instead",
		});

		client.resolveRequest(reqIdx, {
			success: true,
			command: "approve_plan",
			data: {
				state: { available: true, enabled: true, paused: false },
			},
		});

		await approvePromise;
		store.dispose();
	});

	it("session-actions functions build correct command shapes", async () => {
		const client = new FakeClient();
		const sink: SessionCommandSink = { request: client.request.bind(client) };

		// getPlanState
		void getPlanState(sink);
		expect(client.requestLog.at(-1)).toEqual({ type: "get_plan_state" });

		// setPlanMode
		void setPlanMode(sink, false);
		expect(client.requestLog.at(-1)).toEqual({ type: "set_plan_mode", enabled: false });

		// approvePlan: execute
		void approvePlan(sink, "rev-1", "execute");
		expect(client.requestLog.at(-1)).toEqual({
			type: "approve_plan",
			reviewId: "rev-1",
			action: "execute",
		});

		// approvePlan: compact
		void approvePlan(sink, "rev-1", "compact");
		expect(client.requestLog.at(-1)).toEqual({
			type: "approve_plan",
			reviewId: "rev-1",
			action: "compact",
		});

		// approvePlan: refine with feedback
		void approvePlan(sink, "rev-1", "refine", "Add more unit tests");
		expect(client.requestLog.at(-1)).toEqual({
			type: "approve_plan",
			reviewId: "rev-1",
			action: "refine",
			feedback: "Add more unit tests",
		});

		// approvePlan: refine without feedback (empty string or omitted)
		void approvePlan(sink, "rev-1", "refine", "");
		expect(client.requestLog.at(-1)).toEqual({
			type: "approve_plan",
			reviewId: "rev-1",
			action: "refine",
		});
	});
});
