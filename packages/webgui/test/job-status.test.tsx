import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, it } from "bun:test";
import type { ToolResultLike } from "../src/components/transcript/tool-views/types";
import { createJobStore, type JobInfo, type JobStore } from "../src/lib/job-store";
// react-dom/client and components must load after dom-setup installs the window globals.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { ToolView } = await import("../src/components/transcript/tool-views/ToolView");
const { followTail, isAtBottom } = await import("../src/components/transcript/tool-views/follow-tail");
const { RpcCommandError } = await import("../src/lib/rpc-client");

interface FakeTransport {
	calls: string[];
	jobs: Promise<JobInfo[]>;
	tail: string;
	cancelResult: Promise<void>;
}

function makeStore(): { store: JobStore; transport: FakeTransport } {
	const transport: FakeTransport = {
		calls: [],
		jobs: Promise.resolve([]),
		tail: "",
		cancelResult: Promise.resolve(),
	};
	const store = createJobStore({
		getJobs: () => {
			transport.calls.push("get_jobs");
			return transport.jobs;
		},
		subscribe: jobId => {
			transport.calls.push(`subscribe:${jobId}`);
			return Promise.resolve(transport.tail);
		},
		unsubscribe: jobId => {
			transport.calls.push(`unsubscribe:${jobId}`);
			return Promise.resolve();
		},
		cancel: jobId => {
			transport.calls.push(`cancel:${jobId}`);
			return transport.cancelResult;
		},
	});
	return { store, transport };
}

const parkedResult: ToolResultLike = {
	content: [{ type: "text", text: "Background job bg_1 started" }],
	details: { async: { state: "running", jobId: "bg_1", type: "bash" } },
};

function update(state: "running" | "completed" | "failed" | "cancelled", extra: { endedAt?: number } = {}) {
	return {
		type: "job_update",
		toolCallId: "call_1",
		jobId: "bg_1",
		jobType: "bash",
		state,
		startedAt: Date.now() - 134_000,
		...extra,
	};
}

function outputFrame(jobId: string, text: string) {
	return { type: "job_output", jobId, text };
}

let unmount: (() => void) | undefined;
afterEach(() => {
	unmount?.();
	unmount = undefined;
});

function mount(store: JobStore, opts: { toolCallId?: string; result?: ToolResultLike } = {}): HTMLElement {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(
			<ToolView
				name="bash"
				toolCallId={opts.toolCallId ?? "call_1"}
				args={{ command: "sleep 600" }}
				result={opts.result ?? parkedResult}
				host={{ jobs: store }}
			/>,
		);
	});
	unmount = () => {
		act(() => root.unmount());
		container.remove();
	};
	return container as unknown as HTMLElement;
}

const status = (el: HTMLElement): string =>
	el.querySelector(".tv-spin") ? "run" : (el.querySelector(".tv-status")?.className.replace(/.*--/, "") ?? "none");

async function flush(): Promise<void> {
	await act(async () => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
	});
}

function toggle(el: HTMLElement): void {
	act(() => {
		(el.querySelector(".tv-head") as unknown as { click(): void }).click();
	});
}

