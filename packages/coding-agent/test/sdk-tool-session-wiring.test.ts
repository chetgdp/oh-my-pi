import { afterEach, describe, expect, it } from "bun:test";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import type { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";
import { createInMemoryAuthStorage } from "./helpers/agent-session-setup";

describe("sdk tool session wiring", () => {
	let authStorage: AuthStorage;
	let tempDir: TempDir;
	let session: AgentSession | undefined;

	afterEach(async () => {
		await session?.dispose();
		session = undefined;
		authStorage?.close();
		try {
			await tempDir.remove();
		} catch {}
	});

	it("gives sdk-built sessions a task runtime so extension agent invocation works", async () => {
		authStorage = createInMemoryAuthStorage();
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage);
		const bundled = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!bundled) throw new Error("Expected built-in anthropic model to exist");
		tempDir = TempDir.createSync("@omp-tool-session-wiring-");
		const settings = Settings.isolated({
			"async.enabled": false,
			"browser.enabled": false,
			"computer.enabled": false,
			"compaction.enabled": false,
			"todo.enabled": false,
		});
		settings.setModelRole("default", `${bundled.provider}/${bundled.id}`);
		const result = await createAgentSession({
			cwd: tempDir.path(),
			agentDir: tempDir.path(),
			sessionManager: SessionManager.create(tempDir.path(), tempDir.path()),
			agentRegistry: new AgentRegistry(),
			authStorage,
			modelRegistry,
			settings,
			model: bundled,
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			workspaceTree: { rootPath: tempDir.path(), rendered: "", truncated: false, totalLines: 0, agentsMdFiles: [] },
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
		});
		session = result.session;

		expect(session.getToolSession().cwd).toBe(tempDir.path());
	});
});
