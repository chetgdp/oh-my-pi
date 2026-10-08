import * as net from "node:net";
import * as zlib from "node:zlib";
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
	/** Client asked for `?z=deflate-raw`: downstream goes out as binary frames of one sync-flushed deflate stream. */
	compress?: boolean;
	deflate?: zlib.DeflateRaw;
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

// Fewer, larger frames: permessage-deflate (text path) only sees one frame at a time, and the
// deflate-raw stream path pays a sync-flush trailer and a frame header per batch.
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
	const deflate = data.deflate;
	if (deflate) {
		deflate.write(text);
		syncFlush(ws, deflate);
		return;
	}
	// Bun only deflates when asked per send; without the flag every frame went out raw (RSV1=0).
	ws.send(text, true);
	if (ws.getBufferedAmount() > BACKPRESSURE_HIGH) data.upstream?.pause();
}

/**
 * Sync-flushes the deflate stream and sends everything it produced as one binary frame.
 * zlib runs writes and flushes in submission order and invokes flush callbacks in that
 * order, so frames cannot interleave. `then` runs after this frame is sent.
 */
function syncFlush(ws: RelaySocket, deflate: zlib.DeflateRaw, then?: () => void): void {
	deflate.flush(zlib.constants.Z_SYNC_FLUSH, () => {
		if (ws.data.deflate !== deflate) return;
		const out: Buffer[] = [];
		let chunk: Buffer | null;
		while ((chunk = deflate.read() as Buffer | null) !== null) out.push(chunk);
		if (out.length > 0) {
			// Already deflated; permessage-deflate on top would only burn CPU.
			ws.send(out.length === 1 ? out[0]! : Buffer.concat(out), false);
			if (ws.getBufferedAmount() > BACKPRESSURE_HIGH) ws.data.upstream?.pause();
		}
		then?.();
	});
}

/** Sends pending text, then closes once the (possibly asynchronous) compressed flush has gone out. */
function flushAndClose(ws: RelaySocket, code: number, reason: string): void {
	flushPending(ws);
	ws.data.decoder = undefined;
	const deflate = ws.data.deflate;
	if (!deflate) {
		ws.close(code, reason);
		return;
	}
	syncFlush(ws, deflate, () => {
		destroyDeflate(ws);
		ws.close(code, reason);
	});
}

function destroyDeflate(ws: RelaySocket): void {
	const deflate = ws.data.deflate;
	if (!deflate) return;
	ws.data.deflate = undefined;
	deflate.destroy();
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
	if (url.searchParams.get("z") === "deflate-raw") data.compress = true;
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
	// Only the text fallback (clients without DecompressionStream deflate-raw) relies on this; binary
	// deflate-raw frames are sent uncompressed. Bun (uWS HttpResponse.h ANDs the compressor flag)
	// forces every "dedicated" size to a 3KB window (windowBits 9, memLevel 1), which keeps context but
	// measured 1.6x on coalesced traffic; the app-level stream measured ~7x.
	perMessageDeflate: { compress: "dedicated", decompress: true },
	open(ws) {
		const { target } = ws.data;
		ws.data.decoder = new TextDecoder("utf-8");
		ws.data.pending = [];
		ws.data.pendingBytes = 0;
		if (ws.data.compress) {
			// windowBits 15 is what lets later frames reference earlier transcript text; ~256 KB zlib state per socket.
			ws.data.deflate = zlib.createDeflateRaw({ level: 6, windowBits: 15, memLevel: 8 });
			ws.data.deflate.on("error", () => {
				destroyDeflate(ws);
				ws.close(1011, "compression failed");
			});
		}

		// Connect to the upstream Unix socket.
		const upstream = net.connect(target.endpoint);
		ws.data.upstream = upstream;

		upstream.on("error", () => flushAndClose(ws, 1011, "upstream unavailable"));

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

		upstream.on("close", () => flushAndClose(ws, 1000, "upstream closed"));
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
		destroyDeflate(ws);
	},
};
