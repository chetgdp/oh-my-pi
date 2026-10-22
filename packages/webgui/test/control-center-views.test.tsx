import "./dom-setup";
import { win, NativeEvent } from "./dom-setup";
import { afterEach, describe, expect, it } from "bun:test";
import type { ReactNode } from "react";
import type { RpcModelBrowserResult, RpcModelRolesResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionCommandSink } from "../src/lib/session-actions";
import type { SessionSnapshot } from "../src/lib/session-store";
import type { ControlCenterProps, ControlCenterView } from "../src/components/shell/ControlCenter";
import { parseRoute } from "../src/lib/route";
// Exception: react-dom/client and the components must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act, useState } = await import("react");
const { ControlCenter, useLegacyControlCenterLink } = await import("../src/components/shell/ControlCenter");
const { useModelsHub } = await import("../src/components/models/useModelsHub");

const BROWSER: RpcModelBrowserResult = {
	mruOrder: [],
	kinds: ["chat"],
	providers: [{ id: "anthropic", authenticated: true, discoverable: false, modelCount: 2 }],
	models: [
		{
			provider: "anthropic",
			id: "claude-sonnet",
			name: "Claude Sonnet",
			selector: "anthropic/claude-sonnet",
			kind: "chat",
			locked: false,
			roles: [],
		},
		{
			provider: "anthropic",
			id: "claude-haiku",
			name: "Claude Haiku",
			selector: "anthropic/claude-haiku",
			kind: "chat",
			locked: false,
			roles: [],
		},
	],
};

const ROLES: RpcModelRolesResult = {
	storage: "global",
	roles: [
		{
			id: "smol",
			name: "Fast",
			section: "chat",
			source: "unset",
			provenance: "default",
			custom: false,
			eligible: [],
		},
	],
	cycleOrder: [],
	modelTags: {},
};

// The hub reads only these fields; the rest of the snapshot is transcript state it never touches.
const SNAP = {
	sessionState: null,
	streaming: false,
	roles: ROLES,
	agents: null,
	browser: BROWSER,
	loginStatus: null,
	login: null,
} as unknown as SessionSnapshot;

interface Log {
	commands: unknown[];
	closes: number;
}

function fakeSink(log: Log): SessionCommandSink {
	const request: SessionCommandSink["request"] = cmd => {
		log.commands.push(cmd);
		return Promise.resolve({ data: {} }) as never;
	};
	return { request };
}

const BASE: Omit<ControlCenterProps, "open" | "onClose" | "view" | "onViewChange" | "models"> = {
	header: null,
	title: "t",
	todos: null,
	agents: { running: 0, names: [] },
	ctx: { percent: null, level: "normal", cost: null, window: null },
	model: "Claude Sonnet",
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
};

/** App's wiring in miniature: App owns open + view, the hub owns picker/login state. */
function Shell({ log, hash }: { log: Log; hash: string }): ReactNode {
	const [open, setOpen] = useState(hash === "");
	const [view, setView] = useState<ControlCenterView>("home");
	const [sink] = useState(() => fakeSink(log));
	const hub = useModelsHub({ sink, snap: SNAP, store: null, routeKey: "s" });
	useLegacyControlCenterLink(parseRoute(hash), v => {
		setView(v);
		setOpen(true);
	});
	return (
		<ControlCenter
			{...BASE}
			open={open}
			onClose={() => {
				log.closes++;
				setOpen(false);
			}}
			view={view}
			onViewChange={setView}
			models={hub}
		/>
	);
}

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
});

function mount(hash = "") {
	const log: Log = { commands: [], closes: 0 };
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => root.render(<Shell log={log} hash={hash} />));
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	const q = (sel: string) => container.querySelector(sel) as unknown as { click(): void; textContent: string | null } | null;
	const byText = (sel: string, text: string) =>
		(Array.from(container.querySelectorAll(sel)) as unknown as Array<{ click(): void; textContent: string | null }>).find(
			el => el.textContent?.includes(text),
		) ?? null;
	return {
		log,
		q,
		byText,
		click(el: { click(): void } | null) {
			expect(el).not.toBeNull();
			act(() => el?.click());
		},
		title: () => q(".cc-nav-title")?.textContent ?? null,
		sheetOpen: () => q(".cc") !== null,
	};
}

function pressEscape(): void {
	act(() => {
		const ev = new NativeEvent("keydown");
		Object.defineProperty(ev, "key", { value: "Escape" });
		// happy-dom installs dispatchEvent on globalThis; the lib types do not declare it there.
		const target = globalThis as unknown as { dispatchEvent(e: unknown): boolean };
		target.dispatchEvent(ev);
	});
}

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
	});
}

describe("ControlCenter view stack", () => {
	it("Model tile pushes the Models view; Esc pops one level, then closes at home", () => {
		const m = mount();
		expect(m.q(".cc-grid")).not.toBeNull();
		expect(m.title()).toBeNull();

		m.click(m.q(".cc-h-btn"));
		expect(m.title()).toBe("Models");
		expect(m.q(".md-screen")).not.toBeNull();
		expect(m.q(".cc-grid")).toBeNull();

		pressEscape();
		expect(m.q(".cc-grid")).not.toBeNull();
		expect(m.log.closes).toBe(0);

		pressEscape();
		expect(m.log.closes).toBe(1);
	});

	it("back button and Esc leave the picker for the Models view", () => {
		const m = mount();
		m.click(m.q(".cc-h-btn"));
		m.click(m.byText('[role="button"]', "smol"));
		expect(m.title()).toBe("Role: Fast");
		expect(m.q(".mps-view")).not.toBeNull();

		pressEscape();
		expect(m.title()).toBe("Models");
		expect(m.q(".mps-view")).toBeNull();

		m.click(m.byText('[role="button"]', "smol"));
		m.click(m.q('button[aria-label="Back"]'));
		expect(m.title()).toBe("Models");
		expect(m.log.closes).toBe(0);
	});

	it("role pick opens the picker; confirming a model sets the role and returns to Models", async () => {
		const m = mount();
		m.click(m.q(".cc-h-btn"));
		m.click(m.byText('[role="button"]', "smol"));
		m.click(m.byText(".mps-row", "Claude Haiku"));
		m.click(m.q(".mps-btn--confirm"));
		await flush();

		expect(m.log.commands).toHaveLength(1);
		expect(m.log.commands[0]).toMatchObject({
			type: "set_model_role",
			role: "smol",
			selector: expect.stringContaining("anthropic/claude-haiku"),
		});
		expect(m.title()).toBe("Models");
		expect(m.q(".mps-view")).toBeNull();
		expect(m.sheetOpen()).toBe(true);
	});

	it("an old #/s/<id>/models link opens the sheet at the Models view and normalizes the hash", () => {
		win.location.hash = "#/s/sess-1/models";
		const m = mount(win.location.hash);
		expect(m.sheetOpen()).toBe(true);
		expect(m.title()).toBe("Models");
		expect(win.location.hash).toBe("#/s/sess-1");
	});
});
