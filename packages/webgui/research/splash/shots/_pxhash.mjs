import puppeteer from "puppeteer-core";
// usage: bun shots/_pxhash.mjs file.html — prints a hash of the full GL start frame (glWarm, ?frz=3) per config
const [file] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await b.newPage(); await page.setCacheEnabled(false);
const errs = []; page.on("pageerror", e => errs.push(String(e)));
const out = [];
for (const [w, h, d] of [[390, 844, 3], [1440, 900, 1]]) {
	await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
	for (const qs of ["hour=12.5&t=0", "hour=18.3&t=0", "hour=23&t=0", "hour=6.5&t=0", "hour=12.5&t=0.5"]) {
		await page.goto(`http://localhost:42111/${file}?${qs}&frz=3`); await new Promise(r => setTimeout(r, 500));
		await page.addScriptTag({ content: `{ const c = document.getElementById("gl"), gl = c.getContext("webgl2"); const now = performance.now();
			glWarm(); const px = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
			let hsh = 2166136261; for (let i = 0; i < px.length; i++) { hsh ^= px[i]; hsh = Math.imul(hsh, 16777619); } document.body.dataset.h = (hsh >>> 0).toString(16); }` });
		out.push(w + " " + qs + " " + await page.evaluate(() => document.body.dataset.h));
	}
}
console.log(out.join("\n")); if (errs.length) console.log(errs.join("\n"));
await b.close();
