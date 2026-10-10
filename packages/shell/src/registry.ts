import {
	listRpcHosts,
	probeRpcHost,
	type RpcHostEntry,
	readRpcHost,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import type { HostRow } from "./tty-ui";

export type { RpcHostEntry };

/** Headless hosts whose pid and socket both answer; `tui` entries are not shell targets. */
export async function listLiveHosts(dir?: string): Promise<RpcHostEntry[]> {
	const hosts = listRpcHosts(dir === undefined ? undefined : { dir }).filter(entry => entry.kind === "host");
	const alive = await Promise.all(hosts.map(entry => probeRpcHost(entry)));
	return hosts.filter((_, index) => alive[index]);
}

/** The attached host if its entry exists and it still answers. */
export async function readLiveHost(instanceId: string, dir?: string): Promise<RpcHostEntry | null> {
	const entry = readRpcHost(instanceId, dir === undefined ? undefined : { dir });
	if (!entry || entry.kind !== "host") return null;
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
	};
}
