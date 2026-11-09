# Clear design

Status: transitional. Every screen styled; chosen in Settings, "Interface": Flat (the original UI, default: `index.html` spinner, no splash, no scene, opaque theme background) or Clear (gate splash, scene background, clear styles; see Rollout, Prototype). Origin: `~/nousbase/main/TECH/web3d.md` (the web as a 3D space, not a stack of 2D pages). First carrier: the webgui (`packages/webgui`), whose React UI now sits over the gate scene (`src/splash/`, background modes in `cheisms/gate-splash-screen.md`, "App background").

## Where this stands (user, 2026-11-06)

The current `?ui=clear` is a good start and a transitional phase, not the target. It re-skins the old UI, which was deliberately bog-standard flat React (the goal then was only to get the RPC protocol working). Its value: it puts every existing element on the scene, so the inventory of elements is visible. The process is dialectical: this stage has contradictions (below), and the next iterations change the design itself, so several of them stop being problems instead of being patched. The transcript in particular will get its own visualisation (user has ideas, not yet written down).

Next steps, in order:
1. Background scene: the splash zooms through the gate and stops 6 m past it, gate out of view; that frame is the app background (open water, one far rock ahead). The UI fades in as the camera crosses the gate; no flash, no cut (`gate-splash-screen.md`, "Continuous dolly"). Behind the gate for now: just water. Later maybe rocks, small islands, dolphins. Possible Frutiger Aero direction (glossy aqua, sky, water, dolphins), which would also pull the UI text elements toward that style. Undecided.
2. Layout: decide where text and UI elements go on top of that scene. Not designed yet; the current placement is inherited from the old flat layout.
3. Then refine what clear design means on top of the shader background (the hybrid: React over WebGL).

## Review of the transitional stage (2026-11-06)

User confirmed: leftover lavender (theme accent) in the UI, glass too dense and used everywhere ("we don't need so much glass everywhere").

Look:
- Lavender leftovers: the theme accent was not remapped everywhere (send button faded lavender; others remain).
- Glass is dense (tint 34 to 77%) and on nearly every element. Needed for contrast at dawn and dusk with the current layout; reads milky at noon.
- Session-page top bar is a frosted strip, not "no bar", because transcript text scrolls under the title. Session list has no bar.
- Control Center and panel overlay are dense glass, not see-through (see-through let the transcript show through; model titles 1.2 to 1.8).
- Secondary text equals the ink (every dimmer tone missed AA at dusk); hierarchy is size, weight and face only.
- On toggles are solid ink tiles, not the accent colour.

Readability:
- Thin margins: models "+ tag" 4.56 (390, 6.5 h), session row 4.74 (390, 19.5 h), transcript badge 4.76.
- `--world-luma` is the whole frame, not the area behind the UI, so the ink switch is approximate; the dusk band needs heavy glass partly because of this.

Unverified:
- Not shot: active alert strip, rename/confirm dialogs, full-screen diagram overlay.
- Nothing tested on iPhone/Safari (blur while scrolling, still capture and WebP, `:has()` needs iOS 15.4+).
- No frame cost measured for the full clear UI over Live (session list only: 0.62 ms/frame, same as the base UI).

Code:
- Info panel "Edit" button overridden with `!important` and an attribute selector (inline style); a class hook would remove it.

Outside clear design:
- Direct links to Usage and Models load empty (app bug).
- Mermaid lazy-load test fails occasionally in parallel runs; cause unknown.

Verification at this stage: `_clearshots.mjs` combined sweep, 14 views x 6 hours (6.5, 12.5, 19, 19.5, 20, 23) x 1440 Live / 390 Still x light/dark = 336 shots, 0 text runs below need; webgui tests 1100 pass; oxlint and oxfmt clean.

## Idea

The world is the interface's ground. The UI does not cover the world; it floats in it, clear, and takes its light from it. Panels are the exception, text is the rule.

## Principles

