/**
 * Build-time GLSL minification for the splash shaders (src/splash/shaders.ts).
 * @shaderfrog/glsl-parser parses each shader and resolves scopes; every
 * declared function, global and local is renamed (shader interface names stay:
 * uniforms, `in`/`out`/`attribute`/`varying`, builtins), then comments and
 * whitespace are dropped. Literals are emitted as written, so the GPU sees the
 * same constants. The module is evaluated in a child process (fresh on every
 * build, so `--watch` never serves stale shaders) and re-emitted with the
 * minified strings.
 */
import { generate, parse } from "@shaderfrog/glsl-parser";
import type { Scope } from "@shaderfrog/glsl-parser/parser/scope";
import { renameBindings, renameFunctions } from "@shaderfrog/glsl-parser/parser/utils";
import type { BunPlugin } from "bun";

const SHADERS = /[\\/]src[\\/]splash[\\/]shaders\.ts$/;
const INTERFACE = /\b(uniform|in|out|attribute|varying)\b/;
const RESERVED: Record<string, true> = { do: true, if: true, in: true };
const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALNUM = `${ALPHA}0123456789_`;

/** Short names in order (1 char, then 2), skipping keywords and every identifier of the source. */
function* namePool(taken: Set<string>): Generator<string> {
	for (const a of ALPHA) if (!taken.has(a)) yield a;
	for (const a of ALPHA) {
		for (const b of ALNUM) {
			const n = a + b;
			if (!taken.has(n) && !RESERVED[n]) yield n;
		}
	}
	throw new Error("splash shader minifier ran out of names");
}

/** Comments and whitespace out; a space stays only between word characters and in `- -` / `+ +`. */
function squeeze(src: string): string {
	const lines: string[] = [];
	let body = "";
	for (const line of src.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n")) {
		const code = line.replace(/\/\/.*$/, "");
		if (code.trimStart().startsWith("#")) {
			lines.push(`${body}\n${code.trim()}\n`);
			body = "";
		} else {
			body += ` ${code}`;
		}
	}
	lines.push(body);
	return lines
		.join("")
		.split(/(\n)/)
		.map(part =>
			part === "\n" || part.startsWith("#")
				? part
				: part.replace(/\s+/g, (_, offset: number, all: string) => {
						const prev = all[offset - 1] ?? "";
						const next = all[offset + _.length] ?? "";
						const word = /[\w.]/;
						if (word.test(prev) && word.test(next)) return " ";
						if ((prev === "-" || prev === "+") && prev === next) return " ";
						return "";
					}),
		)
		.join("")
		.replace(/^\n+/, "");
}

/** Minify one shader; names of the shader interface (uniforms, attributes, varyings, outputs) are unchanged. */
export function minifyShader(src: string): string {
	const ast = parse(src, { quiet: true, stage: src.includes("gl_Position") ? "vertex" : "fragment" });
	const keep = new Set(["main"]);
	for (const node of ast.program) {
		if (node.type !== "declaration_statement" || node.declaration.type !== "declarator_list") continue;
		if (!INTERFACE.test(generate(node.declaration.specified_type))) continue;
		for (const d of node.declaration.declarations) keep.add(d.identifier.identifier);
	}
	const taken = new Set(src.match(/\b[A-Za-z_]\w*\b/g));
	const [global, ...locals] = ast.scopes;
	if (!global) return squeeze(src);
	// globals and functions: unique names, most referenced first
	const globalNames = new Map<string, string>();
	const globalPool = namePool(taken);
	const entries = [
		...Object.entries(global.bindings)
			.filter(([name, e]) => e.declaration && !keep.has(name))
			.map(([name, e]) => [name, e.references.length] as const),
		...Object.entries(global.functions)
			.filter(([name, o]) => !keep.has(name) && Object.values(o).some(d => d.declaration))
			.map(([name, o]) => [name, Object.values(o).reduce((n, d) => n + d.references.length, 0)] as const),
	].sort((a, b) => b[1] - a[1]);
	for (const [name] of entries) globalNames.set(name, globalPool.next().value as string);
	global.bindings = renameBindings(global.bindings, n => globalNames.get(n) ?? n);
	global.functions = renameFunctions(global.functions, n => globalNames.get(n) ?? n);
	// locals: unique within one function (its nested blocks included); a name may repeat a global the
	// function does not reference, so the common short names go to the locals too
	const byFunction = new Map<Scope, Scope[]>();
	for (const scope of locals) {
		let top = scope;
		while (top.parent && top.parent !== global) top = top.parent;
		byFunction.set(top, [...(byFunction.get(top) ?? []), scope]);
	}
	for (const [top, scopes] of byFunction) {
		const overloads = global.functions[globalNames.get(top.name) ?? top.name];
		const declaration = overloads && Object.values(overloads)[0]?.declaration;
		if (!declaration) throw new Error(`splash shader minifier: no declaration for ${top.name}`);
		const pool = namePool(new Set([...taken, ...(generate(declaration).match(/\b[A-Za-z_]\w*\b/g) ?? [])]));
		const ranked = scopes
			.flatMap(scope =>
				Object.entries(scope.bindings)
					.filter(([, e]) => e.declaration)
					.map(([name, e]) => ({ scope, name, refs: e.references.length })),
			)
			.sort((a, b) => b.refs - a.refs);
		const names = new Map<Scope, Map<string, string>>();
		for (const { scope, name } of ranked) {
			const m = names.get(scope) ?? new Map<string, string>();
			m.set(name, pool.next().value as string);
			names.set(scope, m);
		}
		for (const [scope, m] of names) scope.bindings = renameBindings(scope.bindings, n => m.get(n) ?? n);
	}
	return squeeze(generate(ast));
}

function evaluateModule(file: string): Record<string, unknown> {
	const proc = Bun.spawnSync([
		process.execPath,
		"-e",
		`import * as m from ${JSON.stringify(file)}; process.stdout.write(JSON.stringify(m));`,
	]);
	if (proc.exitCode !== 0) throw new Error(`evaluating ${file} failed:\n${proc.stderr.toString()}`);
	return JSON.parse(proc.stdout.toString()) as Record<string, unknown>;
}

export function splashShaderPlugin(): BunPlugin {
	return {
		name: "splash-shaders",
		setup(build) {
			build.onLoad({ filter: SHADERS }, ({ path: file }) => {
				const lines = [
					"/*! Ocean shaders ported from Ultra-Water (https://github.com/Humpalumps/Ultra-Water), MIT, Copyright (c) 2026 Humpalumps */",
				];
				for (const [key, value] of Object.entries(evaluateModule(file))) {
					const out = typeof value === "string" && value.includes("void main(") ? minifyShader(value) : value;
					lines.push(`export const ${key} = ${JSON.stringify(out)};`);
				}
				return { contents: lines.join("\n"), loader: "js" };
			});
		},
	};
}
