// bun research/splash/shots/_slowcompile.mjs <label> <mode>: app load with the GPU compile made unavailable or slow.
// mode noparallel: KHR_parallel_shader_compile hidden (Firefox). mode slow: COMPLETION_STATUS false for 20 s (D3D11).
// Prints when the splash ended (html loses splash-run) and the mode it played.
import puppeteer from "puppeteer-core";
import * as path from "node:path";

const dir = path.join("/tmp/splash-bench", process.argv[2]);
const mode = process.argv[3];
const server = Bun.serve({
	port: 0,
	async fetch(req) {
		const u = new URL(req.url);
		if (u.pathname.startsWith("/api/")) return Response.json(u.pathname === "/api/live" || u.pathname === "/api/past" ? [] : {});
		return new Response(Bun.file(path.join(dir, u.pathname === "/" ? "index.html" : u.pathname)));
	},
});
const b = await puppeteer.launch({
	executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	headless: true,
	args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await b.newPage();
await page.evaluateOnNewDocument(m => {
	const P = WebGL2RenderingContext.prototype;
	const ge = P.getExtension, gp = P.getProgramParameter, t0 = performance.now();
	if (m.startsWith("noparallel")) P.getExtension = function (n) { return n === "KHR_parallel_shader_compile" ? null : ge.call(this, n); };
	const gpar = P.getParameter;
	if (m === "noparallel-d3d") P.getParameter = function (n) { return n === 0x1f01 ? "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)" : gpar.call(this, n); };
	if (m === "slow") P.getProgramParameter = function (p, n) { return n === 0x91b1 && performance.now() - t0 < 20000 ? false : gp.call(this, p, n); };
}, mode);
await page.goto(`http://localhost:${server.port}/`, { waitUntil: "domcontentloaded" });
const log = [];
let last = null;
const t0 = Date.now();
while (Date.now() - t0 < 25000) {
	const c = await page.evaluate(() => document.documentElement.className).catch(() => "?");
	if (c !== last) log.push([Date.now() - t0, c]);
	last = c;
	await Bun.sleep(50);
}
console.log(JSON.stringify(log));
await b.close();
server.stop();