1. World first. The scene fills the window. No full-window scrim, no opaque page background. Only surfaces that carry dense content are solid or glass.
2. Text first (HUD). Most chrome is bare text and thin outlines on the scene, as in `~/Code/hockey3d` (`hokej/public/hud.js`). Text stays readable by a halo, not by a box.
3. Glass only where needed. Cards, popovers, menus and the composer get a clear material. Nothing else gets a surface.
4. Lit by the world. Tint, rim and shadow come from the scene's light (`skyAt()` in `src/splash/sky.ts`: zenith, horizon, sun/moon colour and direction). The UI changes with the hour as the scene does.
5. Calm motion. Short transitions (0.15 s, ease-out). Later: navigation as camera movement through the scene (the splash dolly is the first instance).
6. Accessible by construction. All text stays DOM: selectable, searchable, read by screen readers. No UI text drawn in the canvas.

## Type

- Fonts: Atkinson Hyperlegible Next (text), Atkinson Hyperlegible Mono (numbers, paths, ids); tabular numerals. Both already ship in the webgui.
- Body 13 px; small 11 to 12 px; labels 11 px / 600, uppercase, `letter-spacing: .06em`. Uppercase only for labels.
- Text colour follows the world, not a theme: light text when the scene behind is dark (night, dusk), dark text when it is bright (noon sky, bright water). Driven by `--world-luma` (see Light binding); dim tone is the same colour at 68%.

## Legibility

- No text, icon or surface shadows (user, 2026-11-09: the 8 px glow, then a 1 px contact shadow, then the card shadows, all rejected). `--clear-halo`, `--clear-icon-shadow` and `--clear-glass-shadow` are `none`; they stay as tokens because they also cancel the base UI's shadows. No label backings.
- No contrast target (user, 2026-11-09: experimental; WCAG AA dropped). Flat is the accessible fallback. Legibility is judged by eye at 6.5, 12.5, 19.5, 23 h.

## Materials

Glass pass 2026-11-09 (user: "It's not frost, it's proper glass"). Tokens `--clear-glass-*` in `src/styles/clear.css` (`html.ui-clear`); every clear stylesheet uses them, no local tints, no `backdrop-filter` anywhere. The `clear-` prefix is required: `tokens.css` owns `--glass-bg` for the background chrome, and its light-theme `:root:not([data-theme])` rule outranks `html.ui-clear` (first version collided: 72% lavender-white panels under the light colour scheme).

| Material | Use | Look |
|---|---|---|
| Bare | Headers, labels, status, nav, top bar, tool calls at rest | Text plus halo, no surface; tool calls get a hairline left rule |
| Outline | Buttons, toggles, chips | Transparent, `--clear-rim` or `--clear-glass-border`; on-state `--clear-accent` |
| Glass (`--clear-glass-bg`) | Cards, prose panels, user bubbles, composer field, expanded tool cards, settings sections | ~7% horizon fill plus a top sheen gradient, `--clear-glass-border`, key-lit top edge (`--clear-glass-border-lit`), no shadow, radius 12 px |
| Glass+ (`--clear-glass-bg-plus`) | Code, tool output, diffs, menus, pickers, sheets, Control Center, dialogs (anything over other text) | Same edge, 22% halo-colour fill |

Accent: `--clear-accent`, the key light (sun/moon colour) mixed toward the ink; `--accent`, `--accent-fg`, `--accent-muted` and every `--syn-*` are remapped globally under `html.ui-clear.ui-clear`, so no theme lavender survives. Syntax palette `--clear-syn-*`: cyan keywords, green strings, amber numbers, blue functions, grey comments.

Refraction stays deferred to a WebGL-drawn UI. Blur was dropped entirely (cost over Live measured 6.16 vs 1.83 ms/frame on 2026-11-05, and it read as frost).

## Theme

No separate light and dark themes. The glass is clear, so the world behind it sets the mood: bright glass at noon, dark glass at night, warm at dusk. Clear design means clear glass. The only adaptive part is contrast: text colour, rim strength and tint amount follow the scene's brightness behind the UI (`--world-luma`), so text reads at every hour. With the background Off (reduced motion, no WebGL), a fixed neutral world value stands in.

## Light binding

