/**
 * Pele vs Mermaid QA harness (`bun run qa:pele`).
 *
 * Renders every fixture in `bench/mermaid-fixtures/*.mmd` in headless Chromium
 * with Pele (local package) and mermaid@12.1.0 (jsDelivr, QA time only; never a
 * dependency). A fixture passes when Pele renders without error and every text
 * label Mermaid renders also appears in Pele's SVG.
 *
 * Writes an HTML report to `dist-bench/pele-qa/report.html` (gitignored) and a
 * markdown summary to stdout. Exits 1 when any fixture fails.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import puppeteer from "puppeteer-core";

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.esm.min.mjs";
const BENCH_DIR = import.meta.dir;
const FIXTURE_DIR = path.join(BENCH_DIR, "mermaid-fixtures");
const REPORT_DIR = path.join(BENCH_DIR, "..", "dist-bench", "pele-qa");
const PELE_ESM = Bun.resolveSync("pele", BENCH_DIR);

interface EngineResult {
	ok: boolean;
	error?: string;
	ms: number;
	svg: string;
	labels: string[];
}

interface FixtureResult {
	name: string;
	source: string;
	pele: EngineResult;
	mermaid: EngineResult;
	missing: string[];
	pass: boolean;
}

function findChromiumPath(): string {
	const candidates = [
		process.env.CHROME_BIN,
		process.env.PUPPETEER_EXECUTABLE_PATH,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
		"/usr/bin/chromium",
		"/usr/bin/google-chrome",
	].filter((c): c is string => Boolean(c));
	for (const c of candidates) if (fs.existsSync(c)) return c;
	throw new Error("Chromium executable not found; set CHROME_BIN");
}

// Page scripts are loaded through page.evaluate: some Chrome installs (managed
// policy) do not run inline or served <script> tags in headless pages.
const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="host" style="width:1000px"></div></body></html>`;

async function loadLibs(peleUrl: string, mermaidUrl: string): Promise<void> {
	const w = window as unknown as Record<string, unknown>;
	w.pele = await import(peleUrl);
	const mermaid = (await import(mermaidUrl)).default as { initialize(cfg: object): void };
	mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
	w.mermaid = mermaid;
}

interface PageApi {
	pele: { render(src: string): { svg: string } };
	mermaid: { render(id: string, src: string): Promise<{ svg: string }> };
}

async function renderInPage(source: string, engine: "pele" | "mermaid", seq: number): Promise<EngineResult> {
	const w = window as unknown as PageApi & Window;
	const host = document.getElementById("host") as HTMLElement;
	host.innerHTML = "";
	const labelsOf = (root: Element): string[] => {
		const out = new Set<string>();
		// Wrapped lines live in separate tspans/divs; join text nodes with spaces so
		// "Blurry" + "Photo" is not read as one word.
		const take = (el: Element) => {
			const parts: string[] = [];
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.nodeValue ?? "");
			const t = parts.join(" ").replace(/\s+/g, " ").trim();
			if (t) out.add(t);
		};
		for (const el of root.querySelectorAll("text")) {
			if (el.closest("style,title,desc,defs,marker")) continue;
			take(el);
		}
		for (const fo of root.querySelectorAll("foreignObject")) take(fo);
		return [...out];
	};
	const once = async (id: string): Promise<string> => {
		if (engine === "pele") return w.pele.render(source).svg;
		const { svg } = await w.mermaid.render(id, source);
		return svg;
	};
	try {
		// Warm-up render excludes lazy chunk loading from the timed run.
		await once(`w${engine}${seq}`);
		const t0 = performance.now();
		const svg = await once(`m${engine}${seq}`);
		const ms = performance.now() - t0;
		host.innerHTML = svg;
		const root = host.firstElementChild;
		return { ok: true, ms, svg, labels: root ? labelsOf(root) : [] };
	} catch (err) {
		for (const stray of document.querySelectorAll(`#dw${engine}${seq},#dm${engine}${seq}`)) stray.remove();
		return { ok: false, error: err instanceof Error ? err.message : String(err), ms: 0, svg: "", labels: [] };
	}
}

const words = (s: string): string[] =>
	s
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);

// Pele may wrap or split labels differently, so compare by words instead of exact strings.
function missingLabels(mermaidLabels: string[], peleLabels: string[]): string[] {
	const have = new Set(peleLabels.flatMap(words));
	return mermaidLabels.filter(l => {
		const ws = words(l);
		return ws.some(x => !have.has(x));
	});
}

const esc = (s: string): string =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function frame(r: EngineResult): string {
	if (!r.ok) return `<pre class="err">${esc(r.error ?? "error")}</pre>`;
	const doc = `<!doctype html><html><body style="margin:0">${r.svg}</body></html>`;
	return `<iframe sandbox srcdoc="${esc(doc)}"></iframe>`;
}

function htmlReport(results: FixtureResult[]): string {
	const rows = results
		.map(
			r => `<section class="${r.pass ? "pass" : "fail"}"><h2>${esc(r.name)} ${r.pass ? "PASS" : "FAIL"}</h2>
${r.missing.length ? `<p>Missing in Pele: ${r.missing.map(m => `<code>${esc(m)}</code>`).join(", ")}</p>` : ""}
<div class="pair"><div><h3>Pele (${r.pele.ms.toFixed(1)} ms, ${r.pele.svg.length} B)</h3>${frame(r.pele)}</div>
<div><h3>Mermaid 12.1.0 (${r.mermaid.ms.toFixed(1)} ms, ${r.mermaid.svg.length} B)</h3>${frame(r.mermaid)}</div></div>
<details><summary>source</summary><pre>${esc(r.source)}</pre></details></section>`,
		)
		.join("\n");
	return `<!doctype html><html><head><meta charset="utf-8"><title>Pele vs Mermaid</title><style>
body{font-family:sans-serif;margin:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
iframe{width:100%;height:520px;border:1px solid #ccc;background:#fff}.fail h2{color:#b00}.pass h2{color:#070}
.err{color:#b00;white-space:pre-wrap}section{border-bottom:1px solid #ddd;padding-bottom:12px}
</style></head><body><h1>Pele vs Mermaid 12.1.0</h1>${rows}</body></html>`;
}

function markdownTable(results: FixtureResult[]): string {
	const lines = [
		"| type | pele ok | mermaid ok | missing labels | pele ms | mermaid ms | pele B | mermaid B |",
		"| --- | --- | --- | --- | --- | --- | --- | --- |",
	];
	for (const r of results) {
		const miss = r.missing.length ? r.missing.map(m => m.replace(/\|/g, "\\|")).join("; ") : "";
		lines.push(
			`| ${r.name} | ${r.pele.ok ? "yes" : "NO"} | ${r.mermaid.ok ? "yes" : "no"} | ${miss} | ${r.pele.ms.toFixed(1)} | ${r.mermaid.ms.toFixed(1)} | ${r.pele.svg.length} | ${r.mermaid.svg.length} |`,
		);
	}
	return lines.join("\n");
}

async function main(): Promise<void> {
	const peleJs = await Bun.file(PELE_ESM).text();
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch(req) {
			const { pathname } = new URL(req.url);
			// Explicit charset: the bundle contains non-ASCII and Chrome otherwise decodes it as Latin-1.
			const type = pathname === "/pele.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
			return new Response(pathname === "/pele.js" ? peleJs : PAGE_HTML, { headers: { "content-type": type } });
		},
	});
	const browser = await puppeteer.launch({ executablePath: findChromiumPath(), headless: true });
	const results: FixtureResult[] = [];
	try {
		const page = await browser.newPage();
		page.on("pageerror", err => console.error("[page error]", err instanceof Error ? err.message : err));
		page.on("requestfailed", req => console.error("[request failed]", req.url(), req.failure()?.errorText));
		await page.goto(`http://127.0.0.1:${server.port}/`);
		await page.evaluate(loadLibs, `http://127.0.0.1:${server.port}/pele.js`, MERMAID_URL);
		const files = fs
			.readdirSync(FIXTURE_DIR)
			.filter(f => f.endsWith(".mmd"))
			.sort();
		let seq = 0;
		for (const file of files) {
			const source = await Bun.file(path.join(FIXTURE_DIR, file)).text();
			seq++;
			const pele = await page.evaluate(renderInPage, source, "pele" as const, seq);
			const mermaid = await page.evaluate(renderInPage, source, "mermaid" as const, seq);
			const missing = pele.ok && mermaid.ok ? missingLabels(mermaid.labels, pele.labels) : [];
			results.push({
				name: file.replace(/\.mmd$/, ""),
				source,
				pele,
				mermaid,
				missing,
				pass: pele.ok && missing.length === 0,
			});
		}
	} finally {
		await browser.close();
		server.stop(true);
	}
	fs.mkdirSync(REPORT_DIR, { recursive: true });
	const reportPath = path.join(REPORT_DIR, "report.html");
	await Bun.write(reportPath, htmlReport(results));
	await Bun.write(
		path.join(REPORT_DIR, "results.json"),
		JSON.stringify(
			results.map(({ pele, mermaid, ...r }) => ({
				...r,
				pele: { ...pele, svg: undefined },
				mermaid: { ...mermaid, svg: undefined },
			})),
			null,
			2,
		),
	);
	console.log(markdownTable(results));
	const failing = results.filter(r => !r.pass);
	console.log("");
	for (const r of failing) {
		const why = !r.pele.ok ? `pele error: ${r.pele.error}` : `missing labels: ${r.missing.join("; ")}`;
		console.log(`FAIL ${r.name}: ${why}`);
	}
	console.log(`\n${results.length - failing.length}/${results.length} passed. Report: ${reportPath}`);
	if (failing.length) process.exit(1);
}

await main();
