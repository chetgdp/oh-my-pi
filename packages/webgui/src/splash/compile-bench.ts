/**
 * `/shader?bench=compile`: times the compile and link of every splash program
 * and of patched variants of the main fragment shader, one program at a time,
 * so the costly part can be found on drivers we cannot run here (ANGLE on
 * Direct3D 11 / FXC). `?v=` picks variants: comma-separated, each a
 * `+`-joined list of patch names (e.g. `?v=shipped,lod,lod+single`).
 */
import { browserDocument, browserWindow } from "../lib/dom";
import type { GL2, GLHandle, SplashCanvas } from "./gl";
import RAW_FS from "./glsl/main.frag" with { type: "text" };
import { COMPLETION_STATUS, POLL_MS } from "./scene";
import { ASSEMBLE, EVOLVE, FFT, FS, INIT, OF, OV, QV } from "./shaders";

interface Patch {
	find: string;
	replace: string;
}

/** Exact-text patches on the unminified main.frag; a patch whose text is missing aborts its variant. */
const PATCHES: Record<string, Patch[]> = {
	// implicit-gradient texture reads inside the main loop force FXC to unroll it
	lod: [
		{
			find: "GA = texture(G0, vec2(p.x, R.y - p.y) / R); GB = texture(G1, vec2(p.x, R.y - p.y) / R);",
			replace:
				"GA = textureLod(G0, vec2(p.x, R.y - p.y) / R, 0.); GB = textureLod(G1, vec2(p.x, R.y - p.y) / R, 0.);",
		},
	],
	single: [{ find: "for (int k = 0; k < 6; k++) {", replace: "for (int k = 0; k < 1; k++) {" }],
	nogate: [{ find: "return gTrace(ro, rd, t, aa);", replace: "return t;" }],
	norocks: [{ find: "for (int i = 0; i < 3; i++) t = rTrace(ro, rd, t, aa, float(i));", replace: "" }],
	nomirror: [
		{
			find: "for (int k = 0; k < 2; k++) {\n\t\tfloat th = trace(",
			replace: "for (int k = 0; k < 1; k++) {\n\t\tfloat th = trace(",
		},
	],
	noaa: [{ find: "if (a <= 0. || ta >= (t < tw ? t - .3 : tw)) break;", replace: "break;" }],
	noglint: [{ find: "if (wsp > .02) {", replace: "if (false) {" }],
	// FXC may unroll any constant-bound loop that has no [loop]; a bound read from an unset uniform
	// (Z0 = 0) is opaque to it, so these test which unrolled loop costs the link. One per loop.
	dyngate: [{ find: "for (int i = 0; i < 48; i++) {", replace: "for (int i = 0; i < 48 + Z0; i++) {" }],
	dynrock: [{ find: "for (int k = 0; k < 40; k++) {", replace: "for (int k = 0; k < 40 + Z0; k++) {" }],
	dynoct: [{ find: "for (int k = 0; k < 3; k++) {", replace: "for (int k = 0; k < 3 + Z0; k++) {" }],
	dynnrm: [{ find: "for (int j = 0; j < 4; j++) {", replace: "for (int j = 0; j < 4 + Z0; j++) {" }],
	dynrocks: [
		{ find: "for (int i = 0; i < 3; i++) t = rTrace", replace: "for (int i = 0; i < 3 + Z0; i++) t = rTrace" },
	],
	dynpair: [
		{ find: "for (int k = 0; k < 2; k++) {", replace: "for (int k = 0; k < 2 + Z0; k++) {" },
		{ find: "for (int k = 0; k < 2; k++) {", replace: "for (int k = 0; k < 2 + Z0; k++) {" },
	],
	dynpois: [{ find: "for (int k = 0; k < 14; k++) {", replace: "for (int k = 0; k < 14 + Z0; k++) {" }],
	dynmain: [{ find: "for (int k = 0; k < 6; k++) {", replace: "for (int k = 0; k < 6 + Z0; k++) {" }],
};

/** Named sets of patches; each expands in place inside a `+`-joined spec. */
const ALIASES: Record<string, string> = {
	dynmarch: "dyngate+dynrock",
	dynloops: "dyngate+dynrock+dynoct+dynnrm+dynrocks+dynpair+dynpois",
};

