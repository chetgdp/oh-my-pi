import { describe, expect, test } from "bun:test";

import {
	buildNewWindowArgv,
	ensureSession,
	matchPidToPane,
	newWindow,
	parseListPanes,
	parseProcessTree,
	resolveSessionOrigin,
	type TmuxPaneInfo,
	type TmuxRunner,
} from "../src/server/tmux";

describe("buildNewWindowArgv", () => {
	test("no args produces bare omp command ending with '; exit' targeting ompgui:", () => {
		const argv = buildNewWindowArgv("/tmp/proj", []);
		expect(argv).toEqual([
			"tmux",
			"new-window",
			"-t",
			"ompgui:",
			"-c",
			"/tmp/proj",
			"-P",
			"-F",
			"#{window_id}",
			"--",
			"fish",
			"-C",
			"omp; exit",
		]);
	});

	test("--resume arg is single-quoted for fish with '; exit' targeting ompgui:", () => {
		const argv = buildNewWindowArgv("/tmp/proj", ["--resume", "abc"]);
		expect(argv).toEqual([
			"tmux",
			"new-window",
			"-t",
			"ompgui:",
			"-c",
			"/tmp/proj",
			"-P",
			"-F",
			"#{window_id}",
			"--",
			"fish",
			"-C",
			"omp '--resume' 'abc'; exit",
		]);
	});

	test("single quotes in args are escaped with '; exit'", () => {
		const argv = buildNewWindowArgv("/tmp", ["it's"]);
		const shellCmd = argv[argv.length - 1];
		expect(shellCmd).toBe(String.raw`omp 'it\'s'; exit`);
	});
});

