import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type EmitDeps, emitOutput, loadRenderCommand, runRenderCommand } from "../src/render";

function harness(tty: boolean, command: string, render: (cmd: string, text: string) => Promise<number>) {
	const raw: string[] = [];
	const notices: string[] = [];
	const rendered: string[] = [];
	let loads = 0;
	const deps: EmitDeps = {
		tty,
		renderCommand: async () => {
			loads++;
			return command;
		},
		runRender: async (cmd, text) => {
			rendered.push(`${cmd}:${text}`);
			return await render(cmd, text);
		},
		writeRaw: async text => {
			raw.push(text);
		},
		notice: text => notices.push(text),
	};
	return { deps, raw, notices, rendered, loads: () => loads };
}

describe("emitOutput", () => {
	test("terminal with a render command renders instead of writing raw", async () => {
		const h = harness(true, "glow", async () => 0);
		await emitOutput("# hi\n", h.deps);
		expect(h.rendered).toEqual(["glow:# hi\n"]);
		expect(h.raw).toEqual([]);
	});

	test("pipe writes raw and never loads config", async () => {
		const h = harness(false, "glow", async () => 0);
		await emitOutput("# hi\n", h.deps);
		expect(h.raw).toEqual(["# hi\n"]);
		expect(h.loads()).toBe(0);
	});

	test("terminal without a render command writes raw", async () => {
		const h = harness(true, "  ", async () => 0);
		await emitOutput("x\n", h.deps);
		expect(h.raw).toEqual(["x\n"]);
		expect(h.rendered).toEqual([]);
	});

	test("failing renderer falls back to raw with a notice", async () => {
		const h = harness(true, "nope", async () => 127);
		await emitOutput("x\n", h.deps);
		expect(h.raw).toEqual(["x\n"]);
		expect(h.notices[0]).toContain("exited 127");
	});

	test("empty output does nothing", async () => {
		const h = harness(true, "glow", async () => 0);
		await emitOutput("", h.deps);
		expect(h.raw).toEqual([]);
		expect(h.rendered).toEqual([]);
	});
});

describe("runRenderCommand", () => {
	test("feeds text on stdin and reports the command's exit code", async () => {
		expect(await runRenderCommand("grep -q needle", "hay needle hay")).toBe(0);
		expect(await runRenderCommand("grep -q needle", "hay")).toBe(1);
	});
});

describe("loadRenderCommand", () => {
	let dir: string;
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-shell-render-"));
	});
	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test("reads shell.render from the global config, config.yaml as fallback name", async () => {
		expect(await loadRenderCommand(dir)).toBe("");
		fs.writeFileSync(path.join(dir, "config.yaml"), "shell:\n  render: bat -l md\n");
		expect(await loadRenderCommand(dir)).toBe("bat -l md");
		fs.writeFileSync(path.join(dir, "config.yml"), "rpc:\n  serve: true\nshell:\n  render: glow\n");
		expect(await loadRenderCommand(dir)).toBe("glow");
	});

	test("malformed config still prints the output raw", async () => {
		fs.writeFileSync(path.join(dir, "config.yml"), "shell: [unclosed\n");
		const h = harness(true, "", async () => 0);
		h.deps.renderCommand = () => loadRenderCommand(dir);
		await emitOutput("x\n", h.deps);
		expect(h.raw).toEqual(["x\n"]);
		expect(h.notices[0]).toContain("cannot read shell.render");
	});
});
