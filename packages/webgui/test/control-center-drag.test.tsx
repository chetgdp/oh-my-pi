import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ControlCenter, type ControlCenterProps } from "../src/components/shell/ControlCenter";
import { TopBar } from "../src/components/shell/TopBar";
import { type SheetDragHandlers, SheetDragTracker, sheetPosition } from "../src/lib/use-sheet-drag";

const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

const HEIGHT = 600;
const ANCHOR = 50;
/** Sheet travel between closed (bottom on the bar edge) and open. */
const TRAVEL = HEIGHT - ANCHOR;

describe("SheetDragTracker release", () => {
	test("dismiss: slow upward drag past 30% of the sheet height commits", () => {
		const t = new SheetDragTracker();
		t.start(600, 0);
		for (let i = 1; i <= 10; i++) t.move(600 - i * 20, i * 100);
		expect(t.release("dismiss", 400, 1100, HEIGHT).kind).toBe("commit");
	});

	test("dismiss: short fast upward flick commits on velocity", () => {
		const t = new SheetDragTracker();
		t.start(600, 0);
		t.move(580, 20);
		expect(t.release("dismiss", 560, 40, HEIGHT).kind).toBe("commit");
	});

	test("dismiss: short slow upward drag reverts", () => {
		const t = new SheetDragTracker();
		t.start(600, 0);
		t.move(560, 200);
		expect(t.release("dismiss", 550, 400, HEIGHT).kind).toBe("revert");
	});

	test("fast drag that stalls before release reverts (only the last 100ms count)", () => {
		const t = new SheetDragTracker();
		t.start(600, 0);
		t.move(500, 30);
		t.move(500, 300);
		expect(t.release("dismiss", 500, 400, HEIGHT).kind).toBe("revert");
	});

	test("dismiss: downward drag is rubber-banded and never commits", () => {
		expect(sheetPosition("dismiss", 100, HEIGHT)).toBeCloseTo(30);
		expect(sheetPosition("dismiss", 700, HEIGHT)).toBe(40);
		const t = new SheetDragTracker();
		t.start(100, 0);
		t.move(800, 600);
		expect(t.release("dismiss", 800, 900, HEIGHT).kind).toBe("revert");
	});

	test("open: sheet tracks from -travel and an upward flick never opens", () => {
		expect(sheetPosition("open", 0, HEIGHT)).toBe(-HEIGHT);
		expect(sheetPosition("open", 250, HEIGHT)).toBe(-350);
		const t = new SheetDragTracker();
		t.start(300, 0);
		t.move(250, 20);
		expect(t.release("open", 200, 40, HEIGHT).kind).toBe("revert");
	});
});

let clock = 0;
const frames: ((t: number) => void)[] = [];
function flushFrames(): void {
	for (const cb of frames.splice(0)) cb(clock);
}
let rafRestore: (() => void) | null = null;

