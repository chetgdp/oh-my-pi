/**
 * Build the selector string the RPC expects for model role / agent
 * overrides: "provider/id" with an optional ":level" thinking suffix.
 */
import type { ThinkingLevel } from "@oh-my-pi/pi-agent-core";

export function toSelector(provider: string, id: string, thinkingLevel?: ThinkingLevel | null): string {
	const base = `${provider}/${id}`;
	return thinkingLevel ? `${base}:${thinkingLevel}` : base;
}
