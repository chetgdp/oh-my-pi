import "./dom-setup";
import { win } from "./dom-setup";
import { describe, expect, it } from "bun:test";
import type { SessionCommandSink } from "../src/lib/session-actions";
import type { Route } from "../src/lib/route";
import { parseRoute } from "../src/lib/route";
import type { RpcSessionState, RpcUsageReport, RpcResetAccount } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";

// Ensure globalThis.location matches win.location so navigate() updates location.hash
(globalThis as Record<string, unknown>).location = win.location;

// Exception: react-dom/client, UsageScreen, and TopBar must be imported after dom-setup initializes globalThis window and events.
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const { UsageScreen } = await import("../src/components/usage/UsageScreen");
const { TopBar } = await import("../src/components/shell/TopBar");

interface FakeSink {
	sink: SessionCommandSink;
	commands: unknown[];
}

function createFakeSink(responses?: Record<string, unknown>): FakeSink {
	const commands: unknown[] = [];
	const request: SessionCommandSink["request"] = cmd => {
		commands.push(cmd);
		const custom = responses?.[cmd.type];
		if (custom) return Promise.resolve(custom) as never;
		if (cmd.type === "get_usage_reports") {
			return Promise.resolve({ command: "get_usage_reports", success: true, data: { reports: [] } }) as never;
		}
		if (cmd.type === "get_reset_credits") {
			return Promise.resolve({ command: "get_reset_credits", success: true, data: { accounts: [] } }) as never;
		}
		if (cmd.type === "redeem_reset_credit") {
			return Promise.resolve({
				command: "redeem_reset_credit",
				success: true,
				data: { ok: true, code: "redeemed", message: "Credit redeemed successfully" },
			}) as never;
		}
		return Promise.resolve(undefined) as never;
	};
	return { sink: { request }, commands };
}

interface TestMount {
	container: HTMLElement;
	cleanup(): void;
	findButton(ariaLabel: string): { click(): void; disabled?: boolean } | null;
	findButtonByText(text: string): { click(): void; disabled?: boolean; textContent: string | null } | null;
	findButtonsByText(text: string): Array<{ click(): void; disabled?: boolean; textContent: string | null }>;
	findDialog(): HTMLElement | null;
}

function mount(ui: React.ReactElement): TestMount {
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container as unknown as HTMLElement);
	act(() => {
		root.render(ui);
	});
	return {
		container: container as unknown as HTMLElement,
		cleanup() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
		findButton(ariaLabel: string) {
			const el = container.querySelector(`button[aria-label="${ariaLabel}"]`);
			return el as unknown as { click(): void; disabled?: boolean } | null;
		},
		findButtonByText(text: string) {
			const buttons = Array.from(container.querySelectorAll("button")) as unknown as Array<{
				click(): void;
				disabled?: boolean;
				textContent: string | null;
			}>;
			return buttons.find(b => b.textContent?.trim() === text) ?? null;
		},
		findButtonsByText(text: string) {
			const buttons = Array.from(container.querySelectorAll("button")) as unknown as Array<{
				click(): void;
				disabled?: boolean;
				textContent: string | null;
			}>;
			return buttons.filter(b => b.textContent?.trim() === text);
		},
		findDialog() {
			return container.querySelector('[role="dialog"]') as unknown as HTMLElement | null;
		},
	};
}

