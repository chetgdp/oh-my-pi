import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/cli/args";
import { buildRpcHostRunArgs } from "../src/modes/rpc/rpc-host-launch";

describe("omp host start launch args", () => {
	it("forwards --append-system-prompt to the host child", () => {
		expect(
			buildRpcHostRunArgs({
				cwd: "/work",
				resume: "sess-1",
				prompt: "go",
				appendSystemPrompt: "/work/.omp/orchestrator.md",
				registryDir: "/reg",
			}),
		).toEqual([
			"--cwd",
			"/work",
			"--resume",
			"sess-1",
			"--prompt",
			"go",
			"--append-system-prompt",
			"/work/.omp/orchestrator.md",
			"--registry-dir",
			"/reg",
		]);
	});

	it("omits the flag when no append prompt is given", () => {
		expect(buildRpcHostRunArgs({ cwd: "/work" })).toEqual(["--cwd", "/work"]);
	});

	it("the host child's root argv yields parsed.appendSystemPrompt", () => {
		const parsed = parseArgs(["--mode", "rpc", "--cwd", "/work", "--append-system-prompt", "/work/a.md"]);
		expect(parsed.appendSystemPrompt).toBe("/work/a.md");
	});

	it("forwards --omem to the host child and the root parser", () => {
		expect(buildRpcHostRunArgs({ cwd: "/work", omem: true })).toEqual(["--cwd", "/work", "--omem"]);
		expect(parseArgs(["--mode", "rpc", "--cwd", "/work", "--omem"]).omem).toBe(true);
	});
});
