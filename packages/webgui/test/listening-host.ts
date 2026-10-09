import * as net from "node:net";
import {
	publishRpcHost,
	type RpcHostPublication,
	type RpcRegistryOptions,
	type RpcHostSnapshot,
} from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";

export interface ListeningHost extends RpcHostPublication {
	/** Connections accepted so far; `/api/live` probes each host once per scan. */
	connections(): number;
}

/**
 * Publishes a registry entry and binds its endpoint, because the daemon only
 * lists hosts whose socket accepts a connection.
 */
export async function publishListeningHost(
	snapshot: RpcHostSnapshot,
	opts: RpcRegistryOptions,
): Promise<ListeningHost> {
	const pub = publishRpcHost(snapshot, opts);
	let connections = 0;
	const server = net.createServer(conn => {
		connections++;
		conn.destroy();
	});
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	server.once("error", reject);
	server.listen(pub.endpoint, resolve);
	await promise;
	return {
		...pub,
		connections: () => connections,
		close() {
			server.close();
			pub.close();
		},
	};
}
