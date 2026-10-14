import "./dom-setup";
import { NativeEvent, win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
// react-dom/client and the sheet must load after dom-setup installs window/navigator.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { ExtensionDialogSheet } = await import("../src/components/dialog/ExtensionDialogSheet");
import { createSessionStore, type SessionStore } from "../src/lib/session-store";
import type { RpcConnectionState, RpcSessionEvent, RpcWebClient } from "../src/lib/rpc-client";
import type {
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
	RpcServerSessionState,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

class FakeClient {
	state: RpcConnectionState = "ready";
	sessionState: RpcServerSessionState | null = null;
	sent: RpcExtensionUIResponse[] = [];
	connected = true;
	#eventListeners: Array<(e: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];

	history(): Promise<never> {
		return Promise.withResolvers<never>().promise;
	}
	requests: Array<{ type: string }> = [];
	request(command: { type: string }): Promise<never> {
		this.requests.push(command);
		return Promise.withResolvers<never>().promise;
	}
	onEvent(fn: (e: RpcSessionEvent) => void): () => void {
		this.#eventListeners.push(fn);
		return () => {};
	}
	onStateChange(fn: (s: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(fn);
		return () => {};
	}
	onResync(): () => void {
		return () => {};
	}
	sendUIResponse(response: RpcExtensionUIResponse): boolean {
		if (!this.connected) return false;
		this.sent.push(response);
		return true;
	}
	emit(frame: RpcExtensionUIRequest): void {
		for (const fn of this.#eventListeners) fn(frame as unknown as RpcSessionEvent);
	}
	setState(s: RpcConnectionState): void {
		this.state = s;
		for (const fn of this.#stateListeners) fn(s);
	}
}

interface Harness {
	client: FakeClient;
	store: SessionStore;
	container: HTMLElement;
	render(): void;
	button(text: string): { click(): void } | undefined;
	cleanup(): void;
}

function setup(): Harness {
	const client = new FakeClient();
	const store = createSessionStore(client as unknown as RpcWebClient);
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	const render = (): void => {
		const { dialogs } = store.getSnapshot();
		act(() => {
			root.render(
				<ExtensionDialogSheet
					dialog={dialogs[0] ?? null}
					queued={Math.max(0, dialogs.length - 1)}
					onAnswer={r => store.answerDialog(r)}
				/>,
			);
		});
	};
	render();
	return {
		client,
		store,
		container: container as unknown as HTMLElement,
		render,
		button(text) {
			const buttons = Array.from(container.querySelectorAll("button")) as unknown as Array<{
				click(): void;
				textContent: string | null;
			}>;
			return buttons.find(b => b.textContent?.trim() === text);
		},
		cleanup() {
			act(() => root.unmount());
			container.remove();
			store.dispose();
		},
	};
}

function emit(h: Harness, frame: RpcExtensionUIRequest): void {
	h.client.emit(frame);
	h.render();
}

function click(h: Harness, text: string): void {
	const b = h.button(text);
	expect(b).toBeDefined();
	act(() => b!.click());
	h.render();
}

function typeInto(el: unknown, value: string): void {
	const proto = (el as { tagName: string }).tagName === "TEXTAREA" ? win.HTMLTextAreaElement : win.HTMLInputElement;
	Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!.call(el, value);
	act(() => {
		(el as { dispatchEvent(e: unknown): boolean }).dispatchEvent(new win.Event("input", { bubbles: true }));
	});
}

describe("extension UI dialogs", () => {
	test("select shows options and answers with the chosen value", () => {
		const h = setup();
		emit(h, {
			type: "extension_ui_request",
			id: "s1",
			method: "select",
			title: "Pick a color",
			options: ["Red", "Blue"],
			optionDetails: [{}, { description: "the calm one" }],
		});
		expect(h.container.textContent).toContain("Pick a color");
		expect(h.container.textContent).toContain("the calm one");
		click(h, "Bluethe calm one");
		expect(h.client.sent).toEqual([{ type: "extension_ui_response", id: "s1", value: "Blue" }]);
		expect(h.store.getSnapshot().dialogs).toEqual([]);
		expect(h.container.querySelector("[role=dialog]")).toBeNull();
		h.cleanup();
	});

	test("approval select renders Approve/Deny as an approval prompt", () => {
		const h = setup();
		emit(h, {
			type: "extension_ui_request",
			id: "a1",
			method: "select",
			title: "Run bash: rm -rf build?",
			options: ["Approve", "Deny"],
		});
		expect(h.container.textContent).toContain("Approval required");
		expect(h.container.textContent).toContain("Run bash: rm -rf build?");
		expect(h.button("Approve")).toBeDefined();
		click(h, "Deny");
		expect(h.client.sent).toEqual([{ type: "extension_ui_response", id: "a1", value: "Deny" }]);
		h.cleanup();
	});

	test("confirm answers confirmed true/false", () => {
		const h = setup();
		emit(h, {
			type: "extension_ui_request",
			id: "c1",
			method: "confirm",
			title: "Proceed?",
			message: "Overwrite file",
		});
		expect(h.container.textContent).toContain("Overwrite file");
		click(h, "No");
		emit(h, { type: "extension_ui_request", id: "c2", method: "confirm", title: "Again?", message: "Sure" });
		click(h, "Yes");
		expect(h.client.sent).toEqual([
			{ type: "extension_ui_response", id: "c1", confirmed: false },
			{ type: "extension_ui_response", id: "c2", confirmed: true },
		]);
		h.cleanup();
	});

	test("input submits the typed value", () => {
		const h = setup();
		emit(h, { type: "extension_ui_request", id: "i1", method: "input", title: "Name?", placeholder: "name" });
		typeInto(h.container.querySelector("input"), "omp");
		click(h, "Submit");
		expect(h.client.sent).toEqual([{ type: "extension_ui_response", id: "i1", value: "omp" }]);
		h.cleanup();
	});

	test("editor starts from prefill and submits edits", () => {
		const h = setup();
		emit(h, { type: "extension_ui_request", id: "e1", method: "editor", title: "Edit", prefill: "draft" });
		const area = h.container.querySelector("textarea") as unknown as { value: string };
		expect(area.value).toBe("draft");
		typeInto(area, "final");
		click(h, "Submit");
		expect(h.client.sent).toEqual([{ type: "extension_ui_response", id: "e1", value: "final" }]);
		h.cleanup();
	});

	test("cancel button answers cancelled", () => {
		const h = setup();
		emit(h, { type: "extension_ui_request", id: "x1", method: "input", title: "Name?" });
		click(h, "Cancel");
		expect(h.client.sent).toEqual([{ type: "extension_ui_response", id: "x1", cancelled: true }]);
		h.cleanup();
	});

	test("cancel frame removes the dialog; queue shows oldest; re-sent ids dedupe", () => {
		const h = setup();
		emit(h, { type: "extension_ui_request", id: "q1", method: "confirm", title: "First", message: "one" });
		emit(h, { type: "extension_ui_request", id: "q2", method: "confirm", title: "Second", message: "two" });
		emit(h, { type: "extension_ui_request", id: "q1", method: "confirm", title: "First", message: "one" });
		expect(h.store.getSnapshot().dialogs.map(d => d.id)).toEqual(["q1", "q2"]);
		expect(h.container.textContent).toContain("one");
		expect(h.container.textContent).toContain("1 more waiting");
		emit(h, { type: "extension_ui_request", id: "c", method: "cancel", targetId: "q1" });
		expect(h.container.textContent).toContain("two");
		emit(h, { type: "extension_ui_request", id: "c2", method: "cancel", targetId: "q2" });
		expect(h.container.querySelector("[role=dialog]")).toBeNull();
		expect(h.client.sent).toEqual([]);
		h.cleanup();
	});

	test("non-dialog frames are ignored and a drop clears dialogs", () => {
		const h = setup();
		emit(h, { type: "extension_ui_request", id: "n1", method: "notify", message: "hi" });
		expect(h.store.getSnapshot().dialogs).toEqual([]);
		emit(h, { type: "extension_ui_request", id: "d1", method: "confirm", title: "T", message: "m" });
		h.client.setState("reconnecting");
		expect(h.store.getSnapshot().dialogs).toEqual([]);
		h.cleanup();
	});

	test("answer while disconnected keeps the dialog", () => {
		const h = setup();
		emit(h, { type: "extension_ui_request", id: "k1", method: "confirm", title: "T", message: "m" });
		h.client.connected = false;
		click(h, "Yes");
		expect(h.store.getSnapshot().dialogs.map(d => d.id)).toEqual(["k1"]);
		h.cleanup();
	});

	describe("ask", () => {
		const optIns = (h: Harness): unknown[] => h.client.requests.filter(r => r.type === "set_ask_dialog");

		function radioOrCheck(h: Harness, label: string): { click(): void } {
			const el = Array.from(h.container.querySelectorAll("[role=radio],[role=checkbox]")).find(
				b => b.querySelector(".xdlg-option-label")?.textContent === label,
			) as unknown as { click(): void } | undefined;
			expect(el).toBeDefined();
			return el!;
		}
		function pick(h: Harness, label: string): void {
			const el = radioOrCheck(h, label);
			act(() => el.click());
			h.render();
		}
		function other(h: Harness, value: string): void {
			typeInto(h.container.querySelector("input[aria-label=Other]"), value);
			h.render();
		}

		test("opt-in is sent on ready and again after reconnect", () => {
			const h = setup();
			expect(optIns(h)).toEqual([{ type: "set_ask_dialog", enabled: true }]);
			h.client.setState("reconnecting");
			expect(optIns(h)).toHaveLength(1);
			h.client.setState("ready");
			expect(optIns(h)).toHaveLength(2);
			h.cleanup();
		});

		test("single single-select answers immediately; recommended is badged with preview", () => {
			const h = setup();
			emit(h, {
				type: "extension_ui_request",
				id: "k1",
				method: "ask",
				questions: [
					{
						id: "db",
						question: "Which database?",
						header: "Database",
						options: [{ label: "SQLite" }, { label: "Postgres", description: "server", preview: "PG preview" }],
						recommended: 1,
					},
				],
			});
			expect(h.container.textContent).toContain("Q 1 of 1");
			expect(h.container.textContent).toContain("Recommended");
			expect(h.container.textContent).toContain("PG preview");
			pick(h, "SQLite");
			expect(h.client.sent).toEqual([
				{ type: "extension_ui_response", id: "k1", answers: [{ id: "db", selectedOptions: ["SQLite"] }] },
			]);
			expect(h.container.querySelector("[role=dialog]")).toBeNull();
			h.cleanup();
		});

		test("single-select custom input clears the option", () => {
			const h = setup();
			emit(h, {
				type: "extension_ui_request",
				id: "k2",
				method: "ask",
				questions: [{ id: "q", question: "Name?", options: [{ label: "A" }, { label: "B" }] }],
			});
			other(h, "  mine  ");
			click(h, "Submit");
			expect(h.client.sent).toEqual([
				{
					type: "extension_ui_response",
					id: "k2",
					answers: [{ id: "q", selectedOptions: [], customInput: "mine" }],
				},
			]);
			h.cleanup();
		});

		test("multi combines options in option order with custom input", () => {
			const h = setup();
			emit(h, {
				type: "extension_ui_request",
				id: "k3",
				method: "ask",
				questions: [
					{
						id: "f",
						question: "Features?",
						multi: true,
						options: [{ label: "X" }, { label: "Y" }, { label: "Z" }],
					},
				],
			});
			pick(h, "Z");
			pick(h, "X");
			pick(h, "Y");
			pick(h, "Y");
			other(h, "W");
			expect(h.client.sent).toEqual([]);
			click(h, "Next");
			expect(h.container.textContent).toContain("X, Z, W");
			click(h, "Submit");
			expect(h.client.sent).toEqual([
				{
					type: "extension_ui_response",
					id: "k3",
					answers: [{ id: "f", selectedOptions: ["X", "Z"], customInput: "W" }],
				},
			]);
			h.cleanup();
		});

		test("multi-question flow submits from review; unanswered is flagged", () => {
			const h = setup();
			emit(h, {
				type: "extension_ui_request",
				id: "k4",
				method: "ask",
				questions: [
					{ id: "a", question: "First?", options: [{ label: "1" }, { label: "2" }] },
					{ id: "b", question: "Second?", header: "Two", options: [{ label: "p" }, { label: "q" }] },
				],
			});
			pick(h, "2");
			expect(h.client.sent).toEqual([]);
			click(h, "Next");
			expect(h.container.textContent).toContain("Q 2 of 2");
			click(h, "Next");
			expect(h.container.textContent).toContain("Unanswered");
			click(h, "Back");
			other(h, "r");
			pick(h, "q");
			click(h, "Next");
			click(h, "Submit");
			expect(h.client.sent).toEqual([
				{
					type: "extension_ui_response",
					id: "k4",
					answers: [
						{ id: "a", selectedOptions: ["2"] },
						{ id: "b", selectedOptions: ["q"] },
					],
				},
			]);
			h.cleanup();
		});

		test("Escape cancels; host cancel removes the dialog", () => {
			const h = setup();
			const ask = (id: string): RpcExtensionUIRequest => ({
				type: "extension_ui_request",
				id,
				method: "ask",
				questions: [{ id: "q", question: "?", options: [{ label: "A" }] }],
			});
			emit(h, ask("e1"));
			act(() => {
				const ev = new NativeEvent("keydown");
				Object.defineProperty(ev, "key", { value: "Escape" });
				(globalThis as unknown as { dispatchEvent(e: unknown): boolean }).dispatchEvent(ev);
			});
			h.render();
			expect(h.client.sent).toEqual([{ type: "extension_ui_response", id: "e1", cancelled: true }]);
			emit(h, ask("e2"));
			expect(h.container.querySelector("[data-method=ask]")).not.toBeNull();
			emit(h, { type: "extension_ui_request", id: "c", method: "cancel", targetId: "e2" });
			expect(h.container.querySelector("[role=dialog]")).toBeNull();
			expect(h.client.sent).toHaveLength(1);
			h.cleanup();
		});
	});
});