const Z0_DECL: Patch = { find: "uniform vec2 P;", replace: "uniform vec2 P; uniform int Z0;" };

const DEFAULT_VARIANTS = "shipped,raw,lod,single,nogate,norocks,nomirror,noaa,noglint,lod+single,nogate+norocks";

/**
 * Shifts a hash literal by a whole number per program, so no driver or browser shader cache can answer
 * from an earlier run. Appending digits is not enough: float32 spacing at 43758 is ~.004, so the
 * translator folds a few more decimals back to the same constant.
 */
const NONCE_LITERAL = "43758.5453";

interface Row {
	name: string;
	link: number | string;
	draw: number | string;
}

function variantSource(spec: string): string {
	if (spec === "shipped") return FS;
	let src = RAW_FS;
	if (spec === "raw") return src;
	// a literal `+` in the query string arrives as a space
	const names = spec.split(/[+ ]/).flatMap(name => (ALIASES[name] ?? name).split("+"));
	const patches: [string, Patch[]][] = names.some(name => name.startsWith("dyn")) ? [["z0", [Z0_DECL]]] : [];
	for (const name of names) {
		const list = PATCHES[name];
		if (!list) throw new Error(`unknown patch ${name}`);
		patches.push([name, list]);
	}
	for (const [name, list] of patches) {
		for (const { find, replace } of list) {
			if (!src.includes(find)) throw new Error(`patch ${name}: text not found`);
			src = src.replace(find, replace);
		}
	}
	return src;
}

async function sleep(ms: number): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, ms);
	await promise;
}

/** Link time (program creation to COMPLETION_STATUS), then the first draw to a fence (pipeline creation). */
async function timeProgram(vs: string, fs: string, nonce: number): Promise<{ link: number; draw: number }> {
	const canvas = browserDocument.createElement("canvas") as unknown as SplashCanvas;
	canvas.width = 64;
	canvas.height = 64;
	const gl = canvas.getContext("webgl2", { antialias: false, alpha: false }) as GL2 | null;
	if (!gl) throw new Error("WebGL2 unavailable");
	try {
		gl.getExtension("EXT_color_buffer_float");
		const parallel = gl.getExtension("KHR_parallel_shader_compile") !== null;
		const t0 = performance.now();
		const p = gl.createProgram();
		const objs = [
			[gl.VERTEX_SHADER, vs],
			[gl.FRAGMENT_SHADER, fs.replaceAll(NONCE_LITERAL, `${43758 + nonce}.5453`)],
		].map(([type, src]) => {
			const s = gl.createShader(type as number);
			gl.shaderSource(s, src as string);
			gl.compileShader(s);
			gl.attachShader(p, s);
			return s;
		});
		gl.bindAttribLocation(p, 0, "a");
		gl.linkProgram(p);
		if (parallel) while (gl.getProgramParameter(p, COMPLETION_STATUS) !== true) await sleep(POLL_MS);
		if (gl.getProgramParameter(p, gl.LINK_STATUS) !== true) {
			const log = objs.map((s: GLHandle) => gl.getShaderInfoLog(s) ?? "").join("\n");
			throw new Error(`link failed: ${gl.getProgramInfoLog(p) ?? ""} ${log}`.slice(0, 300));
		}
		const link = performance.now() - t0;
		const t1 = performance.now();
		gl.useProgram(p);
		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		// main.frag: a view across the gate plane with every portal branch on
		gl.uniform2f(gl.getUniformLocation(p, "R"), 64, 64);
		gl.uniform1f(gl.getUniformLocation(p, "F"), 400);
		gl.uniform1f(gl.getUniformLocation(p, "L"), 33);
		gl.uniform1f(gl.getUniformLocation(p, "D"), 1);
		gl.uniform1f(gl.getUniformLocation(p, "CZ"), -2);
		gl.uniform2f(gl.getUniformLocation(p, "P"), 1, 1);
		gl.viewport(0, 0, 64, 64);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
		if (sync) {
			gl.flush();
			while (gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0) === gl.TIMEOUT_EXPIRED) await sleep(POLL_MS);
			gl.deleteSync(sync);
		}
		return { link, draw: performance.now() - t1 };
	} finally {
		(gl.getExtension("WEBGL_lose_context") as { loseContext(): void } | null)?.loseContext();
	}
}

