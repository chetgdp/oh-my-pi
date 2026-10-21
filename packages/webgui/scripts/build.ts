import { watch as fsWatch } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { promisify } from "node:util";

const brotliCompressAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);

export interface WebguiBuildResult {
	outdir: string;
	entryFile: string;
	cssFiles: string[];
	preloadChunks: string[];
	outputs: string[];
}

/**
 * Chunks a replaced build referenced stay in dist this long after the build
 * that dropped them. A page loaded before a rebuild keeps importing its own
 * hashed lazy chunks (Pele, katex, panzoom, the agent hub); without them it
 * cannot render a diagram until the user reloads.
 */
const REPLACED_CHUNK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Bound on carried bytes, so a long `--watch` session cannot grow dist without limit. */
const REPLACED_CHUNK_MAX_BYTES = 256 * 1024 * 1024;
/** Bun names every chunk and asset `[hash].[ext]`; index.html and icons never match. */
const HASHED_NAME = /^[a-z0-9]{8}\.[a-z0-9]+$/;
/** Inside dist so it swaps with it; maps each carried chunk to when a build first dropped it. */
const CHUNK_MANIFEST = ".replaced-chunks.json";

async function readChunkManifest(dir: string): Promise<Record<string, number>> {
	try {
		const parsed: unknown = JSON.parse(await fs.readFile(path.join(dir, CHUNK_MANIFEST), "utf8"));
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const out: Record<string, number> = {};
		for (const [name, at] of Object.entries(parsed)) {
			if (HASHED_NAME.test(name) && typeof at === "number") out[name] = at;
		}
		return out;
	} catch {
		return {};
	}
}

/**
 * Hard-link the previous dist's hashed files that the new build no longer
 * produces into `outdir`, newest-replaced first, within the age and size
 * bounds. Returns the carried names (precompressed siblings included).
 */
async function carryReplacedChunks(finalDir: string, outdir: string, built: string[]): Promise<Set<string>> {
	const now = Date.now();
	const current = new Set(built);
	const previous = await readChunkManifest(finalDir);
	let names: Set<string>;
	try {
		names = new Set(await fs.readdir(finalDir));
	} catch {
		names = new Set();
	}
	const candidates: { name: string; at: number }[] = [];
	for (const name of names) {
		if (!HASHED_NAME.test(name) || current.has(name)) continue;
		// Absent from the manifest: it was live in the previous build, replaced now.
		const at = previous[name] ?? now;
		if (now - at < REPLACED_CHUNK_TTL_MS) candidates.push({ name, at });
	}
	candidates.sort((a, b) => b.at - a.at);

	const carried = new Set<string>();
	const manifest: Record<string, number> = {};
	let bytes = 0;
	for (const { name, at } of candidates) {
		const group = [name, `${name}.br`, `${name}.gz`].filter(n => names.has(n));
		const sizes = await Promise.all(group.map(async n => (await fs.stat(path.join(finalDir, n))).size));
		const size = sizes.reduce((sum, n) => sum + n, 0);
		if (bytes + size > REPLACED_CHUNK_MAX_BYTES) continue;
		bytes += size;
		for (const n of group) {
			const from = path.join(finalDir, n);
			const to = path.join(outdir, n);
			// A hard link costs no space; copy when dist sits on another filesystem.
			await fs.link(from, to).catch(() => fs.copyFile(from, to));
			carried.add(n);
		}
		manifest[name] = at;
	}
	await Bun.write(path.join(outdir, CHUNK_MANIFEST), JSON.stringify(manifest));
	carried.add(CHUNK_MANIFEST);
	return carried;
}

