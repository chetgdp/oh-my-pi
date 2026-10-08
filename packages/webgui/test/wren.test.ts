import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	_resetWrenForTesting,
	claimOnInput,
	disableVoice,
	enableVoice,
	generateChannelId,
	getOrCreateChannelId,
	getWrenState,
	subscribeWren,
	type BrowserAudioBuffer,
	type BrowserAudioContext,
	type BrowserGainNode,
	type WrenTestHooks,
} from "../src/lib/wren";

function createMockAudioContext(): {
	ctx: BrowserAudioContext;
	stopped: boolean[];
} {
	const stopped: boolean[] = [];
	const time = 0;

	const dummyGain: BrowserGainNode = {
		gain: {
			value: 1,
			setValueAtTime: () => {},
			linearRampToValueAtTime: () => {},
		},
		connect: () => {},
	};

	const ctx: BrowserAudioContext = {
		state: "running",
		get currentTime() {
			return time;
		},
		destination: {},
		resume: async () => {},
		suspend: async () => {},
		close: async () => {},
		createGain: () => dummyGain,
		createBufferSource: () => {
			const index = stopped.length;
			stopped.push(false);
			return {
				buffer: null,
				connect: () => {},
				start: () => {},
				stop: () => {
					stopped[index] = true;
				},
				onended: null,
			};
		},
		decodeAudioData: async () => {
			const buf: BrowserAudioBuffer = {
				duration: 2.0,
				numberOfChannels: 1,
				sampleRate: 24000,
			};
			return buf;
		},
	};

	return { ctx, stopped };
}

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 50; i++) await Promise.resolve();
}

describe("Wren TTS client logic", () => {
	let originalFetch: typeof globalThis.fetch;
	let originalLocalStorage: Storage | undefined;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		originalLocalStorage = globalThis.localStorage;
		_resetWrenForTesting();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalLocalStorage !== undefined) {
			globalThis.localStorage = originalLocalStorage;
		}
		_resetWrenForTesting();
	});

	it("generates and persists valid channel id format [a-z0-9_-]{1,32}", () => {
		const generated = generateChannelId();
		expect(/^[a-z0-9_-]{1,32}$/.test(generated)).toBe(true);
		expect(generated.startsWith("webgui-")).toBe(true);

		const channel = getOrCreateChannelId();
		expect(/^[a-z0-9_-]{1,32}$/.test(channel)).toBe(true);
	});

	it("epoch change drops scheduled audio and resets after sequence", () => {
		const hooks: WrenTestHooks = _resetWrenForTesting();
		const { ctx } = createMockAudioContext();
		hooks.setAudioContext(ctx);

		// Simulate scheduled entries by calling handleEpochChange sequence
		hooks.handleEpochChange(1);
		expect(hooks.getLastEpoch()).toBe(1);

		// Change epoch: should flush any scheduled audio and reset lastSeq & playedSeq
		hooks.handleEpochChange(2);
		expect(hooks.getLastEpoch()).toBe(2);
		expect(hooks.getLastSeq()).toBe(-1);
		expect(hooks.getPlayedSeq()).toBe(-1);
		expect(hooks.getScheduled().length).toBe(0);
	});

	it("claimOnInput reclaims when another client took active, and not when the server says we hold it", async () => {
		const realFetch = globalThis.fetch;
		const posts: string[] = [];
		let serverActive = "mac-pq9";
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (init?.method === "POST") posts.push(url);
			const body = url.endsWith("/health")
				? { active_client: { channel: serverActive } }
				: { active: "webgui-test" };
			return new Response(JSON.stringify(body), { status: 200 });
		}) as typeof globalThis.fetch;
		const realNow = Date.now;
		let now = 1_000_000;
		Date.now = () => now;
		try {
			const hooks: WrenTestHooks = _resetWrenForTesting();
			hooks.setChannel("webgui-test");
			await claimOnInput();
			expect(posts).toHaveLength(0);

			hooks.setEnabled(true);
			// Local flag says active, but Wren.app has since claimed: must POST.
			hooks.setActive(true);
			await claimOnInput();
			expect(posts).toEqual([expect.stringContaining("/clients/active")]);

			serverActive = "webgui-test";
			now += 5000;
			await claimOnInput();
			expect(posts).toHaveLength(1);
			expect(getWrenState().active).toBe(true);
		} finally {
			globalThis.fetch = realFetch;
			Date.now = realNow;
		}
	});

	it("disable() then enable() leaves exactly one segment poll loop", async () => {
		const realFetch = globalThis.fetch;
		let inFlight = 0;
		let maxInFlight = 0;
		let segmentCalls = 0;
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (!url.includes("/segment")) {
				return new Response(JSON.stringify({ active: "webgui-test" }), { status: 200 });
			}
			segmentCalls++;
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			return await new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					inFlight--;
					reject(new DOMException("aborted", "AbortError"));
				});
			});
		}) as typeof globalThis.fetch;
		try {
			const hooks: WrenTestHooks = _resetWrenForTesting();
			hooks.setChannel("webgui-test");
			await enableVoice();
			expect(inFlight).toBe(1);
			// Re-enable before the aborted fetch's catch resumes the old loop.
			disableVoice();
			await enableVoice();
			await flushMicrotasks();
			expect(inFlight).toBe(1);
			expect(maxInFlight).toBe(1);
			expect(segmentCalls).toBe(2);
		} finally {
			disableVoice();
			await flushMicrotasks();
			globalThis.fetch = realFetch;
		}
	});

	it("snapshot identity is stable and listeners are not called when nothing changed", () => {
		const hooks: WrenTestHooks = _resetWrenForTesting();
		const before = getWrenState();
		let calls = 0;
		const unsub = subscribeWren(() => calls++);
		hooks.setActive(false);
		expect(getWrenState()).toBe(before);
		disableVoice();
		expect(getWrenState()).toBe(before);
		expect(calls).toBe(0);
		hooks.setActive(true);
		expect(getWrenState()).not.toBe(before);
		expect(getWrenState().active).toBe(true);
		unsub();
	});
});
