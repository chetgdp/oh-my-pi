import type { ReactNode } from "react";

export interface PromptDockProps {
	/** Docked prompt surface (Clear); null shows the composer. */
	prompt: ReactNode | null;
	/** The composer. */
	children: ReactNode;
}

/**
 * Composer slot content: a docked prompt takes the composer's place. The composer stays mounted
 * (hidden) at a fixed tree position so its draft, caret and history survive the prompt.
 */
export function PromptDock({ prompt, children }: PromptDockProps): ReactNode {
	return (
		<>
			{prompt}
			<div className="sh-composer-hold" hidden={prompt !== null}>
				{children}
			</div>
		</>
	);
}
