/**
 * Providers section of the Models hub.
 *
 * Displays known providers, auth status, model counts, discovery health,
 * and refresh controls.
 */

import { useState } from "react";
import { RotateCw } from "lucide-react";
import type { RpcProviderStatus } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { ProvidersSectionProps } from "./contract";
import "./providers.css";

/**
 * Format timestamp into relative time string ("2m ago", "just now").
 * Pure helper for deterministic testing with injected `now`.
 */
export function relativeTime(ts: number, now: number = Date.now()): string {
	const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
	if (diffSec < 5) {
		return "just now";
	}
	if (diffSec < 60) {
		return `${diffSec}s ago`;
	}
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) {
		return `${diffMin}m ago`;
	}
	const diffHour = Math.floor(diffMin / 60);
	if (diffHour < 24) {
		return `${diffHour}h ago`;
	}
	const diffDays = Math.floor(diffHour / 24);
	return `${diffDays}d ago`;
}

/**
 * Formats discovery status text and extracts error if present.
 * Pure helper for testing.
 */
export function describeDiscovery(
	discovery?: RpcProviderStatus["discovery"],
	now: number = Date.now(),
): { text: string; error?: string } {
	if (!discovery) {
		return { text: "idle" };
	}

	const { status, fetchedAt, error } = discovery;
	let text: string = status;

	if (status === "cached" && typeof fetchedAt === "number") {
		text = `cached ${relativeTime(fetchedAt, now)}`;
	} else if (status === "ok" && typeof fetchedAt === "number") {
		text = `updated ${relativeTime(fetchedAt, now)}`;
	}

	return {
		text,
		error: error ? error : undefined,
	};
}

/**
 * Sorts providers authenticated first, then alphabetically by provider id.
 * Pure helper for testing.
 */
export function sortProviders(providers: RpcProviderStatus[]): RpcProviderStatus[] {
	return [...providers].sort((a, b) => {
		if (a.authenticated !== b.authenticated) {
			return a.authenticated ? -1 : 1;
		}
		return a.id.localeCompare(b.id);
	});
}

export function ProvidersSection({
	browser,
	loginStatus,
	refreshing,
	onRefresh,
	onLogin,
	onLogout,
}: ProvidersSectionProps) {
	const [confirmCredentialId, setConfirmCredentialId] = useState<number | null>(null);
	const isRefreshingAll = refreshing === "all";
	const isAnyRefreshing = refreshing !== null;

	return (
		<section className="mp-section" aria-label="Providers">
			<div className="mp-header">
				<button
					type="button"
					className="mp-refresh-all"
					disabled={isAnyRefreshing}
					onClick={() => onRefresh(undefined)}
					aria-label="Refresh all providers"
				>
					<RotateCw size={14} className={isRefreshingAll ? "mp-spinner" : undefined} aria-hidden="true" />
					<span>Refresh all</span>
				</button>
			</div>

			{!browser ? (
				<div className="mp-loading" role="status">
					Loading providers...
				</div>
			) : (
				<div className="mp-list">
					{sortProviders(browser.providers).map(provider => {
						const isProviderRefreshing = refreshing === provider.id;
						const isLocked = !provider.authenticated;
						const discoveryInfo = describeDiscovery(provider.discovery);

						const statusProvider = loginStatus?.providers.find(
							p => p.id === provider.id || p.storeCredentialsAs === provider.id,
						);
						const canLogin = isLocked && Boolean(statusProvider && onLogin);

						const mainContent = (
							<div className="mp-row-main">
								<div className="mp-row-top">
									<span className="mp-provider-id">{provider.id}</span>
									<span className="mp-model-count">
										{provider.modelCount} {provider.modelCount === 1 ? "model" : "models"}
									</span>
									<span className={`mp-auth-badge ${provider.authenticated ? "signed-in" : "no-key"}`}>
										{provider.authenticated ? "signed in" : "no API key"}
									</span>
								</div>
								<div className="mp-row-sub">
									<span className="mp-discovery-status">{discoveryInfo.text}</span>
									{discoveryInfo.error ? (
										<span className="mp-discovery-error">{discoveryInfo.error}</span>
									) : null}
								</div>
							</div>
						);

						if (canLogin && statusProvider) {
							return (
								<button
									key={provider.id}
									type="button"
									className="mp-row mp-row-locked mp-row-tappable"
									data-provider-id={provider.id}
									data-locked="true"
									onClick={() => onLogin?.(statusProvider.id)}
								>
									{mainContent}
								</button>
							);
						}

						const accounts = provider.authenticated && statusProvider?.accounts ? statusProvider.accounts : [];

						return (
							<div
								key={provider.id}
								className={`mp-row${isLocked ? " mp-row-locked" : ""}`}
								data-provider-id={provider.id}
								data-locked={isLocked ? "true" : undefined}
							>
								{mainContent}

								{provider.discoverable ? (
									<button
										type="button"
										className="mp-refresh-btn"
										disabled={isAnyRefreshing}
										onClick={() => onRefresh(provider.id)}
										aria-label={`Refresh ${provider.id}`}
									>
										<RotateCw
											size={16}
											className={isProviderRefreshing ? "mp-spinner" : undefined}
											aria-hidden="true"
										/>
									</button>
								) : null}

								{accounts.length > 0 ? (
									<div className="mp-accounts-list">
										{accounts.map(acc => (
											<div key={acc.credentialId} className="mp-account-row">
												{confirmCredentialId === acc.credentialId ? (
													<div className="mp-logout-confirm">
														<span className="mp-logout-confirm-text">Log out {acc.label}?</span>
														<button
															type="button"
															className="mp-btn-confirm"
															onClick={() => {
																setConfirmCredentialId(null);
																onLogout?.(statusProvider!.id, acc.credentialId);
															}}
														>
															Confirm
														</button>
														<button
															type="button"
															className="mp-btn-keep"
															onClick={() => setConfirmCredentialId(null)}
														>
															Keep
														</button>
													</div>
												) : (
													<div className="mp-account-info">
														<span className="mp-account-label">{acc.label}</span>
														<button
															type="button"
															className="mp-logout-btn"
															onClick={() => setConfirmCredentialId(acc.credentialId)}
														>
															Log out
														</button>
													</div>
												)}
											</div>
										))}
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