describe("UsageScreen and usage routing", () => {
	it("parses the usage route correctly", () => {
		const parsed = parseRoute("#/s/sess-123/usage");
		expect(parsed).toEqual({
			kind: "session",
			id: "sess-123",
			panel: "usage",
		});
	});

	it("navigates to the usage route from TopBar session actions menu", () => {
		const { sink } = createFakeSink();
		const route: Route = { kind: "session", id: "sess-abc", panel: null };
		win.location.hash = "#/s/sess-abc";

		const t = mount(<TopBar title="Test Session" connection="ready" route={route} sink={sink} />);

		// Open ⋮ menu
		const menuBtn = t.findButton("Session actions");
		expect(menuBtn).not.toBeNull();
		act(() => {
			menuBtn?.click();
		});

		// Click "Usage" item
		const usageItem = t.findButtonByText("Usage");
		expect(usageItem).not.toBeNull();
		act(() => {
			usageItem?.click();
		});

		expect(win.location.hash).toBe("#/s/sess-abc/usage");
		t.cleanup();
	});

	it("renders empty state when no reports are present", () => {
		const { sink } = createFakeSink();
		const t = mount(<UsageScreen sink={sink} initialReports={[]} initialResetAccounts={[]} />);

		expect(t.container.textContent).toContain("No usage reports available");
		t.cleanup();
	});

	it("renders limits with percent and reset text, and active account first", () => {
		const now = Date.now();
		const fixtures: RpcUsageReport[] = [
			{
				provider: "anthropic",
				fetchedAt: now - 10000,
				active: false,
				metadata: { email: "inactive@example.com" },
				limits: [
					{
						id: "limit-inactive",
						label: "Inactive Account Limit",
						scope: { provider: "anthropic" },
						amount: { usedFraction: 0.25, unit: "percent" },
						status: "ok",
					},
				],
			},
			{
				provider: "anthropic",
				fetchedAt: now - 10000,
				active: true,
				metadata: { email: "active@example.com" },
				limits: [
					{
						id: "limit-active",
						label: "Active Account Limit",
						scope: { provider: "anthropic" },
						// 2h 10m 30s buffer so test execution time doesn't drop it into 2h 9m
						window: { id: "daily", label: "Daily", resetsAt: now + (2 * 3600 + 10 * 60 + 30) * 1000 },
						amount: { usedFraction: 0.75, unit: "percent" },
						status: "warning",
						notes: ["Note on active account"],
					},
				],
			},
		];

		const { sink } = createFakeSink();
		const t = mount(<UsageScreen sink={sink} initialReports={fixtures} initialResetAccounts={[]} />);

		const text = t.container.textContent ?? "";
		expect(text).toContain("Active Account Limit");
		expect(text).toContain("75%");
		expect(text).toContain("resets in 2h 10m");
		expect(text).toContain("(Daily)");
		expect(text).toContain("Note on active account");

		// Active account should render before inactive account
		const activePos = text.indexOf("active@example.com");
		const inactivePos = text.indexOf("inactive@example.com");
		expect(activePos).toBeGreaterThan(-1);
		expect(inactivePos).toBeGreaterThan(-1);
		expect(activePos).toBeLessThan(inactivePos);

		t.cleanup();
	});

	it("renders redeem button only when redeemable, and sends redeem_reset_credit after confirm", async () => {
		const resetFixtures: RpcResetAccount[] = [
			{
				label: "redeemable@example.com",
				provider: "anthropic",
				providerLabel: "Claude",
				availableCount: 3,
				redeemableCount: 2,
				target: { credentialId: 101, provider: "anthropic" },
				active: true,
			},
			{
				label: "exhausted@example.com",
				provider: "openai-codex",
				providerLabel: "Codex",
				availableCount: 0,
				redeemableCount: 0,
				target: { credentialId: 102, provider: "openai-codex" },
				active: false,
				unavailableReason: "All credits exhausted",
			},
		];

		const { sink, commands } = createFakeSink();
		const t = mount(<UsageScreen sink={sink} initialReports={[]} initialResetAccounts={resetFixtures} />);

		const text = t.container.textContent ?? "";
		expect(text).toContain("redeemable@example.com");
		expect(text).toContain("exhausted@example.com");
		expect(text).toContain("All credits exhausted");

		// Should find only one "Redeem" button (for the redeemable account)
		const initialRedeemButtons = t.findButtonsByText("Redeem");
		expect(initialRedeemButtons.length).toBe(1);

		// Click the Redeem button
		act(() => {
			initialRedeemButtons[0].click();
		});

		// Confirm dialog should be open
		const dialog = t.findDialog();
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain("Redeem a rate-limit reset credit for Claude");

		// Click the confirm button inside dialog (has class tb-confirm-btn--primary)
		const confirmBtn = dialog?.querySelector(".tb-confirm-btn--primary") as unknown as { click(): void } | null;
		expect(confirmBtn).not.toBeNull();

		await act(async () => {
			confirmBtn?.click();
			const { promise, resolve } = Promise.withResolvers<void>();
			setTimeout(resolve, 20);
			await promise;
		});

		// Check that sink received redeem_reset_credit with target
		const redeemCmd = commands.find((c: unknown) =>
			Boolean(
				c && typeof c === "object" && "type" in c && (c as Record<string, unknown>).type === "redeem_reset_credit",
			),
		) as { type: string; target: unknown } | undefined;
		expect(redeemCmd).toBeDefined();
		expect(redeemCmd?.target).toEqual({ credentialId: 101, provider: "anthropic" });

		t.cleanup();
	});

	it("renders context bar and session stats", () => {
		const { sink } = createFakeSink();
		const sessionState = {
			contextUsage: {
				tokens: 10000,
				contextWindow: 100000,
				percent: 10,
			},
		} as unknown as RpcSessionState;

		const stats: SessionStats = {
			sessionId: "s-1",
			sessionFile: "/path/s-1",
			userMessages: 2,
			assistantMessages: 2,
			toolCalls: 1,
			toolResults: 1,
			totalMessages: 4,
			tokens: {
				input: 5000,
				output: 2000,
				reasoning: 0,
				cacheRead: 15000,
				cacheWrite: 3000,
				total: 25000,
			},
			premiumRequests: 3,
			cost: 0.42,
		};

		const t = mount(
			<UsageScreen
				sink={sink}
				sessionState={sessionState}
				stats={stats}
				initialReports={[]}
				initialResetAccounts={[]}
			/>,
		);

		const text = t.container.textContent ?? "";
		expect(text).toContain("Context");
		expect(text).toContain("10K / 100K");
		expect(text).toContain("10%");
		expect(text).toContain("$0.42");
		expect(text).toContain("5K");
		expect(text).toContain("2K");
		expect(text).toContain("15K");
		expect(text).toContain("3K");

		t.cleanup();
	});
});
