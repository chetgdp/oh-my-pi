import { win } from "./dom-setup";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
// Exception: react-dom/client must be imported after dom-setup initializes globalThis window and events
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { ProvidersSection, describeDiscovery, relativeTime, sortProviders } = await import(
	"../src/components/models/ProvidersSection"
);
import type {
	RpcModelBrowserResult,
	RpcProviderStatus,
	RpcLoginStatusResult,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

describe("relativeTime", () => {
	const now = 1000000000000;

	test("returns 'just now' for diff < 5s", () => {
		expect(relativeTime(now - 3000, now)).toBe("just now");
	});

	test("returns seconds ago for diff < 60s", () => {
		expect(relativeTime(now - 45000, now)).toBe("45s ago");
	});

	test("returns minutes ago for diff < 60m", () => {
		expect(relativeTime(now - 120000, now)).toBe("2m ago");
	});

	test("returns hours ago for diff < 24h", () => {
		expect(relativeTime(now - 7200000, now)).toBe("2h ago");
	});

	test("returns days ago for diff >= 24h", () => {
		expect(relativeTime(now - 172800000, now)).toBe("2d ago");
	});
});

describe("describeDiscovery", () => {
	const now = 1000000000000;

	test("renders 'cached 2m ago' for status cached with fetchedAt 120s earlier", () => {
		const discovery: RpcProviderStatus["discovery"] = {
			optional: true,
			status: "cached",
			fetchedAt: now - 120000,
		};
		const res = describeDiscovery(discovery, now);
		expect(res.text).toBe("cached 2m ago");
		expect(res.error).toBeUndefined();
	});

	test("includes the error text for unavailable", () => {
		const discovery: RpcProviderStatus["discovery"] = {
			optional: false,
			status: "unavailable",
			error: "Network timeout connecting to provider",
		};
		const res = describeDiscovery(discovery, now);
		expect(res.text).toBe("unavailable");
		expect(res.error).toBe("Network timeout connecting to provider");
	});

	test("returns idle for missing discovery", () => {
		const res = describeDiscovery(undefined, now);
		expect(res.text).toBe("idle");
		expect(res.error).toBeUndefined();
	});
});

describe("sortProviders", () => {
	test("authenticated providers sort before locked, then by id", () => {
		const providers: RpcProviderStatus[] = [
			{
				id: "ollama",
				authenticated: false,
				discoverable: true,
				modelCount: 0,
			},
			{
				id: "openai",
				authenticated: true,
				discoverable: true,
				modelCount: 5,
			},
			{
				id: "anthropic",
				authenticated: true,
				discoverable: true,
				modelCount: 3,
			},
			{
				id: "bedrock",
				authenticated: false,
				discoverable: false,
				modelCount: 0,
			},
		];

		const sorted = sortProviders(providers);
		expect(sorted.map((p) => p.id)).toEqual([
			"anthropic",
			"openai",
			"bedrock",
			"ollama",
		]);
	});
});

describe("ProvidersSection component", () => {
	const mockBrowser: RpcModelBrowserResult = {
		models: [],
		mruOrder: [],
		kinds: [],
		providers: [
			{
				id: "anthropic",
				authenticated: true,
				discoverable: true,
				discovery: {
					optional: false,
					status: "ok",
					fetchedAt: Date.now() - 30000,
				},
				modelCount: 4,
			},
			{
				id: "locked-provider",
				authenticated: false,
				discoverable: false,
				discovery: {
					optional: true,
					status: "unavailable",
					error: "Missing API key in environment",
				},
				modelCount: 0,
			},
			{
				id: "discoverable-noauth",
				authenticated: false,
				discoverable: true,
				discovery: {
					optional: true,
					status: "idle",
				},
				modelCount: 0,
			},
		],
	};

	test("renders loading state when browser is null", () => {
		const markup = renderToStaticMarkup(
			<ProvidersSection
				browser={null}
				refreshing={null}
				onRefresh={() => {}}
			/>,
		);
		expect(markup).toContain("Loading providers...");
	});

	test("authenticated providers sort before locked and locked row has dimmed marker", () => {
		const markup = renderToStaticMarkup(
			<ProvidersSection
				browser={mockBrowser}
				refreshing={null}
				onRefresh={() => {}}
			/>,
		);

		// Provider rows order
		const anthropicIdx = markup.indexOf('data-provider-id="anthropic"');
		const lockedIdx = markup.indexOf('data-provider-id="locked-provider"');
		const discoverableNoauthIdx = markup.indexOf('data-provider-id="discoverable-noauth"');

		expect(anthropicIdx).toBeGreaterThan(-1);
		expect(anthropicIdx).toBeLessThan(discoverableNoauthIdx);
		expect(discoverableNoauthIdx).toBeLessThan(lockedIdx);

		// Locked row has the dimmed marker (mp-row-locked)
		expect(markup).toContain('class="mp-row mp-row-locked" data-provider-id="locked-provider" data-locked="true"');
		// Auth badge text
		expect(markup).toContain("signed in");
		expect(markup).toContain("no API key");
		// Inline error text
		expect(markup).toContain("Missing API key in environment");
	});

	test("per-provider refresh button present only for discoverable providers", () => {
		const markup = renderToStaticMarkup(
			<ProvidersSection
				browser={mockBrowser}
				refreshing={null}
				onRefresh={() => {}}
			/>,
		);

		// Discoverable providers have aria-label for refresh
		expect(markup).toContain('aria-label="Refresh anthropic"');
		expect(markup).toContain('aria-label="Refresh discoverable-noauth"');
		// Non-discoverable provider does not have refresh button
		expect(markup).not.toContain('aria-label="Refresh locked-provider"');
	});

	test("refresh-all disabled markup when refreshing and spinner active", () => {
		// When refreshing === "all"
		const markupAll = renderToStaticMarkup(
			<ProvidersSection
				browser={mockBrowser}
				refreshing="all"
				onRefresh={() => {}}
			/>,
		);
		expect(markupAll).toContain('class="mp-refresh-all" disabled=""');
		expect(markupAll).toContain("mp-spinner");

		// When refreshing a single provider
		const markupOne = renderToStaticMarkup(
			<ProvidersSection
				browser={mockBrowser}
				refreshing="anthropic"
				onRefresh={() => {}}
			/>,
		);
		// refresh-all is disabled when any refreshing is ongoing
		expect(markupOne).toContain('class="mp-refresh-all" disabled=""');
		// Provider button has spinner
		expect(markupOne).toContain('aria-label="Refresh anthropic"');
	});

	test("locked provider row in loginStatus renders as tappable button and calls onLogin", () => {
		const loginStatus: RpcLoginStatusResult = {
			providers: [
				{
					id: "locked-provider",
					name: "Locked Provider",
					available: true,
					authenticated: false,
					accounts: [],
				},
			],
		};

		let loggedInProvider: string | null = null;
		const onLogin = (id: string) => {
			loggedInProvider = id;
		};

		// 1. SSR test: renders button with mp-row-tappable
		const markup = renderToStaticMarkup(
			<ProvidersSection
				browser={mockBrowser}
				loginStatus={loginStatus}
				refreshing={null}
				onRefresh={() => {}}
				onLogin={onLogin}
			/>,
		);
		expect(markup).toContain('class="mp-row mp-row-locked mp-row-tappable" data-provider-id="locked-provider" data-locked="true"');

		// 2. Interactive DOM test: clicking the row calls onLogin
		const container = win.document.createElement("div");
		win.document.body.appendChild(container);
		const root = createRoot(container as unknown as HTMLElement);

		act(() => {
			root.render(
				<ProvidersSection
					browser={mockBrowser}
					loginStatus={loginStatus}
					refreshing={null}
					onRefresh={() => {}}
					onLogin={onLogin}
				/>,
			);
		});

		const row = container.querySelector('[data-provider-id="locked-provider"]') as HTMLButtonElement | null;
		expect(row).not.toBeNull();
		expect(row?.tagName).toBe("BUTTON");

		act(() => {
			row?.click();
		});

		expect(loggedInProvider as string | null).toBe("locked-provider");

		act(() => {
			root.unmount();
		});
		container.remove();
	});

	test("logout confirm flow displays accounts and fires onLogout only after Confirm", () => {
		const loginStatus: RpcLoginStatusResult = {
			providers: [
				{
					id: "anthropic",
					name: "Anthropic",
					available: true,
					authenticated: true,
					accounts: [{ credentialId: 101, label: "user@anthropic.com" }],
				},
			],
		};

		const logoutCalls: Array<{ providerId: string; credentialId: number }> = [];
		const onLogout = (providerId: string, credentialId: number) => {
			logoutCalls.push({ providerId, credentialId });
		};

		const container = win.document.createElement("div");
		win.document.body.appendChild(container);
		const root = createRoot(container as unknown as HTMLElement);

		act(() => {
			root.render(
				<ProvidersSection
					browser={mockBrowser}
					loginStatus={loginStatus}
					refreshing={null}
					onRefresh={() => {}}
					onLogout={onLogout}
				/>,
			);
		});

		// Account label and Log out button initially visible
		expect(container.textContent).toContain("user@anthropic.com");
		const logoutBtn = container.querySelector(".mp-logout-btn") as HTMLButtonElement | null;
		expect(logoutBtn).not.toBeNull();
		expect(logoutBtn?.textContent).toBe("Log out");

		// Click Log out -> reveals inline confirm
		act(() => {
			logoutBtn?.click();
		});

		expect(container.textContent).toContain("Log out user@anthropic.com?");
		const confirmBtn = container.querySelector(".mp-btn-confirm") as HTMLButtonElement | null;
		const keepBtn = container.querySelector(".mp-btn-keep") as HTMLButtonElement | null;
		expect(confirmBtn).not.toBeNull();
		expect(keepBtn).not.toBeNull();
		// onLogout has NOT fired yet
		expect(logoutCalls).toEqual([]);

		// Click Keep -> returns to Log out without calling onLogout
		act(() => {
			keepBtn?.click();
		});
		expect(logoutCalls).toEqual([]);
		expect(container.querySelector(".mp-logout-btn")).not.toBeNull();
		expect(container.querySelector(".mp-btn-confirm")).toBeNull();

		// Click Log out again, then Confirm -> onLogout fires with providerId and credentialId
		const logoutBtnAgain = container.querySelector(".mp-logout-btn") as HTMLButtonElement | null;
		act(() => {
			logoutBtnAgain?.click();
		});

		const confirmBtnAgain = container.querySelector(".mp-btn-confirm") as HTMLButtonElement | null;
		act(() => {
			confirmBtnAgain?.click();
		});

		expect(logoutCalls).toEqual([{ providerId: "anthropic", credentialId: 101 }]);

		act(() => {
			root.unmount();
		});
		container.remove();
	});
});
