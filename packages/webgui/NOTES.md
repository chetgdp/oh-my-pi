# Working notes: item 5, model-picking parity (landed)

Updated 2026-09-25. Item 5 definition of done in PLAN.md "Model parity"
is complete; all items landed and verified. This file records how to run
the stack, what exists, and open horizon tasks.

## Run it

Host config, `~/.omp/agent/config.yml` (nested YAML; `settings.json` in
that dir is a legacy migrate-and-archive source and is not live config):

```yaml
rpc:
  serve: true
```

Only omp processes started after the change publish. Verify with
`bun --cwd=packages/webgui run attach` (lists hosts; `--id <instanceId>
<prompt>` drives one and prints raw frames).

Daemon (production bundle): `bun run webgui:build && bun run webgui` (serves
`dist/` on `127.0.0.1:42049`, the port `tailscale serve` fronts).
Dev mode reloads the page whenever the HMR socket drops (every iOS
resume); use the production daemon on the phone.
Phone dev loop: `bun run webgui:watch` (`build.ts
--watch --serve`). Rebuilds the production `dist/` (about 1.4s, one build
per burst of saves) and runs the server with `--hot`. The phone gets the
161KB brotli bundle and a 304 on resume; reload by hand to pick up UI
edits. Builds go to `dist.next/` and swap in, so the daemon never serves
a half-written dist; a failed build keeps the last good one.
Dev mode (HMR + in-memory bundling + server reload): `bun run webgui:dev` (or
`bun --cwd=packages/webgui run dev`). Uses Bun's HTML router with `--hot
--no-clear-screen`; edits to `src/**/*.{ts,tsx,css}` rebuild in-memory (<30ms)
and HMR to the browser without a full page refresh or server restart. Edits to
`src/server/*.ts` reload in-place via Bun `--hot` without dropping the port or
clearing the terminal. Single-port design on `42049` keeps Tailscale serve and
WebSocket/API routing intact without cross-origin complications.
The WebSocket relay negotiates permessage-deflate, but Bun compresses a frame
only when `send(text, true)` is passed, and its "dedicated" compressor does not
keep history across messages (measured 2026-10-08). The relay therefore
coalesces upstream chunks for 50ms (or until 64KB) per frame. v3 sends
assistant text up to 4 times (delta, block_end, msg_end, entry), so most of
the raw bytes are repeats. Hidden tabs close the socket after 60s and resync
history on return.
The production build is `scripts/build.ts` (Bun.build from `src/main.tsx`,
not `index.html`: Bun 1.3.14's HTML rewrite pointed the script tag at a
mermaid chunk and the app never mounted). It sets `NODE_ENV=production`,
dedupes katex (mermaid nests 0.16), writes `dist/index.html` with
`modulepreload`, precompresses `.br`/`.gz` for files over 1 KiB, and logs
initial-load and total sizes. `static.ts` serves the precompressed files by
`Accept-Encoding`; `index.html` is always `no-cache` with an ETag. Dev mode
sends one unminified 17MB bundle uncompressed. katex is a separate chunk
fetched on the first math token, and mermaid (about 1.5MB over several chunks) on the first
closed ```mermaid fence. Mermaid runs with `securityLevel: "strict"`; failed
or still-streaming diagrams show their source. Tapping a diagram opens
`MermaidViewer` (full screen, `@panzoom/panzoom` loaded on open: pinch or
wheel zoom, drag pan, close button or Esc).
Tests: `bun --cwd=packages/webgui test` (697, 2026-10-02) and, from
 `packages/coding-agent`, `bun test ./test/rpc-*.test.ts` plus
 `./test/session-manager*.test.ts`. These are the only suites that cover our
 work. Do not run or report the full coding-agent suite: it is upstream's,
 and it fails on upstream test pollution unrelated to us (about 217
 failures, 2026-09-24).
Protocol v3: webgui requires an omp started after v3 landed. Restart omp
to verify. Tests: `bun --cwd=packages/coding-agent test test/rpc-v3.test.ts`
plus the webgui tests. E2E verified 2026-09-24 in headless Chromium at
390px: history load, streaming, and the incompatible banner on a pre-v3 omp.
Lint/types: `bun --cwd=packages/webgui run check`, `bun check` in
coding-agent. E2E: launch a fresh omp via `POST /api/launch {cwd}` (an omp
started before the RPC change does not know the new commands), then drive
its socket; `scripts/attach.ts` prints raw frames.
Test omps launched this way default to the Antigravity model, which has a
5-hour quota. Switch them with RPC `set_model {persist:false}` (and
`set_model_role {persist:false}` for subagent roles) so saved defaults stay
untouched. Subagents started with the `task` tool can hit the same quota;
`agent: "self"` runs on the parent's model.
Verified topology: M1 Air thin client over ssh controls tmux on the M5 Pro
host; phone attaches to the same sessions through the daemon over Tailscale.
Perf benches (`bench/`, headless Chrome via puppeteer-core, never the real
profile or `~/.omp`): `bench/lib/session-frames.ts` generates synthetic
sessions; `bench/fake-host.ts` serves them as an RPC host from a temp
registry. `bun bench/browser-render.ts` (CPU profile, forced layouts, React
commits; writes `bench/browser-render-results.json`), `bun
bench/verify-scroll.ts` (pin-to-bottom, scroll-up, load-older, composer;
exit 1 on failure; `VERIFY_DIST=<dist>` serves another build),
`bench/headless-store.ts` (reducers and cache), `bench/server-endpoints.ts`
and `bench/past-id.ts` (HTTP endpoints against temp fixtures). Run `bun run
build` first, and do not run `bun test` at the same time (it rebuilds dist).

## Design (as built)

- One component tree, responsive by CSS only. Both side columns collapse
  to a 52px rail via their panel toggle (localStorage per column). Breakpoints in
  `src/lib/layout.ts` and as literal px in media queries: 720 (sidebar
  appears), 1100 (inspector appears). Under 720 the sessions list is a
  full-page route; agents/info panels are full-page routes with a back
  button. Touch targets 44px; body text 15px; textarea 16px (iOS zoom).
  `@media (pointer: fine)` gates hover states and the connection label.
- Routes: `#/` sessions, `#/s/<id>`, `#/s/<id>/info`, `#/s/<id>/models`,
  `#/s/<id>/todos`, `#/s/<id>/usage`, `#/s/<id>/hub[/<agent>]`,
  `#/s/<id>/subagents`, `#/s/<id>/agent/<agent>`; legacy `agents` maps to the hub
  (`src/lib/route.ts`). Overlay visibility derives from the route; browser
  back works.
- No imports from `packages/collab-web`. Markdown, tool views (29
  renderers under `components/transcript/tool-views/`), tokens, and base CSS
  are copied and owned here.
- Transcript is virtualized (`@tanstack/react-virtual`). Rows: user
  (right-aligned block), assistant Markdown, developer (collapsed), thinking
  (collapsed chip), tool card (collapsed one-liner, tap or global toggle to
  a pending row until the session echoes it (`pendingUser` in
  `transcript-model.ts`). Slash commands that execute locally
  (builtins with a text-mode `handle`) emit `command_output` frames
  rendered as developer rows; `pendingUser` clears on `command_output`
  or `prompt_result { agentInvoked: false }`. A 16px gutter (`paddingEnd`
  plus `scrollPaddingEnd`) separates the last row from the composer.
  Markdown tables sit in `.tr-table-wrap` and scroll sideways on narrow
  screens; from 720px they fit the column and wrap (`break-word` on cells,
  `anywhere` only on inline code: `anywhere` on cells shrinks columns to
  one character). pi-utils marked dispatches tables through a block extension,
  so `renderer.table` in the `Marked` config is never called.
- Composer: auto-grow textarea, Send at rest; while busy the input-row
  button reads Steer or Queue (segmented control) and a separate Stop
  button appears. On desktop (`(min-width: 720px) and (pointer: fine)`)
  the busy controls share the input row; phones keep a second row.
  Enter submits only with a fine pointer. Slash
  autocomplete from `get_available_commands`. Image attach and paste,
  sent as `images` on prompt/steer/follow_up.
- Theme (2026-10-02): dark is graphite (untinted grays, off-white
  `--accent`, color only for status); light keeps the brand palette.
  Component CSS uses tokens only, never raw colors or undefined custom
  properties (their raw fallbacks always render). List hover/selected
  fills are `--bg-hover`/`--bg-selected`, set per theme. Write every px
  font size as `calc(Npx * var(--font-scale))`; the scale is 1.0667 on
  desktop and 1 on touch, which keeps iOS inputs at 16px.
- Side columns: both collapse to a 52px rail (localStorage per column).
  The collapsed sessions sidebar shows a rail of live sessions; an
  inspector given as a function receives the collapse toggle for its own
  header (Subagents does this). Desktop Subagents has "Clear all".
- Status strip: two-group layout (`.ss-group--left`, `.ss-group--right`)
  with space-between. Model name truncates via ellipsis; compact spacing;
  pulsing dot indicator for streaming/compacting; tools toggle pinned right.
- Top bar: ← goes to the session's main view from any panel (agent view,
  hub, subagents, info, models, todos, usage) and to the sessions list only
  from the main view. Title button toggles Info panel where full title is readable;
  connection dot opens popover with live state, instance ID, and reconnect;
  Bot button (count badge, every width) opens the Agent Hub at >= 1100px and
  the Subagents card page below that.
- Toasts: deduplicated by message, capped to 3 active, auto-dismissed
  (8s error, 4s info). Dismiss button uses Lucide X.
- Subagents list (`components/agents/PinnedSubagents.tsx`,
  `lib/pinned-subagents-model.ts`): the desktop inspector (>= 1100px), and a
  full page `← Subagents [Open Agent Hub]` below that. Each agent is a TUI
  Agent Hub card: status dot, name, `TYPE · model level` (model from
  `resolvedModelIdentity`, no `:level` suffix), task, then cost, duration,
  req, tools, tok, age. Newest first; task lines truncate at the card
  edge. All subagents, no collapse; finished ones stay until
  dismissed with X (per session, localStorage `webgui.pinnedDismissed`,
  `lib/pinned-dismissed.ts`); a revived agent reappears. A card tap focuses
  the agent. The store holds the roster subscription while the list is
  visible (`setPinnedOpen`). Finished roster entries carry no task or
  thinking level; the type falls back to `displayName`.
- Subagents: fetched on attach, updated live via `subagent_lifecycle` and
  `subagent_progress` frames, and re-fetched on turn completion. The
  Agent Hub uses `get_agent_roster` (includes parked/aborted agents) plus
  `agent_registry` frames while open; finished agents stay listed.
  The server keeps one snapshot per process bus, so a reconnect sees agents
  already running, including a revived (parked, then messaged) agent. Root agents
  render top-level even when carrying a parent tool call ID (`call_...`).
- Focused agent (TUI `focusAgent` parity, route `#/s/<id>/agent/<agentId>`):
  the route drives `store.focusAgent/unfocus`. Parked agents are revived
  first; stale requests are dropped by a monotonic seq. History is the
  `get_subagent_messages` byte cursor (poll 3s, plus 150ms after events that
  persist entries); live state comes from `subagent_event` frames, enabled
  with `set_subagent_subscription {level:"events", ids:[agentId]}` and reset
  to `progress` on leave. With `ids`, the response also carries `snapshots`
  (per live agent: partial `streamMessage`, cached `tool_execution_start`s and
  `tool_execution_update`s, never reviving parked agents); the host subscribes
  before snapshotting, and the store replays it through the same fold
  (`applyFocusSnapshot`), dropping a response whose `focusSubscribeToken` is stale.
  Tools that started but never emitted an update appear running immediately.
  Frames carry raw agent-session events, not v3, so
  `lib/focus-model.ts` folds them (message_update replaces the whole partial)
  and drops frozen live rows once the cursor delivers their entries. Detach to
  Main only on registry frames or roster snapshots (removed, parked after
  live, aborted); progress-derived status is ignored. Esc clears the editor,
  then returns to Main; other commands are refused (`gateFocusedSubmit`; `/export` downloads the focused agent's HTML export);
  empty submit or Stop calls `interrupt_agent`; sends use `steer_agent`
  with `mode` and `images` (image-only sends allowed). Roster subscription
  is refcounted by hub-open and focus, and a deep link before the handshake
  is deferred until ready. The focused
  agent's todos are derived in the store from its polled entries
  (`getLatestTodoPhasesFromEntries`, the TUI canonical rule: newest
  `user_todo_edit` or non-`view` successful `todo` result, else empty) and
  memoized on the entries array; `FocusStatusStrip` shows the same
  closed/total chip as Main and opens the read-only `TodoPanel` overlay at
  `#/s/<id>/agent/<agentId>/todos` (browser back closes it). Never send
  `set_todos` from the focused view: it acts on Main.
- `/btw` (`modes/rpc/rpc-btw.ts`, `components/btw/BtwSheet.tsx`):
  Main session only (`btw {question, recordId?}`, `btw_cancel {recordId?}`,
  `get_btw_history`). Streams `btw_delta` and `btw_record` frames.
  Subagent-scoped btw and btw branch removed to match upstream.
- Sessions UI: "New" button replaced with prominent 44×44px `+` toggle.
  Live cards sort by `lastActivityAt` (session file mtime) and show an
  unread badge: `assistantCount` from `/api/live` minus the per-device
  seen count in localStorage (`lib/unread.ts`). Past sessions are not
  fetched on load: `/api/past` (about 360KB for 761 sessions, 2026-10-05)
  loads only when "Resume session" is pressed or the New session form
  opens (page) or its directory input gains focus (sidebar), for the
  directory suggestions. Afterwards a rename or shutdown refreshes it.
- Live session shutdown uses RPC `shutdown` command (implemented in `rpc-server.ts`)
  with safe error handling against older omp processes.
- Session controls: title tap renames (`set_session_name`; omp pushes
  `session_info_update` to every connection); user rows carry Rewind
  (two-tap confirm, `branch`); past rows carry Delete (daemon
  `DELETE /api/past/:id`, 409 when live); a stopped or failed turn shows
  Retry (prompt `/retry`).
- Todos: `todo-model.ts` derives state from wire frames (todo tool
  results, user-edit entries, `get_state` refetch at turn end); no new
  push frame. Status strip shows closed/total and opens
  `components/todos/TodoPanel.tsx`; taps send `set_todos`, which omp now
  persists as a user-edit entry. Transcript todo calls render as the TUI
  tree; consecutive todo calls (thinking between them absorbed) merge
  into one card keyed by the first call. Rails continue through wrapped
  lines via CSS backgrounds in `tool-render.css`.
- Drafts (2026-10-02, `lib/drafts.ts`): composer text and images, and
  the Agent Hub steer box, kept per `instanceId:agent` (hub uses
  `hub:<agentId>`). In-memory map read synchronously at mount; persisted
  to IndexedDB `webgui-drafts` via idb-keyval, images as Blobs. Stored
  drafts load after first render (`hydrateDrafts()` in `main.tsx`, never
  awaited) and fill a box only if it is still empty. Expire after 1 day,
  newest 20 kept. Composer never remounts on key change; it swaps the
  draft during render. An awaited IndexedDB load before render plus a
  keyed remount made session open take about 40s on a real browser
  (2026-10-02, reverted); keep both out.
- Transcript cache (2026-10-05, `lib/transcript-cache.ts`): IndexedDB
  `webgui-transcripts` via idb-keyval stores newest 200 entries of the branch
  per `sessionId` across restarts; keeps up to 10 sessions, expires after 7
  days. Synchronous `localStorage` index (`webgui.transcriptIndex`) maps
  `instanceId` and `sessionId` to `leafId` so reconnect and cold attach send
  `history {after: leafId}` without awaiting IDB before first render. Result
  with `after` appends delta entries; mismatch or `branch_changed` drops cache
  and falls back to newest page. A `history` result or `entry` frame with
  `secrets: true` (omp restored a secret for display) drops the session and
  adds its id to the index's `noCache` list, so it is never cached again.
- Fonts (2026-10-02): `--font-ui` is Atkinson Hyperlegible Next
  (fontsource package, 4 weights). `--font-mono` lists the installed
  `IosevkaTerm Nerd Font Mono` first, then `IosevkaTerm Web`, a subset
  of IosevkaTerm v34.9.0 (`src/styles/fonts/`, about 18KB per weight,
  400 and 700). `lib/fonts.ts` registers it as a `FontFace` from JS
  because Bun's CSS bundler inlines `url()` fonts as base64 into the
  blocking stylesheet. Browsers fetch it only when no installed name
  matches. Regenerate with `bun scripts/subset-font.ts [version]` (needs
  `gh` and `nix`). Keep fonttools' default layout features: `"*"`
  grows each file to about 138KB.
- Voice (2026-10-06, `lib/wren.ts`, `shell/VoiceToggle.tsx`,
  `transcript/SpeakButton.tsx`): the browser calls Wren directly at
  `https://pq9.time-phrygian.ts.net:8765` (Tailscale serve; Wren allows
  the `:42049` origin via CORS, no token). Channel `webgui-<id>`
  (localStorage). Voice starts off on every load; the status-strip
  toggle tap creates and resumes the AudioContext (iOS unlocks audio only
  inside a tap) and sets `navigator.audioSession.type = "playback"` so
  the silent switch does not mute it. While on, a pointerdown/keydown
  asks `/health` who is active (at most every 2s) and claims if it is
  not us, so agents' `wren say` plays on the device last touched; a
  cached flag went stale when Wren.app reclaimed. The claim label reads
  `webgui <device> audio:<ctx state>`, visible in Wren `/state` (the
  way to see a phone's audio state without a debugger). Player ported
  from Wren's `extension2/audio.js`. Screen lock stops audio. Verified
  on iPhone 2026-10-06: read aloud and `wren say`.
- `research/` holds agent working notes; ignored by git.
## Open

- Verified on a real iPhone in home-screen (standalone) mode: composer
  clears the home indicator at rest and sits on the keyboard when focused.
  Keyboard ergonomics resolved. Scroll performance on long transcripts is
  fine in daily use (sessions stay under ~33% of a 1M context). Steer,
  queue and stop by touch verified 2026-09-24; one-tap send keeps the
  keyboard open; upward scroll through history pages is smooth on iPhone.
- Stop restoring queued messages into the composer: verified by the user
  2026-09-24. Not yet verified by the user: the draft restore after a
  late error response (unit test only).
- The legacy `get_subagents` snapshot omits terminal agents; the Hub
  roster does not.
- `.tb-back` shows at all widths (2026-09-24). `#/` renders without the
  sidebar and inspector at every width (`sh-app--solo`); those columns
  are per session. The design is a prototype; full UX not designed yet.
- Live session cards show the latest idle recap from history.db
  `session_recaps` while the session JSONL is not newer than it
  (`server/live.ts`). Shown on the phone sessions page only; the desktop
  sidebar hides it. Needs hosts that publish `sessionFile` in the
  registry (omp started after 2026-09-26).
- TUI/GUI parity: packages 1 (session controls) and 2 (todos) landed
  2026-09-24; package 3 and item 12 (usage screen) 2026-09-25/26. Plan
  mode landed 2026-09-26. Agent Hub (transcript, steer, kill, revive)
  landed 2026-09-29.
- iOS standalone facts learned the hard way (see HISTORY.md): do not use
  `viewport-fit=cover`; `display-mode: standalone` did not match; the
  daemon must send `Cache-Control: no-cache` on `index.html` or the
  home-screen app keeps a stale bundle indefinitely; inputs need
  `font-size` >= 16px or iOS zooms on focus and stays zoomed (all form
  controls audited and fixed to >= 16px across the app); iOS ignores SVG
  `apple-touch-icon`, so `apple-touch-icon.png` (180px, square corners,
  rendered from `favicon.svg`) must be re-rendered when the logo changes.
  Picking up a new icon means deleting and re-adding the home-screen app;
  after that (2026-09-27) text fields took focus but the keyboard never
  appeared (WebKit bug 279904). Not our code: restarting the iPhone fixed
  it; clearing the host's Safari website data is the other known fix.
  The status bar color comes from `theme-color` metas in `index.html`,
  hex copies of `--bg-raised` per color scheme.
- Bundle (2026-09-27; initial load 159.9KB brotli on 2026-10-02 with fonts
  as separate files): initial load 549KB raw / 136KB brotli (React
  prod ~194KB, tool views 99KB, models 78KB, CSS 88KB). Mermaid 12
  defaults every diagram to the ELK layout (1.5MB raw / 344KB brotli
  chunk); `Markdown.tsx` sets `layout: "dagre"`, so ELK loads only for
  diagrams that ask for it (`layout: elk`, `flowchart-elk`). Candidate:
  code-split tool views/models.
- Dev-mode routing covered by integration test in `test/endpoints.test.ts`.
- Hot-reload dev mode implemented cleanly via Bun HTML routing and `--no-clear-screen`.
- `/model <id>` over RPC changes the model but the TUI opens an
  interactive picker. The webgui equivalent is the Models hub
  (`#/s/<id>/models`) and the status-strip model chip.
- Models hub (`components/models/`): `useModelsHub` owns picker state and
  every RPC call; `ModelsScreen` is presentational with sections Active /
  Roles / Agents / Providers; props contracts in `contract.ts`. Desktop
  layout capped at 900px with horizontal row layout at >= 720px;
  keyboard shortcuts Ctrl+P / Shift+Ctrl+P cycle active model; auto thinking
  mode supported in picker. Verified live: mid-stream model switches,
  keyboard navigation, and iPhone touch targets.
- `get_model_browser` lists models of authenticated providers only, plus
  locked models a role or the MRU references; the full catalog exceeds the
  1 MiB RPC frame cap (observed: 729 rows / 80 providers after the cut).
  Locked providers still appear in the Providers section with counts.
- `config_update` reaches every connection of the omp process when a
  setting changes, whoever made it (TUI or any tab), via
  `rpc-config-feed.ts`. Other omp processes and TUI logins do not push.
- Two E2E-caught bugs fixed 2026-09-23: session-only clear
  (`persist:false, selector:null`) wiped the persisted role; selectors
  carrying `:level` were stored as `:low:low`. Regression tests in
  `test/rpc-model-roles.test.ts`.
- Subagent tree nests by agent id prefix (`A.B.C`, parent `A.B`), with the
  registry `parentId` preferred when present.
- Login (contract O, `modes/rpc/rpc-login.ts`, `components/models/
  LoginSheet.tsx`): locked provider rows and locked picker rows open the
  sheet. Loopback providers redirect to `localhost:<port>` on the host,
  unreachable from the phone; the sheet asks for the address of the dead
  page and `parseCallbackInput` takes the `code`/`state` from it. Device
  code providers (Copilot, Codex device) need no paste. `login_start` runs
  off the serial queue, so the rest of the UI keeps working; a socket
  drop aborts the host-side flow and the store marks it cancelled.
  Upstream `login` / `get_login_providers` remain in `rpc-server.ts`
  unused. Verified live: logout and re-login of anthropic from the
  browser (TASK.md 19-21 ticked). After logout the provider re-sorts
  into the alphabetical locked group; it is still tappable there.
- `get_login_status.source` embeds the `agent.db` path and account email;
  shown verbatim in the Providers section.
- Plan mode (`modes/rpc/rpc-plan.ts`, `components/plan/`): every webgui
  session is TUI-hosted, so a phone answer drives the TUI's own review
  overlay (`answerPlanReview`); do not add approval logic to
  `rpc-plan.ts` for that path. Approval aborts the planning turn with a
  silent-abort marker; renderers must skip it (`isSilentAbort` in
  `transcript-model.ts`). Hosts older than 2026-09-26 answer
  `get_plan_state` with "Unknown command"; the store ignores it.
  `webgui` imports `@oh-my-pi/pi-ai/error/flags`, never the
  `@oh-my-pi/pi-ai/error` barrel (pulls Bun-only code into the bundle).
- Session open order (2026-09-29): omp answers RPC commands one at a time
  in arrival order, so the store sends `history` first. Model roles, model
  browser, agents and login status load through `ensureModelData`,
  `ensureAgents`, `ensureLoginStatus` only when the models screen or a
  picker mounts (about 600KB per attach; no idle prefetch).
  Store listeners fire once per animation frame; tests call
  `flushNotifications()`. `rpc-client` sends concurrent identical read
  requests once. Settings `reloadFromDisk` skips the parse when no source
  file changed (ino, size, mtime).
- Injected rules (2026-09-29): rule interrupts (`custom_message`,
  `customType: "ttsr-injection"`) render as labelled developer toggle
  rows; `ttsr_injection` entries render as "rules: …" markers, skipped
  right after an interrupt. Built in `transcript-model.ts` from saved
  entries, so live and history match.

## Known gaps carried over
1. Extension UI requests never reach the browser (socket connections omit
   `onReady`); `ask.enabled=false` on this host. By design.
2. Webgui cannot use the TS DOM lib (RPC type graph is bun-types only).
   Browser globals go through `src/lib/dom.ts` and
   `src/browser-globals.d.ts`.
3. Changing the daemon port requires updating `tailscale serve`.

## Discovery and tmux facts
- Registry `~/.omp/run/rpc-hosts/`, one JSON per process; `listRpcHosts`
  prunes dead pids.
- The entry is rewritten on rename, model change and session switch
  (`RpcServeController` subscriptions); `startedAt` stays fixed. Only
  omp processes started after 2026-09-26 do this.
- Launch (contract H): GUI launches and resumes go to the detached tmux
  session `ompgui` (created on demand; gone when its last window
  closes): `tmux new-window -t ompgui: -c <cwd> -P -F '#{window_id}' --
  fish -C 'omp …; exit'`, so the window closes when omp exits. The
  window gets user option `@ompgui`; `/api/live` maps registry pids to
  panes and reports `origin: gui | cli | unknown`. Windows without the tag
  are never touched. `omp` is the fish function in
  `~/.config/fish/functions/omp.fish`.
- Shutdown is RPC `shutdown`; never `kill-window`.
