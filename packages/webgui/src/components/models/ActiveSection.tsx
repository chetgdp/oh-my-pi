import type { ReactNode } from "react";
import type { RpcModelSource } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { ActiveSectionProps } from "./contract";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Format model source explanation string according to the contract:
 * - kind role with role default -> "Default role"
 * - kind role other -> "Role <role>"
 * - temporary -> "Session override (/switch)"
 * - ephemeral -> "Ephemeral override"
 * - fallback -> "Fallback from <fallbackFrom>"
 * - undefined -> "Session model"
 */
export function explainModelSource(source: RpcModelSource | undefined): string {
	if (!source) {
		return "Session model";
	}
	switch (source.kind) {
		case "role":
			return source.role === "default" ? "Default role" : `Role ${source.role ?? ""}`.trim();
		case "temporary":
			return "Session override (/switch)";
		case "ephemeral":
			return "Ephemeral override";
		case "fallback":
			return `Fallback from ${source.fallbackFrom ?? "unknown"}`;
		default:
			return "Session model";
	}
}

export function ActiveSection({ state, roles, streaming, onPick, onCycle }: ActiveSectionProps): ReactNode {
	const model = state?.model;
	const modelName = model?.name ?? (model ? `${model.provider}/${model.id}` : "No model selected");
	const thinkingLevel = state?.thinkingLevel;
	const modelSource = state?.modelSource;
	const explanation = explainModelSource(modelSource);

	const cycleOrder = roles?.cycleOrder ?? [];
	const canCycle = cycleOrder.length >= 2;

	// Active role in cycleOrder: role whose resolved equals current model, or modelSource.role
	const activeRoleKey =
		(modelSource?.kind === "role" ? modelSource.role : undefined) ??
		roles?.roles.find(r => model && r.resolved?.provider === model.provider && r.resolved?.id === model.id)?.id;

	return (
		<section className="md-section md-active-section">
			<div className="md-active-card">
				<div className="md-active-header">
					<div className="md-active-info">
						<div className="md-active-name-row">
							<span className="md-active-name">{modelName}</span>
							{thinkingLevel !== undefined && (
								<span className="md-active-thinking">thinking: {thinkingLevel}</span>
							)}
						</div>
						<div className="md-active-explanation">{explanation}</div>
						{streaming && <div className="md-active-hint">applies at next request</div>}
					</div>
					<div className="md-active-actions">
						<button type="button" className="md-btn md-btn--pick" onClick={onPick}>
							Pick
						</button>
						<div className="md-cycle-buttons">
							<button
								type="button"
								className="md-btn md-btn--icon"
								disabled={!canCycle}
								onClick={() => onCycle("backward")}
								aria-label="Previous role in cycle"
								title="Previous role"
							>
								<ChevronLeft size={16} />
							</button>
							<button
								type="button"
								className="md-btn md-btn--icon"
								disabled={!canCycle}
								onClick={() => onCycle("forward")}
								aria-label="Next role in cycle"
								title="Next role"
							>
								<ChevronRight size={16} />
							</button>
						</div>
					</div>
				</div>

				{cycleOrder.length > 0 && (
					<div className="md-cycle-track" aria-label="Cycle order">
						{cycleOrder.map(roleId => {
							const roleObj = roles?.roles.find(r => r.id === roleId);
							const label = roleObj?.name ?? roleId;
							const isActive = roleId === activeRoleKey;
							return (
								<span key={roleId} className={`md-cycle-chip ${isActive ? "md-cycle-chip--active" : ""}`}>
									{label}
								</span>
							);
						})}
					</div>
				)}
			</div>
		</section>
	);
}
