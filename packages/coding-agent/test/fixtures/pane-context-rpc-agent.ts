import * as path from "node:path";
import { Agent } from "@oh-my-pi/pi-agent-core";
import type { Message } from "@oh-my-pi/pi-ai";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { getBundledModel } from "@oh-my-pi/pi-catalog/models";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { runRpcMode } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-mode";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";

// Real RPC dispatch whose mock model answers with the JSON list of non-assistant texts it was sent,
// so a test can see exactly what reached the model request.
function requestTexts(messages: Message[]): string[] {
	return messages.flatMap(message => {
		if (message.role === "assistant") return [];
		if (typeof message.content === "string") return [message.content];
		return [message.content.map(part => (part.type === "text" ? part.text : "")).join("")];
	});
}

const cwd = process.cwd();
const authStorage = await AuthStorage.create(path.join(cwd, "auth.db"));
authStorage.keys.setRuntime("zai", "test-key");
const modelRegistry = new ModelRegistry(authStorage, path.join(cwd, "models.yml"));
const mock = createMockModel({ handler: context => ({ content: [JSON.stringify(requestTexts(context.messages))] }) });
const agent = new Agent({
	getApiKey: () => "test-key",
	initialState: { model: getBundledModel("zai", "glm-5.3"), systemPrompt: ["Test"], tools: [], messages: [] },
	convertToLlm,
	streamFn: mock.stream,
});
const session = new AgentSession({
	agent,
	sessionManager: SessionManager.inMemory(cwd),
	settings: Settings.isolated({ "compaction.enabled": false }),
	modelRegistry,
	toolRegistry: new Map(),
});
await runRpcMode(session);
