# Working notes: item 5, model-picking parity (landed)

Updated 2026-09-23. Item 5 definition of done in PLAN.md "Model parity"
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
`dist/` on `127.0.0.1:8081`, the port `tailscale serve` fronts).
Dev mode (HMR + in-memory bundling + server reload): `bun run webgui:dev` (or
`bun --cwd=packages/webgui run dev`). Uses Bun's HTML router with `--hot
--no-clear-screen`; edits to `src/**/*.{ts,tsx,css}` rebuild in-memory (<30ms)
and HMR to the browser without a full page refresh or server restart. Edits to
`src/server/*.ts` reload in-place via Bun `--hot` without dropping the port or
clearing the terminal. Single-port design on `8081` keeps Tailscale serve and
WebSocket/API routing intact without cross-origin complications.
The production build uses `--splitting`; katex is a separate chunk fetched on the
first math token.
Tests: `bun --cwd=packages/webgui test` (284 across 27 files) and
 `bun --cwd=packages/coding-agent test test/rpc-registry.test.ts
 test/rpc-socket.test.ts test/rpc-model-config.test.ts
 test/rpc-model-roles.test.ts test/rpc-model-browser.test.ts
 test/rpc-model-source.test.ts test/rpc-agents.test.ts`.
Lint/types: `bun --cwd=packages/webgui run check`, `bun check` in
coding-agent. E2E: launch a fresh omp via `POST /api/launch {cwd}` (an omp
started before the RPC change does not know the new commands), then drive
its socket; `scripts/attach.ts` prints raw frames.
Verified topology: M1 Air thin client over ssh controls tmux on the M5 Pro
host; phone attaches to the same sessions through the daemon over Tailscale.

## Design (as built)

- One component tree, responsive by CSS only. Breakpoints in
  `src/lib/layout.ts` and as literal px in media queries: 720 (sidebar
  appears), 1100 (inspector appears). Under 720 the sessions list is a
  full-page route; agents/info panels are full-page routes with a back
  button. Touch targets 44px; body text 15px; textarea 16px (iOS zoom).
  `@media (pointer: fine)` gates hover states and the connection label.
- Routes: `#/` sessions, `#/s/<id>`, `#/s/<id>/agents`, `#/s/<id>/info`
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
  or `prompt_result { agentInvoked: false }`.
- Composer: auto-grow textarea, Send at rest; while busy the input-row
  button reads Steer or Queue (segmented control) and a separate Stop
  button appears. Enter submits only with a fine pointer. Slash
  autocomplete from `get_available_commands`. Image attach and paste,
  sent as `images` on prompt/steer/follow_up.
- Status strip: two-group layout (`.ss-group--left`, `.ss-group--right`)
  with space-between. Model name truncates via ellipsis; compact spacing;
  pulsing dot indicator for streaming/compacting; tools toggle pinned right.
- Top bar: title button toggles Info panel where full title is readable;
  connection dot opens popover with live state, instance ID, and reconnect;
  subagents button with Bot icon and count badge on far right.
- Toasts: deduplicated by message, capped to 3 active, auto-dismissed
  (8s error, 4s info). Dismiss button uses Lucide X.
- Subagents: fetched on attach, updated live via `subagent_lifecycle` and
  `subagent_progress` frames, and re-fetched on turn completion. Root agents
  render top-level even when carrying a parent tool call ID (`call_...`).
- Sessions UI: "New" button replaced with prominent 44×44px `+` toggle.
- Live session shutdown uses RPC `shutdown` command (implemented in `rpc-server.ts`)
  with safe error handling against older omp processes.
## Open

- Verified on a real iPhone in home-screen (standalone) mode: composer
  clears the home indicator at rest and sits on the keyboard when focused.
  Keyboard ergonomics resolved. Not yet observed: scroll performance on long
  transcripts, steer/abort mid-turn by touch.
- iOS standalone facts learned the hard way (see HISTORY.md): do not use
  `viewport-fit=cover`; `display-mode: standalone` did not match; the
  daemon must send `Cache-Control: no-cache` on `index.html` or the
  home-screen app keeps a stale bundle indefinitely.
- Entry bundle is ~590KB after splitting katex out. No analysis yet of
  what remains (likely lucide-react, tool views, pi-utils).
- The TUI's `※ recap` developer message did not appear in the transcript
  in one observed session; developer rows render when present in
  `get_messages`, so the frame may not be included by the RPC. Unverified.
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
- `config_update` reaches only the connection that issued the mutation.
  A second browser tab, or the TUI hub, does not push into this one
  (TASK.md D3).
- Two E2E-caught bugs fixed 2026-09-23: session-only clear
  (`persist:false, selector:null`) wiped the persisted role; selectors
  carrying `:level` were stored as `:low:low`. Regression tests in
  `test/rpc-model-roles.test.ts`.
- Subagent tree renders flat-with-indent from `parentToolCallId`; Horizon B
  design has not started.

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
- Launch (contract H): `tmux new-window -t 0: -c <cwd> -P -F '#{window_id}'
  -- fish -C 'omp'`; resume adds `--resume <id>`. `omp` is the fish
  function in `~/.config/fish/functions/omp.fish`.
- Shutdown is RPC `shutdown`; never `kill-window`.