beforeEach(() => {
	clock = 0;
	const g = globalThis as Record<string, unknown>;
	const prevRaf = g.requestAnimationFrame;
	const prevCaf = g.cancelAnimationFrame;
	// Frames run on flushFrames(), after each dispatched event, like a real frame after input.
	g.requestAnimationFrame = (cb: (t: number) => void) => {
		frames.push(cb);
		return frames.length;
	};
	g.cancelAnimationFrame = () => {
		frames.length = 0;
	};
	rafRestore = () => {
		g.requestAnimationFrame = prevRaf;
		g.cancelAnimationFrame = prevCaf;
	};
});
afterEach(() => {
	rafRestore?.();
	delete (win.HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
});

function mount(onClose: () => void) {
	return mountWith({ onClose });
}

function mountWith(opts: { onClose?: () => void; open?: boolean; onOpen?: () => void; onToggle?: () => void }) {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	// The shell top bar whose bottom edge (y=ANCHOR) the sheet hangs from.
	const bar = win.document.createElement("div");
	bar.className = "sh-topbar";
	bar.getBoundingClientRect = () => ({ bottom: ANCHOR }) as ReturnType<typeof bar.getBoundingClientRect>;
	win.document.body.appendChild(bar);
	const root = createRoot(container as unknown as HTMLElement);
	const pullRef: { current: SheetDragHandlers | null } = { current: null };
	const props: ControlCenterProps = {
		open: opts.open ?? true,
		onClose: opts.onClose ?? (() => {}),
		onOpen: opts.onOpen,
		pullRef,
		header: null,
		title: "t",
		todos: null,
		agents: { running: 0, names: [] },
		ctx: { percent: null, level: "normal", cost: null, window: null },
		model: null,
		thinking: null,
		thinkingOptions: [],
		onSetThinking: () => {},
		planMode: false,
		onTogglePlan: () => {},
		voice: false,
		onToggleVoice: () => {},
		expandAll: false,
		onToggleExpandAll: () => {},
		codeWrap: false,
		onToggleCodeWrap: () => {},
		busy: false,
		sink: null,
		onOpenPanel: () => {},
		agentsPanel: "subagents",
		now: () => clock,
	};
	act(() =>
		root.render(
			<>
				<TopBar title="t" line={null} ccOpen={false} onToggleCc={opts.onToggle ?? (() => {})} pull={pullRef} />
				<ControlCenter {...props} />
			</>,
		),
	);
	// happy-dom has no layout; give every element the sheet height.
	Object.defineProperty(win.HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => HEIGHT });
	const sheet = (): HTMLElement | null => container.querySelector(".cc") as unknown as HTMLElement | null;
	const target = (sel: string) => container.querySelector(sel)!;
	const fireOn = (sel: string, type: string, clientY: number, at: number, pointerType = "touch"): void => {
		clock = at;
		act(() => {
			target(sel).dispatchEvent(
				new win.PointerEvent(type, { bubbles: true, pointerId: 1, pointerType, clientY })
			);
			flushFrames();
		});
	};
	const clickOn = (sel: string): void => {
		act(() => target(sel).dispatchEvent(new win.MouseEvent("click", { bubbles: true })));
	};
	return {
		sheet,
		fire: (type: string, clientY: number, at: number) => fireOn(".cc-close", type, clientY, at),
		click: () => clickOn(".cc-close"),
		pullFire: (type: string, clientY: number, at: number, pointerType?: string) =>
			fireOn(".tb-title-btn", type, clientY, at, pointerType),
		pullClick: () => clickOn(".tb-title-btn"),
		cleanup() {
			act(() => root.unmount());
			container.remove();
			bar.remove();
		},
	};
}

async function settleAnimations(): Promise<void> {
	await act(() => Bun.sleep(260));
}

describe("ControlCenter handle drag", () => {
	test("tap on the handle closes exactly once", async () => {
		let closes = 0;
		const m = mount(() => closes++);
		m.fire("pointerdown", 600, 0);
		m.fire("pointerup", 602, 80);
		m.click();
		await settleAnimations();
		expect(closes).toBe(1);
		m.cleanup();
	});

	test("drag past threshold follows the finger, then closes once after the exit animation", async () => {
		let closes = 0;
		const m = mount(() => closes++);
		m.fire("pointerdown", 600, 0);
		m.fire("pointermove", 400, 1000);
		expect(m.sheet()!.style.transform).toBe("translateY(-200px)");
		m.fire("pointerup", 400, 2000);
		m.click();
		expect(closes).toBe(0);
		await settleAnimations();
		expect(closes).toBe(1);
		m.cleanup();
	});

	test("short drag springs back without closing", async () => {
		let closes = 0;
		const m = mount(() => closes++);
		m.fire("pointerdown", 600, 0);
		m.fire("pointermove", 560, 500);
		m.fire("pointerup", 560, 1000);
		m.click();
		await settleAnimations();
		expect(closes).toBe(0);
		expect(m.sheet()!.style.transform).toBe("");
		m.cleanup();
	});

	test("pointercancel mid-drag springs back without closing", async () => {
		let closes = 0;
		const m = mount(() => closes++);
		m.fire("pointerdown", 600, 0);
		m.fire("pointermove", 300, 50);
		m.fire("pointercancel", 300, 60);
		await settleAnimations();
		expect(closes).toBe(0);
		expect(m.sheet()!.style.transform).toBe("");
		m.cleanup();
	});
});

