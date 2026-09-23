import { useState, type ReactNode } from "react";
import type { RpcAgentInfo } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";

export interface AgentRowProps {
	agent: RpcAgentInfo;
	/** Force expanded state, useful for tests or controlled usage */
	defaultExpanded?: boolean;
	onPickAgent(agentName: string): void;
	onSetEnabled(agentName: string, enabled: boolean): void;
	onSetServiceTier(agentName: string, tier: string | null): void;
	onSetPrewalk(agentName: string, value: string | null): void;
	onSetAdvisor(agentName: string, value: string | null): void;
}

export const tierOptions = [
	{ label: "inherit (unset)", value: "" },
	{ label: "inherit", value: "inherit" },
	{ label: "none", value: "none" },
	{ label: "auto", value: "auto" },
	{ label: "default", value: "default" },
	{ label: "flex", value: "flex" },
	{ label: "scale", value: "scale" },
	{ label: "priority", value: "priority" },
] as const;

export type PrewalkSegment = "on" | "off" | "custom";

export function prewalkSegment(
	prewalk?: {
		effective?: string;
		source: "override" | "frontmatter" | "default" | "none";
	} | null,
): PrewalkSegment {
	if (!prewalk || prewalk.source === "none") {
		return "off";
	}
	const effective = prewalk.effective?.trim();
	if (!effective || effective === "off") {
		return "off";
	}
	if (effective === "@smol" || effective === "on") {
		return "on";
	}
	return "custom";
}

export function describePrecedenceEntry(entry: {
	source: "override" | "frontmatter" | "parentActive" | "parentFallback" | "defaultRole";
	selector: string;
}): string {
	return `${entry.source}: ${entry.selector}`;
}

