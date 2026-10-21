/**
 * Scroll defect repro cases 8-14. Every case measures the screen position of a
 * marked row per animation frame, not scrollTop, and records the app's own
 * scroll writes on `.tr-root` through a prototype spy installed in the main world after load.
 */
import type { Browser, Page } from "puppeteer-core";

type Result = { pass: boolean; evidence: string };

interface BenchHost {
	instanceId: string;
	broadcast(frame: unknown): void;
	close(): Promise<void>;
}

export interface CaseDeps {
	browser: Browser;
	port: number;
	registryDir: string;
	startHost(opts: { registryDir: string; sessionId: string; initialEntries: unknown[] }): BenchHost;
	buildHistory(turns: number): unknown[];
	installPageHelpers(): void;
	iphoneUA: string;
}

interface Sample {
	t: number;
	top: number;
	st: number;
	app: number;
}

interface BenchSpy {
	samples: Sample[];
	sampling: boolean;
	row: Element | null;
	/** App writes to `.tr-root` so far, and the sum of the scrollTop change they made. */
	writeCount(): number;
	appDelta(): number;
	set(v: number): void;
	markRow(el: Element | null): number;
	markTop(): number;
	rowTop(): number;
	start(): void;
	stop(): Sample[];
}

declare global {
	var __bench: BenchSpy;
}

// Main world (installed with addScriptTag: puppeteer's evaluate runs in an
// isolated world whose prototype patches the app never sees). Wraps
// scrollTop/scrollTo/scrollBy and tallies writes to `.tr-root` that the bench
// did not flag, on <html> data attributes the isolated world can read.
function installMainSpy(): void {
	const desc = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop")!;
	const ds = document.documentElement.dataset;
	ds.benchWrites = "0";
	ds.benchApp = "0";
	const record = (el: Element, before: number) => {
		if (ds.benchWriting === "1" || !el.classList?.contains("tr-root")) return;
		ds.benchWrites = String(Number(ds.benchWrites) + 1);
		ds.benchApp = String(Number(ds.benchApp) + desc.get!.call(el) - before);
	};
	Object.defineProperty(Element.prototype, "scrollTop", {
		configurable: true,
		enumerable: desc.enumerable,
		get: desc.get,
		set(this: Element, v: number) {
			const before = desc.get!.call(this);
			desc.set!.call(this, v);
			record(this, before);
		},
	});
	for (const name of ["scrollTo", "scrollBy"] as const) {
		const orig = Element.prototype[name] as (...a: unknown[]) => void;
		Element.prototype[name] = function (this: Element, ...args: unknown[]) {
			const before = desc.get!.call(this);
			orig.apply(this, args);
			record(this, before);
		} as never;
	}
}

