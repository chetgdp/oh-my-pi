import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import { getBaseConfigRoot } from "@oh-my-pi/pi-utils";
import { readLiveRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { DaemonOptions } from "./options";

/**
 * Connect to a live omp instance over its Unix socket, authenticate,
 * send export_html, wait for response, and return output path.
 */
export async function exportLiveSession(
	target: { endpoint: string; token: string },
	command: { outputPath: string; agentId?: string },
	timeoutMs = 30_000,
): Promise<{ path: string }> {
	const { promise, resolve, reject } = Promise.withResolvers<{ path: string }>();

	const socket = net.connect(target.endpoint);
	let buffer = "";
	let authenticated = false;

	const timer = setTimeout(() => {
		socket.destroy();
		reject(new Error("Export request timed out"));
	}, timeoutMs);

	const cleanup = (): void => {
		clearTimeout(timer);
		socket.destroy();
	};

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
		let frame: {
			type: string;
			error?: string;
			command?: string;
			success?: boolean;
			data?: { path: string };
		};
		try {
			frame = JSON.parse(line);
		} catch {
			return;
		}

		if (frame.type === "error") {
			cleanup();
			reject(new Error(frame.error ?? "unknown error"));
			return;
		}

		if (frame.type === "response" && frame.command === "export_html") {
			cleanup();
			if (frame.success && frame.data?.path) {
				resolve(frame.data);
			} else {
				reject(new Error(frame.error ?? "Export failed"));
			}
			return;
		}

		if (!authenticated && frame.type === "ready") {
			authenticated = true;
			socket.write(
				JSON.stringify({
					type: "export_html",
					outputPath: command.outputPath,
					...(command.agentId ? { agentId: command.agentId } : {}),
				}) + "\n",
			);
		}
	}

	socket.on("close", () => {
		clearTimeout(timer);
		reject(new Error("Socket closed before export response"));
	});

	socket.on("error", (err: Error) => {
		cleanup();
		reject(err);
	});

	return promise;
}

/**
 * POST /api/live/:instanceId/export
 */
export async function handleExportRequest(req: Request, url: URL, opts: DaemonOptions = {}): Promise<Response | null> {
	if (req.method !== "POST") return null;

	const match = url.pathname.match(/^\/api\/live\/([^/]+)\/export$/);
	if (!match) return null;

	const instanceId = match[1];
	const entry = await readLiveRpcHost(instanceId, { dir: opts.registryDir });
	if (!entry) {
		return new Response("not found", { status: 404 });
	}

	let agentId: string | undefined;
	try {
		const text = await req.text();
		if (text.trim().length > 0) {
			const body = JSON.parse(text) as { agentId?: string };
			if (typeof body.agentId === "string" && body.agentId.length > 0) {
				agentId = body.agentId;
			}
		}
	} catch {
		return new Response("invalid JSON body", { status: 400 });
	}

	const exportsDir = path.join(getBaseConfigRoot(), "run", "exports");
	try {
		fs.mkdirSync(exportsDir, { recursive: true, mode: 0o700 });
	} catch {
		/* best-effort */
	}

	const randomHex = crypto.randomBytes(8).toString("hex");
	const outputPath = path.join(exportsDir, `${randomHex}.html`);

	try {
		const result = await exportLiveSession({ endpoint: entry.endpoint, token: entry.token }, { outputPath, agentId });
		const htmlContent = await Bun.file(result.path).text();
		const dateStr = new Date().toISOString().slice(0, 10);
		const filenameSlug = (agentId || entry.sessionName || "session").replace(/[^a-zA-Z0-9._-]+/g, "_");
		const filename = `${filenameSlug}-${dateStr}.html`;

		return new Response(htmlContent, {
			status: 200,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"content-disposition": `attachment; filename="${filename}"`,
			},
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return new Response(message, { status: 502 });
	} finally {
		try {
			if (fs.existsSync(outputPath)) {
				fs.unlinkSync(outputPath);
			}
		} catch {
			/* best-effort */
		}
	}
}
