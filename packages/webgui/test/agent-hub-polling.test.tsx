import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import type { ReactNode } from "react";
import type { AgentRosterEntry } from "@oh-my-pi/pi-wire";
import type { RpcServerSubagentMessagesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { Elapsed } from "../src/components/agent-hub/HubDetail";
import { HubTranscript } from "../src/components/agent-hub/HubTranscript";
import type { SessionCommandSink } from "../src/lib/session-actions";

// Exception: react-dom/client must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

let visibility: "visible" | "hidden" = "visible";
Object.defineProperty(win.document, "visibilityState", { configurable: true, get: () => visibility });

async function setVisibility(next: "visible" | "hidden"): Promise<void> {
	visibility = next;
	await act(async () => {
		win.document.dispatchEvent(new win.Event("visibilitychange"));
	});
}

async function advance(ms: number): Promise<void> {
	await act(async () => {
		vi.advanceTimersByTime(ms);
	});
}

function mount() {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	return {
		container,
		render: (node: ReactNode) => act(async () => root.render(node)),
		unmount() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

const agent = (status: AgentRosterEntry["status"]): AgentRosterEntry => ({
	id: "A",
	displayName: "A",
	kind: "sub",
	status,
	agent: "task",
	createdAt: 1,
	lastActivity: 1,
	sessionFile: "/f.jsonl",
});

/** Each poll returns 10 more bytes; records the cursor it was asked for. */
function fakeSink(): SessionCommandSink & { fromBytes: number[] } {
	const fromBytes: number[] = [];
	const sink = {
		fromBytes,
		request: async (req: { fromByte: number }) => {
			fromBytes.push(req.fromByte);
			const data: RpcServerSubagentMessagesResult = {
				sessionFile: "/f.jsonl",
				fromByte: req.fromByte,
				nextByte: req.fromByte + 10,
				fileId: "1:1",
				sentinel: "s",
				reset: false,
				entries: [],
				messages: [],
			};
			return { data };
		},
	};
	return sink as unknown as SessionCommandSink & { fromBytes: number[] };
}

// The transcript view's scroll pinning needs rAF, which happy-dom globals here do not provide.
const g = globalThis as Record<string, unknown>;
const hadRaf = "requestAnimationFrame" in g;

beforeEach(() => {
	visibility = "visible";
	vi.useFakeTimers();
	if (!hadRaf) g.requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
});

afterEach(() => {
	vi.useRealTimers();
	if (!hadRaf) delete g.requestAnimationFrame;
});

describe("HubTranscript polling", () => {
	test("polls while running and visible, pauses while hidden, catches up on visible", async () => {
		const sink = fakeSink();
		const m = mount();
		await m.render(<HubTranscript sink={sink} entry={agent("running")} toolHost={{}} draftKey="k1" />);
		expect(sink.fromBytes).toEqual([0]);
		await advance(1000);
		expect(sink.fromBytes).toEqual([0, 10]);

		await setVisibility("hidden");
		await advance(10_000);
		expect(sink.fromBytes).toEqual([0, 10]);

		await setVisibility("visible");
		expect(sink.fromBytes).toEqual([0, 10, 20]);
		await advance(1000);
		expect(sink.fromBytes).toEqual([0, 10, 20, 30]);
		m.unmount();
	});

	test("status leaving running takes one final poll without resetting the cursor, then stops", async () => {
		const sink = fakeSink();
		const m = mount();
		await m.render(<HubTranscript sink={sink} entry={agent("running")} toolHost={{}} draftKey="k2" />);
		await advance(1000);
		expect(sink.fromBytes).toEqual([0, 10]);

		await m.render(<HubTranscript sink={sink} entry={agent("idle")} toolHost={{}} draftKey="k2" />);
		expect(sink.fromBytes).toEqual([0, 10, 20]);
		await advance(30_000);
		expect(sink.fromBytes).toEqual([0, 10, 20]);

		await m.render(<HubTranscript sink={sink} entry={agent("running")} toolHost={{}} draftKey="k2" />);
		expect(sink.fromBytes).toEqual([0, 10, 20, 30]);
		await advance(1000);
		expect(sink.fromBytes).toEqual([0, 10, 20, 30, 40]);
		m.unmount();
	});
});

describe("Elapsed tick", () => {
	test("ticks every second while visible and pauses while hidden", async () => {
		// Fake timers drive Date.now(), so the clock advances with advanceTimersByTime.
		const m = mount();
		await m.render(<Elapsed sinceMs={Date.now() - 5000} />);
		expect(m.container.textContent).toBe("5.0s");
		await advance(1000);
		expect(m.container.textContent).toBe("6.0s");

		await setVisibility("hidden");
		await advance(9000);
		expect(m.container.textContent).toBe("6.0s");

		await setVisibility("visible");
		expect(m.container.textContent).toBe("15.0s");
		m.unmount();
	});
});
