import type { ToolResultMessage } from "@oh-my-pi/pi-wire";
import type { ReactNode } from "react";
import { memo } from "react";
import { messageText } from "./format";
import { type ToolRenderHost, ToolView } from "./tool-views";

export interface ToolCardProps {
	toolCallId: string;
	name: string;
	args: unknown;
	intent?: string;
	result?: ToolResultMessage;
	running?: boolean;
	partialResult?: unknown;
	liveDetails?: unknown;
	host?: ToolRenderHost;
	expandAll?: boolean;
	/** Total calls in a coalesced consecutive run. */
	groupCount?: number;
}

/** Wire-type adapter over the shared per-tool renderer stack. */
export const ToolCard = memo(function ToolCard(props: ToolCardProps): ReactNode {
	const { name, intent, args, result, running, partialResult, liveDetails, host, expandAll, groupCount } = props;
	const partial =
		running && !result ? (typeof partialResult === "string" ? partialResult : messageText(partialResult)) : "";
	return (
		<ToolView
			name={name}
			args={args}
			result={result}
			running={running}
			intent={intent}
			liveDetails={liveDetails}
			partial={partial || undefined}
			host={host}
			defaultOpen={expandAll ? true : undefined}
			groupCount={groupCount}
		/>
	);
});
