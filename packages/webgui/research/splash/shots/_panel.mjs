import puppeteer from "puppeteer-core";
// panel smoke test + shots: bun shots/_panel.mjs
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await b.newPage(); await page.setCacheEnabled(false);
const errs = []; page.on("pageerror", e => errs.push(String(e))); page.on("console", m => m.type() === "error" && !m.text().includes("500") && errs.push(m.text()));
const out = "packages/webgui/research/splash/shots/", sleep = ms => new Promise(r => setTimeout(r, ms));
const set = (key, v) => page.addScriptTag({ content: `{ const p = PD.find(p => p.key === ${JSON.stringify(key)}); p.inp.value = ${JSON.stringify(v)}; p.inp.dispatchEvent(new Event("input")); }` });
const dom = sel => page.evaluate(s => document.querySelector(s)?.textContent, sel);
for (const [w, h, d] of [[1440, 900, 1], [390, 844, 3]]) {
	await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
	await page.goto(`http://localhost:42111/h-water-full-glass.html?hour=12.5&t=0`); await sleep(800);
	await page.addScriptTag({ content: `document.getElementById("pwater").open = true;` }); await sleep(200);
	await page.screenshot({ path: `${out}panel-water-${w}.png` });
	await page.addScriptTag({ content: `document.getElementById("pwater").open = false; document.getElementById("pscene").open = true;` }); await sleep(200);
	await page.screenshot({ path: `${out}panel-scene-${w}.png` });
	await page.addScriptTag({ content: `document.getElementById("pscene").open = false;` });
	await page.screenshot({ path: `${out}panel-closed-${w}.png` });
}
// live changes at 1440: spectrum params (rebuild ms), uniforms, colour; URL mirror
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const ms = [];
for (const [k, v] of [["wind", 4], ["fetch", 700], ["scale", 900], ["swh", .2], ["swl", 400], ["wdir", 0], ["sdir", 30]]) {
	await set(k, v); await sleep(400); ms.push(k + ": " + await dom("#pstat"));
}
await set("chop", 1.5); await set("water", "#20c0c0"); await set("lac", "#ff3010"); await set("rfl", .5); await sleep(400);
await page.screenshot({ path: `${out}panel-changed-1440.png` });
console.log(ms.join("\n"));
console.log("url:", page.url());
await page.goto(page.url()); await sleep(800);
await page.screenshot({ path: `${out}panel-fromurl-1440.png` });
await page.addScriptTag({ content: `document.getElementById("preset").click()` }); await sleep(400);
console.log("after reset url:", page.url(), await dom("#pstat"));
console.log("errors:", errs.length ? errs.join("\n") : "none");
await b.close();
