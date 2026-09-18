import puppeteer from "puppeteer-core";
import * as path from "node:path";
// usage (from packages/webgui): bun research/splash/shots/_integ.mjs [reduced]
// Serves dist/, delays /api/* by API_DELAY ms, shoots the splash before/after ready.
const dist = path.resolve("dist");
const API_DELAY = 1500;
// First WebGL frame on screen: <html> gains splash-gl right after warm() drew the start frame.
const PROBE = `<script>new MutationObserver(() => { if (!document.documentElement.dataset.gl && document.documentElement.classList.contains("splash-gl")) document.documentElement.dataset.gl = performance.now(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });</script>`;
const server = Bun.serve({
	port: 0,
	async fetch(req) {
		const u = new URL(req.url);
		if (u.pathname.startsWith("/api/")) {
			await Bun.sleep(API_DELAY);
			return Response.json(u.pathname === "/api/live" ? [] : {});
		}
		if (u.pathname === "/") {
			const html = await Bun.file(path.join(dist, "index.html")).text();
			return new Response(html.replace("<head>", `<head>${PROBE}`), { headers: { "content-type": "text/html" } });
		}
		const f = Bun.file(path.join(dist, u.pathname === "/" ? "index.html" : u.pathname));
		return (await f.exists()) ? new Response(f) : new Response("nf", { status: 404 });
	},
});
const reduced = process.argv.includes("reduced");
const b = await puppeteer.launch({
	executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	headless: true,
	args: process.argv.includes("nogl") ? ["--disable-webgl"] : ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await b.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${server.port}/`);
const shot = async name => page.screenshot({ path: `research/splash/shots/integ-${reduced ? "rm-" : process.argv.includes("nogl") ? "nogl-" : ""}${name}.png` });
const state = () =>
	page.evaluate(() => ({
		cls: document.documentElement.className,
		sky: !!document.querySelector(".splash-sky"),
		gl: +document.documentElement.dataset.gl || null, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
		theme: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
	}));
await Bun.sleep(700);
const s1 = await state();
await shot("1-start");
await Bun.sleep(API_DELAY + 500 - 700 + 900); // ready at ~1.5 s, +500 hold, ~900 into the dolly
const s2 = await state();
await shot("2-dolly");
await Bun.sleep(1500);
const s3 = await state();
await shot("3-app");
console.log(JSON.stringify({ s1, s2, s3, errors }, null, 1));
await b.close();
server.stop(true);
