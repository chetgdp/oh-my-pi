import "./dom-setup";
import { win, NativeEvent } from "./dom-setup";
import { describe, expect, it } from "bun:test";
import type { SessionCommandSink } from "../src/lib/session-actions";
import type { Route } from "../src/lib/route";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
// Exception: react-dom/client and TopBar must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { TopBar } = await import("../src/components/shell/TopBar");

interface FakeSink {
	sink: SessionCommandSink;
	commands: unknown[];
}

function createFakeSink(): FakeSink {
	const commands: unknown[] = [];
	const request: SessionCommandSink["request"] = cmd => {
		commands.push(cmd);
		return Promise.resolve(undefined) as never;
	};
	return { sink: { request }, commands };
}

interface TestMount {
	container: HTMLElement;
	cleanup(): void;
	findButton(ariaLabel: string): { click(): void; disabled?: boolean } | null;
	findButtonByText(text: string): { click(): void; disabled?: boolean; textContent: string | null } | null;
	findDialog(): HTMLElement | null;
	findMenu(): HTMLElement | null;
}

function mount(ui: React.ReactElement): TestMount {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
		findButton(ariaLabel: string) {
			const el = container.querySelector(`button[aria-label="${ariaLabel}"]`);
			return el as unknown as { click(): void; disabled?: boolean } | null;
		},
		findButtonByText(text: string) {
			const buttons = Array.from(container.querySelectorAll("button")) as unknown as Array<{
				click(): void;
				disabled?: boolean;
				textContent: string | null;
			}>;
			return buttons.find(b => b.textContent?.trim() === text) ?? null;
		},
		findDialog() {
			return container.querySelector('[role="dialog"]') as unknown as HTMLElement | null;
		},
		findMenu() {
			return container.querySelector('[role="menu"]') as unknown as HTMLElement | null;
		},
	};
}

const defaultRoute: Route = { kind: "session", id: "sess-1", panel: null };

describe("TopBar context actions menu", () => {
	it("renders session actions button and is enabled when idle", () => {
		const { sink } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		const btn = t.findButton("Session actions");
		expect(btn).not.toBeNull();
		expect(btn?.disabled).toBeFalsy();
		t.cleanup();
	});

	it("disables session actions button when streaming", () => {
		const { sink } = createFakeSink();
		const t = mount(
			<TopBar title="test-session" connection="ready" route={defaultRoute} streaming={true} sink={sink} />,
		);
		const btn = t.findButton("Session actions");
		expect(btn).not.toBeNull();
		expect(btn?.disabled).toBe(true);
		t.cleanup();
	});

	it("disables session actions button when sessionState isCompacting", () => {
		const { sink } = createFakeSink();
		const sessionState = { isCompacting: true } as unknown as RpcSessionState;
		const t = mount(
			<TopBar
				title="test-session"
				connection="ready"
				route={defaultRoute}
				sessionState={sessionState}
				sink={sink}
			/>,
		);
		const btn = t.findButton("Session actions");
		expect(btn).not.toBeNull();
		expect(btn?.disabled).toBe(true);
		t.cleanup();
	});

	it("disables session actions button when sessionState isStreaming", () => {
		const { sink } = createFakeSink();
		const sessionState = { isStreaming: true } as unknown as RpcSessionState;
		const t = mount(
			<TopBar
				title="test-session"
				connection="ready"
				route={defaultRoute}
				sessionState={sessionState}
				sink={sink}
			/>,
		);
		const btn = t.findButton("Session actions");
		expect(btn).not.toBeNull();
		expect(btn?.disabled).toBe(true);
		t.cleanup();
	});

	it("compact action sends compact frame after confirm", async () => {
		const { sink, commands } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		expect(t.findMenu()).not.toBeNull();

		act(() => {
			t.findButtonByText("Compact")?.click();
		});
		expect(t.findMenu()).toBeNull();
		const dialog = t.findDialog();
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain("shared with the TUI");

		await act(async () => {
			t.findButtonByText("Compact")?.click();
		});
		expect(commands).toEqual([{ type: "compact" }]);
		t.cleanup();
	});

	it("handoff action sends handoff frame after confirm", async () => {
		const { sink, commands } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		act(() => {
			t.findButtonByText("Handoff")?.click();
		});
		const dialog = t.findDialog();
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain("shared with the TUI");

		await act(async () => {
			t.findButtonByText("Handoff")?.click();
		});
		expect(commands).toEqual([{ type: "handoff" }]);
		t.cleanup();
	});

	it("clear context action sends prompt with /clear message after confirm", async () => {
		const { sink, commands } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		act(() => {
			t.findButtonByText("Clear context")?.click();
		});
		const dialog = t.findDialog();
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain("shared with the TUI");

		await act(async () => {
			t.findButtonByText("Clear context")?.click();
		});
		expect(commands).toEqual([{ type: "prompt", message: "/clear" }]);
		t.cleanup();
	});

	it("new session action sends new_session frame after confirm", async () => {
		const { sink, commands } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		act(() => {
			t.findButtonByText("New session")?.click();
		});
		const dialog = t.findDialog();
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain("shared with the TUI");

		await act(async () => {
			t.findButtonByText("New session")?.click();
		});
		expect(commands).toEqual([{ type: "new_session" }]);
		t.cleanup();
	});

	it("cancel sends nothing and dismisses dialog", async () => {
		const { sink, commands } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		act(() => {
			t.findButtonByText("Compact")?.click();
		});
		expect(t.findDialog()).not.toBeNull();

		act(() => {
			t.findButtonByText("Cancel")?.click();
		});
		expect(t.findDialog()).toBeNull();
		expect(commands).toEqual([]);
		t.cleanup();
	});

	it("closes menu on outside backdrop click", () => {
		const { sink } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		expect(t.findMenu()).not.toBeNull();

		const backdrop = t.container.querySelector(".tb-popover-backdrop") as unknown as { click(): void } | null;
		act(() => {
			backdrop?.click();
		});
		expect(t.findMenu()).toBeNull();
		t.cleanup();
	});

	it("closes menu on Escape key", () => {
		const { sink } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		expect(t.findMenu()).not.toBeNull();

		act(() => {
			const ev = new NativeEvent("keydown");
			Object.defineProperty(ev, "key", { value: "Escape" });
			const g = globalThis as unknown as { dispatchEvent(e: unknown): boolean };
			g.dispatchEvent(ev);
		});
		expect(t.findMenu()).toBeNull();
		t.cleanup();
	});

	it("dismisses confirm dialog on Escape key", () => {
		const { sink } = createFakeSink();
		const t = mount(<TopBar title="test-session" connection="ready" route={defaultRoute} sink={sink} />);
		act(() => {
			t.findButton("Session actions")?.click();
		});
		act(() => {
			t.findButtonByText("Compact")?.click();
		});
		expect(t.findDialog()).not.toBeNull();

		act(() => {
			const ev = new NativeEvent("keydown");
			Object.defineProperty(ev, "key", { value: "Escape" });
			const g = globalThis as unknown as { dispatchEvent(e: unknown): boolean };
			g.dispatchEvent(ev);
		});
		expect(t.findDialog()).toBeNull();
		t.cleanup();
	});
});