export function AgentRow({
	agent,
	defaultExpanded = false,
	onPickAgent,
	onSetEnabled,
	onSetServiceTier,
	onSetPrewalk,
	onSetAdvisor,
}: AgentRowProps): ReactNode {
	const [expanded, setExpanded] = useState(defaultExpanded);
	const [customPrewalk, setCustomPrewalk] = useState("");
	const [customAdvisor, setCustomAdvisor] = useState("");

	const isDimmed = agent.disabled;
	const prewalkSeg = prewalkSegment(agent.prewalk);
	const advisorSeg = prewalkSegment(agent.advisor);

	const resolvedModelName =
		agent.resolved?.name ?? (agent.patterns && agent.patterns.length > 0 ? agent.patterns[0] : "default");

	return (
		<div className={`ag-row${isDimmed ? " ag-row--dimmed" : ""}`}>
			<div
				className="ag-header"
				role="button"
				tabIndex={0}
				onClick={() => setExpanded(!expanded)}
				onKeyDown={e => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setExpanded(!expanded);
					}
				}}
			>
				<div className="ag-header-left">
					<span className="ag-name">{agent.name}</span>
					<span className="ag-badge ag-badge--source">{agent.source}</span>
					{agent.isDefaultTaskAgent && <span className="ag-badge ag-badge--default">default task agent</span>}
				</div>
				<div className="ag-header-right">
					<button
						type="button"
						role="switch"
						aria-checked={!agent.disabled}
						aria-label={`Enable ${agent.name}`}
						className="ag-toggle"
						onClick={e => {
							e.stopPropagation();
							onSetEnabled(agent.name, agent.disabled);
						}}
					>
						<span className="ag-toggle-thumb" />
					</button>
				</div>
			</div>

			{expanded && (
				<div className="ag-body">
					{/* Resolved model */}
					<div className="ag-field">
						<span className="ag-field-label">Model</span>
						<button type="button" className="ag-model-btn" onClick={() => onPickAgent(agent.name)}>
							<span className="ag-model-name">{resolvedModelName}</span>
							{agent.override && <span className="ag-badge ag-badge--override">override</span>}
							{!agent.override && agent.declaredModel && agent.declaredModel.length > 0 && (
								<span className="ag-badge ag-badge--declared">declared</span>
							)}
						</button>
					</div>

					{/* Service tier */}
					<div className="ag-field">
						<span className="ag-field-label">Service Tier</span>
						<select
							className="ag-select"
							value={agent.serviceTier ?? ""}
							onChange={e => {
								const val = e.target.value;
								onSetServiceTier(agent.name, val === "" ? null : val);
							}}
						>
							{tierOptions.map(opt => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					{/* Prewalk row */}
					<div className="ag-field">
						<span className="ag-field-label">Prewalk</span>
						<div className="ag-control-row">
							<div className="ag-control-meta">
								<span className="ag-control-effective">{agent.prewalk?.effective ?? "off"}</span>
								<span className="ag-badge ag-badge--source">{agent.prewalk?.source ?? "none"}</span>
							</div>
							<div className="ag-control-actions">
								<div className="ag-segmented" role="radiogroup">
									<button
										type="button"
										className={`ag-segmented-btn${prewalkSeg === "on" ? " ag-segmented-btn--active" : ""}`}
										onClick={() => onSetPrewalk(agent.name, "on")}
									>
										On
									</button>
									<button
										type="button"
										className={`ag-segmented-btn${prewalkSeg === "off" ? " ag-segmented-btn--active" : ""}`}
										onClick={() => onSetPrewalk(agent.name, "off")}
									>
										Off
									</button>
									<button
										type="button"
										className={`ag-segmented-btn${prewalkSeg === "custom" ? " ag-segmented-btn--active" : ""}`}
										onClick={() => {
											if (prewalkSeg !== "custom") {
												setCustomPrewalk(agent.prewalk?.effective ?? "");
											}
										}}
									>
										Custom
									</button>
								</div>
								{prewalkSeg === "custom" && (
									<input
										type="text"
										className="ag-custom-input"
										placeholder="selector..."
										value={customPrewalk || (agent.prewalk?.effective ?? "")}
										onChange={e => setCustomPrewalk(e.target.value)}
										onKeyDown={e => {
											if (e.key === "Enter") {
												onSetPrewalk(agent.name, e.currentTarget.value);
											}
										}}
									/>
								)}
								{agent.prewalk?.source === "override" && (
									<button
										type="button"
										className="ag-btn-reset"
										onClick={() => onSetPrewalk(agent.name, null)}
									>
										Reset
									</button>
								)}
							</div>
						</div>
					</div>

					{/* Advisor row */}
					<div className="ag-field">
						<span className="ag-field-label">Advisor</span>
						<div className="ag-control-row">
							<div className="ag-control-meta">
								<span className="ag-control-effective">{agent.advisor?.effective ?? "off"}</span>
								<span className="ag-badge ag-badge--source">{agent.advisor?.source ?? "none"}</span>
							</div>
							<div className="ag-control-actions">
								<div className="ag-segmented" role="radiogroup">
									<button
										type="button"
										className={`ag-segmented-btn${advisorSeg === "on" ? " ag-segmented-btn--active" : ""}`}
										onClick={() => onSetAdvisor(agent.name, "on")}
									>
										On
									</button>
									<button
										type="button"
										className={`ag-segmented-btn${advisorSeg === "off" ? " ag-segmented-btn--active" : ""}`}
										onClick={() => onSetAdvisor(agent.name, "off")}
									>
										Off
									</button>
									<button
										type="button"
										className={`ag-segmented-btn${advisorSeg === "custom" ? " ag-segmented-btn--active" : ""}`}
										onClick={() => {
											if (advisorSeg !== "custom") {
												setCustomAdvisor(agent.advisor?.effective ?? "");
											}
										}}
									>
										Custom
									</button>
								</div>
								{advisorSeg === "custom" && (
									<input
										type="text"
										className="ag-custom-input"
										placeholder="selector..."
										value={customAdvisor || (agent.advisor?.effective ?? "")}
										onChange={e => setCustomAdvisor(e.target.value)}
										onKeyDown={e => {
											if (e.key === "Enter") {
												onSetAdvisor(agent.name, e.currentTarget.value);
											}
										}}
									/>
								)}
								{agent.advisor?.source === "override" && (
									<button
										type="button"
										className="ag-btn-reset"
										onClick={() => onSetAdvisor(agent.name, null)}
									>
										Reset
									</button>
								)}
							</div>
						</div>
					</div>

					{/* Precedence list */}
					{agent.precedence?.entries && agent.precedence.entries.length > 0 && (
						<details className="ag-precedence" open>
							<summary className="ag-precedence-summary">Model Precedence</summary>
							<ol className="ag-precedence-list">
								{agent.precedence.entries.map((entry, idx) => {
									const isWinner = idx === agent.precedence.winner;
									return (
										<li
											key={`${entry.source}-${entry.selector}-${idx}`}
											className={`ag-precedence-entry${isWinner ? " ag-precedence-entry--winner" : ""}`}
										>
											{isWinner && <span className="ag-precedence-marker">&#x2713; </span>}
											<span>{describePrecedenceEntry(entry)}</span>
										</li>
									);
								})}
							</ol>
						</details>
					)}
				</div>
			)}
		</div>
	);
}
