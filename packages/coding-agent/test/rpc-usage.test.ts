import { describe, expect, test } from "bun:test";
import type {
	ResetCreditAccountStatus,
	ResetCreditRedeemOutcome,
	ResetCreditTarget,
	UsageLimit,
	UsageReport,
} from "@oh-my-pi/pi-ai";
import {
	BACKGROUND_COMMANDS,
	dispatchRpcInputFrame,
	type RpcInputFrameDeps,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-server";
import {
	handleGetResetCredits,
	handleGetUsageReports,
	handleRedeemResetCredit,
	type UsageRpcSession,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-usage";
import type {
	RpcCommand,
	RpcRedeemResetCreditResult,
	RpcResetAccount,
	RpcResponse,
	RpcUsageReport,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

function dataOf<C extends Extract<RpcResponse, { success: true }>["command"]>(
	resp: RpcResponse,
	command: C,
): Extract<RpcResponse, { command: C; success: true }> extends { data: infer D } ? D : never {
	if (!resp.success || resp.command !== command) {
		throw new Error(`Expected success response for command ${command}, got ${JSON.stringify(resp)}`);
	}
	const successResp = resp as Extract<RpcResponse, { command: C; success: true }> & { data: unknown };
	return successResp.data as Extract<RpcResponse, { command: C; success: true }> extends { data: infer D } ? D : never;
}

function makeLimit(opts: { id?: string; label?: string; accountId?: string; used?: number } = {}): UsageLimit {
	return {
		id: opts.id ?? "limit-1",
		label: opts.label ?? "5h window",
		amount: {
			used: opts.used ?? 10,
			limit: 100,
			unit: "requests",
		},
		scope: {
			provider: "anthropic",
			shared: false,
			accountId: opts.accountId,
		},
	};
}

describe("RPC Usage (TASK item 1)", () => {
	describe("get_usage_reports", () => {
		test("strips raw and marks active true only for matching OAuth identity", async () => {
			const reportA: UsageReport = {
				provider: "anthropic",
				fetchedAt: 1000,
				limits: [makeLimit({ accountId: "acc-active" })],
				metadata: { email: "active@example.com", accountId: "acc-active" },
				raw: { heavy: "secret-provider-payload", tokens: [1, 2, 3] },
			};
			const reportB: UsageReport = {
				provider: "anthropic",
				fetchedAt: 1000,
				limits: [makeLimit({ accountId: "acc-other" })],
				metadata: { email: "other@example.com", accountId: "acc-other" },
				raw: { heavy: "another-secret-payload" },
			};

			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: {
					authStorage: {
						oauth: {
							identity: (provider, sessionId) => {
								if (provider === "anthropic" && sessionId === "test-session-1") {
									return { email: "active@example.com", accountId: "acc-active" };
								}
								return undefined;
							},
						},
					},
				},
				fetchUsageReports: async () => [reportA, reportB],
			};

			const resp = await handleGetUsageReports(session, { type: "get_usage_reports" }, "cmd-1");
			const data = dataOf(resp, "get_usage_reports");

			expect(data.reports).toHaveLength(2);

			const first = data.reports[0]!;
			expect("raw" in first).toBe(false);
			expect(first.active).toBe(true);
			expect(first.metadata?.email).toBe("active@example.com");

			const second = data.reports[1]!;
			expect("raw" in second).toBe(false);
			expect(second.active).toBe(false);
			expect(second.metadata?.email).toBe("other@example.com");
		});

		test("returns empty reports on null fetch result", async () => {
			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: { authStorage: {} },
				fetchUsageReports: async () => null,
			};

			const resp = await handleGetUsageReports(session, { type: "get_usage_reports" }, "cmd-2");
			expect(resp.success).toBe(true);
			const data = dataOf(resp, "get_usage_reports");
			expect(data.reports).toEqual([]);
		});

		test("returns empty reports on fetch throw", async () => {
			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: { authStorage: {} },
				fetchUsageReports: async () => {
					throw new Error("provider network timeout");
				},
			};

			const resp = await handleGetUsageReports(session, { type: "get_usage_reports" }, "cmd-3");
			expect(resp.success).toBe(true);
			const data = dataOf(resp, "get_usage_reports");
			expect(data.reports).toEqual([]);
		});

		test("honors refresh flag by invalidating cache when requested", async () => {
			let invalidateCalled = 0;
			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: {
					authStorage: {
						usage: {
							invalidate: async () => {
								invalidateCalled++;
							},
						},
					},
				},
				fetchUsageReports: async () => [],
			};

			await handleGetUsageReports(session, { type: "get_usage_reports", refresh: true }, "cmd-4");
			expect(invalidateCalled).toBe(1);

			await handleGetUsageReports(session, { type: "get_usage_reports", refresh: false }, "cmd-5");
			expect(invalidateCalled).toBe(1);

			await handleGetUsageReports(session, { type: "get_usage_reports" }, "cmd-6");
			expect(invalidateCalled).toBe(1);
		});
	});

	describe("get_reset_credits", () => {
		test("maps statuses to reset usage accounts", async () => {
			const statuses: ResetCreditAccountStatus[] = [
				{
					provider: "openai-codex",
					credentialId: 10,
					accountId: "codex-acc",
					email: "coder@example.com",
					availableCount: 3,
					redeemableCount: 2,
					active: true,
					credits: [
						{
							id: "credit-1",
							usable: true,
							expiresAt: "2026-10-01T00:00:00Z",
						},
					],
				},
				{
					provider: "anthropic",
					credentialId: 20,
					accountId: "claude-acc",
					email: "claude@example.com",
					availableCount: 1,
					redeemableCount: 1,
					active: false,
					nextCreditId: "credit-2",
					credits: [
						{
							id: "credit-2",
							usable: true,
						},
					],
				},
			];

			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: { authStorage: {} },
				listResetCredits: async () => statuses,
			};

			const resp = await handleGetResetCredits(session, "cmd-credits");
			expect(resp.success).toBe(true);
			const data = dataOf(resp, "get_reset_credits");
			expect(data.accounts).toHaveLength(2);

			const activeAccount = data.accounts[0]!;
			expect(activeAccount.active).toBe(true);
			expect(activeAccount.provider).toBe("openai-codex");
			expect(activeAccount.providerLabel).toBe("Codex");
			expect(activeAccount.availableCount).toBe(3);
			expect(activeAccount.redeemableCount).toBe(2);
			expect(activeAccount.target).toEqual({
				credentialId: 10,
				provider: "openai-codex",
				accountId: "codex-acc",
				email: "coder@example.com",
			});

			const otherAccount = data.accounts[1]!;
			expect(otherAccount.active).toBe(false);
			expect(otherAccount.provider).toBe("anthropic");
			expect(otherAccount.providerLabel).toBe("Claude");
			expect(otherAccount.target.creditId).toBe("credit-2");
		});
	});

	describe("redeem_reset_credit", () => {
		test("redeems reset credit and returns message and code from outcome", async () => {
			let passedTarget: ResetCreditTarget | undefined;
			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: { authStorage: {} },
				redeemResetCredit: async target => {
					passedTarget = target;
					return {
						ok: true,
						code: "reset",
						cleared: ["anthropic:5h"],
						provider: "anthropic",
					};
				},
			};

			const target: ResetCreditTarget = {
				provider: "anthropic",
				credentialId: 42,
				email: "user@example.com",
			};

			const resp = await handleRedeemResetCredit(session, { type: "redeem_reset_credit", target }, "cmd-redeem");
			expect(resp.success).toBe(true);
			const data = dataOf(resp, "redeem_reset_credit");
			expect(data.ok).toBe(true);
			expect(data.code).toBe("reset");
			expect(data.cleared).toEqual(["anthropic:5h"]);
			expect(data.message).toContain("Claude's 5h session limit has been refreshed");
			expect(data.message).toContain("user@example.com");
			expect(passedTarget).toEqual(target);
		});

		test("returns outcome message for already_redeemed", async () => {
			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: { authStorage: {} },
				redeemResetCredit: async () => ({
					ok: false,
					code: "already_redeemed",
					provider: "anthropic",
				}),
			};

			const target: ResetCreditTarget = {
				provider: "anthropic",
				credentialId: 42,
				accountId: "acc-1",
			};

			const resp = await handleRedeemResetCredit(session, { type: "redeem_reset_credit", target }, "cmd-redeem-2");
			expect(resp.success).toBe(true);
			const data = dataOf(resp, "redeem_reset_credit");
			expect(data.ok).toBe(false);
			expect(data.code).toBe("already_redeemed");
			expect(data.message).toContain("that reset was already redeemed");
		});

		test("returns error response for malformed target", async () => {
			const session: UsageRpcSession = {
				sessionId: "test-session-1",
				modelRegistry: { authStorage: {} },
			};

			const malformedTarget = { provider: "anthropic" } as unknown as ResetCreditTarget;
			const resp = await handleRedeemResetCredit(
				session,
				{ type: "redeem_reset_credit", target: malformedTarget },
				"cmd-err",
			);
			expect(resp.success).toBe(false);
			if (!resp.success) {
				expect(resp.error).toBe("Invalid reset credit target");
			}
		});
	});

	describe("background dispatch", () => {
		test("all three usage commands are declared as background commands", () => {
			expect(BACKGROUND_COMMANDS.has("get_usage_reports")).toBe(true);
			expect(BACKGROUND_COMMANDS.has("get_reset_credits")).toBe(true);
			expect(BACKGROUND_COMMANDS.has("redeem_reset_credit")).toBe(true);
		});

		test("dispatchRpcInputFrame dispatches get_usage_reports off the serial queue", () => {
			const outputs: unknown[] = [];
			const deps: RpcInputFrameDeps = {
				handleCommand: async () => undefined,
				output: frame => outputs.push(frame),
				errorResponse: (id, command, message) => ({
					id,
					type: "response",
					command,
					success: false,
					error: message,
				}),
				pendingExtensionRequests: new Map(),
				onHostToolResult: () => {},
				onHostToolUpdate: () => {},
				onHostUriResult: () => {},
			};

			const result = dispatchRpcInputFrame({ id: "bg-1", type: "get_usage_reports" }, deps);
			expect(result).toBeUndefined();
		});
	});
});
