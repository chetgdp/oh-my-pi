import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { promisify } from "node:util";
import type { BunPlugin } from "bun";

const brotliCompressAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);

const katexDedupePlugin: BunPlugin = {
	name: "katex-dedupe",
	setup(build) {
		const topKatex = import.meta.resolveSync("katex", import.meta.url);
		build.onResolve({ filter: /^katex(\/.*)?$/ }, args => {
			if (args.path === "katex") {
				return { path: topKatex };
			}
			return { path: import.meta.resolveSync(args.path, topKatex) };
		});
	},
};

export interface WebguiBuildResult {
	outdir: string;
	entryFile: string;
	cssFiles: string[];
	preloadChunks: string[];
	outputs: string[];
}

export async function buildWebgui(customOutdir?: string): Promise<WebguiBuildResult> {
	const pkgRoot = path.resolve(import.meta.dir, "..");
	const outdir = customOutdir ? path.resolve(customOutdir) : path.resolve(pkgRoot, "dist");

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
		plugins: [katexDedupePlugin],
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

	const allOutputs = (await fs.readdir(outdir)).sort();
	return {
		outdir,
		entryFile: entryFileName,
		cssFiles,
		preloadChunks,
		outputs: allOutputs,
	};
}

if (import.meta.main) {
	let customOutdir: string | undefined;
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (arg === "--outdir" && i + 1 < process.argv.length) {
			customOutdir = process.argv[++i];
		} else if (arg.startsWith("--outdir=")) {
			customOutdir = arg.slice("--outdir=".length);
		}
	}

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
}
