import { describe, expect, it } from "bun:test";
import { Settings } from "../src/config/settings";
import { RpcGoalController, type RpcGoalSession } from "../src/modes/rpc/rpc-goal";
import { getRpcPlanCoordinator } from "../src/modes/rpc/rpc-plan";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";
import type { AgentSession, AgentSessionEvent } from "../src/session/agent-session";
import type { GoalModeState } from "../src/goals/state";
import { PassThrough, Readable } from "node:stream";

describe("Goals and Plan Mode in Host/RPC", () => {
	it("rejects setPlanMode(true) when a goal is active", async () => {
		let goalState: GoalModeState | undefined = {
			enabled: true,
			mode: "active",
			goal: {
				id: "g1",
				objective: "test active goal",
				status: "active",
				tokensUsed: 0,
				timeUsedSeconds: 0,
				createdAt: 0,
				updatedAt: 0,
			},
		};

		let currentPlanState: { enabled: boolean; planFilePath?: string } | undefined;
		const sessionStub = {
			settings: Settings.isolated({ "plan.enabled": true }),
			getGoalModeState: () => goalState,
			getPlanModeState: () => currentPlanState,
			setPlanModeState: (s: typeof currentPlanState) => {
				currentPlanState = s;
			},
		} as unknown as AgentSession;

		const coordinator = getRpcPlanCoordinator(sessionStub);
		await expect(coordinator.setPlanMode(true)).rejects.toThrow("Exit goal mode before entering plan mode.");

		// When goal is paused/disabled, plan mode entry is permitted
		goalState = undefined;
		const state = await coordinator.setPlanMode(true);
		expect(state.enabled).toBe(true);
	});

	it("RpcGoalController continuationAlways ignores goal.continuationModes setting", async () => {
		let _promptAdmitted = false;
		const sessionStub = {
			settings: Settings.isolated({ "goal.continuationModes": [] }), // empty!
			getGoalModeState: () => ({
				enabled: true,
				mode: "active",
				goal: {
					id: "g1",
					objective: "test",
					status: "active",
					tokensUsed: 0,
					timeUsedSeconds: 0,
					createdAt: 0,
					updatedAt: 0,
				},
			}),
			getPlanModeState: () => undefined,
			getTodoPhases: () => [],
			goalRuntime: {
				buildContinuationPrompt: () => "continue",
				clearAccounting: () => {},
			},
			promptCustomMessage: async () => {
				_promptAdmitted = true;
				return true;
			},
			waitForIdle: async () => {},
			isStreaming: false,
			isDisposed: false,
			isSessionTransitioning: false,
			hasAdmittedSubmission: false,
			queuedMessageCount: 0,
		} as unknown as RpcGoalSession;

		// Without continuationAlways: continuation is not scheduled because setting is empty
		const normalCtrl = new RpcGoalController(sessionStub, undefined, { ownsSession: true });
		normalCtrl.observe({ type: "agent_end", messages: [], isTerminal: true } as unknown as AgentSessionEvent);
		expect(normalCtrl.continuationPending).toBe(false);

		// With continuationAlways (as passed by host): continuation is scheduled!
		const hostCtrl = new RpcGoalController(sessionStub, undefined, { ownsSession: true, continuationAlways: true });
		hostCtrl.observe({ type: "agent_end", messages: [], isTerminal: true } as unknown as AgentSessionEvent);
		expect(hostCtrl.continuationPending).toBe(true);
	});

	it("two connections share the host goal controller; first connection closing leaves goal controlled", async () => {
		const storage = new MemorySessionStorage();
		const sessionManager = SessionManager.create("/tmp/test", "/tmp/test", storage);
		const listeners = new Set<(event: AgentSessionEvent) => void>();

		let goalState: GoalModeState | undefined;
		const sessionStub = {
			settings: Settings.isolated({ "goal.enabled": true }),
			sessionManager,
			model: { id: "test", name: "test", provider: "test" },
			isStreaming: false,
			agent: { state: { streamMessage: null, tools: [] } },
			subscribe(fn: (event: AgentSessionEvent) => void) {
				listeners.add(fn);
				return () => listeners.delete(fn);
			},
			emit(event: AgentSessionEvent) {
				for (const l of listeners) l(event);
			},
			subscribeCommandMetadataChanged: () => () => {},
			getGoalModeState: () => goalState,
			setGoalModeState: (s: GoalModeState | undefined) => {
				goalState = s;
			},
			goalRuntime: {
				clearAccounting: () => {},
				createGoal: async ({ objective }: { objective: string }) => {
					goalState = {
						enabled: true,
						mode: "active",
						goal: {
							id: "g1",
							objective,
							status: "active",
							tokensUsed: 0,
							timeUsedSeconds: 0,
							createdAt: 0,
							updatedAt: 0,
						},
					};
					return goalState;
				},
				resumeGoal: async () => goalState!,
				buildContinuationPrompt: () => "continue",
				onThreadResumed: async () => goalState,
			},
			getPlanModeState: () => undefined,
			getEnabledToolNames: () => ["read"],
			setActiveToolsByName: async () => {},
			sendGoalModeContext: async () => {},
			getTodoPhases: () => [],
			promptCustomMessage: async () => true,
			waitForIdle: async () => {},
			isDisposed: false,
			isSessionTransitioning: false,
			hasAdmittedSubmission: false,
			queuedMessageCount: 0,
			registerPersistenceFailureCallback: () => () => {},
			setSlashCommands: () => {},
			isFastModeEnabled: () => false,
			isFastModeActive: () => false,
			setTodoPhases: () => {},
		} as unknown as AgentSession;

		const sharedGoalController = new RpcGoalController(sessionStub as unknown as RpcGoalSession, undefined, {
			ownsSession: true,
			continuationAlways: true,
		});

		// Connection 1
		const conn1Input = new PassThrough();
		const conn1Output = new PassThrough();
		const handle1 = serveRpc(
			sessionStub,
			{ input: Readable.toWeb(conn1Input) as ReadableStream<Uint8Array>, output: conn1Output },
			{
				ownsSession: true,
				goalController: sharedGoalController,
				onShutdown: () => {},
				onWriteFailure: () => {},
			},
		);

		// Connection 2
		const conn2Input = new PassThrough();
		const conn2Output = new PassThrough();
		const handle2 = serveRpc(
			sessionStub,
			{ input: Readable.toWeb(conn2Input) as ReadableStream<Uint8Array>, output: conn2Output },
			{
				ownsSession: true,
				goalController: sharedGoalController,
				onShutdown: () => {},
				onWriteFailure: () => {},
			},
		);

		// Conn 1 creates a goal
		const result = await sharedGoalController.handle({ op: "create", objective: "shared goal objective" });
		expect(result.goal?.objective).toBe("shared goal objective");
		expect(sessionStub.getGoalModeState()?.goal.status).toBe("active");

		// Conn 1 closes
		handle1.close();

		// Goal controller is still alive and owned
		expect(sharedGoalController.continuationPending).toBe(true);
		sharedGoalController.stopForHostAbort();
		expect(sharedGoalController.continuationPending).toBe(false);

		handle2.close();
	});

	it("plan mode is restored from session context on resume", async () => {
		const storage = new MemorySessionStorage();
		const sessionManager = SessionManager.create("/tmp/test", "/tmp/test", storage);
		sessionManager.appendModeChange("plan", { planFilePath: "local://CUSTOM_PLAN.md" });

		const sessionStub = {
			settings: Settings.isolated({ "plan.enabled": true }),
			sessionManager,
			getPlanModeState: () => planState,
			setPlanModeState: (s: { enabled: boolean; planFilePath?: string }) => {
				planState = s;
			},
			setPlanProposalHandler: () => {},
		} as unknown as AgentSession;

		let planState: { enabled: boolean; planFilePath?: string } | undefined;
		const coordinator = getRpcPlanCoordinator(sessionStub);
		const restored = await coordinator.restoreFromSession();
		expect(restored).toBe(true);
		expect(planState?.enabled).toBe(true);
		expect(planState?.planFilePath).toBe("local://CUSTOM_PLAN.md");

		// Non-plan session does not restore
		const nonPlanStorage = new MemorySessionStorage();
		const nonPlanSm = SessionManager.create("/tmp/test2", "/tmp/test2", nonPlanStorage);
		const nonPlanSession = {
			settings: Settings.isolated({ "plan.enabled": true }),
			sessionManager: nonPlanSm,
			getPlanModeState: () => undefined,
			setPlanModeState: () => {},
		} as unknown as AgentSession;
		const nonPlanCoordinator = getRpcPlanCoordinator(nonPlanSession);
		expect(await nonPlanCoordinator.restoreFromSession()).toBe(false);
	});
});
