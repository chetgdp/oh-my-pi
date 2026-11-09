/**
 * App background: the gate scene behind the app after the splash.
 *   live   the scene keeps running behind the app at the start-frame framing,
 *          hour from the World setting; paused while the tab is hidden or the
 *          window unfocused; 10 fps after 30 s without input; a frame-rate guard
 *          steps down to half the pixels, then 30 fps, then a still image.
 *          A lost GL context shows the placeholder until it is restored.
 *   still  one frame rendered (the splash's own context when it ran), encoded
 *          to WebP/JPEG, GL released; re-rendered every 15 min while visible
 *          (at once on return when older) and when the World hour changes.
 *   off    the theme colour.
 * The mode comes from the stored setting, `?bg=` and the device
 * (background-device.ts, background-mode.ts). Styles in background.css;
 * html[data-bg] carries the mode for them. onLight() reports the scene light
 * to the UI.
 */
import { browserDocument, browserWindow } from "../lib/dom";
import { readWorldSetting, subscribeWorldSetting, type WorldSetting, worldHour } from "../lib/world-setting";
import { effectiveBackground } from "./background-device";
import {
	type BackgroundMode,
	FrameGuard,
	type GuardLevel,
	LightThrottle,
	notifyAll,
	StillOrder,
	StillRefresh,
} from "./background-mode";
import {
	type BackgroundSetting,
	readBackgroundSetting,
	subscribeBackgroundSetting,
	writeBackgroundSetting,
} from "./background-setting";
import type { SplashCanvas } from "./gl";
import type { GateScene } from "./scene";
import { sceneModule } from "./chunks";
import { placeholderGradient, skyAt } from "./sky";
// Text, injected on first use: a CSS import would land in main.css, which every page loads up front.
import BACKGROUND_CSS from "./background.css" with { type: "text" };

/** No input for this long (ms) drops the live scene to {@link IDLE_INTERVAL_MS}. */
const IDLE_MS = 30_000;
const IDLE_INTERVAL_MS = 100;
const FPS30_INTERVAL_MS = 1000 / 30;
/** rAF timestamps land on vsync: accept a frame this early (ms) against a requested interval. */
const VSYNC_SLACK_MS = 4;
/** Guard "half": half the pixels. */
const HALF_SCALE = Math.SQRT1_2;
/** A visible still is rendered again this long after the last render (ms). */
const STILL_REFRESH_MS = 15 * 60_000;
const STILL_QUALITY = 0.85;
const INPUT_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"];
/** Side of the downscaled sample the luma comes from (px). */
const LUMA_SAMPLE = 4;

type Rgb3 = [number, number, number];

/** Scene light for the UI. */
export interface WorldLight {
	zenith: Rgb3;
	horizon: Rgb3;
	key: Rgb3;
	/** Key light direction in screen space (radians, y down). */
	keyDir: number;
	/** Scene brightness behind the UI, 0..1. */
	luma: number;
}

/** Background off: no scene, a mid neutral. */
const NEUTRAL_LIGHT: WorldLight = {
	zenith: [0.5, 0.5, 0.5],
	horizon: [0.5, 0.5, 0.5],
	key: [1, 1, 1],
	keyDir: -Math.PI / 2,
	luma: 0.5,
};

interface Sample2D {
	drawImage(src: unknown, x: number, y: number, w: number, h: number): void;
	getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
}

let sampler: Sample2D | null = null;
/**
 * Mean luma of `src` (a canvas right after its draw, in the same task, or a
 * decoded image) from a {@link LUMA_SAMPLE}^2 downscale: the GPU scales,
 * 16 pixels come back.
 */
function sampleLuma(src: unknown): number | null {
	if (!sampler) {
		const c = doc.createElement("canvas") as BgCanvas & { getContext(t: "2d", o: object): Sample2D | null };
		c.width = LUMA_SAMPLE;
		c.height = LUMA_SAMPLE;
		sampler = c.getContext("2d", { willReadFrequently: true });
		if (!sampler) return null;
	}
	try {
		sampler.drawImage(src, 0, 0, LUMA_SAMPLE, LUMA_SAMPLE);
		const d = sampler.getImageData(0, 0, LUMA_SAMPLE, LUMA_SAMPLE).data;
		let sum = 0;
		for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
		return sum / (255 * (d.length / 4));
	} catch {
		return null;
	}
}

