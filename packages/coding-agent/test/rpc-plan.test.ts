import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { PassThrough, Readable } from "node:stream";
import type { CompactOptions } from "../src/extensibility/extensions/types";
import { resolveLocalUrlToPath } from "../src/internal-urls";
import type { AgentToolResult } from "@oh-my-pi/pi-agent-core";
import type { CompactionResult } from "@oh-my-pi/pi-agent-core/compaction";
import type { Model } from "@oh-my-pi/pi-ai";
import { Settings } from "../src/config/settings";
import { getRpcPlanCoordinator, type RpcPlanTuiDelegate } from "../src/modes/rpc/rpc-plan";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import type { RpcPlanReview, RpcPlanReviewAction, RpcPlanState } from "../src/modes/rpc/rpc-types";
import type { PlanApprovalDetails } from "../src/plan-mode/approved-plan";
import type { PlanModeState } from "../src/plan-mode/state";
import type { AgentSession } from "../src/session/agent-session";
import type { AgentSessionEvent } from "../src/session/agent-session-events";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";

interface PlanHarnessOptions {
	planEnabled?: boolean;
	hasTui?: boolean;
	initialPlanState?: PlanModeState;
}

interface TestPlanHarness {
	session: AgentSession;
	sessionManager: SessionManager;
	tuiDelegate?: RpcPlanTuiDelegate & {
		enabled: boolean;
		paused: boolean;
		planFilePath: string | undefined;
		dismissedCount: number;
		answeredCalls: Array<{ action: RpcPlanReviewAction; feedback?: string }>;
	};
	planProposalHandler?: ((title: string) => Promise<AgentToolResult<PlanApprovalDetails>>) | null;
	compactCalls: string[];
	compactOptionsCalls: CompactOptions[];
	promptCalls: Array<{ message: string; options?: { synthetic?: boolean } }>;
	writePlanFile(planFilePath: string, content: string): Promise<void>;
	sendCommand(cmd: Record<string, unknown>): Promise<Record<string, unknown>>;
	waitForFrame(predicate: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>>;
	getFrames(): Record<string, unknown>[];
	attachSecondClient(): {
		sendCommand(cmd: Record<string, unknown>): Promise<Record<string, unknown>>;
		waitForFrame(predicate: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>>;
		close(): void;
	};
	close(): void;
}

const fakeModel: Model = {
	provider: "anthropic",
	id: "claude-sonnet-4-20250514",
	name: "Claude Sonnet 4",
	contextWindow: 200_000,
	maxOutputTokens: 16_384,
	supportsImages: true,
	supportsPromptCaching: true,
	inputPrice: 3,
	outputPrice: 15,
	cacheWritePrice: 3.75,
	cacheReadPrice: 0.3,
} as unknown as Model;

interface PlanReviewFrame {
	type: "plan_review";
	review: RpcPlanReview | null;
}

interface PlanStateFrame {
	type: "plan_state";
	state: RpcPlanState;
}

interface ApprovePlanResponse {
	id?: string;
	type: "response";
	command: "approve_plan";
	success: boolean;
	data?: { state: RpcPlanState };
	error?: string;
	code?: string;
}

function createPlanHarness(options: PlanHarnessOptions = {}): TestPlanHarness {
	const storage = new MemorySessionStorage();
	const sessionManager = SessionManager.create("/tmp/test-project", "/tmp/test-project", storage);

	const settings = Settings.isolated({
		"plan.enabled": options.planEnabled ?? true,
	} as never);

	let currentPlanState: PlanModeState | undefined = options.initialPlanState;
	let proposalHandler: ((title: string) => Promise<AgentToolResult<PlanApprovalDetails>>) | null = null;
	let currentReferencePath = "";
	const compactCalls: string[] = [];
	const compactOptionsCalls: CompactOptions[] = [];
	const promptCalls: Array<{ message: string; options?: { synthetic?: boolean } }> = [];
	const listeners = new Set<(event: AgentSessionEvent) => void>();

	const sessionStub = {
		sessionManager,
		settings,
		model: fakeModel,
		isStreaming: false,
		agent: { state: { streamMessage: null, tools: [] } },
		subscribe(fn: (event: AgentSessionEvent) => void) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		emit(event: AgentSessionEvent) {
			for (const listener of listeners) {
				listener(event);
			}
		},
		subscribeCommandMetadataChanged() {
			return () => {};
		},
		registerPersistenceFailureCallback() {
			return () => {};
		},
		setSlashCommands() {},
		isFastModeEnabled: () => false,
		isFastModeActive: () => false,
		getTodoPhases: () => [],
		setTodoPhases: () => {},
		getPlanModeState: () => currentPlanState,
		setPlanModeState: (state: PlanModeState | undefined) => {
			currentPlanState = state;
		},
		setPlanProposalHandler: (handler: ((title: string) => Promise<AgentToolResult<PlanApprovalDetails>>) | null) => {
			proposalHandler = handler;
		},
		getPlanReferencePath: () => currentReferencePath,
		setPlanReferencePath: (path: string) => {
			currentReferencePath = path;
		},
		markPlanReferenceSent: () => {},
		markPlanInternalAbortPending: () => {},
		clearPlanInternalAbortPending: () => {},
		configuredThinkingLevel: () => undefined,
		resolveRoleModelWithThinking: (_role: string) => ({
			model: fakeModel,
			thinkingLevel: undefined,
			explicitThinkingLevel: false,
		}),
		setModelTemporary: async () => {},
		setThinkingLevel: () => {},
		compact: async (instructions?: string, options?: CompactOptions): Promise<CompactionResult> => {
			if (instructions) compactCalls.push(instructions);
			if (options) compactOptionsCalls.push(options);
			return {
				summary: "Compacted session",
				firstKeptEntryId: "entry-1",
				tokensBefore: 1000,
			};
		},
		prompt: async (message: string, promptOptions?: { synthetic?: boolean }) => {
			promptCalls.push({ message, options: promptOptions });
		},
		followUp: async (message: string, _images?: unknown, promptOptions?: { synthetic?: boolean }) => {
			promptCalls.push({ message, options: promptOptions });
		},
		abort: async () => {
			sessionStub.emit({ type: "turn_end", isTerminal: true } as unknown as AgentSessionEvent);
		},
		state: {
			sessionId: sessionManager.getSessionId(),
			cwd: sessionManager.getCwd(),
			model: "test-model",
			thinkingLevel: null,
			fastMode: false,
			fastModeModel: null,
			autonomyLevel: "default",
			steeringMode: "steer",
			followUpMode: "followUp",
			interruptMode: "interrupt",
		},
		messages: [],
		extensions: [],
		skills: [],
		skillsSettings: null,
		customCommands: [],
		mcpPromptCommands: [],
		stats: { duration: 0 },
	};

	let tuiDelegate:
		| (RpcPlanTuiDelegate & {
				enabled: boolean;
				paused: boolean;
				planFilePath: string | undefined;
				dismissedCount: number;
				answeredCalls: Array<{ action: RpcPlanReviewAction; feedback?: string }>;
		  })
		| undefined;

	if (options.hasTui) {
		tuiDelegate = {
			enabled: options.initialPlanState?.enabled ?? false,
			paused: false,
			planFilePath: options.initialPlanState?.planFilePath,
			dismissedCount: 0,
			answeredCalls: [],
			isPlanModeEnabled() {
				return this.enabled;
			},
			isPlanModePaused() {
				return this.paused;
			},
			getPlanFilePath() {
				return this.planFilePath;
			},
			async enterPlanMode(opts) {
				this.enabled = true;
				this.paused = false;
				this.planFilePath = opts?.planFilePath ?? "local://PLAN.md";
			},
			async exitPlanMode(opts) {
				this.enabled = false;
				this.paused = opts?.paused ?? false;
				this.planFilePath = undefined;
			},
			dismissPlanReview() {
				this.dismissedCount++;
			},
			answerPlanReview(action, feedback) {
				this.answeredCalls.push({ action, feedback });
				return true;
			},
		};
		const coordinator = getRpcPlanCoordinator(sessionStub as unknown as AgentSession);
		coordinator.setTuiDelegate(tuiDelegate);
	}

	const input = new PassThrough();
	const output = new PassThrough();
	const frames: Record<string, unknown>[] = [];
	const waiters: Array<{
		predicate: (f: Record<string, unknown>) => boolean;
		resolve: (f: Record<string, unknown>) => void;
	}> = [];

	let buffer = "";
	output.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			const parsed = JSON.parse(line) as Record<string, unknown>;
			frames.push(parsed);
			for (let i = waiters.length - 1; i >= 0; i--) {
				if (waiters[i].predicate(parsed)) {
					const [matched] = waiters.splice(i, 1);
					matched.resolve(parsed);
				}
			}
		}
	});

	const server = serveRpc(
		sessionStub as unknown as AgentSession,
		{ input: Readable.toWeb(input) as ReadableStream<Uint8Array>, output },
		{ onShutdown: () => {}, onWriteFailure: () => {} },
	);

	function sendCommand(cmd: Record<string, unknown>): Promise<Record<string, unknown>> {
		const id = (cmd.id as string) ?? `cmd_${Math.random().toString(36).slice(2)}`;
		const fullCmd = { ...cmd, id };
		const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
		waiters.push({ predicate: f => f.id === id, resolve });
		input.write(`${JSON.stringify(fullCmd)}\n`);
		return promise;
	}

	function waitForFrame(predicate: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
		const existing = frames.find(predicate);
		if (existing) return Promise.resolve(existing);
		const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
		waiters.push({ predicate, resolve });
		return promise;
	}

	function attachSecondClient() {
		const clientInput = new PassThrough();
		const clientOutput = new PassThrough();
		const clientFrames: Record<string, unknown>[] = [];
		const clientWaiters: Array<{
			predicate: (f: Record<string, unknown>) => boolean;
			resolve: (f: Record<string, unknown>) => void;
		}> = [];

		let clientBuffer = "";
		clientOutput.on("data", (chunk: Buffer) => {
			clientBuffer += chunk.toString("utf8");
			const lines = clientBuffer.split("\n");
			clientBuffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim()) continue;
				const parsed = JSON.parse(line) as Record<string, unknown>;
				clientFrames.push(parsed);
				for (let i = clientWaiters.length - 1; i >= 0; i--) {
					if (clientWaiters[i].predicate(parsed)) {
						const [matched] = clientWaiters.splice(i, 1);
						matched.resolve(parsed);
					}
				}
			}
		});

		const clientServer = serveRpc(
			sessionStub as unknown as AgentSession,
			{ input: Readable.toWeb(clientInput) as ReadableStream<Uint8Array>, output: clientOutput },
			{ onShutdown: () => {}, onWriteFailure: () => {} },
		);

		return {
			sendCommand(cmd: Record<string, unknown>): Promise<Record<string, unknown>> {
				const id = (cmd.id as string) ?? `cmd_${Math.random().toString(36).slice(2)}`;
				const fullCmd = { ...cmd, id };
				const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
				clientWaiters.push({ predicate: f => f.id === id, resolve });
				clientInput.write(`${JSON.stringify(fullCmd)}\n`);
				return promise;
			},
			waitForFrame(predicate: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
				const existing = clientFrames.find(predicate);
				if (existing) return Promise.resolve(existing);
				const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
				clientWaiters.push({ predicate, resolve });
				return promise;
			},
			close() {
				clientInput.end();
				clientServer.close();
			},
		};
	}

	async function writePlanFile(planFilePath: string, content: string): Promise<void> {
		const filePath = resolveLocalUrlToPath(planFilePath, {
			getArtifactsDir: () => sessionManager.getArtifactsDir(),
			getSessionId: () => sessionManager.getSessionId(),
		});
		await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
		await Bun.write(filePath, content);
	}

	function close() {
		input.end();
		server.close();
	}

	return {
		session: sessionStub as unknown as AgentSession,
		sessionManager,
		tuiDelegate,
		get planProposalHandler() {
			return proposalHandler;
		},
		compactCalls,
		compactOptionsCalls,
		promptCalls,
		writePlanFile,
		sendCommand,
		waitForFrame,
		getFrames: () => frames,
		attachSecondClient,
		close,
	};
}

