import puppeteer from "puppeteer-core";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
// Splash perf harness against the BUILT webgui (run from packages/webgui).
//   bun research/splash/shots/_bench.mjs build <label>        build current tree to /tmp/splash-bench/<label>
//   bun research/splash/shots/_bench.mjs px <label> [base]     frame hashes (+ pixel diff vs base)
//   bun research/splash/shots/_bench.mjs perf <label>...       compile/first frame, warm + cold, alternating
//   bun research/splash/shots/_bench.mjs size <label>          bytes of the splash chunk and entry share
//   bun research/splash/shots/_bench.mjs bg|bgshots|bgcost <label> app background checks, screenshots, blur cost
// Frozen time: the harness page imports the built scene chunk, pins performance.now and calls the
// production GateScene API (load, warm, frame); no hook in the shipped code.
const ROOT = "/tmp/splash-bench";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];
const [cmd, ...rest] = process.argv.slice(2);
const dirOf = l => path.join(ROOT, l);
// the module whose exports include GateScene (the scene chunk itself, or its re-export once the viewer shares it)
const sceneChunk = l => fs.readdirSync(dirOf(l)).find(f => f.endsWith(".js") && /as GateScene\b/.test(fs.readFileSync(path.join(dirOf(l), f), "utf8")));
const shaderChunk = l => fs.readdirSync(dirOf(l)).find(f => f.endsWith(".js") && fs.readFileSync(path.join(dirOf(l), f), "utf8").includes("EXT_color_buffer_float"));

if (cmd === "build") {
	const { buildWebgui } = await import(path.resolve("scripts/build.ts"));
	fs.rmSync(dirOf(rest[0]), { recursive: true, force: true });
	const r = await buildWebgui(dirOf(rest[0]));
	console.log("built", r.entryFile, sceneChunk(rest[0]));
	process.exit(0);
}

const HARNESS = `<!doctype html><html><body style="margin:0"><div id="root" style="display:none"></div><canvas id="c" style="display:block;width:100vw;height:100vh"></canvas><script type="module">
try {
const q = new URLSearchParams(location.search), mode = q.get("m");
const t0 = performance.now();
let tCtor = 0; window.__log = []; { const P = WebGL2RenderingContext.prototype; for (const fn of ["linkProgram", "compileShader", "getProgramParameter", "getContext"]) { const o = P[fn]; if (!o) continue; P[fn] = function (...a) { const t = performance.now(); const r = o.apply(this, a); window.__log.push([fn, a[1] ?? "", r, +t.toFixed(1), +(performance.now() - t).toFixed(2)]); return r; }; } }
{ const P = WebGL2RenderingContext.prototype, o = P.getUniformLocation; P.getUniformLocation = function (...a) { tCtor ||= performance.now(); return o.apply(this, a); }; }
const mod = await import("/" + q.get("chunk"));
const tImp = performance.now();
const c = document.getElementById("c");
const real = performance.now.bind(performance);
if (mode === "px") performance.now = () => 1000;
const scene = await mod.GateScene.load(c, +(q.get("hour") ?? 12.5));
const tLoad = real();
const gl = c.getContext("webgl2");
const style = { clipPath: "", opacity: "", transform: "", filter: "", setProperty() {} };
const grab = async name => { const px = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	await fetch("/__px?k=" + q.get("key") + "-" + name, { method: "POST", body: px }); };
const out = {};
if (mode === "px") {
	(scene.start ?? scene.warm).call(scene, 4000); // frozen sim/sky time 3 s
	await grab("t0");
	for (const t of (q.get("ts") ?? "").split(",").filter(Boolean)) { scene.frame(4000, +t, style); await grab("t" + t); }
} else {
	(scene.start ?? scene.warm).call(scene, real());
	const p = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
	const rd = t => { const a = []; for (let i = 0; i < 31; i++) { const s0 = real(); scene.frame(real(), t, style); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); a.push(real() - s0); } a.sort((x, y) => x - y); return a[15]; };
	out.ff = real(); out.rd0 = rd(0); out.rd9 = rd(0.9);
	out.imp = tImp - t0; out.load = tLoad - tImp; out.compile = tCtor - tImp; out.ctor = tLoad - tCtor; out.warm = out.ff - tLoad;
}
out.log = window.__log; document.documentElement.dataset.out = JSON.stringify(out); document.documentElement.dataset.bench = "done";
} catch (e) { document.documentElement.dataset.bench = "err " + e + " " + e.stack; }
</script></body></html>`;

