import * as net from "node:net";
import type { Server, WebSocketHandler } from "bun";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelayTarget {
	endpoint: string;
	token: string;
}

export interface RelayData {
	target: RelayTarget;
	/** Client's cached available-commands hash, forwarded so the host can skip an unchanged startup push. */
	commandsHash?: string;
	upstream?: net.Socket;
	decoder?: TextDecoder;
	/** Decoded upstream text awaiting the next coalesced send. */
	pending?: string[];
	pendingBytes?: number;
	flushTimer?: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Backpressure cap (1 MiB)
// ---------------------------------------------------------------------------

const BACKPRESSURE_HIGH = 1 << 20;

// Bun's "dedicated" deflate does not carry the window across messages, so each frame compresses alone.
// Batching upstream chunks into one frame per window lets deflate see the repeated content.
export const COALESCE_WINDOW_MS = 50;
export const COALESCE_MAX_BYTES = 64 * 1024;

type RelaySocket = Parameters<NonNullable<WebSocketHandler<RelayData>["open"]>>[0];

function flushPending(ws: RelaySocket): void {
	const data = ws.data;
	if (data.flushTimer !== undefined) {
		clearTimeout(data.flushTimer);
		data.flushTimer = undefined;
	}
	const pending = data.pending;
	if (!pending || pending.length === 0) return;
	const text = pending.length === 1 ? pending[0]! : pending.join("");
	pending.length = 0;
	data.pendingBytes = 0;
	// Bun only deflates when asked per send; without the flag every frame went out raw (RSV1=0).
	ws.send(text, true);
	if (ws.getBufferedAmount() > BACKPRESSURE_HIGH) data.upstream?.pause();
}

// ---------------------------------------------------------------------------
// Route matcher: GET /ws/:instanceId
// ---------------------------------------------------------------------------

const WS_PATH_RE = /^\/ws\/([a-zA-Z0-9_-]+)$/;
const COMMANDS_HASH_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Attempt to upgrade an incoming request to a WebSocket relay.
 *
 * Returns:
 *  - `null`      when the path does not match `/ws/:instanceId`
 *  - `Response`  (404) when `resolve` cannot find the instance
 *  - `undefined` when the upgrade succeeded (`server.upgrade` was called)
 */
export function upgradeRelay(
	req: Request,
	url: URL,
	server: Server<RelayData>,
	resolve: (instanceId: string) => RelayTarget | null,
): Response | null | undefined {
	const m = WS_PATH_RE.exec(url.pathname);
	if (!m) return null;

	const instanceId = m[1]!;
	const target = resolve(instanceId);
	if (!target) {
		return new Response("not found", { status: 404 });
	}

	const commands = url.searchParams.get("commands");
	const data: RelayData = { target };
	if (commands && COMMANDS_HASH_RE.test(commands)) data.commandsHash = commands;
	const ok = server.upgrade(req, { data });
	if (!ok) {
		return new Response("upgrade failed", { status: 500 });
	}
	// Bun returns true when upgrade succeeded; the caller should return
	// undefined so fetch() returns nothing (Bun convention).
	return undefined;
}

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

export const relayWebSocketHandler: WebSocketHandler<RelayData> = {
	// Measured 2026-10-08: Bun's "dedicated" compressor resets its window per message just like "shared",
	// so five identical 1.4KB messages each deflate to the same size. Coalescing (flushPending) is what
	// lets deflate exploit the repeated streamed content.
	perMessageDeflate: { compress: "dedicated", decompress: true },
	open(ws) {
		const { target } = ws.data;
		ws.data.decoder = new TextDecoder("utf-8");
		ws.data.pending = [];
		ws.data.pendingBytes = 0;

		// Connect to the upstream Unix socket.
		const upstream = net.connect(target.endpoint);
		ws.data.upstream = upstream;

		upstream.on("error", () => {
			flushPending(ws);
			ws.data.decoder = undefined;
			ws.close(1011, "upstream unavailable");
		});

		upstream.on("connect", () => {
			// Send the auth line per contract C.
			upstream.write(
				JSON.stringify({
					type: "auth",
					token: target.token,
					...(ws.data.commandsHash ? { commandsHash: ws.data.commandsHash } : {}),
				}) + "\n",
			);

			// Verbatim relay: rpc-client reassembles NDJSON lines. The streaming decoder only
			// keeps a multi-byte character that is split across socket chunks intact.
			upstream.on("data", (chunk: Buffer) => {
				const decoder = ws.data.decoder;
				if (!decoder) return;
				const text = decoder.decode(chunk, { stream: true });
				// Bun only deflates when asked per send; without the flag every frame went out raw (RSV1=0).
				if (text.length === 0) return;
				ws.data.pending!.push(text);
				ws.data.pendingBytes! += chunk.length;
				if (ws.data.pendingBytes! >= COALESCE_MAX_BYTES) {
					flushPending(ws);
				} else if (ws.data.flushTimer === undefined) {
					ws.data.flushTimer = setTimeout(() => flushPending(ws), COALESCE_WINDOW_MS);
				}
			});
		});

		upstream.on("close", () => {
			flushPending(ws);
			ws.data.decoder = undefined;
			ws.close(1000, "upstream closed");
		});
	},

	message(ws, message) {
		const upstream = ws.data.upstream;
		if (!upstream || !upstream.writable) return;
		if (typeof message === "string") {
			upstream.write(message);
		} else {
			// Buffer (binary message)
			upstream.write(message);
		}
	},

	drain(ws) {
		// WS buffer drained; resume the upstream socket.
		const upstream = ws.data.upstream;
		if (upstream && upstream.isPaused()) {
			upstream.resume();
		}
	},

	close(ws) {
		const upstream = ws.data.upstream;
		if (upstream) {
			upstream.destroy();
			ws.data.upstream = undefined;
		}
		// The peer is gone, so buffered text has nowhere to go; just stop the timer.
		if (ws.data.flushTimer !== undefined) clearTimeout(ws.data.flushTimer);
		ws.data.flushTimer = undefined;
		ws.data.pending = undefined;
		ws.data.decoder = undefined;
	},
};
