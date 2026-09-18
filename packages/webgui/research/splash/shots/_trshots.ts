// Transcript clear shots: bun research/splash/shots/_trshots.ts <distDir> <outDir> [nonclear]
// Screenshots #/s/<id> with localStorage webgui.ui=clear and ?hour=<h> (Date shimmed), per text run p5 contrast like _bench.mjs bgshots.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import puppeteer from "puppeteer-core";
import { startFakeRpcHost } from "../../../bench/fake-host";
import { generateSession } from "../../../bench/lib/session-frames";
import { createServer } from "../../../src/server/index";

const [distDir, outDir, mode] = process.argv.slice(2);
const nonclear = mode === "nonclear";
fs.mkdirSync(outDir, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];

const entries: Record<string, unknown>[] = [];
let parentId: string | null = null;
const push = (message: Record<string, unknown>) => {
	const id = `e-${entries.length}`;
	entries.push({ id, parentId, timestamp: new Date(1770000000000 + entries.length * 1000).toISOString(), type: "message", message });
	parentId = id;
};
const T = 1770000000000;
push({ role: "user", content: "Fix the `parseRows` bug and show me the table of results.", timestamp: T });
push({
	role: "assistant",
	content: [
		{ type: "thinking", thinking: "The parser drops trailing blank rows. Check diff-rows.ts and the tests before editing anything." },
		{
			type: "text",
			text: "The bug is in **`parseRows`**: blank lines at the end reset the counter. Here is the fix:\n\n```ts\nexport function parseRows(text: string): Row[] {\n\tconst rows: Row[] = [];\n\tfor (const line of text.split(\"\\n\")) {\n\t\tif (line === \"\") continue; // gap marker\n\t\trows.push({ kind: \"ctx\", text: line, n: 42 });\n\t}\n\treturn rows;\n}\n```\n\n| Case | Before | After |\n|---|---|---|\n| trailing blank | 3 rows | 2 rows |\n| hunk header | ok | ok |\n\n> Note: the [docs](https://example.com) describe the format.",
		},
		{ type: "toolCall", id: "c1", name: "edit", arguments: { path: "src/lib/diff-rows.ts" } },
		{ type: "toolCall", id: "c2", name: "bash", arguments: { command: "bun test ./test/diff-rows.test.ts" } },
	],
	stopReason: "toolUse",
	timestamp: T,
});
push({
	role: "toolResult",
	toolCallId: "c1",
	toolName: "edit",
	content: [{ type: "text", text: "Updated src/lib/diff-rows.ts" }],
	details: { diff: " 10|for (const line of text.split(\"\\n\")) {\n-11|\tif (line === \"\") counter = 0;\n+11|\tif (line === \"\") continue;\n 12|\trows.push(row);\n+13|\t// keep the counter across gaps\n-14|\treturn rows.slice(0);\n+14|\treturn rows;" },
	isError: false,
	timestamp: T,
});
push({
	role: "toolResult",
	toolCallId: "c2",
	toolName: "bash",
	content: [{ type: "text", text: "bun test v1.3\n\ntest/diff-rows.test.ts:\n✓ parses numbered rows [0.4ms]\n✓ keeps gaps [0.1ms]\n\n 2 pass\n 0 fail" }],
	isError: false,
	timestamp: T,
});
push({ role: "assistant", content: [{ type: "text", text: "Both tests pass. The parser now keeps the counter across blank lines, so line numbers after a gap match the file again. Longer prose wraps across several lines here so the panel shows a realistic paragraph of body text at the default size." }], stopReason: "stop", timestamp: T });

const base = generateSession({ entries: 2, assistantChars: 200, deltaChars: 64, toolOutputChunks: 1, toolChunkChars: 50, subagents: 0, seed: 7 });
base.history.historyResult.entries = entries as never;
base.history.historyResult.leafId = parentId as never;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trshots-"));
const registryDir = path.join(tmp, "registry");
fs.mkdirSync(registryDir, { recursive: true });
const host = startFakeRpcHost({ registryDir, session: { history: base.history, stream: [] } });
const server = createServer({ registryDir, distDir, host: "127.0.0.1", port: 0 });
const port = server.port;

