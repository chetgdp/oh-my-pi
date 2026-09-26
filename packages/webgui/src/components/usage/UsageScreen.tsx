import { useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { RpcSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { SessionStats } from "@oh-my-pi/pi-coding-agent/session/agent-session-types";
import { formatNumber } from "@oh-my-pi/pi-utils/format";
import { notify } from "../../lib/notify";
import { contextLevel, formatContextUsage } from "../../lib/context-usage";
import type { SessionCommandSink, RpcUsageReport, RpcResetAccount } from "../../lib/session-actions";
import { getUsageReports, getResetCredits, redeemResetCredit } from "../../lib/session-actions";
import "./usage.css";

export interface UsageScreenProps {
	sink: SessionCommandSink | null;
	sessionState?: RpcSessionState | null;
	stats?: SessionStats | null;
	onBack?: () => void;
	initialReports?: RpcUsageReport[];
	initialResetAccounts?: RpcResetAccount[];
}

/** Format time relative to resetsAt timestamp. */
export function formatResetsIn(resetsAtMs: number, now = Date.now()): string {
	const diff = resetsAtMs - now;
	if (diff <= 0) return "resets now";

	const totalSeconds = Math.floor(diff / 1000);
	const totalMinutes = Math.floor(totalSeconds / 60);
	const totalHours = Math.floor(totalMinutes / 60);
	const days = Math.floor(totalHours / 24);

	if (days > 0) {
		const hours = totalHours % 24;
		return hours > 0 ? `resets in ${days}d ${hours}h` : `resets in ${days}d`;
	}
	if (totalHours > 0) {
		const minutes = totalMinutes % 60;
		return minutes > 0 ? `resets in ${totalHours}h ${minutes}m` : `resets in ${totalHours}h`;
	}
	if (totalMinutes > 0) {
		return `resets in ${totalMinutes}m`;
	}
	return `resets in ${Math.max(1, totalSeconds)}s`;
}

/** Format report age relative to fetchedAt timestamp. */
export function formatReportAge(fetchedAtMs: number, now = Date.now()): string {
	const diff = Math.max(0, now - fetchedAtMs);
	if (diff < 60_000) return "just now";
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

/** Format account label from report metadata with standard precedence. */
export function formatAccountLabel(metadata?: Record<string, unknown>, fallback = "account"): string {
	if (!metadata) return fallback;
	const email = typeof metadata.email === "string" && metadata.email.trim() ? metadata.email.trim() : undefined;
	const orgName =
		typeof metadata.orgName === "string" && metadata.orgName.trim() ? metadata.orgName.trim() : undefined;
	const orgId = typeof metadata.orgId === "string" && metadata.orgId.trim() ? metadata.orgId.trim() : undefined;
	const org = orgName || orgId;
	const accountId =
		typeof metadata.accountId === "string" && metadata.accountId.trim() ? metadata.accountId.trim() : undefined;

	if (email) return org ? `${email} (${org})` : email;
	if (accountId) return org && org !== accountId ? `${accountId} (${org})` : accountId;
	if (org) return org;
	return fallback;
}

/** Extract fraction 0..1 from usage limit amount. */
function getLimitUsedFraction(amount?: {
	usedFraction?: number;
	used?: number;
	limit?: number;
	unit?: string;
	remainingFraction?: number;
}): number {
	if (!amount) return 0;
	if (typeof amount.usedFraction === "number" && !Number.isNaN(amount.usedFraction)) {
		return amount.usedFraction;
	}
	if (
		typeof amount.used === "number" &&
		typeof amount.limit === "number" &&
		amount.limit > 0 &&
		!Number.isNaN(amount.used)
	) {
		return amount.used / amount.limit;
	}
	if (amount.unit === "percent" && typeof amount.used === "number") {
		return amount.used / 100;
	}
	if (typeof amount.remainingFraction === "number" && !Number.isNaN(amount.remainingFraction)) {
		return Math.max(0, 1 - amount.remainingFraction);
	}
	return 0;
}

export function UsageScreen({
	sink,
	sessionState,
	stats,
	onBack,
	initialReports,
	initialResetAccounts,
}: UsageScreenProps): ReactNode {
	const [reports, setReports] = useState<RpcUsageReport[]>(initialReports ?? []);
	const [resetAccounts, setResetAccounts] = useState<RpcResetAccount[]>(initialResetAccounts ?? []);
	const [loading, setLoading] = useState(false);
	const [redeemConfirm, setRedeemConfirm] = useState<RpcResetAccount | null>(null);
	const [redeemPending, setRedeemPending] = useState(false);

	const fetchUsage = useCallback(
		async (refresh?: boolean) => {
			if (!sink) return;
			setLoading(true);
			try {
				const [usageRes, resetRes] = await Promise.allSettled([
					getUsageReports(sink, refresh),
					getResetCredits(sink),
				]);

				if (usageRes.status === "fulfilled") {
					setReports(usageRes.value.data.reports ?? []);
				} else {
					notify(
						"error",
						usageRes.reason instanceof Error ? usageRes.reason.message : "Failed to load usage reports",
					);
				}

				if (resetRes.status === "fulfilled") {
					setResetAccounts(resetRes.value.data.accounts ?? []);
				} else {
					notify(
						"error",
						resetRes.reason instanceof Error ? resetRes.reason.message : "Failed to load reset credits",
					);
				}
			} finally {
				setLoading(false);
			}
		},
		[sink],
	);

	useEffect(() => {
		if (sink && !initialReports && !initialResetAccounts) {
			fetchUsage(false);
		}
	}, [sink, fetchUsage, initialReports, initialResetAccounts]);

	const handleConfirmRedeem = useCallback(
		async (account: RpcResetAccount) => {
			if (!sink) return;
			setRedeemPending(true);
			try {
				const res = await redeemResetCredit(sink, account.target);
				notify(res.data.ok ? "info" : "error", res.data.message);
				setRedeemConfirm(null);
				await fetchUsage(true);
			} catch (err: unknown) {
				notify("error", err instanceof Error ? err.message : String(err));
			} finally {
				setRedeemPending(false);
			}
		},
		[sink, fetchUsage],
	);

	// Context calculation
	const contextUsage = sessionState?.contextUsage ?? stats?.contextUsage;
	const contextWindow = contextUsage?.contextWindow ?? 0;
	const contextTokens = contextUsage?.tokens ?? 0;
	const hasValidContext = contextWindow > 0;
	const contextPercent = hasValidContext ? (contextUsage?.percent ?? (contextTokens / contextWindow) * 100) : 0;
	const clampedContextPercent = Math.min(100, Math.max(0, contextPercent));
	const currentContextLevel = contextLevel(clampedContextPercent);
	const formattedContextStr = formatContextUsage(contextUsage);

	// Group reports by provider then sort accounts: active first
	const groupedProviders = useMemo(() => {
		const groups: Record<string, RpcUsageReport[]> = {};
		for (const r of reports) {
			const list = groups[r.provider] ?? [];
			list.push(r);
			groups[r.provider] = list;
		}

		const result: Array<{ provider: string; reports: RpcUsageReport[] }> = [];
		for (const [provider, list] of Object.entries(groups)) {
			list.sort((a, b) => {
				if (a.active !== b.active) {
					return a.active ? -1 : 1;
				}
				const labelA = formatAccountLabel(a.metadata);
				const labelB = formatAccountLabel(b.metadata);
				return labelA.localeCompare(labelB);
			});
			result.push({ provider, reports: list });
		}
		return result;
	}, [reports]);

	// Newest fetchedAt for age header
	const newestFetchedAt = useMemo(() => {
		let max = 0;
		for (const r of reports) {
			if (r.fetchedAt && r.fetchedAt > max) {
				max = r.fetchedAt;
			}
		}
		return max;
	}, [reports]);

	return (
		<div className="sh-panel-body">
			<div className="sh-panel-header">
				{onBack && (
					<button type="button" className="tb-back" onClick={onBack} aria-label="Back">
						&#x2190;
					</button>
				)}
				<span className="sh-panel-title">Usage</span>
				<button
					type="button"
					className="us-refresh-btn"
					onClick={() => fetchUsage(true)}
					disabled={loading}
					aria-label="Refresh"
				>
					<RefreshCw size={14} className={loading ? "us-spinning" : "us-refresh-icon"} />
					<span>Refresh</span>
				</button>
			</div>

			<div className="us-screen">
				{/* 1. Context Section */}
				<section className="us-section" aria-label="Context usage">
					<div className="us-section-header">
						<h2 className="us-section-title">Context</h2>
						{formattedContextStr && <span className="us-context-summary">{formattedContextStr}</span>}
					</div>
					{hasValidContext ? (
						<>
							<div className="us-context-bar-wrap">
								<div
									className={`us-context-bar us-level-${currentContextLevel}`}
									style={{ width: `${clampedContextPercent}%` }}
									role="progressbar"
									aria-valuenow={Math.round(clampedContextPercent)}
									aria-valuemin={0}
									aria-valuemax={100}
								/>
							</div>
							<div className="us-context-meta">
								<span>
									{formatNumber(contextTokens)} / {formatNumber(contextWindow)}
								</span>
								<span>
									{contextPercent < 1 && contextPercent > 0
										? `${contextPercent.toFixed(1)}%`
										: `${Math.round(contextPercent)}%`}
								</span>
							</div>
						</>
					) : (
						<div className="us-empty">No context window data</div>
					)}
				</section>

				{/* 2. Session Section */}
				<section className="us-section" aria-label="Session statistics">
					<div className="us-section-header">
						<h2 className="us-section-title">Session</h2>
					</div>
					<div className="us-stats-grid">
						<div className="us-stat-item">
							<span className="us-stat-label">Cost</span>
							<span className="us-stat-value">${(stats?.cost ?? 0).toFixed(2)}</span>
						</div>
						<div className="us-stat-item">
							<span className="us-stat-label">Input tokens</span>
							<span className="us-stat-value">{formatNumber(stats?.tokens?.input ?? 0)}</span>
						</div>
						<div className="us-stat-item">
							<span className="us-stat-label">Output tokens</span>
							<span className="us-stat-value">{formatNumber(stats?.tokens?.output ?? 0)}</span>
						</div>
						<div className="us-stat-item">
							<span className="us-stat-label">Cache read</span>
							<span className="us-stat-value">{formatNumber(stats?.tokens?.cacheRead ?? 0)}</span>
						</div>
						<div className="us-stat-item">
							<span className="us-stat-label">Cache write</span>
							<span className="us-stat-value">{formatNumber(stats?.tokens?.cacheWrite ?? 0)}</span>
						</div>
						<div className="us-stat-item">
							<span className="us-stat-label">Premium requests</span>
							<span className="us-stat-value">{stats?.premiumRequests ?? 0}</span>
						</div>
					</div>
				</section>

				{/* 3. Providers Section */}
				<section className="us-section" aria-label="Provider rate limits">
					<div className="us-section-header">
						<h2 className="us-section-title">Providers</h2>
						{newestFetchedAt > 0 && (
							<span className="us-report-age">Updated {formatReportAge(newestFetchedAt)}</span>
						)}
					</div>

					{loading && reports.length === 0 ? (
						<div className="us-loading">Loading usage reports...</div>
					) : groupedProviders.length === 0 ? (
						<div className="us-empty">No usage reports available</div>
					) : (
						<div className="us-providers-list">
							{groupedProviders.map(({ provider, reports: providerReports }) => (
								<div key={provider} className="us-provider-group">
									<div className="us-provider-title">{provider}</div>
									<div className="us-accounts-list">
										{providerReports.map((report, idx) => {
											const accountLabel = formatAccountLabel(report.metadata, `Account ${idx + 1}`);
											return (
												<div key={`${provider}-${idx}-${accountLabel}`} className="us-account-card">
													<div className="us-account-header">
														<span className="us-account-label">{accountLabel}</span>
														{report.active && <span className="us-active-badge">Active</span>}
													</div>

													{report.limits.length === 0 ? (
														<div className="us-empty">No limits reported</div>
													) : (
														<div className="us-limits-list">
															{report.limits.map(limit => {
																const fraction = getLimitUsedFraction(limit.amount);
																const percent = Math.min(100, Math.max(0, fraction * 100));
																const percentText =
																	percent < 1 && percent > 0
																		? `${percent.toFixed(1)}%`
																		: `${Math.round(percent)}%`;
																const status =
																	limit.status ??
																	(fraction >= 1 ? "exhausted" : fraction >= 0.8 ? "warning" : "ok");
																const resetText = limit.window?.resetsAt
																	? formatResetsIn(limit.window.resetsAt)
																	: undefined;

																return (
																	<div key={limit.id} className="us-limit-row">
																		<div className="us-limit-header">
																			<div className="us-limit-name">
																				<span className="us-limit-label">{limit.label}</span>
																				{limit.window?.label && (
																					<span className="us-limit-window">
																						({limit.window.label})
																					</span>
																				)}
																			</div>
																			<div className="us-limit-meta">
																				<span className="us-limit-percent">{percentText}</span>
																				{resetText && (
																					<span className="us-limit-reset">{resetText}</span>
																				)}
																			</div>
																		</div>
																		<div className="us-limit-bar-track">
																			<div
																				className="us-limit-bar-fill"
																				data-status={status}
																				style={{ width: `${percent}%` }}
																				role="progressbar"
																				aria-valuenow={Math.round(percent)}
																				aria-valuemin={0}
																				aria-valuemax={100}
																			/>
																		</div>
																		{limit.notes && limit.notes.length > 0 && (
																			<div className="us-limit-notes">
																				{limit.notes.map((note, noteIdx) => (
																					<span key={noteIdx} className="us-limit-note">
																						{note}
																					</span>
																				))}
																			</div>
																		)}
																	</div>
																);
															})}
														</div>
													)}
												</div>
											);
										})}
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* 4. Reset Credits Section */}
				{resetAccounts.length > 0 && (
					<section className="us-section" aria-label="Reset credits">
						<div className="us-section-header">
							<h2 className="us-section-title">Reset Credits</h2>
						</div>
						<div className="us-resets-list">
							{resetAccounts.map(account => (
								<div
									key={`${account.provider}-${account.label}-${account.target.credentialId}`}
									className="us-reset-account"
								>
									<div className="us-reset-header">
										<div className="us-reset-identity">
											<span className="us-reset-label">{account.label}</span>
											<span className="us-reset-provider">({account.providerLabel})</span>
											{account.active && <span className="us-active-badge">Active</span>}
										</div>
									</div>

									<div className="us-reset-details">
										<div className="us-reset-counts">
											<span>
												Available: <strong>{account.availableCount}</strong>
											</span>
											<span>
												Redeemable: <strong>{account.redeemableCount}</strong>
											</span>
										</div>

										{account.redeemableCount > 0 && (
											<button
												type="button"
												className="us-redeem-btn"
												onClick={() => setRedeemConfirm(account)}
											>
												Redeem
											</button>
										)}
									</div>

									{account.unavailableReason && (
										<div className="us-reset-reason">{account.unavailableReason}</div>
									)}
									{account.error && <div className="us-reset-error">{account.error}</div>}
									{account.expiresAt && (
										<div className="us-reset-expiry">
											Expires {new Date(account.expiresAt).toLocaleDateString()}
										</div>
									)}
								</div>
							))}
						</div>
					</section>
				)}
			</div>

			{/* Confirm modal for redeeming reset credits */}
			{redeemConfirm && (
				<>
					<div className="tb-popover-backdrop" onClick={() => !redeemPending && setRedeemConfirm(null)} />
					<div className="tb-confirm-dialog" role="dialog" aria-modal="true" aria-label="Redeem reset credit">
						<div className="tb-confirm-title">Redeem reset credit</div>
						<div className="tb-confirm-desc">
							Redeem a rate-limit reset credit for {redeemConfirm.providerLabel} ({redeemConfirm.label})?
						</div>
						<div className="tb-confirm-actions">
							<button
								type="button"
								className="tb-confirm-btn tb-confirm-btn--cancel"
								disabled={redeemPending}
								onClick={() => setRedeemConfirm(null)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="tb-confirm-btn tb-confirm-btn--primary"
								disabled={redeemPending}
								onClick={() => handleConfirmRedeem(redeemConfirm)}
							>
								{redeemPending ? "Redeeming..." : "Redeem"}
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
