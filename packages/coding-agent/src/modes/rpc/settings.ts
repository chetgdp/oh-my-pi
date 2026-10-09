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

export const cfgRpcHostIdleTimeoutMs = register({
	id: "rpc.hostIdleTimeoutMs",
	type: "number",
	default: 1_800_000,
	// Tests and supervisors need short lifetimes without writing a config file.
	env: {
		name: "PI_RPC_HOST_IDLE_TIMEOUT_MS",
		parse: raw => {
			const value = Number.parseInt(raw, 10);
			return Number.isFinite(value) && value > 0 ? value : undefined;
		},
	},
	ui: {
		tab: "interaction",
		group: "Collab",
		label: "Headless host idle timeout (ms)",
		description:
			"How long an `omp host` process stays alive with no connected client and no running work before it saves the session and exits",
	},
});
