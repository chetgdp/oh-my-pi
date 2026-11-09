/**
 * `/shader`: the splash scene on its own, for looking at the shader. Uses the
 * shipped GateScene (load, start, frame) at the start frame with the water
 * running; overlay controls for the hour, the dolly position and the sim
 * clock, mirrored into `?hour=&t=`. No app reveal.
 */
import { browserDocument, browserWindow } from "../lib/dom";
import type { SplashCanvas } from "./gl";
import { GateScene } from "./scene";
import { localHour } from "./sky";

interface StyledElement {
	style: { cssText: string };
	innerHTML: string;
	textContent: string;
	append(...nodes: unknown[]): void;
	querySelector(selector: string): unknown;
}

interface InputElement {
	value: string;
	addEventListener(type: string, listener: () => void): void;
}

interface ButtonElement {
	textContent: string;
	addEventListener(type: string, listener: () => void): void;
}

const PANEL =
	"position:fixed;left:8px;bottom:8px;z-index:1;display:grid;grid-template-columns:auto 1fr auto;gap:6px 8px;align-items:center;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.55);color:#eee;font:12px system-ui,sans-serif;min-width:260px";

class ShaderViewer {
	#scene: GateScene;
	#hourInput: InputElement;
	#tInput: InputElement;
	#hourLabel: StyledElement;
	#tLabel: StyledElement;
	#play: ButtonElement;
	/** Fixed hour, or null to follow the clock. */
	#hour: number | null;
	#t: number;
	#playing = true;
	/** Sim clock (ms) as frame() sees it: advances only while playing. */
	#sim = performance.now();
	#last = performance.now();

	constructor(scene: GateScene, panel: StyledElement, hour: number | null, t: number) {
		this.#scene = scene;
		this.#hour = hour;
		this.#t = t;
		panel.innerHTML =
			'<span>hour</span><input data-k="hour" type="range" min="0" max="24" step="0.05"><span data-k="hl"></span>' +
			'<span>t</span><input data-k="t" type="range" min="0" max="1" step="0.005"><span data-k="tl"></span>' +
			'<button data-k="now" type="button">now</button><button data-k="play" type="button"></button><span></span>';
		const el = <T>(k: string) => panel.querySelector(`[data-k="${k}"]`) as T;
		this.#hourInput = el<InputElement>("hour");
		this.#tInput = el<InputElement>("t");
		this.#hourLabel = el<StyledElement>("hl");
		this.#tLabel = el<StyledElement>("tl");
		this.#play = el<ButtonElement>("play");
		this.#tInput.value = String(t);
		if (hour !== null) this.#hourInput.value = String(hour);
		this.#hourInput.addEventListener("input", () => {
			this.#hour = Number(this.#hourInput.value);
			this.#sync();
		});
		this.#tInput.addEventListener("input", () => {
			this.#t = Number(this.#tInput.value);
			this.#sync();
		});
		el<ButtonElement>("now").addEventListener("click", () => {
			this.#hour = null;
			this.#sync();
		});
		this.#play.addEventListener("click", () => {
			this.#playing = !this.#playing;
			this.#sync();
		});
		this.#sync();
		scene.setHour(this.#currentHour());
		scene.start(this.#sim);
		requestAnimationFrame(this.#frame);
	}

	#currentHour(): number {
		return this.#hour ?? localHour();
	}

	/** Labels and URL from the current values. */
	#sync(): void {
		const hour = this.#currentHour();
		if (this.#hour === null) this.#hourInput.value = String(hour);
		this.#hourLabel.textContent = this.#hour === null ? `${hour.toFixed(2)} (now)` : hour.toFixed(2);
		this.#tLabel.textContent = this.#t.toFixed(3);
		this.#play.textContent = this.#playing ? "pause" : "play";
		const q = new URLSearchParams();
		if (this.#hour !== null) q.set("hour", this.#hour.toFixed(2));
		if (this.#t > 0) q.set("t", this.#t.toFixed(3));
		const search = q.size > 0 ? `?${q}` : "";
		const { pathname, hash } = browserWindow.location;
		browserWindow.history.replaceState(browserWindow.history.state, "", `${pathname}${search}${hash}`);
	}

	#frame = (now: number): void => {
		if (this.#playing) this.#sim += now - this.#last;
		this.#last = now;
		if (this.#hour === null) this.#hourLabel.textContent = `${localHour().toFixed(2)} (now)`;
		this.#scene.setHour(this.#currentHour());
		this.#scene.frame(this.#sim, this.#t);
		requestAnimationFrame(this.#frame);
	};
}

/** Mount the viewer over the page body; called from main.tsx on `/shader`. */
export async function startViewer(): Promise<void> {
	const create = (tag: string) => browserDocument.createElement(tag) as unknown as StyledElement;
	// index.html's loading spinner sits in #root; the viewer replaces the page
	const root = browserDocument.getElementById("root") as unknown as StyledElement | null;
	if (root) root.innerHTML = "";
	const canvas = create("canvas");
	canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;display:block;background:#000";
	browserDocument.body.appendChild(canvas);
	const q = new URLSearchParams(browserWindow.location.search);
	const hourParam = q.get("hour");
	const hour =
		hourParam === null || hourParam.trim() === "" || Number.isNaN(Number(hourParam)) ? null : Number(hourParam);
	const t = Math.min(1, Math.max(0, Number(q.get("t") ?? 0) || 0));
	let scene: GateScene;
	try {
		scene = await GateScene.load(canvas as unknown as SplashCanvas, hour ?? localHour());
	} catch (err) {
		const msg = create("p");
		msg.style.cssText =
			"position:fixed;inset:0;margin:auto;height:1em;text-align:center;color:#eee;font:14px system-ui";
		msg.textContent = `The shader viewer needs WebGL2 with float render targets (${err instanceof Error ? err.message.split("\n")[0] : "unknown error"}).`;
		browserDocument.body.appendChild(msg);
		return;
	}
	const panel = create("div");
	panel.style.cssText = PANEL;
	browserDocument.body.appendChild(panel);
	new ShaderViewer(scene, panel, hour, t);
}
