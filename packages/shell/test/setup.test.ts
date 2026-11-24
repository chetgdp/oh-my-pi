import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { GIVERNY_MARKERS, OMP_MARKERS } from "../src/rc-block";
import {
	applyChanges,
	bashBody,
	boundShells,
	DEFAULT_ALIAS,
	detectShells,
	fishFunction,
	installedAliases,
	planSetup,
	type SetupOptions,
	zshBody,
} from "../src/setup";

let home: string;

// `which: () => null` keeps the planner independent of the commands on this machine.
const plan = (opts: Partial<SetupOptions> = {}) =>
	planSetup({ home, dryRun: false, uninstall: false, aliases: [], which: () => null, ...opts });
const install = (opts: Partial<SetupOptions> = {}) => {
	const changes = plan(opts);
	if (!opts.dryRun) applyChanges(changes);
	return changes;
};
const read = (rel: string) => fs.readFileSync(path.join(home, rel), "utf-8");
const fishFile = (alias: string) => path.join(home, ".config", "fish", "functions", `${alias}.fish`);
const writeFish = (alias: string, body: string) => {
	fs.mkdirSync(path.dirname(fishFile(alias)), { recursive: true });
	fs.writeFileSync(fishFile(alias), body);
};

const BASH_USER = "# user stuff\nexport PATH=/x:$PATH\n";
const ZSH_USER = "setopt foo\nalias ll='ls -l'\n";
const GIVERNY_BASH = `${GIVERNY_MARKERS.start}\n# note\nset +H\nfunction _giverny() { set +f; giverny "$@"; }\nalias ?='set -f; _giverny'\n${GIVERNY_MARKERS.end}\n`;

beforeEach(() => {
	home = fs.mkdtempSync(path.join(os.tmpdir(), "omp-shell-setup-"));
	fs.writeFileSync(path.join(home, ".bashrc"), BASH_USER);
	fs.writeFileSync(path.join(home, ".zshrc"), ZSH_USER);
	fs.mkdirSync(path.join(home, ".config/fish"), { recursive: true });
});

afterEach(() => {
	fs.rmSync(home, { recursive: true, force: true });
});

