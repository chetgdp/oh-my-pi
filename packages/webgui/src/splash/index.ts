/**
 * Cold-start gate splash. `startSplash()` runs from main.tsx before the first
 * render: it paints a plain sky gradient for the current hour at once, loads
 * the WebGL scene as a separate hashed chunk, and once the app signals ready
 * (src/lib/splash-signal) dollies through the gate into the app, then hands
 * the scene to the app background (./background) and removes itself. Without
 * WebGL2 + float render targets the SVG gate stands in; with
 * prefers-reduced-motion the SVG gate crossfades to the app instead.
 */
import { browserDocument, browserWindow } from "../lib/dom";
import { onAppReady } from "../lib/splash-signal";
import { backgroundModule, sceneModule } from "./chunks";
import type { AppStyle, GateScene } from "./scene";
import type { SplashCanvas } from "./gl";
import { readWorldSetting, worldHour } from "../lib/world-setting";
import { placeholderGradient, zenithColor } from "./sky";
import "./splash.css";

/** Pause on the start frame after the app is ready, then the dolly. */
const HOLD_MS = 200;
const DOLLY_MS = 400;
/** Reduced-motion crossfade; matches the transition in splash.css. */
const FADE_MS = 200;
/**
 * Longest the splash waits for the WebGL scene before playing the svg fallback. Cold compile is
 * ~0.4 s on Apple GPUs; Direct3D 11 (Windows) has taken 30+ s, which kept the app covered.
 */
const SCENE_WAIT_MS = 2000;

const ROCKS =
	"M8 56L10 53L12 52.4L14 49.5L16 48.5L17.5 45.8H26.5L28 49L29.5 51L31 56zM1 56L2.5 53.6L5 53L6 49.5L7.2 48.8L8.4 52L11 52.5L13.5 54L14 56zM27 56L28.5 54L30 53.6L31.4 54.2L32.6 53.2L34 56zM42 56L43.5 53.4L45.2 52.4L47 53L48.5 52.6L50 56z";
const GATE = "M14 16h36v8H40v32h-8V24h-6v22h-8V24h-4z";
const ICON = `<path fill="url(#splash-rockg)" d="${ROCKS}"/><path fill="#c8442e" d="${GATE}"/>`;
const DEFS =
	'<defs><filter id="splash-ripple" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.35" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter><linearGradient id="splash-rockg" x1="0" y1="46" x2="0" y2="56" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6b6f6c"/><stop offset=".12" stop-color="#5f665d"/><stop offset="1" stop-color="#2f3433"/></linearGradient></defs>';

interface SplashElement {
	className: string;
	innerHTML: string;
	style: { background: string };
	append(...nodes: unknown[]): void;
	remove(): void;
}

interface RootElement {
	style: AppStyle & { removeProperty(name: string): void };
}

interface HtmlElement {
	classList: { add(...t: string[]): void; remove(...t: string[]): void };
	style: { setProperty(name: string, value: string): void; removeProperty(name: string): void };
}

interface ThemeMeta {
	content: string;
}

type Mode = "loading" | "gl" | "svg" | "static";

/** CSS `cubic-bezier(.4, 0, .7, 1)`: y for x in 0..1 (Newton, then bisection). */
function dollyEase(x: number): number {
	const x1 = 0.4;
	const y1 = 0;
	const x2 = 0.7;
	const y2 = 1;
	const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
	const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3;
	let s = x;
	for (let i = 0; i < 8; i++) {
		const dx = 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s * s;
		if (Math.abs(dx) < 1e-6) break;
		s -= (bx(s) - x) / dx;
	}
	if (s < 0 || s > 1 || Math.abs(bx(s) - x) > 1e-4) {
		let lo = 0;
		let hi = 1;
		s = x;
		for (let i = 0; i < 30; i++) {
			if (bx(s) < x) lo = s;
			else hi = s;
			s = (lo + hi) / 2;
		}
	}
	return by(s);
}

class Splash {
	#html = browserDocument.documentElement as unknown as HtmlElement;
	#root: RootElement;
	#sky: SplashElement;
	#gate: SplashElement;
	#canvas: SplashCanvas;
	#hour = worldHour(readWorldSetting());
	#mode: Mode = "loading";
	#scene: GateScene | null = null;
	#ready = false;
	#playStart: number | null = null;
	#raf = 0;
	#done = false;
	#unsubscribe: () => void;
	/** theme-color metas and their original content; iOS standalone paints the status bar strip from them. */
	#themes: [ThemeMeta, string][] = [];

