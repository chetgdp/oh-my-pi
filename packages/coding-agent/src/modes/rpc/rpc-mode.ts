import * as fs from "node:fs";
import type { AgentSession } from "../../session/agent-session";
import { formatPersistenceDurabilityFailure } from "../persistence-failure";
import { initializeExtensions } from "../runtime-init";
import { claimRpcInput } from "./rpc-input";
import { serveRpc, type RpcModeOptions } from "./rpc-server";

// Re-export everything from rpc-server so existing consumers of rpc-mode.ts
// continue to resolve all symbols from this module.
export * from "./rpc-server";

/**
 * Run in RPC mode.
 * Listens for JSON commands on stdin, outputs events and responses on stdout.
 */
export async function runRpcMode(session: AgentSession, options: RpcModeOptions = {}): Promise<never> {
	const { setToolUIContext, headless = false, subagentEventBus, input = claimRpcInput(), createLiveSession } = options;

	// Suppress terminal notifications: they write BEL/OSC sequences directly to
	// process.stdout, which the NDJSON reader merges with the next JSON line.
	process.env.PI_NOTIFICATIONS = "off";

	// Bun on Windows writes a piped process.stdout with a blocking WriteFile on the
	// JS thread and never reports backpressure, so a client that stops reading
	// stdout froze the whole worker, stdin reader included. An fd write stream
	// writes from the threadpool and reports backpressure, letting the writer spool.
	const stdout = process.platform === "win32" ? fs.createWriteStream("", { fd: 1, autoClose: false }) : process.stdout;

	const handle = serveRpc(
		session,
		{ input, output: stdout },
		{
			subagentEventBus,
			headless,
			createLiveSession,
			onReady: async ({ uiContext, requestShutdown, trackAgentMessage, output: emitFrame, errorResponse, wrapSessionChange }) => {
				setToolUIContext?.(uiContext, true);
				await initializeExtensions(session, {
					mode: "rpc",
					wrapSessionChange,
					reportSendError: (action, err) => {
						emitFrame(errorResponse(undefined, action, err.message));
					},
					reportRuntimeError: err => {
						emitFrame({
							type: "extension_error",
							extensionPath: err.extensionPath,
							event: err.event,
							error: err.error,
						});
					},
					onShutdown: requestShutdown,
					trackAgentInvokingMessage: trackAgentMessage,
					// Headless hosts get the extension runner's no-op UI: hasUI=false, dialogs resolve to defaults.
					uiContext: headless ? undefined : uiContext,
				});
			},
			onShutdown: () => disposeAndExit(),
			onWriteFailure: () => {
				void session.dispose().finally(() => process.exit(1));
			},
		},
	);

	/**
	 * Dispose the session, then end the process. A store failure still latched
	 * at dispose makes `dispose()` reject; the durability loss is mirrored on
	 * stderr and the exit code is nonzero.
	 */
	const disposeAndExit = async (): Promise<never> => {
		try {
			await session.dispose();
		} catch (error) {
			try {
				if (error instanceof Error) {
					if (!process.stderr.write(`${formatPersistenceDurabilityFailure(error.message)}\n`)) {
						const { promise, resolve } = Promise.withResolvers<void>();
						const settle = (): void => {
							process.stderr.off("drain", settle);
							process.stderr.off("error", settle);
							process.stderr.off("close", settle);
							resolve();
						};
						process.stderr.on("drain", settle);
						process.stderr.on("error", settle);
						process.stderr.on("close", settle);
						await promise;
					}
				}
			} catch {
				// A mirror that cannot be written must not cost the exit code.
			}
			process.exit(1);
		}
		process.exit(0);
	};

	await handle.closed;
	return disposeAndExit();
}
