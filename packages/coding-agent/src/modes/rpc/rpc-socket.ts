/**
 * Unix-domain socket server for the RPC protocol.
 *
 * Binds a native `IpcServer` (raw framing) to the registry endpoint, performs
 * per-connection token authentication (contract C), then hands off to
 * {@link serveRpc}.
 */
import { Writable } from "node:stream";
import { type IpcConnection, IpcServer } from "@oh-my-pi/pi-natives";
import { logger, Snowflake } from "@oh-my-pi/pi-utils";
import type { AgentSession } from "../../session/agent-session";
import type { EventBus } from "../../utils/event-bus";
import {
	type RpcHostKind,
	type RpcHostSnapshot,
	type RpcRegistryOptions,
	publishRpcHost,
	tokenMatches,
} from "./rpc-registry";
import type { RpcGoalController } from "./rpc-goal";
import { isRpcIdentityToken, parseRpcClientSurface, type RpcConnectionIdentity } from "./rpc-host-driver";
import type {
	RpcServeDriver,
	RpcServerHandle,
	RpcSessionGuard,
	RpcSharedExtensionRequests,
	serveRpc,
} from "./rpc-server";
import { trackRpcSubagents } from "./rpc-subagents";

export type RpcServeFn = typeof serveRpc;

/** Max bytes for the auth line (including the trailing newline). */
const AUTH_LINE_MAX_BYTES = 4096;
/** Auth handshake timeout in milliseconds. */
const AUTH_TIMEOUT_MS = 5_000;
/** How long `stop()` lets a client read pending frames before destroying its connection. */
const SOCKET_END_GRACE_MS = 500;

export interface RpcSocketServer {
	endpoint: string;
	instanceId: string;
	update(snapshot: RpcHostSnapshot): void;
	stop(): Promise<void>;
	/**
	 * Refuse new connections (probes then see the host as gone) while existing
	 * ones keep running. Idempotent; resolves once the listener has closed.
	 * Accepted connections stay open; `stop()` closes those.
	 */
	stopAccepting(): Promise<void>;
}

/**
 * Rights granted to one authenticated connection. Absent policy = a client
 * beside the TUI, which keeps goals and extension UI for itself.
 */
export interface RpcSocketConnectionRights {
	ownsSession: boolean;
	/** Shared goal controller owned by the host process. */
	goalController?: RpcGoalController;
	/** Process-owned extension UI requests this connection may answer. */
	sharedExtensionRequests?: RpcSharedExtensionRequests;
	sessionGuard?: RpcSessionGuard;
	/** Session host: driver bookkeeping for this connection. */
	driver?: RpcServeDriver;
	/** Connection is ready to receive frames; `output` encodes for its negotiated protocol. */
	ready(output: (frame: object) => void): void;
	closed(): void;
}

export interface RpcSocketServerOptions {
	snapshot: RpcHostSnapshot;
	subagentEventBus?: EventBus;
	onShutdown: () => Promise<void> | void;
	registryDir?: string;
	serve: RpcServeFn;
	/** Recorded in the registry entry; omitted keeps the field absent (TUI). */
	kind?: RpcHostKind;
	/**
	 * Headless host: decides each connection's rights from the identity in its
	 * auth line, or refuses it (an error frame with `code`, then close).
	 */
	openConnection?: (identity: RpcConnectionIdentity) => RpcSocketConnectionRights | RpcSocketRefusal;
}

/** Auth-time refusal: written as `{type:"error", error, code, instanceId?}` before the socket closes. */
export interface RpcSocketRefusal {
	refused: true;
	code: string;
	error: string;
	instanceId?: string;
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
	if (opts.subagentEventBus) trackRpcSubagents(opts.subagentEventBus);
	const registryOpts: RpcRegistryOptions = { dir: opts.registryDir, kind: opts.kind };
	const publication = publishRpcHost(opts.snapshot, registryOpts);

	const { endpoint, token, entry } = publication;

	interface TrackedConnection {
		conn: IpcConnection;
		handle?: RpcServerHandle;
		cancelAuth: () => void;
		closed: Promise<void>;
	}
	// Every accepted connection, authenticated or not, so stop() can close them all.
	const connections = new Set<TrackedConnection>();
	let stopping = false;

