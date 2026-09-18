import puppeteer from "puppeteer-core";
import * as fs from "node:fs";
// bun research/splash/shots/_pxdiff.mjs <dirA> <dirB> [glob prefix]: pixel diff of same-named PNGs
const [A, B, pre = "shot-"] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const p = await b.newPage();
for (const f of fs.readdirSync(A).filter(f => f.startsWith(pre) && f.endsWith(".png"))) {
	if (!fs.existsSync(`${B}/${f}`)) continue;
	const r = await p.evaluate(async (x, y) => {
		const load = async s => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
		const a = await load(x), c = await load(y);
		let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
		for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== c.data[i] || a.data[i + 1] !== c.data[i + 1] || a.data[i + 2] !== c.data[i + 2]) { n++; const px = (i / 4) % a.width, py = Math.floor(i / 4 / a.width); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
		return { n, box: n ? [x0, y0, x1, y1] : null };
	}, fs.readFileSync(`${A}/${f}`, "base64"), fs.readFileSync(`${B}/${f}`, "base64"));
	console.log(f, r.n, JSON.stringify(r.box));
}
await b.close();
