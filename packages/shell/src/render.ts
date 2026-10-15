/**
 * Final stdout write. A terminal gets the text piped through `shell.render`
 * (e.g. `glow`); pipes and files always get the raw text so `?` composes.
 */
import * as path from "node:path";
import { getAgentDir, isEnoent } from "@oh-my-pi/pi-utils";

export interface EmitDeps {
	/** Whether stdout is a terminal. */
	tty: boolean;
	/** The configured render command; empty for none. Called only when it can be used. */
	renderCommand(): Promise<string>;
	/** Runs `command` with `text` on stdin and its output on the terminal; resolves to the exit code. */
	runRender(command: string, text: string): Promise<number>;
	writeRaw(text: string): Promise<void>;
	notice(text: string): void;
}

export async function emitOutput(text: string, deps: EmitDeps): Promise<void> {
	if (text.length === 0) return;
	let command = "";
	if (deps.tty) {
		try {
			command = (await deps.renderCommand()).trim();
		} catch (error) {
			deps.notice(`omp-shell: cannot read shell.render: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	if (command.length === 0) return await deps.writeRaw(text);
	let code: number;
	try {
		code = await deps.runRender(command, text);
	} catch (error) {
		deps.notice(
			`omp-shell: shell.render \`${command}\` failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return await deps.writeRaw(text);
	}
	if (code === 0) return;
	deps.notice(`omp-shell: shell.render \`${command}\` exited ${code}; raw output follows`);
	await deps.writeRaw(text);
}

/**
 * Global config only: a project `.omp/config.yml` in a cloned repo must not
 * choose a command that runs on every `?`. Reads the file directly because
 * importing the omp `Settings` module adds ~200ms to every `?` start; the
 * file names mirror `MAIN_CONFIG_FILENAMES` in coding-agent `config/settings.ts`.
 */
export async function loadRenderCommand(agentDir: string = getAgentDir()): Promise<string> {
	for (const name of ["config.yml", "config.yaml"]) {
		let text: string;
		try {
			text = await Bun.file(path.join(agentDir, name)).text();
		} catch (error) {
			if (isEnoent(error)) continue;
			throw error;
		}
		const config = Bun.YAML.parse(text) as { shell?: { render?: unknown } } | null;
		const value = config?.shell?.render;
		return typeof value === "string" ? value : "";
	}
	return "";
}

export async function runRenderCommand(command: string, text: string): Promise<number> {
	const child = Bun.spawn(["/bin/sh", "-c", command], {
		stdin: new TextEncoder().encode(text),
		stdout: "inherit",
		stderr: "inherit",
	});
	return await child.exited;
}
