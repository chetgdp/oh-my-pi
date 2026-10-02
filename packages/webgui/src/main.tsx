import { createRoot } from "react-dom/client";
import { browserDocument, browserWindow } from "./lib/dom";
import { App } from "./App";
import { hydrateDrafts } from "./lib/drafts";

if (browserWindow.navigator.standalone === true || browserWindow.matchMedia("(display-mode: standalone)").matches) {
	browserDocument.documentElement.dataset.standalone = "true";
}

const root = browserDocument.getElementById("root");
if (!root) throw new Error("missing #root element");
createRoot(root).render(<App />);
void hydrateDrafts();
