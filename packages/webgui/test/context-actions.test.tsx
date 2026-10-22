import "./dom-setup";
import { win, NativeEvent } from "./dom-setup";
import { describe, expect, it } from "bun:test";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";
import type { SessionCommandSink } from "../src/lib/session-actions";
import type { ControlCenterPanel, ControlCenterProps, ControlCenterView } from "../src/components/shell/ControlCenter";
// Exception: react-dom/client and ControlCenter must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { ControlCenter } = await import("../src/components/shell/ControlCenter");

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
			return container.querySelector(".tb-confirm-dialog") as unknown as HTMLElement | null;
		},
	};
}

interface Harness {
	props: ControlCenterProps;
	closes: number;
	panels: ControlCenterPanel[];
	views: ControlCenterView[];
	thinking: string[];
	toggles: string[];
}

function harness(sink: SessionCommandSink | null, overrides: Partial<ControlCenterProps> = {}): Harness {
	const h: Harness = {
		closes: 0,
		panels: [],
		views: [],
		thinking: [],
		toggles: [],
		props: undefined as unknown as ControlCenterProps,
	};
	h.props = {
		open: true,
		onClose: () => {
			h.closes++;
		},
		header: <div className="hdr">header</div>,
		title: "test-session",
		todos: { done: 3, total: 7, current: "build concept I" },
		agents: { running: 2, names: ["ComposerAudit", "Other"] },
		ctx: { percent: 41, level: "warning", cost: "$0.47", window: "1M" },
		model: "Opus 5.5",
		thinking: ThinkingLevel.Low,
		thinkingOptions: [
			{ level: ThinkingLevel.Off, label: "Off" },
			{ level: ThinkingLevel.Low, label: "Low" },
			{ level: ThinkingLevel.Medium, label: "Med" },
			{ level: ThinkingLevel.High, label: "High" },
		],
		onSetThinking: level => {
			h.thinking.push(level);
		},
		planMode: false,
		onTogglePlan: () => {
			h.toggles.push("plan");
		},
		voice: true,
		onToggleVoice: () => {
			h.toggles.push("voice");
		},
		expandAll: false,
		onToggleExpandAll: () => {
			h.toggles.push("expand");
		},
		codeWrap: true,
		onToggleCodeWrap: () => {
			h.toggles.push("wrap");
		},
		busy: false,
		sink,
		onOpenPanel: panel => {
			h.panels.push(panel);
		},
		agentsPanel: "subagents",
		view: "home",
		onViewChange: view => {
			h.views.push(view);
		},
		models: { screen: null, view: null, back: () => {}, reset: () => {} },
		...overrides,
	};
	return h;
}

function pressEscape(): void {
	act(() => {
		const ev = new NativeEvent("keydown");
		Object.defineProperty(ev, "key", { value: "Escape" });
		const g = globalThis as unknown as { dispatchEvent(e: unknown): boolean };
		g.dispatchEvent(ev);
	});
}

async function confirmFlow(label: string, confirmLabel: string, expected: unknown[]): Promise<void> {
	const { sink, commands } = createFakeSink();
	const h = harness(sink);
	const t = mount(<ControlCenter {...h.props} />);
	act(() => {
		t.findButtonByText(label)?.click();
	});
	expect(h.closes).toBe(1);
	const dialog = t.findDialog();
	expect(dialog?.getAttribute("aria-modal")).toBe("true");
	expect(dialog?.textContent).toContain("shared with the TUI");
	const confirm = Array.from(t.container.querySelectorAll(".tb-confirm-dialog button")).find(
		b => b.textContent?.trim() === confirmLabel,
	) as unknown as { click(): void } | undefined;
	expect(confirm).toBeDefined();
	await act(async () => {
		confirm?.click();
	});
	expect(commands).toEqual(expected);
	expect(t.container.querySelector(".tb-confirm-dialog")).toBeNull();
	t.cleanup();
}

