import { logger } from "@oh-my-pi/pi-utils";
import type { AgentProgress } from "@oh-my-pi/pi-tui/tools/task";
import type { AgentRegistryFrame, AgentRosterEntry } from "@oh-my-pi/pi-wire";
import { progressMetrics } from "@oh-my-pi/pi-tui/overlays/agent-hub-projection";
import type { AgentMetricsSummary } from "@oh-my-pi/pi-tui/overlays/agent-hub-types";
import type { ObservableSession } from "@oh-my-pi/pi-tui/overlays/session-observer-registry";
import { IrcBus } from "../../irc/bus";
import { AgentLifecycleManager } from "../../registry/agent-lifecycle";
import { type AgentRef, AgentRegistry, MAIN_AGENT_ID, type RegistryEvent } from "../../registry/agent-registry";
import { registerPersistedSubagents } from "../../registry/persisted-agents";
import { USER_INTERRUPT_LABEL } from "../../session/messages";
import type { RpcSubagentRegistry } from "./rpc-subagents";
import type { RpcSubagentSnapshot } from "./rpc-types";

/** Per-id frame coalescing window; progress events arrive far faster than a UI can use. */
const ROSTER_FRAME_COALESCE_MS = 150;

type RosterFrameOutput = (frame: AgentRegistryFrame) => void;

/** Session file backing a registry agent id, or undefined when unknown or transcript-less. Advisors are observable. */
export function resolveRegistryAgentSessionFile(agentId: string): string | undefined {
	return AgentRegistry.global().get(agentId)?.sessionFile ?? undefined;
}

function toRosterMetrics(metrics: AgentMetricsSummary | undefined): AgentRosterEntry["metrics"] {
	if (!metrics) return undefined;
	const { tokens, requests, tools, cost, durationMs, contextTokens, contextWindow } = metrics;
	return { tokens, requests, tools, cost, durationMs, contextTokens, contextWindow };
}

function metricsFor(ref: AgentRef, progress: AgentProgress | undefined): AgentMetricsSummary | undefined {
	if (progress) {
		const observed: ObservableSession = {
			id: ref.id,
			kind: "subagent",
			label: ref.displayName,
			status: "active",
			lastUpdate: ref.lastActivity,
			progress,
		};
		const fromProgress = progressMetrics(observed);
		if (fromProgress) return fromProgress;
	}
	return ref.history?.metrics;
}

export function buildRosterEntry(ref: AgentRef, snapshot: RpcSubagentSnapshot | undefined): AgentRosterEntry {
	const progress = snapshot?.progress;
	const sessionFile = ref.sessionFile ?? snapshot?.sessionFile ?? undefined;
	const irc = IrcBus.global().unreadCount(ref.id);
	return {
		id: ref.id,
		displayName: ref.displayName,
		kind: ref.kind === "main" ? "main" : "sub",
		parentId: ref.parentId,
		status: ref.status,
		agent: ref.history?.agent ?? snapshot?.agent,
		description: snapshot?.description ?? progress?.description,
		task: snapshot?.task ?? progress?.task,
		activity: ref.activity,
		sessionFile,
		createdAt: ref.createdAt,
		lastActivity: ref.lastActivity,
		detached: snapshot?.detached,
		modelRole: progress?.modelRole ?? ref.history?.modelRole,
		resolvedModel: progress?.resolvedModel ?? ref.history?.resolvedModel,
		metrics: toRosterMetrics(metricsFor(ref, progress)),
		progress,
		outputPath: ref.history?.outputPath,
		patchPath: ref.history?.patchPath,
		branchName: ref.history?.branchName,
		unreadIrc: irc > 0 ? irc : undefined,
	};
}

/**
 * Rejects ids the mutating agent commands must never touch: unknown agents,
 * the main session, and advisor transcripts (read-only observability refs).
 */
function requireControllableAgent(agentId: unknown, action: string, opts: { allowAborted: boolean }): AgentRef {
	if (typeof agentId !== "string" || agentId.length === 0) throw new Error(`${action} requires agentId`);
	if (agentId === MAIN_AGENT_ID) throw new Error(`Cannot ${action} the main agent`);
	const ref = AgentRegistry.global().get(agentId);
	if (!ref) throw new Error(`Unknown agent: ${agentId}`);
	if (ref.kind === "advisor") throw new Error(`"${agentId}" is a read-only advisor transcript`);
	if (ref.kind === "main") throw new Error(`Cannot ${action} the main agent`);
	if (!opts.allowAborted && ref.status === "aborted") throw new Error(`Agent "${agentId}" was killed`);
	return ref;
}