function serve(label) {
	const st = { nonce: "", head: "" };
	const dir = dirOf(label);
	const chunk = sceneChunk(label);
	const PROBE = `<script>{ let last = performance.now(); const hb = setInterval(() => { const d = document.documentElement, now = performance.now(); d.dataset.lt = Math.max(+(d.dataset.lt ?? 0), now - last); last = now; if (d.dataset.gl) clearInterval(hb); }, 4); }
new MutationObserver(() => { const d = document.documentElement; if (!d.dataset.gl && d.classList.contains("splash-gl")) d.dataset.gl = performance.now(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });</script>`;
	const server = Bun.serve({
		port: 0,
		async fetch(req) {
			const u = new URL(req.url);
			if (u.pathname === "/__px") {
				const key = u.searchParams.get("k");
				fs.mkdirSync(path.join(dir, "px"), { recursive: true });
				fs.writeFileSync(path.join(dir, "px", key + ".bin"), Buffer.from(await req.arrayBuffer()));
				return new Response("ok");
			}
			if (u.pathname === "/__h.html") return new Response(HARNESS, { headers: { "content-type": "text/html" } });
			if (u.pathname.startsWith("/api/")) {
				await Bun.sleep(5000);
				return Response.json(u.pathname === "/api/live" ? st.live ?? [] : u.pathname === "/api/past" ? [] : {});
			}
			if (u.pathname === "/") {
				const html = await Bun.file(path.join(dir, "index.html")).text();
				return new Response(html.replace("<head>", () => `<head>${PROBE}${st.head}`), { headers: { "content-type": "text/html" } });
			}
			const f = Bun.file(path.join(dir, u.pathname));
			// a fresh hash constant per browser makes the main shader new to the OS Metal cache (true cold;
			// an unused uniform is not enough, it is stripped before the Metal compile)
			if (u.pathname === `/${shaderChunk(label)}` && st.nonce) {
				const js = (await f.text()).replace("43758.5453", `43758.${st.nonce}`);
				return new Response(js, { headers: { "content-type": "text/javascript" } });
			}
			return (await f.exists()) ? new Response(f) : new Response("nf", { status: 404 });
		},
	});
	return { server, chunk, st, url: p => `http://localhost:${server.port}${p}` };
}

const VIEWS = [[390, 844, 3], [1440, 900, 1]];
const HOURS = [6.5, 12.5, 18.3, 23];
const TS = "0.5,0.85";

if (cmd === "px") {
	const [label, base] = rest;
	const s = serve(label);
	const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
	const outDir = path.join(dirOf(label), "px");
	fs.mkdirSync(outDir, { recursive: true });
	let worst = 0;
	for (const [w, h, d] of VIEWS) for (const hour of HOURS) {
		const page = await b.newPage();
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
		await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
		const errs = []; page.on("pageerror", e => errs.push(String(e))); page.on("console", m => errs.push(m.text()));
		const k = `${w}-h${hour}`;
		await page.goto(s.url(`/__h.html?m=px&chunk=${s.chunk}&hour=${hour}&ts=${TS}&key=${k}`));
		await page.waitForFunction(() => document.documentElement.dataset.bench, { timeout: 30000 }).catch(() => errs.push("timeout"));
		const st = await page.evaluate(() => document.documentElement.dataset.bench);
		if (st !== "done") { console.log("FAIL", st, errs.join("\n")); process.exit(1); }
		for (const name of ["t0", ...TS.split(",").map(t => "t" + t)]) {
			const key = `${k}-${name}`;
			const buf = fs.readFileSync(path.join(outDir, key + ".bin"));
			let hh = 2166136261; for (let i = 0; i < buf.length; i++) { hh ^= buf[i]; hh = Math.imul(hh, 16777619); }
			let line = `${key} ${(hh >>> 0).toString(16)}`;
			if (base) {
				const bb = fs.readFileSync(path.join(dirOf(base), "px", key + ".bin"));
				let mx = 0, n = 0;
				for (let i = 0; i < buf.length; i++) { const dd = Math.abs(buf[i] - bb[i]); if (dd) { n++; if (dd > mx) mx = dd; } }
				line += ` maxdiff ${mx} channels ${n}`;
				worst = Math.max(worst, mx);
			}
			console.log(line);
		}
		if (errs.length) console.log(errs.join("\n"));
		await page.close();
	}
	if (base) console.log("WORST", worst);
	await b.close(); s.server.stop(true);
	process.exit(0);
}