function lightAt(hour: number, luma: number): WorldLight {
	const s = skyAt(hour, browserWindow.innerWidth, browserWindow.innerHeight);
	const rgb = (v: number[]): Rgb3 => [v[0], v[1], v[2]];
	return {
		zenith: rgb(s.ZC),
		horizon: rgb(s.HC),
		key: rgb(s.KC),
		keyDir: Math.atan2(s.KD[1], s.KD[0]),
		luma,
	};
}

interface BgCanvas extends SplashCanvas {
	toBlob(cb: (blob: Blob | null) => void, type: string, quality: number): void;
	toDataURL(type: string): string;
	remove(): void;
	style: { visibility: string };
	addEventListener(type: string, listener: (e: { preventDefault(): void }) => void): void;
	removeEventListener(type: string, listener: (e: { preventDefault(): void }) => void): void;
}

interface BgLayer {
	className: string;
	style: { backgroundImage: string };
	append(...nodes: unknown[]): void;
	remove(): void;
}

interface BgImage {
	src: string;
	decode(): Promise<void>;
}

interface BgDocument {
	hidden: boolean;
	hasFocus(): boolean;
	createElement(tag: string): unknown;
}

const doc = browserDocument as unknown as BgDocument;

let styled = false;
function injectStyle(): void {
	if (styled) return;
	styled = true;
	const style = doc.createElement("style") as { textContent: string };
	style.textContent = BACKGROUND_CSS;
	browserDocument.body.appendChild(style);
}

let stillType: string | null = null;
/** WebP where the canvas encodes it (not Safari), else JPEG; PNG would be several MB. */
function encodeType(): string {
	if (stillType) return stillType;
	const probe = doc.createElement("canvas") as BgCanvas;
	probe.width = 1;
	probe.height = 1;
	stillType = probe.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
	return stillType;
}

