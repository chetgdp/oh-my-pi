/**
 * CLI tool to attach to a running omp RPC host and optionally send a prompt.
 *
 * Usage:
 *   bun scripts/attach.ts                          # list hosts
 *   bun scripts/attach.ts --id <instanceId>        # attach
 *   bun scripts/attach.ts --pid <pid>              # attach by pid
 *   bun scripts/attach.ts --id <id> hello world    # attach and prompt
 *   bun scripts/attach.ts --registry <dir> ...     # override registry dir
 */
import * as net from "node:net";
import { parseArgs } from "node:util";

import { listLiveRpcHosts, probeRpcHost, readRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { RpcHostEntry } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";

const { values, positionals } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		id: { type: "string" },
		pid: { type: "string" },
		registry: { type: "string" },
	},
	allowPositionals: true,
	strict: true,
});

const registryOpts = values.registry ? { dir: values.registry } : undefined;

// --- List mode ---
if (!values.id && !values.pid) {
	const hosts = await listLiveRpcHosts(registryOpts);
	if (hosts.length === 0) {
		console.log("No live RPC hosts.");
	} else {
		for (const h of hosts) {
			console.log(
				`${h.instanceId}  pid=${h.pid}  cwd=${h.cwd}  name=${h.sessionName ?? "-"}  model=${h.model ?? "-"}`,
			);
		}
	}
	process.exit(0);
}

// --- Resolve target entry ---
let entry: RpcHostEntry | null = null;

if (values.id) {
	entry = readRpcHost(values.id, registryOpts);
	if (!entry) {
		console.error(`No host with instanceId "${values.id}"`);
		process.exit(1);
	}
	if (!(await probeRpcHost(entry))) {
		console.error(`Host with instanceId "${values.id}" is not responding`);
		process.exit(1);
	}
} else if (values.pid) {
	const pid = Number(values.pid);
	if (!Number.isFinite(pid)) {
		console.error(`Invalid pid: ${values.pid}`);
		process.exit(1);
	}
	const hosts = await listLiveRpcHosts(registryOpts);
	entry = hosts.find(h => h.pid === pid) ?? null;
	if (!entry) {
		console.error(`No host with pid ${pid}`);
		process.exit(1);
	}
}

if (!entry) {
	console.error("No target specified");
	process.exit(1);
}

const promptText = positionals.length > 0 ? positionals.join(" ") : undefined;

// --- Connect ---
const socket = net.connect(entry.endpoint);

let buf = "";
let authed = false;
let requestId = 0;
let waitingForAgentEnd = false;

function nextId(): string {
	return `attach-${++requestId}`;
}

function send(obj: Record<string, unknown>): void {
	socket.write(JSON.stringify(obj) + "\n");
}

function handleFrame(frame: Record<string, unknown>): void {
	console.log(JSON.stringify(frame));

	if (!authed) {
		if (frame.type === "error") {
			console.error(`Auth error: ${frame.error}`);
			socket.destroy();
			process.exit(1);
		}
		if (frame.type === "ready") {
			authed = true;
			send({
				id: nextId(),
				type: "negotiate_protocol",
				protocolVersion: 2,
			});
			send({ id: nextId(), type: "get_state" });
			if (promptText) {
				waitingForAgentEnd = true;
				send({
					id: nextId(),
					type: "prompt",
					message: promptText,
				});
			}
		}
		return;
	}

	if (frame.type === "agent_end") {
		socket.destroy();
		process.exit(0);
	}

	// If no prompt was sent, exit after get_state response
	if (!promptText && frame.type === "response" && frame.command === "get_state") {
		socket.destroy();
		process.exit(0);
	}
}

socket.on("connect", () => {
	send({ type: "auth", token: entry!.token });
});

socket.on("data", (chunk: Buffer) => {
	buf += chunk.toString();
	let idx: number;
	while ((idx = buf.indexOf("\n")) !== -1) {
		const line = buf.slice(0, idx);
		buf = buf.slice(idx + 1);
		if (line.length === 0) continue;
		try {
			const frame = JSON.parse(line) as Record<string, unknown>;
			handleFrame(frame);
		} catch {
			console.error(`Bad frame: ${line}`);
		}
	}
});

socket.on("error", (err: Error) => {
	console.error(`Socket error: ${err.message}`);
	process.exit(1);
});

socket.on("close", () => {
	if (waitingForAgentEnd) {
		process.exit(1);
	}
	process.exit(0);
});
