import * as path from "node:path";
import { getAgentDir, isEnoent } from "@oh-my-pi/pi-utils";

export interface ShellConfig {
	shell?: { render?: unknown };
	terminal?: { programStatus?: unknown };
}

/**
 * Global config only: a project `.omp/config.yml` in a cloned repo must not
 * choose a command that runs on every `?`. Reads the file directly because
 * importing the omp `Settings` module adds ~200ms to every `?` start; the
 * file names mirror `MAIN_CONFIG_FILENAMES` in coding-agent `config/settings.ts`.
 */
export async function readGlobalConfig(agentDir: string = getAgentDir()): Promise<ShellConfig | null> {
	for (const name of ["config.yml", "config.yaml"]) {
		let text: string;
		try {
			text = await Bun.file(path.join(agentDir, name)).text();
		} catch (error) {
			if (isEnoent(error)) continue;
			throw error;
		}
		return Bun.YAML.parse(text) as ShellConfig | null;
	}
	return null;
}

let cached: Promise<ShellConfig | null> | undefined;

/** One read per `?` process, shared by `shell.render` and `terminal.programStatus`. */
export function globalConfig(): Promise<ShellConfig | null> {
	cached ??= readGlobalConfig();
	return cached;
}
