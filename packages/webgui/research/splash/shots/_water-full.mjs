import puppeteer from "puppeteer-core";
// usage: bun shots/_water-full.mjs file.html prefix [shots|perf|first] [runs]
const [file, prefix, mode = "shots", runsArg] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const out = "packages/webgui/research/splash/shots/";
const sizes = [[390, 844, 3], [1440, 900, 1]];
const page = await b.newPage();
const errs = [];
await page.setCacheEnabled(false);
page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", e => errs.push(String(e)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (mode === "shots" || mode === "glint" || mode === "sky") {
	for (const [w, h, d] of sizes) {
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
		for (const [hr, t] of mode === "glint" ? [[12.5, 0], [17.5, 0], [18.3, 0]] : mode === "sky" ? [[6.5, 0], [8, 0], [12.5, 0], [16, 0], [18.3, 0], [23, 0]] : [[6.5, 0], [12.5, 0], [16, 0], [18.3, 0], [23, 0], [12.5, .5]]) {
			await page.goto(`http://localhost:42111/${file}?hour=${hr}&t=${t}`);
			await sleep(900);
			await page.screenshot({ path: `${out}${prefix}${w}-h${hr}${t ? "-t" + t : ""}.png` });
		}
	}
} else if (mode === "perf") {
	// forced redraw: glWarm() (portal warm-up + start frame) + 1px readPixels, median of 61
	for (const [w, h, d] of sizes) {
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
		await page.goto(`http://localhost:42111/${file}?hour=12.5&t=0`);
		await sleep(800);
		await page.addScriptTag({ content: `{
			const c = document.getElementById("gl"), gl = c.getContext("webgl2") || c.getContext("webgl"), px = new Uint8Array(4), r = [];
			for (let i = 0; i < 61; i++) { const t = performance.now(); glWarm(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); r.push(performance.now() - t); }
			r.sort((a, b) => a - b); document.body.dataset.ms = r[30];
		}` });
		const ms = +(await page.evaluate(() => document.body.dataset.ms));
		console.log(file, w + "x" + h, "glWarm median ms", ms.toFixed(2));
	}
} else if (mode === "first") {
	// navigation start -> first two default-framebuffer draws finished (warm-up + start frame), fresh browser cache off
	await page.setCacheEnabled(false);
	await page.evaluateOnNewDocument(() => {
		window.__d = [];
		for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
			const da = P.drawArrays;
			P.drawArrays = function (...a) {
				da.apply(this, a);
				if (window.__d.length < 2 && !this.getParameter(this.FRAMEBUFFER_BINDING)) { this.readPixels(0, 0, 1, 1, this.RGBA, this.UNSIGNED_BYTE, new Uint8Array(4)); window.__d.push(performance.now()); }
			};
		}
	});
	const runs = +(runsArg || 7);
	for (const [w, h, d] of sizes) {
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
		const r = [];
		for (let i = 0; i < runs; i++) {
			await page.goto(`http://localhost:42111/${file}?hour=12.5&t=0&n=${i}`);
			await sleep(400);
			await page.addScriptTag({ content: "document.body.dataset.ff = window.__d[1]" });
			r.push(+(await page.evaluate(() => document.body.dataset.ff)));
		}
		r.sort((a, b) => a - b);
		console.log(file, w + "x" + h, "first frame ms (median of", runs + ")", r[runs >> 1].toFixed(1), "all", r.map(v => v.toFixed(0)).join(" "));
	}
}
console.log("errors:", errs.length ? errs.join("\n") : "none");
await b.close();
