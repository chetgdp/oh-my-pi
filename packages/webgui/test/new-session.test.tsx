import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, test } from "bun:test";
// react-dom/client and the form must load after dom-setup installs window/navigator.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { NewSession } = await import("../src/components/sessions/NewSession");
import type { SessionListApi } from "../src/lib/sessions-api";
import type { DirCompletion } from "../src/server/dirs";

const TREE: Record<string, DirCompletion[]> = {
	"/w/p": [
		{ name: "proj", path: "/w/proj/" },
		{ name: "play", path: "/w/play/" },
	],
	"/w/play/": [{ name: "src", path: "/w/play/src/" }],
};

function fakeApi(calls: string[]): SessionListApi {
	const unused = async (): Promise<never> => {
		throw new Error("unused");
	};
	return {
		listLive: unused,
		listPast: unused,
		launch: unused,
		resume: unused,
		shutdown: unused,
		deletePast: unused,
		listDirs: async prefix => {
			calls.push(prefix);
			return TREE[prefix] ?? [];
		},
		complete: async () => null,
	};
}

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
});

type DomInput = InstanceType<typeof win.HTMLInputElement>;

async function mount(
	calls: string[],
): Promise<{ input: DomInput; options: () => string[]; recents: () => number }> {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	await act(async () => {
		root.render(<NewSession api={fakeApi(calls)} recentCwds={["/w/p"]} onAttach={() => {}} />);
	});
	const input = container.querySelector(".ses-cwd-input") as DomInput;
	const options = (): string[] =>
		[...container.querySelectorAll(".ses-dir-option")].map(o => o.textContent ?? "");
	const recents = (): number => container.querySelectorAll("button.ses-recent-cwd").length;
	return { input, options, recents };
}

async function press(input: DomInput, key: string): Promise<void> {
	await act(async () => {
		input.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
	});
}

async function type(input: DomInput, value: string): Promise<void> {
	await act(async () => {
		// React tracks the value through the prototype setter; a plain assignment skips onChange.
		Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, value);
		input.dispatchEvent(new win.Event("input", { bubbles: true }));
		await Bun.sleep(150);
	});
}

describe("NewSession Tab completion", () => {
	test("Tab lists folders; accepting one fills the field and lists inside it", async () => {
		const calls: string[] = [];
		const { input, options } = await mount(calls);
		expect(options()).toEqual([]);

		await press(input, "Tab");
		expect(calls).toEqual(["/w/p"]);
		expect(options()).toEqual(["proj/", "play/"]);

		await press(input, "ArrowDown");
		await press(input, "Tab");
		expect(input.value).toBe("/w/play/");
		expect(calls).toEqual(["/w/p", "/w/play/"]);
		expect(options()).toEqual(["src/"]);

		await press(input, "Escape");
		expect(options()).toEqual([]);
		expect(input.value).toBe("/w/play/");
	});

	test("typing opens the list without Tab and hides the recent folders while it is open", async () => {
		const calls: string[] = [];
		const { input, options, recents } = await mount(calls);
		expect(recents()).toBe(1);

		await type(input, "/w/play/");
		expect(calls).toEqual(["/w/play/"]);
		expect(options()).toEqual(["src/"]);
		expect(recents()).toBe(0);

		await press(input, "Escape");
		expect(recents()).toBe(1);
	});
});