describe("setup", () => {
	test("fresh install writes all three shells", () => {
		install();
		expect(read(".bashrc")).toContain(`${OMP_MARKERS.start}\n`);
		expect(read(".bashrc")).toContain(`${bashBody([DEFAULT_ALIAS])}\n${OMP_MARKERS.end}\n`);
		expect(read(".bashrc").startsWith(BASH_USER)).toBe(true);
		expect(read(".zshrc")).toContain(zshBody([DEFAULT_ALIAS]));
		expect(read(".zshrc").startsWith(ZSH_USER)).toBe(true);
		expect(fs.readFileSync(fishFile("?"), "utf-8")).toBe(fishFunction("?"));
	});

	test("multiple aliases per shell", () => {
		install({ aliases: ["?", "@"] });
		const bash = read(".bashrc");
		expect(bash).toContain("set +H");
		expect(bash).toContain('_omp_shell() { set +f; omp-shell "$@"; }');
		expect(bash).toContain("alias '?'='set -f; _omp_shell'");
		expect(bash).toContain("alias '@'='set -f; _omp_shell'");
		expect(bash.match(/set \+H/g)?.length).toBe(1);
		expect(read(".zshrc")).toContain("alias '@'='noglob omp-shell'");
		expect(fs.readFileSync(fishFile("?"), "utf-8")).toBe(fishFunction("?"));
		expect(fs.readFileSync(fishFile("@"), "utf-8")).toBe(fishFunction("@"));
		expect(installedAliases(home, "fish").sort()).toEqual(["?", "@"].sort());
		expect(installedAliases(home, "bash").sort()).toEqual(["?", "@"].sort());
		expect(installedAliases(home, "zsh").sort()).toEqual(["?", "@"].sort());
	});

	test("installing replaces the set and drops old aliases", () => {
		install({ aliases: ["?", "@"] });
		install({ aliases: ["?"] });
		expect(fs.existsSync(fishFile("@"))).toBe(false);
		expect(fs.existsSync(fishFile("?"))).toBe(true);
		expect(read(".bashrc")).not.toContain("'@'");
		expect(read(".zshrc")).not.toContain("'@'");
		expect(read(".bashrc")).toContain("alias '?'='set -f; _omp_shell'");
		expect(read(".zshrc")).toContain("alias '?'='noglob omp-shell'");
	});

	test("dropping an alias removes only fish files omp-shell owns", () => {
		install({ aliases: ["?", "@"] });
		writeFish("x", "function x\n    echo mine\nend\n");
		install({ aliases: ["?"] });
		expect(fs.existsSync(fishFile("@"))).toBe(false);
		expect(fs.readFileSync(fishFile("x"), "utf-8")).toContain("echo mine");
	});

	test("a foreign fish file with a chosen name aborts", () => {
		writeFish("@", "function '@'\n    echo mine\nend\n");
		expect(() => plan({ aliases: ["@"] })).toThrow("not managed");
		expect(read(".bashrc")).toBe(BASH_USER);
		expect(read(".zshrc")).toBe(ZSH_USER);
		expect(fs.existsSync(fishFile("?"))).toBe(false);
	});

	test("unselected shells are untouched", () => {
		const zsh = read(".zshrc");
		install({ aliases: ["@"], shells: ["bash"] });
		expect(read(".bashrc")).toContain("alias '@'");
		expect(read(".zshrc")).toBe(zsh);
		expect(fs.existsSync(fishFile("@"))).toBe(false);

		install({ aliases: ["@"], shells: ["bash"] });
		install({ aliases: ["?"], shells: ["bash"] });
		expect(read(".bashrc")).not.toContain("alias '@'");
		expect(read(".zshrc")).toBe(zsh);
	});

	test("missing shells are skipped", () => {
		fs.rmSync(path.join(home, ".zshrc"));
		expect(detectShells(home)).toEqual(["fish", "bash"]);
		install();
		expect(fs.existsSync(path.join(home, ".zshrc"))).toBe(false);
	});

	test("dry run reports changes and writes nothing", () => {
		const changes = install({ dryRun: true, aliases: ["?", "@"] });
		expect(changes.length).toBe(4);
		expect(read(".bashrc")).toBe(BASH_USER);
		expect(read(".zshrc")).toBe(ZSH_USER);
		expect(fs.existsSync(fishFile("?"))).toBe(false);
	});

	test("re-install is idempotent", () => {
		install({ aliases: ["?", "@"] });
		const snapshot = [read(".bashrc"), read(".zshrc")];
		expect(plan({ aliases: ["?", "@"] })).toEqual([]);
		install({ aliases: ["?", "@"] });
		expect([read(".bashrc"), read(".zshrc")]).toEqual(snapshot);
	});

	test("giverny installs are replaced", () => {
		fs.writeFileSync(path.join(home, ".bashrc"), `${BASH_USER}\n${GIVERNY_BASH}tail line\n`);
		fs.writeFileSync(
			path.join(home, ".zshrc"),
			`${ZSH_USER}\n${GIVERNY_MARKERS.start}\nalias ?='noglob giverny'\n${GIVERNY_MARKERS.end}\n`,
		);
		writeFish("?", "function ?\n    giverny $argv\nend\n");
		install();
		const bash = read(".bashrc");
		expect(bash).not.toContain("giverny");
		expect(bash).toContain("tail line");
		expect(bash).toContain(bashBody([DEFAULT_ALIAS]));
		expect(read(".zshrc")).not.toContain("giverny");
		expect(fs.readFileSync(fishFile("?"), "utf-8")).toBe(fishFunction("?"));
	});

	test("validation rejects names that break the generated shell code", () => {
		const bad = ["", "a b", "a\tb", "a'b", 'a"b', "a/b", "$x", "a`b", "a;b", "a|b", "a&b", "a<b", "a>b"];
		for (const alias of bad) {
			expect(() => plan({ aliases: [alias] })).toThrow();
		}
		expect(read(".bashrc")).toBe(BASH_USER);
		expect(fs.existsSync(fishFile("?"))).toBe(false);
	});

	test("validation rejects a name that is already a command, unless omp-shell owns it", () => {
		expect(() => plan({ aliases: ["ls"], which: undefined })).toThrow("already a command");
		install({ aliases: ["@"] });
		expect(() => plan({ aliases: ["@"], which: () => "/bin/@" })).not.toThrow();
	});

	test("uninstall finds hand-made fish functions that call omp-shell", () => {
		writeFish("@", "function '@'\n    omp-shell $argv\nend\n");
		install({ aliases: ["?"] });
		const changes = install({ uninstall: true });
		expect(changes.length).toBe(3);
		expect(fs.existsSync(fishFile("@"))).toBe(false);
		expect(fs.existsSync(fishFile("?"))).toBe(false);
		expect(read(".bashrc")).toBe(BASH_USER);
		expect(read(".zshrc")).toBe(ZSH_USER);
		expect(boundShells(home)).toEqual([]);
	});

	test("uninstall can target one shell", () => {
		install({ aliases: ["?"] });
		const zsh = read(".zshrc");
		install({ uninstall: true, shells: ["bash"] });
		expect(read(".bashrc")).toBe(BASH_USER);
		expect(read(".zshrc")).toBe(zsh);
		expect(fs.existsSync(fishFile("?"))).toBe(true);
	});

	test("uninstall removes giverny bindings too", () => {
		fs.writeFileSync(path.join(home, ".bashrc"), `${BASH_USER}\n${GIVERNY_BASH}`);
		install({ uninstall: true });
		expect(read(".bashrc")).toBe(BASH_USER);
	});
});

describe("runSetup", () => {
	const setupModule = path.join(import.meta.dir, "../src/setup.ts");

	const runInChild = async (args: string[]): Promise<{ code: number; stderr: string }> => {
		// runSetup writes its plan to stderr; a static import cannot observe that stream per call, and a fresh
		// process also proves the non-interactive flags never reach for /dev/tty.
		const script = `
const { runSetup } = await import(${JSON.stringify(setupModule)});
process.exit(runSetup(${JSON.stringify(args)}, ${JSON.stringify(home)}));`;
		const proc = Bun.spawn([process.execPath, "-e", script], {
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
		return { code, stderr };
	};

	test("--alias and --shell skip the prompts and write only that shell", async () => {
		const result = await runInChild(["--setup", "--alias", "@", "--shell", "bash"]);
		expect(result.code).toBe(0);
		expect(result.stderr).toContain("write");
		expect(read(".bashrc")).toContain("alias '@'");
		expect(read(".zshrc")).toBe(ZSH_USER);
		expect(fs.existsSync(fishFile("@"))).toBe(false);
	});

	test("--dry-run never writes", async () => {
		const result = await runInChild(["--setup", "--alias", "@", "--shell", "bash", "--dry-run"]);
		expect(result.code).toBe(0);
		expect(result.stderr).toContain("would write");
		expect(read(".bashrc")).toBe(BASH_USER);
	});

	test("an invalid alias exits 1 without writing", async () => {
		const result = await runInChild(["--setup", "--alias", "a b", "--shell", "bash"]);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("invalid alias name");
		expect(read(".bashrc")).toBe(BASH_USER);
	});
});
