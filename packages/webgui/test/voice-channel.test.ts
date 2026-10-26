import { describe, expect, test } from "bun:test";
import type { RpcConnectionState } from "../src/lib/rpc-client";
import { RpcCommandError } from "../src/lib/rpc-client";
import {
	bindVoiceChannel,
	type VoiceChannelBinding,
	type VoiceChannelClient,
	type VoiceChannelSource,
} from "../src/lib/voice-channel";

class FakeClient implements VoiceChannelClient {
	state: RpcConnectionState = "ready";
	sent: Array<string | null> = [];
	reject: Error | null = null;
	#listeners = new Set<(s: RpcConnectionState) => void>();

	setVoiceChannel(channel: string | null): Promise<void> {
		this.sent.push(channel);
		return this.reject ? Promise.reject(this.reject) : Promise.resolve();
	}
	onStateChange(listener: (s: RpcConnectionState) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
	setState(s: RpcConnectionState): void {
		this.state = s;
		for (const l of this.#listeners) l(s);
	}
}

class FakeVoice implements VoiceChannelSource {
	on = false;
	#listeners = new Set<() => void>();
	channel(): string {
		return "webgui-abc";
	}
	enabled(): boolean {
		return this.on;
	}
	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
	set(on: boolean): void {
		this.on = on;
		for (const l of this.#listeners) l();
	}
}

// The binding's rejection handler runs two microtask hops after the call.
const flush = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("bindVoiceChannel", () => {
	test("enabling sends the channel id, disabling sends null", () => {
		const client = new FakeClient();
		const voice = new FakeVoice();
		bindVoiceChannel(client, voice);
		voice.set(true);
		voice.set(false);
		expect(client.sent).toEqual(["webgui-abc", null]);
	});

	test("armed (not enabled) sends nothing", () => {
		const client = new FakeClient();
		const voice = new FakeVoice();
		bindVoiceChannel(client, voice);
		voice.set(false);
		expect(client.sent).toEqual([]);
	});

	test("switching sessions clears the old session and sets the new one", () => {
		const voice = new FakeVoice();
		voice.on = true;
		const oldClient = new FakeClient();
		const binding = bindVoiceChannel(oldClient, voice);
		binding.dispose();
		const newClient = new FakeClient();
		bindVoiceChannel(newClient, voice);
		expect(oldClient.sent).toEqual(["webgui-abc", null]);
		expect(newClient.sent).toEqual(["webgui-abc"]);
	});

	test("waits for ready and re-sends after reconnect", () => {
		const client = new FakeClient();
		client.state = "connecting";
		const voice = new FakeVoice();
		bindVoiceChannel(client, voice);
		voice.set(true);
		expect(client.sent).toEqual([]);
		client.setState("ready");
		client.setState("reconnecting");
		client.setState("ready");
		expect(client.sent).toEqual(["webgui-abc", "webgui-abc"]);
	});

	test("an older host's unknown-command error stops sends until a reconnect reaches a newer host", async () => {
		const client = new FakeClient();
		client.reject = new RpcCommandError("set_voice_channel", "Unknown command: set_voice_channel");
		const voice = new FakeVoice();
		bindVoiceChannel(client, voice);
		voice.set(true);
		await flush();
		voice.set(false);
		voice.set(true);
		expect(client.sent).toEqual(["webgui-abc"]);
		client.reject = null;
		client.setState("reconnecting");
		client.setState("ready");
		expect(client.sent).toEqual(["webgui-abc", "webgui-abc"]);
	});

	describe("beforePrompt", () => {
		// Mirrors App.handleSend: re-assert the channel, then write the prompt on the same client.
		const sendPrompt = (client: FakeClient, binding: VoiceChannelBinding): void => {
			binding.beforePrompt();
			client.sent.push("<prompt>");
		};

		test("voice on: set_voice_channel(channel) precedes the prompt", () => {
			const client = new FakeClient();
			const voice = new FakeVoice();
			voice.on = true;
			const binding = bindVoiceChannel(client, voice);
			sendPrompt(client, binding);
			expect(client.sent).toEqual(["webgui-abc", "webgui-abc", "<prompt>"]);
		});

		test("voice off: set_voice_channel(null) precedes the prompt", () => {
			const client = new FakeClient();
			const binding = bindVoiceChannel(client, new FakeVoice());
			sendPrompt(client, binding);
			expect(client.sent).toEqual([null, "<prompt>"]);
		});

		test("re-sends a value already sent, since a TUI prompt may have cleared it on the host", () => {
			const client = new FakeClient();
			const voice = new FakeVoice();
			const binding = bindVoiceChannel(client, voice);
			voice.set(true);
			sendPrompt(client, binding);
			sendPrompt(client, binding);
			voice.set(false);
			sendPrompt(client, binding);
			expect(client.sent).toEqual([
				"webgui-abc",
				"webgui-abc",
				"<prompt>",
				"webgui-abc",
				"<prompt>",
				null,
				null,
				"<prompt>",
			]);
		});

		test("an older host's rejection is swallowed and later prompts skip the command", async () => {
			const client = new FakeClient();
			client.reject = new RpcCommandError("set_voice_channel", "Unknown command: set_voice_channel");
			const binding = bindVoiceChannel(client, new FakeVoice());
			sendPrompt(client, binding);
			await flush();
			sendPrompt(client, binding);
			expect(client.sent).toEqual([null, "<prompt>", "<prompt>"]);
		});
	});
});
