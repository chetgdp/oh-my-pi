import type { RpcConnectionState } from "./rpc-client";
import { RpcCommandError } from "./rpc-client";

/** The slice of `RpcWebClient` the binding drives. */
export interface VoiceChannelClient {
	readonly state: RpcConnectionState;
	setVoiceChannel(channel: string | null): Promise<void>;
	onStateChange(listener: (state: RpcConnectionState) => void): () => void;
}

/** The slice of the wren controller the binding reads. */
export interface VoiceChannelSource {
	channel(): string;
	/** True only while playback is enabled; an armed (gesture-pending) pref counts as off. */
	enabled(): boolean;
	subscribe(listener: () => void): () => void;
}

/** Handle returned by {@link bindVoiceChannel}. */
export interface VoiceChannelBinding {
	/**
	 * Re-asserts this tab's value right before a prompt, steer, or follow-up is sent on
	 * the same client. Always sends: the host clears the channel when the user prompts
	 * from the TUI, so the last-sent value here may be stale. The request is written to
	 * the socket synchronously, so the host sees it before the prompt that follows.
	 */
	beforePrompt(): void;
	dispose(): void;
}

/**
 * Keeps the host's per-session voice channel in step with this tab's voice state:
 * the channel id while enabled, null when disabled or on dispose, re-sent on every
 * (re)connect because the host clears it when this connection drops.
 */
export function bindVoiceChannel(client: VoiceChannelClient, source: VoiceChannelSource): VoiceChannelBinding {
	// Value the host holds from this connection; undefined after a reconnect means unknown.
	let sent: string | null | undefined;
	// An older host rejects the command; stop sending until the next (re)connect, which may reach a newer host.
	let unsupported = false;

	const send = (want: string | null): void => {
		sent = want;
		client.setVoiceChannel(want).catch((err: unknown) => {
			if (err instanceof RpcCommandError) unsupported = true;
			sent = undefined;
		});
	};

	const push = (): void => {
		if (unsupported || client.state !== "ready") return;
		const want = source.enabled() ? source.channel() : null;
		if (want === sent || (sent === undefined && want === null)) return;
		send(want);
	};

	const unsubState = client.onStateChange(state => {
		if (state === "ready") {
			sent = undefined;
			unsupported = false;
			push();
		}
	});
	const unsubSource = source.subscribe(push);
	push();

	return {
		beforePrompt() {
			if (unsupported || client.state !== "ready") return;
			send(source.enabled() ? source.channel() : null);
		},
		dispose() {
			unsubState();
			unsubSource();
			if (!unsupported && sent && client.state === "ready") client.setVoiceChannel(null).catch(() => {});
		},
	};
}