const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

if (cmd === "perf") {
	const labels = rest;
	const N = +(process.env.N ?? 7);
	const ss = labels.map(serve);
	const res = Object.fromEntries(labels.map(l => [l, { warm: [], cold: [], app: [], appCold: [], ltCold: [], ltWarm: [] }]));
	const one = async (b, s, [w, h, d], app) => {
		const page = await b.newPage();
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d });
		if (app) {
			await page.goto(s.url("/"));
			await page.waitForFunction(() => document.documentElement.dataset.gl, { timeout: 30000 });
			await new Promise(r => setTimeout(r, 100));
			const v = await page.evaluate(() => ({ gl: +document.documentElement.dataset.gl, lt: +(document.documentElement.dataset.lt ?? 0) }));
			await page.close();
			return v;
		}
		await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
		await page.goto(s.url(`/__h.html?m=perf&chunk=${s.chunk}&hour=12.5`));
		await page.waitForFunction(() => document.documentElement.dataset.bench, { timeout: 30000 });
		const v = await page.evaluate(() => JSON.parse(document.documentElement.dataset.out));
		await page.close();
		return v;
	};
	const view = VIEWS[0];
	for (let run = 0; run < N; run++) {
		for (let i = 0; i < labels.length; i++) {
			const l = labels[i], s = ss[i];
			// cold: fresh profile (no GPU program cache), first load only
			s.st.nonce = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
			let b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
			res[l].cold.push(await one(b, s, view, false));
			s.st.nonce = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
			await b.close();
			b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
			const ac = await one(b, s, view, true);
			res[l].appCold.push(ac.gl); res[l].ltCold.push(ac.lt);
			// warm: same profile, program cache filled
			const aw = await one(b, s, view, true);
			res[l].app.push(aw.gl); res[l].ltWarm.push(aw.lt);
			res[l].warm.push(await one(b, s, view, false));
			await b.close();
		}
	}
	if (process.env.LOG) console.log(JSON.stringify(res[labels[0]].warm[0].log), JSON.stringify(res[labels[0]].cold[0].log), res[labels[0]].warm[0], res[labels[0]].cold[0]);
	for (const l of labels) {
		const r = res[l];
		const f = (a, k) => med(a.map(x => x[k])).toFixed(1);
		console.log(`${l} per-run true-cold app nav->gl: ${r.appCold.map(v => v.toFixed(0)).join(",")}; harness cold load: ${r.cold.map(x => x.load.toFixed(0)).join(",")}`);
		console.log(`${l}: cold compile ${f(r.cold, "compile")} ctor ${f(r.cold, "ctor")} load ${f(r.cold, "load")} warm-draw ${f(r.cold, "warm")} ff ${f(r.cold, "ff")} | warm compile ${f(r.warm, "compile")} ctor ${f(r.warm, "ctor")} load ${f(r.warm, "load")} warm-draw ${f(r.warm, "warm")} ff ${f(r.warm, "ff")} | redraw t0 ${f(r.warm, "rd0")} t.9 ${f(r.warm, "rd9")} | app nav->gl cold ${med(r.appCold).toFixed(1)} warm ${med(r.app).toFixed(1)} | longest main-thread gap before gl cold ${med(r.ltCold).toFixed(0)} warm ${med(r.ltWarm).toFixed(0)}`);
	}
	for (const s of ss) s.server.stop(true);
	process.exit(0);
}

