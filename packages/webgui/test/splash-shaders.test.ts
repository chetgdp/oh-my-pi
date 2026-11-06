import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { generate, parse } from "@shaderfrog/glsl-parser";
import type { Scope } from "@shaderfrog/glsl-parser/parser/scope";
import { minifyShader, splashShaderPlugin } from "../scripts/splash-shaders";
import * as shaders from "../src/splash/shaders";

const SOURCES = Object.entries(shaders).filter(
	(entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].includes("void main("),
);
const NUMBER = /(?<![\w.])(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/g;

/** Uniform, in, out, attribute and varying names a shader exposes to JS or the other stage. */
function interfaceNames(src: string): string[] {
	const ast = parse(src, { quiet: true, stage: src.includes("gl_Position") ? "vertex" : "fragment" });
	const names: string[] = [];
	for (const node of ast.program) {
		if (node.type !== "declaration_statement" || node.declaration.type !== "declarator_list") continue;
		if (!/\b(uniform|in|out|attribute|varying)\b/.test(generate(node.declaration.specified_type))) continue;
		for (const d of node.declaration.declarations) names.push(d.identifier.identifier);
	}
	return names;
}

describe("splash shader minifier", () => {
	test("finds every shader", () => {
		expect(SOURCES.map(([name]) => name).sort()).toEqual([
			"ASSEMBLE",
			"EVOLVE",
			"FFT",
			"FS",
			"INIT",
			"OF",
			"OV",
			"QV",
		]);
	});

	for (const [name, src] of SOURCES) {
		test(`${name}: keeps the interface and every literal, drops comments`, () => {
			const out = minifyShader(src);
			expect(out.length).toBeLessThanOrEqual(src.length);
			expect(out).not.toMatch(/\/\/|\/\*/);
			expect(interfaceNames(out).sort()).toEqual(interfaceNames(src).sort());
			const literals = new Set(src.match(NUMBER));
			for (const lit of out.match(NUMBER) ?? []) expect(literals.has(lit)).toBe(true);
			if (src.startsWith("#version 300 es\n")) expect(out.startsWith("#version 300 es\n")).toBe(true);
		});
	}

	test("a renamed local never hides a global its function uses", () => {
		const out = minifyShader(shaders.FS);
		const ast = parse(out, { quiet: true, stage: "fragment" });
		const [global, ...locals] = ast.scopes;
		if (!global) throw new Error("no global scope");
		const globals = new Set([...Object.keys(global.bindings), ...Object.keys(global.functions)]);
		for (const scope of locals) {
			let top: Scope = scope;
			while (top.parent && top.parent !== global) top = top.parent;
			const fn = Object.values(global.functions[top.name] ?? {})[0]?.declaration;
			if (!fn) throw new Error(`no declaration for ${top.name}`);
			// identifiers of the function body that resolve to globals (not declared in any of its scopes)
			const own = new Set(
				locals
					.filter(s => {
						let t: Scope = s;
						while (t.parent && t.parent !== global) t = t.parent;
						return t === top;
					})
					.flatMap(s => Object.keys(s.bindings)),
			);
			const used = new Set(
				(generate(fn).match(/\b[A-Za-z_]\w*\b/g) ?? []).filter(n => globals.has(n) && !own.has(n)),
			);
			for (const local of Object.keys(scope.bindings)) expect(used.has(local)).toBe(false);
		}
	});

	test("the build plugin emits minified shaders and every export", async () => {
		const result = await Bun.build({
			entrypoints: [path.resolve(import.meta.dir, "../src/splash/shaders.ts")],
			plugins: [splashShaderPlugin()],
			target: "browser",
		});
		expect(result.success).toBe(true);
		const js = (await result.outputs[0]?.text()) ?? "";
		expect(js).toContain("Copyright (c) 2026 Humpalumps");
		// (Bun may print the strings as template literals: compare a line, not the quoted string)
		expect(js).toContain(minifyShader(shaders.FS).split("\n")[1] ?? "");
		for (const name of Object.keys(shaders)) expect(js).toContain(name);
		expect(js).not.toContain("// time-of-day sky");
	});
});