describe("background job status", () => {
	it("parked start result shows running until the snapshot lands", () => {
		const { store } = makeStore();
		const el = mount(store);
		expect(status(el)).toBe("run");
		expect(el.querySelector(".tv-job")?.textContent).toBe("running · bg_1");
	});

	it("job_update running shows spinner and elapsed label; completed -> ok; failed -> err", async () => {
		const { store } = makeStore();
		store.attach();
		await flush();
		const el = mount(store);
		// Seeded with no running jobs and no update: the parked result is stale.
		expect(status(el)).toBe("ok");

		act(() => void store.handleFrame(update("running")));
		expect(status(el)).toBe("run");
		expect(el.querySelector(".tv-job")?.textContent).toBe("running · bg_1 · 2m 14s");

		act(() => void store.handleFrame(update("completed", { endedAt: Date.now() })));
		expect(status(el)).toBe("ok");
		expect(el.querySelector(".tv-job")?.textContent).toBe("completed · bg_1 · 2m 14s");

		act(() => void store.handleFrame(update("failed", { endedAt: Date.now() })));
		expect(status(el)).toBe("err");
	});

	it("resync restores running jobs from get_jobs", async () => {
		const { store, transport } = makeStore();
		store.handleFrame(update("running"));
		transport.jobs = Promise.resolve([
			{ toolCallId: "call_1", jobId: "bg_1", jobType: "bash", state: "running", startedAt: Date.now() },
		]);
		store.attach();
		await flush();
		expect(transport.calls).toEqual(["get_jobs"]);
		const el = mount(store);
		expect(status(el)).toBe("run");

		// A job that ended while disconnected stops spinning after the next snapshot.
		transport.jobs = Promise.resolve([]);
		act(() => store.attach());
		await flush();
		expect(status(el)).toBe("ok");
	});

	it("reload seeds settled jobs from get_jobs: cancelled/failed -> err, completed -> ok, with label", async () => {
		const now = Date.now();
		const cases = [
			{ state: "cancelled", toolCallId: undefined, dot: "err" },
			{ state: "failed", toolCallId: "call_1", dot: "err" },
			{ state: "completed", toolCallId: undefined, dot: "ok" },
		] as const;
		for (const c of cases) {
			const { store, transport } = makeStore();
			transport.jobs = Promise.resolve([
				{
					...(c.toolCallId ? { toolCallId: c.toolCallId } : {}),
					jobId: "bg_1",
					jobType: "bash",
					state: c.state,
					startedAt: now - 35_000,
					endedAt: now,
				},
			]);
			store.attach();
			await flush();
			const el = mount(store);
			expect(status(el)).toBe(c.dot);
			expect(el.querySelector(".tv-job")?.textContent).toBe(`${c.state} · bg_1 · 35s`);
			unmount?.();
			unmount = undefined;
		}
	});

	it("reload with the job absent from get_jobs falls back to the plain result dot", async () => {
		const { store } = makeStore();
		store.attach();
		await flush();
		const el = mount(store);
		expect(status(el)).toBe("ok");
		expect(el.querySelector(".tv-job")).toBeNull();
	});

	it("expand subscribes, collapse unsubscribes, collapsed cards send nothing", async () => {
		const { store, transport } = makeStore();
		store.handleFrame(update("running"));
		transport.tail = "line 1\n";
		const el = mount(store);
		expect(transport.calls).toEqual([]);

		toggle(el);
		await flush();
		expect(transport.calls).toEqual(["subscribe:bg_1"]);
		expect(el.querySelector(".tv-job-output")?.textContent).toBe("line 1\n");

		act(() => void store.handleFrame(outputFrame("bg_1", "line 1\nline 2\n")));
		expect(el.querySelector(".tv-job-output")?.textContent).toBe("line 1\nline 2\n");

		toggle(el);
		expect(transport.calls).toEqual(["subscribe:bg_1", "unsubscribe:bg_1"]);
		expect(el.querySelector(".tv-job-output")).toBeNull();
	});

	it("job_output renders only for subscribed jobs; unknown frames are ignored", async () => {
		const { store } = makeStore();
		store.handleFrame(update("running"));
		expect(store.handleFrame(outputFrame("bg_1", "unsolicited"))).toBe(true);
		expect(store.output("bg_1")).toBeUndefined();
		const unknownCall = { ...update("running"), toolCallId: "nope", jobId: "bg_9" };
		expect(store.handleFrame(unknownCall)).toBe(true);
		expect(store.handleFrame(outputFrame("bg_404", "x"))).toBe(true);
		expect(store.handleFrame({ type: "entry" })).toBe(false);

		const el = mount(store);
		toggle(el);
		await flush();
		expect(el.querySelector(".tv-job-output")).toBeNull();
		act(() => void store.handleFrame(outputFrame("bg_1", "streamed")));
		expect(el.querySelector(".tv-job-output")?.textContent).toBe("streamed");
	});

	it("unmount releases the subscription", async () => {
		const { store, transport } = makeStore();
		store.handleFrame(update("running"));
		const el = mount(store);
		toggle(el);
		await flush();
		unmount?.();
		unmount = undefined;
		expect(transport.calls).toEqual(["subscribe:bg_1", "unsubscribe:bg_1"]);
	});
	it("stop sends job_cancel without toggling, disables while pending, and settles as cancelled", async () => {
		const { store, transport } = makeStore();
		store.handleFrame(update("running"));
		const pending = Promise.withResolvers<void>();
		transport.cancelResult = pending.promise;
		const el = mount(store);
		const stop = () =>
			el.querySelector(".tv-job-stop") as unknown as HTMLButtonElement | null;
		expect(stop()?.textContent).toBe("stop");

		act(() => stop()!.click());
		expect(transport.calls).toEqual(["cancel:bg_1"]);
		expect(stop()?.disabled).toBe(true);
		expect(el.querySelector(".tv-head")?.getAttribute("aria-expanded")).toBe(
			"false",
		);

		pending.resolve();
		await flush();
		expect(stop()?.disabled).toBe(true);
		act(
			() =>
				void store.handleFrame(update("cancelled", { endedAt: Date.now() })),
		);
		expect(stop()).toBeNull();
		expect(status(el)).toBe("err");
		expect(el.querySelector(".tv-job")?.textContent).toBe(
			"cancelled · bg_1 · 2m 14s",
		);
	});

	it("stop error re-enables the button and shows a short message", async () => {
		const { store, transport } = makeStore();
		store.handleFrame(update("running"));
		transport.cancelResult = Promise.reject(
			new RpcCommandError("job_cancel", "unknown_job"),
		);
		const el = mount(store);
		toggle(el);
		const stop = el.querySelector(
			".tv-job-stop",
		) as unknown as HTMLButtonElement;
		act(() => stop.click());
		await flush();
		expect(stop.disabled).toBe(false);
		expect(el.querySelector(".tv-job-stop-err")?.textContent).toBe(
			"job already ended",
		);
		expect(el.querySelector(".tv-head")?.getAttribute("aria-expanded")).toBe(
			"true",
		);
	});

	it("no stop button for settled jobs or hosts that cannot cancel", () => {
		const { store } = makeStore();
		store.handleFrame(update("completed", { endedAt: Date.now() }));
		const el = mount(store);
		expect(el.querySelector(".tv-job-stop")).toBeNull();
		unmount?.();
		const { cancel: _drop, ...noCancel } = makeStore().store;
		const plain = { ...noCancel, cancel: undefined };
		plain.handleFrame(update("running"));
		expect(mount(plain as JobStore).querySelector(".tv-job-stop")).toBeNull();
	});

	it("bash async pill defers to the header for tracked jobs", () => {
		const { store } = makeStore();
		store.handleFrame(update("running"));
		const el = mount(store);
		toggle(el);
		const badges = () =>
			[...el.querySelectorAll(".tv-badge")].map((b) => b.textContent);
		expect(badges().some((t) => t?.startsWith("async"))).toBe(false);
		act(
			() =>
				void store.handleFrame(update("completed", { endedAt: Date.now() })),
		);
		expect(badges().some((t) => t?.startsWith("async"))).toBe(false);
		expect(el.querySelector(".tv-job")?.textContent).toBe(
			"completed · bg_1 · 2m 14s",
		);
	});

	it("bash async pill shows the parked state when there is no job host", () => {
		const container = win.document.createElement("div");
		win.document.body.appendChild(container);
		const root = createRoot(container as unknown as HTMLElement);
		act(() =>
			root.render(
				<ToolView
					name="bash"
					args={{ command: "x" }}
					result={parkedResult}
					defaultOpen
				/>,
			),
		);
		const texts = [...container.querySelectorAll(".tv-badge")].map(
			(b) => b.textContent,
		);
		expect(texts).toContain("async running");
		act(() => root.unmount());
		container.remove();
	});
});

describe("job output tail follow", () => {
	it("follows at the bottom, stops when scrolled up, resumes at the bottom", () => {
		const box = { scrollTop: 0, scrollHeight: 100, clientHeight: 100 };
		expect(isAtBottom(box)).toBe(true);
		box.scrollHeight = 400;
		expect(followTail(box, true)).toBe(true);
		expect(box.scrollTop).toBe(300);
		expect(isAtBottom(box)).toBe(true);

		box.scrollTop = 120;
		const following = isAtBottom(box);
		expect(following).toBe(false);
		box.scrollHeight = 600;
		expect(followTail(box, following)).toBe(false);
		expect(box.scrollTop).toBe(120);

		box.scrollTop = 496;
		expect(isAtBottom(box)).toBe(true);
		box.scrollHeight = 700;
		followTail(box, isAtBottom({ ...box, scrollHeight: 600 }));
		expect(box.scrollTop).toBe(600);
	});
});