if (cmd === "size") {
	const l = rest[0], dir = dirOf(l), c = sceneChunk(l);
	const sz = f => { const b = fs.readFileSync(path.join(dir, f)); return [b.length, zlib.gzipSync(b, { level: 9 }).length, zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length]; };
	console.log("scene chunk", c, sz(c).join(" / "));
	const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
	const entry = html.match(/src="\.?\/?([a-z0-9]{8}\.js)"/)?.[1];
	console.log("entry", entry, sz(entry).join(" / "));
	// entry share of src/splash/*: Bun metafile from an identical build config
	const { splashShaderPlugin } = await import(path.resolve("scripts/splash-shaders.ts"));
	const r = await Bun.build({ entrypoints: [path.resolve("src/main.tsx")], minify: true, splitting: true, define: { "process.env.NODE_ENV": '"production"' }, target: "browser", metafile: true, plugins: [splashShaderPlugin()] });
	for (const [k, o] of Object.entries(r.metafile.outputs)) {
		const parts = Object.entries(o.inputs).filter(([p]) => p.includes("src/splash/"));
		if (parts.length) console.log(k, parts.map(([p, v]) => `${path.basename(p)} ${v.bytesInOutput}`).join(", "));
	}
	process.exit(0);
}
// App background (src/splash/background.ts) on the built app, headless:
//   bg <label>      phone 390x844 dpr 3: splash then still image, GL released, encode/decode/size;
//                   desktop 1440x900: live behind the app, pauses when hidden, idle rate, guard steps when slowed
//   bgcost <label>  1440x900 with vsync and the frame-rate limit off: frames/s of the whole pipeline with
//                   glass panels (sidebar, inspector, top bar) over the live scene, blur on/off, and bg off
//                   UI=clear: the sessions page as Flat vs Clear (localStorage webgui.ui; live, still, off)
// Probe in the page's main world; puppeteer's evaluate may land in another world here, so results go
// through the DOM (html[data-bgp], JSON, every 50 ms) and the slow-frame switch is a DOM event.
const BG_PROBE = `(() => { const B = { draws: 0, ctx: [], blob: [], decode: [] };
const P = WebGL2RenderingContext.prototype, ob = P.bindFramebuffer;
P.bindFramebuffer = function (t, fb) { if (fb === null) B.draws++; return ob.call(this, t, fb); };
const C = HTMLCanvasElement.prototype, gc = C.getContext, tb = C.toBlob;
C.getContext = function (k, o) { const c = gc.call(this, k, o); if (k === "webgl2" && c && !B.ctx.includes(c)) B.ctx.push(c); return c; };
C.toBlob = function (cb, type, q) { const t0 = performance.now(), w = this.width, h = this.height;
	return tb.call(this, b => { B.blob.push({ ms: +(performance.now() - t0).toFixed(1), size: b && b.size, type: b && b.type, w, h }); cb(b); }, type, q); };
const I = HTMLImageElement.prototype, dc = I.decode;
I.decode = function () { const t0 = performance.now(); return dc.call(this).then(r => { B.decode.push(+(performance.now() - t0).toFixed(1)); return r; }); };
const pub = () => { document.documentElement.dataset.bgp = JSON.stringify({ draws: B.draws, blob: B.blob, decode: B.decode, lost: B.ctx.map(c => c.isContextLost()), handoff: B.handoff }); };
// handoff: ms from the splash removing its html classes to html[data-bg] (0 = same task)
new MutationObserver(() => { const d = document.documentElement; if (B.end == null && !d.classList.contains("splash-run") && B.seen) B.end = performance.now(); if (d.classList.contains("splash-run")) B.seen = 1; if (B.end != null && B.handoff == null && d.dataset.bg) B.handoff = +(performance.now() - B.end).toFixed(1); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-bg"] });
setInterval(pub, 50); pub();
document.addEventListener("bg-slow", () => { const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => r(t => { const e = performance.now() + 60; while (performance.now() < e); cb(t); }); });
})();`;
const GLASS = `for (const [cls, css] of [["sh-sidebar", "left:0;top:0;bottom:0;width:300px"], ["sh-inspector", "right:0;top:0;bottom:0;width:360px"], ["sh-topbar", "left:300px;right:360px;top:0;height:52px"]]) {
	const d = document.createElement("div"); d.className = cls; d.style.cssText = "position:fixed;display:flex;flex-direction:column;padding:16px;color:var(--fg);" + css; d.innerHTML = "<b>" + cls + "</b><span>Readable text on glass</span><span style='color:var(--fg-muted)'>muted secondary text</span>"; document.body.append(d); }`;

