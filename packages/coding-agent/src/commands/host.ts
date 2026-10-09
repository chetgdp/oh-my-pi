/**
 * `omp host start`: launch (or reuse) a headless session host and print its
 * registry identity as one JSON line. `omp host run` is the internal child.
 */
import * as path from "node:path";
import { Args, Command, Flags } from "@oh-my-pi/pi-utils/cli";
import { type Args as ParsedArgs, parseArgs, reportCliUsageError } from "../cli/args";
import { hostHelp as commandHelp } from "../cli/command-help";
import { setRpcHostRun, startRpcHost } from "../modes/rpc/rpc-host-launch";

export default class Host extends Command {
	static description = commandHelp.description;

	static args = {
		action: Args.string({ description: "start", required: true }),
	};

	static flags = {
		cwd: Flags.string({ description: "Absolute working directory for the session (default: current directory)" }),
		resume: Flags.string({ description: "Session file path or session id to resume" }),
		prompt: Flags.string({ description: "First user prompt to send once the host is ready" }),
		"registry-dir": Flags.string({ description: "Override the RPC host registry directory" }),
	};

	static examples = ["omp host start", "omp host start --cwd /path/to/project --resume <session-id>"];

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Host);
		const cwd = flags.cwd ?? process.cwd();
		if (!path.isAbsolute(cwd)) {
			process.stderr.write(`--cwd must be an absolute path: ${cwd}\n`);
			process.exitCode = 2;
			return;
		}
		const registryDir = flags["registry-dir"];

		if (args.action === "run") {
			await runHostChild(cwd, flags.resume, flags.prompt, registryDir);
			return;
		}
		if (args.action !== "start") {
			process.stderr.write(`Unknown host action: ${args.action}\n`);
			process.exitCode = 2;
			return;
		}

		try {
			const result = await startRpcHost({ cwd, resume: flags.resume, prompt: flags.prompt, registryDir });
			process.stdout.write(`${JSON.stringify(result)}\n`);
		} catch (error) {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		}
	}
}

async function runHostChild(
	cwd: string,
	resume: string | undefined,
	prompt: string | undefined,
	registryDir: string | undefined,
): Promise<void> {
	const argv = ["--mode", "rpc", "--cwd", cwd];
	if (resume) argv.push("--resume", resume);
	let parsed: ParsedArgs;
	try {
		parsed = parseArgs(argv);
	} catch (error) {
		if (reportCliUsageError(error)) {
			process.exitCode = 2;
			return;
		}
		throw error;
	}
	setRpcHostRun({ registryDir, prompt });
	// Startup boundary, as in the launch command: the session graph loads only for the child.
	const { runRootCommand } = await import("../main");
	await runRootCommand(parsed, argv);
}
