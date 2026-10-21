/**
 * TUI dialogs mirrored to clients attached through `rpc.serve` (the web GUI):
 * the TUI dialog races the clients' copy, first answer wins and the other side
 * is cancelled; clients attaching while a dialog is pending get it replayed.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { type Component, Container, isFocusable } from "@oh-my-pi/pi-tui";
import { CustomEditor } from "@oh-my-pi/pi-tui/prompt/custom-editor";
import { getEditorTheme, getThemeByName, setThemeInstance } from "@oh-my-pi/pi-tui/theme";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";
import type { ExtensionAskDialogQuestion } from "../../../src/extensibility/extensions";
import { ExtensionUiController } from "../../../src/modes/controllers/extension-ui-controller";
import { RpcServeController } from "../../../src/modes/rpc/rpc-serve-controller";
import { serveRpc } from "../../../src/modes/rpc/rpc-server";
import { Settings } from "../../../src/config/settings";
import type { InteractiveModeContext } from "../../../src/modes/types";

type Frame = Record<string, unknown>;

beforeAll(async () => {
	const dark = await getThemeByName("dark");
	if (!dark) throw new Error("Failed to load dark theme");
	setThemeInstance(dark);
});

/** One authenticated raw socket that records every frame it receives. */
class Client {
	readonly frames: Frame[] = [];
	readonly #waiters = new Set<() => void>();
	#buffer = "";

	constructor(readonly socket: net.Socket) {
		socket.on("data", chunk => {
			this.#buffer += chunk.toString();
			let newline = this.#buffer.indexOf("\n");
			while (newline >= 0) {
				const line = this.#buffer.slice(0, newline);
				this.#buffer = this.#buffer.slice(newline + 1);
				if (line) this.frames.push(JSON.parse(line) as Frame);
				newline = this.#buffer.indexOf("\n");
			}
			for (const wake of this.#waiters) wake();
		});
	}

	async waitFor(predicate: (frame: Frame) => boolean, timeoutMs = 3000): Promise<Frame> {
		const deadline = Date.now() + timeoutMs;
		while (true) {
			const found = this.frames.find(predicate);
			if (found) return found;
			const remaining = deadline - Date.now();
			if (remaining <= 0) throw new Error(`timed out; frames: ${JSON.stringify(this.frames)}`);
			const { promise, resolve } = Promise.withResolvers<void>();
			this.#waiters.add(resolve);
			const timer = setTimeout(resolve, remaining);
			await promise;
			clearTimeout(timer);
			this.#waiters.delete(resolve);
		}
	}

	send(frame: object): void {
		this.socket.write(`${JSON.stringify(frame)}\n`);
	}

	request(command: Frame): Promise<Frame> {
		this.send(command);
		return this.waitFor(frame => frame.type === "response" && frame.id === command.id);
	}

	close(): Promise<void> {
		const { promise, resolve } = Promise.withResolvers<void>();
		this.socket.once("close", () => resolve());
		this.socket.destroy();
		return promise;
	}
}

function makeStubSession(): Record<string, unknown> {
	const listeners = new Set<(event: unknown) => void>();
	return {
		subscribe(fn: (event: unknown) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		subscribeCommandMetadataChanged: () => () => {},
		registerPersistenceFailureCallback: () => () => {},
		setSlashCommands() {},
		messages: [],
		extensions: [],
		skills: [],
		customCommands: [],
		mcpPromptCommands: [],
		sessionId: "stub-session",
		model: "test-model",
		settings: Settings.isolated(),
		sessionManager: {
			onPersistenceError: () => () => {},
			onPersistenceNotice: () => () => {},
			getCwd: () => "/tmp",
		},
		hasPendingAsyncWork: () => false,
		async settleAsyncWork() {},
	};
}

const question: ExtensionAskDialogQuestion = {
	id: "db",
	question: "Which database?",
	options: [{ label: "Postgres" }, { label: "SQLite" }],
};
const isUi = (method: string) => (frame: Frame) => frame.type === "extension_ui_request" && frame.method === method;
const isCancel = (id: unknown) => (frame: Frame) => isUi("cancel")(frame) && frame.targetId === id;

let tmpDir: string;
let serve: RpcServeController | undefined;
const clients: Client[] = [];

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-mirror-"));
});

afterEach(async () => {
	await Promise.all(clients.splice(0).map(client => client.close()));
	await serve?.stop();
	serve = undefined;
	removeSyncWithRetries(tmpDir);
});

