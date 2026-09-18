import puppeteer from "puppeteer-core";
// usage: bun shots/_ff.mjs a.html b.html ...  first frame (nav start to first drawArrays + readPixels) and draw calls per frame, 390x844 dpr 3
const files = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const probe = `<script>{const P = WebGLRenderingContext.prototype, o = P.drawArrays, oe = P.drawElements;
window.__draws = 0; window.__ff = 0;
P.drawArrays = function (...a) { const r = o.apply(this, a); window.__draws++; if (!window.__ff) { const px = new Uint8Array(4); this.readPixels(0, 0, 1, 1, this.RGBA, this.UNSIGNED_BYTE, px); window.__ff = performance.now(); } return r; };
P.drawElements = function (...a) { window.__draws++; return oe.apply(this, a); };}</script>`;
const res = {};
for (let run = 0; run < 7; run++) for (const f of files) {
	const page = await b.newPage();
	await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
	await page.setRequestInterception(true);
	page.on("request", async r => {
		if (!r.url().includes(f)) return r.continue();
		const html = await (await fetch(r.url())).text();
		r.respond({ status: 200, contentType: "text/html", body: html.replace("<head>", "<head>" + probe) });
	});
	await page.goto(`http://localhost:42111/${f}?hour=12.5&t=0`);
	await new Promise(r => setTimeout(r, 1500));
	await page.addScriptTag({ content: `{ const d0 = window.__draws; requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.pf = (window.__draws - d0) / 2; document.documentElement.dataset.ff = window.__ff; })); }` });
	await new Promise(r => setTimeout(r, 300));
	const v = await page.evaluate(() => ({ ff: +document.documentElement.dataset.ff, perFrame: +document.documentElement.dataset.pf }));
	(res[f] ??= []).push(v);
	await page.close();
}
for (const f in res) { const ff = res[f].map(x => x.ff).sort((a, b) => a - b); console.log(f, "first frame median ms", ff[3].toFixed(1), "all", ff.map(x => x.toFixed(0)).join(","), "draws/frame", res[f].map(x => x.perFrame).join(",")); }
await b.close();
