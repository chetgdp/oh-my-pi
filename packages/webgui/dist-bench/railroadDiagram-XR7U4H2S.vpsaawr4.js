import {
  db,
  getStyles,
  renderer
} from "./main.8tmw03ep.js";
import {
  populateCommonDb
} from "./main.p9r20ede.js";
import"./main.zmn54ms5.js";
import {
  MermaidParseError
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
import {
  createRailroadServices
} from "./main.wvzerc7r.js";
import"./main.qzw9d8xs.js";
import"./main.k2y3ybxw.js";
import"./main.7w48b31b.js";
import"./main.7nqvneh8.js";
import"./main.rtmrfd4t.js";
import {
  log
} from "./main.c4pgnk9s.js";
import {
  __name
} from "./main.y98k7yqz.js";
import"./main.5hz6q5qz.js";

// ../../node_modules/mermaid/dist/chunks/mermaid.core/railroadDiagram-XR7U4H2S.mjs
var langiumParser = createRailroadServices().Railroad.parser.LangiumParser;
var transformExpression = /* @__PURE__ */ __name((expr) => {
  switch (expr.$type) {
    case "RailroadTerminalExpr":
      return {
        type: "terminal",
        value: expr.value
      };
    case "RailroadNonTerminalExpr":
      return {
        type: "nonterminal",
        name: expr.name
      };
    case "RailroadSpecialExpr":
      return {
        type: "special",
        text: expr.text
      };
    case "RailroadSequenceExpr": {
      const elements = expr.elements.map(transformExpression);
      return elements.length === 1 ? elements[0] : { type: "sequence", elements };
    }
    case "RailroadChoiceExpr": {
      const alternatives = expr.alternatives.map(transformExpression);
      return alternatives.length === 1 ? alternatives[0] : { type: "choice", alternatives };
    }
    case "RailroadOptionalExpr":
      return {
        type: "optional",
        element: transformExpression(expr.element)
      };
    case "RailroadOneOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 1,
        max: Infinity
      };
    case "RailroadZeroOrMoreExpr":
      return {
        type: "repetition",
        element: transformExpression(expr.element),
        min: 0,
        max: Infinity
      };
    default:
      throw new Error(`Unsupported railroad expression: ${expr.$type}`);
  }
}, "transformExpression");
var transformRule = /* @__PURE__ */ __name((rule) => {
  return {
    name: rule.name,
    definition: transformExpression(rule.definition)
  };
}, "transformRule");
var populateDb = /* @__PURE__ */ __name((ast) => {
  populateCommonDb(ast, db);
  if (ast.title) {
    db.setTitle(ast.title);
  }
  ast.rules.map((rule) => db.addRule(transformRule(rule)));
}, "populateDb");
var parser = {
  parse: /* @__PURE__ */ __name((input) => {
    db.clear();
    log.debug("[Railroad Parser] Starting Langium parse");
    const result = langiumParser.parse(input);
    if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
      throw new MermaidParseError(result);
    }
    const ast = result.value;
    log.debug("[Railroad Parser] Parsed rules:", ast.rules.length);
    populateDb(ast);
    log.debug("[Railroad Parser] Parse complete");
  }, "parse"),
  parser: {
    yy: db
  }
};
var diagram = {
  parser,
  db,
  renderer,
  styles: getStyles
};
var railroadDiagram_default = diagram;
export {
  diagram,
  railroadDiagram_default as default
};

//# debugId=15E5EC2A448AA13864756E2164756E21
