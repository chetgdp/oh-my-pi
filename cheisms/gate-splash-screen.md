# Gate splash screen

Status: prototype. Not wired into the webgui. Main working copy: `packages/webgui/research/splash/h-water-full-glass.html` (FFT water, all scene sliders, chosen 2026-11-05; user rates the shader as good). `h-rock-b-eroded.html` is the pre-FFT reference. The whole `packages/webgui/research/` folder is gitignored (`packages/webgui/.gitignore`), so the prototypes exist only on this machine; nothing is committed. Images live in `cheisms/gate-splash-assets/`. Screenshots from agent checks are in `packages/webgui/research/splash/shots/`.

Phone check: serve with `bun -e 'Bun.serve({hostname:"0.0.0.0",port:8083,fetch(r){const p=new URL(r.url).pathname;return new Response(Bun.file("packages/webgui/research/splash"+(p==="/"?"/h-water-full-glass.html":p)))}})'` and open `http://<mac LAN ip>:8083/?perf=1`. User loaded it on the iPhone 13 mini 2026-11-05: "works fine"; no frame log taken.

## Assets (`cheisms/gate-splash-assets/`)

| File | What |
|---|---|
| `rex-launch-1.png` .. `rex-launch-5.png` | Frames of the Rex app launch video (motion reference: logo becomes a cutout that grows until the app shows) |
| `composition-sketch.png` | User sketch: gate at centre, crossbar above the horizon, low rock under the left leg, small rock right below the horizon, tiny peak on the horizon far left. The lower-left dot is not a rock. |
| `gate-splash-reference.png` | Main reference (see below) |
| `gate-splash-reference-2.webp` | Second reference (see below) |
| `prototype-h-desktop-2026-11-05.png` | User screenshot of the prototype at the end of the session, showing the perspective problem |

## Goal

Cold-start splash for the webgui PWA. The π logo stands as a torii gate in a body of water(ocean); the camera zooms through the gate opening, which acts as a portal, and the app appears on the other side. Reference for the motion: the Rex app launch (logo turns into a cutout that grows until the app shows), shared 2026-11-05 as video frames of https://x.com/mitchellh/status/2113346052090925406. Has to be minimal in terms of kb and get cached on device.

## Pre-FFT prototype (`h-rock-b-eroded.html`)

Pure WebGL, no engine or library, one standalone HTML file, about 32 KB.

- Camera: pinhole camera 3.43 m above the water, horizon at 52% of the viewport height, gate 60 m ahead at the start. Scale: kasagi (15 m) at most 16% of the viewport width, or the 16 m gate height at most 10% of the height, whichever is smaller (`cam()`). The user asked twice for the gate to look further away; these are the values they accepted.
- Dolly: registered CSS property `--t` (0 to 1, 1300 ms after a 500 ms hold); JS maps it to camera distance `60 * (1 - 1.1 t)`, ending 6 m past the gate. `?t=` freezes a frame.
- Gate ("hybrid"): SDF raymarched inside its bounding box (<= 48 steps). Keeps the logo proportions: straight thick posts, uneven overhang (x -6..8.4 m, 0.4 m per icon unit), left leg shorter and standing on its rock, no lower beam. Black kasagi curving gently upward toward the tips (half the lift of variant j). Rounded bevels on every edge, SDF edge anti-aliasing in direct view and reflection.
- Lacquer: faded vermilion `LAC = (.82,.27,.15)`, broad weathering patches between deeper red and sun-bleached orange-pink, faint wood grain, fine wear only up close, black bases. Satin finish (gloss .22 red, .18 cap, .15 bases); the user found the earlier gloss (1.1) far too shiny.
- Rocks ("eroded"): SDF raymarched per rock bounding box (<= 40 steps): ellipsoid plus noise lumps (break the silhouette) and ridged fbm (pits, grooves). Dark basalt, wet black waterline band, algae low, salt-bleached tops, crevice occlusion. Rock under the left post plus two small rocks right, far back. The far-left horizon peak and the lower-left speck are removed.
- Haze: gate and rocks blend toward the horizon mist by distance. The horizon has no hard line.
- Reflection: mirrored about the water plane in 3D, broken into horizontal ripple slivers.
- App reveal: JS projects the opening (x +-1.2 m, water to 12.8 m) with the same camera each frame and sets the `.app` clip-path; the app appears once the camera passes the gate plane.
- Portal: membrane ripples, rim light, radial blur while crossing, flash, `#f4f2ee` veil. The ripple distortion is inset 1 m below the beam and 0.24 m from the posts, and displaced samples that land on the gate fall back to the undisturbed view; both were needed to stop the beam edge smearing into the opening as dark blobs.
- Time of day: `new Date()` per frame; `?hour=` and a slider override. Fixed sun times (rise 6:30, noon 12:30, set 18:30); no geolocation, user accepted that.
- Controls (prototype only): Play, Pause, Loop, Start frame, hour slider; `?slow=1` (5x slower), `?perf=1` (frame-interval log).
- Fallback when WebGL fails or `prefers-reduced-motion`: CSS gradient scene, svg gate (old flat logo), instant crossfade.

## Earlier variants (same folder)

| File | What | Outcome |
|---|---|---|
| `a-mask-reveal.html`, `b-squash-reveal.html`, `c-fade-mask.html` | First CSS attempts at the Rex reveal | Rejected: did not match the reference |
| `d-cutout-zoom.html` | Logo-shaped cutout zooming open | Worked; T shape leaves gaps; replaced by gate idea |
| `e-gate-zoom.html` | Zoom through the gate opening, black background | Accepted base for the motion |
| `f-gate-water.html` | CSS sky/water, svg reflection | Superseded by WebGL |
| `g-webgl-soft.html` | WebGL, soft noise water | Not chosen |
| `h-webgl-ripple.html` | WebGL, sine waves; camera dolly rewrite; backup of the pre-dolly version in `h-webgl-ripple.v1.html` | Base for the gate variants |
| `h-gate-i-pi.html` | Strict pi, SDF gate, lacquer | User liked keeping the logo shape |
| `h-gate-j-curved.html` | Pi with curved kasagi, shimaki, leaning posts | User liked the black curved top |
| `h-gate-k-torii.html` | Full Itsukushima torii with nuki | Too far from the logo |
| `h-gate-i2-pi.html` | Strict pi with fixes | Not chosen |
| `h-gate-l-hybrid.html` | Pi proportions plus gently curved black kasagi | Chosen gate |
| `h-rock-a-faceted.html`, `h-rock-c-coastal.html` | Granite plane-cut rocks; facets plus erosion and strata | Not chosen |
| `h-rock-b-eroded.html` | Eroded volcanic rocks on the hybrid gate | Current main file |

Serve locally: `bun -e 'Bun.serve({port:42111,fetch(r){return new Response(Bun.file("packages/webgui/research/splash"+new URL(r.url).pathname))}})'`.

## Decisions so far

