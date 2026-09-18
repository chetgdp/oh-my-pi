import {
  getConfig2
} from "./main.rtmrfd4t.js";
import {
  select_default
} from "./main.c4pgnk9s.js";
import {
  __name
} from "./main.y98k7yqz.js";

// ../../node_modules/mermaid/dist/chunks/mermaid.core/chunk-6AEJRKK7.mjs
var selectSvgElement = /* @__PURE__ */ __name((id) => {
  const { securityLevel } = getConfig2();
  let root = select_default("body");
  if (securityLevel === "sandbox") {
    const sandboxElement = select_default(`#i${id}`);
    const doc = sandboxElement.node()?.contentDocument ?? document;
    root = select_default(doc.body);
  }
  const svg = root.select(`#${id}`);
  return svg;
}, "selectSvgElement");

export { selectSvgElement };

//# debugId=F38263257C5E26B364756E2164756E21
