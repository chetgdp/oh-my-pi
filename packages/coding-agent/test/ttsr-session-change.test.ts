import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import type { Rule } from "@oh-my-pi/pi-coding-agent/capability/rule";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";

const rule: Rule = {
	name: "doe",
	path: "/tmp/doe.md",
	content: "Data-oriented rule body",
	condition: ["(?i)\\bdoe\\b"],
	_source: { provider: "test", providerName: "test", path: "/tmp/doe.md", level: "user" },
};

describe("TTSR once-state across session changes", () => {
	it("re-arms on /new and restores the target session's injections on switch", async () => {
		using tempDir = TempDir.createSync("@pi-ttsr-session-change-");
		const sessionDir = path.join(tempDir.path(), "sessions");
		const authStorage = await AuthStorage.create(tempDir.join("auth.db"));
		authStorage.keys.setRuntime("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage, tempDir.join("models.yml"));
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 model to exist");

		const { session } = await createAgentSession({
			cwd: tempDir.path(),
			agentDir: tempDir.path(),
			sessionManager: SessionManager.create(tempDir.path(), sessionDir),
			authStorage,
			modelRegistry,
			settings: Settings.isolated({ "compaction.enabled": false }),
			model,
			rules: [rule],
			disableExtensionDiscovery: true,
			skills: [],
			contextFiles: [],
			promptTemplates: [],
			slashCommands: [],
			enableMCP: false,
			enableLsp: false,
			skipPythonPreflight: true,
		});

		try {
			const manager = session.ttsrManager;
			if (!manager) throw new Error("Expected a TTSR manager");
			const fires = () => manager.checkDelta("about DOE", { source: "text" }).map(r => r.name);

			// Record the injection the way the interrupt path does.
			manager.markInjectedByNames([rule.name]);
			session.sessionManager.appendMessage({ role: "user", content: "first", timestamp: Date.now() });
			session.sessionManager.appendTtsrInjection([rule.name]);
			await session.sessionManager.ensureOnDisk();
			const firstFile = session.sessionManager.getSessionFile();
			if (!firstFile) throw new Error("Expected first session file");
			manager.resetBuffer();
			expect(fires()).toEqual([]);

			expect(await session.newSession()).toBe(true);
			manager.resetBuffer();
			expect(fires()).toEqual([rule.name]);

			await session.switchSession(firstFile);
			manager.resetBuffer();
			expect(fires()).toEqual([]);
		} finally {
			await session.dispose();
			authStorage.close();
		}
	});
});