	const onConnection = (conn: IpcConnection): void => {
		const feed: ConnectionFeed = { chunk: () => {}, close: () => {} };
		const closed = Promise.withResolvers<void>();
		const tracked: TrackedConnection = { conn, cancelAuth: () => {}, closed: closed.promise };
		connections.add(tracked);
		conn.startRaw(
			chunk => feed.chunk(chunk),
			reason => {
				feed.close(reason);
				connections.delete(tracked);
				closed.resolve();
			},
		);
		if (stopping) {
			writeErrorAndClose(conn, "host stopping", { code: "host_stopping" });
			return;
		}
		tracked.cancelAuth = handleSocketAuth(conn, feed, token, auth => {
			if (stopping) {
				writeErrorAndClose(conn, "host stopping", { code: "host_stopping" });
				return;
			}
			const opened = opts.openConnection?.(auth.identity);
			if (opened && "refused" in opened) {
				writeErrorAndClose(conn, opened.error, { code: opened.code, instanceId: opened.instanceId });
				return;
			}
			const rights = opened;
			const input = buildInputStream(conn, feed, auth.leftover);
			const output = createIpcWritable(conn);

			const handle = opts.serve(
				session,
				{ input: input.stream, output },
				{
					transport: "socket",
					subagentEventBus: opts.subagentEventBus,
					onShutdown: opts.onShutdown,
					onWriteFailure: () => conn.destroy(),
					// Beside a TUI, the TUI owns the session's goal reattach and continuation.
					ownsSession: rights?.ownsSession ?? false,
					goalController: rights?.goalController,
					knownCommandsHash: auth.commandsHash,
					sharedExtensionRequests: rights?.sharedExtensionRequests,
					sessionGuard: rights?.sessionGuard,
					driver: rights?.driver,
					onReady: rights
						? async ({ output }) => {
								rights.ready(output);
							}
						: undefined,
				},
			);
			tracked.handle = handle;

			feed.close = reason => {
				input.finish(reason);
				// Makes the Writable emit close so RpcOutputWriter discards its spool;
				// held writes already failed when the native side closed the connection.
				output.destroy();
				handle.close();
				rights?.closed();
			};
		});
	};

	let server: IpcServer;
	try {
		server = await IpcServer.listen(endpoint, { framing: "raw" }, onConnection);
	} catch (err) {
		publication.close();
		throw err;
	}

	let serverClosed: Promise<void> | undefined;
	const stopAccepting = (): Promise<void> => {
		serverClosed ??= server.close();
		return serverClosed;
	};

	return {
		endpoint,
		instanceId: entry.instanceId,
		update(snapshot: RpcHostSnapshot): void {
			publication.update(snapshot);
		},
		stopAccepting,
		async stop(): Promise<void> {
			stopping = true;
			const accepting = stopAccepting();
			const all = Array.from(connections);
			for (const tracked of all) tracked.cancelAuth();

			// End connections gracefully so frames already sent (the shutdown
			// notice) flush, bounded by SOCKET_END_GRACE_MS, then destroy so the
			// ReadableStream feeding serveRpc ends and the reader releases its
			// lock before handle.close() cancels the underlying stream.
			await Promise.all(
				all.map(async tracked => {
					const { conn } = tracked;
					if (!conn.closed) {
						conn.end();
						const { promise: grace, resolve } = Promise.withResolvers<void>();
						const timer = setTimeout(resolve, SOCKET_END_GRACE_MS);
						await Promise.race([tracked.closed, grace]);
						clearTimeout(timer);
					}
					conn.destroy();
				}),
			);

			// Give the event loop a tick so the stream end propagates and the
			// reader releases its lock before handle.close() tries to cancel it.
			await new Promise<void>(r => setImmediate(r));

			for (const tracked of all) tracked.handle?.close();
			connections.clear();

			publication.close();

			await accepting;
		},
	};
}

/**
 * Receivers for one connection's native callbacks. `startRaw` takes its
 * callbacks once, so each phase (auth, then the RPC input stream) swaps them.
 */
interface ConnectionFeed {
	chunk(chunk: Uint8Array): void;
	close(reason: string | null): void;
}

/**
 * Node `Writable` over a raw `IpcConnection`. The write callback is held
 * until `drained()` once the native send window is full, so the Writable
 * buffers and `serveRpc`'s output writer spools instead of host memory growing.
 */
export function createIpcWritable(conn: IpcConnection): Writable {
	return new Writable({
		write(chunk: Uint8Array, _encoding, callback) {
			if (conn.closed) {
				callback(new Error("RPC connection closed"));
				return;
			}
			if (conn.send(chunk)) {
				callback();
				return;
			}
			conn.drained().then(
				() => callback(conn.closed ? new Error("RPC connection closed") : undefined),
				(err: unknown) => callback(err instanceof Error ? err : new Error(String(err))),
			);
		},
	});
}

// ---------------------------------------------------------------------------
// Auth handshake
// ---------------------------------------------------------------------------

interface AuthSuccess {
	leftover: Buffer;
	/** Optional `commandsHash` from the auth line: the catalog the client already caches. */
	commandsHash?: string;
	/** Client identity from the auth line; invalid or absent fields fall back to `unknown` / a generated id. */
	identity: RpcConnectionIdentity;
}