// Isolated world: bench writes, row marking and the per-frame sampler.
function installSpy(): void {
	const ds = document.documentElement.dataset;
	const b: BenchSpy = {
		samples: [],
		sampling: false,
		row: null,
		writeCount: () => Number(ds.benchWrites ?? 0),
		appDelta: () => Number(ds.benchApp ?? 0),
		set(v) {
			const el = document.querySelector<HTMLElement>(".tr-root")!;
			ds.benchWriting = "1";
			try {
				el.scrollTop = v;
			} finally {
				ds.benchWriting = "0";
			}
		},
		markRow(el) {
			b.row = el;
			return b.rowTop();
		},
		markTop() {
			const el = document.querySelector<HTMLElement>(".tr-root")!;
			const top = el.getBoundingClientRect().top;
			for (const row of el.querySelectorAll(".tr-item")) {
				if (row.getBoundingClientRect().bottom > top + 5) return b.markRow(row);
			}
			return b.markRow(null);
		},
		rowTop: () => (b.row?.isConnected ? b.row.getBoundingClientRect().top : NaN),
		start() {
			b.samples = [];
			b.sampling = true;
			// Sample once per frame after layout and after the app's resize
			// observer (created earlier, so called first), i.e. what gets painted.
			// A requestAnimationFrame read would force layout before the app's
			// observer runs and record states that never reach the screen.
			const probe = document.createElement("div");
			probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden";
			document.body.append(probe);
			const ro = new ResizeObserver(() => {
				if (!b.sampling) {
					ro.disconnect();
					probe.remove();
					return;
				}
				const el = document.querySelector<HTMLElement>(".tr-root");
				b.samples.push({
					t: performance.now(),
					top: b.rowTop(),
					st: el ? el.scrollTop : NaN,
					app: b.appDelta(),
				});
			});
			ro.observe(probe);
			const tick = () => {
				if (!b.sampling) return;
				probe.style.width = probe.style.width === "1px" ? "2px" : "1px";
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		},
		stop() {
			b.sampling = false;
			return b.samples;
		},
	};
	globalThis.__bench = b;
}

async function open(
	d: CaseDeps,
	sessionId: string,
	turns: number,
	desktop = false,
): Promise<{ page: Page; host: BenchHost }> {
	const host = d.startHost({
		registryDir: d.registryDir,
		sessionId,
		initialEntries: d.buildHistory(turns),
	});
	const page = await d.browser.newPage();
	if (desktop) {
		await page.setViewport({ width: 1200, height: 700 });
	} else {
		await page.setUserAgent(d.iphoneUA);
		await page.setViewport({
			width: 390,
			height: 664,
			isMobile: true,
			hasTouch: true,
			deviceScaleFactor: 1,
		});
	}
	await page.goto(`http://127.0.0.1:${d.port}/#/s/${host.instanceId}`, {
		waitUntil: "domcontentloaded",
	});
	await page.waitForSelector(".tr-item", { timeout: 15000 });
	await page.evaluate(d.installPageHelpers);
	// Post-load: only writes made after setup are measured.
	await page.addScriptTag({ content: `(${installMainSpy})()` });
	await page.evaluate(installSpy);
	if (!desktop) {
		// iOS Safari has no scroll anchoring.
		await page.evaluate(() =>
			document.querySelector<HTMLElement>(".tr-root")!.style.setProperty("overflow-anchor", "none", "important"),
		);
	}
	await Bun.sleep(1500);
	return { page, host };
}

async function close(o: { page: Page; host: { close(): Promise<void> } }) {
	await o.page.close();
	await o.host.close();
}

function startLive(host: { broadcast(f: unknown): void }, sid: number) {
	host.broadcast({ type: "turn_start" });
	host.broadcast({
		type: "msg_start",
		sid,
		message: { role: "assistant", content: [], timestamp: Date.now() },
	});
	host.broadcast({
		type: "block_start",
		sid,
		block: 0,
		start: { type: "text" },
	});
	host.broadcast({
		type: "delta",
		sid,
		block: 0,
		text: "Live reply starts here.\n\n",
	});
}

function startTool(host: { broadcast(f: unknown): void }, sid: number, block: number, id: string) {
	host.broadcast({
		type: "block_start",
		sid,
		block,
		start: { type: "toolCall", id, name: "bash" },
	});
	host.broadcast({
		type: "tool_execution_start",
		toolCallId: id,
		toolName: "bash",
		args: { command: "bun test" },
	});
}

/** Touch-scroll by `dy` (negative = up), as a finger would: touchstart, write, scroll, touchend. */
async function touchScroll(page: Page, dy: number, endTouch = true) {
	return page.evaluate(
		(dy, endTouch) => {
			const el = document.querySelector<HTMLElement>(".tr-root")!;
			el.dispatchEvent(new Event("touchstart"));
			const before = el.scrollTop;
			globalThis.__bench.set(before + dy);
			el.dispatchEvent(new Event("scroll"));
			if (endTouch) el.dispatchEvent(new Event("touchend"));
			return el.scrollTop - before;
		},
		dy,
		endTouch,
	);
}

const touch = (page: Page, type: "touchstart" | "touchend") =>
	page.evaluate(t => document.querySelector(".tr-root")!.dispatchEvent(new Event(t)), type);

/** Row movement not explained by the user's own scrolling (app writes count as non-user). */
function excessSeries(samples: Sample[], base: Sample) {
	// top moves by -(user scrollTop change). user = st - app.
	return samples.map(s => s.top - base.top + (s.st - s.app - (base.st - base.app)));
}

function maxAbs(xs: number[]) {
	let m = 0;
	for (const x of xs) if (Number.isFinite(x) && Math.abs(x) > Math.abs(m)) m = x;
	return m;
}

function maxFrameJump(samples: Sample[]) {
	let m = 0;
	for (let i = 1; i < samples.length; i++) {
		const userD = samples[i].st - samples[i].app - (samples[i - 1].st - samples[i - 1].app);
		const j = samples[i].top - samples[i - 1].top + userD;
		if (Number.isFinite(j) && Math.abs(j) > Math.abs(m)) m = j;
	}
	return m;
}

const r1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : String(n));