- `--world-luma` (0 to 1): brightness of the scene, sampled from the rendered frame as a 4x4 downscale of the whole frame (not only the UI band; a few pixels per update, not a full readback). Drives text colour, tint amount and rim strength.
- Every few seconds (not per frame) the scene's light writes CSS variables: `--world-zenith`, `--world-horizon`, `--world-key` (sun/moon colour), `--world-key-dir` (screen-space angle). One style update, no React re-render.
- Glass tint mixes toward `--world-horizon`; rim colour toward `--world-key`; shadows fall away from `--world-key-dir`.
- Still mode (phone): values from the captured frame's hour. Off mode: fixed neutral values.

## Layout

- HUD corners and edges with an 18 px gap (10 px on narrow screens); content cards float in the open water area, not across the gate.
- The gate keeps a clear zone: UI avoids the gate silhouette at the background framing where the layout allows.
- Sessions page (2026-11-06): one block per server, side by side in server-list order. Inside a block, sessions (300 px cards) fill a column down to the bottom of the screen, then continue in the next column, newspaper style. Done with a vertical writing mode on the wrapping flex list (multicol and column-wrap flex do not widen the box with each column); phones keep one stack. No page title and no top-bar title; Settings sits in the header button group with Servers, Resume and New. Shots: `SERVERS=3 VIEWS=sessions _clearshots.mjs`.

## Motion

- Transitions 0.15 s ease-out; hover only under `@media (hover: hover)`; nothing moves under `prefers-reduced-motion`.
- Later: opening a session moves the camera toward its card (requires cards placed in world space through the scene camera, as `scene.ts` already does for the gate opening).

## Performance rules

- Every new material is measured at 1440x900 and 390x844 before it ships (frame cost via `packages/webgui/research/splash/shots/_bench.mjs`).
- No per-frame JS writes to the DOM for styling.
- The phone keeps the still background; nothing in clear design may require the live scene.

## Rollout

1. Session list behind `?ui=clear`; current UI stays default. Done 2026-11-05 (see Prototype).
2. to 4. All other screens, still behind `?ui=clear` (user, 2026-11-06: stay on the flag). Done 2026-11-06, one stylesheet per area, all injected by `src/lib/world-light.ts`:
	- `clear-shell.css`: top bar (no bar; 20 px frosted fade band where the transcript scrolls under it), sidebar and inspector without slabs, alert/now strips, Control Center, panel overlay and dialogs as dense glass (94% Live, 74% + blur Still; see-through was tried and reverted because the transcript showed through, model titles 1.2 to 1.8).
	- `clear-transcript.css`: transparent container; theme tokens remapped on `.tr-root`/`.mmv-overlay` to switch with the ink; prose panels 80 to 90% glass over Live; code, diffs, thinking near-solid; diff line tints 20%.
	- `clear-composer.css`: floating glass field, no slab; pickers and plan/Ask/btw sheets 84 to 96% glass.
	- `clear-screens.css`: models, hub, todos, usage, settings, info; screen roots transparent, cards glass, status chips ink text with a hue outline.
	- Harness: `research/splash/shots/_clearshots.mjs` (real `createServer` plus in-file hosts; 14 views; per-text-run p5 contrast). Each slice measured 0 runs below target at 6.5, 12.5, 19, 20, 23 h, 1440 Live and 390 Still. Lowest: models "+ tag" 4.56, transcript badge 4.76.
	- Not shot: active alert strip, rename/confirm dialogs, full-screen diagram overlay. Known app bug outside clear design: direct links to Usage and Models load empty.