describe("ControlCenter", () => {
	it("renders tiles from summaries", () => {
		const h = harness(createFakeSink().sink);
		const t = mount(<ControlCenter {...h.props} />);
		const text = t.container.textContent ?? "";
		expect(text).toContain("header");
		expect(text).toContain("Now: build concept I");
		expect(text).toContain("ComposerAudit, 1 more");
		expect(text).toContain("41%");
		expect(text).toContain("$0.47 · 1M window");
		expect(text).toContain("Opus 5.5");
		t.cleanup();
	});

	it("renders nothing when closed", () => {
		const h = harness(createFakeSink().sink, { open: false });
		const t = mount(<ControlCenter {...h.props} />);
		expect(t.container.querySelector(".cc")).toBeNull();
		t.cleanup();
	});

	it("compact sends compact frame after confirm", async () => {
		await confirmFlow("Compact", "Compact", [{ type: "compact" }]);
	});

	it("handoff sends handoff frame after confirm", async () => {
		await confirmFlow("Handoff", "Handoff", [{ type: "handoff" }]);
	});

	it("clear sends /clear prompt after confirm", async () => {
		const { sink, commands } = createFakeSink();
		const h = harness(sink);
		const t = mount(<ControlCenter {...h.props} />);
		act(() => {
			t.findButtonByText("Clear")?.click();
		});
		expect(t.findDialog()?.textContent).toContain("Clear context");
		await act(async () => {
			(t.container.querySelector(".tb-confirm-btn--destructive") as unknown as { click(): void }).click();
		});
		expect(commands).toHaveLength(1);
		expect((commands[0] as { type: string; message: string }).type).toBe("prompt");
		expect((commands[0] as { type: string; message: string }).message).toBe("/clear");
		t.cleanup();
	});

	it("new session sends new_session frame after confirm", async () => {
		await confirmFlow("New session", "New session", [{ type: "new_session" }]);
	});

	it("cancel sends nothing and dismisses dialog", () => {
		const { sink, commands } = createFakeSink();
		const h = harness(sink);
		const t = mount(<ControlCenter {...h.props} />);
		act(() => {
			t.findButtonByText("Compact")?.click();
		});
		act(() => {
			t.findButtonByText("Cancel")?.click();
		});
		expect(t.container.querySelector(".tb-confirm-dialog")).toBeNull();
		expect(commands).toEqual([]);
		t.cleanup();
	});

	it("Escape dismisses the confirm dialog before closing the sheet", () => {
		const { sink } = createFakeSink();
		const h = harness(sink);
		const t = mount(<ControlCenter {...h.props} />);
		act(() => {
			t.findButtonByText("Handoff")?.click();
		});
		expect(h.closes).toBe(1);
		pressEscape();
		expect(t.container.querySelector(".tb-confirm-dialog")).toBeNull();
		expect(h.closes).toBe(1);
		pressEscape();
		expect(h.closes).toBe(2);
		t.cleanup();
	});

	it("Escape and scrim close the sheet", () => {
		const h = harness(createFakeSink().sink);
		const t = mount(<ControlCenter {...h.props} />);
		pressEscape();
		expect(h.closes).toBe(1);
		act(() => {
			(t.container.querySelector(".cc-scrim") as unknown as { click(): void }).click();
		});
		expect(h.closes).toBe(2);
		t.cleanup();
	});

	it("disables reset actions while busy, keeps the rest working", () => {
		const { sink, commands } = createFakeSink();
		const h = harness(sink, { busy: true });
		const t = mount(<ControlCenter {...h.props} />);
		for (const label of ["Compact", "Handoff", "Clear", "New session"]) {
			expect(t.findButtonByText(label)?.disabled).toBe(true);
		}
		expect(t.container.textContent).toContain("wait for the turn to end");
		act(() => {
			t.findButtonByText("Compact")?.click();
		});
		expect(t.findDialog()).toBeNull();
		expect(commands).toEqual([]);
		act(() => {
			t.findButtonByText("High")?.click();
			t.findButtonByText("Usage")?.click();
		});
		expect(h.thinking).toEqual(["high"]);
		expect(h.panels).toEqual(["usage"]);
		t.cleanup();
	});

	it("routes tiles and round buttons to panels and toggles", () => {
		const h = harness(createFakeSink().sink, { agentsPanel: "hub" });
		const t = mount(<ControlCenter {...h.props} />);
		const tiles = Array.from(t.container.querySelectorAll("button.cc-tile")) as unknown as Array<{ click(): void }>;
		act(() => {
			tiles[0].click();
			tiles[1].click();
			(t.container.querySelector(".cc-h-btn") as unknown as { click(): void }).click();
			t.findButtonByText("Details")?.click();
			tiles[2].click();
			tiles[3].click();
			tiles[4].click();
		});
		expect(h.panels).toEqual(["todos", "hub", "info"]);
		expect(h.views).toEqual(["models"]);
		expect(h.toggles).toEqual(["plan", "voice", "expand"]);
		t.cleanup();
	});

	it("rename opens a dialog and calls onRename", async () => {
		const renamed: string[] = [];
		const h = harness(createFakeSink().sink, {
			onRename: async name => {
				renamed.push(name);
			},
		});
		const t = mount(<ControlCenter {...h.props} />);
		act(() => {
			t.findButtonByText("Rename")?.click();
		});
		const input = t.container.querySelector(".tb-rename-input") as InstanceType<typeof win.HTMLInputElement> | null;
		expect(input).not.toBeNull();
		act(() => {
			// React tracks the value through the prototype setter; a plain assignment skips onChange.
			Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, "renamed");
			input?.dispatchEvent(new win.Event("input", { bubbles: true }));
		});
		await act(async () => {
			(t.container.querySelector(".tb-rename-btn--save") as unknown as { click(): void }).click();
		});
		expect(renamed).toEqual(["renamed"]);
		t.cleanup();
	});
});
