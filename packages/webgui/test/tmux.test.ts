import { describe, expect, test } from "bun:test";

import { buildNewWindowArgv, newWindow, type TmuxRunner } from "../src/server/tmux";

describe("buildNewWindowArgv", () => {
	test("no args produces bare omp command", () => {
		const argv = buildNewWindowArgv("/tmp/proj", []);
		expect(argv).toEqual([
			"tmux",
			"new-window",
			"-t",
			"0:",
			"-c",
			"/tmp/proj",
			"-P",
			"-F",
			"#{window_id}",
			"--",
			"fish",
			"-C",
			"omp",
		]);
	});

	test("--resume arg is single-quoted for fish", () => {
		const argv = buildNewWindowArgv("/tmp/proj", ["--resume", "abc"]);
		expect(argv).toEqual([
			"tmux",
			"new-window",
			"-t",
			"0:",
			"-c",
			"/tmp/proj",
			"-P",
			"-F",
			"#{window_id}",
			"--",
			"fish",
			"-C",
			"omp '--resume' 'abc'",
		]);
	});

	test("single quotes in args are escaped", () => {
		const argv = buildNewWindowArgv("/tmp", ["it's"]);
		const shellCmd = argv[argv.length - 1];
		expect(shellCmd).toBe(String.raw`omp 'it\'s'`);
	});
});

describe("newWindow", () => {
	test("returns trimmed window id on success", async () => {
		const fakeRunner: TmuxRunner = async () => ({
			exitCode: 0,
			stdout: "@42\n",
			stderr: "",
		});
		const id = await newWindow(fakeRunner, "/tmp", []);
		expect(id).toBe("@42");
	});

	test("throws on nonzero exit", async () => {
		const fakeRunner: TmuxRunner = async () => ({
			exitCode: 1,
			stdout: "",
			stderr: "no server running",
		});
		await expect(newWindow(fakeRunner, "/tmp", [])).rejects.toThrow("no server running");
	});
});