// bgshots <label>: screenshots at fixed hours (Date shimmed in the page), dark and light theme,
// phone still and desktop live with glass panels added, to <label>/bg/shot-*.png
//   UI=clear   sets localStorage webgui.ui=clear and adds ?hour=<h> (hours 5.5 6 6.5 12.5 18.3 19 19.5 20 23), files shot-clear-*, and prints the text
//              contrast: each text box of the sessions page against the pixels behind it (a second shot
//              with the text transparent, halo and glass kept); min = worst pixel, p5 = 5th percentile
//   BG=<mode>  adds ?bg=<mode> (BG=off: no scene, for pixel comparisons between builds)
if (cmd === "bgshots") {
	const s = serve(rest[0]);
	const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
	const shots = path.join(dirOf(rest[0]), "bg");
	fs.mkdirSync(shots, { recursive: true });
	// six live sessions, so the list shows cards
	s.st.live = ["refactor auth", "splash bench", "webgui tests", "docs pass", "ocean shader", "release notes"].map((n, i) => ({ version: 1, instanceId: `i${i}`, pid: 1, createdAt: 0, sessionId: `s${i}`, sessionName: n, cwd: "/tmp/project", model: null, startedAt: 0, origin: "host", recap: null, lastActivityAt: Date.now() - i * 60000, assistantCount: 3 }));
	const clear = process.env.UI === "clear";
	const bgq = process.env.BG ? `bg=${process.env.BG}` : "";
	const contrast = [];
	const hours = process.env.HOURS ? process.env.HOURS.split(",").map(Number) : clear ? [5.5, 6, 6.5, 12.5, 18.3, 19, 19.5, 20, 23] : [12.5, 18.3, 23];
	const themes = process.env.THEMES ? process.env.THEMES.split(",") : ["dark", "light"];
	for (const hour of hours) for (const theme of themes) for (const [w, h, d] of VIEWS) {
		s.st.head = `<script>{ const R = Date, t = new R(); t.setHours(${Math.floor(hour)}, ${Math.round((hour % 1) * 60)}, 0, 0); const off = t - R.now();
			window.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }; }</script>`;
		const page = await b.newPage();
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d, isMobile: w < 800, hasTouch: w < 800 });
		// BG=off: reduced motion too (no splash, no spinner), so two builds give comparable pixels
		await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }, ...(process.env.BG === "off" ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [])]);
		if (clear) await page.evaluateOnNewDocument(() => localStorage.setItem("webgui.ui", "clear"));
		const q = [clear ? `hour=${hour}` : "", bgq].filter(Boolean).join("&");
		await page.goto(s.url("/" + (q ? "?" + q : "")));
		if (process.env.BG === "off") await page.waitForFunction(() => document.querySelector(".ses-row") && !document.documentElement.classList.contains("splash-run"), { timeout: 30000 });
		else await page.waitForFunction(() => document.querySelector(".app-bg-layer canvas") || document.querySelector(".app-bg-layer")?.style.backgroundImage.includes("blob:"), { timeout: 30000 });
		if (w > 800 && process.env.GLASS) await page.evaluate(g => new Function(g)(), GLASS);
		// sessions arrive after the API delay (5 s); the light after its first update
		await page.waitForFunction(() => document.querySelector(".ses-row"), { timeout: 30000 }).catch(() => {});
		await new Promise(r => setTimeout(r, clear ? 2500 : 400));
		const file = path.join(shots, `shot-${clear ? "clear-" : ""}${w}-${theme}-h${hour}.png`);
		await page.screenshot({ path: file });
		if (clear) {
			// text boxes: elements with their own text, inside the sessions page
			const boxes = await page.evaluate(() => {
				const out = [];
				// tight boxes of the text nodes themselves (Range rects), so dots, rims and icons next to
				// the text are not counted as its background
				for (const el of document.querySelectorAll(".ses-page *")) {
					const cs = getComputedStyle(el);
					if (cs.visibility === "hidden") continue;
					for (const n of el.childNodes) {
						if (n.nodeType !== 3 || !n.textContent.trim()) continue;
						const rg = document.createRange(); rg.selectNodeContents(n);
						for (const r of rg.getClientRects()) {
							if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
							out.push({ cls: el.className || el.tagName, x: r.x, y: r.y, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize) });
						}
					}
				}
				const st = document.createElement("style");
				// glyph fill near-invisible (1% alpha) rather than transparent: Chrome drops the text-shadow
				// of fully transparent text, and the halo is part of the text's local background
				st.textContent = ".ses-page *{-webkit-text-fill-color:rgb(0 0 0 / 1%)!important}";
				document.head.append(st);
				return out;
			});
			await new Promise(r => setTimeout(r, 300));
			const bare = await page.screenshot({ encoding: "base64" });
			const m = await b.newPage();
			const res = await m.evaluate(async (png, boxes, d) => {
				const img = new Image(); img.src = "data:image/png;base64," + png; await img.decode();
				const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
				const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
				const lum = (r, gg, bb) => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bb); };
				const one = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
				return boxes.map(bx => {
					one.clearRect(0, 0, 1, 1); one.fillStyle = bx.color; one.fillRect(0, 0, 1, 1);
					const [fr, fg, fb, fa] = one.getImageData(0, 0, 1, 1).data, a = fa / 255;
					const px = g.getImageData(Math.round(bx.x * d), Math.round(bx.y * d), Math.max(1, Math.round(bx.w * d)), Math.max(1, Math.round(bx.h * d))).data;
					const rs = [];
					for (let i = 0; i < px.length; i += 4) {
						const L1 = lum(px[i], px[i + 1], px[i + 2]);
						const L2 = lum(fr * a + px[i] * (1 - a), fg * a + px[i + 1] * (1 - a), fb * a + px[i + 2] * (1 - a));
						rs.push((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05));
					}
					rs.sort((x, y) => x - y);
					return { cls: bx.cls, size: bx.size, min: rs[0], p5: rs[Math.floor(rs.length * 0.05)] };
				});
			}, bare, boxes, d);
			await m.close();
			const worst = res.reduce((a, r) => (r.min < a.min ? r : a), { min: Infinity });
			const worstP5 = res.reduce((a, r) => (r.p5 < a.p5 ? r : a), { p5: Infinity });
			contrast.push({ w, theme, hour, n: res.length, min: worst.min, minCls: worst.cls, p5: worstP5.p5, p5Cls: worstP5.cls, boxes: res });
			console.log(`contrast ${w} ${theme} h${hour}: boxes ${res.length} min ${worst.min.toFixed(2)} (${worst.cls}) worst p5 ${worstP5.p5.toFixed(2)} (${worstP5.cls})`);
		}
		console.log(file);
		await page.close();
	}
	if (clear) fs.writeFileSync(path.join(shots, "contrast.json"), JSON.stringify(contrast, null, 1));
	await b.close(); s.server.stop(true);
	process.exit();
}

