import puppeteer from "puppeteer-core";
// sun-path crops: bun shots/_sunpath.mjs file.html prefix  -> full shots + 4x crops around the sun reflection
const [file, prefix] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await b.newPage(); await page.setCacheEnabled(false);
const errs = []; page.on("pageerror", e => errs.push(String(e)));
const out = "packages/webgui/research/splash/shots/";
for (const [w, h, d] of [[1440, 900, 1], [390, 844, 3]]) {
	await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
	for (const hr of [11, 15, 16, 17.5, 18.3]) {
		await page.goto(`http://localhost:42111/${file}?hour=${hr}&t=0&frz=47.3`); await new Promise(r => setTimeout(r, 700));
		await page.addStyleTag({ content: ".panels,.controls{display:none!important}" });
		// sun reflection centre: below the sun's screen x, from the horizon down
		const sx = await page.evaluate(() => { const H = innerHeight, w = innerWidth, L = H * .52; return 0; });
		await page.screenshot({ path: `${out}${prefix}${w}-h${hr}.png` });
		// 4x crop: width/4 x height/4 window centred on the sun's x, starting just below the horizon
		const hrs = hr, cx = w * (.5 + (((hrs - 12.5) % 24 + 36) % 24 - 12) / 6 * .42);
		const cw = Math.round(w / 4), ch = Math.round(h / 4), x = Math.max(0, Math.min(w - cw, Math.round(cx - cw / 2))), y = Math.round(h * .52 + 8);
		await page.screenshot({ path: `${out}${prefix}${w}-h${hr}-crop4x.png`, clip: { x, y, width: cw, height: ch, scale: 4 / d } });
	}
}
console.log("errors:", errs.length ? errs.join("\n") : "none");
await b.close();
