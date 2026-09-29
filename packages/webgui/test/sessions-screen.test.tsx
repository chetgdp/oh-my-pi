import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import { SessionsScreen } from "../src/components/sessions/SessionsScreen";
import type { SessionListApi } from "../src/lib/sessions-api";
import type { LiveSessionEntry } from "../src/server/live";

// Exception: react-dom/client must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");

function liveEntry(instanceId: string, sessionName: string): LiveSessionEntry {
	return {
		version: 1,
		instanceId,
		pid: 1,
		createdAt: 0,
		sessionId: `s-${instanceId}`,
		sessionName,
		cwd: "/tmp",
		model: null,
		startedAt: 0,
		origin: "gui",
		recap: null,
		lastActivityAt: 0,
		assistantCount: 0,
	};
}

function fakeApi(live: LiveSessionEntry[]): SessionListApi & { pastCalls: number } {
	const api = {
		pastCalls: 0,
		listLive: async () => live,
		listPast: async () => {
			api.pastCalls++;
			return [];
		},
		launch: async () => ({ windowId: "w" }),
		resume: async () => ({ windowId: "w" }),
		shutdown: async () => {},
		deletePast: async () => {},
	};
	return api;
}

describe("SessionsScreen rename", () => {
	test("attached session row shows the live title before the registry poll catches up, and past reloads", async () => {
		const api = fakeApi([liveEntry("a", "che"), liveEntry("b", "other")]);
		const container = win.document.createElement("div");
		win.document.body.appendChild(container);
		const root = createRoot(container as unknown as HTMLElement);
		const render = (name: string) =>
			root.render(
				<SessionsScreen
					api={api}
					variant="sidebar"
					currentInstanceId="a"
					currentSessionName={name}
					onAttach={() => {}}
				/>,
			);
		await act(async () => render("che"));
		expect(api.pastCalls).toBe(1);

		await act(async () => render("Renamed"));
		const text = container.textContent ?? "";
		expect(text).toContain("Renamed");
		expect(text).not.toContain("che");
		expect(text).toContain("other");
		expect(api.pastCalls).toBe(2);

		act(() => root.unmount());
		container.remove();
	});
});

describe("SessionsScreen error and unreachable state", () => {
	test("renders unreachable state with Retry on fetch failure rather than empty lists", async () => {
		let callCount = 0;
		const failingApi: SessionListApi = {
			listLive: async () => {
				callCount++;
				if (callCount === 1) {
					throw new Error("Request timed out");
				}
				return [liveEntry("inst-1", "Recovered Session")];
			},
			listPast: async () => [],
			launch: async () => ({ windowId: "w" }),
			resume: async () => ({ windowId: "w" }),
			shutdown: async () => {},
			deletePast: async () => {},
		};

		const container = win.document.createElement("div");
		win.document.body.appendChild(container);
		const root = createRoot(container as unknown as HTMLElement);

		await act(async () => {
			root.render(<SessionsScreen api={failingApi} variant="page" currentInstanceId={null} onAttach={() => {}} />);
		});

		const text = container.textContent ?? "";
		expect(text).toContain("Server unreachable");
		expect(text).toContain("Request timed out");
		expect(text).not.toContain("No live sessions");
		expect(text).not.toContain("No past sessions");

		const retryBtn = container.querySelector(".ses-retry-btn") as HTMLButtonElement | null;
		expect(retryBtn).not.toBeNull();

		// Clicking Retry triggers refetch and recovers
		await act(async () => {
			retryBtn?.click();
		});

		const textAfter = container.textContent ?? "";
		expect(textAfter).not.toContain("Server unreachable");
		expect(textAfter).toContain("Recovered Session");

		act(() => root.unmount());
		container.remove();
	});
});
