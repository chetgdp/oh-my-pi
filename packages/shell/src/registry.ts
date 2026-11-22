import {
	listRpcHosts,
	probeRpcHost,
	type RpcHostEntry,
	readRpcHost,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { HostRow } from "./tty-ui";

export type { RpcHostEntry };

/** Entry kind; registry entries written before `kind` existed are TUIs. */
export function hostKind(entry: RpcHostEntry): "tui" | "host" {
	return entry.kind ?? "tui";
}

/** Live sessions whose pid and socket both answer: headless hosts and TUIs serving RPC. The omem chat (MAIN) comes first. */
export async function listLiveHosts(dir?: string): Promise<RpcHostEntry[]> {
	const hosts = listRpcHosts(dir === undefined ? undefined : { dir });
	const alive = await Promise.all(hosts.map(entry => probeRpcHost(entry)));
	const live = hosts.filter((_, index) => alive[index]);
	return [...live.filter(entry => entry.omem === true), ...live.filter(entry => entry.omem !== true)];
}

/** The attached session if its entry exists and it still answers. */
export async function readLiveHost(instanceId: string, dir?: string): Promise<RpcHostEntry | null> {
	const entry = readRpcHost(instanceId, dir === undefined ? undefined : { dir });
	if (!entry) return null;
	return (await probeRpcHost(entry)) ? entry : null;
}

export function hostRow(entry: RpcHostEntry): HostRow {
	return {
		instanceId: entry.instanceId,
		sessionId: entry.sessionId ?? "",
		...(entry.sessionName ? { sessionName: entry.sessionName } : {}),
		cwd: entry.cwd,
		...(entry.model ? { model: entry.model } : {}),
		startedAt: entry.startedAt,
		kind: hostKind(entry),
		...(entry.omem === true ? { omem: true as const } : {}),
	};
}
