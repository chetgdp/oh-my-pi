import ui400 from "@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff2";
import ui500 from "@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff2";
import ui600 from "@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-600-normal.woff2";
import ui700 from "@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff2";
import mono700 from "../styles/fonts/IosevkaTerm-Bold.woff2";
import mono400 from "../styles/fonts/IosevkaTerm-Regular.woff2";
import { browserDocument, browserWindow } from "./dom";

// Registered from JS, not a CSS @font-face: Bun's CSS bundler inlines url()
// fonts as base64 into the render-blocking stylesheet. An added FontFace stays
// unloaded until text needs it, so a weight nobody renders is never fetched,
// and clients with IosevkaTerm installed (first in --font-mono) skip the mono
// files.
const FACES: ReadonlyArray<readonly [family: string, url: string, weight: string]> = [
	["Atkinson Hyperlegible Next", ui400, "400"],
	["Atkinson Hyperlegible Next", ui500, "500"],
	["Atkinson Hyperlegible Next", ui600, "600"],
	["Atkinson Hyperlegible Next", ui700, "700"],
	["IosevkaTerm Web", mono400, "400"],
	["IosevkaTerm Web", mono700, "700"],
];

export function registerFonts(): void {
	const { FontFace } = browserWindow;
	for (const [family, url, weight] of FACES) {
		browserDocument.fonts.add(new FontFace(family, `url("${url}") format("woff2")`, { weight, display: "swap" }));
	}
}
