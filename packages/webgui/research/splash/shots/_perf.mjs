import puppeteer from "puppeteer-core";
// usage: bun shots/_perf.mjs runs a.html b.html ...  same method as _shot.mjs perf (glWarm + readPixels, hour 12.5, t 0),
// median of 121 per run, files alternated each run; prints the median of the run medians and each run's median
const [runs, ...files] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await b.newPage();
const res = {};
for (let run = 0; run < +runs; run++) for (const f of files) for (const [w, h, d] of [[390, 844, 3], [1440, 900, 1]]) {
	await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
	await page.goto(`http://localhost:42111/${f}?hour=12.5&t=0`);
	await new Promise(r => setTimeout(r, 800));
	await page.addScriptTag({ content: `{
		const gl = document.getElementById("gl").getContext("webgl"), px = new Uint8Array(4), r = [];
		for (let i = 0; i < 121; i++) { const t = performance.now(); glWarm(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); r.push(performance.now() - t); }
		r.sort((a, b) => a - b); document.body.dataset.ms = r[60];
	}` });
	(res[f + " " + w + "x" + h] ??= []).push(+(await page.evaluate(() => document.body.dataset.ms)));
}
for (const k in res) { const s = [...res[k]].sort((a, b) => a - b); console.log(k, "median", s[s.length >> 1].toFixed(2), "runs", res[k].map(x => x.toFixed(1)).join(",")); }
await b.close();
