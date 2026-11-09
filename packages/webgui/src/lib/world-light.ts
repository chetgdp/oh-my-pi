/**
 * Clear design (cheisms/clear-design.md), chosen in Settings (lib/ui-setting.ts): injects clear.css, marks <html> with
 * `ui-clear` and writes the scene light from `appBackground.onLight` as CSS variables
 * (`--world-zenith`, `--world-horizon`, `--world-key`, `--world-key-dir`, `--world-luma`).
 * One style write per update (the text of one <style> element); no React re-render.
 */
import type { WorldLight } from "../splash/background";
import { backgroundModule } from "../splash/chunks";
// Text, injected on first use: a CSS import would land in main.css, which every page loads up front.
import CLEAR_COMPOSER_CSS from "../styles/clear-composer.css" with { type: "text" };
import CLEAR_SCREENS_CSS from "../styles/clear-screens.css" with { type: "text" };
import CLEAR_SHELL_CSS from "../styles/clear-shell.css" with { type: "text" };
import CLEAR_TRANSCRIPT_CSS from "../styles/clear-transcript.css" with { type: "text" };
import CLEAR_CSS from "../styles/clear.css" with { type: "text" };
import { browserDocument, browserWindow } from "./dom";

type Rgb = readonly [number, number, number];

/** 0..1 colour (HDR values above 1 are scaled down, hue kept) → "r g b" in 0..255. */
function channels(c: Rgb): string {
	const scale = 255 / Math.max(1, c[0], c[1], c[2]);
	return c.map(v => Math.round(Math.min(255, Math.max(0, v * scale)))).join(" ");
}

/**
 * Ink (text colour) switches with hysteresis, so a scene hovering at the edge does not flicker; the
 * CSS fades the switch (0.15 s, only after the first write). Near the switch point neither ink
 * reaches AA on the bare scene; clear.css (--clear-mid) thickens the glass tint, the button fill
 * and the label backing inside that luma band instead (measured with `_bench.mjs bgshots`,
 * UI=clear, 5 to 23 h).
 */
const INK_DARK_ABOVE = 0.39;
const INK_LIGHT_BELOW = 0.33;

/** 1 = dark ink (bright scene), 0 = light ink; `prev` null on the first update. */
export function nextInk(prev: 0 | 1 | null, luma: number): 0 | 1 {
	if (prev === null) return luma > (INK_DARK_ABOVE + INK_LIGHT_BELOW) / 2 ? 1 : 0;
	if (luma > INK_DARK_ABOVE) return 1;
	if (luma < INK_LIGHT_BELOW) return 0;
	return prev;
}

/** The `:root` rule carrying one light update. */
export function worldLightCss(l: WorldLight, ink: 0 | 1): string {
	const luma = Math.min(1, Math.max(0, Number.isFinite(l.luma) ? l.luma : 0.2));
	const dir = Number.isFinite(l.keyDir) ? l.keyDir : -Math.PI / 2;
	return (
		`:root{--world-zenith:rgb(${channels(l.zenith)});--world-horizon:rgb(${channels(l.horizon)});` +
		`--world-key:rgb(${channels(l.key)});--world-key-dir:${dir.toFixed(3)};--world-luma:${luma.toFixed(3)};` +
		`--world-ink:${ink}}`
	);
}

interface ClearState {
	root: { classList: { toggle(token: string, force?: boolean): boolean } };
	base: { remove(): void };
	vars: { remove(): void };
	unsubscribe: (() => void) | null;
	stopped: boolean;
}

let state: ClearState | null = null;

/** Turns the clear UI on; no-op while it is on. */
export function startClear(): void {
	if (state) return;
	// read at call time: `browserDocument` is bound when lib/dom first loads, which may precede the DOM
	const doc = browserWindow.document as unknown as typeof browserDocument;
	const root = doc.documentElement;
	root.classList.toggle("ui-clear", true);
	const base = doc.createElement("style");
	base.textContent = [CLEAR_CSS, CLEAR_SHELL_CSS, CLEAR_TRANSCRIPT_CSS, CLEAR_COMPOSER_CSS, CLEAR_SCREENS_CSS].join(
		"\n",
	);
	const vars = doc.createElement("style");
	doc.body.appendChild(base);
	doc.body.appendChild(vars);
	const current: ClearState = { root, base, vars, unsubscribe: null, stopped: false };
	state = current;
	let ink: 0 | 1 | null = null;
	void backgroundModule.load().then(m => {
		// stopped before the chunk arrived
		if (current.stopped) return;
		current.unsubscribe = m.appBackground.onLight(l => {
			ink = nextInk(ink, l.luma);
			const css = worldLightCss(l, ink);
			// an unchanged light (Still, Off) costs no style recalc
			if (css === vars.textContent) return;
			const first = vars.textContent === "";
			vars.textContent = css;
			// colour transitions only from the next frame: the first ink is set, not faded in
			if (first)
				requestAnimationFrame(() => {
					if (!current.stopped) root.classList.toggle("clear-lit", true);
				});
		});
	});
}

/** Turns the clear UI off: back to the flat UI with no clear styles left in the page. */
export function stopClear(): void {
	if (!state) return;
	state.stopped = true;
	state.unsubscribe?.();
	state.base.remove();
	state.vars.remove();
	state.root.classList.toggle("ui-clear", false);
	state.root.classList.toggle("clear-lit", false);
	state = null;
}
