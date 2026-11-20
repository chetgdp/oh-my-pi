import * as fs from "node:fs";
import * as path from "node:path";
import { writeFileAtomically } from "@oh-my-pi/pi-coding-agent/utils/atomic-file";
import { getAgentDir, isEnoent, MAIN_CONFIG_FILENAMES, stringifyYamlConfig } from "@oh-my-pi/pi-utils";

export interface ShellConfig {
	shell?: { render?: unknown; toolLines?: unknown };
	terminal?: { programStatus?: unknown };
}

/** Result lines shown under each tool line: `default` (the TUI's collapsed count per tool), a count, or `all`. */
export type ToolLines = "default" | number | "all";

/** `default`, `all` or `0`..N; null for anything else. */
export function parseToolLines(value: unknown): ToolLines | null {
	if (value === "all" || value === "default") return value;
	const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
	return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** `shell.toolLines` from the config; `default` when unset or invalid. */
export function toolLinesOf(config: ShellConfig | null): ToolLines {
	return parseToolLines(config?.shell?.toolLines) ?? "default";
}

/** The global config file `readGlobalConfig` reads: the first that exists, else where `writeShellSetting` would create it. */
export function globalConfigPath(agentDir: string = getAgentDir()): string {
	for (const name of MAIN_CONFIG_FILENAMES) {
		const file = path.join(agentDir, name);
		if (fs.existsSync(file)) return file;
	}
	return path.join(agentDir, MAIN_CONFIG_FILENAMES[0]);
}

/**
 * Global config only: a project `.omp/config.yml` in a cloned repo must not
 * choose a command that runs on every `?`. Reads the file directly because
 * importing the omp `Settings` module adds ~200ms to every `?` start.
 */
export async function readGlobalConfig(agentDir: string = getAgentDir()): Promise<ShellConfig | null> {
	for (const name of MAIN_CONFIG_FILENAMES) {
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

/**
 * Sets `shell.<key>` in the global config, keeping every other key. Rewrites the
 * file through the same YAML serializer omp's own settings use.
 */
export async function writeShellSetting(key: string, value: unknown, agentDir: string = getAgentDir()): Promise<void> {
	let target = path.join(agentDir, MAIN_CONFIG_FILENAMES[0]);
	let config: Record<string, unknown> = {};
	for (const name of MAIN_CONFIG_FILENAMES) {
		const file = path.join(agentDir, name);
		try {
			const parsed = Bun.YAML.parse(await Bun.file(file).text());
			target = file;
			if (typeof parsed === "object" && parsed !== null) config = parsed as Record<string, unknown>;
			break;
		} catch (error) {
			if (isEnoent(error)) continue;
			throw error;
		}
	}
	const shell = typeof config.shell === "object" && config.shell !== null ? config.shell : {};
	config.shell = { ...shell, [key]: value };
	await writeFileAtomically(target, stringifyYamlConfig(config));
}

let cached: Promise<ShellConfig | null> | undefined;

/** One read per `?` process, shared by `shell.render` and `terminal.programStatus`. */
export function globalConfig(): Promise<ShellConfig | null> {
	cached ??= readGlobalConfig();
	return cached;
}
