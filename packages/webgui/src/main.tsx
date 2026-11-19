import { createRoot } from "react-dom/client";
import { browserDocument, browserWindow } from "./lib/dom";
import { App } from "./App";
import { hydrateDrafts } from "./lib/drafts";
import { registerFonts } from "./lib/fonts";
import { LazyModule } from "./lib/lazy-module";
import { startSplash } from "./splash";
import { readUiSetting, subscribeUiSetting } from "./lib/ui-setting";
import { startThemeSync } from "./lib/theme-setting";
import { backgroundModule } from "./splash/chunks";

if (browserWindow.navigator.standalone === true || browserWindow.matchMedia("(display-mode: standalone)").matches) {
	browserDocument.documentElement.dataset.standalone = "true";
}

if (/^\/shader\/?$/.test(browserWindow.location.pathname)) {
	const bench = /[?&]bench=(compile|gpu)(&|$)/.exec(browserWindow.location.search)?.[1];
	if (bench) {
		// compile-time benches: WebGL programs and variants (compile-bench.ts), WebGPU port (gpu-bench.ts)
		// a black page told us nothing on Windows: put load and run failures on screen
		const fail = (err: unknown) => {
			browserDocument.body.textContent = `${bench} bench failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`;
			browserDocument.body.style.cssText =
				"color:#f88;background:#111;font:13px monospace;white-space:pre-wrap;margin:12px";
		};
		const start =
			bench === "gpu"
				? new LazyModule(() => import("./splash/gpu-bench")).load().then(m => m.startGpuBench())
				: new LazyModule(() => import("./splash/compile-bench")).load().then(m => m.startCompileBench());
		void start.catch(fail);
	} else {
		// shader viewer (src/splash/viewer.ts): the splash scene alone, no app
		void new LazyModule(() => import("./splash/viewer")).load().then(m => m.startViewer());
	}
} else {
	registerFonts();
	// Flat keeps the index.html spinner until React renders; only Clear has the gate splash and scene
	if (readUiSetting() === "clear") startSplash();
	const clearModule = new LazyModule(() => import("./lib/world-light"));
	const applyUi = (): void => {
		if (readUiSetting() === "clear") {
			// re-checked on arrival: Flat may have been picked while the chunk loaded
			void clearModule.load().then(m => readUiSetting() === "clear" && m.startClear());
		} else clearModule.value?.stopClear();
	};
	startThemeSync();
	applyUi();
	subscribeUiSetting(() => {
		applyUi();
		// a page that loaded in Flat had no splash to hand over a scene; the background loads its own.
		// After a splash it is already started and follows the setting itself.
		if (readUiSetting() === "clear") void backgroundModule.load().then(m => m.appBackground.start(null, null));
	});

	const root = browserDocument.getElementById("root");
	if (!root) throw new Error("missing #root element");
	createRoot(root).render(<App />);
	void hydrateDrafts();
}
