import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import { SessionsScreen } from "../src/components/sessions/SessionsScreen";
import type { SessionListApi } from "../src/lib/sessions-api";
import { localServers } from "./local-servers";
import { createServerOperator } from "../src/lib/servers";
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
		origin: "host",
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
		launch: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
		resume: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
		shutdown: async () => {},
		deletePast: async () => {},
		listDirs: async () => [],
		complete: async () => null,
	};
	return api;
}

function mount(api: SessionListApi, variant: "page" | "sidebar") {
	const servers = localServers(api);
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	const render = (sessionName: string) =>
		root.render(
			<SessionsScreen
				servers={servers}
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
		const options = Array.from(m.container.querySelectorAll(".ses-recent-cwd")).map(o => o.getAttribute("title"));
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
			launch: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
			resume: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
			shutdown: async () => {},
			deletePast: async () => {},
			listDirs: async () => [],
			complete: async () => null,
		};

		const container = win.document.createElement("div");
		win.document.body.appendChild(container);
		const root = createRoot(container as unknown as HTMLElement);

		await act(async () => {
			root.render(
				<SessionsScreen
					servers={localServers(failingApi)}
					variant="page"
					currentInstanceId={null}
					onAttach={() => {}}
				/>,
			);
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

describe("SessionsScreen multi-server", () => {
	test("groups per server, shows a down server, launches on the picked server", async () => {
		const launches: string[] = [];
		const attached: string[] = [];
		const localApi = fakeApi([liveEntry("same", "local-one")]);
		const macApi: SessionListApi = {
			...fakeApi([liveEntry("same", "mac-one")]),
			launch: async cwd => {
				launches.push(`mac:${cwd}`);
				return { instanceId: "fresh", sessionId: "s", reused: false };
			},
		};
		const downApi: SessionListApi = {
			...fakeApi([]),
			listLive: async () => {
				throw new Error("Network error: refused");
			},
		};
		const byUrl: Record<string, SessionListApi> = {
			"": localApi,
			"https://mac.t.ts.net": macApi,
			"https://down.t.ts.net": downApi,
		};
		const servers = createServerOperator({
			storage: null,
			origin: "http://localhost:3000",
			createApi: u => byUrl[u]!,
		});
		const mac = servers.add("https://mac.t.ts.net", "Mac");
		servers.add("https://down.t.ts.net", "Down box");

		const container = win.document.createElement("div");
		win.document.body.appendChild(container);
		const root = createRoot(container as unknown as HTMLElement);
		await act(async () => {
			root.render(
				<SessionsScreen
					servers={servers}
					variant="page"
					currentInstanceId={null}
					onAttach={k => attached.push(k)}
				/>,
			);
		});
		const sections = Array.from(container.querySelectorAll(".ses-server-section")).map(s => s.textContent ?? "");
		expect(sections).toHaveLength(3);
		expect(sections[0]).toContain("localhost");
		expect(sections[0]).toContain("local-one");
		expect(sections[1]).toContain("Mac");
		expect(sections[1]).toContain("mac-one");
		expect(sections[2]).toContain("down");
		expect(sections[2]).toContain("Network error: refused");

		const newBtn = container.querySelector('[aria-label="New session"]') as HTMLButtonElement | null;
		await act(async () => newBtn?.click());
		const select = container.querySelector('select[aria-label="Launch on"]');
		expect(select).not.toBeNull();
		await act(async () => {
			Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, "value")!.set!.call(select, mac.id);
			select?.dispatchEvent(new win.Event("change", { bubbles: true }));
		});
		const input = container.querySelector(".ses-cwd-input");
		await act(async () => {
			Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")!.set!.call(input, "/w/p");
			input?.dispatchEvent(new win.Event("input", { bubbles: true }));
		});
		const start = container.querySelector(".ses-start-btn") as HTMLButtonElement | null;
		await act(async () => start?.click());
		expect(launches).toEqual(["mac:/w/p"]);
		expect(attached).toEqual([`${mac.id}~fresh`]);

		act(() => root.unmount());
		container.remove();
	});
});