async function case8(d: CaseDeps): Promise<Result> {
	const o = await open(d, "c8-session", 30);
	const { page, host } = o;
	try {
		const sid = 801;
		startLive(host, sid);
		await Bun.sleep(300);
		await touchScroll(page, -400);
		await Bun.sleep(400);
		const writes0 = await page.evaluate(() => globalThis.__bench.writeCount());
		await page.evaluate(() => {
			globalThis.__bench.markTop();
			globalThis.__bench.start();
		});
		await touch(page, "touchstart");
		startTool(host, sid, 1, "c8-tool");
		for (let i = 0; i < 30; i++) {
			host.broadcast({
				type: "delta",
				sid,
				block: 0,
				text: `Streamed sentence ${i} with some more words.\n\n`,
			});
			host.broadcast({
				type: "tool_output",
				toolCallId: "c8-tool",
				text: `out line ${i}\n`.repeat(3),
			});
			await Bun.sleep(33);
		}
		await Bun.sleep(100);
		const hold = await page.evaluate(() => globalThis.__bench.samples.slice());
		const writesHold = (await page.evaluate(() => globalThis.__bench.writeCount())) - writes0;
		await touch(page, "touchend");
		await Bun.sleep(400);
		const all = await page.evaluate(() => globalThis.__bench.stop());
		const after = all.slice(hold.length - 1);
		const holdDrift = maxAbs(excessSeries(hold, hold[0]));
		const flushJump = maxFrameJump(after);
		const finalDrift = maxAbs(excessSeries([all[all.length - 1]], all[0]));
		const writesTotal = (await page.evaluate(() => globalThis.__bench.writeCount())) - writes0;
		return {
			pass: Math.abs(holdDrift) <= 2 && Math.abs(flushJump) <= 2 && Math.abs(finalDrift) <= 2 && writesHold === 0,
			evidence: `hold ${hold.length} frames: max row drift=${r1(holdDrift)}px, app writes during hold=${writesHold}; after touchend ${after.length} frames: largest single-frame jump=${r1(flushJump)}px, final drift=${r1(finalDrift)}px, app writes total=${writesTotal}`,
		};
	} finally {
		await close(o);
	}
}