5. Interface setting (2026-11-09): the `?ui=clear` URL flag is gone. Settings, "Interface" section, Flat / Clear; stored in `localStorage` `webgui.ui` (absent = Flat), synced across tabs, applied live without reload. `src/lib/ui-setting.ts` (entry); `world-light.ts` gained `stopClear()`, which removes both style elements, the `ui-clear`/`clear-lit` classes and the light subscription. The clear chunk loads only once Clear is picked.
	- Flat is the pre-scene app: `main.tsx` runs `startSplash()` only under Clear, so a Flat load shows the `index.html` spinner until React renders; `appBackground` forces mode Off while Flat (no layer, no canvas, no `data-bg`). Switching to Clear in a page loaded as Flat calls `appBackground.start(null, null)`, which loads its own scene; switching back turns it Off. World and Background in Settings show only under Clear.
	- Harnesses (`_bench.mjs`, `_clearshots.mjs`, `_trshots.ts`) set `webgui.ui` before navigation and keep `?hour=`. Their "current UI over the scene" baselines (`_bench.mjs bg`, `bgshots` and `bgcost` without `UI=clear`) no longer reach a scene: Flat has none by design.
	- Tests: `test/settings-screen.test.tsx` (Interface hides World and Background in Flat), `test/clear-toggle.test.ts` (Clear, Flat, Clear again leaves one style set). Headless check against the watch server: Flat cold load has no splash, layer or canvas; switch to Clear brings up the live layer; back to Flat removes it; a Clear reload plays the splash.

## Open questions

- Refraction: deferred to the WebGL UI (greater web3d idea); CSS stays frosted.
- Manual override (user, 2026-11-05), implemented: no light/dark switch. A "World" setting picks the hour the scene shows: Auto (local clock) or a time-of-day slider (0 to 24 h, with Day 12.5 and Night 23 presets that set the slider). The UI follows the scene as always, so the slider is the theme control. `packages/webgui/src/lib/world-setting.ts` (`localStorage` `webgui.world`, `?hour=` override); scene light for the UI via `appBackground.onLight()` in `packages/webgui/src/splash/background.ts`.
- Settings area, implemented: Settings screen at `#/settings` (`#/settings/<session>` from a session), `packages/webgui/src/components/settings/SettingsScreen.tsx` (lazy) with World and Background mode (Auto/Live/Still/Off, moved from the removed `BackgroundTile`). The Control Center has a "Settings" tile that opens it (`components/shell/ControlCenter.tsx`); the sessions list top bar has a settings button (`components/shell/TopBar.tsx`).
- Spec location: here, or next to `web3d.md` in the notes.

## Prototype (2026-11-05, rollout step 1)

Session list only, behind `?ui=clear` (URL only, not persisted). Without it nothing changes: the entry only gains a guarded lazy import (+163 B raw, +80 B gzip, +139 B br); `BG=off` screenshots of the current UI at 1440 and 390, both themes, noon and night, match a build without the hook pixel for pixel except one 94-pixel spot that also differs between two runs of the same build.

- Files: `packages/webgui/src/lib/world-light.ts` (lazy chunk: injects `src/styles/clear.css` as text, sets `html.ui-clear`, subscribes `appBackground.onLight` and writes `--world-zenith/-horizon/-key/-key-dir/-luma/-ink` as the text of one `<style>` element, skipped when unchanged; no React re-render). No component changes: `clear.css` targets the existing session-list classes under `html.ui-clear`.
- Ink: a hard luma threshold flickers and a continuous mix gives mid-grey text with a mid-grey halo at mid luma (noon measured 0.575, dusk 0.465). So `--world-ink` is 0 or 1, switched in JS with hysteresis (dark ink above 0.39, light below 0.33; first value from the midpoint; thresholds kept after the fix pass), and CSS fades the colour (0.15 s). Dark ink already from mid luma: the whole-frame luma sits below the sky behind the list, and dark ink over light frost holds AA at dawn and dusk where light ink does not. `--clear-mid` (a ramp: 1 at luma 0.36, the ink switch point, falling linearly to 0 at 0.11 and 0.61) raises glass tint (Live 34% + 40% x mid, Still 52% + 25% x mid; raised 2026-11-06 because taller recap cards put text over brighter dusk sky), outline-button fill and label backing where neither ink has margin. Bare labels and the title get a feathered backing in the halo colour (55 to 75%); outline buttons a halo-colour fill (25 to 50%). Transitions apply only after the first light write (`html.clear-lit`), so no fade runs at load. Measured: dawn 6.5 and dusk 18.3 dark ink, noon dark, night light.
- Deviations from the spec values, all for contrast: dim tone equals the ink (2026-11-06: every dimmer value missed AA on the session-row meta line at 19 to 19.5 h; secondary text differs only by size, weight and the mono face) instead of 68% alpha, which let the scene through the glyphs; glass tint is the horizon colour pulled 65% toward the halo colour (white under dark ink, black under light ink) so the glass pushes the scene away from the ink; tint amount 34 to 74% over Live, 52 to 77% over Still (the phone list runs from the bright sky down over the dark water, where no single ink holds AA over 15% glass), both well past the spec's "very light" 8 to 15%. Badges and the Stop button became outlines.
- Blur: Still only (6 px). Over Live the cards get tint, rim and shadow, no blur.