class AppBackground {
	#setting = readBackgroundSetting();
	#world: WorldSetting = readWorldSetting();
	#lightListeners = new Set<(l: WorldLight) => void>();
	#light: WorldLight | null = null;
	#throttle = new LightThrottle();
	#order = new StillOrder();
	/** A still render is in flight (until its image is decoded); #stillAgain re-runs it once done. */
	#stillBusy = false;
	#stillAgain = false;
	#refresh = new StillRefresh<Timer>(STILL_REFRESH_MS, () => this.#renderStill(null), {
		now: () => performance.now(),
		set: (cb, ms) => setTimeout(cb, ms),
		clear: h => clearTimeout(h),
	});
	#mode: BackgroundMode = "off";
	/** The frame-rate guard turned the live scene into a still. */
	#guardStill = false;
	/** The live scene's GL context is lost; nothing draws or samples until it is restored. */
	#lost = false;
	/** Bumped on every mode change; async work from an older generation drops its result. */
	#gen = 0;
	#layer: BgLayer | null = null;
	#scene: GateScene | null = null;
	#canvas: BgCanvas | null = null;
	#url: string | null = null;
	#raf = 0;
	/** One World-change redraw per animation frame (slider drags). */
	#worldRaf = 0;
	#timer: Timer | null = null;
	#guard = new FrameGuard();
	#lastDraw = 0;
	#lastWant = -1;
	#lastInput = performance.now();
	#started = false;

	/**
	 * Called once when the splash ends. `scene`/`canvas` are its GL scene and
	 * canvas when it ran WebGL; the background takes ownership of both.
	 */
	start(scene: GateScene | null, canvas: SplashCanvas | null): void {
		if (this.#started) {
			scene?.destroy();
			return;
		}
		this.#started = true;
		browserDocument.addEventListener("visibilitychange", this.#onVisibility);
		browserWindow.addEventListener("focus", this.#onFocus);
		browserWindow.addEventListener("blur", this.#onFocus);
		for (const t of INPUT_EVENTS) browserWindow.addEventListener(t, this.#onInput, { passive: true, capture: true });
		subscribeWorldSetting(this.#onWorld);
		subscribeBackgroundSetting(this.#onSetting);
		this.#apply(effectiveBackground(this.#setting).mode, scene, canvas as BgCanvas | null);
	}

	/**
	 * Scene light, now (when known) and after each change: at most every
	 * 2 s while the clock moves the hour, on every World hour change and with
	 * every new still image. Background off emits the neutral light once.
	 */
	onLight(cb: (l: WorldLight) => void): () => void {
		this.#lightListeners.add(cb);
		if (this.#light) cb(this.#light);
		return () => this.#lightListeners.delete(cb);
	}

	setSetting(s: BackgroundSetting): void {
		this.#setting = s;
		writeBackgroundSetting(s);
		this.#applySetting();
	}

	#onSetting = (): void => {
		const s = readBackgroundSetting();
		if (s === this.#setting) return;
		this.#setting = s;
		this.#applySetting();
	};

	#applySetting(): void {
		if (!this.#started) return;
		const mode = effectiveBackground(this.#setting).mode;
		// a guard-stepped still restarts live when Live/Auto is picked again
		if (mode !== this.#mode || this.#guardStill) this.#apply(mode, null, null);
	}

	#hour(): number {
		return worldHour(this.#world);
	}

	#isStill(): boolean {
		return this.#mode === "still" || this.#guardStill;
	}

	#syncRefresh(): void {
		this.#refresh.setActive(this.#started && this.#isStill() && !doc.hidden);
	}

	#emit(light: WorldLight): void {
		this.#light = light;
		// the pi-utils logger is Node-only; notifyAll isolates and rethrows subscriber errors
		notifyAll(this.#lightListeners, light);
	}

	/** After a live draw, in the same task: `force` on World changes, else throttled. */
	#emitLive(hour: number, force: boolean): void {
		if (this.#lost || !this.#canvas) return;
		if (!this.#throttle.take(performance.now(), hour, force)) return;
		const luma = sampleLuma(this.#canvas);
		if (luma !== null) this.#emit(lightAt(hour, luma));
	}

	#onWorld = (): void => {
		const next = readWorldSetting();
		const prev = this.#world;
		this.#world = next;
		if (next.mode === prev.mode && (next.mode === "auto" || (prev.mode === "fixed" && next.hour === prev.hour)))
			return;
		if (this.#isStill()) this.#renderStill(null);
		else if (this.#scene && !this.#lost) {
			// draw on the next frame even while paused, so the change shows at once; one per frame
			if (!this.#worldRaf) this.#worldRaf = requestAnimationFrame(this.#drawWorld);
		} else if (this.#layer) this.#layer.style.backgroundImage = placeholderGradient(this.#hour());
	};

	#drawWorld = (now: number): void => {
		this.#worldRaf = 0;
		const scene = this.#scene;
		if (!scene || this.#lost) return;
		const hour = this.#hour();
		scene.setHour(hour);
		scene.beyond(now);
		this.#lastDraw = now;
		this.#emitLive(hour, true);
	};

	#apply(mode: BackgroundMode, scene: GateScene | null, canvas: BgCanvas | null): void {
		const gen = ++this.#gen;
		this.#teardown();
		this.#mode = mode;
		this.#guardStill = false;
		this.#lost = false;
		this.#stillBusy = false;
		this.#stillAgain = false;
		this.#syncRefresh();
		if (mode === "off") {
			scene?.destroy();
			delete browserDocument.documentElement.dataset.bg;
			this.#layer?.remove();
			this.#layer = null;
			if (this.#light !== NEUTRAL_LIGHT) this.#emit(NEUTRAL_LIGHT);
			return;
		}
		browserDocument.documentElement.dataset.bg = mode;
		const layer = this.#ensureLayer();
		// placeholder until the scene or the still is ready; backgroundImage keeps the CSS size/position
		layer.style.backgroundImage = placeholderGradient(this.#hour());
		const handed = scene && canvas ? { scene, canvas } : null;
		if (!handed) scene?.destroy();
		if (mode === "still") {
			this.#renderStill(handed);
			return;
		}
		if (handed) {
			this.#run(handed.scene, handed.canvas);
			return;
		}
		void this.#loadScene(gen).then(r => {
			if (r) this.#run(r.scene, r.canvas);
		});
	}

	async #loadScene(gen: number): Promise<{ scene: GateScene; canvas: BgCanvas } | null> {
		const canvas = doc.createElement("canvas") as BgCanvas;
		try {
			const mod = await sceneModule.load();
			const scene = await mod.GateScene.load(canvas, this.#hour());
			if (gen === this.#gen) return { scene, canvas };
			scene.destroy();
		} catch {
			// No WebGL2 / float targets, or the chunk failed: plain colour.
			if (gen === this.#gen) this.#apply("off", null, null);
		}
		return null;
	}

	#run(scene: GateScene, canvas: BgCanvas): void {
		this.#scene = scene;
		this.#canvas = canvas;
		canvas.addEventListener("webglcontextlost", this.#onLost);
		canvas.addEventListener("webglcontextrestored", this.#onRestored);
		scene.setScale(1);
		this.#ensureLayer().append(canvas);
		// the splash canvas still shows its last dolly frame: draw the background frame in this task
		const hour = this.#hour();
		scene.setHour(hour);
		scene.beyond(performance.now());
		this.#emitLive(hour, true);
		this.#guard = new FrameGuard();
		this.#lastDraw = performance.now();
		this.#lastWant = -1;
		this.#schedule(0);
	}

	#onLost = (e: { preventDefault(): void }): void => {
		// preventDefault lets the browser restore the context
		e.preventDefault();
		this.#lost = true;
		this.#cancel();
		if (this.#canvas) this.#canvas.style.visibility = "hidden";
		if (this.#layer) this.#layer.style.backgroundImage = placeholderGradient(this.#hour());
	};

	#onRestored = (): void => {
		// the old scene's GL objects are gone: build a new one
		if (this.#lost && this.#mode === "live" && !this.#guardStill) this.#apply("live", null, null);
	};

	/**
	 * Render the still at the current hour: from `handed` (the splash or the
	 * live scene) or a newly loaded scene. One at a time until its image is
	 * decoded; requests meanwhile coalesce into one trailing render.
	 */
	#renderStill(handed: { scene: GateScene; canvas: BgCanvas } | null): void {
		if (this.#stillBusy) {
			this.#stillAgain = true;
			if (handed) {
				handed.scene.destroy();
				handed.canvas.remove();
			}
			return;
		}
		this.#stillBusy = true;
		this.#stillAgain = false;
		const gen = this.#gen;
		const job = async (): Promise<void> => {
			const r = handed ?? (await this.#loadScene(gen));
			if (r) await this.#capture(r.scene, r.canvas, gen);
		};
		void job().finally(() => {
			if (gen !== this.#gen) return;
			this.#stillBusy = false;
			this.#refresh.rendered();
			this.#syncRefresh();
			if (this.#stillAgain) this.#renderStill(null);
		});
	}

	/**
	 * Draw the start frame, sample its luma and snapshot it in the same task
	 * (no preserveDrawingBuffer), release GL. Resolves once the image is shown
	 * or dropped; the light is emitted with the image it describes.
	 */
	#capture(scene: GateScene, canvas: BgCanvas, gen: number): Promise<void> {
		const seq = this.#order.begin();
		const hour = this.#hour();
		scene.setHour(hour);
		scene.beyond(performance.now());
		const luma = sampleLuma(canvas);
		const { promise, resolve } = Promise.withResolvers<void>();
		canvas.toBlob(
			blob => {
				if (!blob || gen !== this.#gen) {
					resolve();
					return;
				}
				const url = URL.createObjectURL(blob);
				const img = doc.createElement("img") as BgImage;
				img.src = url;
				void img.decode().then(
					() => {
						if (gen !== this.#gen || !this.#layer || !this.#order.accept(seq)) URL.revokeObjectURL(url);
						else {
							this.#setUrl(url);
							this.#layer.style.backgroundImage = `url("${url}")`;
							this.#throttle.take(performance.now(), hour, true);
							this.#emit(lightAt(hour, luma ?? this.#light?.luma ?? NEUTRAL_LIGHT.luma));
						}
						resolve();
					},
					() => {
						URL.revokeObjectURL(url);
						resolve();
					},
				);
			},
			encodeType(),
			STILL_QUALITY,
		);
		scene.destroy();
		canvas.remove();
		return promise;
	}

	#setUrl(url: string | null): void {
		if (this.#url) URL.revokeObjectURL(this.#url);
		this.#url = url;
	}

	#ensureLayer(): BgLayer {
		if (this.#layer) return this.#layer;
		injectStyle();
		const layer = doc.createElement("div") as BgLayer;
		layer.className = "app-bg-layer";
		browserDocument.body.appendChild(layer);
		this.#layer = layer;
		return layer;
	}

	#teardown(): void {
		this.#cancel();
		this.#scene?.destroy();
		this.#scene = null;
		this.#dropCanvas();
		this.#setUrl(null);
		if (this.#layer) this.#layer.style.backgroundImage = "";
	}

	#dropCanvas(): void {
		const canvas = this.#canvas;
		if (!canvas) return;
		canvas.removeEventListener("webglcontextlost", this.#onLost);
		canvas.removeEventListener("webglcontextrestored", this.#onRestored);
		canvas.remove();
		this.#canvas = null;
	}

	#cancel(): void {
		cancelAnimationFrame(this.#raf);
		this.#raf = 0;
		cancelAnimationFrame(this.#worldRaf);
		this.#worldRaf = 0;
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
	}

	#schedule(delay: number): void {
		if (this.#raf || this.#timer) return;
		if (delay <= VSYNC_SLACK_MS) {
			this.#raf = requestAnimationFrame(this.#tick);
			return;
		}
		this.#timer = setTimeout(() => {
			this.#timer = null;
			this.#raf = requestAnimationFrame(this.#tick);
		}, delay - VSYNC_SLACK_MS);
	}

	#paused(): boolean {
		return doc.hidden || !doc.hasFocus();
	}

	#tick = (now: number): void => {
		this.#raf = 0;
		const scene = this.#scene;
		if (!scene || this.#lost || this.#paused()) return;
		const idle = now - this.#lastInput > IDLE_MS;
		const want = idle ? IDLE_INTERVAL_MS : this.#guard.level === "fps30" ? FPS30_INTERVAL_MS : 0;
		const since = now - this.#lastDraw;
		if (want > 0 && since < want - VSYNC_SLACK_MS) {
			this.#schedule(want - since);
			return;
		}
		// the first interval after a rate change spans both rates: restart the guard window
		if (want !== this.#lastWant) this.#guard.reset();
		else {
			const step = this.#guard.sample(since, want);
			if (step && this.#step(step, scene)) return;
		}
		this.#lastWant = want;
		const hour = this.#hour();
		scene.setHour(hour);
		scene.beyond(now);
		this.#emitLive(hour, false);
		this.#lastDraw = now;
		this.#schedule(want);
	};

	/** Apply a guard step; true when the live scene ended (still). */
	#step(level: GuardLevel, scene: GateScene): boolean {
		if (level === "half") scene.setScale(HALF_SCALE);
		if (level !== "still") return false;
		const canvas = this.#canvas;
		this.#cancel();
		this.#scene = null;
		if (canvas) {
			canvas.removeEventListener("webglcontextlost", this.#onLost);
			canvas.removeEventListener("webglcontextrestored", this.#onRestored);
		}
		this.#canvas = null;
		this.#guardStill = true;
		browserDocument.documentElement.dataset.bg = "still";
		if (canvas) this.#renderStill({ scene, canvas });
		else scene.destroy();
		return true;
	}

	#resume(): void {
		if (!this.#scene || this.#lost || this.#paused()) return;
		this.#guard.reset();
		this.#lastWant = -1;
		this.#schedule(0);
	}

	#onVisibility = (): void => {
		// a still older than the refresh period renders at once on return
		this.#syncRefresh();
		if (doc.hidden) this.#cancel();
		else this.#resume();
	};

	#onFocus = (): void => {
		if (this.#paused()) this.#cancel();
		else this.#resume();
	};

	#onInput = (): void => {
		const now = performance.now();
		const wasIdle = now - this.#lastInput > IDLE_MS;
		this.#lastInput = now;
		// leaving idle: draw at the full rate at once instead of after the idle interval
		if (wasIdle && this.#scene && this.#timer) {
			this.#cancel();
			this.#schedule(0);
		}
	};
}

export const appBackground = new AppBackground();