describe("ensureSession", () => {
	test("session exists: returns null without calling new-session", async () => {
		const calls: string[][] = [];
		const fakeRunner: TmuxRunner = async argv => {
			calls.push(argv);
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const result = await ensureSession(fakeRunner, "ompgui");
		expect(result).toBeNull();
		expect(calls).toEqual([["has-session", "-t", "=ompgui"]]);
	});

	test("session does not exist: creates session and returns initial window id", async () => {
		const calls: string[][] = [];
		const fakeRunner: TmuxRunner = async argv => {
			calls.push(argv);
			if (argv[0] === "has-session") {
				return { exitCode: 1, stdout: "", stderr: "session not found" };
			}
			if (argv[0] === "new-session") {
				return { exitCode: 0, stdout: "@init-1\n", stderr: "" };
			}
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const result = await ensureSession(fakeRunner, "ompgui");
		expect(result).toBe("@init-1");
		expect(calls).toEqual([
			["has-session", "-t", "=ompgui"],
			["new-session", "-d", "-s", "ompgui", "-P", "-F", "#{window_id}"],
		]);
	});

	test("duplicate race: treats duplicate session as success returning null", async () => {
		const calls: string[][] = [];
		const fakeRunner: TmuxRunner = async argv => {
			calls.push(argv);
			if (argv[0] === "has-session") {
				return { exitCode: 1, stdout: "", stderr: "session not found" };
			}
			if (argv[0] === "new-session") {
				return { exitCode: 1, stdout: "", stderr: "duplicate session: ompgui" };
			}
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const result = await ensureSession(fakeRunner, "ompgui");
		expect(result).toBeNull();
		expect(calls.length).toBe(2);
	});

	test("session creation failure: throws on other errors", async () => {
		const fakeRunner: TmuxRunner = async argv => {
			if (argv[0] === "has-session") {
				return { exitCode: 1, stdout: "", stderr: "session not found" };
			}
			return { exitCode: 1, stdout: "", stderr: "out of memory" };
		};

		await expect(ensureSession(fakeRunner, "ompgui")).rejects.toThrow("out of memory");
	});
});

describe("newWindow", () => {
	test("when session exists, creates window in ompgui:, tags it, and does not kill any window", async () => {
		const calls: string[][] = [];
		const fakeRunner: TmuxRunner = async argv => {
			calls.push(argv);
			if (argv[0] === "has-session") {
				return { exitCode: 0, stdout: "", stderr: "" };
			}
			if (argv[0] === "new-window") {
				return { exitCode: 0, stdout: "@42\n", stderr: "" };
			}
			if (argv[0] === "set-option") {
				return { exitCode: 0, stdout: "", stderr: "" };
			}
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const id = await newWindow(fakeRunner, "/tmp", []);
		expect(id).toBe("@42");
		expect(calls).toEqual([
			["has-session", "-t", "=ompgui"],
			["new-window", "-t", "ompgui:", "-c", "/tmp", "-P", "-F", "#{window_id}", "--", "fish", "-C", "omp; exit"],
			["set-option", "-w", "-t", "@42", "@ompgui", "1"],
		]);
	});

	test("when session was created, kills initial dummy window after tagging new window", async () => {
		const calls: string[][] = [];
		const fakeRunner: TmuxRunner = async argv => {
			calls.push(argv);
			if (argv[0] === "has-session") {
				return { exitCode: 1, stdout: "", stderr: "no session" };
			}
			if (argv[0] === "new-session") {
				return { exitCode: 0, stdout: "@init-99\n", stderr: "" };
			}
			if (argv[0] === "new-window") {
				return { exitCode: 0, stdout: "@new-42\n", stderr: "" };
			}
			if (argv[0] === "set-option") {
				return { exitCode: 0, stdout: "", stderr: "" };
			}
			if (argv[0] === "kill-window") {
				return { exitCode: 0, stdout: "", stderr: "" };
			}
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const id = await newWindow(fakeRunner, "/tmp", []);
		expect(id).toBe("@new-42");
		expect(calls).toEqual([
			["has-session", "-t", "=ompgui"],
			["new-session", "-d", "-s", "ompgui", "-P", "-F", "#{window_id}"],
			["new-window", "-t", "ompgui:", "-c", "/tmp", "-P", "-F", "#{window_id}", "--", "fish", "-C", "omp; exit"],
			["set-option", "-w", "-t", "@new-42", "@ompgui", "1"],
			["kill-window", "-t", "@init-99"],
		]);
	});

	test("throws on nonzero exit from new-window", async () => {
		const fakeRunner: TmuxRunner = async argv => {
			if (argv[0] === "has-session") return { exitCode: 0, stdout: "", stderr: "" };
			return { exitCode: 1, stdout: "", stderr: "no server running" };
		};
		await expect(newWindow(fakeRunner, "/tmp", [])).rejects.toThrow("no server running");
	});

	test("throws on set-option failure", async () => {
		const fakeRunner: TmuxRunner = async argv => {
			if (argv[0] === "has-session") return { exitCode: 0, stdout: "", stderr: "" };
			if (argv[0] === "new-window") return { exitCode: 0, stdout: "@1\n", stderr: "" };
			return { exitCode: 1, stdout: "", stderr: "set-option failed" };
		};
		await expect(newWindow(fakeRunner, "/tmp", [])).rejects.toThrow("set-option failed");
	});
});

describe("parseListPanes", () => {
	test("parses tagged and untagged panes", () => {
		const output = `
1808 @0 
87704 @68 1
18196 @2 
12345 @5 custom_tag
`;
		const panes = parseListPanes(output);
		expect(panes).toEqual([
			{ panePid: 1808, windowId: "@0", ompgui: false },
			{ panePid: 87704, windowId: "@68", ompgui: true },
			{ panePid: 18196, windowId: "@2", ompgui: false },
			{ panePid: 12345, windowId: "@5", ompgui: true },
		]);
	});

	test("handles empty output", () => {
		expect(parseListPanes("")).toEqual([]);
		expect(parseListPanes("\n   \n")).toEqual([]);
	});
});

describe("parseProcessTree and matchPidToPane", () => {
	test("parses pid and ppid correctly", () => {
		const output = `
  100     1
  200   100
  300   200
`;
		const map = parseProcessTree(output);
		expect(map.get(100)).toBe(1);
		expect(map.get(200)).toBe(100);
		expect(map.get(300)).toBe(200);
	});

	test("matches pid through parent chain to pane pid", () => {
		const parentMap = new Map([
			[300, 200],
			[200, 100],
			[100, 1],
		]);
		const panePids = new Set([100]);

		expect(matchPidToPane(300, panePids, parentMap)).toBe(100);
		expect(matchPidToPane(200, panePids, parentMap)).toBe(100);
		expect(matchPidToPane(100, panePids, parentMap)).toBe(100);
		expect(matchPidToPane(999, panePids, parentMap)).toBeNull();
	});
});

describe("resolveSessionOrigin", () => {
	const panes: TmuxPaneInfo[] = [
		{ panePid: 100, windowId: "@1", ompgui: true },
		{ panePid: 200, windowId: "@2", ompgui: false },
	];
	const parentMap = new Map([
		[105, 100], // child of tagged pane 100
		[205, 200], // child of untagged pane 200
		[305, 300], // child of unmapped process
	]);

	test("tagged pane maps to gui", () => {
		expect(resolveSessionOrigin(105, panes, parentMap)).toBe("gui");
		expect(resolveSessionOrigin(100, panes, parentMap)).toBe("gui");
	});

	test("untagged pane maps to cli", () => {
		expect(resolveSessionOrigin(205, panes, parentMap)).toBe("cli");
		expect(resolveSessionOrigin(200, panes, parentMap)).toBe("cli");
	});

	test("no tmux / null panes maps to unknown", () => {
		expect(resolveSessionOrigin(105, null, parentMap)).toBe("unknown");
		expect(resolveSessionOrigin(105, [], parentMap)).toBe("unknown");
	});

	test("unmapped pid outside tmux maps to unknown", () => {
		expect(resolveSessionOrigin(305, panes, parentMap)).toBe("unknown");
		expect(resolveSessionOrigin(999, panes, parentMap)).toBe("unknown");
	});
});
