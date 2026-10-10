import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Agent } from "@oh-my-pi/pi-agent-core";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";
import { Settings } from "../src/config/settings";
import { RpcServeController } from "../src/modes/rpc/rpc-serve-controller";
import { listRpcHosts } from "../src/modes/rpc/rpc-registry";
import { serveRpc } from "../src/modes/rpc/rpc-server";
import type { InteractiveModeContext } from "../src/modes/types";
import { ModelRegistry } from "../src/config/model-registry";
import { AgentSession } from "../src/session/agent-session";
import { AuthStorage } from "../src/session/auth-storage";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";

describe("served session registry republishing", () => {
	let tmpDir: string;
	let session: AgentSession | undefined;
	let controller: RpcServeController | undefined;
	let authStorage: AuthStorage | undefined;
	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-serve-session-test-"));
	});

	afterEach(async () => {
		setSystemTime();
		if (controller) {
			await controller.stop();
			controller = undefined;
		}
		if (session) {
			await session.dispose();
			session = undefined;
		}
		if (authStorage) {
			authStorage.close();
			authStorage = undefined;
		}
		removeSyncWithRetries(tmpDir);
	});

	async function createHarness(initialModelId = "claude-sonnet-4-5") {
		const initialModel = getBundledModel("anthropic", initialModelId);
		if (!initialModel) throw new Error(`Model ${initialModelId} not found`);

		const storage = new MemorySessionStorage();
		const sessionManager = SessionManager.create(tmpDir, tmpDir, storage);
		const agent = new Agent({
			initialState: {
				model: initialModel,
				systemPrompt: ["Test prompt"],
				tools: [],
				messages: [],
			},
		});
		const settings = Settings.isolated();
		authStorage = await AuthStorage.create(path.join(tmpDir, "auth.db"));
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage, path.join(tmpDir, "models.yml"));
		session = new AgentSession({
			agent,
			sessionManager,
			settings,
			modelRegistry,
		});
		const ctx = {
			session,
			sessionManager,
			shutdown: async () => {},
			planModeEnabled: false,
			planModePaused: false,
			planModePlanFilePath: undefined,
			enterPlanMode: () => {},
			exitPlanMode: () => {},
			dismissPlanReview: () => {},
			answerPlanReview: () => {},
		} as unknown as InteractiveModeContext;

		controller = new RpcServeController(ctx, { registryDir: tmpDir });
		return { session, sessionManager, controller };
	}

	test("failure mode: registry entry does not update on session rename or model change, and startedAt drifts", async () => {
		const startTime = 1_700_000_000_000;
		setSystemTime(startTime);
		const { session: sess, sessionManager: sm, controller: ctrl } = await createHarness("claude-sonnet-4-5");
		await ctrl.start(serveRpc);

		const initialHosts = listRpcHosts({ dir: tmpDir });
		expect(initialHosts).toHaveLength(1);
		expect(initialHosts[0].sessionName).toBeNull();
		expect(initialHosts[0].model).toBe("claude-sonnet-4-5");
		expect(initialHosts[0].startedAt).toBe(startTime);

		// Advance clock so any subsequent Date.now() call produces a drifted timestamp
		setSystemTime(startTime + 60_000);

		// 1. Rename session through sessionManager (real path for /rename and auto-title)
		await sm.setSessionName("My Renamed Session", "user");

		const renamedHosts = listRpcHosts({ dir: tmpDir });
		expect(renamedHosts).toHaveLength(1);
		expect(renamedHosts[0].sessionName).toBe("My Renamed Session");
		expect(renamedHosts[0].startedAt).toBe(startTime);

		// 2. Change model through session.setModel (real path for /model)
		const nextModel = getBundledModel("anthropic", "claude-sonnet-4-6");
		if (!nextModel) throw new Error("Next model claude-sonnet-4-6 not found");
		await sess.setModel(nextModel);

		const modelChangedHosts = listRpcHosts({ dir: tmpDir });
		expect(modelChangedHosts).toHaveLength(1);
		expect(modelChangedHosts[0].model).toBe("claude-sonnet-4-6");
		expect(modelChangedHosts[0].sessionName).toBe("My Renamed Session");
		expect(modelChangedHosts[0].startedAt).toBe(startTime);
	});

	test("controller stop unsubscribes from session events and withdraws registry entry", async () => {
		const { session: sess, sessionManager: sm, controller: ctrl } = await createHarness("claude-sonnet-4-5");
		await ctrl.start(serveRpc);

		expect(listRpcHosts({ dir: tmpDir })).toHaveLength(1);

		await ctrl.stop();
		expect(listRpcHosts({ dir: tmpDir })).toHaveLength(0);

		// Subsequent renames or model changes after stop must not resurrect or throw
		await sm.setSessionName("After Stop", "user");
		const nextModel = getBundledModel("anthropic", "claude-sonnet-4-6");
		if (!nextModel) throw new Error("Next model not found");
		await sess.setModel(nextModel);

		expect(listRpcHosts({ dir: tmpDir })).toHaveLength(0);
	});

	test("two serve controllers on one session: second does not publish", async () => {
		const { session: sess1, controller: ctrl1 } = await createHarness("claude-sonnet-4-5");

		// Simulate another process holding the session lock
		const lockPath = path.join(
			tmpDir,
			`session-${new Bun.CryptoHasher("sha256").update(sess1.sessionManager.getSessionId()).digest("hex").slice(0, 32)}.lock`,
		);
		// pid 1 is always alive and is not this process
		fs.writeFileSync(lockPath, "1\n");

		try {
			await ctrl1.start(serveRpc);

			// Does not publish because session lock was held by another process
			const hosts = listRpcHosts({ dir: tmpDir });
			expect(hosts).toHaveLength(0);
		} finally {
			fs.rmSync(lockPath, { force: true });
		}
	});
});
