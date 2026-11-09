import { createRoot } from "react-dom/client";
import { browserDocument, browserWindow } from "./lib/dom";
import { App } from "./App";
import { hydrateDrafts } from "./lib/drafts";
import { registerFonts } from "./lib/fonts";
import { LazyModule } from "./lib/lazy-module";
import { startSplash } from "./splash";

if (browserWindow.navigator.standalone === true || browserWindow.matchMedia("(display-mode: standalone)").matches) {
	browserDocument.documentElement.dataset.standalone = "true";
}

if (/^\/shader\/?$/.test(browserWindow.location.pathname)) {
	if (/[?&]bench=compile(&|$)/.test(browserWindow.location.search)) {
		// compile-time bench (src/splash/compile-bench.ts): times every splash program and main-shader variants
		void new LazyModule(() => import("./splash/compile-bench")).load().then(m => m.startCompileBench());
	} else {
		// shader viewer (src/splash/viewer.ts): the splash scene alone, no app
		void new LazyModule(() => import("./splash/viewer")).load().then(m => m.startViewer());
	}
} else {
	registerFonts();
	startSplash();
	if (/[?&]ui=clear(&|$)/.test(browserWindow.location.search)) {
		void new LazyModule(() => import("./lib/world-light")).load().then(m => m.startClear());
	}

	const root = browserDocument.getElementById("root");
	if (!root) throw new Error("missing #root element");
	createRoot(root).render(<App />);
	void hydrateDrafts();
}
