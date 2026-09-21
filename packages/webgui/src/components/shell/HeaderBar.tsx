import { Menu } from "lucide-react";
import type { ReactNode } from "react";

export interface HeaderBarProps {
	title: string;
	subtitle?: string;
	onOpenSessions: () => void;
	connection: "connecting" | "ready" | "closed";
}

export function HeaderBar({ title, subtitle, onOpenSessions, connection }: HeaderBarProps): ReactNode {
	return (
		<header className="sh-header">
			<div className="sh-header-left">
				<span className="sh-title">{title}</span>
				{subtitle != null && <span className="sh-subtitle">{subtitle}</span>}
			</div>
			<div className="sh-header-right">
				<span className={`sh-dot sh-dot-${connection}`} title={connection} />
				<button type="button" className="sh-sessions-btn" onClick={onOpenSessions} aria-label="Open sessions">
					<Menu size={14} />
				</button>
			</div>
		</header>
	);
}
