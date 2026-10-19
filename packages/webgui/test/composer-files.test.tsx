import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
// react-dom/client and the composer must load after dom-setup installs window/navigator.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { Composer } = await import("../src/components/composer/Composer");
import type { CompletionResult } from "../src/server/complete";

interface Call {
	text: string;
	cursor: number;
	force: boolean;
}

const RESULTS: Record<string, CompletionResult> = {
	"@ma": {
		prefix: "@ma",
		items: [
			{ value: "@main.ts", label: "main.ts" },
			{ value: "@src/", label: "src/", description: "dir" },
		],
	},
	"@src/": { prefix: "@src/", items: [{ value: "@src/a.ts", label: "a.ts" }] },
	"": { prefix: "", items: [{ value: "README.md", label: "README.md" }] },
};

const g = globalThis as Record<string, unknown>;
let savedMatchMedia: unknown;
beforeEach(() => {
	savedMatchMedia = g.matchMedia;
	g.matchMedia = (_query: string) => ({ matches: true });
});

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
	g.matchMedia = savedMatchMedia;
});

type DomTextarea = InstanceType<typeof win.HTMLTextAreaElement>;

async function mount(calls: Call[], sent: string[]) {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	const complete = async (text: string, cursor: number, force: boolean): Promise<CompletionResult | null> => {
		calls.push({ text, cursor, force });
		return RESULTS[text.slice(0, cursor).split(" ").pop() ?? ""] ?? null;
	};
	await act(async () => {
		root.render(
			<Composer
				busy={false}
				commands={[]}
				onSend={text => {
					sent.push(text);
				}}
				onAbort={() => {}}
				complete={complete}
			/>,
		);
	});
	const ta = container.querySelector(".cmp-textarea") as DomTextarea;
	const items = (): string[] =>
		[...container.querySelectorAll(".cmp-files .cmp-slash-item .cmp-slash-name")].map(o => o.textContent ?? "");
	return { ta, items };
}

async function press(ta: DomTextarea, key: string): Promise<boolean> {
	let notCancelled = true;
	await act(async () => {
		notCancelled = ta.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
		await Bun.sleep(20);
	});
	return notCancelled;
}

async function type(ta: DomTextarea, value: string): Promise<void> {
	await act(async () => {
		// React tracks the value through the prototype setter; a plain assignment skips onChange.
		Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(ta, value);
		ta.setSelectionRange(value.length, value.length);
		ta.dispatchEvent(new win.Event("input", { bubbles: true }));
		await Bun.sleep(150);
	});
}

describe("Composer file completion", () => {
	test("typing @ma opens the list; Enter accepts a file without submitting", async () => {
		const calls: Call[] = [];
		const sent: string[] = [];
		const { ta, items } = await mount(calls, sent);
		await type(ta, "@ma");
		expect(calls).toEqual([{ text: "@ma", cursor: 3, force: false }]);
		expect(items()).toEqual(["main.ts", "src/"]);

		expect(await press(ta, "Enter")).toBe(false);
		expect(sent).toEqual([]);
		expect(ta.value).toBe("@main.ts ");
		expect(ta.selectionStart).toBe(9);
		expect(items()).toEqual([]);
	});

	test("accepting a directory re-requests at the new caret", async () => {
		const calls: Call[] = [];
		const { ta, items } = await mount(calls, []);
		await type(ta, "@ma");
		await press(ta, "ArrowDown");
		await press(ta, "Tab");
		expect(ta.value).toBe("@src/");
		expect(calls.at(-1)).toEqual({ text: "@src/", cursor: 5, force: false });
		expect(items()).toEqual(["a.ts"]);
	});

	test("Tab with no list requests forced completion and stays in the textarea", async () => {
		const calls: Call[] = [];
		const { ta, items } = await mount(calls, []);
		expect(await press(ta, "Tab")).toBe(false);
		expect(calls).toEqual([{ text: "", cursor: 0, force: true }]);
		expect(items()).toEqual(["README.md"]);
	});

	test("Escape closes the list", async () => {
		const { ta, items } = await mount([], []);
		await type(ta, "@ma");
		expect(items().length).toBe(2);
		await press(ta, "Escape");
		expect(items()).toEqual([]);
	});

	test("coarse pointer disables completion", async () => {
		g.matchMedia = (_query: string) => ({ matches: false });
		const calls: Call[] = [];
		const { ta } = await mount(calls, []);
		await type(ta, "@ma");
		expect(await press(ta, "Tab")).toBe(true);
		expect(calls).toEqual([]);
	});
});

type Sent = { text: string; mode: string };

async function mountRow(props: { busy: boolean; compacting?: boolean; history?: readonly string[] }) {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	const sent: Sent[] = [];
	let aborts = 0;
	await act(async () => {
		root.render(
			<Composer
				busy={props.busy}
				compacting={props.compacting}
				commands={[]}
				promptHistory={props.history}
				onSend={(text, mode) => {
					sent.push({ text, mode });
				}}
				onAbort={() => {
					aborts++;
				}}
			/>,
		);
	});
	const ta = container.querySelector(".cmp-textarea") as DomTextarea;
	const q = (sel: string) => container.querySelector(sel) as InstanceType<typeof win.HTMLButtonElement> | null;
	const click = async (sel: string) => {
		await act(async () => {
			q(sel)!.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
		});
	};
	return { ta, q, click, sent, aborts: () => aborts };
}

describe("Composer single row", () => {
	test("stop button calls onAbort", async () => {
		const c = await mountRow({ busy: true });
		await c.click(".cmp-stop");
		expect(c.aborts()).toBe(1);
	});

	test("mode chip toggles steer and followUp sends", async () => {
		const c = await mountRow({ busy: true });
		expect(c.q(".cmp-mode")!.textContent).toBe("Steer");
		await type(c.ta, "a");
		await press(c.ta, "Enter");
		await c.click(".cmp-mode");
		expect(c.q(".cmp-mode")!.textContent).toBe("Queue");
		expect(c.q(".cmp-btn-primary")!.className).toContain("cmp-send--queue");
		await type(c.ta, "b");
		await press(c.ta, "Enter");
		await c.click(".cmp-mode");
		expect(c.q(".cmp-mode")!.textContent).toBe("Steer");
		expect(c.sent).toEqual([
			{ text: "a", mode: "steer" },
			{ text: "b", mode: "followUp" },
		]);
	});

	test("compacting forces followUp and the chip is locked", async () => {
		const c = await mountRow({ busy: true, compacting: true });
		expect(c.q(".cmp-mode")!.textContent).toBe("Queue");
		expect(c.q(".cmp-mode")!.disabled).toBe(true);
		await type(c.ta, "x");
		await c.click(".cmp-btn-primary");
		expect(c.sent).toEqual([{ text: "x", mode: "followUp" }]);
	});

	test("idle has no stop or chip and sends as prompt", async () => {
		const c = await mountRow({ busy: false });
		expect(c.q(".cmp-stop")).toBeNull();
		expect(c.q(".cmp-mode")).toBeNull();
		await type(c.ta, "hi");
		await c.click(".cmp-btn-primary");
		expect(c.sent).toEqual([{ text: "hi", mode: "prompt" }]);
	});

	test("ArrowUp / ArrowDown still navigate prompt history", async () => {
		const c = await mountRow({ busy: false, history: ["first", "second"] });
		expect(await press(c.ta, "ArrowUp")).toBe(false);
		expect(c.ta.value).toBe("second");
		await press(c.ta, "ArrowUp");
		expect(c.ta.value).toBe("first");
		await press(c.ta, "ArrowDown");
		expect(c.ta.value).toBe("second");
	});
});
