import {
  __name
} from "./main.y98k7yqz.js";

// ../../node_modules/mermaid/dist/chunks/mermaid.core/chunk-J5ZVWO5B.mjs
var COLOR_THEMES = /* @__PURE__ */ new Set(["redux-color", "redux-dark-color"]);
var DEFAULT_COLOR_SLOTS = 12;
var MAX_COLOR_SLOTS = 64;
var hasPalette = /* @__PURE__ */ __name((palette) => Array.isArray(palette) && palette.length > 0, "hasPalette");
var isColorTheme = /* @__PURE__ */ __name((theme, palette) => theme != null && COLOR_THEMES.has(theme) && hasPalette(palette), "isColorTheme");
var SAFE_LOOK = /^[\w-]+$/;
var safeLook = /* @__PURE__ */ __name((look) => {
  const s = typeof look === "string" || typeof look === "number" ? String(look) : "";
  return SAFE_LOOK.test(s) ? s : "classic";
}, "safeLook");
var paletteSlotCount = /* @__PURE__ */ __name((palette) => hasPalette(palette) ? palette.length : 0, "paletteSlotCount");
var colorSlotCount = /* @__PURE__ */ __name((themeColorLimit, palette) => {
  if (hasPalette(palette)) {
    return paletteSlotCount(palette);
  }
  return typeof themeColorLimit === "number" && Number.isInteger(themeColorLimit) && themeColorLimit > 0 && themeColorLimit <= MAX_COLOR_SLOTS ? themeColorLimit : DEFAULT_COLOR_SLOTS;
}, "colorSlotCount");
var stampColorSlot = /* @__PURE__ */ __name((shapeSvg, colorIndex, theme, palette) => {
  if (colorIndex === undefined || !isColorTheme(theme, palette)) {
    return;
  }
  const slot = colorIndex % paletteSlotCount(palette);
  shapeSvg.attr("data-color-id", `color-${slot}`);
}, "stampColorSlot");

export { COLOR_THEMES, hasPalette, isColorTheme, safeLook, paletteSlotCount, colorSlotCount, stampColorSlot };

//# debugId=BDDB2DDAB3C541D164756E2164756E21
