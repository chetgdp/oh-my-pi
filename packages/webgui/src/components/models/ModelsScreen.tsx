import { useState, type ReactNode } from "react";
import type { SessionSnapshot } from "../../lib/session-store";
import type { ActiveSectionProps, AgentsSectionProps, ProvidersSectionProps, RolesSectionProps } from "./contract";
import { ActiveSection } from "./ActiveSection";
import { RolesSection } from "./RolesSection";
import { AgentsSection } from "./AgentsSection";
import { ProvidersSection } from "./ProvidersSection";
import { ChevronDown, ChevronRight } from "lucide-react";
import "./models.css";

export interface ModelsScreenProps {
	snap?: SessionSnapshot;
	active: ActiveSectionProps;
	roles: RolesSectionProps;
	agents: AgentsSectionProps;
	providers: ProvidersSectionProps;
	collapsed?: Record<string, boolean>;
	onToggleSection?(section: string): void;
}

export function ModelsScreen({
	active,
	roles,
	agents,
	providers,
	collapsed: controlledCollapsed,
	onToggleSection,
}: ModelsScreenProps): ReactNode {
	const [internalCollapsed, setInternalCollapsed] = useState<Record<string, boolean>>({
		active: false,
		roles: false,
		agents: false,
		providers: false,
	});

	const collapsed = controlledCollapsed ?? internalCollapsed;
	const handleToggle = (section: string) => {
		if (onToggleSection) {
			onToggleSection(section);
		} else {
			setInternalCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
		}
	};

	return (
		<div className="md-screen">
			{/* 1. Active Section */}
			<section className="md-section-collapsible">
				<button
					type="button"
					className="md-section-header"
					onClick={() => handleToggle("active")}
					aria-expanded={!collapsed.active}
				>
					<span className="md-section-title">Active</span>
					<span className="md-section-chevron">
						{collapsed.active ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
					</span>
				</button>
				{!collapsed.active && (
					<div className="md-section-body">
						<ActiveSection {...active} />
					</div>
				)}
			</section>

			{/* 2. Roles Section */}
			<section className="md-section-collapsible">
				<button
					type="button"
					className="md-section-header"
					onClick={() => handleToggle("roles")}
					aria-expanded={!collapsed.roles}
				>
					<span className="md-section-title">Roles</span>
					<span className="md-section-chevron">
						{collapsed.roles ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
					</span>
				</button>
				{!collapsed.roles && (
					<div className="md-section-body">
						<RolesSection {...roles} />
					</div>
				)}
			</section>

			{/* 3. Agents Section */}
			<section className="md-section-collapsible">
				<button
					type="button"
					className="md-section-header"
					onClick={() => handleToggle("agents")}
					aria-expanded={!collapsed.agents}
				>
					<span className="md-section-title">Agents</span>
					<span className="md-section-chevron">
						{collapsed.agents ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
					</span>
				</button>
				{!collapsed.agents && (
					<div className="md-section-body">
						<AgentsSection {...agents} />
					</div>
				)}
			</section>

			{/* 4. Providers Section */}
			<section className="md-section-collapsible">
				<button
					type="button"
					className="md-section-header"
					onClick={() => handleToggle("providers")}
					aria-expanded={!collapsed.providers}
				>
					<span className="md-section-title">Providers</span>
					<span className="md-section-chevron">
						{collapsed.providers ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
					</span>
				</button>
				{!collapsed.providers && (
					<div className="md-section-body">
						<ProvidersSection {...providers} />
					</div>
				)}
			</section>
		</div>
	);
}