async function case9(d: CaseDeps): Promise<Result> {
	const o = await open(d, "c9-session", 30);
	const { page } = o;
	try {
		await touchScroll(page, -600);
		await Bun.sleep(400);
		// Bring the nearest tool header to mid-viewport so a tap target is on screen.
		const dy = await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			const mid = root.getBoundingClientRect().top + 250;
			let best = NaN;
			for (const h of root.querySelectorAll(".tv-head[aria-expanded]")) {
				const d = h.getBoundingClientRect().top - mid;
				if (!(Math.abs(d) >= Math.abs(best))) best = d;
			}
			return best;
		});
		if (Number.isFinite(dy)) await touchScroll(page, dy);
		await Bun.sleep(400);
		const setup = await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			const box = root.getBoundingClientRect();
			const heads = [
				...root.querySelectorAll<HTMLElement>(".tv-head[aria-expanded], .tr-item button[aria-expanded]"),
			];
			for (const h of heads) {
				const hb = h.getBoundingClientRect();
				if (hb.top < box.top + 40 || hb.bottom > box.bottom - 40) continue;
				const row = h.closest(".tr-item");
				const prev = row?.previousElementSibling?.classList.contains("tr-item") ? row.previousElementSibling : null;
				// Column-reverse renders DOM order normally inside a reversed wrapper or reversed itself; pick the row visually above.
				const rows = [...root.querySelectorAll(".tr-item")].filter(r => r !== row);
				const above = rows
					.map(r => ({ r, b: r.getBoundingClientRect() }))
					.filter(x => x.b.bottom <= hb.top && x.b.bottom > box.top + 5)
					.sort((a, b) => b.b.bottom - a.b.bottom)[0]?.r;
				h.setAttribute("data-bench-click", "1");
				return {
					found: true,
					expanded: h.getAttribute("aria-expanded"),
					cls: `${h.className}${(above ?? prev) ? "" : " (no row above in view)"}`,
				};
			}
			return {
				found: false,
				expanded: null,
				cls: `heads=${heads.length} root=${Math.round(box.top)}..${Math.round(box.bottom)} tops=${heads
					.map(h => Math.round(h.getBoundingClientRect().top))
					.filter(t => t > -1500 && t < 2000)
					.join(",")}`,
			};
		});
		if (!setup.found)
			return {
				pass: false,
				evidence: `no visible expandable header with a row above it (${setup.cls})`,
			};
		await page.evaluate(() => {
			const h = document.querySelector<HTMLElement>("[data-bench-click]")!;
			const hb = h.getBoundingClientRect();
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			const above = [...root.querySelectorAll(".tr-item")]
				.map(r => ({ r, b: r.getBoundingClientRect() }))
				.filter(x => x.b.bottom <= hb.top && x.b.bottom > root.getBoundingClientRect().top + 5)
				.sort((a, b) => b.b.bottom - a.b.bottom)[0]?.r;
			above?.setAttribute("data-bench-above", "1");
			// Per-frame track the tapped header: expanding its body must not move it.
			globalThis.__bench.markRow(h);
		});
		const writes0 = await page.evaluate(() => globalThis.__bench.writeCount());
		const aboveTop = () =>
			page.evaluate(() => document.querySelector("[data-bench-above]")?.getBoundingClientRect().top ?? NaN);
		const above0 = await aboveTop();
		await page.evaluate(async () => {
			const b = globalThis.__bench;
			b.start();
			// Take the baseline from a painted frame before the tap; a sample after
			// the click would already contain any shift the app failed to correct.
			while (b.samples.length === 0) {
				const { promise, resolve } = Promise.withResolvers<void>();
				requestAnimationFrame(() => resolve());
				await promise;
			}
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			root.dispatchEvent(new Event("touchstart"));
			root.dispatchEvent(new Event("touchend"));
			document.querySelector<HTMLElement>("[data-bench-click]")!.click();
		});
		await Bun.sleep(100);
		const aboveMid = await aboveTop();
		await Bun.sleep(400);
		const s = await page.evaluate(() => globalThis.__bench.stop());
		const aboveEnd = await aboveTop();
		const st = await page.evaluate(() => ({
			expanded: document.querySelector("[data-bench-click]")?.getAttribute("aria-expanded"),
			writes: globalThis.__bench.writeCount(),
		}));
		const dev = s.map(x => x.top - s[0].top); // no user scrolling: any movement is a shift
		const worst = maxAbs(dev);
		let settleFrame = -1;
		for (let i = dev.length - 1; i >= 0; i--) {
			if (!(Math.abs(dev[i]) <= 2)) {
				settleFrame = i + 1;
				break;
			}
		}
		if (settleFrame === -1) settleFrame = 0;
		const corrected = Math.abs(dev[dev.length - 1]) <= 2;
		return {
			pass: Math.abs(worst) <= 2,
			evidence: `clicked ${setup.cls} aria-expanded ${setup.expanded}->${st.expanded}; ${s.length} frames; tapped header: max deviation=${r1(worst)}px, final=${r1(dev[dev.length - 1])}px, ${corrected ? `back within 2px from frame ${settleFrame}` : "never corrected"}; per-frame first 15=[${dev
				.slice(0, 15)
				.map(x => Math.round(x))
				.join(
					",",
				)}]; row above moved ${r1(aboveMid - above0)}px at +100ms, ${r1(aboveEnd - above0)}px at +500ms; app writes=${st.writes - writes0}`,
		};
	} finally {
		await close(o);
	}
}

