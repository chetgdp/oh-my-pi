import { afterEach, describe, expect, test, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { ContextUsage } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/types";
import {
	CONTEXT_PUSH_MIN_INTERVAL_MS,
	CONTEXT_PUSH_SETTLE_MS,
	RpcActivityClock,
	RpcContextUsagePush,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-activity";
import type { RpcContextUsageFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-fork-types";
import type { AgentSessionEvent } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { removeWithRetries, withTimeout } from "@oh-my-pi/pi-utils";

const toolStart = (toolCallId: string, toolName: string) =>
	({ type: "tool_execution_start", toolCallId, toolName, args: {} }) as AgentSessionEvent;
const toolEnd = (toolCallId: string) =>
	({ type: "tool_execution_end", toolCallId, toolName: "x", result: undefined, isError: false }) as AgentSessionEvent;
const messageEnd = { type: "message_end", message: { role: "assistant" } } as unknown as AgentSessionEvent;

describe("RpcActivityClock", () => {
	test("reports running tools with their start times until they end or the run ends", () => {
		const clock = new RpcActivityClock();
		const before = Date.now();
		clock.observe(toolStart("a", "bash"));
		clock.observe(toolStart("b", "read"));
		const after = Date.now();
		const tools = clock.activeTools();
		expect(tools.map(t => [t.toolCallId, t.toolName])).toEqual([
			["a", "bash"],
			["b", "read"],
		]);
		for (const tool of tools) {
			expect(tool.startedAt).toBeGreaterThanOrEqual(before);
			expect(tool.startedAt).toBeLessThanOrEqual(after);
		}
		// A repeated start (replay) keeps the original start time.
		const firstStart = tools[0].startedAt;
		clock.observe(toolStart("a", "bash"));
		expect(clock.activeTools()[0].startedAt).toBe(firstStart);

		clock.observe(toolEnd("a"));
		expect(clock.activeTools().map(t => t.toolCallId)).toEqual(["b"]);
		clock.observe({ type: "agent_end", messages: [] } as unknown as AgentSessionEvent);
		expect(clock.activeTools()).toEqual([]);
	});

	test("times auto-compaction from start to end", () => {
		const clock = new RpcActivityClock();
		expect(clock.compactionStartedAt).toBeUndefined();
		clock.observe({
			type: "auto_compaction_start",
			reason: "threshold",
			action: "context-full",
		} as AgentSessionEvent);
		expect(clock.compactionStartedAt).toBeNumber();
		clock.observe({ type: "auto_compaction_end", action: "context-full" } as unknown as AgentSessionEvent);
		expect(clock.compactionStartedAt).toBeUndefined();
	});
});

describe("RpcContextUsagePush", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test("coalesces a burst into one computation and sends only changes", () => {
		vi.useFakeTimers();
		let usage: ContextUsage = { tokens: 100, contextWindow: 1000, percent: 10 };
		let reads = 0;
		const frames: RpcContextUsageFrame[] = [];
		const push = new RpcContextUsagePush(
			() => {
				reads++;
				return usage;
			},
			frame => frames.push(frame),
		);
		try {
			push.observe(messageEnd);
			push.observe(toolEnd("a"));
			push.observe({ type: "turn_end" } as unknown as AgentSessionEvent);
			// Streaming deltas never schedule a computation.
			push.observe({ type: "message_update" } as unknown as AgentSessionEvent);
			vi.advanceTimersByTime(CONTEXT_PUSH_SETTLE_MS);
			expect(reads).toBe(1);
			expect(frames).toEqual([{ type: "context_usage", contextUsage: usage }]);

			// Within the interval the next computation waits; unchanged usage is not re-sent.
			push.observe(messageEnd);
			vi.advanceTimersByTime(CONTEXT_PUSH_SETTLE_MS);
			expect(reads).toBe(1);
			vi.advanceTimersByTime(CONTEXT_PUSH_MIN_INTERVAL_MS);
			expect(reads).toBe(2);
			expect(frames).toHaveLength(1);

			usage = { tokens: 300, contextWindow: 1000, percent: 30 };
			push.observe(messageEnd);
			vi.advanceTimersByTime(CONTEXT_PUSH_MIN_INTERVAL_MS);
			expect(frames.at(-1)).toEqual({ type: "context_usage", contextUsage: usage });
		} finally {
			push.dispose();
		}
	});

	test("does not echo the value a client just read through get_state", () => {
		vi.useFakeTimers();
		const usage: ContextUsage = { tokens: 5, contextWindow: 50, percent: 10 };
		const frames: RpcContextUsageFrame[] = [];
		const push = new RpcContextUsagePush(
			() => usage,
			frame => frames.push(frame),
		);
		try {
			push.noteSent(usage);
			push.observe(messageEnd);
			vi.advanceTimersByTime(CONTEXT_PUSH_MIN_INTERVAL_MS);
			expect(frames).toEqual([]);
		} finally {
			push.dispose();
		}
	});
});

describe("RPC wire: run timing and context push", () => {
	let directory: string | undefined;
	let child: Bun.Subprocess | undefined;

	afterEach(async () => {
		child?.kill();
		await child?.exited;
		child = undefined;
		if (directory) await removeWithRetries(directory);
		directory = undefined;
	});

	async function startAgent(script: string) {
		directory = await fs.mkdtemp(path.join(os.tmpdir(), "omp-rpc-activity-"));
		const proc = Bun.spawn(
			[process.execPath, path.join(import.meta.dir, "fixtures", "queued-message-rpc-agent.ts")],
			{
				cwd: directory,
				env: { ...process.env, PI_CODING_AGENT_DIR: directory, PI_NO_TITLE: "1", QUEUED_RPC_SCRIPT: script },
				stdin: "pipe",
				stdout: "pipe",
				stderr: "ignore",
			},
		);
		child = proc;
		const frames: Record<string, unknown>[] = [];
		const waiters: Array<{
			match: (f: Record<string, unknown>) => boolean;
			resolve: (f: Record<string, unknown>) => void;
		}> = [];
		void (async () => {
			const decoder = new TextDecoder();
			let buffer = "";
			for await (const chunk of proc.stdout) {
				buffer += decoder.decode(chunk, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) {
					if (!line.trim()) continue;
					const frame = JSON.parse(line) as Record<string, unknown>;
					frames.push(frame);
					for (let i = waiters.length - 1; i >= 0; i--) {
						if (waiters[i].match(frame)) waiters.splice(i, 1)[0].resolve(frame);
					}
				}
			}
		})();
		const waitFor = (match: (f: Record<string, unknown>) => boolean, label: string) => {
			const seen = frames.find(match);
			if (seen) return Promise.resolve(seen);
			const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
			waiters.push({ match, resolve });
			return withTimeout(promise, 15_000, label);
		};
		const send = (command: Record<string, unknown>) => {
			proc.stdin.write(`${JSON.stringify(command)}\n`);
			proc.stdin.flush();
		};
		await waitFor(f => f.type === "ready", "ready");
		return { frames, waitFor, send };
	}

	test("get_state reports the run start on the host clock while streaming", async () => {
		const agent = await startAgent("hold");
		agent.send({ id: "p", type: "prompt", message: "go" });
		await agent.waitFor(f => f.type === "agent_start", "agent_start");
		agent.send({ id: "s", type: "get_state", light: true });
		const response = await agent.waitFor(f => f.id === "s" && f.type === "response", "get_state");
		const data = response.data as { serverNow?: number; runStartedAt?: number; isStreaming: boolean };
		expect(data.isStreaming).toBe(true);
		expect(data.serverNow).toBeNumber();
		expect(data.runStartedAt).toBeNumber();
		expect(data.runStartedAt!).toBeLessThanOrEqual(data.serverNow!);
		agent.send({ id: "a", type: "abort" });
	}, 30_000);

	test("pushes context_usage after the run's messages land, without a get_state", async () => {
		const agent = await startAgent("");
		agent.send({ id: "p", type: "prompt", message: "go" });
		await agent.waitFor(f => f.type === "agent_end", "agent_end");
		const frame = await agent.waitFor(f => f.type === "context_usage", "context_usage");
		const usage = frame.contextUsage as ContextUsage;
		expect(usage.contextWindow).toBeGreaterThan(0);
		expect(usage.tokens).toBeGreaterThan(0);
		// Idle state carries the clock but no run start.
		agent.send({ id: "s", type: "get_state", light: true });
		const response = await agent.waitFor(f => f.id === "s" && f.type === "response", "get_state");
		const data = response.data as { serverNow?: number; runStartedAt?: number };
		expect(data.serverNow).toBeNumber();
		expect(data.runStartedAt).toBeUndefined();
	}, 30_000);
});
