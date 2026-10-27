import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
// react-dom/client and the composer must load after dom-setup installs window/navigator.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { Composer } = await import("../src/components/composer/Composer");

const COMMANDS: readonly RpcAvailableSlashCommand[] = [
	{ name: "new", description: "Start a new session", source: "builtin" },
	{ name: "retry", description: "Retry", source: "builtin" },
	{ name: "rename", description: "Rename", source: "builtin" },
	{ name: "reload-plugins", description: "Reload", source: "builtin" },
];

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

async function mount(sent: string[]) {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	await act(async () => {
		root.render(<Composer busy={false} commands={COMMANDS} onSend={text => void sent.push(text)} onAbort={() => {}} />);
	});
	const ta = container.querySelector(".cmp-textarea") as DomTextarea;
	const active = (): string | null => container.querySelector(".cmp-slash-active .cmp-slash-name")?.textContent ?? null;
	return { ta, active };
}

async function press(ta: DomTextarea, key: string): Promise<boolean> {
	let notCancelled = true;
	await act(async () => {
		notCancelled = ta.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
	});
	return notCancelled;
}

async function type(ta: DomTextarea, value: string): Promise<void> {
	await act(async () => {
		// React tracks the value through the prototype setter; a plain assignment skips onChange.
		Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(ta, value);
		ta.setSelectionRange(value.length, value.length);
		ta.dispatchEvent(new win.Event("input", { bubbles: true }));
	});
}

describe("Composer slash menu keyboard", () => {
	test("Enter accepts the highlighted command instead of sending the partial text", async () => {
		const sent: string[] = [];
		const { ta, active } = await mount(sent);
		await type(ta, "/n");
		expect(active()).toBe("/new");
		expect(await press(ta, "Enter")).toBe(false);
		expect(sent).toEqual([]);
		expect(ta.value).toBe("/new ");
		expect(active()).toBeNull();
	});

	test("arrows move the highlight with wraparound; Tab accepts it", async () => {
		const { ta, active } = await mount([]);
		await type(ta, "/re");
		expect(active()).toBe("/retry");
		await press(ta, "ArrowDown");
		expect(active()).toBe("/rename");
		await press(ta, "ArrowUp");
		await press(ta, "ArrowUp");
		expect(active()).toBe("/reload-plugins");
		await press(ta, "Tab");
		expect(ta.value).toBe("/reload-plugins ");
	});

	test("typing resets the highlight to the first match", async () => {
		const { ta, active } = await mount([]);
		await type(ta, "/r");
		await press(ta, "ArrowDown");
		expect(active()).toBe("/rename");
		await type(ta, "/re");
		expect(active()).toBe("/retry");
	});

	test("Escape closes the menu; the next Enter sends the draft", async () => {
		const sent: string[] = [];
		const { ta, active } = await mount(sent);
		await type(ta, "/n");
		await press(ta, "Escape");
		expect(active()).toBeNull();
		await press(ta, "Enter");
		expect(sent).toEqual(["/n"]);
	});
});
