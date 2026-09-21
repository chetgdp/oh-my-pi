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

function readyFrame(): string {
	return JSON.stringify({
		type: "ready",
		protocolVersion: 1,
		supportedProtocolVersions: [1, 2],
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
 * (ready + negotiate_protocol + get_state + get_messages).
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
		ws.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 2 }) + "\n");
		queueMicrotask(() => {
			ws.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
			queueMicrotask(() => {
				ws.receive(
					responseFrame("3", "get_messages", { messages: [{ role: "user", content: "hi", timestamp: 1 }] }) + "\n",
				);
			});
		});
	});

	return { client, ws, connected };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RpcWebClient", () => {
	it("connect sends negotiate_protocol, get_state, get_messages in order and resolves", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		expect(client.state).toBe("ready");
		const commands = ws.sent.map(s => JSON.parse(s.trim()).type as string);
		expect(commands).toEqual(["negotiate_protocol", "get_state", "get_messages", "set_subagent_subscription"]);
		expect(client.sessionState?.sessionId).toBe("s1");
		expect(client.messages).toEqual([{ role: "user", content: "hi", timestamp: 1 }]);
		client.close();
	});

	it("routes responses by id", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const promise = client.request({ type: "get_state" });
		// Next id after the 3 attach commands + subagent subscribe is "5"
		ws.receive(responseFrame("5", "get_state", { ...STUB_STATE, sessionId: "s2" }) + "\n");

		const resp = await promise;
		expect(resp.command).toBe("get_state");
		expect((resp as { data: { sessionId: string } }).data.sessionId).toBe("s2");
		client.close();
	});

	it("rejects on error response", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const promise = client.request({ type: "get_state" });
		ws.receive(errorResponseFrame("5", "get_state", "session not found", "NOT_FOUND") + "\n");

		try {
			await promise;
			throw new Error("should have rejected");
		} catch (e) {
			expect(e).toBeInstanceOf(RpcCommandError);
			expect((e as RpcCommandError).code).toBe("NOT_FOUND");
		}
		client.close();
	});

	it("decodes a frame split across two WS messages", async () => {
		const { client, ws, connected } = connectWithAttach();
		await connected;

		const promise = client.request({ type: "get_state" });

		const full = responseFrame("5", "get_state", { ...STUB_STATE, sessionId: "split" }) + "\n";
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
			ws.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 2 }) + "\n");
			queueMicrotask(() => {
				ws.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
				queueMicrotask(() => {
					ws.receive(responseFrame("3", "get_messages", { messages: [] }) + "\n");
				});
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

			const resyncPayloads: Array<{ messages: unknown[]; state: unknown }> = [];
			client.onResync((msgs, st) => resyncPayloads.push({ messages: msgs, state: st }));

			const connected = client.connect();
			const ws1 = sockets[0]!;

			// Complete initial attach
			ws1.receive(readyFrame() + "\n");
			queueMicrotask(() => {
				ws1.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 2 }) + "\n");
				queueMicrotask(() => {
					ws1.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
					queueMicrotask(() => {
						ws1.receive(
							responseFrame("3", "get_messages", { messages: [{ role: "user", content: "hi", timestamp: 1 }] }) +
								"\n",
						);
					});
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
			const newMessages = [
				{ role: "user" as const, content: "hi", timestamp: 1 },
				{ role: "user" as const, content: "hello again", timestamp: 2 },
			];
			ws2.receive(readyFrame() + "\n");
			// Flush microtasks between each response so the sequential attach proceeds
			await Promise.resolve();
			ws2.receive(responseFrame("5", "negotiate_protocol", { protocolVersion: 2 }) + "\n");
			await Promise.resolve();
			ws2.receive(responseFrame("6", "get_state", { ...STUB_STATE, sessionId: "s2" }) + "\n");
			await Promise.resolve();
			ws2.receive(responseFrame("7", "get_messages", { messages: newMessages }) + "\n");
			await Promise.resolve();

			expect(client.state).toBe("ready");
			expect(resyncPayloads).toHaveLength(1);
			expect(resyncPayloads[0]!.messages).toEqual(newMessages);
			expect(client.messages).toEqual(newMessages);

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
				ws1.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 2 }) + "\n");
				queueMicrotask(() => {
					ws1.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
					queueMicrotask(() => {
						ws1.receive(responseFrame("3", "get_messages", { messages: [] }) + "\n");
					});
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
			ws1.receive(responseFrame("1", "negotiate_protocol", { protocolVersion: 2 }) + "\n");
			queueMicrotask(() => {
				ws1.receive(responseFrame("2", "get_state", STUB_STATE) + "\n");
				queueMicrotask(() => {
					ws1.receive(responseFrame("3", "get_messages", { messages: [] }) + "\n");
				});
			});
		});
		await connected;

		// Simulate drop without reconnect option
		ws1.close();
		expect(client.state).toBe("closed");
		expect(sockets.length).toBe(1);
	});
});
