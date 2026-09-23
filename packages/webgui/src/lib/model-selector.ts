/**
 * Build the selector string the RPC expects for model role / agent
 * overrides: "provider/id" with an optional ":level" thinking suffix.
 */
import type { ConfiguredThinkingLevel } from "./session-actions";

export function toSelector(provider: string, id: string, thinkingLevel?: ConfiguredThinkingLevel | null): string {
	const base = `${provider}/${id}`;
	return thinkingLevel ? `${base}:${thinkingLevel}` : base;
}
