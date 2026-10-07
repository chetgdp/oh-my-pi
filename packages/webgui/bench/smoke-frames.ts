/**
 * Smoke test bench feeding `PRESETS.long` through real session-store / transcript-model
 * reducers headless and asserting that transcript entry count == expected and no reducer throws.
 */

import "../test/dom-setup";
import { generateSession, PRESETS } from "./lib/session-frames";
import { createSessionStore } from "../src/lib/session-store";
import type { RpcConnectionState, RpcSessionEvent } from "../src/lib/rpc-client";
import type { RpcServerSessionState } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import type { RpcV3HistoryResult } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-v3-types";

// Headless harness client mocking the RPC client wire interface for session-store
class HeadlessHarnessClient {
	state: RpcConnectionState = "ready";
	sessionState: RpcServerSessionState;
	#eventListeners: Array<(e: RpcSessionEvent) => void> = [];
	#stateListeners: Array<(s: RpcConnectionState) => void> = [];
	#resyncListeners: Array<(s: RpcServerSessionState) => void> = [];
	#historyResult: RpcV3HistoryResult;
	#roster: unknown[];

	constructor(sessionState: RpcServerSessionState, historyResult: RpcV3HistoryResult, roster: unknown[]) {
		this.sessionState = sessionState;
		this.#historyResult = historyResult;
		this.#roster = roster;
	}

	history(
		_opts: { before?: string; after?: string; leafId?: string; limit?: number } = {},
	): Promise<RpcV3HistoryResult> {
		return Promise.resolve(this.#historyResult);
	}

	request(cmd: { type: string }): Promise<unknown> {
		switch (cmd.type) {
			case "get_state":
				return Promise.resolve({ data: this.sessionState });
			case "get_agent_roster":
				return Promise.resolve({ data: { agents: this.#roster } });
			case "get_available_commands":
				return Promise.resolve({ data: { commands: [] } });
			case "get_plan_state":
				return Promise.resolve({ data: { state: null, review: null } });
			case "set_subagent_subscription":
			case "set_agent_roster_subscription":
				return Promise.resolve({ data: {} });
			default:
				return Promise.resolve({ data: {} });
		}
	}

	onEvent(fn: (e: RpcSessionEvent) => void): () => void {
		this.#eventListeners.push(fn);
		return () => {
			const i = this.#eventListeners.indexOf(fn);
			if (i !== -1) this.#eventListeners.splice(i, 1);
		};
	}

	onStateChange(fn: (s: RpcConnectionState) => void): () => void {
		this.#stateListeners.push(fn);
		return () => {
			const i = this.#stateListeners.indexOf(fn);
			if (i !== -1) this.#stateListeners.splice(i, 1);
		};
	}

	onResync(fn: (s: RpcServerSessionState) => void): () => void {
		this.#resyncListeners.push(fn);
		return () => {
			const i = this.#resyncListeners.indexOf(fn);
			if (i !== -1) this.#resyncListeners.splice(i, 1);
		};
	}

	emitFrame(frame: RpcSessionEvent): void {
		for (const fn of this.#eventListeners) fn(frame);
	}
}

async function runSmoke(): Promise<void> {
	console.log("Generating synthetic session with PRESETS.long...");
	const t0 = Bun.nanoseconds();
	const generated = generateSession(PRESETS.long);
	const genMs = (Bun.nanoseconds() - t0) / 1e6;
	console.log(`Generated in ${genMs.toFixed(2)}ms:`);
	console.log(`- History entries: ${generated.history.historyResult.entries.length}`);
	console.log(`- Stream raw JSON lines: ${generated.stream.length}`);

	// Create headless client & session store
	const client = new HeadlessHarnessClient(
		generated.history.sessionState,
		generated.history.historyResult,
		generated.history.roster,
	);

	const store = createSessionStore(client as never);

	// Let attach sequence complete
	for (let i = 0; i < 20; i++) await Promise.resolve();

	const initialSnap = store.getSnapshot();
	console.log(`Attached snapshot entries count: ${initialSnap.transcript.entries.length}`);
	if (initialSnap.transcript.entries.length !== generated.history.historyResult.entries.length) {
		throw new Error(
			`History entries mismatch: expected ${generated.history.historyResult.entries.length}, got ${initialSnap.transcript.entries.length}`,
		);
	}

	console.log(`Pumping ${generated.stream.length} raw JSON-line frames through reducers...`);
	const pumpStart = Bun.nanoseconds();
	let framesProcessed = 0;

	for (const rawLine of generated.stream) {
		const trimmed = rawLine.trim();
		if (!trimmed) continue;
		const parsed = JSON.parse(trimmed) as RpcSessionEvent;
		client.emitFrame(parsed);
		framesProcessed++;
	}

	const pumpMs = (Bun.nanoseconds() - pumpStart) / 1e6;
	console.log(
		`Pumped ${framesProcessed} frames in ${pumpMs.toFixed(2)}ms (${((pumpMs / framesProcessed) * 1000).toFixed(1)}µs/frame).`,
	);

	const finalSnap = store.getSnapshot();
	const finalCount = finalSnap.transcript.entries.length;
	console.log(`Final snapshot transcript entries: ${finalCount} (expected: ${PRESETS.long.entries})`);

	if (finalCount !== PRESETS.long.entries) {
		throw new Error(`Final transcript entry count mismatch: expected ${PRESETS.long.entries}, got ${finalCount}`);
	}

	console.log("Smoke verification succeeded: all reducers ran without errors, entry count matched exactly.");
}

runSmoke().catch(err => {
	console.error("Smoke test failed:", err);
	process.exit(1);
});
