import * as net from "node:net";
import { readRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { DaemonOptions } from "./options";

/**
 * Connect to a live omp instance over its Unix socket, authenticate,
 * send the shutdown command, and wait for the socket to close.
 *
 * Timeout is not an error: omp may take a moment to tear down.
 * If the server responds with an error frame, the returned promise rejects.
 */
export async function shutdownLiveSession(
	target: { endpoint: string; token: string },
	timeoutMs = 10_000,
): Promise<void> {
	const { promise, resolve, reject } = Promise.withResolvers<void>();

	const socket = net.connect(target.endpoint);
	let buffer = "";
	let authenticated = false;

	const timer = setTimeout(() => {
		socket.destroy();
		resolve();
	}, timeoutMs);

	socket.on("connect", () => {
		socket.write(JSON.stringify({ type: "auth", token: target.token }) + "\n");
	});

	socket.on("data", (chunk: Buffer) => {
		buffer += chunk.toString();
		let newlineIdx: number;
		while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
			const line = buffer.slice(0, newlineIdx);
			buffer = buffer.slice(newlineIdx + 1);
			handleLine(line);
		}
	});

	function handleLine(line: string): void {
		let frame: { type: string; error?: string };
		try {
			frame = JSON.parse(line);
		} catch {
			return;
		}

		if (frame.type === "error") {
			clearTimeout(timer);
			socket.destroy();
			reject(new Error(frame.error ?? "unknown error"));
			return;
		}

		if (!authenticated && frame.type === "ready") {
			authenticated = true;
			socket.write(JSON.stringify({ type: "shutdown" }) + "\n");
		}
	}

	socket.on("close", () => {
		clearTimeout(timer);
		resolve();
	});

	socket.on("error", (err: Error) => {
		clearTimeout(timer);
		reject(err);
	});

	return promise;
}

/**
 * POST /api/live/:instanceId/shutdown
 *
 * Looks up the instance in the registry, connects, sends shutdown, returns 204.
 * Returns null when the URL does not match.
 */
export async function handleShutdownRequest(
	req: Request,
	url: URL,
	opts: DaemonOptions = {},
): Promise<Response | null> {
	if (req.method !== "POST") return null;

	const match = url.pathname.match(/^\/api\/live\/([^/]+)\/shutdown$/);
	if (!match) return null;

	const instanceId = match[1];
	const entry = readRpcHost(instanceId, { dir: opts.registryDir });
	if (!entry) {
		return new Response("not found", { status: 404 });
	}

	await shutdownLiveSession({ endpoint: entry.endpoint, token: entry.token });
	return new Response(null, { status: 204 });
}