/**
 * Translated driver source (HLSL on ANGLE/D3D11) for a vertex/fragment pair. Compiles but never links:
 * ANGLE runs FXC at link, so this returns in milliseconds and cannot freeze the tab.
 */
function translateProgram(vs: string, fs: string): { vs: string; fs: string } {
	const canvas = browserDocument.createElement("canvas") as unknown as SplashCanvas;
	const gl = canvas.getContext("webgl2", { antialias: false, alpha: false }) as GL2 | null;
	if (!gl) throw new Error("WebGL2 unavailable");
	try {
		const dbg = gl.getExtension("WEBGL_debug_shaders") as {
			getTranslatedShaderSource(s: GLHandle): string;
		} | null;
		if (!dbg) throw new Error("WEBGL_debug_shaders unavailable");
		const translate = (type: number, src: string) => {
			const s = gl.createShader(type);
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (gl.getShaderParameter(s, gl.COMPILE_STATUS) !== true) {
				throw new Error(`compile failed: ${gl.getShaderInfoLog(s) ?? ""}`.slice(0, 300));
			}
			return dbg.getTranslatedShaderSource(s);
		};
		return { vs: translate(gl.VERTEX_SHADER, vs), fs: translate(gl.FRAGMENT_SHADER, fs) };
	} finally {
		(gl.getExtension("WEBGL_lose_context") as { loseContext(): void } | null)?.loseContext();
	}
}

async function paint(): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	requestAnimationFrame(() => setTimeout(resolve, 0));
	await promise;
}