if (cmd === "bg") {
	const s = serve(rest[0]);
	const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
	const shots = path.join(dirOf(rest[0]), "bg");
	fs.mkdirSync(shots, { recursive: true });
	const fail = m => { console.log("FAIL", m); process.exitCode = 1; };
	const open = async (w, h, d, q = "") => {
		const page = await b.newPage();
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d, isMobile: w < 800, hasTouch: w < 800 });
		s.st.head = `<script>${BG_PROBE}</script>`;
		page.on("pageerror", e => console.log("pageerror", String(e)));
		await page.goto(s.url("/" + q), { waitUntil: "load" });
		await page.waitForFunction(() => document.documentElement.dataset.bgp, { timeout: 10000 });
		return page;
	};
	const probe = page => page.evaluate(() => JSON.parse(document.documentElement.dataset.bgp));
	const draws = async (page, ms) => { const a = (await probe(page)).draws; await new Promise(r => setTimeout(r, ms)); return (await probe(page)).draws - a; };
	const bgState = async page => ({ ...(await page.evaluate(() => ({ bg: document.documentElement.dataset.bg ?? null, img: document.querySelector(".app-bg-layer")?.style.backgroundImage ?? "", canvases: document.querySelectorAll("canvas").length, cw: document.querySelector(".app-bg-layer canvas")?.width ?? 0, focus: document.hasFocus() }))), ...(await probe(page)) });

	// phone: still
	{
		const page = await open(390, 844, 3);
		const t0 = Date.now();
		await page.waitForFunction(() => document.querySelector(".app-bg-layer")?.style.backgroundImage.includes("blob:"), { timeout: 30000 }).catch(() => {});
		await new Promise(r => setTimeout(r, 200));
		const st = await bgState(page);
		console.log("phone", JSON.stringify({ ...st, ready_ms: Date.now() - t0 }));
		if (st.bg !== "still" || !st.img.includes("blob:")) fail("phone: no still image");
		if (!st.lost.every(Boolean)) fail("phone: a GL context is still alive");
		if (st.canvases !== 0) fail("phone: canvas left in the DOM");
		await page.screenshot({ path: path.join(shots, "phone-still.png") });
		await page.close();
	}
	// desktop: live
	{
		const page = await open(1440, 900, 1);
		await page.waitForFunction(() => document.documentElement.dataset.bg === "live" && document.querySelector(".app-bg-layer canvas"), { timeout: 30000 }).catch(() => {});
		await new Promise(r => setTimeout(r, 500));
		const st = await bgState(page);
		const live = await draws(page, 2000);
		console.log("desktop live", JSON.stringify({ bg: st.bg, cw: st.cw, focus: st.focus, fps: live / 2, handoff: st.handoff }));
		if (st.bg !== "live" || live < 60) fail("desktop: not live");
		await page.screenshot({ path: path.join(shots, "desktop-live.png") });
		const other = await b.newPage();
		await other.bringToFront();
		const hidden = await draws(page, 1500);
		const vis = await page.evaluate(() => document.visibilityState);
		await page.bringToFront();
		await other.close();
		const back = await draws(page, 1000);
		console.log("desktop hidden", JSON.stringify({ visibility: vis, drawsHidden: hidden, fpsBack: back }));
		if (hidden > 1 || back < 30) fail("desktop: hidden pause/resume");
		// idle: no input since load; wait past 30 s
		await page.waitForFunction(() => performance.now() > 33000, { timeout: 60000, polling: 500 });
		const idle = await draws(page, 3000);
		await page.mouse.move(400, 400);
		await page.mouse.move(420, 410);
		const woke = await draws(page, 1000);
		console.log("desktop idle", JSON.stringify({ fpsIdle: idle / 3, fpsAfterInput: woke }));
		if (idle / 3 > 12 || woke < 30) fail("desktop: idle rate");
		// guard: every rAF callback spins 60 ms first
		await page.evaluate(() => document.dispatchEvent(new Event("bg-slow")));
		const t0 = Date.now(), seen = [];
		while (Date.now() - t0 < 12000) {
			await page.mouse.move(400 + (Date.now() % 50), 400);
			const v = await page.evaluate(() => ({ bg: document.documentElement.dataset.bg, cw: document.querySelector(".app-bg-layer canvas")?.width ?? 0, img: (document.querySelector(".app-bg-layer")?.style.backgroundImage ?? "").slice(0, 9) }));
			const k = `${v.bg} ${v.cw} ${v.img}`;
			if (seen.at(-1)?.k !== k) seen.push({ t: Date.now() - t0, k });
			if (v.bg === "still" && v.img.startsWith("url(\"blob")) break;
			await new Promise(r => setTimeout(r, 200));
		}
		const fin = await bgState(page);
		console.log("desktop guard", JSON.stringify(seen), "lost", JSON.stringify(fin.lost));
		if (fin.bg !== "still") fail("desktop: guard did not reach still");
		await page.close();
	}
	await b.close(); s.server.stop(true);
	process.exit();
}