/** Step down by +150 with finger down, as case 7 does upward. Returns per-step excess. */
async function stepDown(page: Page, steps: number) {
	return page.evaluate(async steps => {
		const frame = () => {
			const { promise, resolve } = Promise.withResolvers<number>();
			requestAnimationFrame(resolve);
			return promise;
		};
		const b = globalThis.__bench;
		const el = document.querySelector<HTMLElement>(".tr-root")!;
		const out: number[] = [];
		for (let i = 0; i < steps; i++) {
			const t0 = b.markTop();
			if (!Number.isFinite(t0)) break;
			el.dispatchEvent(new Event("touchstart"));
			const before = el.scrollTop;
			b.set(before + 150);
			el.dispatchEvent(new Event("scroll"));
			const moved = el.scrollTop - before;
			if (moved === 0) {
				el.dispatchEvent(new Event("touchend"));
				break;
			}
			let worst = 0;
			for (let f = 0; f < 12; f++) {
				await frame();
				if (f === 2) el.dispatchEvent(new Event("touchend"));
				// The user moved content by `moved`; anything else is a shift.
				const ex = b.rowTop() - t0 + moved;
				if (Number.isFinite(ex) && Math.abs(ex) > Math.abs(worst)) worst = ex;
			}
			const settled = Promise.withResolvers<void>();
			setTimeout(settled.resolve, 200);
			await settled.promise;
			const fin = b.rowTop() - t0 + moved;
			out.push(Math.round(Math.abs(fin) > Math.abs(worst) ? fin : worst));
		}
		return out;
	}, steps);
}

function summarizeSteps(ex: number[]) {
	const glitches = ex.filter(x => Math.abs(x) > 2).length;
	const worst = Math.max(0, ...ex.map(Math.abs));
	return { glitches, worst };
}

async function case10(d: CaseDeps): Promise<Result> {
	const o = await open(d, "c10-session", 80);
	const { page } = o;
	let a: { steps: number; glitches: number; worst: number; list: string };
	try {
		await page.evaluate(() => {
			const el = document.querySelector<HTMLElement>(".tr-root")!;
			el.dispatchEvent(new Event("touchstart"));
			globalThis.__bench.set(-(el.scrollHeight - el.clientHeight));
			el.dispatchEvent(new Event("scroll"));
			el.dispatchEvent(new Event("touchend"));
		});
		await Bun.sleep(1500);
		const ex = await stepDown(page, 40);
		const s = summarizeSteps(ex);
		a = {
			steps: ex.length,
			...s,
			list: ex
				.filter(x => Math.abs(x) > 2)
				.slice(0, 12)
				.join(","),
		};
	} finally {
		await close(o);
	}
	const o2 = await open(d, "c10b-session", 30);
	let b: typeof a;
	try {
		const { page: p2, host } = o2;
		const sid = 1001;
		startLive(host, sid);
		startTool(host, sid, 1, "c10-tool");
		await Bun.sleep(300);
		await touchScroll(p2, -3000);
		await Bun.sleep(400);
		for (let i = 0; i < 40; i++) {
			host.broadcast({
				type: "delta",
				sid,
				block: 0,
				text: `Large streamed paragraph ${i}. ${"word ".repeat(60)}\n\n`,
			});
			host.broadcast({
				type: "tool_output",
				toolCallId: "c10-tool",
				text: `big output ${i}\n`.repeat(10),
			});
			await Bun.sleep(20);
		}
		await Bun.sleep(500);
		const ex = await stepDown(p2, 30);
		const s = summarizeSteps(ex);
		b = {
			steps: ex.length,
			...s,
			list: ex
				.filter(x => Math.abs(x) > 2)
				.slice(0, 12)
				.join(","),
		};
	} finally {
		await close(o2);
	}
	return {
		pass: a.glitches === 0 && b.glitches === 0 && a.steps >= 30,
		evidence: `A (top of 80-turn history, +150 x40): steps=${a.steps}, glitches(>2px)=${a.glitches}, worst=${a.worst}px [${a.list}]; B (up 3000, stream large into last row, +150 x30): steps=${b.steps}, glitches=${b.glitches}, worst=${b.worst}px [${b.list}]`,
	};
}

