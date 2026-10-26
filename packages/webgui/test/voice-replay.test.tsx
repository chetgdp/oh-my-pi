import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import type { ReactElement } from "react";
import type { ToolJobHost } from "../src/components/transcript/tool-views/types";
import type { LiveLine } from "../src/lib/live-line";
import * as wren from "../src/lib/wren";
// react-dom/client and components must load after dom-setup installs the window globals.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { ToolView } = await import("../src/components/transcript/tool-views/ToolView");
const { TopBar } = await import("../src/components/shell/TopBar");

const jobs: ToolJobHost = {
	subscribe: () => () => {},
	job: () => undefined,
	seeded: () => true,
	output: () => undefined,
	watch: () => () => {},
};

const cleanups: Array<() => void> = [];
afterEach(() => {
	for (const c of cleanups.splice(0)) c();
});

function mount(ui: ReactElement): HTMLElement {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => root.render(ui));
	cleanups.push(() => {
		act(() => root.unmount());
		container.remove();
	});
	return container as unknown as HTMLElement;
}

function click(el: unknown): void {
	if (!el || typeof el !== "object" || !("click" in el) || typeof el.click !== "function") {
		throw new Error("not clickable");
	}
	const press = el.click;
	act(() => press.call(el));
}

function spySpeak() {
	const spy = spyOn(wren, "speakText").mockImplementation(async () => {});
	cleanups.push(() => spy.mockRestore());
	return spy;
}

describe("voice card replay", () => {
	const cases: Array<[string, string, Record<string, unknown>, string]> = [
		["wren tool", "wren", { command: "say", text: "hello there" }, "hello there"],
		["bash wren say", "bash", { command: 'wren say "hi"' }, "hi"],
	];
	for (const [label, name, args, text] of cases) {
		it(`${label}: Speak replays the card text without toggling the card`, () => {
			const speak = spySpeak();
			const el = mount(
				<ToolView name={name} toolCallId="call_7" args={args} result={{ content: [] }} host={{ jobs }} />,
			);
			const head = el.querySelector(".tv-head")!;
			const before = head.getAttribute("aria-expanded");
			const btn = el.querySelector('.tv-head-row > button[aria-label="Speak"]');
			expect(btn).not.toBeNull();
			click(btn!);
			expect(speak).toHaveBeenCalledWith(text, "call_7");
			expect(el.querySelector(".tv-head")!.getAttribute("aria-expanded")).toBe(before);
		});
	}

	it("non-say wren, plain bash, and export (no host) cards show no Speak button", () => {
		const stop = mount(<ToolView name="bash" toolCallId="a" args={{ command: "wren stop" }} host={{ jobs }} />);
		const plain = mount(<ToolView name="bash" toolCallId="b" args={{ command: "ls -la" }} host={{ jobs }} />);
		const exported = mount(<ToolView name="wren" toolCallId="c" args={{ command: "say", text: "hi" }} />);
		for (const el of [stop, plain, exported]) {
			expect(el.querySelector('button[aria-label="Speak"]')).toBeNull();
		}
	});
});

const line: LiveLine = {
	tone: "normal",
	activity: "bash",
	elapsedFrom: 0,
	ctxPercent: 41,
	ctxLevel: "normal",
	cost: "$0.47",
	retryAt: null,
};

function voiceState(over: Partial<wren.WrenVoiceState>): wren.WrenVoiceState {
	return {
		enabled: true,
		speaking: false,
		error: null,
		armed: false,
		owner: null,
		pending: false,
		...over,
	};
}

function bar(voice: wren.WrenVoiceState): HTMLElement {
	return mount(
		<TopBar title="s" line={line} now={0} ccOpen={false} onToggleCc={() => {}} voice={voice} onToggleVoice={() => {}} />,
	);
}

describe("TopBar voice chip stop", () => {
	it("shows stop while agent speech plays and calls stopSpeaking", () => {
		const stop = spyOn(wren, "stopSpeaking").mockImplementation(async () => {});
		cleanups.push(() => stop.mockRestore());
		const el = bar(voiceState({ speaking: true, owner: null }));
		const btn = el.querySelector('button[aria-label="Stop speaking"]');
		expect(btn).not.toBeNull();
		click(btn!);
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("keeps the toggle chip when idle or when a speak button owns playback", () => {
		for (const v of [voiceState({}), voiceState({ speaking: true, owner: "call_1" })]) {
			const el = bar(v);
			expect(el.querySelector('button[aria-label="Stop speaking"]')).toBeNull();
			expect(el.querySelector(".tb-voice")).not.toBeNull();
		}
	});
});