Contrast (`_bench.mjs bgshots` with `UI=clear`; text-node rects, against a second shot with the glyph fill at 1% alpha so halo and glass stay; p5 = 5th-percentile pixel per text run, worst run reported; themes give identical numbers). Body = every text run except labels; label = bare labels and the 20 px/600 title. Sweep 5 to 23 h.

| Hour | 1440 Live body p5 | 1440 label p5 | 390 Still body p5 | 390 label p5 |
|---|---|---|---|---|
| 5 | 14.12 | 19.21 | 13.42 | 18.38 |
| 5.5 | 13.50 | 18.87 | 7.40 | 18.00 |
| 6 | 9.50 | 17.70 | 9.77 | 17.37 |
| 6.5 | 7.79 | 13.03 | 7.01 | 13.18 |
| 7 | 9.47 | 13.86 | 6.37 | 13.73 |
| 8 | 9.19 | 13.48 | 7.86 | 14.82 |
| 9 | 9.02 | 13.19 | 7.82 | 14.12 |
| 12.5 | 8.58 | 12.60 | 7.50 | 13.11 |
| 16 | 8.58 | 12.66 | 7.48 | 13.22 |
| 17 | 8.69 | 12.58 | 7.46 | 13.11 |
| 17.5 | 8.85 | 12.75 | 7.45 | 13.27 |
| 18 | 9.09 | 12.98 | 6.36 | 13.32 |
| 18.3 | 7.94 | 12.54 | 6.23 | 12.74 |
| 19 | 4.66 | 17.09 | 4.82 | 16.93 |
| 19.5 | 5.39 | 17.43 | 4.87 | 14.86 |
| 20 | 8.76 | 17.74 | 6.32 | 4.84 |
| 21 | 13.59 | 18.67 | 14.91 | 15.08 |
| 23 | 15.76 | 19.46 | 15.79 | 19.11 |

All hours pass 4.5:1: body p5 >= 4.66, labels >= 4.84. The dusk margin is thin (4.66 to 4.87 at 19 to 20 h).

Frame cost (`_bench.mjs bgcost` with `UI=clear`, 1728x1117 @2x, N=3 medians, GPU-process main thread ms per presented frame; traced after the splash and the first light write):

| Variant | fps | GPU main ms/frame | ms/s |
|---|---|---|---|
| live, current UI | 60 | 0.62 | 37 |
| live, clear | 60 | 0.62 | 37 |
| live, clear with card blur forced | 60 | 1.56 | 93 |
| still, current UI | 0 | 1.43 | 0 |
| still, clear (blur) | 0 | 3.06 | 1 |
| off, current UI | 0 | 1.62 | 0 |
| off, clear | 0 | 2.68 | 1 |

Clear over Live costs the same as the current UI; card blur over Live adds about 0.9 ms/frame, so it stays off there. Still and Off are idle under both. The earlier +8 ms/s idle under clear was the one-off 0.15 s ink fade at load falling inside the trace window; that fade is gone (`clear-lit`). Absolute numbers differ from the previous run (live current 0.62 vs 1.12) for an unidentified reason; compare only within one run.

Screenshots: `/tmp/splash-bench/clear-after/bg/shot-clear-{1440,390}-dark-h*.png`, contrast per text run in `contrast.json` there. Harness additions: `bgshots` `UI=clear`, `BG=<mode>`, `HOURS=` (default clear hours include 5.5, 6, 19, 19.5, 20), `THEMES=`; `bgcost` `UI=clear`; `_pxdiff.mjs <dirA> <dirB>` for pixel comparisons.
