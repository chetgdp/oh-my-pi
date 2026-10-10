import { afterEach, beforeEach, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { RpcClient } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-client";
import type { RpcPromptResultFrame } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { removeWithRetries } from "@oh-my-pi/pi-utils";

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map(part => (part?.type === "text" ? String(part.text) : "")).join("");
}

let client: RpcClient;
let directory: string;

beforeEach(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), "omp-rpc-pane-context-"));
	client = new RpcClient({
		command: [process.execPath, path.join(import.meta.dir, "fixtures", "pane-context-rpc-agent.ts")],
		cwd: directory,
		env: { PI_CODING_AGENT_DIR: directory, PI_NO_TITLE: "1" },
	});
	await client.start();
});

afterEach(async () => {
	await client?.stop();
	await removeWithRetries(directory);
});

async function promptAndSettle(message: string, paneCwd: string): Promise<RpcPromptResultFrame> {
	const settled = Promise.withResolvers<RpcPromptResultFrame>();
	const unsubscribe = client.onPromptResult(frame => settled.resolve(frame));
	try {
		await client.prompt(message, undefined, undefined, { paneCwd });
		return await settled.promise;
	} finally {
		unsubscribe();
	}
}

test("prompt context reaches the model hidden while the user message keeps the typed text", async () => {
	const result = await promptAndSettle("what is here?", "/pane/work dir");
	expect(result.status).toBe("completed");

	const messages: AgentMessage[] = await client.getMessages();
	const users = messages.filter(message => message.role === "user");
	expect(users.map(message => textOf(message.content))).toEqual(["what is here?"]);

	const hidden = messages.filter(message => message.role === "custom");
	expect(hidden).toHaveLength(1);
	const note = hidden[0]!;
	if (note.role !== "custom") throw new Error("expected a custom message");
	expect(note.customType).toBe("shell-pane-context");
	expect(note.display).toBe(false);
	expect(textOf(note.content)).toContain("/pane/work dir");

	// The mock model replies with the non-assistant texts of its request: pane note, then the prompt.
	const reply = messages.findLast(message => message.role === "assistant");
	if (reply?.role !== "assistant") throw new Error("expected an assistant reply");
	const sent = JSON.parse(textOf(reply.content)) as string[];
	expect(sent.at(-1)).toBe("what is here?");
	expect(sent.some(text => text.includes("/pane/work dir") && text !== "what is here?")).toBe(true);
}, 30_000);

test("malformed prompt context is rejected and starts no turn", async () => {
	await expect(client.prompt("hi", undefined, undefined, { paneCwd: "relative/dir" })).rejects.toThrow(
		"context.paneCwd must be an absolute path",
	);
	await expect(client.prompt("hi", undefined, undefined, { paneCwd: "/a\nb" })).rejects.toThrow("control characters");
	await expect(client.prompt("hi", undefined, undefined, { paneCwd: `/${"x".repeat(5000)}` })).rejects.toThrow(
		"exceeds",
	);
	expect(await client.getMessages()).toEqual([]);
}, 30_000);
