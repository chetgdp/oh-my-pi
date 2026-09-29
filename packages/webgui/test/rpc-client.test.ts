import { describe, expect, it, vi } from "bun:test";
import {
	RpcWebClient,
	RpcClientClosedError,
	RpcCommandError,
	type RpcConnectionState,
	type RpcSocketLike,
} from "../src/lib/rpc-client";

// ---------------------------------------------------------------------------
// Fake WebSocket -- EventTarget-based, injected via createSocket
// ---------------------------------------------------------------------------

class FakeWebSocket implements RpcSocketLike {
	sent: string[] = [];
	#closed = false;
	#listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		if (this.#closed) return;
		this.#closed = true;
		for (const fn of this.#listeners.get("close") ?? []) fn({});
	}

	addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
		const list = this.#listeners.get(type);
		if (list) list.push(listener);
		else this.#listeners.set(type, [listener]);
	}

	/** Simulate receiving a text message from the server. */
	receive(text: string): void {
		for (const fn of this.#listeners.get("message") ?? []) fn({ data: text });
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readyFrame(supportedProtocolVersions: number[] = [1, 2, 3]): string {
	return JSON.stringify({
		type: "ready",
		protocolVersion: 1,
		supportedProtocolVersions,
		maxFrameBytes: 1048576,
		maxReassembledFrameBytes: 67108864,
	});
}

function responseFrame(id: string, command: string, data?: unknown): string {
	return JSON.stringify({
		id,
		type: "response",
		command,
		success: true,
		...(data !== undefined ? { data } : {}),
	});
}

function errorResponseFrame(id: string, command: string, error: string, code?: string): string {
	return JSON.stringify({
		id,
		type: "response",
		command,
		success: false,
		error,
		...(code ? { code } : {}),
	});
}

const STUB_STATE = {
	sessionId: "s1",
	isStreaming: false,
	isCompacting: false,
	steeringMode: "all",
	followUpMode: "all",
	interruptMode: "immediate",
	autoCompactionEnabled: false,
	fastModeEnabled: false,
	fastModeActive: false,
	tokensPerSecond: null,
	messageCount: 0,
	queuedMessageCount: 0,
	todoPhases: [],
} as const;

/**
 * Create a client, connect, and auto-respond to the attach sequence
 * (ready + negotiate_protocol + get_state).
 */
function connectWithAttach(): {
	client: RpcWebClient;
	ws: FakeWebSocket;
	connected: Promise<void>;
} {
	let ws!: FakeWebSocket;
	const client = new RpcWebClient({
		url: "ws://localhost:1234",
		createSocket() {
			ws = new FakeWebSocket();
			return ws;
		},
	});

	const connected = client.connect();

	// Send ready, then respond to the three attach commands via microtasks
	ws.receive(readyFrame() + "\n");
	queueMicrotask(() => {
		ws.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
		queueMicrotask(() => {
			ws.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
		});
	});

	return { client, ws, connected };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RpcWebClient", () => {
	it("connect sends negotiate_protocol (v3) and get_state in order and resolves", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		expect(client.state).toBe("ready");
		const commands = ws.sent.map(s => JSON.parse(s.trim()).type as string);
		expect(commands).toEqual(["negotiate_protocol", "get_state", "set_subagent_subscription"]);
		const negPayload = JSON.parse(ws.sent[0]!.trim()) as { protocolVersion: number };
		expect(negPayload.protocolVersion).toBe(3);
		expect(client.sessionState?.sessionId).toBe("s1");
		client.close();
	});

	it("routes responses by id", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const promise = client.request({ type: "get_state" });
		// Next id after the 2 attach commands + subagent subscribe is "4"
		ws.receive(responseFrame("4", "get_state", { ...STUB_STATE, sessionId: "s2" }) + "\n");
		const resp = await promise;
		expect(resp.command).toBe("get_state");
		expect((resp as { data: { sessionId: string } }).data.sessionId).toBe("s2");
		client.close();
	});

	it("rejects on error response", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const promise = client.request({ type: "get_state" });
		ws.receive(errorResponseFrame("4", "get_state", "session not found", "NOT_FOUND") + "\n");

		try {
			await promise;
			throw new Error("should have rejected");
		} catch (e) {
			expect(e).toBeInstanceOf(RpcCommandError);
			expect((e as RpcCommandError).code).toBe("NOT_FOUND");
		}
		client.close();
	});

	it("delivers an error response that arrives after the request already resolved", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const late: RpcCommandError[] = [];
		client.onLateError(err => late.push(err));
		const promise = client.request({ type: "prompt", message: "hi" });
		ws.receive(responseFrame("4", "prompt") + "\n");
		expect((await promise).success).toBe(true);

		ws.receive(errorResponseFrame("4", "prompt", "Agent is already processing") + "\n");
		// Unknown ids are not ours; they must stay silent.
		ws.receive(errorResponseFrame("99", "prompt", "stray") + "\n");
		expect(late.map(e => [e.command, e.message])).toEqual([["prompt", "prompt: Agent is already processing"]]);
		client.close();
	});

	it("decodes a frame split across two WS messages", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const promise = client.request({ type: "get_state" });

		const full = responseFrame("4", "get_state", { ...STUB_STATE, sessionId: "split" }) + "\n";
		const mid = Math.floor(full.length / 2);
		ws.receive(full.slice(0, mid));
		ws.receive(full.slice(mid));

		const resp = await promise;
		expect((resp as { data: { sessionId: string } }).data.sessionId).toBe("split");
		client.close();
	});

	it("events reach onEvent listeners", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const events: unknown[] = [];
		client.onEvent(ev => events.push(ev));

		ws.receive(JSON.stringify({ type: "subagent_lifecycle", payload: { id: "a1", status: "running" } }) + "\n");

		expect(events).toHaveLength(1);
		expect((events[0] as { type: string }).type).toBe("subagent_lifecycle");
		client.close();
	});

	it("onEvent unsubscribe stops delivery", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const events: unknown[] = [];
		const unsub = client.onEvent(ev => events.push(ev));
		unsub();

		ws.receive(JSON.stringify({ type: "subagent_lifecycle", payload: { id: "a1", status: "done" } }) + "\n");
		expect(events).toHaveLength(0);
		client.close();
	});

	it("close rejects pending requests and sets state closed", async () => {
		const { client, connected } = connectWithAttach();
		await connected;

		const promise = client.request({ type: "get_state" });
		client.close();

		try {
			await promise;
			throw new Error("should have rejected");
		} catch (e) {
			expect(e).toBeInstanceOf(RpcClientClosedError);
		}
		expect(client.state).toBe("closed");
	});

	it("onStateChange fires on transitions", async () => {
		const states: RpcConnectionState[] = [];
		let ws!: FakeWebSocket;
		const client = new RpcWebClient({
			url: "ws://localhost:1234",
			createSocket() {
				ws = new FakeWebSocket();
				return ws;
			},
		});
		client.onStateChange(s => states.push(s));

		const p = client.connect();
		expect(states).toEqual(["connecting"]);

		ws.receive(readyFrame() + "\n");
		queueMicrotask(() => {
			ws.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
			queueMicrotask(() => {
				ws.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
			});
		});

		await p;
		expect(states).toEqual(["connecting", "ready"]);
		client.close();
		expect(states).toEqual(["connecting", "ready", "closed"]);
	});

	it("request rejects immediately when already closed", async () => {
		const client = new RpcWebClient({ url: "ws://localhost:1234" });
		try {
			await client.request({ type: "get_state" });
			throw new Error("should have rejected");
		} catch (e) {
			expect(e).toBeInstanceOf(RpcClientClosedError);
		}
	});

	it("reconnects after unexpected close and fires onResync", async () => {
		vi.useFakeTimers();
		try {
			const sockets: FakeWebSocket[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});

			const states: RpcConnectionState[] = [];
			client.onStateChange(s => states.push(s));

			const resyncPayloads: Array<{ state: unknown }> = [];
			client.onResync(st => resyncPayloads.push({ state: st }));
			const connected = client.connect();
			const ws1 = sockets[0]!;

			// Complete initial attach
			ws1.receive(readyFrame() + "\n");
			queueMicrotask(() => {
				ws1.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
				queueMicrotask(() => {
					ws1.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
				});
			});
			await connected;
			expect(client.state).toBe("ready");

			// Simulate unexpected socket close
			ws1.close();
			expect(client.state).toBe("reconnecting");
			expect(states).toContain("reconnecting");

			// Advance past the reconnect delay (baseDelayMs 1 * jitter 0.5-1)
			vi.advanceTimersByTime(10);

			expect(sockets.length).toBe(2);
			const ws2 = sockets[1]!;

			// Complete the reconnect attach sequence (ids continue: 5,6,7)
			ws2.receive(readyFrame() + "\n");
			// Flush microtasks between each response so the sequential attach proceeds
			await Promise.resolve();
			ws2.receive(responseFrame("4", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
			await Promise.resolve();
			ws2.receive(responseFrame("5", "get_state", { ...STUB_STATE, sessionId: "s2" }) + "\n");
			await Promise.resolve();

			expect(client.state).toBe("ready");
			expect(resyncPayloads).toHaveLength(1);
			expect((resyncPayloads[0]!.state as { sessionId: string }).sessionId).toBe("s2");

			client.close();
		} finally {
			vi.useRealTimers();
		}
	});

	it("close() during reconnecting cancels reconnect", async () => {
		vi.useFakeTimers();
		try {
			const sockets: FakeWebSocket[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});

			const connected = client.connect();
			const ws1 = sockets[0]!;

			ws1.receive(readyFrame() + "\n");
			queueMicrotask(() => {
				ws1.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
				queueMicrotask(() => {
					ws1.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
				});
			});
			await connected;

			// Simulate drop
			ws1.close();
			expect(client.state).toBe("reconnecting");

			// Close before the timer fires
			client.close();
			expect(client.state).toBe("closed");

			// Advance time -- no new socket should be created
			vi.advanceTimersByTime(100);
			expect(sockets.length).toBe(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("without reconnect option, unexpected close sets state to closed", async () => {
		const sockets: FakeWebSocket[] = [];
		const client = new RpcWebClient({
			url: "ws://localhost:1234",
			createSocket() {
				const ws = new FakeWebSocket();
				sockets.push(ws);
				return ws;
			},
		});

		const connected = client.connect();
		const ws1 = sockets[0]!;

		ws1.receive(readyFrame() + "\n");
		queueMicrotask(() => {
			ws1.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
			queueMicrotask(() => {
				ws1.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
			});
		});
		await connected;

		// Simulate drop without reconnect option
		ws1.close();
		expect(client.state).toBe("closed");
		expect(sockets.length).toBe(1);
	});

	it("sets incompatible state and stops reconnecting when server offers [1, 2]", async () => {
		vi.useFakeTimers();
		try {
			const sockets: FakeWebSocket[] = [];
			const states: RpcConnectionState[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});
			client.onStateChange(s => states.push(s));

			const connected = client.connect();
			const ws = sockets[0]!;

			ws.receive(readyFrame([1, 2]) + "\n");
			await expect(connected).rejects.toThrow();
			expect(client.state).toBe("incompatible");
			expect(states).toContain("incompatible");

			// Advance timers -- no reconnect loop should happen
			vi.advanceTimersByTime(100);
			expect(sockets.length).toBe(1);
			expect(client.state).toBe("incompatible");
		} finally {
			vi.useRealTimers();
		}
	});

	it("sets incompatible state when negotiate_protocol rejects", async () => {
		vi.useFakeTimers();
		try {
			const sockets: FakeWebSocket[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});

			const connected = client.connect();
			const ws = sockets[0]!;

			ws.receive(readyFrame([1, 2, 3]) + "\n");
			queueMicrotask(() => {
				ws.receive(errorResponseFrame("1", "negotiate_protocol", "rejected", "INCOMPATIBLE") + "\n");
			});

			await expect(connected).rejects.toThrow();
			expect(client.state).toBe("incompatible");

			vi.advanceTimersByTime(100);
			expect(sockets.length).toBe(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("socket drop during reconnect negotiate keeps reconnecting without unhandled rejections", async () => {
		vi.useFakeTimers();
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);
		try {
			const sockets: FakeWebSocket[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});
			const connected = client.connect();
			const ws1 = sockets[0]!;
			ws1.receive(readyFrame() + "\n");
			await Promise.resolve();
			ws1.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
			await Promise.resolve();
			ws1.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
			await connected;

			ws1.close();
			vi.advanceTimersByTime(10);
			const ws2 = sockets[1]!;
			ws2.receive(readyFrame() + "\n");
			// Transport failure while negotiate_protocol is pending is not an incompatibility.
			ws2.close();
			for (let i = 0; i < 10; i++) await Promise.resolve();
			expect(client.state).toBe("reconnecting");

			vi.advanceTimersByTime(100);
			expect(sockets.length).toBe(3);

			// A real negotiate error on a reconnect ends in incompatible, still without rejection noise.
			const ws3 = sockets[2]!;
			ws3.receive(readyFrame() + "\n");
			await Promise.resolve();
			const negotiate = JSON.parse(ws3.sent[0]!.trim()) as { id: string };
			ws3.receive(errorResponseFrame(negotiate.id, "negotiate_protocol", "rejected") + "\n");
			for (let i = 0; i < 10; i++) await Promise.resolve();
			expect(client.state).toBe("incompatible");
			vi.useRealTimers();
			await new Promise(resolve => setImmediate(resolve));
			expect(unhandled).toEqual([]);
		} finally {
			process.off("unhandledRejection", onUnhandled);
			vi.useRealTimers();
		}
	});

	it("history sends command with expected shape and returns data", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const historyPromise = client.history({ before: "entry-99", leafId: "leaf-1", limit: 50 });
		const sentCmd = JSON.parse(ws.sent[3]!.trim()) as {
			type: string;
			before?: string;
			leafId?: string;
			limit?: number;
			id: string;
		};
		expect(sentCmd.type).toBe("history");
		expect(sentCmd.before).toBe("entry-99");
		expect(sentCmd.leafId).toBe("leaf-1");
		expect(sentCmd.limit).toBe(50);

		const fakeResult = {
			leafId: "leaf-1",
			entries: [{ id: "entry-1", type: "message", timestamp: "t1" }],
			hasMore: true,
			live: [],
		};
		ws.receive(responseFrame(sentCmd.id, "history", fakeResult) + "\n");

		const result = await historyPromise;
		expect(result).toEqual(fakeResult as never);

		// history without options
		const barePromise = client.history();
		const bareCmd = JSON.parse(ws.sent[4]!.trim()) as { type: string; before?: string; id: string };
		expect(bareCmd.type).toBe("history");
		expect(bareCmd.before).toBeUndefined();
		ws.receive(responseFrame(bareCmd.id, "history", { leafId: null, entries: [], hasMore: false, live: [] }) + "\n");
		const bareResult = await barePromise;
		expect(bareResult.entries).toEqual([]);

		client.close();
	});

	it("initial-open failure schedules a retry and state remains connecting", async () => {
		vi.useFakeTimers();
		try {
			const sockets: FakeWebSocket[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});

			const states: RpcConnectionState[] = [];
			client.onStateChange(s => states.push(s));

			const connected = client.connect();
			expect(client.state).toBe("connecting");
			expect(client.reconnectAttempt).toBe(0);
			expect(sockets.length).toBe(1);

			// First socket fails before ready
			const ws1 = sockets[0]!;
			ws1.close();

			// State must remain "connecting", not "closed" or "reconnecting"
			expect(client.state).toBe("connecting");
			expect(client.reconnectAttempt).toBe(1);

			// Advance timer so reconnect creates second socket
			vi.advanceTimersByTime(10);
			expect(sockets.length).toBe(2);
			expect(client.state).toBe("connecting");

			// Second socket receives ready and attaches successfully
			const ws2 = sockets[1]!;
			ws2.receive(readyFrame() + "\n");
			await Promise.resolve();
			ws2.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 3 }) + "\n");
			await Promise.resolve();
			ws2.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
			await Promise.resolve();

			await connected;
			expect(client.state).toBe("ready");
			expect(client.reconnectAttempt).toBe(0);

			client.close();
			expect(client.state).toBe("closed");
		} finally {
			vi.useRealTimers();
		}
	});

	it("incompatible server on initial-open stays terminal and does not retry", async () => {
		vi.useFakeTimers();
		try {
			const sockets: FakeWebSocket[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});

			const connected = client.connect();
			const ws = sockets[0]!;
			// Server only supports old protocol versions
			ws.receive(readyFrame([1, 2]) + "\n");
			await Promise.resolve();

			await expect(connected).rejects.toThrow();
			expect(client.state).toBe("incompatible");

			// Advance timers -- no retry should be scheduled
			vi.advanceTimersByTime(100);
			expect(sockets.length).toBe(1);
			expect(client.state).toBe("incompatible");
		} finally {
			vi.useRealTimers();
		}
	});

	it("intentional close() before ready stays closed and cancels retry", async () => {
		vi.useFakeTimers();
		try {
			const sockets: FakeWebSocket[] = [];
			const client = new RpcWebClient({
				url: "ws://localhost:1234",
				createSocket() {
					const ws = new FakeWebSocket();
					sockets.push(ws);
					return ws;
				},
				reconnect: { enabled: true, baseDelayMs: 1 },
			});

			client.connect();
			const ws = sockets[0]!;
			ws.close();
			expect(client.reconnectAttempt).toBe(1);

			// User intentionally closes client
			client.close();
			expect(client.state).toBe("closed");

			vi.advanceTimersByTime(100);
			expect(sockets.length).toBe(1);
			expect(client.state).toBe("closed");
		} finally {
			vi.useRealTimers();
		}
	});

	describe("request deduplication", () => {
		it("two concurrent get_state calls send one frame and both resolve with the same result", async () => {
			const { client, ws, connected } = connectWithAttach();
			await connected;

			const p1 = client.request({ type: "get_state" });
			const p2 = client.request({ type: "get_state" });

			// Only one frame should have been sent (id "4")
			const postAttach = ws.sent.slice(3);
			expect(postAttach).toHaveLength(1);

			ws.receive(responseFrame("4", "get_state", { ...STUB_STATE, sessionId: "deduped" }) + "\n");

			const [r1, r2] = await Promise.all([p1, p2]);
			expect(r1).toBe(r2);
			expect((r1 as { data: { sessionId: string } }).data.sessionId).toBe("deduped");
			client.close();
		});

		it("after settle a new call sends a new frame", async () => {
			const { client, ws, connected } = connectWithAttach();
			await connected;

			const p1 = client.request({ type: "get_state" });
			ws.receive(responseFrame("4", "get_state", STUB_STATE) + "\n");
			await p1;

			const p2 = client.request({ type: "get_state" });
			// Should have sent a second frame (id "5")
			const postAttach = ws.sent.slice(3);
			expect(postAttach).toHaveLength(2);
			expect(JSON.parse(postAttach[1]!.trim()).id).toBe("5");

			ws.receive(responseFrame("5", "get_state", STUB_STATE) + "\n");
			await p2;
			client.close();
		});

		it("two concurrent mutating calls send two frames", async () => {
			const { client, ws, connected } = connectWithAttach();
			await connected;

			const p1 = client.request({ type: "prompt", message: "a" } as Parameters<typeof client.request>[0]);
			const p2 = client.request({ type: "prompt", message: "a" } as Parameters<typeof client.request>[0]);

			const postAttach = ws.sent.slice(3);
			expect(postAttach).toHaveLength(2);
			expect(JSON.parse(postAttach[0]!.trim()).id).toBe("4");
			expect(JSON.parse(postAttach[1]!.trim()).id).toBe("5");

			ws.receive(responseFrame("4", "prompt") + "\n");
			ws.receive(responseFrame("5", "prompt") + "\n");
			await Promise.all([p1, p2]);
			client.close();
		});

		it("different params are not merged", async () => {
			const { client, ws, connected } = connectWithAttach();
			await connected;

			const p1 = client.request({ type: "get_model_roles" } as Parameters<typeof client.request>[0]);
			const p2 = client.request({ type: "get_agents" } as Parameters<typeof client.request>[0]);

			const postAttach = ws.sent.slice(3);
			expect(postAttach).toHaveLength(2);

			ws.receive(responseFrame("4", "get_model_roles", { roles: [] }) + "\n");
			ws.receive(responseFrame("5", "get_agents", { agents: [] }) + "\n");
			await Promise.all([p1, p2]);
			client.close();
		});

		it("error settles dedupe entry so retry sends a new frame", async () => {
			const { client, ws, connected } = connectWithAttach();
			await connected;

			const p1 = client.request({ type: "get_state" });
			ws.receive(errorResponseFrame("4", "get_state", "fail") + "\n");
			await p1.catch(() => {});

			const p2 = client.request({ type: "get_state" });
			const postAttach = ws.sent.slice(3);
			expect(postAttach).toHaveLength(2);

			ws.receive(responseFrame("5", "get_state", STUB_STATE) + "\n");
			await p2;
			client.close();
		});
	});
});