export async function buildWebgui(customOutdir?: string): Promise<WebguiBuildResult> {
	const pkgRoot = path.resolve(import.meta.dir, "..");
	const finalDir = customOutdir ? path.resolve(customOutdir) : path.resolve(pkgRoot, "dist");
	// Build beside the live dir and swap at the end, so a running daemon never serves a half-written dist.
	const outdir = `${finalDir}.next`;

	await fs.rm(outdir, { recursive: true, force: true });
	await fs.mkdir(outdir, { recursive: true });

	const buildResult = await Bun.build({
		entrypoints: [path.resolve(pkgRoot, "src/main.tsx")],
		outdir,
		minify: true,
		splitting: true,
		naming: {
			entry: "[hash].[ext]",
			chunk: "[hash].[ext]",
			asset: "[hash].[ext]",
		},
		define: {
			"process.env.NODE_ENV": '"production"',
		},
		target: "browser",
		metafile: true,
	});

	if (!buildResult.success) {
		const messages = buildResult.logs.map(log => log.message).join("\n");
		throw new Error(`webgui build failed:\n${messages}`);
	}

	const entryOutput = buildResult.outputs.find(o => o.kind === "entry-point");
	if (!entryOutput) {
		throw new Error("No entry-point output found in build result");
	}
	const entryFileName = path.basename(entryOutput.path);

	const cssOutputs = buildResult.outputs.filter(o => o.path.endsWith(".css"));
	const cssFiles = cssOutputs.map(o => path.basename(o.path)).sort();

	const metafile = buildResult.metafile;
	const preloadChunks: string[] = [];
	if (metafile?.outputs) {
		let entryMetaKey = `./${entryFileName}`;
		if (!metafile.outputs[entryMetaKey]) {
			for (const [key, value] of Object.entries(metafile.outputs)) {
				if (value.entryPoint && (value.entryPoint.endsWith("/main.tsx") || value.entryPoint.endsWith("main.tsx"))) {
					entryMetaKey = key;
					break;
				}
			}
		}

		const closureSet = new Set<string>();
		const queue = [entryMetaKey];
		while (queue.length > 0) {
			const curKey = queue.shift()!;
			const outputInfo = metafile.outputs[curKey];
			if (!outputInfo?.imports) continue;
			for (const imp of outputInfo.imports) {
				if (imp.kind === "import-statement") {
					const normPath = imp.path.startsWith("./") ? imp.path : `./${imp.path}`;
					if (!closureSet.has(normPath)) {
						closureSet.add(normPath);
						queue.push(normPath);
					}
				}
			}
		}
		preloadChunks.push(...Array.from(closureSet).sort());
	}

	const publicDir = path.resolve(pkgRoot, "public");
	try {
		const st = await fs.stat(publicDir);
		if (st.isDirectory()) {
			await fs.cp(publicDir, outdir, { recursive: true });
		}
	} catch {
		// Public directory is optional
	}

	for (const icon of ["favicon.svg", "apple-touch-icon.png"]) {
		const iconPath = path.resolve(pkgRoot, icon);
		try {
			await fs.copyFile(iconPath, path.resolve(outdir, icon));
		} catch {
			// Icon is optional
		}
	}

	const srcHtmlPath = path.resolve(pkgRoot, "index.html");
	const srcHtml = await Bun.file(srcHtmlPath).text();

	let html = srcHtml.replace(
		/<script\b[^>]*\bsrc=["'](?:\.\/)?src\/main\.tsx["'][^>]*>(?:<\/script>)?/i,
		`<script type="module" src="./${entryFileName}"></script>`,
	);

	const headTags: string[] = [];
	for (const css of cssFiles) {
		headTags.push(`\t\t<link rel="stylesheet" href="./${css}" />`);
	}
	for (const preload of preloadChunks) {
		const href = preload.startsWith("./") ? preload : `./${preload}`;
		headTags.push(`\t\t<link rel="modulepreload" href="${href}" />`);
	}

	if (headTags.length > 0) {
		html = html.replace(/\t*<\/head>/, `${headTags.join("\n")}\n\t</head>`);
	}

	await Bun.write(path.resolve(outdir, "index.html"), html);

	const filesToCompress: string[] = [];
	async function scanFiles(dir: string): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await scanFiles(fullPath);
			} else if (entry.isFile()) {
				if (entry.name.endsWith(".br") || entry.name.endsWith(".gz")) continue;
				const ext = path.extname(entry.name).toLowerCase();
				if (ext === ".js" || ext === ".css" || ext === ".svg" || ext === ".html") {
					const st = await fs.stat(fullPath);
					if (st.size > 1024) {
						filesToCompress.push(fullPath);
					}
				}
			}
		}
	}
	await scanFiles(outdir);

	await Promise.all(
		filesToCompress.map(async filePath => {
			const content = await fs.readFile(filePath);
			const [br, gz] = await Promise.all([
				brotliCompressAsync(content, {
					params: {
						[zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
					},
				}),
				gzipAsync(content, {
					level: 9,
				}),
			]);
			await Promise.all([Bun.write(`${filePath}.br`, br), Bun.write(`${filePath}.gz`, gz)]);
		}),
	);

	const carried = await carryReplacedChunks(
		finalDir,
		outdir,
		buildResult.outputs.map(o => path.basename(o.path)),
	);

	const oldDir = `${finalDir}.old`;
	await fs.rm(oldDir, { recursive: true, force: true });
	await fs.rename(finalDir, oldDir).catch((err: NodeJS.ErrnoException) => {
		if (err.code !== "ENOENT") throw err;
	});
	await fs.rename(outdir, finalDir);
	await fs.rm(oldDir, { recursive: true, force: true });

	const allOutputs = (await fs.readdir(finalDir)).filter(name => !carried.has(name)).sort();
	return {
		outdir: finalDir,
		entryFile: entryFileName,
		cssFiles,
		preloadChunks,
		outputs: allOutputs,
	};
}

