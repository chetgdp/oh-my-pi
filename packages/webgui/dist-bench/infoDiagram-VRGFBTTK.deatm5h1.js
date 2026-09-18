import {
  selectSvgElement
} from "./main.zmn54ms5.js";
import {
  parse
} from "./main.nz5nt9rj.js";
import"./main.je2cn3m1.js";
import"./main.cjjpesek.js";
import"./main.qjyg1szy.js";
import"./main.98q7gyj4.js";
import"./main.798mktq2.js";
import"./main.1spcvk37.js";
import"./main.q92gd6dp.js";
import"./main.dd08nzv0.js";
import"./main.vyv6h1w6.js";
import"./main.x5ag4a7c.js";
import"./main.qrqegcbe.js";
import"./main.wvzerc7r.js";
import"./main.qzw9d8xs.js";
import"./main.k2y3ybxw.js";
import"./main.7w48b31b.js";
import"./main.7nqvneh8.js";
import {
  configureSvgSize
} from "./main.rtmrfd4t.js";
import {
  log
} from "./main.c4pgnk9s.js";
import {
  __name
} from "./main.y98k7yqz.js";
import"./main.5hz6q5qz.js";

// ../../node_modules/mermaid/dist/chunks/mermaid.core/infoDiagram-VRGFBTTK.mjs
var parser = {
  parse: /* @__PURE__ */ __name(async (input) => {
    const ast = await parse("info", input);
    log.debug(ast);
  }, "parse")
};
var DEFAULT_INFO_DB = {
  version: "12.0.0" + ""
};
var getVersion = /* @__PURE__ */ __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};
var draw = /* @__PURE__ */ __name((text, id, version) => {
  log.debug(`rendering info diagram
` + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = { draw };
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};

//# debugId=3FBE7BAE7C54642464756E2164756E21
