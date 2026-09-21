import type { ReactNode } from "react";

export interface AppShellProps {
	header: ReactNode;
	children: ReactNode;
	composer: ReactNode;
}

export function AppShell({ header, children, composer }: AppShellProps): ReactNode {
	return (
		<div className="sh-app">
			{header}
			<div className="sh-transcript">{children}</div>
			<div className="sh-composer">{composer}</div>
		</div>
	);
}
