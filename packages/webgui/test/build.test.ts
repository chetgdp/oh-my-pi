import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as zlib from "node:zlib";
import katexPkg from "katex/package.json";

const TARGET_EXTENSIONS: Record<string, true> = {
	".js": true,
	".css": true,
	".svg": true,
	".html": true,
};

describe("webgui build", () => {
	let tempOutdir: string;
	let entryFile: string;
	let outputs: string[];
	let indexHtml: string;
	let entryContent: string;

	beforeAll(async () => {
		tempOutdir = await fs.mkdtemp(path.join(os.tmpdir(), "webgui-build-test-"));
		const scriptPath = path.resolve(import.meta.dir, "../scripts/build.ts");
		await $`bun ${scriptPath} --outdir ${tempOutdir}`.quiet();
		indexHtml = await fs.readFile(path.join(tempOutdir, "index.html"), "utf8");

		const scriptMatch = indexHtml.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
		const scriptSrc = scriptMatch?.[1] ?? "";
		entryFile = path.basename(scriptSrc);
		entryContent = await fs.readFile(path.join(tempOutdir, entryFile), "utf8");
		outputs = (await fs.readdir(tempOutdir)).sort();
	});

	afterAll(async () => {
		if (tempOutdir) {
			await fs.rm(tempOutdir, { recursive: true, force: true });
		}
	});
	test("index.html references the React mount chunk", () => {
		const scriptMatch = indexHtml.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
		expect(scriptMatch).not.toBeNull();
		const scriptSrc = scriptMatch?.[1] ?? "";
		const scriptFileName = path.basename(scriptSrc);

		expect(scriptFileName).toBe(entryFile);
		expect(outputs).toContain(entryFile);
		expect(entryContent).toContain("createRoot");
		expect(
			entryContent.includes('getElementById("root")') || entryContent.includes('document.getElementById("root")'),
		).toBe(true);
	});

	test("every modulepreload href exists and is a static dependency", () => {
		const preloadMatches = [
			...indexHtml.matchAll(/<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi),
		];
		expect(preloadMatches.length).toBeGreaterThan(0);

		for (const match of preloadMatches) {
			const href = match[1];
			const chunkFileName = path.basename(href);

			// Exists in outdir
			expect(outputs).toContain(chunkFileName);

			// Statically imported in entry script
			expect(entryContent).toContain(chunkFileName);
		}
	});

	test("no output contains react-dom-client.development", async () => {
		const jsFiles = outputs.filter(f => f.endsWith(".js") && !f.endsWith(".br") && !f.endsWith(".gz"));
		for (const jsFile of jsFiles) {
			const content = await fs.readFile(path.join(tempOutdir, jsFile), "utf8");
			expect(content).not.toContain("react-dom-client.development");
		}
	});

	test("exactly one output contains KaTeX version string", async () => {
		const jsFiles = outputs.filter(f => f.endsWith(".js") && !f.endsWith(".br") && !f.endsWith(".gz"));
		let matches = 0;
		for (const jsFile of jsFiles) {
			const content = await fs.readFile(path.join(tempOutdir, jsFile), "utf8");
			if (content.includes(katexPkg.version)) {
				matches++;
			}
		}
		expect(matches).toBe(1);
	});

	test("compressed siblings decompress to identical original bytes", async () => {
		for (const output of outputs) {
			if (output.endsWith(".br") || output.endsWith(".gz")) continue;
			const filePath = path.join(tempOutdir, output);
			const st = await fs.stat(filePath);
			const ext = path.extname(output).toLowerCase();

			if (TARGET_EXTENSIONS[ext]) {
				if (st.size > 1024) {
					expect(outputs).toContain(`${output}.br`);
					expect(outputs).toContain(`${output}.gz`);

					const original = await fs.readFile(filePath);
					const br = await fs.readFile(`${filePath}.br`);
					const gz = await fs.readFile(`${filePath}.gz`);

					expect(zlib.brotliDecompressSync(br)).toEqual(original);
					expect(zlib.gunzipSync(gz)).toEqual(original);
				} else {
					expect(outputs).not.toContain(`${output}.br`);
					expect(outputs).not.toContain(`${output}.gz`);
				}
			} else {
				expect(outputs).not.toContain(`${output}.br`);
				expect(outputs).not.toContain(`${output}.gz`);
			}
		}
	});
});
