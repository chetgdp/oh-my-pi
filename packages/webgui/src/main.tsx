import { createRoot } from "react-dom/client";
import { browserDocument } from "./lib/dom";
import { App } from "./App";
import "../../collab-web/src/styles/tokens.css";
import "../../collab-web/src/styles/base.css";

const root = browserDocument.getElementById("root");
if (!root) throw new Error("missing #root element");
createRoot(root).render(<App />);
