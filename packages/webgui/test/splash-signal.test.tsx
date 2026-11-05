import "./dom-setup";
import { win } from "./dom-setup";
import { beforeEach, describe, expect, test } from "bun:test";
import { SessionsScreen } from "../src/components/sessions/SessionsScreen";
import type { SessionListApi } from "../src/lib/sessions-api";
import { onAppReady, resetAppReadyForTest, signalAppReady, useSignalAppReadyWhen } from "../src/lib/splash-signal";
import { localServers } from "./local-servers";

// Exception: react-dom/client must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

function api(listLive: SessionListApi["listLive"]): SessionListApi {
	return {
		listLive,
		listPast: async () => [],
		launch: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
		resume: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
		shutdown: async () => {},
		deletePast: async () => {},
		listDirs: async () => [],
		complete: async () => null,
	};
}

function mountNode() {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	return {
		root,
		unmount() {
			act(() => root.unmount());
			container.remove();
		},
	};
}

function count(): { n: number } {
	const c = { n: 0 };
	onAppReady(() => c.n++);
	return c;
}

beforeEach(() => resetAppReadyForTest());

describe("splash signal", () => {
	test("fires listeners once; repeated signals are no-ops", () => {
		const c = count();
		expect(c.n).toBe(0);
		signalAppReady();
		signalAppReady();
		expect(c.n).toBe(1);
	});

	test("late subscriber fires immediately", () => {
		signalAppReady();
		const c = count();
		expect(c.n).toBe(1);
	});

	test("unsubscribe prevents firing", () => {
		let n = 0;
		const off = onAppReady(() => n++);
		off();
		signalAppReady();
		expect(n).toBe(0);
	});

	for (const [name, listLive] of [
		["ok", async () => []],
		["failed server", async () => Promise.reject(new Error("down"))],
	] as const) {
		test(`SessionsScreen page signals after first poll settles (${name})`, async () => {
			const c = count();
			const m = mountNode();
			await act(async () =>
				m.root.render(
					<SessionsScreen
						servers={localServers(api(listLive))}
						variant="page"
						currentInstanceId={null}
						currentSessionName={null}
						onAttach={() => {}}
					/>,
				),
			);
			expect(c.n).toBe(1);
			m.unmount();
		});
	}

	test("SessionsScreen sidebar does not signal (deep link waits for its session)", async () => {
		const c = count();
		const m = mountNode();
		await act(async () =>
			m.root.render(
				<SessionsScreen
					servers={localServers(api(async () => []))}
					variant="sidebar"
					currentInstanceId="a"
					currentSessionName="x"
					onAttach={() => {}}
				/>,
			),
		);
		expect(c.n).toBe(0);
		m.unmount();
	});

	test("deep link signals when the session connection becomes ready", async () => {
		function Probe(props: { connection: string }) {
			useSignalAppReadyWhen(props.connection === "ready");
			return null;
		}
		const c = count();
		const m = mountNode();
		await act(async () => m.root.render(<Probe connection="connecting" />));
		expect(c.n).toBe(0);
		await act(async () => m.root.render(<Probe connection="ready" />));
		expect(c.n).toBe(1);
		m.unmount();
	});
});