/** Returns a cancel function that clears the auth timer and ignores further input. */
function handleSocketAuth(
	conn: IpcConnection,
	feed: ConnectionFeed,
	expectedToken: string,
	onSuccess: (auth: AuthSuccess) => void,
): () => void {
	let buffer = Buffer.alloc(0);
	let settled = false;

	const timer = setTimeout(() => {
		if (settled) return;
		settled = true;
		cleanup();
		writeErrorAndClose(conn, "auth timeout");
	}, AUTH_TIMEOUT_MS);

	const cleanup = (): void => {
		clearTimeout(timer);
		feed.chunk = () => {};
		feed.close = () => {};
	};

	feed.close = (): void => {
		if (settled) return;
		settled = true;
		cleanup();
	};

	const cancelAuth = (): void => {
		if (settled) return;
		settled = true;
		cleanup();
	};

	feed.chunk = (chunk: Uint8Array): void => {
		if (settled) return;

		buffer = Buffer.concat([buffer, chunk]);
		const newlineIndex = buffer.indexOf(0x0a); // '\n'
		if (newlineIndex === -1) {
			if (buffer.length > AUTH_LINE_MAX_BYTES) {
				settled = true;
				cleanup();
				writeErrorAndClose(conn, "auth line too long");
			}
			return;
		}

		settled = true;
		cleanup();

		const line = buffer.subarray(0, newlineIndex);
		const leftover = buffer.subarray(newlineIndex + 1);

		if (line.length > AUTH_LINE_MAX_BYTES) {
			writeErrorAndClose(conn, "auth line too long");
			return;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(line.toString("utf8"));
		} catch {
			writeErrorAndClose(conn, "invalid auth frame");
			return;
		}

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			(parsed as Record<string, unknown>).type !== "auth" ||
			typeof (parsed as Record<string, unknown>).token !== "string"
		) {
			writeErrorAndClose(conn, "unauthorized");
			return;
		}

		const presentedToken = (parsed as Record<string, unknown>).token as string;
		if (!tokenMatches(expectedToken, presentedToken)) {
			writeErrorAndClose(conn, "unauthorized");
			return;
		}

		const fields = parsed as Record<string, unknown>;
		const connectionId = Snowflake.next() as string;
		const surface = parseRpcClientSurface(fields.surface);
		const identity: RpcConnectionIdentity = {
			connectionId,
			surface,
			clientId: isRpcIdentityToken(fields.clientId) ? fields.clientId : `conn-${connectionId}`,
		};
		if (fields.attachment !== undefined) {
			// A silently dropped pane key would make the pane undetachable.
			if (!isRpcIdentityToken(fields.attachment)) {
				writeErrorAndClose(conn, "invalid attachment", { code: "invalid_attachment" });
				return;
			}
			identity.attachment = fields.attachment;
		}
		const commandsHash = fields.commandsHash;
		onSuccess({
			leftover,
			commandsHash: typeof commandsHash === "string" ? commandsHash : undefined,
			identity,
		});
	};
	return cancelAuth;
}

function writeErrorAndClose(conn: IpcConnection, error: string, extra?: { code: string; instanceId?: string }): void {
	// end() flushes queued frames first, so the refusal reaches the client before the close.
	conn.send(JSON.stringify({ type: "error", error, ...extra }) + "\n");
	conn.end();
	// A peer that never closes its side would otherwise hold the connection open.
	const timer = setTimeout(() => {
		if (!conn.closed) conn.destroy();
	}, SOCKET_END_GRACE_MS);
	timer.unref?.();
}

// ---------------------------------------------------------------------------
// Input stream construction
// ---------------------------------------------------------------------------

/**
 * Build a web `ReadableStream` that first yields any leftover bytes from the
 * auth handshake, then the connection's subsequent chunks. `finish` ends it
 * from the connection's close callback.
 */
function buildInputStream(
	conn: IpcConnection,
	feed: ConnectionFeed,
	leftover: Buffer,
): { stream: ReadableStream<Uint8Array>; finish(reason: string | null): void } {
	let controller!: ReadableStreamDefaultController<Uint8Array>;
	const stream = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;
			if (leftover.length > 0) {
				controller.enqueue(new Uint8Array(leftover));
			}
			feed.chunk = chunk => {
				try {
					controller.enqueue(chunk);
				} catch {
					/* already closed or cancelled */
				}
			};
		},
		cancel() {
			conn.destroy();
		},
	});
	return {
		stream,
		finish(reason) {
			feed.chunk = () => {};
			// A reset is still EOF to serveRpc: erroring the stream would skip its cleanup.
			if (reason !== null) logger.debug("RPC socket connection closed", { reason });
			try {
				controller.close();
			} catch {
				/* already closed or cancelled */
			}
		},
	};
}