export async function killRpcAgent(agentId: string): Promise<void> {
	const ref = requireControllableAgent(agentId, "kill_agent", { allowAborted: true });
	if (ref.status === "running" && ref.session) {
		await ref.session.abort({ reason: USER_INTERRUPT_LABEL });
	}
	const released = await AgentLifecycleManager.global().release(ref.id, ref, { tombstone: true });
	if (!released) throw new Error(`Agent "${agentId}" could not be released`);
}

export async function reviveRpcAgent(agentId: string): Promise<void> {
	const ref = requireControllableAgent(agentId, "revive_agent", { allowAborted: false });
	await AgentLifecycleManager.global().ensureLive(ref.id);
}

export async function steerRpcAgent(agentId: string, message: unknown): Promise<void> {
	const ref = requireControllableAgent(agentId, "steer_agent", { allowAborted: false });
	if (typeof message !== "string" || message.trim().length === 0) throw new Error("steer_agent requires a message");
	const session = await AgentLifecycleManager.global().ensureLive(ref.id);
	// An idle agent runs the whole turn inside prompt(); the command reports acceptance, not completion.
	void session.prompt(message.trim(), { streamingBehavior: "steer" }).catch((error: unknown) => {
		logger.warn("steer_agent prompt failed", { id: ref.id, error: String(error) });
	});
}

/** One RPC connection's roster snapshot and opt-in change stream. */
export class RpcAgentRoster {
	#output: RosterFrameOutput;
	#subagents: RpcSubagentRegistry | undefined;
	#sessionFile: () => string | undefined;
	#enabled = false;
	#unsubscribes: Array<() => void> = [];
	#timers = new Map<string, Timer>();
	#scannedRoot: string | undefined;

	constructor(
		output: RosterFrameOutput,
		subagents: RpcSubagentRegistry | undefined,
		sessionFile: () => string | undefined,
	) {
		this.#output = output;
		this.#subagents = subagents;
		this.#sessionFile = sessionFile;
	}

	#snapshotsById(): Map<string, RpcSubagentSnapshot> {
		return new Map((this.#subagents?.getSubagents() ?? []).map(snapshot => [snapshot.id, snapshot]));
	}

	async getRoster(): Promise<AgentRosterEntry[]> {
		const registry = AgentRegistry.global();
		const root = this.#sessionFile();
		if (root && root !== this.#scannedRoot) {
			this.#scannedRoot = root;
			try {
				await registerPersistedSubagents(registry, root);
			} catch (error) {
				this.#scannedRoot = undefined;
				logger.warn("get_agent_roster: persisted subagent scan failed", { error: String(error) });
			}
		}
		const snapshots = this.#snapshotsById();
		return registry
			.list()
			.filter(ref => ref.kind !== "advisor")
			.map(ref => buildRosterEntry(ref, snapshots.get(ref.id)));
	}

	get enabled(): boolean {
		return this.#enabled;
	}

	setEnabled(enabled: boolean): void {
		if (enabled === this.#enabled) return;
		this.#enabled = enabled;
		if (!enabled) {
			this.#stop();
			return;
		}
		this.#unsubscribes.push(AgentRegistry.global().onChange((event: RegistryEvent) => this.#schedule(event.ref.id)));
		if (this.#subagents) {
			this.#unsubscribes.push(
				this.#subagents.addSink({
					lifecycle: payload => this.#schedule(payload.id),
					progress: payload => this.#schedule(payload.progress.id),
					event: () => {},
				}),
			);
		}
	}

	#schedule(id: string): void {
		if (this.#timers.has(id)) return;
		this.#timers.set(
			id,
			setTimeout(() => {
				this.#timers.delete(id);
				this.#flush(id);
			}, ROSTER_FRAME_COALESCE_MS),
		);
	}

	#flush(id: string): void {
		if (!this.#enabled) return;
		const ref = AgentRegistry.global().get(id);
		if (!ref) {
			this.#output({ type: "agent_registry", op: "removed", id });
			return;
		}
		if (ref.kind === "advisor") return;
		this.#output({
			type: "agent_registry",
			op: "upsert",
			agent: buildRosterEntry(ref, this.#snapshotsById().get(id)),
		});
	}

	#stop(): void {
		for (const unsubscribe of this.#unsubscribes) unsubscribe();
		this.#unsubscribes = [];
		for (const timer of this.#timers.values()) clearTimeout(timer);
		this.#timers.clear();
	}

	dispose(): void {
		this.#enabled = false;
		this.#stop();
	}
}