describe("RPC plan mode", () => {
	test("enter and exit transitions push plan_state frames and update state", async () => {
		const harness = createPlanHarness();

		// Initial get_plan_state: disabled
		const initialRes = await harness.sendCommand({ type: "get_plan_state" });
		expect(initialRes.success).toBe(true);
		expect(initialRes.command).toBe("get_plan_state");
		const initialData = initialRes.data as { state: RpcPlanState; review: RpcPlanReview | null };
		expect(initialData.state.available).toBe(true);
		expect(initialData.state.enabled).toBe(false);
		expect(initialData.state.paused).toBe(false);
		expect(initialData.review).toBeNull();

		// Enable plan mode
		const enableRes = await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		expect(enableRes.success).toBe(true);
		expect(enableRes.command).toBe("set_plan_mode");
		const enableData = enableRes.data as { state: RpcPlanState };
		expect(enableData.state.enabled).toBe(true);
		expect(enableData.state.planFilePath).toBe("local://PLAN.md");

		// Frame was pushed
		const stateFrame1 = await harness.waitForFrame(
			f => f.type === "plan_state" && (f.state as RpcPlanState)?.enabled === true,
		);
		expect(stateFrame1).toBeDefined();

		// get_plan_state confirms enabled
		const enabledRes = await harness.sendCommand({ type: "get_plan_state" });
		const enabledData = enabledRes.data as { state: RpcPlanState; review: RpcPlanReview | null };
		expect(enabledData.state.enabled).toBe(true);
		expect(enabledData.state.planFilePath).toBe("local://PLAN.md");

		// Disable plan mode
		const disableRes = await harness.sendCommand({ type: "set_plan_mode", enabled: false });
		expect(disableRes.success).toBe(true);
		const disableData = disableRes.data as { state: RpcPlanState };
		expect(disableData.state.enabled).toBe(false);

		// Frame was pushed
		const stateFrame2 = await harness.waitForFrame(
			f => f.type === "plan_state" && (f.state as RpcPlanState)?.enabled === false,
		);
		expect(stateFrame2).toBeDefined();

		harness.close();
	});

	test("set_plan_mode { enabled: true } is refused when plan.enabled is false in settings", async () => {
		const harness = createPlanHarness({ planEnabled: false });

		const initialRes = await harness.sendCommand({ type: "get_plan_state" });
		expect(initialRes.success).toBe(true);
		const initialData = initialRes.data as { state: RpcPlanState; review: RpcPlanReview | null };
		expect(initialData.state.available).toBe(false);
		expect(initialData.state.enabled).toBe(false);

		const enableRes = await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		expect(enableRes.success).toBe(false);
		expect(enableRes.command).toBe("set_plan_mode");
		expect(enableRes.code).toBe("plan_disabled");
		expect(enableRes.error).toContain("plan.enabled");

		harness.close();
	});

	test("headless proposal and approve_plan execute outcome", async () => {
		const harness = createPlanHarness();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		await harness.writePlanFile("local://auth-plan.md", "# Authentication Plan\n\n1. Add tokens\n2. Add refresh");

		const proposalPromise = harness.planProposalHandler!("Authentication Redesign");

		const frame = await harness.waitForFrame(f => f.type === "plan_review" && f.review !== null);
		const reviewFrame = frame as unknown as PlanReviewFrame;
		expect(reviewFrame.review).not.toBeNull();
		const reviewId = reviewFrame.review?.reviewId ?? "";
		expect(reviewFrame.review?.title).toBe("Authentication Redesign");
		expect(reviewFrame.review?.markdown).toContain("# Authentication Plan");

		const approveRes = (await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "execute" as RpcPlanReviewAction,
		})) as unknown as ApprovePlanResponse;
		expect(approveRes.success).toBe(true);
		expect(approveRes.data?.state.enabled).toBe(false);

		const reviewClearedFrame = await harness.waitForFrame(f => f.type === "plan_review" && f.review === null);
		expect(reviewClearedFrame).toBeDefined();

		const stateDisabledFrame = await harness.waitForFrame(
			f => f.type === "plan_state" && (f as unknown as PlanStateFrame).state?.enabled === false,
		);
		expect(stateDisabledFrame).toBeDefined();

		const toolResult = await proposalPromise;
		expect(toolResult.details?.planExists).toBe(true);
		const first = toolResult.content[0];
		expect(first?.type).toBe("text");
		if (first?.type === "text") {
			expect(first.text).toContain("Plan approved at local://auth-plan.md");
		}

		harness.close();
	});

	test("headless compact where compact() rejects still resolves proposal as approved and plan mode ends", async () => {
		const harness = createPlanHarness();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		await harness.writePlanFile("local://Failing-Compact-plan.md", "# Failing Compact Plan");

		// compact() rejects (e.g. session too small to compact)
		harness.session.compact = async (
			_instructions?: string,
			_options?: CompactOptions,
		): Promise<CompactionResult> => {
			throw new Error("session too small to compact");
		};

		const proposalPromise = harness.planProposalHandler!("Failing Compact");

		const frame = await harness.waitForFrame(f => f.type === "plan_review" && f.review !== null);
		const reviewFrame = frame as unknown as PlanReviewFrame;
		expect(reviewFrame.review).not.toBeNull();
		const reviewId = reviewFrame.review?.reviewId ?? "";

		const approveRes = (await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "compact" as RpcPlanReviewAction,
		})) as unknown as ApprovePlanResponse;
		expect(approveRes.success).toBe(true);

		// Proposal resolves as approved despite compaction rejection
		const toolResult = await proposalPromise;
		expect(toolResult.details?.planExists).toBe(true);
		const first = toolResult.content[0];
		expect(first?.type).toBe("text");
		if (first?.type === "text") {
			expect(first.text).toContain("Plan approved at local://Failing-Compact-plan.md");
		}

		// Plan mode ended
		expect(approveRes.data?.state.enabled).toBe(false);
		expect(harness.session.getPlanModeState()?.enabled).toBeFalsy();

		harness.close();
	});

	test("headless compact passes internalGuidance not customInstructions", async () => {
		const harness = createPlanHarness();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		await harness.writePlanFile("local://guidance-plan.md", "# Guidance Plan");

		let capturedInstructions: string | undefined;
		let capturedOptions: CompactOptions | undefined;
		harness.session.compact = async (instructions?: string, options?: CompactOptions): Promise<CompactionResult> => {
			capturedInstructions = instructions;
			capturedOptions = options;
			return {
				summary: "Compacted session",
				firstKeptEntryId: "entry-1",
				tokensBefore: 1000,
			};
		};

		const proposalPromise = harness.planProposalHandler!("Guidance Test");

		const frame = await harness.waitForFrame(f => f.type === "plan_review" && f.review !== null);
		const reviewFrame = frame as unknown as PlanReviewFrame;
		expect(reviewFrame.review).not.toBeNull();
		const reviewId = reviewFrame.review?.reviewId ?? "";

		const approveRes = (await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "compact" as RpcPlanReviewAction,
		})) as unknown as ApprovePlanResponse;
		expect(approveRes.success).toBe(true);

		await proposalPromise;

		// customInstructions must be undefined, internalGuidance passed via options
		expect(capturedInstructions).toBeUndefined();
		expect(capturedOptions?.internalGuidance).toBeDefined();
		expect(capturedOptions?.internalGuidance).toContain("local://guidance-plan.md");
		expect(capturedOptions?.suppressContinuation).toBe(true);

		harness.close();
	});

	test("headless proposal and approve_plan refine outcome with feedback", async () => {
		const harness = createPlanHarness();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		await harness.writePlanFile("local://cache-plan.md", "# Cache Plan");

		const proposalPromise = harness.planProposalHandler!("Cache Redesign");

		const frame = await harness.waitForFrame(f => f.type === "plan_review" && f.review !== null);
		const reviewFrame = frame as unknown as PlanReviewFrame;
		expect(reviewFrame.review).not.toBeNull();
		const reviewId = reviewFrame.review?.reviewId ?? "";

		const approveRes = (await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "refine" as RpcPlanReviewAction,
			feedback: "Please use Redis instead of memory cache.",
		})) as unknown as ApprovePlanResponse;
		expect(approveRes.success).toBe(true);
		// Plan mode stays enabled!
		expect(approveRes.data?.state.enabled).toBe(true);

		// Review cleared frame pushed
		const reviewCleared = await harness.waitForFrame(f => f.type === "plan_review" && f.review === null);
		expect(reviewCleared).toBeDefined();

		// Tool result resolved with feedback
		const toolResult = await proposalPromise;
		const first = toolResult.content[0];
		expect(first?.type).toBe("text");
		if (first?.type === "text") {
			expect(first.text).toBe("Please use Redis instead of memory cache.");
		}

		harness.close();
	});

	test("headless proposal and approve_plan refine outcome without feedback", async () => {
		const harness = createPlanHarness();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		await harness.writePlanFile("local://simple-plan.md", "# Simple Plan");

		const proposalPromise = harness.planProposalHandler!("Simple Task");

		const frame = await harness.waitForFrame(f => f.type === "plan_review" && f.review !== null);
		const reviewFrame = frame as unknown as PlanReviewFrame;
		expect(reviewFrame.review).not.toBeNull();
		const reviewId = reviewFrame.review?.reviewId ?? "";

		const approveRes = (await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "refine" as RpcPlanReviewAction,
		})) as unknown as ApprovePlanResponse;
		expect(approveRes.success).toBe(true);
		expect(approveRes.data?.state.enabled).toBe(true);

		const reviewCleared = await harness.waitForFrame(f => f.type === "plan_review" && f.review === null);
		expect(reviewCleared).toBeDefined();

		// Tool result resolved with rendered refine prompt
		const toolResult = await proposalPromise;
		const first = toolResult.content[0];
		expect(first?.type).toBe("text");
		if (first?.type === "text") {
			expect(first.text).toContain("Plan refinement requested");
			expect(first.text).toContain("Simple-Task");
		}

		harness.close();
	});

	test("approve_plan returns error on stale or unknown reviewId", async () => {
		const harness = createPlanHarness();

		// No review pending
		const unknownRes = await harness.sendCommand({
			type: "approve_plan",
			reviewId: "nonexistent-review-id",
			action: "execute",
		});
		expect(unknownRes.success).toBe(false);
		expect(unknownRes.code).toBe("stale_review_id");
		expect(unknownRes.error).toContain("Unknown or stale plan review");

		// Create proposal, consume it, then try again
		await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		await harness.writePlanFile("local://one-shot-plan.md", "# One Shot");
		const proposalPromise = harness.planProposalHandler!("One Shot");
		const frame = await harness.waitForFrame(f => f.type === "plan_review" && f.review !== null);
		const reviewFrame = frame as unknown as PlanReviewFrame;
		const reviewId = reviewFrame.review?.reviewId ?? "";

		const firstApprove = await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "execute",
		});
		expect(firstApprove.success).toBe(true);
		await proposalPromise;

		const secondApprove = await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "execute",
		});
		expect(secondApprove.success).toBe(false);
		expect(secondApprove.code).toBe("stale_review_id");
		harness.close();
	});

	test("re-sends pending plan_review to newly attached connections", async () => {
		const harness = createPlanHarness();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });

		const coordinator = getRpcPlanCoordinator(harness.session);
		const reviewId = coordinator.startTuiProposal({
			title: "Attached Review",
			planFilePath: "local://attached-plan.md",
			planContent: "# Attached Plan Content",
		});

		// Client 1 got the review
		await harness.waitForFrame(f => f.type === "plan_review" && (f.review as RpcPlanReview)?.reviewId === reviewId);

		// Now client 2 connects
		const client2 = harness.attachSecondClient();

		// Client 2 immediately receives the pending review frame on attach
		const client2ReviewFrame = (await client2.waitForFrame(
			f => f.type === "plan_review" && (f.review as RpcPlanReview)?.reviewId === reviewId,
		)) as { type: "plan_review"; review: RpcPlanReview };
		expect(client2ReviewFrame.review.reviewId).toBe(reviewId);
		expect(client2ReviewFrame.review.title).toBe("Attached Review");
		expect(client2ReviewFrame.review.markdown).toBe("# Attached Plan Content");

		client2.close();
		harness.close();
	});

	test("abort command clears pending review and pushes plan_review { review: null }", async () => {
		const harness = createPlanHarness();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });

		const coordinator = getRpcPlanCoordinator(harness.session);
		const reviewId = coordinator.startTuiProposal({
			title: "Aborted Plan",
			planFilePath: "local://aborted-plan.md",
			planContent: "# Abort Me",
		});

		await harness.waitForFrame(f => f.type === "plan_review" && (f.review as RpcPlanReview)?.reviewId === reviewId);

		// Send abort command
		const abortRes = await harness.sendCommand({ type: "abort" });
		expect(abortRes.success).toBe(true);

		// Frame for review null pushed
		const reviewCleared = await harness.waitForFrame(f => f.type === "plan_review" && f.review === null);
		expect(reviewCleared).toBeDefined();

		// Subsequent approve_plan fails with stale reviewId
		const approveRes = await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "execute",
		});
		expect(approveRes.success).toBe(false);
		expect(approveRes.code).toBe("stale_review_id");

		harness.close();
	});

	test("TUI-origin approve_plan compact results in TUI delegate receiving compact choice", async () => {
		const harness = createPlanHarness({ hasTui: true });
		expect(harness.tuiDelegate).toBeDefined();

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });
		expect(harness.tuiDelegate?.enabled).toBe(true);

		const coordinator = getRpcPlanCoordinator(harness.session);
		const reviewId = coordinator.startTuiProposal({
			title: "TUI Review",
			planFilePath: "local://tui-plan.md",
			planContent: "# TUI Plan",
		});

		await harness.waitForFrame(
			f =>
				f.type === "plan_review" &&
				Boolean(
					f.review && typeof f.review === "object" && "reviewId" in f.review && f.review.reviewId === reviewId,
				),
		);

		const approveRes = (await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "compact",
		})) as unknown as ApprovePlanResponse;
		expect(approveRes.success).toBe(true);

		// TUI delegate received the compact choice
		expect(harness.tuiDelegate?.answeredCalls.length).toBe(1);
		expect(harness.tuiDelegate?.answeredCalls[0]).toEqual({ action: "compact", feedback: undefined });
		// TUI overlay was NOT dismissed via dismissPlanReview
		expect(harness.tuiDelegate?.dismissedCount).toBe(0);

		coordinator.endTuiProposal(reviewId);
		harness.close();
	});

	test("TUI-hosted coordination: TUI answering first closes review for RPC", async () => {
		const harness = createPlanHarness({ hasTui: true });

		await harness.sendCommand({ type: "set_plan_mode", enabled: true });

		const coordinator = getRpcPlanCoordinator(harness.session);
		const reviewId = coordinator.startTuiProposal({
			title: "TUI First",
			planFilePath: "local://tui-first-plan.md",
			planContent: "# TUI First Plan",
		});

		await harness.waitForFrame(f => f.type === "plan_review" && (f.review as RpcPlanReview)?.reviewId === reviewId);

		// TUI answers first: finishes the proposal
		coordinator.endTuiProposal(reviewId);

		// Frame for review null pushed to RPC client
		const reviewNullFrame = await harness.waitForFrame(f => f.type === "plan_review" && f.review === null);
		expect(reviewNullFrame).toBeDefined();

		// Late RPC approval fails with stale reviewId
		const lateRes = await harness.sendCommand({
			type: "approve_plan",
			reviewId,
			action: "execute",
		});
		expect(lateRes.success).toBe(false);
		expect(lateRes.code).toBe("stale_review_id");

		harness.close();
	});
});
