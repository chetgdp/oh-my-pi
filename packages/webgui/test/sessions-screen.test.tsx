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
			return [
				{
					id: "old-1",
					path: "/s/old-1.jsonl",
					cwd: "/proj/old",
					name: "Old work",
					createdAt: 0,
					modifiedAt: 0,
					messageCount: 3,
					firstUserMessage: null,
				},
			];
		},
		launch: async () => ({ windowId: "w" }),
		resume: async () => ({ windowId: "w" }),
		shutdown: async () => {},
		deletePast: async () => {},
	};
	return api;
}

function mount(api: SessionListApi, variant: "page" | "sidebar") {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	const render = (sessionName: string) =>
		root.render(
			<SessionsScreen
				api={api}
				variant={variant}
				currentInstanceId="a"
				currentSessionName={sessionName}
				onAttach={() => {}}
				collapseToggle={variant === "sidebar" ? <button type="button">collapse</button> : undefined}
			/>,
		);
	return {
		container,
		render,
		unmount() {
			act(() => root.unmount());
			container.remove();
		},
	};
}
describe("SessionsScreen past sessions load on demand", () => {
	test("mount, visibility and rename do not fetch past; Resume fetches once and lists rows", async () => {
		const api = fakeApi([liveEntry("a", "che"), liveEntry("b", "other")]);
		const m = mount(api, "page");
		await act(async () => m.render("che"));
		await act(async () => {
			win.dispatchEvent(new win.Event("visibilitychange"));
		});
		await act(async () => m.render("Renamed"));
		expect(api.pastCalls).toBe(0);
		expect(m.container.textContent).not.toContain("Old work");

		const resumeBtn = m.container.querySelector(".ses-resume-btn") as HTMLButtonElement | null;
		await act(async () => resumeBtn?.click());
		expect(api.pastCalls).toBe(1);
		expect(m.container.textContent).toContain("Old work");

		// Once loaded, a rename refreshes past titles.
		await act(async () => m.render("Renamed again"));
		expect(api.pastCalls).toBe(2);
		m.unmount();
	});

	test("opening New session loads past cwds as suggestions", async () => {
		const api = fakeApi([liveEntry("a", "che")]);
		const m = mount(api, "page");
		await act(async () => m.render("che"));
		expect(api.pastCalls).toBe(0);

		const newBtn = m.container.querySelector('[aria-label="New session"]') as HTMLButtonElement | null;
		await act(async () => newBtn?.click());
		expect(api.pastCalls).toBe(1);
		const options = Array.from(m.container.querySelectorAll("#ses-recent-cwds option")).map(o =>
			o.getAttribute("value"),
		);
		expect(options).toEqual(["/tmp", "/proj/old"]);
		m.unmount();
	});

	test("sidebar header Resume loads past on demand", async () => {
		const api = fakeApi([liveEntry("a", "che")]);
		const m = mount(api, "sidebar");
		await act(async () => m.render("che"));
		expect(api.pastCalls).toBe(0);
		expect(m.container.querySelector(".ses-cwd-input")).toBeNull();

		const resumeBtn = m.container.querySelector(".ses-sidebar-head .ses-resume-btn") as HTMLButtonElement | null;
		await act(async () => resumeBtn?.click());
		expect(api.pastCalls).toBe(1);
		expect(m.container.textContent).toContain("Old work");
		m.unmount();
	});

	test("attached session row shows the live title before the registry poll catches up", async () => {
		const api = fakeApi([liveEntry("a", "che"), liveEntry("b", "other")]);
		const m = mount(api, "sidebar");
		await act(async () => m.render("che"));
		await act(async () => m.render("Renamed"));
		const text = m.container.textContent ?? "";
		expect(text).toContain("Renamed");
		expect(text).not.toContain("che");
		expect(text).toContain("other");
		m.unmount();
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