describe("TopBar pull-to-open", () => {
	function closed() {
		const calls = { open: 0, toggle: 0 };
		const m = mountWith({ open: false, onOpen: () => calls.open++, onToggle: () => calls.toggle++ });
		return { m, calls };
	}

	test("pull past 30% of the travel follows the finger from above and opens once", async () => {
		const { m, calls } = closed();
		expect(m.sheet()).toBeNull();
		m.pullFire("pointerdown", 20, 0);
		expect(m.sheet()).not.toBeNull();
		m.pullFire("pointermove", 30, 500);
		// Taking capture on the bar ends the touch's implicit capture on the pressed title; that
		// bubbling lostpointercapture must not cancel the drag.
		m.pullFire("lostpointercapture", 30, 510);
		m.pullFire("pointermove", 270, 1000);
		// Bottom edge = ANCHOR + dy: translateY(-(TRAVEL) + 250).
		expect(m.sheet()!.style.transform).toBe(`translateY(${-TRAVEL + 250}px)`);
		expect(m.sheet()!.style.clipPath).toBe(`inset(${ANCHOR + TRAVEL - 250}px 0 0 0)`);
		m.pullFire("pointerup", 270, 2000);
		m.pullClick();
		await settleAnimations();
		expect(calls).toEqual({ open: 1, toggle: 0 });
		m.cleanup();
	});

	test("short fast downward flick opens", async () => {
		const { m, calls } = closed();
		m.pullFire("pointerdown", 20, 0);
		m.pullFire("pointermove", 40, 20);
		m.pullFire("pointerup", 60, 40);
		m.pullClick();
		await settleAnimations();
		expect(calls).toEqual({ open: 1, toggle: 0 });
		m.cleanup();
	});

	test("short slow pull slides back up and unmounts without opening", async () => {
		const { m, calls } = closed();
		m.pullFire("pointerdown", 20, 0);
		m.pullFire("pointermove", 80, 500);
		m.pullFire("pointerup", 80, 1000);
		m.pullClick();
		await settleAnimations();
		expect(calls).toEqual({ open: 0, toggle: 0 });
		expect(m.sheet()).toBeNull();
		m.cleanup();
	});

	test("mouse press without movement does not capture the pointer, so the click reaches the title and toggles once", async () => {
		// Capture at pointerdown retargets a mouse click to the capturing .tb-bar, so the title's onClick never ran.
		// Class names, not elements: printing a happy-dom node in a failure diff never finishes.
		const captured: string[] = [];
		const proto = win.HTMLElement.prototype as unknown as { setPointerCapture?: (id: number) => void };
		const prev = proto.setPointerCapture;
		proto.setPointerCapture = function (this: { className: string }) {
			captured.push(this.className);
		};
		try {
			const { m, calls } = closed();
			m.pullFire("pointerdown", 20, 0, "mouse");
			m.pullFire("pointermove", 22, 30, "mouse");
			m.pullFire("pointerup", 22, 60, "mouse");
			m.pullClick();
			await settleAnimations();
			expect(captured).toEqual([]);
			expect(calls).toEqual({ open: 0, toggle: 1 });
			expect(m.sheet()).toBeNull();
			m.cleanup();
		} finally {
			proto.setPointerCapture = prev;
		}
	});

	test("tap on the title still toggles once and leaves no pulled sheet behind", async () => {
		const { m, calls } = closed();
		m.pullFire("pointerdown", 20, 0);
		m.pullFire("pointerup", 21, 80);
		m.pullClick();
		await settleAnimations();
		expect(calls).toEqual({ open: 0, toggle: 1 });
		expect(m.sheet()).toBeNull();
		m.cleanup();
	});
});
