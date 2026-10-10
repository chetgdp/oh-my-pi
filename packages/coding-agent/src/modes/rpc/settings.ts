/**
 * Settings declared by the RPC domain (see `config/registry.ts`).
 */
import { register } from "../../config/registry";

export const cfgRpcServe = register({
	id: "rpc.serve",
	type: "boolean",
	default: false,
	ui: {
		tab: "interaction",
		group: "Collab",
		label: "Serve RPC socket",
		description:
			"Serve the coding-agent RPC protocol over a per-process Unix socket beside the TUI and publish it under ~/.omp/run/rpc-hosts (used by the web GUI)",
	},
});