async function case11(d: CaseDeps): Promise<Result> {
	const o = await open(d, "c11-session", 20);
	const { page, host } = o;
	try {
		const sid = 1101;
		startLive(host, sid);
		await Bun.sleep(300);
		const w0 = await page.evaluate(() => globalThis.__bench.writeCount());
		await page.evaluate(() => {
			const el = document.querySelector<HTMLElement>(".tr-root")!;
			el.dispatchEvent(new Event("touchstart"));
			globalThis.__bench.set(-30);
			el.dispatchEvent(new Event("scroll"));
			el.dispatchEvent(new Event("touchend"));
		});
		await Bun.sleep(250);
		const stAfterRelease = await page.evaluate(() => document.querySelector<HTMLElement>(".tr-root")!.scrollTop);
		await page.evaluate(() => {
			globalThis.__bench.markTop();
			globalThis.__bench.start();
		});
		for (let i = 0; i < 30; i++) {
			host.broadcast({
				type: "delta",
				sid,
				block: 0,
				text: `Band sentence ${i} streaming along.\n\n`,
			});
			await Bun.sleep(33);
		}
		await Bun.sleep(300);
		const s = await page.evaluate(() => globalThis.__bench.stop());
		const st = await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			const rb = root.getBoundingClientRect();
			const items = root.querySelectorAll(".tr-item");
			let lastBottom = -Infinity;
			for (const it of items) lastBottom = Math.max(lastBottom, it.getBoundingClientRect().bottom);
			return {
				gap: -root.scrollTop,
				jump: !!document.querySelector(".tr-jump-bottom"),
				clipped: lastBottom - rb.bottom,
			};
		});
		const writes = (await page.evaluate(() => globalThis.__bench.writeCount())) - w0;
		const drift = maxAbs(excessSeries(s, s[0]));
		const pinned = st.gap <= 2;
		const pass = pinned ? st.clipped <= 2 : st.jump && Math.abs(drift) <= 2;
		return {
			pass,
			evidence: `after release scrollTop=${r1(stAfterRelease)}; after 30 deltas: gap=${r1(st.gap)}px, pinned=${pinned}, jump button=${st.jump}, tail below viewport by ${r1(st.clipped)}px, row drift=${r1(drift)}px, app writes=${writes}`,
		};
	} finally {
		await close(o);
	}
}