- Pure WebGL, no three.js or other engine (cold-start weight). Paper Shaders and similar were considered and rejected.
- Zoom centres on the gate opening, not the logo bounding box.
- The opening is see-through: scene behind it, app only after crossing.
- Left leg stays shorter; it stands on a rock.
- Nothing in front of the gate (user sketch, 2026-11-05).
- Keep the sky, sun and moon as they are. The user rates the sun and moon as the best part.
- Gate keeps the logo proportions (pi must stay obvious); only the black kasagi curves up, for the torii read.
- Gate is painted wood: faded vermilion lacquer, faint grain, satin, not glossy.
- Rocks: eroded volcanic look (variant b).
- No far-left horizon peak.
- Agent checks run headless only; no browser windows on the user's screen.

## Main reference

`gate-splash-assets/gate-splash-reference.png` (452x678; Itsukushima-style torii in mist, saved 2026-11-05; the original Facebook CDN URL expires). Measured as fractions of the image:

| Feature | Position |
|---|---|
| Horizon (dissolves into mist, barely a line) | ~0.52 H |
| Leg bottoms (in the water) | ~0.565 H, just below the horizon |
| Crossbar (kasagi) | ~0.355 to 0.39 H, well above the horizon |
| Gate width (kasagi tips) | ~0.26 to 0.74 W, about half the frame |
| Reflection | from the leg bottoms down to ~0.95 H, broken into horizontal ripple slivers, longer and more broken than the gate |

The eye is close to the water: the horizon touches the lower legs. The user's composition sketch agrees: its crossbar sits above the horizon. The earlier reading of the sketch (horizon just under the crossbar) was wrong.

