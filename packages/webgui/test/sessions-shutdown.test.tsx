import "./dom-setup";
import { win } from "./dom-setup";
import { afterEach, describe, expect, test } from "bun:test";
// react-dom/client and the screen must load after dom-setup installs window/navigator.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { SessionsScreen } = await import("../src/components/sessions/SessionsScreen");
import type { SessionListApi } from "../src/lib/sessions-api";
import type { LiveSessionEntry } from "../src/server/live";

const ENTRY: LiveSessionEntry = {
	version: 1,
	instanceId: "inst-1",
	pid: 1234,
	cwd: "/tmp",
	startedAt: Date.now() - 60_000,
	createdAt: Date.now() - 120_000,
	sessionId: "s1",
	sessionName: "Current",
	model: "m",
	origin: "gui",
	recap: null,
	lastActivityAt: Date.now() - 30_000,
	assistantCount: 0,
};

function fakeApi(shutdown: (id: string) => Promise<void>): SessionListApi {
	return {
		listLive: async () => [ENTRY],
		listPast: async () => [],
		launch: async () => {
			throw new Error("unused");
		},
		resume: async () => {
			throw new Error("unused");
		},
		shutdown,
		deletePast: async () => {},
		listDirs: async () => [],
		complete: async () => null,
	};
}

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
});

async function mountAndStop(api: SessionListApi, onShutdown: (id: string) => void): Promise<void> {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	await act(async () => {
		root.render(
			<SessionsScreen api={api} variant="sidebar" currentInstanceId="inst-1" onAttach={() => {}} onShutdown={onShutdown} />,
		);
	});
	const stop = (): HTMLButtonElement | undefined =>
		[...container.querySelectorAll("button")].find(b => /^(Stop|Confirm\?)$/.test(b.textContent?.trim() ?? "")) as
			| HTMLButtonElement
			| undefined;
	// Stop arms on the first tap and fires on the second.
	await act(async () => stop()!.click());
	await act(async () => stop()!.click());
}

describe("SessionsScreen stop", () => {
	test("reports the stopped instance so the shell can leave its view", async () => {
		const stopped: string[] = [];
		await mountAndStop(
			fakeApi(async () => {}),
			id => stopped.push(id),
		);
		expect(stopped).toEqual(["inst-1"]);
	});

	test("does not report a stop the host rejected", async () => {
		const stopped: string[] = [];
		await mountAndStop(
			fakeApi(async () => {
				throw new Error("host gone");
			}),
			id => stopped.push(id),
		);
		expect(stopped).toEqual([]);
	});
});