if (cmd === "bgcost") {
	// Large window (16" MacBook Pro default, 1728x1117 @2x), vsync on, live scene with glass panels, blur on vs
	// off. Trace 4 s: presented frames (viz Display::DrawAndSwap) and busy ms per frame of the GPU process
	// main thread and the viz compositor thread (top-level tasks). That is the CPU side of compositing
	// (where the backdrop blur is encoded) plus the page's GL; GPU execution time is not visible here.
	const s = serve(rest[0]);
	const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
	const NOBLUR = "*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";
	const BLUR = ".sh-topbar,.sh-sidebar,.sh-inspector{backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important}";
	// UI=clear: the sessions page (six live cards) as Flat vs Clear, plus clear with the card blur
	// forced on over the live scene (the cost the spec's blur rule weighs against the scene)
	const clear = process.env.UI === "clear";
	const CARD_BLUR = ".ses-row{backdrop-filter:blur(6px)!important;-webkit-backdrop-filter:blur(6px)!important}";
	const variants = clear
		? [["live-current", "", "live", ""], ["live-clear", "", "live", "clear"], ["live-clear-blur", CARD_BLUR, "live", "clear"], ["still-current", "", "still", ""], ["still-clear(blur)", "", "still", "clear"], ["off-current", "", "off", ""], ["off-clear", "", "off", "clear"]]
		: [["live-shipped", "", "live"], ["live-blur", BLUR, "live"], ["still-shipped(blur)", "", "still"], ["still-noblur", NOBLUR, "still"]];
	if (clear) s.st.live = ["refactor auth", "splash bench", "webgui tests", "docs pass", "ocean shader", "release notes"].map((n, i) => ({ version: 1, instanceId: `i${i}`, pid: 1, createdAt: 0, sessionId: `s${i}`, sessionName: n, cwd: "/tmp/project", model: null, startedAt: 0, origin: "host", recap: null, lastActivityAt: Date.now() - i * 60000, assistantCount: 3 }));
	const res = Object.fromEntries(variants.map(([n]) => [n, []]));
	for (let run = 0; run < +(process.env.N ?? 5); run++) for (const [name, css, mode, ui] of variants) {
		const page = await b.newPage();
		await page.setViewport({ width: 1728, height: 1117, deviceScaleFactor: 2 });
		if (ui) await page.evaluateOnNewDocument(ui => localStorage.setItem("webgui.ui", ui), ui);
		await page.goto(s.url(`/?bg=${mode}`));
		if (clear) {
			// after the splash and the first light (html.clear-lit), so one-off transitions are not traced
			await page.waitForFunction(ui => document.querySelector(".ses-row") && !document.documentElement.classList.contains("splash-run") && (!ui || document.documentElement.classList.contains("clear-lit")), { timeout: 30000 }, ui);
			await page.evaluate(css => { const st = document.createElement("style"); st.textContent = css; document.head.append(st); }, css);
		} else {
			await page.waitForFunction(() => document.querySelector(".app-bg-layer canvas") || document.querySelector(".app-bg-layer")?.style.backgroundImage.includes("blob:"), { timeout: 30000 });
			// text in the glass panels moves every frame (stands in for scrolling a list over the backdrop)
			const MOVE = "@keyframes bgmv{to{transform:translateY(600px)}}.sh-sidebar span,.sh-inspector span{animation:bgmv 2s linear infinite alternate}";
			await page.evaluate((g, css) => { new Function(g)(); const st = document.createElement("style"); st.textContent = css; document.head.append(st); }, GLASS, css + MOVE);
		}
		await new Promise(r => setTimeout(r, 500));
		await page.tracing.start({ categories: ["toplevel", "viz"] });
		await new Promise(r => setTimeout(r, 4000));
		const ev = JSON.parse(new TextDecoder().decode(await page.tracing.stop())).traceEvents;
		const names = new Map(ev.filter(e => e.ph === "M" && e.name === "thread_name").map(e => [`${e.pid}:${e.tid}`, e.args.name]));
		const busy = th => ev.filter(e => e.ph === "X" && e.name === "ThreadControllerImpl::RunTask" && names.get(`${e.pid}:${e.tid}`) === th).reduce((a, e) => a + e.dur, 0) / 1000;
		const frames = ev.filter(e => e.name === "Display::DrawAndSwap" && (e.ph === "X" || e.ph === "B")).length;
		res[name].push({ fps: frames / 4, gpu: busy("CrGpuMain") / Math.max(1, frames), viz: busy("VizCompositorThread") / Math.max(1, frames), gpuS: busy("CrGpuMain") / 4 });
		await page.close();
	}
	for (const [n] of variants) {
		const r = res[n], m = k => med(r.map(x => x[k]));
		console.log(`${n}: presented ${m("fps").toFixed(1)} fps, GPU main ${m("gpu").toFixed(2)} ms/frame (${m("gpuS").toFixed(0)} ms/s), viz ${m("viz").toFixed(2)} ms/frame (gpu ms/frame runs ${r.map(x => x.gpu.toFixed(2)).join(",")})`);
	}
	await b.close(); s.server.stop(true);
	process.exit();
}

console.log("unknown command");
