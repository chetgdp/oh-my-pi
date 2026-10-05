import { PanelLeft, PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { browserWindow } from "../../lib/dom";

interface AppShellProps {
	topbar: ReactNode;
	/** A function receives the collapse toggle to place in its own header, saving a row. */
	sidebar?: ReactNode | ((collapseToggle: ReactNode) => ReactNode);
	/** A function receives the collapse toggle to place in its own header, saving a row. */
	inspector?: ReactNode | ((collapseToggle: ReactNode) => ReactNode);
	statusStrip?: ReactNode;
	composer: ReactNode;
	children: ReactNode;
}

const SIDEBAR_KEY = "webgui.sidebarCollapsed";
const INSPECTOR_KEY = "webgui.inspectorCollapsed";

function readCollapsed(key: string): boolean {
	try {
		return browserWindow.localStorage.getItem(key) === "1";
	} catch {
		return false;
	}
}

function useCollapsed(key: string): [boolean, () => void] {
	const [collapsed, setCollapsed] = useState(() => readCollapsed(key));
	const toggle = useCallback(() => {
		setCollapsed(prev => {
			const next = !prev;
			try {
				if (next) browserWindow.localStorage.setItem(key, "1");
				else browserWindow.localStorage.removeItem(key);
			} catch {
				// Storage unavailable: the choice lasts until reload.
			}
			return next;
		});
	}, [key]);
	return [collapsed, toggle];
}

export function AppShell({ topbar, sidebar, inspector, statusStrip, composer, children }: AppShellProps): ReactNode {
	const [sidebarCollapsed, toggleSidebar] = useCollapsed(SIDEBAR_KEY);
	const [inspectorCollapsed, toggleInspector] = useCollapsed(INSPECTOR_KEY);
	const classes = ["sh-app"];
	if (!sidebar && !inspector) classes.push("sh-app--solo");
	else if (!inspector) classes.push("sh-app--no-inspector");
	if (sidebar && sidebarCollapsed) classes.push("sh-app--sidebar-collapsed");
	if (inspector && inspectorCollapsed) classes.push("sh-app--inspector-collapsed");
	const sidebarToggle = (
		<button
			type="button"
			className="sh-col-toggle"
			onClick={toggleSidebar}
			aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
			aria-expanded={!sidebarCollapsed}
			title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
		>
			<PanelLeft size={18} />
		</button>
	);
	const inspectorToggle = (
		<button
			type="button"
			className="sh-col-toggle"
			onClick={toggleInspector}
			aria-label={inspectorCollapsed ? "Expand panel" : "Collapse panel"}
			aria-expanded={!inspectorCollapsed}
			title={inspectorCollapsed ? "Expand panel" : "Collapse panel"}
		>
			<PanelRight size={18} />
		</button>
	);

	return (
		<div className={classes.join(" ")}>
			<div className="sh-topbar">{topbar}</div>
			{sidebar && (
				<div className="sh-sidebar">
					{(sidebarCollapsed || typeof sidebar !== "function") && (
						<div className="sh-col-head sh-col-head--left">
							<span className="sh-col-title">ompgui</span>
							{sidebarToggle}
						</div>
					)}
					<div className="sh-col-body">{typeof sidebar === "function" ? sidebar(sidebarToggle) : sidebar}</div>
				</div>
			)}
			<div className="sh-main">
				<div className="sh-transcript">{children}</div>
				{statusStrip && <div className="sh-status-strip">{statusStrip}</div>}
			</div>
			<div className="sh-composer">{composer}</div>
			{inspector && (
				<div className="sh-inspector">
					{(inspectorCollapsed || typeof inspector !== "function") && (
						<div className="sh-col-head sh-col-head--right">{inspectorToggle}</div>
					)}
					<div className="sh-col-body">
						{typeof inspector === "function" ? inspector(inspectorToggle) : inspector}
					</div>
				</div>
			)}
		</div>
	);
}