/** `?hlsl=1`: translated sources per variant (download each, or send all to the daemon), plus size and loop markers. */
async function dumpTranslated(specs: string[], head: string[], out: { textContent: string }): Promise<void> {
	const lines = [
		...head,
		"",
		`${"variant".padEnd(22)} ${"fs lines".padStart(9)} ${"fs bytes".padStart(10)} ${"loops".padStart(6)} ${"[unroll]".padStart(9)}`,
	];
	const blobs: [string, Blob][] = [];
	for (const spec of specs) {
		// a hang in one step must leave its name on screen
		out.textContent = [...lines, "", `translating ${spec} ...`].join("\n");
		await paint();
		try {
			const t = translateProgram(QV, variantSource(spec));
			const loops = (t.fs.match(/\b(for|while)\s*\(/g) ?? []).length;
			const unroll = (t.fs.match(/\[unroll/g) ?? []).length;
			lines.push(
				`${spec.padEnd(22)} ${String(t.fs.split("\n").length).padStart(9)} ${String(t.fs.length).padStart(10)} ${String(loops).padStart(6)} ${String(unroll).padStart(9)}`,
			);
			const blob = new Blob(
				[
					`// ${head.join("\n// ")}\n// variant ${spec}\n\n// ---- vertex ----\n${t.vs}\n\n// ---- fragment ----\n${t.fs}\n`,
				],
				{ type: "text/plain" },
			);
			blobs.push([spec, blob]);
			const a = browserDocument.createElement("a") as unknown as {
				href: string;
				download: string;
				textContent: string;
				style: { cssText: string };
			};
			a.href = URL.createObjectURL(blob);
			a.download = `splash-${spec}.hlsl.txt`;
			a.textContent = `download ${a.download}`;
			a.style.cssText = "display:block;margin:4px 12px;color:#8cf;font:13px ui-monospace,monospace";
			browserDocument.body.appendChild(a);
		} catch (err) {
			lines.push(`${spec.padEnd(22)} ${err instanceof Error ? err.message : "error"}`);
		}
	}
	out.textContent = [...lines, "", "done"].join("\n");
	if (blobs.length === 0) return;
	const send = browserDocument.createElement("button") as unknown as {
		textContent: string;
		style: { cssText: string };
		onclick: () => void;
	};
	send.textContent = "send all to server";
	send.style.cssText = "display:block;margin:8px 12px;font:13px ui-monospace,monospace";
	send.onclick = async () => {
		const results: string[] = [];
		for (const [spec, blob] of blobs) {
			try {
				const res = await fetch(`/api/shader-dump?name=${encodeURIComponent(spec)}`, {
					method: "POST",
					body: blob,
				});
				results.push(`sent ${spec}: HTTP ${res.status} ${await res.text()}`);
			} catch (err) {
				results.push(`sent ${spec}: ${err instanceof Error ? err.message : "error"}`);
			}
		}
		out.textContent = [...lines, "", "done", ...results].join("\n");
	};
	browserDocument.body.appendChild(send);
}

/** Mount the bench over the page body; called from main.tsx on `/shader?bench=compile`. */
export async function startCompileBench(): Promise<void> {
	// #root keeps its full-viewport box when emptied, which pushed the output below an unscrollable fold
	const root = browserDocument.getElementById("root") as unknown as { style: { display: string } } | null;
	if (root) root.style.display = "none";
	const out = browserDocument.createElement("pre") as unknown as {
		style: { cssText: string };
		textContent: string;
	};
	out.style.cssText = "margin:12px;color:#eee;background:#111;font:13px ui-monospace,monospace;white-space:pre-wrap";
	browserDocument.body.appendChild(out);
	out.textContent = "bench loaded, probing WebGL ...";
	await paint();
	// whole-number offsets stay exact in float32 below 2^24: page nonce x 1000 + row
	const nonce = Math.floor(Math.random() * 1e4);
	const head = [`${browserWindow.navigator.userAgent}`, `nonce ${nonce}`];
	const probe = (browserDocument.createElement("canvas") as unknown as SplashCanvas).getContext("webgl2", {
		antialias: false,
		alpha: false,
	});
	const info = probe?.getExtension("WEBGL_debug_renderer_info");
	if (probe && info) head.push(String(probe.getParameter(info.UNMASKED_RENDERER_WEBGL as number)));
	(probe?.getExtension("WEBGL_lose_context") as { loseContext(): void } | null)?.loseContext();
	const rows: Row[] = [];
	const render = (status: string) => {
		const lines = rows.map(r => `${r.name.padEnd(22)} ${String(r.link).padStart(10)} ${String(r.draw).padStart(10)}`);
		out.textContent = [
			...head,
			"",
			`${"program".padEnd(22)} ${"link ms".padStart(10)} ${"draw ms".padStart(10)}`,
			...lines,
			"",
			status,
		].join("\n");
	};
	const run = async (name: string, vs: string, fs: string) => {
		render(`running ${name} ...`);
		// without KHR_parallel_shader_compile (Firefox) the link blocks the main thread: paint the status first
		const { promise, resolve } = Promise.withResolvers<void>();
		requestAnimationFrame(() => setTimeout(resolve, 0));
		await promise;
		try {
			// a per-row nonce: a repeated variant must not be answered from this page's own earlier compile
			const r = await timeProgram(vs, fs, nonce * 1000 + rows.length + 1);
			rows.push({ name, link: r.link.toFixed(0), draw: r.draw.toFixed(0) });
		} catch (err) {
			rows.push({ name, link: err instanceof Error ? err.message : "error", draw: "" });
		}
	};
	const others: [string, string, string][] = [
		["init", QV, INIT],
		["evolve", QV, EVOLVE],
		["fft", QV, FFT],
		["assemble", QV, ASSEMBLE],
		["ocean", OV, OF],
	];
	const q = new URLSearchParams(browserWindow.location.search);
	const specs = (q.get("v") || DEFAULT_VARIANTS).split(",").filter(Boolean);
	if (q.get("hlsl")) {
		await dumpTranslated(q.get("v") ? specs : ["shipped"], head, out);
		return;
	}
	for (const [name, vs, fs] of others) await run(name, vs, fs);
	for (const spec of specs) {
		let fs: string;
		try {
			fs = variantSource(spec);
		} catch (err) {
			rows.push({ name: `main:${spec}`, link: err instanceof Error ? err.message : "error", draw: "" });
			continue;
		}
		await run(`main:${spec}`, QV, fs);
	}
	render("done");
}