async function case12(d: CaseDeps): Promise<Result> {
	const o = await open(d, "c12-session", 30);
	const { page } = o;
	try {
		await touchScroll(page, -500);
		await Bun.sleep(400);
		const measure = async (act: () => Promise<void>) => {
			const t0 = await page.evaluate(() => globalThis.__bench.markTop());
			const h0 = await page.evaluate(() => document.querySelector<HTMLElement>(".tr-root")!.clientHeight);
			await act();
			await Bun.sleep(400);
			const t1 = await page.evaluate(() => globalThis.__bench.rowTop());
			const h1 = await page.evaluate(() => document.querySelector<HTMLElement>(".tr-root")!.clientHeight);
			return { shift: t1 - t0, dh: h1 - h0 };
		};
		const w0 = await page.evaluate(() => globalThis.__bench.writeCount());
		const shrink = await measure(() =>
			page.setViewport({
				width: 390,
				height: 364,
				isMobile: true,
				hasTouch: true,
				deviceScaleFactor: 1,
			}),
		);
		const grow = await measure(() =>
			page.setViewport({
				width: 390,
				height: 664,
				isMobile: true,
				hasTouch: true,
				deviceScaleFactor: 1,
			}),
		);
		const hasComposer = await page.$(".cmp-textarea");
		let comp = { shift: NaN, dh: NaN };
		if (hasComposer) {
			comp = await measure(async () => {
				await page.focus(".cmp-textarea");
				await page.keyboard.type("line 1");
				for (let i = 2; i <= 6; i++) {
					await page.keyboard.down("Shift");
					await page.keyboard.press("Enter");
					await page.keyboard.up("Shift");
					await page.keyboard.type(`line ${i}`);
				}
			});
		}
		const writes = (await page.evaluate(() => globalThis.__bench.writeCount())) - w0;
		// Bottom-anchored by design: the reading position follows the viewport bottom.
		const ok = (m: { shift: number; dh: number }) => Math.abs(m.shift - m.dh) <= 2;
		return {
			pass: ok(shrink) && ok(grow) && (!hasComposer || ok(comp)) && writes === 0,
			evidence: `664->364: row shift=${r1(shrink.shift)}px vs Δheight=${r1(shrink.dh)}px; 364->664: shift=${r1(grow.shift)}px vs Δheight=${r1(grow.dh)}px; composer 6 lines: shift=${r1(comp.shift)}px vs Δheight=${r1(comp.dh)}px; app writes=${writes}`,
		};
	} finally {
		await close(o);
	}
}

async function case13(d: CaseDeps): Promise<Result> {
	const o = await open(d, "c13-session", 40, true);
	const { page, host } = o;
	try {
		const sid = 1301;
		startLive(host, sid);
		startTool(host, sid, 1, "c13-tool");
		await Bun.sleep(300);
		await page.evaluate(() => {
			const el = document.querySelector<HTMLElement>(".tr-root")!;
			globalThis.__bench.set(el.scrollTop - 500);
			el.dispatchEvent(new Event("scroll"));
		});
		await Bun.sleep(300);
		const box = await page.evaluate(() => {
			const r = document.querySelector(".tr-root")!.getBoundingClientRect();
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		});
		await page.mouse.move(box.x, box.y);
		const w0 = await page.evaluate(() => {
			globalThis.__bench.markTop();
			globalThis.__bench.start();
			return globalThis.__bench.writeCount();
		});
		let streaming = true;
		const stream = (async () => {
			for (let i = 0; streaming; i++) {
				host.broadcast({
					type: "delta",
					sid,
					block: 0,
					text: `Desktop stream ${i}.\n\n`,
				});
				host.broadcast({
					type: "tool_output",
					toolCallId: "c13-tool",
					text: `desk out ${i}\n`,
				});
				await Bun.sleep(25);
			}
		})();
		for (let i = 0; i < 20; i++) {
			await page.mouse.wheel({ deltaY: -100 });
			await Bun.sleep(16);
		}
		const wDuring = (await page.evaluate(() => globalThis.__bench.writeCount())) - w0;
		await Bun.sleep(300);
		streaming = false;
		await stream;
		const s = await page.evaluate(() => globalThis.__bench.stop());
		const writes = await page.evaluate(() => globalThis.__bench.writeCount());
		const ex = excessSeries(s, s[0]);
		const frameJump = maxFrameJump(s);
		const userScrolled = s[s.length - 1].st - s[s.length - 1].app - (s[0].st - s[0].app);
		const appSum = s[s.length - 1].app - s[0].app;
		return {
			pass: wDuring === 0 && Math.abs(maxAbs(ex)) <= 2,
			evidence: `20 wheel -100 @16ms, stream running; user scroll=${r1(userScrolled)}px; app scrollTop writes during wheel=${wDuring} (total ${writes - w0}, Σdelta=${r1(appSum)}px); row excess max=${r1(maxAbs(ex))}px, final=${r1(ex[ex.length - 1])}px, largest frame jump=${r1(frameJump)}px over ${s.length} frames`,
		};
	} finally {
		await close(o);
	}
}