async function makeHarness(options: { serving: boolean }) {
	const editor = new CustomEditor(getEditorTheme());
	const editorContainer = new Container();
	editorContainer.addChild(editor);
	let focused: Component | null = editor;
	editor.focused = true;
	const ctx = {
		editor,
		ui: {
			requestRender: vi.fn(),
			getFocused: () => focused,
			setFocus: (component: Component | null) => {
				if (focused && isFocusable(focused)) focused.focused = false;
				focused = component;
				if (focused && isFocusable(focused)) focused.focused = true;
			},
			showOverlay: vi.fn(),
			terminal: { rows: 40, columns: 120 },
		},
		editorContainer,
		session: makeStubSession(),
		shutdown: async () => {},
		planModeEnabled: false,
		planModePaused: false,
		planModePlanFilePath: undefined,
	} as unknown as InteractiveModeContext & { rpcServeController?: RpcServeController };
	if (options.serving) {
		serve = new RpcServeController(ctx, { registryDir: tmpDir });
		await serve.start(serveRpc);
		Object.assign(ctx, { rpcServeController: serve });
	}
	const controller = new ExtensionUiController(ctx);
	return {
		controller,
		editor,
		getFocused: () => focused,
		handleInput(data: string): void {
			if (!focused?.handleInput) throw new Error("Expected a focused input component");
			focused.handleInput(data);
		},
		async connect(clientId: string): Promise<Client> {
			const entryFile = fs.readdirSync(tmpDir).find(f => f.endsWith(".json"));
			if (!entryFile) throw new Error("no registry entry");
			const entry = JSON.parse(fs.readFileSync(path.join(tmpDir, entryFile), "utf8")) as {
				token: string;
				endpoint: string;
			};
			const client = new Client(net.connect(entry.endpoint));
			client.send({ type: "auth", token: entry.token, surface: "web", clientId });
			await client.waitFor(frame => frame.type === "ready");
			clients.push(client);
			return client;
		},
	};
}

describe("TUI dialogs mirrored to rpc.serve clients", () => {
	it("without rpc.serve the ask stays a TUI-only dialog", async () => {
		const h = await makeHarness({ serving: false });
		const pending = h.controller.showAskDialog([question]);
		h.handleInput("\r");
		expect(await pending).toMatchObject({ kind: "submit", results: [{ id: "db", selectedOptions: ["Postgres"] }] });
		expect(h.getFocused()).toBe(h.editor);
	});

	it("a web answer to the rich ask wins and closes the TUI dialog", async () => {
		const h = await makeHarness({ serving: true });
		const web = await h.connect("web-a");
		expect((await web.request({ id: "opt-in", type: "set_ask_dialog", enabled: true })).success).toBe(true);

		const pending = h.controller.showAskDialog([question]);
		const ask = await web.waitFor(isUi("ask"));
		expect(ask.questions).toEqual([question]);
		web.send({
			type: "extension_ui_response",
			id: ask.id,
			answers: [{ id: "db", selectedOptions: ["SQLite"] }],
		});

		expect(await pending).toMatchObject({ kind: "submit", results: [{ id: "db", selectedOptions: ["SQLite"] }] });
		expect(h.getFocused()).toBe(h.editor);
	});

	it("a TUI answer wins and the web client gets a cancel", async () => {
		const h = await makeHarness({ serving: true });
		const web = await h.connect("web-a");
		await web.request({ id: "opt-in", type: "set_ask_dialog", enabled: true });

		const pending = h.controller.showAskDialog([question]);
		const ask = await web.waitFor(isUi("ask"));
		h.handleInput("\r");

		expect(await pending).toMatchObject({ kind: "submit", results: [{ id: "db", selectedOptions: ["Postgres"] }] });
		await web.waitFor(isCancel(ask.id));
	});

	it("replays a pending ask to a client that attaches later", async () => {
		const h = await makeHarness({ serving: true });
		const pending = h.controller.showAskDialog([question]);

		const web = await h.connect("web-late");
		const ask = await web.waitFor(isUi("ask"));
		web.send({ type: "extension_ui_response", id: ask.id, answers: [{ id: "db", selectedOptions: ["SQLite"] }] });

		expect(await pending).toMatchObject({ kind: "submit", results: [{ id: "db", selectedOptions: ["SQLite"] }] });
	});

	it("falls back to select when an attached client did not opt in", async () => {
		const h = await makeHarness({ serving: true });
		const web = await h.connect("plain");

		const pending = h.controller.showAskDialog([question]);
		const select = await web.waitFor(isUi("select"));
		expect(web.frames.some(isUi("ask"))).toBe(false);
		web.send({ type: "extension_ui_response", id: select.id, value: "Postgres" });

		expect(await pending).toMatchObject({ kind: "submit", results: [{ id: "db", selectedOptions: ["Postgres"] }] });
		expect(h.getFocused()).toBe(h.editor);
	});

	it("mirrors confirm: a web answer wins", async () => {
		const h = await makeHarness({ serving: true });
		const web = await h.connect("web-a");

		const pending = h.controller.showMirroredConfirm("Proceed?", "Run the migration");
		const confirm = await web.waitFor(isUi("confirm"));
		web.send({ type: "extension_ui_response", id: confirm.id, confirmed: true });

		expect(await pending).toBe(true);
		expect(h.getFocused()).toBe(h.editor);
	});
});
