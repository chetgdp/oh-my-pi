/**
 * Fake RPC host for benchmarks.
 *
 * Implements:
 * 1. RPC host publishing in temporary registry dir (token authentication per contract C)
 * 2. Unix socket listener that handles handshake (ready -> negotiate_protocol -> get_state)
 * 3. Handles initial requests: get_state, history, get_agent_roster, set_agent_roster_subscription, etc.
 * 4. Streaming of generated session frames at configurable pacing (16-30ms)
 * 5. Mock get_subagent_messages for HubTranscript testing.
 */

import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { publishRpcHost, type RpcHostPublication } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { GeneratedSession } from "./lib/session-frames";

export interface FakeHostOptions {
	registryDir: string;
	session: GeneratedSession;
	paceMs?: number; // delay between stream chunks/lines
	sessionId?: string;
	sessionFile?: string;
}

export interface FakeHostHandle {
	instanceId: string;
	endpoint: string;
	token: string;
	close(): Promise<void>;
	startStreaming(): void;
	waitForStreamComplete(): Promise<void>;
}

interface IncomingRpcCommand {
	id?: string;
	type: string;
	fromByte?: number;
	[key: string]: unknown;
}

export function startFakeRpcHost(opts: FakeHostOptions): FakeHostHandle {
	const sessionId = opts.sessionId ?? opts.session.history.sessionState.sessionId;
	const sessionFile = opts.sessionFile ?? path.join(opts.registryDir, `${sessionId}.jsonl`);

	// Ensure fake session file exists
	if (!fs.existsSync(sessionFile)) {
		fs.writeFileSync(sessionFile, '{"type":"session_init"}\n');
	}

	const publication: RpcHostPublication = publishRpcHost(
		{
			sessionId,
			sessionName: "Bench Session",
			sessionFile,
			cwd: process.cwd(),
			model: "mock-bench",
			startedAt: Date.now(),
		},
		{ dir: opts.registryDir },
	);

	const { endpoint, token, entry } = publication;

	try {
		fs.rmSync(endpoint, { force: true });
	} catch {
		// ignore
	}

	const activeSockets = new Set<net.Socket>();
	let streamStarted = false;
	const streamDone = Promise.withResolvers<void>();

	const server = net.createServer(socket => {
		console.log("[fake-host] client connected to unix socket");
		activeSockets.add(socket);
		let authenticated = false;
		let lineBuffer = "";
		const sendFrame = (obj: unknown): void => {
			if (!socket.destroyed && socket.writable) {
				socket.write(JSON.stringify(obj) + "\n");
			}
		};

		socket.on("data", chunk => {
			lineBuffer += chunk.toString("utf8");
			let idx: number;
			while ((idx = lineBuffer.indexOf("\n")) !== -1) {
				const line = lineBuffer.slice(0, idx).trim();
				lineBuffer = lineBuffer.slice(idx + 1);
				if (!line) continue;
				console.log("[fake-host] socket line received:", line.slice(0, 80));
				if (!authenticated) {
					try {
						const auth = JSON.parse(line) as Record<string, unknown>;
						if (auth.type === "auth" && auth.token === token) {
							authenticated = true;
							// Send ready frame with protocol version 3
							sendFrame({
								type: "ready",
								protocolVersion: 3,
								supportedProtocolVersions: [1, 2, 3],
							});
						} else {
							console.log("[fake-host] auth mismatch, destroying socket");
							socket.destroy();
						}
					} catch (e) {
						console.log("[fake-host] auth JSON parse error, destroying socket", e);
						socket.destroy();
					}
					continue;
				}

				// Authenticated: process commands
				try {
					const req = JSON.parse(line) as IncomingRpcCommand;
					handleCommand(req, sendFrame);
				} catch {
					// ignore malformed
				}
			}
		});

		socket.on("close", hadError => {
			console.log("[fake-host] socket closed, hadError:", hadError);
			activeSockets.delete(socket);
		});

		socket.on("error", err => {
			console.log("[fake-host] socket error:", (err as Error).message);
			activeSockets.delete(socket);
		});
	});

	function handleCommand(req: IncomingRpcCommand, sendFrame: (obj: unknown) => void): void {
		const id = req.id;
		switch (req.type) {
			case "negotiate_protocol":
				sendFrame({
					id,
					type: "response",
					command: "negotiate_protocol",
					success: true,
					data: { protocolVersion: 3 },
				});
				break;
			case "get_state":
				sendFrame({
					id,
					type: "response",
					command: "get_state",
					success: true,
					data: opts.session.history.sessionState,
				});
				break;
			case "history":
				sendFrame({
					id,
					type: "response",
					command: "history",
					success: true,
					data: opts.session.history.historyResult,
				});
				break;
			case "get_agent_roster":
				sendFrame({
					id,
					type: "response",
					command: "get_agent_roster",
					success: true,
					data: { agents: opts.session.history.roster },
				});
				break;
			case "get_available_commands":
				sendFrame({
					id,
					type: "response",
					command: "get_available_commands",
					success: true,
					data: { commands: [] },
				});
				break;
			case "get_session_stats":
				sendFrame({
					id,
					type: "response",
					command: "get_session_stats",
					success: true,
					data: { tokens: 0, cost: 0 },
				});
				break;
			case "get_subagents":
				sendFrame({ id, type: "response", command: "get_subagents", success: true, data: { subagents: [] } });
				break;
			case "get_plan_state":
				sendFrame({
					id,
					type: "response",
					command: "get_plan_state",
					success: true,
					data: { state: null, review: null },
				});
				break;
			case "set_subagent_subscription":
			case "set_agent_roster_subscription":
				sendFrame({ id, type: "response", command: req.type, success: true, data: {} });
				break;
			case "get_subagent_messages": {
				const fromByte = typeof req.fromByte === "number" ? req.fromByte : 0;
				// Mock dummy subagent messages response for HubTranscript
				sendFrame({
					id,
					type: "response",
					command: "get_subagent_messages",
					success: true,
					data: {
						fileId: "mock:1",
						nextByte: fromByte + 10,
						sentinel: "mock-sentinel",
						reset: false,
						sessionFile: "/tmp/mock-subagent.jsonl",
						fromByte,
						entries: [
							{
								type: "message",
								id: `sub-msg-${fromByte}`,
								timestamp: new Date().toISOString(),
								message: {
									role: "assistant",
									content: [{ type: "text", text: `Subagent tick at byte ${fromByte}` }],
								},
							},
						],
					},
				});
				break;
			}
			default:
				sendFrame({ id, type: "response", command: req.type, success: true, data: {} });
				break;
		}
	}

	server.listen(endpoint);

	async function streamLoop(): Promise<void> {
		const pace = opts.paceMs ?? 20;
		let sentCount = 0;
		console.log(
			`[fake-host] streamLoop began, total frames: ${opts.session.stream.length}, activeSockets: ${activeSockets.size}`,
		);
		for (const rawLine of opts.session.stream) {
			while (activeSockets.size === 0) {
				console.log("[fake-host] waiting for activeSockets...");
				const { promise: pWait, resolve: rWait } = Promise.withResolvers<void>();
				setTimeout(rWait, 50);
				await pWait;
			}
			for (const sock of activeSockets) {
				if (!sock.destroyed && sock.writable) {
					sock.write(rawLine);
				}
			}
			sentCount++;
			if (sentCount % 200 === 0 || sentCount === opts.session.stream.length) {
				console.log(`[fake-host] stream progress: ${sentCount}/${opts.session.stream.length}`);
			}
			if (pace > 0) {
				const { promise, resolve } = Promise.withResolvers<void>();
				setTimeout(resolve, pace);
				await promise;
			}
		}
		streamDone.resolve();
	}

	return {
		instanceId: entry.instanceId,
		endpoint,
		token,
		startStreaming() {
			if (streamStarted) return;
			streamStarted = true;
			void streamLoop();
		},
		waitForStreamComplete() {
			return streamDone.promise;
		},
		async close() {
			for (const s of activeSockets) {
				s.destroy();
			}
			activeSockets.clear();
			const { promise, resolve } = Promise.withResolvers<void>();
			server.close(() => resolve());
			await promise;
			publication.close();
			try {
				fs.rmSync(endpoint, { force: true });
			} catch {}
		},
	};
}