/** Pinned at the bottom, tap-expand the last tool card whose body is taller than the viewport. */
async function case14(d: CaseDeps): Promise<Result> {
	const history = d.buildHistory(30) as { id: string }[];
	let parentId = history[history.length - 1].id;
	const push = (message: Record<string, unknown>) => {
		const id = `c14-${history.length}`;
		history.push({ id, parentId, timestamp: new Date().toISOString(), type: "message", message } as never);
		parentId = id;
	};
	push({ role: "user", content: "Run the full suite.", timestamp: Date.now() });
	push({
		role: "assistant",
		content: [
			{ type: "text", text: "Running it." },
			{ type: "toolCall", id: "c14-call", name: "bash", arguments: { command: "bun test" } },
		],
		stopReason: "toolUse",
		timestamp: Date.now(),
	});
	push({
		role: "toolResult",
		toolCallId: "c14-call",
		toolName: "bash",
		content: [{ type: "text", text: Array.from({ length: 200 }, (_, l) => `suite line ${l}: ok`).join("\n") }],
		isError: false,
		timestamp: Date.now(),
	});
	push({ role: "assistant", content: [{ type: "text", text: "All green." }], timestamp: Date.now() });
	const o = await open({ ...d, buildHistory: () => history }, "c14-session", 0);
	const { page } = o;
	try {
		// Bash bodies cap output at 12 lines (~360px); a short phone viewport makes the body taller than it.
		await page.setViewport({ width: 390, height: 300, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
		await Bun.sleep(400);
		const before = await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			const heads = root.querySelectorAll<HTMLElement>(".tv-head[aria-expanded='false']");
			const h = heads[heads.length - 1];
			h?.setAttribute("data-bench-click", "1");
			return { st: root.scrollTop, found: !!h, w: globalThis.__bench.writeCount() };
		});
		if (!before.found) return { pass: false, evidence: "no collapsed tool header" };
		await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			root.dispatchEvent(new Event("touchstart"));
			root.dispatchEvent(new Event("touchend"));
			document.querySelector<HTMLElement>("[data-bench-click]")!.click();
		});
		await Bun.sleep(800);
		const after = await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".tr-root")!;
			const rb = root.getBoundingClientRect();
			const h = document.querySelector<HTMLElement>("[data-bench-click]")!;
			const card = h.closest(".tv-card")!.getBoundingClientRect();
			return {
				expanded: h.getAttribute("aria-expanded"),
				headOffset: h.getBoundingClientRect().top - rb.top,
				cardH: card.height,
				viewH: rb.height,
				st: root.scrollTop,
				jump: !!document.querySelector(".tr-jump-bottom"),
				w: globalThis.__bench.writeCount(),
			};
		});
		const inView = after.headOffset >= 0 && after.headOffset <= after.viewH - 20;
		return {
			pass: after.expanded === "true" && after.cardH > after.viewH && inView,
			evidence: `scrollTop ${r1(before.st)}->${r1(after.st)}; aria-expanded=${after.expanded}; card ${r1(after.cardH)}px vs viewport ${r1(after.viewH)}px; header top ${r1(after.headOffset)}px below viewport top; app writes=${after.w - before.w}`,
		};
	} finally {
		await close(o);
	}
}

export const defectCases: Record<number, { name: string; run(d: CaseDeps): Promise<Result> }> = {
	8: { name: "case8_stream_during_touch", run: case8 },
	9: { name: "case9_tap_expand", run: case9 },
	10: { name: "case10_scroll_down_unrendered", run: case10 },
	11: { name: "case11_band_repin", run: case11 },
	12: { name: "case12_viewport_resize", run: case12 },
	13: { name: "case13_desktop_wheel", run: case13 },
	14: { name: "case14_pinned_expand_reveal", run: case14 },
};
