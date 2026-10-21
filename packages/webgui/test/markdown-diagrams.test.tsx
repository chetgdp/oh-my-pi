import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, it, jest, mock } from "bun:test";
import type { ReactElement } from "react";
import * as realPele from "pele/lazy";
import type { DiagramType } from "pele/lazy";

// Each diagram type is its own lazy chunk; `load` fails like a chunk missing
// from the server while `failLoads` is positive, then defers to the real one.
// mock.module rewrites the live `realPele` namespace too, so keep the real
// `load` before mocking.
const realLoad = realPele.load;
let failLoads = 0;
let failedLoads = 0;
mock.module("pele/lazy", () => ({
	...realPele,
	load(type: DiagramType | null): Promise<boolean> {
		if (failLoads > 0) {
			failLoads--;
			failedLoads++;
			return Promise.reject(new Error("Failed to fetch dynamically imported module"));
		}
		return realLoad(type);
	},
}));

// Exception: react-dom/client and components must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { Markdown } = await import("../src/components/transcript/Markdown");

interface TestMount {
	container: HTMLElement;
	cleanup(): void;
}

const mounted: TestMount[] = [];

function mount(ui: ReactElement): TestMount {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	const m = {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
	mounted.push(m);
	return m;
}

/** Yields whole event-loop turns (no wall-clock delay) until `check` holds; Pele chunks load from disk. */
async function waitFor(check: () => boolean, maxTurns = 500): Promise<void> {
	for (let turn = 0; !check(); turn++) {
		if (turn >= maxTurns) throw new Error("condition not reached");
		await act(async () => {
			await new Promise<void>(resolve => setImmediate(resolve));
		});
	}
}

const FLOWCHART = "```mermaid\nflowchart LR\n  B[Browser PWA] --> TS[tailscale serve]\n```";

afterEach(() => {
	jest.useRealTimers();
	for (const m of mounted.splice(0)) m.cleanup();
});

describe("mermaid fences render with Pele", () => {
	// Runs first: the flowchart type has not been loaded yet.
	it("renders the diagram after a failed lazy load without a reload", async () => {
		// Load Pele itself through another diagram type, so the flowchart chunk
		// load starts synchronously in the mount below.
		const warm = mount(<Markdown text={"```mermaid\npie\n  \"a\" : 1\n```"} />);
		await waitFor(() => warm.container.querySelector(".tr-diagram svg") !== null);
		// React's async act needs real timers; fake them only to skip the retry backoff.
		jest.useFakeTimers();
		failLoads = 1;
		const { container } = mount(<Markdown text={FLOWCHART} />);
		expect(failedLoads).toBe(1);
		expect(container.querySelector(".tr-diagram svg")).toBeNull();
		expect(container.querySelector("pre code")?.textContent).toContain("flowchart LR");
		// The rejection settles in microtasks and queues the retry on the fake clock.
		for (let i = 0; i < 5; i++) await Promise.resolve();
		jest.advanceTimersByTime(1000);
		jest.useRealTimers();
		await waitFor(() => container.querySelector(".tr-diagram svg") !== null);
		expect(container.querySelector("pre code")).toBeNull();
	});

	it("renders a fenced flowchart as an SVG", async () => {
		const { container } = mount(<Markdown text={"```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```"} />);
		await waitFor(() => container.querySelector(".tr-diagram svg") !== null);
		const text = container.querySelector(".tr-diagram svg")?.textContent ?? "";
		expect(text).toContain("Start");
		expect(text).toContain("End");
	});

	it("keeps invalid diagram source as a code block", () => {
		const source = "flowchart LR\n  A -->";
		// Loaded by the tests above, so this renders synchronously on mount.
		expect(realPele.registered("flowchart")).toBe(true);
		expect(() => realPele.render(source)).toThrow(realPele.PeleError);
		const { container } = mount(<Markdown text={`\`\`\`mermaid\n${source}\n\`\`\``} />);
		expect(container.querySelector(".tr-diagram")).toBeNull();
		expect(container.querySelector("pre code")?.textContent).toContain("A -->");
	});
});