if (import.meta.main) {
	let customOutdir: string | undefined;
	let watch = false;
	let serve = false;
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (arg === "--outdir" && i + 1 < process.argv.length) {
			customOutdir = process.argv[++i];
		} else if (arg.startsWith("--outdir=")) {
			customOutdir = arg.slice("--outdir=".length);
		} else if (arg === "--watch") {
			watch = true;
		} else if (arg === "--serve") {
			serve = true;
		}
	}

	const buildAndReport = async (): Promise<void> => {
		const start = performance.now();
		const res = await buildWebgui(customOutdir);
		const elapsed = ((performance.now() - start) / 1000).toFixed(2);
		console.log(`webgui built in ${elapsed}s:`);
		console.log(`  entry: ${res.entryFile}`);
		console.log(`  css: ${res.cssFiles.join(", ") || "(none)"}`);
		console.log(`  preloads: ${res.preloadChunks.length} chunks`);
		console.log(`  total files: ${res.outputs.length}`);

		// Smaller files have no precompressed sibling and go over the wire raw.
		const sizeOf = async (name: string, ext = ""): Promise<number> => {
			try {
				return (await fs.stat(path.join(res.outdir, name + ext))).size;
			} catch {
				return ext ? sizeOf(name) : 0;
			}
		};
		const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;
		const sum = async (names: string[]): Promise<string> => {
			let raw = 0;
			let gz = 0;
			let br = 0;
			for (const name of names) {
				raw += await sizeOf(name);
				gz += await sizeOf(name, ".gz");
				br += await sizeOf(name, ".br");
			}
			return `${kb(raw)} raw / ${kb(gz)} gzip / ${kb(br)} brotli`;
		};
		const initial = ["index.html", ...res.cssFiles, res.entryFile, ...res.preloadChunks];
		const assets = res.outputs.filter(name => !name.endsWith(".br") && !name.endsWith(".gz"));
		console.log(`  initial load: ${await sum(initial)}`);
		console.log(`  all assets: ${await sum(assets)}`);
	};

	if (!watch) {
		await buildAndReport();
	} else {
		const pkgRoot = path.resolve(import.meta.dir, "..");
		let running = false;
		let pending = false;
		let timer: Timer | undefined;
		const run = async (): Promise<void> => {
			if (running) {
				pending = true;
				return;
			}
			running = true;
			try {
				await buildAndReport();
			} catch (err) {
				// A syntax error mid-edit must not end the watcher; the last good dist stays live.
				console.error(`webgui build failed: ${err instanceof Error ? err.message : String(err)}`);
			} finally {
				running = false;
				if (pending) {
					pending = false;
					void run();
				}
			}
		};
		// Editors write several files per save; one rebuild per burst.
		const schedule = (): void => {
			clearTimeout(timer);
			timer = setTimeout(() => void run(), 200);
		};
		for (const target of ["src", "public", "index.html"]) {
			watchPath(path.join(pkgRoot, target), schedule);
		}
		await run();
		console.log("webgui watching src/, public/, index.html");
		if (serve) {
			// Server code reloads in place via --hot; the UI comes from the rebuilt dist, never the dev bundler.
			const server = Bun.spawn(["bun", "--hot", "--no-clear-screen", path.join(pkgRoot, "src/server/index.ts")], {
				stdio: ["inherit", "inherit", "inherit"],
			});
			const stop = (): void => {
				server.kill();
				process.exit(0);
			};
			process.on("SIGINT", stop);
			process.on("SIGTERM", stop);
			process.exit(await server.exited);
		}
	}
}

function watchPath(target: string, onChange: () => void): void {
	try {
		fsWatch(target, { recursive: true }, onChange);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
	}
}
