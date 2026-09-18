import {
  insertLookDefs
} from "./main.a0d2qkjp.js";
import {
  insertCluster
} from "./main.f14a3m6m.js";
import {
  insertEdge,
  insertEdgeLabel,
  markers_default,
  positionEdgeLabel
} from "./main.bbv1vxf8.js";
import {
  insertNode
} from "./main.nz9j4bh7.js";
import {
  labelHelper
} from "./main.355gmh91.js";
import {
  interpolateToCurve
} from "./main.e59dxsqf.js";
import {
  common_default,
  getConfig
} from "./main.rtmrfd4t.js";
import {
  log
} from "./main.c4pgnk9s.js";
import {
  __name
} from "./main.y98k7yqz.js";
import {
  __require
} from "./main.5hz6q5qz.js";

// ../../node_modules/mermaid/dist/chunks/mermaid.core/chunk-GNY47TPC.mjs
var internalHelpers = {
  common: common_default,
  getConfig,
  insertCluster,
  insertEdge,
  insertEdgeLabel,
  insertMarkers: markers_default,
  insertNode,
  interpolateToCurve,
  labelHelper,
  log,
  positionEdgeLabel
};
var ELK_ALGORITHMS = [
  "elk.stress",
  "elk.force",
  "elk.mrtree",
  "elk.sporeOverlap",
  "elk.box",
  "elk.rectpacking"
];
var layoutAlgorithms = /* @__PURE__ */ Object.create(null);
var registerLayoutLoaders = /* @__PURE__ */ __name((loaders) => {
  for (const loader of loaders) {
    layoutAlgorithms[loader.name] = loader;
  }
}, "registerLayoutLoaders");
var elkLayoutLoaders = /* @__PURE__ */ __name(() => {
  const loader = /* @__PURE__ */ __name(async () => await import("./elk-276RUBZZ.hx7t6yb7.js"), "loader");
  return [
    { name: "elk", loader, algorithm: "elk.layered" },
    ...ELK_ALGORITHMS.map((algorithm) => ({ name: algorithm, loader, algorithm }))
  ];
}, "elkLayoutLoaders");
var registerDefaultLayoutLoaders = /* @__PURE__ */ __name(() => {
  registerLayoutLoaders([
    {
      name: "dagre",
      loader: /* @__PURE__ */ __name(async () => await import("./dagre-6A5THRUB.amc2tedx.js"), "loader")
    },
    {
      name: "swimlane",
      loader: /* @__PURE__ */ __name(async () => await import("./swimlanes-2SLR337P.v7sxfjgd.js"), "loader")
    },
    ...[
      {
        name: "cose-bilkent",
        loader: /* @__PURE__ */ __name(async () => await import("./cose-bilkent-JH36ORCC.8fn6nvme.js"), "loader")
      },
      ...elkLayoutLoaders()
    ]
  ]);
}, "registerDefaultLayoutLoaders");
registerDefaultLayoutLoaders();
var render = /* @__PURE__ */ __name(async (data4Layout, svg) => {
  if (!Object.hasOwn(layoutAlgorithms, data4Layout.layoutAlgorithm)) {
    throw new Error(`Unknown layout algorithm: ${data4Layout.layoutAlgorithm}`);
  }
  if (data4Layout.diagramId) {
    for (const node of data4Layout.nodes) {
      const originalDomId = node.domId || node.id;
      node.domId = `${data4Layout.diagramId}-${originalDomId}`;
    }
  }
  const layoutDefinition = layoutAlgorithms[data4Layout.layoutAlgorithm];
  const layoutRenderer = await layoutDefinition.loader();
  insertLookDefs(svg, data4Layout.config);
  return layoutRenderer.render(data4Layout, svg, internalHelpers, {
    algorithm: layoutDefinition.algorithm
  });
}, "render");
var LAST_RESORT_LAYOUT = "dagre";
var getRegisteredLayoutAlgorithm = /* @__PURE__ */ __name((algorithm = "", { fallback = LAST_RESORT_LAYOUT } = {}) => {
  if (Object.hasOwn(layoutAlgorithms, algorithm)) {
    return algorithm;
  }
  for (const candidate of [fallback, LAST_RESORT_LAYOUT]) {
    if (Object.hasOwn(layoutAlgorithms, candidate)) {
      log.warn(`Layout algorithm ${algorithm} is not registered. Using ${candidate} as fallback.`);
      return candidate;
    }
  }
  throw new Error(`Neither layout algorithm ${algorithm}, ${fallback}, nor ${LAST_RESORT_LAYOUT} is registered.`);
}, "getRegisteredLayoutAlgorithm");

export { registerLayoutLoaders, render, getRegisteredLayoutAlgorithm };

//# debugId=85D54C2BE505BACB64756E2164756E21
