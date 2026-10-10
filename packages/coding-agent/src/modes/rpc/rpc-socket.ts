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
import {
	type RpcHostKind,
	type RpcHostSnapshot,
	type RpcRegistryOptions,
	publishRpcHost,
	tokenMatches,
} from "./rpc-registry";
import type { RpcGoalController } from "./rpc-goal";
import type { PendingExtensionRequest, RpcServerHandle, RpcSessionGuard, serveRpc } from "./rpc-server";
import { trackRpcSubagents } from "./rpc-subagents";

export type RpcServeFn = typeof serveRpc;

/** Max bytes for the auth line (including the trailing newline). */
const AUTH_LINE_MAX_BYTES = 4096;
/** Auth handshake timeout in milliseconds. */
const AUTH_TIMEOUT_MS = 5_000;
/** How long `stop()` lets a client read pending frames before destroying its socket. */
const SOCKET_END_GRACE_MS = 500;

export interface RpcSocketServer {
	endpoint: string;
	instanceId: string;
	update(snapshot: RpcHostSnapshot): void;
	stop(): Promise<void>;
	/**
	 * Refuse new connections (probes then see the host as gone) while existing
	 * ones keep running. Idempotent; resolves once every connection has closed.
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
	sharedExtensionRequests?: Map<string, PendingExtensionRequest>;
	sessionGuard?: RpcSessionGuard;
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
	/** Headless host: decides each connection's rights. */
	openConnection?: () => RpcSocketConnectionRights;
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

			const rights = opts.openConnection?.();
			const handle = opts.serve(
				session,
				{ input: readableInput, output: socket },
				{
					transport: "socket",
					subagentEventBus: opts.subagentEventBus,
					onShutdown: opts.onShutdown,
					onWriteFailure: () => socket.destroy(),
					// Beside a TUI, the TUI owns the session's goal reattach and continuation.
					ownsSession: rights?.ownsSession ?? false,
					goalController: rights?.goalController,
					knownCommandsHash: conn.commandsHash,
					sharedExtensionRequests: rights?.sharedExtensionRequests,
					sessionGuard: rights?.sessionGuard,
					onReady: rights
						? async ({ output }) => {
								rights.ready(output);
							}
						: undefined,
				},
			);

			const tracked = { socket, handle };
			liveConnections.add(tracked);

			socket.once("close", () => {
				handle.close();
				liveConnections.delete(tracked);
				rights?.closed();
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

	let serverClosed: Promise<void> | undefined;
	const stopAccepting = (): Promise<void> => {
		if (!serverClosed) {
			const closed = Promise.withResolvers<void>();
			server.close(() => closed.resolve());
			serverClosed = closed.promise;
		}
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
			const accepting = stopAccepting();

			// End sockets gracefully so frames already written (the shutdown
			// notice) flush, bounded by SOCKET_END_GRACE_MS, then destroy so the
			// ReadableStream feeding serveRpc ends and the reader releases its
			// lock before handle.close() cancels the underlying stream.
			await Promise.all(
				Array.from(liveConnections, async conn => {
					const { socket } = conn;
					if (!socket.destroyed) {
						const closed = Promise.withResolvers<void>();
						socket.once("close", () => closed.resolve());
						socket.end();
						const timer = setTimeout(() => closed.resolve(), SOCKET_END_GRACE_MS);
						await closed.promise;
						clearTimeout(timer);
					}
					socket.destroy();
				}),
			);

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

			await accepting;
		},
	};
}

// ---------------------------------------------------------------------------
// Auth handshake
// ---------------------------------------------------------------------------

interface AuthSuccess {
	input: net.Socket;
	leftover: Buffer;
	/** Optional `commandsHash` from the auth line: the catalog the client already caches. */
	commandsHash?: string;
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

		const commandsHash = (parsed as Record<string, unknown>).commandsHash;
		onSuccess({ input: socket, leftover, commandsHash: typeof commandsHash === "string" ? commandsHash : undefined });
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
