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

export const cfgShellRender = register({
	id: "shell.render",
	type: "string",
	default: "",
	ui: {
		tab: "interaction",
		group: "Collab",
		label: "Shell render command",
		description:
			"Command that renders `?` (omp-shell) markdown output when stdout is a terminal, e.g. `glow`. Read from global config only. Empty prints raw text",
	},
});
