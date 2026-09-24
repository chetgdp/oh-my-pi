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
	upstream?: net.Socket;
	decoder?: TextDecoder;
}

// ---------------------------------------------------------------------------
// Backpressure cap (1 MiB)
// ---------------------------------------------------------------------------

const BACKPRESSURE_HIGH = 1 << 20;

// ---------------------------------------------------------------------------
// Route matcher: GET /ws/:instanceId
// ---------------------------------------------------------------------------

const WS_PATH_RE = /^\/ws\/([a-zA-Z0-9_-]+)$/;

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

	const data: RelayData = { target };
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
	open(ws) {
		const { target } = ws.data;
		ws.data.decoder = new TextDecoder("utf-8");

		// Connect to the upstream Unix socket.
		const upstream = net.connect(target.endpoint);
		ws.data.upstream = upstream;

		upstream.on("error", () => {
			ws.data.decoder = undefined;
			ws.close(1011, "upstream unavailable");
		});

		upstream.on("connect", () => {
			// Send the auth line per contract C.
			upstream.write(JSON.stringify({ type: "auth", token: target.token }) + "\n");

			// Verbatim relay: rpc-client reassembles NDJSON lines. The streaming decoder only
			// keeps a multi-byte character that is split across socket chunks intact.
			upstream.on("data", (chunk: Buffer) => {
				const decoder = ws.data.decoder;
				if (!decoder) return;
				const text = decoder.decode(chunk, { stream: true });
				if (text.length > 0) ws.send(text);
				// Backpressure: pause upstream if the WS send buffer is full.
				if (ws.getBufferedAmount() > BACKPRESSURE_HIGH) {
					upstream.pause();
				}
			});
		});

		upstream.on("close", () => {
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
		ws.data.decoder = undefined;
	},
};
