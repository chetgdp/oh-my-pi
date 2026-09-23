import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { Agent, ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import { getBundledModel, type GeneratedProvider } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "../src/config/model-registry";
import { Settings } from "../src/config/settings";
import { AgentSession } from "../src/session/agent-session";
import { AuthStorage } from "../src/session/auth-storage";
import { SessionManager } from "../src/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";

describe("AgentSession.modelSource", () => {
	let tempDir: TempDir;
	let fixtureDir: TempDir;
	let authStorage: AuthStorage;
	let modelRegistry: ModelRegistry;
	let session: AgentSession;

	beforeAll(async () => {
		fixtureDir = TempDir.createSync("@pi-model-source-fixture-");
		authStorage = await AuthStorage.create(path.join(fixtureDir.path(), "testauth.db"));
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		authStorage.setRuntimeApiKey("openai", "test-key");
		modelRegistry = new ModelRegistry(authStorage, path.join(fixtureDir.path(), "models.yml"));
	});

	beforeEach(() => {
		tempDir = TempDir.createSync("@pi-model-source-");
	});

	afterEach(async () => {
		if (session) {
			await session.dispose();
		}
		tempDir.removeSync();
	});

	afterAll(() => {
		authStorage.close();
		fixtureDir.removeSync();
	});

	function getModelOrThrow(provider: GeneratedProvider, id: string) {
		const model = getBundledModel(provider, id);
		if (!model) throw new Error(`Expected model ${provider}/${id} to exist`);
		return model;
	}

	function createSession(initialModel = getModelOrThrow("anthropic", "claude-sonnet-4-5")) {
		const agent = new Agent({
			initialState: {
				model: initialModel,
				systemPrompt: ["Test"],
				tools: [],
				messages: [],
				thinkingLevel: ThinkingLevel.Low,
			},
		});
		const settings = Settings.isolated();
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings,
			modelRegistry,
		});
		return session;
	}

	it("returns undefined when no model change has been recorded", () => {
		const sess = createSession();
		expect(sess.modelSource).toBeUndefined();
	});

	it("returns role source after setModel with a role", async () => {
		const sess = createSession();
		const model = getModelOrThrow("anthropic", "claude-haiku-4-5");
		await sess.setModel(model, "smol");
		expect(sess.modelSource).toEqual({
			kind: "role",
			role: "smol",
		});
	});

	it("returns temporary source after setModelTemporary", async () => {
		const sess = createSession();
		const model = getModelOrThrow("openai", "gpt-4o-mini");
		await sess.setModelTemporary(model);
		expect(sess.modelSource).toEqual({
			kind: "temporary",
		});
	});

	it("returns ephemeral source after ephemeral setModelTemporary", async () => {
		const sess = createSession();
		const model = getModelOrThrow("openai", "gpt-4o");
		await sess.setModelTemporary(model, undefined, { ephemeral: true });
		expect(sess.modelSource).toEqual({
			kind: "ephemeral",
		});
	});

	it("returns fallback source when servingModel indicates fallback routing", async () => {
		const sess = createSession();
		const primaryModel = getModelOrThrow("anthropic", "claude-sonnet-4-5");
		await sess.setModel(primaryModel, "default");

		// Stub servingModel getter to simulate an active fallback
		Object.defineProperty(sess, "servingModel", {
			get: () => ({
				selector: "openai/gpt-4o-mini",
				modelIdentity: "openai/gpt-4o-mini",
				isFallback: true,
			}),
			configurable: true,
		});

		expect(sess.modelSource).toEqual({
			kind: "fallback",
			fallbackFrom: "anthropic/claude-sonnet-4-5",
			role: "default",
		});
	});
});
