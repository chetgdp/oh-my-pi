import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { SpeakButton } from "../src/components/transcript/SpeakButton";
import {
	_resetWrenForTesting,
	getWrenState,
	speakText,
	stopSpeaking,
	type BrowserAudioContext,
	type WrenTestHooks,
} from "../src/lib/wren";

// Loaded after dom-setup installs globals, matching the other component tests.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

function mount(ui: ReactElement) {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

function mockContext(): BrowserAudioContext {
	const gain = {
		gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
		connect: () => {},
	};
	return {
		state: "running",
		currentTime: 0,
		destination: {},
		resume: async () => {},
		suspend: async () => {},
		close: async () => {},
		createGain: () => gain,
		createBufferSource: () => ({ buffer: null, connect: () => {}, start: () => {}, stop: () => {}, onended: null }),
		decodeAudioData: async () => ({ duration: 2, numberOfChannels: 1, sampleRate: 24000 }),
	};
}

async function settle(): Promise<void> {
	await act(async () => {
		for (let i = 0; i < 50; i++) await Promise.resolve();
	});
}

interface FakeServer {
	/** Releases one audio segment to the long-poll. */
	deliver(): void;
	speakStatus: number;
}

let originalFetch: typeof globalThis.fetch;
let hooks: WrenTestHooks;
let server: FakeServer;

function installServer(): FakeServer {
	const waiting: Array<(r: Response) => void> = [];
	let seq = 0;
	const srv: FakeServer = {
		speakStatus: 200,
		deliver() {
			const next = waiting.shift();
			next?.(
				new Response(new ArrayBuffer(8), {
					status: 200,
					headers: { "X-Epoch": "1", "X-Seq": String(seq++) },
				}),
			);
		},
	};
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		if (url.includes("/segment")) {
			const { promise, resolve, reject } = Promise.withResolvers<Response>();
			waiting.push(resolve);
			init?.signal?.addEventListener("abort", () => {
				const err = new Error("aborted");
				err.name = "AbortError";
				reject(err);
			});
			return promise;
		}
		if (url.includes("/speak")) {
			if (srv.speakStatus !== 200) {
				return Response.json({ error: { message: "synth down" } }, { status: srv.speakStatus });
			}
			return new Response("{}");
		}
		return new Response("{}");
	}) as typeof fetch;
	return srv;
}

function button(container: HTMLElement): HTMLButtonElement {
	const b = container.querySelector("button");
	if (!b) throw new Error("no button");
	return b as HTMLButtonElement;
}

beforeEach(() => {
	originalFetch = globalThis.fetch;
	server = installServer();
	hooks = _resetWrenForTesting();
	hooks.setAudioContext(mockContext());
});

afterEach(() => {
	_resetWrenForTesting();
	globalThis.fetch = originalFetch;
});

describe("SpeakButton stop state", () => {
	test("stop state survives store notifies while pending and once audio plays", async () => {
		const { container, cleanup } = mount(<SpeakButton text="hello" owner="a" />);
		await act(async () => {
			button(container).click();
		});
		await settle();
		// enable() notifies have re-rendered the button by now.
		expect(button(container).getAttribute("aria-label")).toBe("Stop speaking");
		expect(getWrenState().pending).toBe(true);

		server.deliver();
		await settle();
		expect(getWrenState().speaking).toBe(true);
		expect(getWrenState().pending).toBe(false);
		expect(button(container).getAttribute("aria-label")).toBe("Stop speaking");
		cleanup();
	});

	test("clicking stop clears owner and pending", async () => {
		const { container, cleanup } = mount(<SpeakButton text="hello" owner="a" />);
		await act(async () => {
			button(container).click();
		});
		await settle();
		await act(async () => {
			button(container).click();
		});
		await settle();
		expect(getWrenState().owner).toBeNull();
		expect(getWrenState().pending).toBe(false);
		expect(button(container).getAttribute("aria-label")).toBe("Speak");
		cleanup();
	});

	test("a second owner's speak moves the stop state", async () => {
		const a = mount(<SpeakButton text="one" owner="a" />);
		const b = mount(<SpeakButton text="two" owner="b" />);
		await act(async () => {
			button(a.container).click();
		});
		await settle();
		expect(button(a.container).getAttribute("aria-label")).toBe("Stop speaking");
		await act(async () => {
			button(b.container).click();
		});
		await settle();
		expect(getWrenState().owner).toBe("b");
		expect(button(a.container).getAttribute("aria-label")).toBe("Speak");
		expect(button(b.container).getAttribute("aria-label")).toBe("Stop speaking");
		a.cleanup();
		b.cleanup();
	});
});

describe("Wren owner/pending state", () => {
	test("pending times out when no audio arrives", async () => {
		hooks.setPendingTimeoutMs(20);
		await speakText("hi", "a");
		expect(getWrenState().pending).toBe(true);
		await Bun.sleep(40);
		expect(getWrenState().pending).toBe(false);
		expect(getWrenState().owner).toBeNull();
	});

	test("timeout timer is cleared when audio arrives", async () => {
		hooks.setPendingTimeoutMs(20);
		await speakText("hi", "a");
		server.deliver();
		await settle();
		await Bun.sleep(40);
		expect(getWrenState().owner).toBe("a");
		expect(getWrenState().speaking).toBe(true);
	});

	test("speak fetch error clears pending and owner", async () => {
		server.speakStatus = 500;
		await expect(speakText("hi", "a")).rejects.toThrow("synth down");
		expect(getWrenState().pending).toBe(false);
		expect(getWrenState().owner).toBeNull();
		expect(getWrenState().error).toBe("synth down");
	});

	test("stopSpeaking clears owner and pending", async () => {
		await speakText("hi", "a");
		await stopSpeaking();
		expect(getWrenState().pending).toBe(false);
		expect(getWrenState().owner).toBeNull();
	});

	test("rapid speak then stop reaches the server in tap order and leaves no unowned speech", async () => {
		const order: string[] = [];
		const speakGate = Promise.withResolvers<void>();
		const base = globalThis.fetch;
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/speak")) {
				await speakGate.promise;
				order.push("speak");
			} else if (url.includes("/stop")) {
				order.push("stop");
			}
			return base(input, init);
		}) as typeof fetch;
		const speaking = speakText("hi", "a");
		const stopping = stopSpeaking();
		await settle();
		server.deliver();
		await settle();
		expect(getWrenState().speaking).toBe(false);
		speakGate.resolve();
		await Promise.all([speaking, stopping]);
		expect(order).toEqual(["speak", "stop"]);
		expect(getWrenState().owner).toBeNull();
	});
});
