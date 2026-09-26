import type { ResetCreditRedeemOutcome, ResetCreditTarget, UsageReport } from "@oh-my-pi/pi-ai";
import { collapseSharedUsageReports } from "@oh-my-pi/pi-tui/overlays/usage-display";
import type { OAuthAccountIdentity, ResetCreditAccountStatus } from "../../session/auth-storage";
import { reportMatchesActiveAccount } from "../../slash-commands/helpers/active-oauth-account";
import { describeRedeemOutcome, toResetUsageAccounts } from "../../slash-commands/helpers/reset-usage";
import { errorResponse, success } from "./rpc-response";
import type { RpcCommand, RpcRedeemResetCreditResult, RpcResetAccount, RpcResponse, RpcUsageReport } from "./rpc-types";

/**
 * Minimal session interface required by usage RPC handlers.
 * Satisfied by AgentSession and easy to stub in tests.
 */
export interface UsageRpcSession {
	readonly sessionId: string;
	readonly modelRegistry: {
		readonly authStorage: {
			readonly oauth?: {
				identity?(provider: string, sessionId: string): OAuthAccountIdentity | undefined;
			};
			readonly usage?: {
				invalidate?(provider?: string): Promise<void>;
			};
		};
	};
	fetchUsageReports?(signal?: AbortSignal): Promise<UsageReport[] | null>;
	listResetCredits?(signal?: AbortSignal, provider?: string): Promise<ResetCreditAccountStatus[]>;
	redeemResetCredit?(target: ResetCreditTarget, signal?: AbortSignal): Promise<ResetCreditRedeemOutcome>;
}

export async function handleGetUsageReports(
	session: UsageRpcSession,
	command: Extract<RpcCommand, { type: "get_usage_reports" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	try {
		if (command.refresh && typeof session.modelRegistry.authStorage.usage?.invalidate === "function") {
			await session.modelRegistry.authStorage.usage.invalidate();
		}
		const reports = await session.fetchUsageReports?.();
		if (!reports) {
			return success(id, "get_usage_reports", { reports: [] });
		}
		const collapsed = collapseSharedUsageReports(reports);
		const oauth = session.modelRegistry.authStorage.oauth;
		const result: RpcUsageReport[] = collapsed.map(report => {
			const { raw: _raw, ...rest } = report;
			const identity = oauth?.identity?.(report.provider, session.sessionId);
			const active = reportMatchesActiveAccount(report, identity);
			return {
				...rest,
				active,
			};
		});
		return success(id, "get_usage_reports", { reports: result });
	} catch {
		return success(id, "get_usage_reports", { reports: [] });
	}
}

export async function handleGetResetCredits(session: UsageRpcSession, id: string | undefined): Promise<RpcResponse> {
	try {
		const statuses = (await session.listResetCredits?.()) ?? [];
		const accounts: RpcResetAccount[] = toResetUsageAccounts(statuses);
		return success(id, "get_reset_credits", { accounts });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return errorResponse(id, "get_reset_credits", message);
	}
}

export async function handleRedeemResetCredit(
	session: UsageRpcSession,
	command: Extract<RpcCommand, { type: "redeem_reset_credit" }>,
	id: string | undefined,
): Promise<RpcResponse> {
	const target = command.target;
	if (!target || typeof target.provider !== "string" || typeof target.credentialId !== "number") {
		return errorResponse(id, "redeem_reset_credit", "Invalid reset credit target");
	}
	if (!session.redeemResetCredit) {
		return errorResponse(id, "redeem_reset_credit", "Session does not support redeeming reset credits");
	}
	try {
		const outcome = await session.redeemResetCredit(target);
		const label = target.email ?? target.accountId ?? "account";
		const message = describeRedeemOutcome(outcome, label);
		const data: RpcRedeemResetCreditResult = {
			ok: outcome.ok,
			code: outcome.code,
			message,
			...(outcome.cleared ? { cleared: outcome.cleared } : {}),
		};
		return success(id, "redeem_reset_credit", data);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return errorResponse(id, "redeem_reset_credit", message);
	}
}