const VIEWS: [number, number, number][] = [[390, 844, 3], [1440, 900, 1]];
const hours = process.env.HOURS ? process.env.HOURS.split(",").map(Number) : [6.5, 12.5, 19, 20, 23];
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
const report: unknown[] = [];
for (const hour of nonclear ? [12.5] : hours)
	for (const [w, h, d] of VIEWS) {
		const page = await b.newPage();
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d, isMobile: w < 800, hasTouch: w < 800 });
		await page.evaluateOnNewDocument(`{ const R = Date, t = new R(); t.setHours(${Math.floor(hour)}, ${Math.round((hour % 1) * 60)}, 0, 0); const off = t - R.now();
			window.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }; }`);
		const bg = w < 800 ? "still" : "live";
		if (!nonclear) await page.evaluateOnNewDocument(() => localStorage.setItem("webgui.ui", "clear"));
		const q = nonclear ? "bg=off" : `hour=${hour}&bg=${bg}`;
		if (nonclear) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
		await page.goto(`http://127.0.0.1:${port}/?${q}#/s/${host.instanceId}`);
		await page.waitForSelector(".tv-card", { timeout: 30000 });
		await page.evaluate(() => {
			for (const el of document.querySelectorAll<HTMLElement>(".tv-head, .tr-think-head")) if (el.getAttribute("aria-expanded") === "false") el.click();
		});
		await new Promise(r => setTimeout(r, 500));
		await page.evaluate(sel => {
			if (sel) document.querySelector(sel)?.scrollIntoView({ block: "center" });
		}, process.env.SCROLL ?? "");
		await page.evaluate(() => {
		});
		await new Promise(r => setTimeout(r, nonclear ? 1500 : 3000));
		const file = path.join(outDir, `tr-${nonclear ? "nonclear" : "clear"}-${w}-h${hour}.png`);
		await page.screenshot({ path: file });
		console.log(file);
		if (nonclear) {
			await page.close();
			continue;
		}
		const boxes = await page.evaluate(() => {
			const out: { cls: string; x: number; y: number; w: number; h: number; color: string; size: number; weight: number }[] = [];
			for (const el of document.querySelectorAll<HTMLElement>(".tr-root *")) {
				const cs = getComputedStyle(el);
				if (cs.visibility === "hidden" || el.closest("svg")) continue;
				for (const n of el.childNodes) {
					if (n.nodeType !== 3 || !n.textContent?.trim()) continue;
					const rg = document.createRange();
					rg.selectNodeContents(n);
					for (const r of rg.getClientRects()) {
						if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
						const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
						if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
						out.push({ cls: String(el.className || el.tagName), x: r.x, y: r.y, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) });
					}
				}
			}
			const st = document.createElement("style");
			st.textContent = ".tr-root *{-webkit-text-fill-color:rgb(0 0 0 / 1%)!important;caret-color:transparent!important}";
			document.head.append(st);
			return out;
		});
		await new Promise(r => setTimeout(r, 300));
		const bare = await page.screenshot({ encoding: "base64" });
		const m = await b.newPage();
		const res = (await m.evaluate(
			async (png: string, boxes: typeof boxesT, d: number) => {
				const img = new Image();
				img.src = "data:image/png;base64," + png;
				await img.decode();
				const c = document.createElement("canvas");
				c.width = img.width;
				c.height = img.height;
				const g = c.getContext("2d", { willReadFrequently: true })!;
				g.drawImage(img, 0, 0);
				const lum = (r: number, gg: number, bb: number) => {
					const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
					return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bb);
				};
				const one = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
				return boxes.map(bx => {
					one.clearRect(0, 0, 1, 1);
					one.fillStyle = bx.color;
					one.fillRect(0, 0, 1, 1);
					const [fr, fg, fb, fa] = one.getImageData(0, 0, 1, 1).data;
					const a = fa / 255;
					const px = g.getImageData(Math.round(bx.x * d), Math.round(bx.y * d), Math.max(1, Math.round(bx.w * d)), Math.max(1, Math.round(bx.h * d))).data;
					const rs: number[] = [];
					for (let i = 0; i < px.length; i += 4) {
						const L1 = lum(px[i], px[i + 1], px[i + 2]);
						const L2 = lum(fr * a + px[i] * (1 - a), fg * a + px[i + 1] * (1 - a), fb * a + px[i + 2] * (1 - a));
						rs.push((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05));
					}
					rs.sort((x, y) => x - y);
					return { cls: bx.cls, size: bx.size, weight: bx.weight, x: Math.round(bx.x), y: Math.round(bx.y), p5: rs[Math.floor(rs.length * 0.05)] };
				});
			},
			bare,
			boxes,
			d,
		)) as { cls: string; size: number; weight: number; p5: number }[];
		await m.close();
		const large = (r: { size: number; weight: number }) => r.size >= 18 || (r.size >= 14 && r.weight >= 700);
		const body = res.filter(r => !large(r));
		const lg = res.filter(large);
		const worst = (xs: typeof res) => xs.reduce((a, r) => (r.p5 < a.p5 ? r : a), { p5: Infinity, cls: "-" } as (typeof res)[number]);
		const wb = worst(body);
		const wl = worst(lg);
		report.push({ w, hour, n: res.length, bodyP5: wb.p5, bodyCls: wb.cls, largeP5: wl.p5, largeCls: wl.cls, fails: res.filter(r => r.p5 < (large(r) ? 3 : 4.5)) });
		console.log(`contrast ${w} h${hour}: n ${res.length} body p5 ${wb.p5.toFixed(2)} (${wb.cls}) large p5 ${wl.p5.toFixed(2)} (${wl.cls})`);
		await page.close();
	}
declare const boxesT: { cls: string; x: number; y: number; w: number; h: number; color: string; size: number; weight: number }[];
fs.writeFileSync(path.join(outDir, nonclear ? "nonclear.json" : "contrast.json"), JSON.stringify(report, null, 1));
await b.close();
await host.close();
server.stop?.(true);
process.exit(0);
