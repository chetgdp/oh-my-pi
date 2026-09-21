/**
 * Unix-domain socket server for the RPC protocol.
 *
 * Binds a `net.Server` to the registry endpoint, performs per-connection
 * token authentication (contract C), then hands off to {@link serveRpc}.
 */
import * as fs from "node:fs";
import * as net from "node:net";
import type { AgentSession } from "../../session/agent-session";
import type { EventBus } from "../../utils/event-bus";
import { type RpcHostSnapshot, type RpcRegistryOptions, publishRpcHost, tokenMatches } from "./rpc-registry";
import type { RpcServerHandle, serveRpc } from "./rpc-server";

export type RpcServeFn = typeof serveRpc;

/** Max bytes for the auth line (including the trailing newline). */
const AUTH_LINE_MAX_BYTES = 4096;
/** Auth handshake timeout in milliseconds. */
const AUTH_TIMEOUT_MS = 5_000;

export interface RpcSocketServer {
	endpoint: string;
	instanceId: string;
	update(snapshot: RpcHostSnapshot): void;
	stop(): Promise<void>;
}

export interface RpcSocketServerOptions {
	snapshot: RpcHostSnapshot;
	subagentEventBus?: EventBus;
	onShutdown: () => Promise<void> | void;
	registryDir?: string;
	serve: RpcServeFn;
}

/**
 * Publish an RPC host entry and start a Unix-domain socket server.
 *
 * Each connecting client must authenticate with contract C before RPC
 * frames are exchanged. The returned handle exposes `stop()` to tear
 * down all connections and withdraw the registry entry.
 */
export async function startRpcSocketServer(
	session: AgentSession,
	opts: RpcSocketServerOptions,
): Promise<RpcSocketServer> {
	const registryOpts: RpcRegistryOptions | undefined = opts.registryDir ? { dir: opts.registryDir } : undefined;
	const publication = publishRpcHost(opts.snapshot, registryOpts);

	const { endpoint, token, entry } = publication;

	// Remove a stale socket file left by a crashed predecessor.
	try {
		fs.rmSync(endpoint, { force: true });
	} catch {
		/* best-effort */
	}

	const liveConnections = new Set<{
		socket: net.Socket;
		handle: RpcServerHandle;
	}>();

	const server = net.createServer(socket => {
		handleSocketAuth(socket, token, conn => {
			const readableInput = buildInputStream(socket, conn.leftover);

			const handle = opts.serve(
				session,
				{ input: readableInput, output: socket },
				{
					subagentEventBus: opts.subagentEventBus,
					onShutdown: opts.onShutdown,
					onWriteFailure: () => socket.destroy(),
					// The TUI owns the session's goal reattach and continuation.
					ownsSession: false,
				},
			);

			const tracked = { socket, handle };
			liveConnections.add(tracked);

			socket.once("close", () => {
				handle.close();
				liveConnections.delete(tracked);
			});
		});
	});

	const listening = Promise.withResolvers<void>();
	server.once("error", err => {
		publication.close();
		listening.reject(err);
	});
	server.listen(endpoint, () => listening.resolve());
	await listening.promise;

	// Owner-only access on the socket file.
	if (process.platform !== "win32") fs.chmodSync(endpoint, 0o600);

	return {
		endpoint,
		instanceId: entry.instanceId,
		update(snapshot: RpcHostSnapshot): void {
			publication.update(snapshot);
		},
		async stop(): Promise<void> {
			const serverClosed = Promise.withResolvers<void>();
			server.close(() => serverClosed.resolve());

			// Destroy sockets first so the ReadableStream feeding serveRpc
			// ends, allowing the reader to release its lock before we call
			// handle.close() (which cancels the underlying stream).
			for (const conn of liveConnections) {
				conn.socket.destroy();
			}

			// Give the event loop a tick so the stream error/end propagates
			// and the reader releases its lock before handle.close() tries
			// to cancel the stream.
			await new Promise<void>(r => setImmediate(r));

			for (const conn of liveConnections) {
				conn.handle.close();
			}
			liveConnections.clear();

			publication.close();

			try {
				fs.rmSync(endpoint, { force: true });
			} catch {
				/* best-effort */
			}

			await serverClosed.promise;
		},
	};
}

// ---------------------------------------------------------------------------
// Auth handshake
// ---------------------------------------------------------------------------

interface AuthSuccess {
	input: net.Socket;
	leftover: Buffer;
}

function handleSocketAuth(socket: net.Socket, expectedToken: string, onSuccess: (conn: AuthSuccess) => void): void {
	let buffer = Buffer.alloc(0);
	let settled = false;

	const timer = setTimeout(() => {
		if (settled) return;
		settled = true;
		writeErrorAndClose(socket, "auth timeout");
		cleanup();
	}, AUTH_TIMEOUT_MS);

	const cleanup = (): void => {
		clearTimeout(timer);
		socket.removeListener("data", onData);
		socket.removeListener("error", onError);
		socket.removeListener("close", onClose);
	};

	const onError = (): void => {
		if (settled) return;
		settled = true;
		cleanup();
		socket.destroy();
	};

	const onClose = (): void => {
		if (settled) return;
		settled = true;
		cleanup();
	};

	const onData = (chunk: Buffer): void => {
		if (settled) return;

		buffer = Buffer.concat([buffer, chunk]);

		const newlineIndex = buffer.indexOf(0x0a); // '\n'
		if (newlineIndex === -1) {
			if (buffer.length > AUTH_LINE_MAX_BYTES) {
				settled = true;
				cleanup();
				writeErrorAndClose(socket, "auth line too long");
			}
			return;
		}

		settled = true;
		cleanup();

		const line = buffer.subarray(0, newlineIndex);
		const leftover = buffer.subarray(newlineIndex + 1);

		if (line.length > AUTH_LINE_MAX_BYTES) {
			writeErrorAndClose(socket, "auth line too long");
			return;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(line.toString("utf8"));
		} catch {
			writeErrorAndClose(socket, "invalid auth frame");
			return;
		}

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			(parsed as Record<string, unknown>).type !== "auth" ||
			typeof (parsed as Record<string, unknown>).token !== "string"
		) {
			writeErrorAndClose(socket, "unauthorized");
			return;
		}

		const presentedToken = (parsed as Record<string, unknown>).token as string;
		if (!tokenMatches(expectedToken, presentedToken)) {
			writeErrorAndClose(socket, "unauthorized");
			return;
		}

		onSuccess({ input: socket, leftover });
	};

	socket.on("data", onData);
	socket.on("error", onError);
	socket.on("close", onClose);
}

function writeErrorAndClose(socket: net.Socket, error: string): void {
	try {
		socket.end(JSON.stringify({ type: "error", error }) + "\n");
	} catch {
		socket.destroy();
	}
}

// ---------------------------------------------------------------------------
// Input stream construction
// ---------------------------------------------------------------------------

/**
 * Build a web `ReadableStream` that first yields any leftover bytes from the
 * auth handshake, then pipes subsequent data from the socket.
 */
function buildInputStream(socket: net.Socket, leftover: Buffer): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			if (leftover.length > 0) {
				controller.enqueue(new Uint8Array(leftover));
			}

			socket.on("data", (chunk: Buffer) => {
				controller.enqueue(new Uint8Array(chunk));
			});

			socket.once("end", () => {
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			});

			socket.once("error", err => {
				try {
					controller.error(err);
				} catch {
					/* already errored/closed */
				}
			});
		},
		cancel() {
			socket.destroy();
		},
	});
}
