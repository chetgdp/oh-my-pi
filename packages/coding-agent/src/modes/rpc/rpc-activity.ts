/**
 * Server-side timing and context-usage push for RPC clients.
 *
 * Clients that attach mid-run (page reload, reconnect, a second device) cannot
 * see when the run, the running tools, or a compaction started; `get_state`
 * reports those start times from {@link RpcActivityClock} together with the
 * host's `serverNow`, so clients compute elapsed time as `serverNow - startedAt`
 * and never compare the host clock with their own.
 *
 * {@link RpcContextUsagePush} pushes `context_usage` frames when context usage
 * changes mid-run, coalesced so a burst of events costs one computation.
 */
import type { ContextUsage } from "../../extensibility/extensions/types";
import type { AgentSession, AgentSessionEvent } from "../../session/agent-session";
import type { RpcActiveToolTiming, RpcContextUsageFrame } from "./rpc-fork-types";

/** Tracks start times of running tools and compaction for one session, across RPC connections. */
export class RpcActivityClock {
	readonly #tools = new Map<string, RpcActiveToolTiming>();
	#compactionStartedAt: number | undefined;

	observe(event: AgentSessionEvent): void {
		switch (event.type) {
			case "tool_execution_start":
				if (!this.#tools.has(event.toolCallId)) {
					this.#tools.set(event.toolCallId, {
						toolCallId: event.toolCallId,
						toolName: event.toolName,
						startedAt: Date.now(),
					});
				}
				return;
			case "tool_execution_end":
				this.#tools.delete(event.toolCallId);
				return;
			case "agent_end":
				this.#tools.clear();
				return;
			case "auto_compaction_start":
				this.#compactionStartedAt = Date.now();
				return;
			case "auto_compaction_end":
				this.#compactionStartedAt = undefined;
				return;
		}
	}

	/** Running tools, oldest first. */
	activeTools(): RpcActiveToolTiming[] {
		return [...this.#tools.values()];
	}

	get compactionStartedAt(): number | undefined {
		return this.#compactionStartedAt;
	}
}

const clocks = new WeakMap<AgentSession, RpcActivityClock>();

/**
 * The session's clock, subscribed on first use. Hosts call this when they adopt
 * the session so a run started before the first client connects is still timed.
 */
export function getRpcActivityClock(session: AgentSession): RpcActivityClock {
	let clock = clocks.get(session);
	if (!clock) {
		const created = new RpcActivityClock();
		session.subscribe(event => created.observe(event));
		clocks.set(session, created);
		clock = created;
	}
	return clock;
}

/** Events after which context usage can have changed. */
const CONTEXT_EVENTS: Record<string, true> = {
	message_end: true,
	tool_execution_end: true,
	turn_end: true,
	agent_end: true,
	auto_compaction_end: true,
};

/** Shortest gap between two computations; also the coalescing window for event bursts. */
export const CONTEXT_PUSH_MIN_INTERVAL_MS = 1000;
/** Delay after the first event of a burst, so `message_end` + `turn_end` + `agent_end` share one computation. */
export const CONTEXT_PUSH_SETTLE_MS = 100;

/**
 * Per-connection `context_usage` pusher. Context usage is computed at most once
 * per {@link CONTEXT_PUSH_MIN_INTERVAL_MS} and only after events that change it
 * (never per streamed token); a frame is sent only when the value changed.
 */
export class RpcContextUsagePush {
	readonly #read: () => ContextUsage | undefined;
	readonly #output: (frame: RpcContextUsageFrame) => void;
	#timer: NodeJS.Timeout | undefined;
	#lastComputedAt = Number.NEGATIVE_INFINITY;
	#lastKey: string | undefined;

	constructor(read: () => ContextUsage | undefined, output: (frame: RpcContextUsageFrame) => void) {
		this.#read = read;
		this.#output = output;
	}

	/** Seed with the value a client just read via `get_state`, so an unchanged value is not echoed. */
	noteSent(usage: ContextUsage | undefined): void {
		if (usage) this.#lastKey = `${usage.tokens}/${usage.contextWindow}`;
	}

	observe(event: AgentSessionEvent): void {
		if (!Object.hasOwn(CONTEXT_EVENTS, event.type) || this.#timer !== undefined) return;
		const wait = Math.max(CONTEXT_PUSH_SETTLE_MS, this.#lastComputedAt + CONTEXT_PUSH_MIN_INTERVAL_MS - Date.now());
		this.#timer = setTimeout(() => this.#flush(), wait);
	}

	dispose(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}

	#flush(): void {
		this.#timer = undefined;
		this.#lastComputedAt = Date.now();
		const usage = this.#read();
		if (!usage) return;
		const key = `${usage.tokens}/${usage.contextWindow}`;
		if (key === this.#lastKey) return;
		this.#lastKey = key;
		this.#output({ type: "context_usage", contextUsage: usage });
	}
}
