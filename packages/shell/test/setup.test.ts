import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { GIVERNY_MARKERS, OMP_MARKERS } from "../src/rc-block";
import { applyChanges, BASH_BODY, FISH_FUNCTION, planSetup, ZSH_BODY } from "../src/setup";

let home: string;

const run = (uninstall = false, dryRun = false) => {
	const changes = planSetup({ home, uninstall, dryRun });
	if (!dryRun) applyChanges(changes);
	return changes;
};
const read = (rel: string) => fs.readFileSync(path.join(home, rel), "utf-8");
const fishFile = () => path.join(home, ".config/fish/functions/?.fish");

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
		run();
		expect(read(".bashrc")).toContain(`${OMP_MARKERS.start}\n`);
		expect(read(".bashrc")).toContain(`${BASH_BODY}\n${OMP_MARKERS.end}\n`);
		expect(read(".bashrc").startsWith(BASH_USER)).toBe(true);
		expect(read(".zshrc")).toContain(ZSH_BODY);
		expect(read(".zshrc").startsWith(ZSH_USER)).toBe(true);
		expect(fs.readFileSync(fishFile(), "utf-8")).toBe(FISH_FUNCTION);
	});

	test("re-install is idempotent", () => {
		run();
		const snapshot = [read(".bashrc"), read(".zshrc")];
		expect(planSetup({ home, uninstall: false, dryRun: false })).toEqual([]);
		run();
		expect([read(".bashrc"), read(".zshrc")]).toEqual(snapshot);
	});

	test("dry run writes nothing", () => {
		const changes = run(false, true);
		expect(changes.length).toBe(3);
		expect(read(".bashrc")).toBe(BASH_USER);
		expect(fs.existsSync(fishFile())).toBe(false);
	});

	test("giverny installs are replaced", () => {
		fs.writeFileSync(path.join(home, ".bashrc"), `${BASH_USER}\n${GIVERNY_BASH}tail line\n`);
		fs.writeFileSync(
			path.join(home, ".zshrc"),
			`${ZSH_USER}\n${GIVERNY_MARKERS.start}\nalias ?='noglob giverny'\n${GIVERNY_MARKERS.end}\n`,
		);
		fs.mkdirSync(path.dirname(fishFile()), { recursive: true });
		fs.writeFileSync(fishFile(), "function ?\n    giverny $argv\nend\n");
		run();
		const bash = read(".bashrc");
		expect(bash).not.toContain("giverny");
		expect(bash).toContain("tail line");
		expect(bash).toContain(BASH_BODY);
		expect(read(".zshrc")).not.toContain("giverny");
		expect(fs.readFileSync(fishFile(), "utf-8")).toBe(FISH_FUNCTION);
	});

	test("uninstall restores original rc content and removes giverny", () => {
		run();
		run(true);
		expect(read(".bashrc")).toBe(BASH_USER);
		expect(read(".zshrc")).toBe(ZSH_USER);
		expect(fs.existsSync(fishFile())).toBe(false);

		fs.writeFileSync(path.join(home, ".bashrc"), `${BASH_USER}\n${GIVERNY_BASH}`);
		run(true);
		expect(read(".bashrc")).toBe(BASH_USER);
	});

	test("missing shells are skipped; foreign fish function is refused", () => {
		fs.rmSync(path.join(home, ".zshrc"));
		fs.mkdirSync(path.dirname(fishFile()), { recursive: true });
		fs.writeFileSync(fishFile(), "function ?\n    echo mine\nend\n");
		expect(() => planSetup({ home, uninstall: false, dryRun: false })).toThrow("not managed");
		fs.rmSync(fishFile());
		run();
		expect(fs.existsSync(path.join(home, ".zshrc"))).toBe(false);
		run(true);
		expect(read(".bashrc")).toBe(BASH_USER);
	});
});
