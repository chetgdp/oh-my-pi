import type { ReactNode } from "react";

interface AppShellProps {
	topbar: ReactNode;
	sidebar?: ReactNode;
	inspector?: ReactNode;
	statusStrip?: ReactNode;
	composer: ReactNode;
	children: ReactNode;
}

export function AppShell({ topbar, sidebar, inspector, statusStrip, composer, children }: AppShellProps): ReactNode {
	return (
		<div className={sidebar || inspector ? "sh-app" : "sh-app sh-app--solo"}>
			<div className="sh-topbar">{topbar}</div>
			{sidebar && <div className="sh-sidebar">{sidebar}</div>}
			<div className="sh-main">
				<div className="sh-transcript">{children}</div>
				{statusStrip && <div className="sh-status-strip">{statusStrip}</div>}
			</div>
			<div className="sh-composer">{composer}</div>
			{inspector && <div className="sh-inspector">{inspector}</div>}
		</div>
	);
}