Second reference: `gate-splash-assets/gate-splash-reference-2.webp` (1000x1000; Itsukushima torii in clear weather, mountains and town behind; source https://static.wikia.nocookie.net/cards-the-universe-and-everything/images/a/a2/API_Torii_Gates.jpg, a WebP despite the `.jpg` name). The far shoreline is at ~0.71 H and the leg bottoms at ~0.75 H, again just below the horizon: the eye is near the water. The kasagi spans ~0.20 to 0.80 W. The post reflections run almost the full remaining height as solid vermilion columns broken by ripples.

## User feedback, 2026-11-05

- Perspective is wrong, provable against the reference: "too small, but too close", "gets too big too fast", "looks wonky", "lacks depth when it needs to have depth".
- Water: acceptable, could be better.
- Sky: fine. Sun and moon: very good, keep.
- Gate and rocks as 3D objects: could be much better, lower priority.
- Higher priority: placement and size of everything.
- The lower-left speck rock is unwanted (it came from a misread dot in the sketch).

## Diagnosis

- Too small but too close: under a pinhole camera, (base below horizon) / (object height) = (eye height) / (object height), independent of distance. The prototype has the base 45px below the horizon on a ~60px gate, so the eye sits at ~75% of gate height: a small object seen from high up reads as a toy placed nearby. The reference has the horizon at the leg bottoms, so the eye is near the water.
- Too big too fast: the zoom is a 2D scale about the opening centre. A real camera moving forward keeps the horizon fixed, the water streams underneath, the gate grows away from the horizon, and apparent size grows as 1/distance, so it is slow at first and fast only at the very end.
- No depth: the gate and rocks are flat silhouettes shaded to look round; they have no thickness, perspective or placement in the world.

## Fix plan (done 2026-11-05)

Steps 1 to 6 of the earlier plan are implemented: camera dolly, 3D gate, composition, 3D reflection, horizon mist, projected app cutout. Changes from the plan: the gate became a raymarched SDF (inside a bounding box) instead of analytic primitives, to allow rounded bevels and the curved kasagi; the gate is much smaller than "half the screen width" at the user's request; the far-left peak was removed instead of rescaled.

## Open issues

Known:
- Rock cost (after optimisation 2026-11-05, backup `h-rock-b-eroded.v1.html`): forced redraw at the portal warm-up frame is 2.3 ms vs hybrid 1.5 at 390x844 and 3.4 vs 4.8 at 1440x900 (headless, M5 Pro). Frames where the left rock fills the screen (camera ~4 m out) still cost 2 to 2.5x the hybrid; cheaper options there change the rock's look.
- Small far rocks are a few pixels wide at the start frame; detail does not show.
- Faint darker ring where the posts meet the beam; reflection of the beam underside reads grey-pink (water mixing).
- Brief grey frame (~40 ms) when the white veil fades into the dark app.
- App text shows faintly through the opening around t 0.7.
- svg fallback still shows the old flat gate and old rocks. User 2026-11-05: keep it for now.
- While the shaders compile, the CSS fallback (gradient sky plus the flat svg gate) shows, because `.gl` is set only after link (`h-water-full-glass.html:1085`, CSS lines 54-57). Seen on the iPhone. Proposed, not done: show a plain sky gradient for the current hour during compile, svg fallback only on WebGL failure or reduced motion; optional `KHR_parallel_shader_compile` and fade-in.
- FFT water cost: 23 render passes per frame, ~47 MB GPU memory at 390x844, needs WebGL2 float render targets, ~65 ms to first frame headless. iOS Safari tested only by eye.
- Crests taller than the 3.43 m eye put the lens inside the water, which renders black (no underwater pass). Only reachable with stormy slider values.

Unknown:
- Real frame cost on a phone (`?perf=1` on device; not yet logged). Headless frame intervals are capped at 16.7 ms by vsync or throttled to ~2 fps when hidden, so they do not measure GPU cost.
- iOS shader compile time (how long the fallback shows).

Decided (user 2026-11-05):
- Splash ships as a separate cached asset (hashed file from `src/`, immutable cache), not inlined.
- End trigger: the first `setLoading(false)` in `SessionsScreen` (`components/sessions/SessionsScreen.tsx:124-132`, `loadLive`). That fires once `pollServers` (`lib/servers.ts:136-141`, `Promise.allSettled` over every configured server's `listLive`) has settled: the live session list is shown, failed servers marked `down`. It is not a websocket connection and does not wait for transcripts. Timeout: no separate splash cap; `listLive` already aborts after 10 s (`REQUEST_TIMEOUT_MS`, `lib/sessions-api.ts:44`), so the splash ends within ~10 s even with an unreachable server (user: existing timeout is fine). Deep links (opening a session directly) still need a rule; default assumption: end on that session's `snap.connection === "ready"`.

- Gate and rocks: no more 3D work (user 2026-11-05: "its all fine").
- Order: integrate the splash into the webgui as it is now (`h-water-full-glass.html` with the current defaults), then optimise it heavily afterwards.

Open questions for the user:
- Compile-time placeholder: user unsure ("idk another loading screen lmao"). Default for integration unless told otherwise: plain sky gradient for the current hour from the same `KZ`/`KH` tables, svg fallback only on WebGL failure or reduced motion.

Shipped build: strip every dev tool (slider panels, Play/Pause/Loop/Start frame buttons, hour slider, `?perf`/`?slow`/`?frz`/`?t`/`?hour` hooks, Copy params). Lighter water for weak GPUs deferred to the optimisation pass.

## Integrated (2026-11-05)

- `src/splash/` (`index.ts` startSplash, `scene.ts` lazy chunk 18.3 KB gzip, `shaders.ts`, `sky.ts` placeholder gradient, `gl.ts`, `splash.css`); `main.tsx` calls `startSplash()`.
- `src/lib/splash-signal.ts`: one-shot `signalAppReady`/`onAppReady`. Fired by the page `SessionsScreen` after its first poll, and by `App.tsx` when a deep-linked session reaches `ready`, `reconnecting` or `incompatible`, so a failed connect does not leave the splash up. Tests: `test/splash-signal.test.tsx`.
- Timing: hold 200 ms, dolly 400 ms (user, 2026-11-05).
- Notch: `theme-color` metas swap to the zenith colour during the splash; `apple-mobile-web-app-status-bar-style` is `black-translucent` (without `viewport-fit=cover`), so the canvas fills the notch strip. User checked on the iPhone: works.
- `src/server/static.ts`: a missing `dist/index.html` or `dist` (rebuild swap, or a manual build racing `build.ts --watch`) serves the source loading spinner with a 1 s self-reload instead of a text 404.

## Integration findings (research 2026-11-05, nothing implemented)

- The webgui has no service worker or manifest. Hashed assets in `dist/` are already served `public, max-age=31536000, immutable` (`src/server/static.ts:118`); `index.html` is `no-cache` with ETag. A splash imported from `src/` gets a hashed name and is cached on device without new code. Inlining in `index.html` would re-send ~30 KB after every build.
- There is no "session list ready" event. `SessionsScreen` owns its `/api/live` poll and `loading` state (`SessionsScreen.tsx:96`, `:119-154`); ending the splash needs a new one-shot callback plus a hard timeout. Deep links to a session should end on `snap.connection === "ready"` instead.
- Cold start vs resume: resume from background does not re-run `main.tsx`, so a splash started there plays only on cold start. A relaunch after iOS evicts the page looks like a cold start; telling them apart needs a timestamp written on `pagehide` / `visibilitychange`.
- iOS: use `navigator.standalone` as well as `display-mode: standalone` (`main.tsx:7`); do not use `viewport-fit=cover` or `visualViewport` for sizing.

## Environment feedback (user, 2026-11-05; next session)

User words, condensed: the water is "too generic", though they kind of like it; "a lot of how the water looks depends upon the environment". The day/night cycle and its light are "great"; maybe performance can improve, but it does not look heavy. The main problem is the overall feeling: "everything looks too hazy and misty", "it looks like Morrowind", like "an old game where you have to turn the render distance down because of hardware limitations. But we don't have that": the scene is one gate, an ocean with nothing behind it, two rocks, a sun and a moon. The night stars "pulse at the same rhythm, most of them", which "looks really funny".

Known (from the code in `h-rock-b-eroded.html`):
- Star pulse: `sky()` twinkles each star with `sin(T * (2. + hs * 3.) + hs * 90.)`, but only cells with `hs > .985` show a star (`step(.985, hs)`). The rate `2 + 3 hs` is therefore 4.955 to 5.0 rad/s for every visible star: the same rhythm. Fix: derive rate and phase from an independent hash, not from the visibility hash, and vary the amplitude.
- Haze sources to revisit: distance haze on the gate and rocks (`haze()`), the sky's horizon mix toward `HC` (`hz * .35`), the water's fade to mist with distance, and the blend band above the horizon. Together they wash out contrast at every distance, not only at the horizon.

Direction (not yet agreed in detail):
- Haze: crisp, high-contrast scene with a clear long view. Keep only physically plausible aerial perspective at the far horizon, scaled by time of day (clear midday, some morning mist at most).
- Water: less generic. Its look should come from the environment: sky colour and gradient reflected by Fresnel, sun or moon path, deeper colour near the camera, ripples that read at the scene's scale. Keep what the user likes about the current water.
- Day/night cycle: keep as is. Performance review optional.
- Stars: independent twinkle rate, phase and amplitude per star; some steady stars.

## Environment pass (2026-11-05)

Backup before the pass: `h-rock-b-eroded.v4.html`.

- Stars: visibility, brightness, twinkle rate (0.5 to 4 rad/s), phase and depth come from separate hashes; about a third of stars are steady. Stars are no longer drawn in the water reflection.
- Haze: new uniform `MZ` (mist amount) from `skyAt()`: 0 at night, rises 5:36 to 6:24, fades 7:36 to 10:00, 0.25 peak at dusk (17:48 to 20:00). Gate/rock aerial perspective is ~1% at 60 m in clear air (was 15%); sky horizon mix is a thin band (3.5% of the height, 12%) in clear air and the old wide band only in mist; the blend band above the horizon and the water fade scale with `MZ`. Ambient on the gate/rocks leans toward the zenith colour and is 10% lower, for more contrast.
- Water: sky reflection uses a world-space ripple normal (4 octaves, 1 to 7 m wavelength) whose octaves fade by the pixel footprint along and across the view, so ripples are visible near the camera and flatten toward the horizon without moire. Schlick Fresnel on that normal: deep teal body colour (lit by the sky luminance, warmed by the low sun) looking down, sky mirror at grazing angles. Gate/rock reflections, slivers and the sun/moon glitter use the old normals unchanged.
- Cost (forced redraw: `glWarm()` + `readPixels`, warm-up plus start frame, median of 61, five alternating runs, headless Chrome Metal, M5 Pro): v4 5.5 ms vs new 5.6 at 390x844 (dpr 3, capped at 1.5 MP); v4 4.2 vs new 4.3 at 1440x900. Run-to-run noise is about 40%; no regression measurable.
- Screenshots: `shots/env-{390,1440}-h{6.5,8,12.5,18.3,23}.png`, `env-*-h23b.png` (0.5 s later), `env-*-h12.5-t0.5.png`; baseline `shots/env-before-*`. Harness: `shots/_shot.mjs` (puppeteer-core).

Remaining:
- The noon sky keyframes themselves are pale (zenith 0.74/0.80/0.86, horizon near white), so the midday sky still reads hazy even with the haze terms gone. Changing them was out of scope; a deeper blue noon zenith would help most.
- At dawn the water near the camera is dark (low Fresnel looking down, dim sky).
- Mid-field ripple bands are fairly regular.

Follow-up (same day, backup `h-rock-b-eroded.v5.html`):
- Gate reflection: object reflections keep a reflectance floor of 0.82 over the deep water (sky reflection keeps plain Fresnel), less desaturation (0.08 to 0.28, was 0.25 to 0.65), darkening 0.88 (was 0.82), ripple slivers at 0.5 strength (was 0.8). Posts now reflect vermilion at all tested hours.
- Lacquer albedo `LAC` 0.82/0.27/0.15 to 0.88/0.23/0.10, so the direct gate reads vermilion.
- Cost unchanged (constants only; noise range 3 to 6 ms on both builds).
- Sky variants, same shader, only the daytime rows (el 0.4 and 1) of `KZ`/`KH` changed:
  - `h-sky-deep.html`: zenith 0.30/0.48/0.74 and 0.16/0.38/0.74, horizon 0.74/0.80/0.84 and 0.60/0.74/0.88.
  - `h-sky-light.html`: zenith 0.45/0.60/0.80 and 0.36/0.58/0.86, horizon 0.82/0.84/0.86 and 0.72/0.82/0.92.
- Shots: `shots/sky-{base,deep,light}-{390,1440}-h{8,12.5,16}.png` and `shots/sky-*-1440-h{6.5,18.3}.png`.
- User chose the light sky (2026-11-05). `h-sky-light.html` copied over the main file; the previous main (gate fix, old sky) is `h-rock-b-eroded.v6.html`.

## Next

- Later, not now (user 2026-11-05): randomised sea state per launch, or sea state from local weather. Needs a wave cap or camera handling first: crests above the 3.43 m eye put the lens inside the water, which renders black (no underwater pass). Current choice: keep it calm.
- Rock fixes done (cost, halo, reflection rim; backups `h-rock-b-eroded.v1/v2/v3.html`). The rock-over-post edge was reported as stair-stepped by an agent; the user checked it up close and it looks fine, so it is not an issue. Remaining minor: rock reflection edges against the sky and over the post have no anti-aliasing ramp.
- Gate reflection: user tuned defaults to object floor 0.5 and ripple distortion 0.1 (2026-11-05); earlier "dark brown-red at noon" note is likely stale, recheck.
- Phone `?perf=1` run on device.
- Then integrate into the webgui as the cold-start splash: end on first session list, cap with a timeout, skip on PWA resume, keep the reduced-motion path. Settle the open integration choices (asset vs inline, end trigger, timeout) with the user first.

## Water variants (2026-11-05)

Main working copy from now on: `h-water-full-glass.html` (FFT water plus all scene sliders; sliders reproduce the calm and moderate sea states). `h-rock-b-eroded.html` is the pre-FFT reference. `h-water-full.html`, `h-water-full.v1.html`, `h-water-full-calm.html` and `h-water-hybrid.html` moved to `old/`.

### Hybrid

File `h-water-hybrid.html` (copy of the main file; only the water changed). One fragment shader pass, one draw call per frame, no library. Approach: cheap analytic versions of Ultra-Water's ideas, credited in a shader comment (MIT).
- Waves: 13 sine layers, 40 m down to 0.4 m (ratio 0.68, wavelength jitter 10%), deep-water dispersion, golden-angle directions inside a wind spread that widens for short waves, slope 0.065 per layer, and one slow value noise modulating total slope (wave groups). Each layer fades between 6 and 2.5 px of footprint (along and across the view); the faded slope variance goes into a roughness term (LEAN / Cox-Munk idea) plus a capillary floor. No regular ripple bands or moire in the shots; the old fixed `waves()`/`wnrm()` are gone.
- Shading: Lagarde roughness-aware Fresnel; GGX sun and moon lobes from that roughness (sun path widens and softens with distance and at low sun); glints from 2 px hashed facets tilted by the unresolved slope, re-rolled 6 times a second, limited to the GGX lobe; subsurface teal on crests facing away when the sun is ahead (off near the camera); rough far water mirrors a mix toward the horizon mist.
- Gate/rock reflections: traced along a normal from the long layers only (>= 8 m) at reduced tilt, so the posts and rocks stay readable and break on the swell; crest slivers from the crest height.
- Dawn/dusk: body colour lifted (more horizon light, a little sun warmth) and shaded by facet tilt toward the horizon, so near water is no longer black at 6:30 and 18:18.
- Size: 39,114 B raw, 16,033 B gzip -9 (main: 37,562 / 15,234; +0.8 KB gzip).
- First frame (navigation start to first `drawArrays` + `readPixels`, 390x844 dpr 3, median of 7, headless Chrome Metal, M5 Pro, desktop-class GPU): main 42.5 ms, hybrid 40.0 ms (same within noise; compile time unchanged in practice). Harness `shots/_ff.mjs`.
- Forced redraw (same method as above, but median of 121 per run, nine alternating runs, harness `shots/_perf.mjs`): 390x844 main 4.8 ms vs hybrid 5.3 (+10%); 1440x900 main 4.3 vs 4.4 (+2%). A 16-layer version measured about +18% at 390x844, so it was cut to 13 layers.
- Shots: `shots/water-hybrid-{390,1440}-h{6.5,8,12.5,18.3,23}.png`, `-h23b`, `-h12.5-t0.5`; main as `shots/water-base-*`.
- Issues: the reflection of the kasagi at the start frame breaks up more than in the main file (posts read clearly, the beam only in pieces); at `t=0.5` the mirrored post tops and kasagi underside read pale pink rather than vermilion (same in the main file, from `shade()`, not changed here). Near-water glints use 2 px cells and look blocky at dpr 1. Some faint diagonal streaking remains on the sky-mirror at mid distance (wave-direction beats, not aliasing).

### Full

File `h-water-full.html` (copy of the main file, sky/gate/rocks/portal/controls unchanged; no library, raw WebGL2; Ultra-Water MIT notice in the script). Harness `shots/_water-full.mjs` (`shots`, `perf`, `first` modes).
- Approach: their `OceanSim.js` ported nearly verbatim to raw WebGL2: Tessendorf FFT, 4 cascades 600/85/12/2.1 m at 256² in one 256x1024 atlas, JONSWAP wind sea + swell with their directional spreading, gravity-capillary dispersion, capillary fade, Stockham IFFT (fp16 ping-pong, fp32 h0), assemble into per-cascade displacement (with Jacobian) and slope (sx, sz, sx², sz²) textures, mipmapped + anisotropic (LEAN slope variance). Their camera-centred polar grid (rings growing by the angular step, band-limited displacement LOD, skirt to 60 km), cut to the +-80 degree sector the fixed camera sees, renders a G-buffer (slope, roughness alpha², ray distance; foam, height) with depth. The main fragment shader reads it: water distance replaces the flat-plane hit (crests occlude rock bases and lift the horizon), then their shading in `bgd()`: Cox-Munk unresolved roughness, wind slicks, Kaplanyan geometric specular AA, Lagarde roughness-aware Fresnel, GGX sun and moon, Poisson glints, in-scatter body + Atlas-style crest SSS, Jacobian foam (procedural pattern), our haze. Sky reflection samples our `sky()` in the reflected direction.
- Sea state: 4.5 m/s wind over 25 km (Hs about 0.46 m, 13.5 m peak) plus a low swell (Hs about 0.37 m, 170 m) at 0.015 scale. Their defaults (9 m/s, 120 km, swell 0.7) give Hs about 4.5 m; their fetch formula has no full-development cap, so fetch sets the height.
- Gate/rock reflection: our analytic mirrored raymarch from the displaced surface point along a flattened normal (tilt x 0.02 H/F, matching their planar-reflection screen offset of 0.04). Deviation: its Fresnel uses that flattened normal without the roughness F90 cut; with their Fresnel the crest backs facing the camera (F < 0.1) and the rough mid-field erased the gate. Posts and kasagi now read vermilion, broken by the waves, at all tested hours; weaker at `t=0.5` noon.
- Dropped: shore breakers, swash, shore/travel/surf maps, cascade damping by depth, impact ripples, caustics, underwater/Snell window, refraction and absorption (open ocean, no visible bottom: body = in-scatter + SSS), floaters and their shadows, shadow map, terrain/island, Hillaire sky and sky cube (our `sky()` instead, no roughness-blurred LOD), planar reflection pass and its roughness mip blur (analytic trace instead, sharp), foam texture (procedural noise), foam hysteresis (instant Jacobian; no ping-pong output targets), coarse high-camera grid, PostFX. Foam never triggers at this sea state.
- Size: 56,718 B raw, 22,615 B gzip -9 (main 37,562 / 15,234; +7.4 KB gzip). Nothing vendored.
- First frame (navigation start to the 2nd default-framebuffer draw finished = warm-up + start frame, `readPixels` after each, median of 7, two alternating runs, headless Chrome Metal, M5 Pro, desktop-class GPU; Chrome's program cache is warm after the first load, the cold first load is the highest value): 390x844 main 39.7/42.5 ms vs full 65.3/63.6 ms (cold 72); 1440x900 main 39.5/39.5 vs 58.4/60.2. About +20 to +25 ms: six programs to compile and link, the 113k-vertex grid and 2.6 MB index buffer, one-off spectrum pass.
- Forced redraw (same method as above: `glWarm()` + `readPixels`, median of 61, five alternating runs; `glWarm` draws two full frames, so each includes two sims): 390x844 main 5.9 ms vs full 6.0 (per-run 4.2 to 6.3 vs 5.9 to 8.6); 1440x900 main 3.5 vs full 7.2 (3.0 to 4.7 vs 5.2 to 9.2). The raymarch moved from the main pass into the same per-pixel cost, so the extra is the sim + grid: about 2 ms per frame here; on the A15 expect it to be relatively larger (16 IFFT passes over 256x1024 fp16 MRT are bandwidth-bound, 224k triangles each sampling 7 textures).
- Per frame: 23 draw calls in 23 render-target passes (1 evolve, 16 IFFT stages, 4 assemble, 1 ocean grid `drawElements` 223,880 triangles, 1 main fullscreen) plus 8 `generateMipmap`. GPU memory about 47 MB at 390x844 (G-buffer 2x RGBA16F + depth at canvas size about 26 MB, sim 18 MB, grid 3.5 MB). Needs WebGL2 + `EXT_color_buffer_float` (iOS 15+); without it the CSS fallback shows.
- Shots: `shots/water-full-{390,1440}-h{6.5,12.5,18.3,23}.png`, `-h12.5-t0.5`; main as `shots/water-base-*`.
- Issues (v1, now `h-water-full.v1.html`, shots `water-full-*`): reads as open ocean but not serene. A 4.5 m/s sea has a Cox-Munk slope variance around 0.03, so from 3.43 m the mid-field shows dark crest backs, glints are large blobs, and the far water stays darker than the main file.
- v2 (user feedback: calmer, brighter, tropical): wind 2 m/s over 6 km (0.1 m ripples, 3 m peak), swell scale 0.003 (0.24 m, 170 m long); body turquoise (0.10, 0.55, 0.60) times the sky luminance, from 0.6x at low sun to 1.05x at full sun, plus a dark-blue night floor; crest SSS tinted turquoise (0.05, 0.40, 0.42); sun 1.0, moon 1.0; Lagarde F90 cut at 30% so the far field mirrors the sky; gate reflection tilt 0.014 H/F and an object reflectance floor of 0.78 (main file uses 0.82), giving clear vermilion columns broken by ripples; Poisson glints at 95% strength from the camera on (theirs: 60% from 4 to 30 m), so the sun lobe breaks into sparkles. Size 57,141 / 22,800 B gzip. Redraw is the same as v1 within noise (3 alternating runs, 390x844: v1 8.7/8.1/6.4 vs v2 6.6/8.0/7.1 ms; 1440x900: 6.4/9.3/9.1 vs 5.3/8.7/5.9). Shots `shots/water-full2-{390,1440}-h{6.5,12.5,16,18.3,23}.png`, `-h12.5-t0.5`. Remaining: near-camera sparkles are blocky square cells at dpr 3; dawn water stays a deep teal under an orange sky; the mesh slides with the dolly (not checked on device).
- Super calm (`h-water-full-calm.html`, sea state only): wind 1 m/s over 3 km (0.04 m cat's-paw ripples, 1.2 m peak; their JONSWAP still behaves at this wind), swell scale 0.0004 (0.06 m, 170 m long, about 10 s). Near-mirror vermilion reflection with a gentle wobble; the sky mirrors in the far water; sparkles near the camera stay small. Shots `shots/water-calm-{390,1440}-h{12.5,16,18.3}.png`, `-h12.5-t0.5`.
- Glass (`h-water-full-glass.html`, from the calm file): the calm spectrum with every amplitude x0.2 (`waveScale` 0.04): 0.01 m cat's-paws (1 m/s, 3 km) plus a 0.02 m, 210 m long swell (8 m/s, 900 km, scale 0.0002); the Cox-Munk unresolved roughness is scaled by `waveScale` too. Near-perfect mirror of gate, rocks and sky with a faint shimmer; tight sun streak at dusk. Shots `shots/water-glass-{390,1440}-h{12.5,18.3}.png`, `-h12.5-t0.5`.
- Glint fix (all three full variants; glass backup `h-water-full-glass.v1.html`): world-space glint cells sized by the along-view footprint were stretched by the grazing view into horizontal slivers, and dense cells lit as whole rectangles. Now fixed 6 CSS px screen cells, one compact round dot (radius 1.2 device px, (1 - r²)² kernel) at a hashed spot per cell, Poisson twinkle kept, weight = cell area / dot area so the mean lobe brightness is unchanged, dense cells fade to the plain GGX lobe. Redraw unchanged (glass 390x844 6.6/6.8/7.0 vs v1 7.1/6.9/6.7 ms). Shots `shots/water-glint-{390,1440}-h{12.5,17.5,18.3}.png`.
- Parameter panels (`h-water-full-glass.html`; pre-panel backup `h-water-full-glass.v2.html`): two collapsible panels top left (closed by default; open on a phone they cover the gate), Copy params (copies the URL) and Reset. Every non-default value is mirrored into a URL param, and URL params load on start. `?frz=<s>` freezes time for deterministic shots. Kinds: S = rebuilds the H0 spectrum 100 ms after the last input (1 to 6 ms measured headless, including the JS swell-height integral; sim time keeps running); U = uniform or JS value read every frame (free); C = CSS variable (applies to the next Play).
	- Water: `wind` m/s (1, S), `wdir` deg (-105, S), `fetch` km (3, log, S), `scale` wave amplitude multiplier (0.04, log, S; also scales the Cox-Munk floor), `swh` swell Hs m (derived 0.0157, S; sets swellScale against a unit spectrum), `swl` swell peak wavelength m (derived 209.8, S; sets the swell wind), `sdir` deg (-80, S), `chop` horizontal displacement (0.85, U), `rough` Cox-Munk unresolved roughness x (1, U), `glint` (0.01, U), `trop` tropical lean (0.25, U), `depth` body brightness x (1, U), `sss` crest glow / clarity x (1, U).
	- Water colour from the sky (backup `h-water-full-glass.v4.html`): the fixed turquoise body and its picker are gone. Body = sky light (zenith/horizon mix x daylight, plus 0.2 x sun x sun height) through a water filter (0.22, 0.52, 0.62) that flattens toward (0.46, 0.42, 0.42) with twilight warmth (SP.w x 0.85), then `trop` mixes toward the old turquoise at the same luminance and `depth` scales it; dark-blue night floor kept; the far field still mirrors the sky via Fresnel. Result: clear blue sea with a slight teal lean at noon, dim slate with warm tones at dawn/dusk (no more teal under an orange sky), near-black blue at night. Redraw same within noise. Shots `shots/water-sky-{390,1440}-h{6.5,8,12.5,16,18.3,23}.png`.
	- Sun reflection (backup `h-water-full-glass.v5.html`; user reference `shots/user-bright-ref.png`, sun height matches about 16:45): for a mid/low sun (sunMid() from the sun's screen height: 0 at the horizon and at noon, 1 in between, same morning and afternoon) the GGX sun path is scaled by `sunref` (0.6, U) and passed through a soft shoulder s / (1 + s / 0.9), so it keeps ripple texture instead of clipping to a white band; the sky halo terms drop by up to 30% at the same times. Noon, dawn/dusk horizon sun and night unchanged. Shots `shots/water-bright-1440-h{8,9,10,15,16,16.75,17}.png`, `water-bright-390-h16.75.png`.
	- Time/light: `rise` 6.5, `noon` 12.5 (sun azimuth centre), `set` 18.5 (sun phase is piecewise: day stretched between rise and set, night over the rest), `mist` x1, morning window `ma1..ma4` 5.6/6.4/7.6/10, dusk amount `dm` 0.25, dusk window `mp1..mp4` 17.8/18.4/19.2/20, noon-row sky colours `kz`, `kh`.
	- Camera: `eye` 3.43 m, `d0` 60 m, `hz` 0.52, `capw` 0.16, `caph` 0.1 (the ocean grid's inner radius stays built for 3.43 m).
	- Zoom: `hold` 500 ms, `dur` 1300 ms (C), `over` 6 m, `ease` (C: default bezier, ease-in, ease-in-out, linear, two beziers).
	- Gate: `lac` lacquer colour, gloss `glr` 0.22 / `glc` 0.18 / `glb` 0.15, `wear` x1, `grain` x1, `kasa` kasagi curve lift x1.
	- Rocks: `r0x/r0z/r0s` .. `r2x/r2z/r2s` position (m) and scale (the left rock's plinth and post-occlusion cylinder stay fixed under the post), `ero` erosion x1 (keep at or under 1.5: raymarch bound), `wet`, `alg`, `salt` x1.
	- Stars: `sth` 0.985, twinkle rate `stmin` 0.5 / `stmax` 4, `steady` 0.33. Portal: `prip` ripple, `prim` rim light, `pblur` radial blur, `pflash` flash (all x1), `veil` colour (#f4f2ee, canvas and CSS veil). Reflection: `rfl` object reflectance floor 0.78, `rdist` ripple distortion 0.014.
	- Default render: framebuffer hashes (`shots/_pxhash.mjs`, `?frz=3`, start frame at 12.5/18.3/23/6.5, 390x844 and 1440x900) are identical to the pre-panel file except 1440x900 at 6:30, where one channel of one pixel differs by 1/255 (constant folding vs uniform). Redraw cost unchanged within noise (3 alternating runs, 390x844: before 6.1/8.4/7.8 vs after 6.4/6.4/7.6 ms; 1440x900: 5.0/5.3/8.1 vs 5.3/5.2/9.8). Size 72,381 / 28,021 B gzip (was 57,945 / 23,210). Shots `shots/panel-{water,scene,closed}-{390,1440}.png`, `panel-changed-1440.png`, `panel-fromurl-1440.png`, `panel-scene-params-1440.png`; harness `shots/_panel.mjs`.
- Glint default 0.01 in all three full variants (user checked; shading otherwise unchanged; an aborted AA rework was reverted from `h-water-full-glass.v3.html`). Second-source check: headless, `?glint=0` (URL) gave a smooth sun path at 11, 15, 16 and 17 h (`?frz=3`, 47.3, 123.7; 1440x900 and 390x844); no isolated dots appeared without the glint layer, so no second source was reproduced. Not tested: the slider path after the zoom has finished, and Safari/iOS.

## Performance pass (2026-11-05)

Harness: `packages/webgui/research/splash/shots/_bench.mjs` (run from `packages/webgui`). `build <label>` builds the current tree with `scripts/build.ts` into `/tmp/splash-bench/<label>`; `px <label> [base]` loads the built scene chunk in a harness page, pins `performance.now`, calls the shipped `GateScene.load`/`warm`/`frame` at frozen sim time 3 s and hashes/diffs the full framebuffer (hours 6.5, 12.5, 18.3, 23; start frame, dolly t 0.5 and 0.85; 390x844 dpr 3 and 1440x900); `perf <labels...>` alternates builds, median of 7, 390x844 dpr 3: cold = fresh Chrome profile (empty GPU program cache), warm = same profile reloaded; `compile` = chunk imported to first `createVertexArray` (all programs linked), `ctor` = constructor (grid, targets, H0), `warm-draw` = `warm()` plus 1 px readback, `ff` = nav start to that point; `app nav->gl` = real built `index.html`, nav start to `splash-gl` class; `size <label>` = raw/gzip -9/brotli 11 of the scene chunk and entry, plus Bun metafile bytes of each `src/splash` file. No test hook in shipped code. Two builds of the same tree: identical hashes, timing noise ~1 to 2 ms (app cold ~10 ms).

Baseline (headless Chrome Metal, M5 Pro):
- Scene chunk 45,971 / 18,307 / 16,233 B (raw/gzip/br); of it `shaders.ts` 36,361 B, `scene.ts` 9,553 B raw. Entry share: `index.ts` 3,583, `sky.ts` 2,007, `splash.css` 2,079 B raw.
- Cold: compile 29.7, ctor 5.6, warm-draw 19.8, ff 86.1 ms. Warm: compile 17.3, ctor 5.7, warm-draw 16.2, ff 64.8. App nav->gl cold 115.8 (102.7 second build), warm 104.4.

Levers (one at a time, `px` vs baseline, `perf` alternating against the previous kept build):
- 1 GLSL minification, kept. `scripts/splash-shaders.ts`, a Bun plugin in `scripts/build.ts`: `@shaderfrog/glsl-parser` (devDependency, 7.0.1) parses each shader and resolves scopes; declared functions, globals and locals get short names (interface names stay: uniforms, in/out, attributes, builtins), comments and whitespace go; literals are emitted as written. The module is evaluated in a child process per build, so `--watch` picks up shader edits. `#define`s in `COMMON` became `const`s and one `& 1` became `% 2` (pixel-identical). All 24 frames identical. Scene chunk 45,971 / 18,307 / 16,233 to 29,253 / 12,504 / 11,099 B. Compile time within noise (cold 29.0 vs 22.2, warm 15.2 vs 18.6 ms in one alternating run). Rejected first: glslx 0.4.5 renames locals to kept uniform names (shadowing), renames vertex `out` varyings without the fragment `in`, prints `a+b&1==0` without parentheses, joins void calls with the comma operator, and rounds float literals to about 6 digits (43758.5453, pi); every frame differed by up to 249/255.
- 2 Shipped-constant uniforms folded, kept. `EH` (from `EYE`, now exported by `shaders.ts`), `LAC`, `GT`, `GT2`, `RK` (inlined into `rp()`), `RS`, `STU`, `PO`, `VC`, `WP`, `TQ` are GLSL `const`s; 11 `uniform*` calls gone from `scene.ts`. Max diff 1/255 in 1 to 40 channels per frame (17 of 24 frames), the rest identical. Scene chunk 28,901 / 12,397 B. Timing within noise.
- 3 Dead code, kept. Jacobian foam (never triggers on this sea: the branch, its `amb`, the 3 `uD*` fetches and the Jacobian output in the ocean G-buffer pass, the Jacobian in ASSEMBLE) and every x1 panel factor (`GT.w`, `GT2`, `RS`, `PO`, `WP.w`, `TQ.y`, `SUNI`, `MOONI`). Identical to lever 2 in all frames. Scene chunk 28,351 / 12,172 / 10,781 B. Timing within noise.
- True cold found: Chrome's profile cache is not the cold path on macOS; the OS Metal cache (outside the profile) keeps compiled pipelines across fresh profiles. `perf` now changes one hash literal (`43758.5453`) per browser launch in the served chunk, so every cold run misses the Metal cache (an unused uniform does not: it is stripped before the Metal compile). True cold the main FS pipeline compile blocks the first draw (`warm()`) for ~2 s on the main thread: baseline app nav->gl 2,770 ms. Lever 2 alone cut it to 2,244 (warm-draw 2,584 to 2,055 ms): constants fold before the Metal compile.
- 4a Compile wait polls every 4 ms (was one rAF, up to a frame of latency) and the ocean grid is built while the driver compiles, kept. Profile-cold load 34.4 to 26.9 ms, app 111 to 99.5 ms (N 15); identical frames.
- 4b FS to GLSL ES 3.00 (`texture`, `out fragColor`, shares `QV`), kept for 4c (ES 1.0 forbids non-constant loop bounds); identical frames, timing unchanged.
- 4c One `scene()` call site in `main()`: sample 0 (undisturbed view) and the portal's displaced samples run in one loop; every GLSL call is inlined, so 4 call sites (one in a 5x loop) were 4 copies of all raymarches. True cold app nav->gl 2,237 to 803 ms (warm-draw 2,026 to 599). Max diff 1/255 in 2 channels.
- 4d One edge-AA `shade()` site in `scene()` (the hit and water branches shared the blend), kept: true cold 715 vs 801 ms, identical frames. 4e One `shade()` site for hit plus edge AA (2-pass loop), kept: 629 vs 715 ms, max 1/255 in 2 channels.
- 4f `rnrm()` as a 4-offset loop (one inlined `rk()` instead of four), kept: 478 vs 627 ms, max 1/255 in 1 to 2 channels. Rejected (gain within noise): the same loop for the gate `nrm()` (453 vs 469 ms, more 1/255 channels) and a 2-probe loop for the rock AO (468 vs 465, identical).
- 4h One `trace()` site for view plus mirror ray (2-pass loop in `scene()`, `mirror()` shared with `bgd()`), kept after the user accepted isolated edge pixels: harness cold fence wait 270 to 225 ms, app true cold about 471 to 420. 4i The three rock traces as a loop, kept: app true cold 416 to 400 (N 7). Both flip 1 to 3 raymarch-edge pixels per frame by 2 to 5/255 (constant propagation per call site changes rounding); first tried before 4d to 4f, where each alone was worth about 180 ms.
- 5 Ocean grid indices 16-bit, kept: the 113k vertices are split into 2 ring bands (290 rings each) that share one band-local `Uint16Array` pattern (335,820 indices, 0.67 MB; was 671,640 `Uint32` indices, 2.69 MB), each band a VAO whose vertex pointer starts at its first ring; 2 `drawElements` per frame in ring order, same triangles in the same order. Identical frames. Profile-warm load 23.4 to 19.2 ms, app warm 104 to 96 ms (N 11); true cold unchanged (460 vs 467).
- 4g Pipeline warm-up off the main thread, kept: `GateScene.load()` draws the all-branches frame, `fenceSync` + `flush`, and polls `clientWaitSync(sync, 0, 0)` every 4 ms; `start(now)` (was `warm()`, which `readPixels`-blocked) then draws the start frame in the task that shows the canvas. Identical frames. Longest main-thread gap before the first GL frame (4 ms heartbeat in the app page): true cold 276 to 31 ms, warm 46 to 46; app nav->gl unchanged within noise (true cold 466/456 vs 464/471, warm 101/103 vs 106/106).

Baseline vs final (`perf base rl`, N 7 alternating, 390x844 dpr 3; true cold = Metal cache miss, median of the miss runs: a few cold runs still hit the OS cache, 1 of 7 each here, listed by the harness per run):

| Metric | Baseline | Final |
|---|---|---|
| Scene chunk raw / gzip / br (B) | 45,971 / 18,307 / 16,233 | 28,939 / 12,546 / 11,061 |
| Entry chunk raw / gzip / br (B) | 609,697 / 191,667 / 163,724 | 609,698 / 191,673 / 163,675 |
| App nav to first GL frame, true cold (ms) | 2,832 | 403 |
| App nav to first GL frame, warm (ms) | 112.9 | 106.5 |
| Longest main-thread gap before first GL frame, true cold / warm (ms) | 2,637 / 45 | 25 / 46 |
| Harness true cold: link wait / first draw (ms) | 140 / 2,624 | 134 / 210 (fence wait, main thread free) |
| Harness warm: import to linked / to first frame (ms) | 25.1 / 44.8 | 18.6 / 40.2 |
| Redraw start frame / t 0.9 (ms, median of 31) | 1.5 / 4.6 | 1.6 / 5.4 (noise range 4 to 6) |
| Frames vs baseline | | 15 frames max 1/255, 4 max 2, 2 max 4, 1 max 5, 2 identical; values over 1/255 in at most 2 pixels per frame; at most 144 channels differ |

Entry chunk: `index.ts` +1 B (`start` vs `warm`). Shipped GPU index buffer 2.69 to 0.67 MB.

Checks: `bun --cwd=packages/webgui test` passes (1,060 tests including the new `test/splash-shaders.test.ts`: interface names and literals kept, no comments, no renamed local hides a used global, plugin output). `bun --cwd=packages/webgui run check`: lint and format pass; `check:types` fails only on 4 pre-existing errors outside webgui (`ai/src/auth-gateway/session-state.ts`, `coding-agent/src/lsp/workspace-diagnostics.ts`, `coding-agent/src/session/ttsr-outputs.ts`, `coding-agent/src/telemetry-export-otlp.ts`).

Remaining ideas:
- The water's reflected-object `shade()`/`aaN()` in `bgd()` is still a separate inlined copy; folding it into the shade loop needs `bgd()` split around it.
- Ocean uniforms that never change (`uLength`, `uLen`, `uLambda`, `uWind`, `uRS`, `uIn`) could be GLSL consts; small, they are set once.
- True cold on the iPhone (A15 Metal) is unmeasured; the 2.8 s to 0.47 s ratio should carry over, absolute values will be higher.
- The harness true-cold method changes one literal per launch; a few launches still hit the OS cache (cause unknown), so check per-run values.
- Layout (2026-11-05, after the pass): GLSL moved to `packages/webgui/src/splash/glsl/` (`main.frag`, `common.glsl`, `quad.vert`, `init.frag`, `evolve.frag`, `fft.frag`, `assemble.frag`, `surface.glsl`, `ocean.vert`, `ocean.frag`), text-imported by `shaders.ts`, which only joins and exports; `EH = 3.43` in `main.frag` duplicates TS `EYE`; `LOOP` lives in `evolve.frag` (`mod(uTime, LOOP)`, was `t % LOOP` in `scene.ts`). Frames identical, scene chunk +7 B.
- `/shader` (2026-11-05): `src/splash/viewer.ts`, lazy from `main.tsx` (no splash, no app): the shipped `GateScene` held at the start frame with the water running, overlay hour slider (+ now), dolly t slider, play/pause of sim time, mirrored to `?hour=&t=`; `GateScene.setHour()` added. Entry +253 B raw / +110 gzip / +184 br; viewer chunk 2,922 / 1,386 / 1,139 B.

## App background (2026-11-05)

User: "what if we made the shader the background to our app"; "off on phone but on on my 20core gpu with 64gb unified ram macbook pro 2026"; "we can test a still image on the phone".

- Code: `src/splash/background.ts` (`appBackground`), `background-mode.ts` (`resolveBackgroundMode`, `FrameGuard`), `background.css` (imported as text, injected on first use) form one lazy chunk; the entry keeps `background-setting.ts` (stored setting for the Settings screen, synced across tabs via the `storage` event) and `chunks.ts` (shared `LazyModule`s for the scene and background chunks). Tokens `--glass-*` in `src/styles/tokens.css`; `GateScene.setScale()`. The splash starts fetching the background chunk at construction; `#finish` hands its scene and canvas to `appBackground.start()` in the same task when the chunk is there (measured: always, handoff 0 to 0.1 ms), else once it arrives (scene kept alive off-screen). Tests: `test/splash-background.test.ts`.
- Setting Auto / Live / Still / Off (`localStorage` `webgui.background`, absent = auto); `?bg=live|still|off` wins (also over reduced motion). Auto: live with `(pointer: fine)` and a window >= 1024 px, else still. Reduced motion: off. Scene load failure (no WebGL2 / float targets): off. html carries `data-bg="live|still"`.
- Defaults taken: framing = start frame (gate at 60 m); all screens get the background, transcripts (`.sh-transcript` except the main menu's sessions page) and every other panel stay solid; water at full speed on desktop.
- Live: hour from the clock each frame; paused while `document.hidden` or `!document.hasFocus()`; after 30 s without pointer/key/wheel/touch input 10 fps (setTimeout + rAF), back to full rate on the first input; guard: average interval over a 2 s window above 1.5x the requested interval (floor 25 ms) steps half the pixels (scale 1/sqrt 2), then 30 fps, then still. Gaps > 500 ms (hidden tab) restart the window.
- Still: in the splash's last task the start frame is drawn and `canvas.toBlob` (WebP, JPEG where WebP encoding is missing, quality 0.85) is called in the same task, then `loseContext`; `img.decode()` before it becomes the layer's `background-image` (object URL); the hour's placeholder gradient shows until then. Re-rendered (fresh context, then released) on return after >= 30 min hidden.
- Fix pass (2026-11-06): a visible still re-renders every 15 min (`STILL_REFRESH_MS`), and at once on return when older. Still renders are serialized and numbered (`StillOrder`): an older decode is dropped, and light is emitted with the image it describes. A lost GL context stops the live loop and shows the placeholder; the scene is rebuilt on restore; no luma is emitted while lost.
- Glass: blurred (16 px) top bar/sidebar/inspector over the still image; over the live scene a denser tint without blur (`--glass-dense-*`), because the blur re-runs every frame there (numbers below). Sessions page (user, 2026-11-05: only the cards over the background, no full-window layer; the 60% near-white scrim turned the night scene flat grey in the light theme): no scrim; bare text outside cards (heading, section and day labels, empty/loading/error lines) sits on a fit-content pill in `--glass-raised`, inside the padding those elements already have. A text halo (`text-shadow` in the page colour) was tried first and left the small "LIVE · 6" label unreadable on the light theme at night.

Measured (headless Chrome Metal, M5 Pro; harness `_bench.mjs bg|bgshots|bgcost`):

| Check | Result |
|---|---|
| Phone 390x844 dpr 3 | splash then still; image 780x1688 WebP 9.5 to 10.5 KB, encode (toBlob call to callback) 42 to 52 ms, decode 2.7 to 3.4 ms; GL context lost, no canvas left in the DOM |
| Desktop 1440x900 live | 60 fps behind the app; hidden tab 0 to 1 draws in 1.5 s, 59 to 60 fps after return; idle (> 30 s) 10 fps, 59 to 62 fps after a mouse move |
| Guard (every rAF callback spins 60 ms) | half pixels at 1.2 s (canvas 1440 to 1018 px wide), still image at 5.4 s, GL context lost |
| `/` splash frames (`px` vs pre-change build) | identical, all 24 frames |
| Entry JS raw / gzip / br (B) | 609,951 / 191,760 / 163,891 to 611,250 / 192,192 / 164,191 (+1,299 / +432 / +300: `background-setting.ts` 325, `chunks.ts` 172, splash handoff, Settings tile). Lazy background chunk 6,786 / 2,792 / 2,434 (`background.ts` 3,821, `background-mode.ts` 552, `background.css` text 2,181). Before the split the entry was 615,380 / 193,583 / 165,449 |
| Blur cost, 1728x1117 @2x, glass text moving every frame, GPU-process main thread ms per frame (median of 5) | live without blur (shipped) 1.83; live with blur 6.16; still with blur (shipped) 1.59; still without blur 0.29; all 60 fps presented. GPU execution time itself is not visible headless. |

Shots: `/tmp/splash-bench/<label>/bg/shot-{390,1440}-{dark,light}-h{12.5,18.3}.png` (Date shimmed in the page).

Risks left for the iPhone: WebP vs JPEG from `toBlob` in Safari and the snapshot without `preserveDrawingBuffer` (works in Chrome); `:has()` needs iOS 15.4; blur cost of the top bar over the still while scrolling; real still encode time on the A15; the 30-min re-render compiles the shaders again (about 0.4 s true cold).