	constructor(root: RootElement) {
		this.#root = root;
		const create = (tag: string) => browserDocument.createElement(tag) as unknown as SplashElement;
		this.#sky = create("div");
		this.#sky.className = "splash-sky";
		this.#sky.style.background = placeholderGradient(this.#hour);
		this.#sky.innerHTML = `<div class="splash-scene"><svg class="splash-reflect" viewBox="0 0 64 64">${ICON}</svg></div>`;
		// A <canvas> element; the DOM lib is not in scope (src/lib/dom.ts).
		const canvas = browserDocument.createElement("canvas") as unknown as SplashCanvas;
		this.#canvas = canvas;
		this.#sky.append(canvas);
		this.#gate = create("div");
		this.#gate.innerHTML = `<svg class="splash-gate" viewBox="0 0 64 64" aria-hidden="true">${DEFS}${ICON}</svg>`;
		browserDocument.body.appendChild(this.#sky);
		browserDocument.body.appendChild(this.#gate);
		this.#html.classList.add("splash-run");
		// The DOM lib is not in scope (src/lib/dom.ts) and its Document type has no querySelectorAll.
		const doc = browserDocument as unknown as { querySelectorAll(s: string): Iterable<ThemeMeta> };
		const metas = doc.querySelectorAll('meta[name="theme-color"]');
		const zenith = zenithColor(this.#hour);
		for (const meta of metas) {
			this.#themes.push([meta, meta.content]);
			meta.content = zenith;
		}

		if (browserWindow.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			this.#setMode("static");
		} else {
			sceneModule
				.load()
				.then(mod => mod.GateScene.load(this.#canvas, this.#hour))
				.then(
					scene => {
						// too late for the splash (done, or the svg fallback already took over)
						if (this.#done || this.#mode !== "loading") {
							scene.destroy();
							return;
						}
						this.#scene = scene;
						scene.start(performance.now());
						this.#setMode("gl");
					},
					() => {
						if (!this.#done && this.#mode === "loading") this.#setMode("svg");
					},
				);
			setTimeout(() => {
				if (!this.#done && this.#mode === "loading") this.#setMode("svg");
			}, SCENE_WAIT_MS);
		}
		void backgroundModule.load().catch(() => {});
		this.#unsubscribe = onAppReady(() => {
			this.#ready = true;
			this.#maybePlay();
		});
	}

	#setMode(mode: Mode): void {
		this.#mode = mode;
		this.#html.classList.add(mode === "gl" ? "splash-gl" : mode === "svg" ? "splash-svg" : "splash-static");
		if (mode !== "static") this.#raf = requestAnimationFrame(this.#frame);
		this.#maybePlay();
	}

	#maybePlay(): void {
		if (!this.#ready || this.#mode === "loading" || this.#playStart !== null || this.#done) return;
		this.#playStart = performance.now();
		if (this.#mode === "static") {
			this.#html.classList.add("splash-fade");
			setTimeout(() => this.#finish(), FADE_MS);
		}
	}

	#frame = (now: number): void => {
		this.#raf = 0;
		if (this.#done) return;
		const elapsed = this.#playStart === null ? 0 : now - this.#playStart - HOLD_MS;
		const t = elapsed <= 0 ? 0 : elapsed >= DOLLY_MS ? 1 : dollyEase(elapsed / DOLLY_MS);
		if (this.#scene) this.#scene.frame(now, t, this.#root.style);
		else this.#html.style.setProperty("--splash-t", String(t));
		if (t >= 1) {
			this.#finish();
			return;
		}
		this.#raf = requestAnimationFrame(this.#frame);
	};

	#finish(): void {
		if (this.#done) return;
		this.#done = true;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#unsubscribe();
		this.#html.classList.remove("splash-run", "splash-gl", "splash-svg", "splash-static", "splash-fade");
		this.#html.style.removeProperty("--splash-t");
		const s = this.#root.style;
		for (const p of ["clip-path", "opacity", "transform", "filter", "--splash-veil"]) s.removeProperty(p);
		for (const [meta, content] of this.#themes) meta.content = content;
		// the background takes the scene (live: moves the canvas behind the app and draws in this task;
		// still: one frame to an image; off: destroys it). Its chunk was fetched during the splash; if it
		// is still on the way, the scene stays alive off-screen until it arrives.
		const scene = this.#scene;
		const canvas = scene ? this.#canvas : null;
		const bg = backgroundModule.value;
		if (bg) bg.appBackground.start(scene, canvas);
		else
			backgroundModule.load().then(
				m => m.appBackground.start(scene, canvas),
				() => scene?.destroy(),
			);
		this.#scene = null;
		this.#sky.remove();
		this.#gate.remove();
	}
}

let started = false;

/** Start the cold-start splash over #root; call once from main.tsx before rendering. */
export function startSplash(): void {
	if (started) return;
	const root = browserDocument.getElementById("root");
	if (!root) return;
	started = true;
	new Splash(root as unknown as RootElement);
}
