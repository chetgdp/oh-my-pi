import puppeteer from "puppeteer-core";
// usage: bun /tmp/splash-shot.mjs file.html prefix [perf]
const [file, prefix, mode] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const out = "packages/webgui/research/splash/shots/";
const sizes = [[390, 844, 3], [1440, 900, 1]];
const page = await b.newPage();
const errs = [];
page.on("console", m => { if (m.type() === "error" && !m.text().includes("500")) errs.push(m.text()); });
page.on("pageerror", e => errs.push(String(e)));
if (mode === "perf") {
	for (const [w, h] of sizes) {
		await page.setViewport({ width: w, height: h, deviceScaleFactor: 3 > 0 && w < 500 ? 3 : 1 });
		await page.goto(`http://localhost:42111/${file}?hour=12.5&t=0`);
		await new Promise(r => setTimeout(r, 800));
		await page.addScriptTag({ content: `{
			const gl = document.getElementById("gl").getContext("webgl"), px = new Uint8Array(4), r = [];
			for (let i = 0; i < 61; i++) { const t = performance.now(); glWarm(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); r.push(performance.now() - t); }
			r.sort((a, b) => a - b); document.body.dataset.ms = r[30];
		}` });
		const ms = +(await page.evaluate(() => document.body.dataset.ms));
		console.log(file, w + "x" + h, "glWarm (warm+start) median ms", ms.toFixed(2));
	}
} else if (mode === "sky") {
	for (const [w, h, d] of sizes) {
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
		for (const hr of w > 500 ? [6.5, 8, 12.5, 16, 18.3] : [8, 12.5, 16]) {
			await page.goto(`http://localhost:42111/${file}?hour=${hr}&t=0`);
			await new Promise(r => setTimeout(r, 700));
			await page.screenshot({ path: `${out}${prefix}-${w}-h${hr}.png` });
		}
	}
} else {
	const hours = [6.5, 8, 12.5, 18.3, 23];
	for (const [w, h, d] of sizes) {
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
		for (const hr of hours) {
			await page.goto(`http://localhost:42111/${file}?hour=${hr}&t=0`);
			await new Promise(r => setTimeout(r, 700));
			await page.screenshot({ path: `${out}${prefix}-${w}-h${hr}.png` });
			if (hr === 23) { await new Promise(r => setTimeout(r, 500)); await page.screenshot({ path: `${out}${prefix}-${w}-h23b.png` }); }
		}
		await page.goto(`http://localhost:42111/${file}?hour=12.5&t=0.5`);
		await new Promise(r => setTimeout(r, 700));
		await page.screenshot({ path: `${out}${prefix}-${w}-h12.5-t0.5.png` });
	}
}
console.log("errors:", errs.length ? errs.join("\n") : "none");
await b.close();
