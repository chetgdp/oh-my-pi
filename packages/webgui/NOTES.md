# Working notes: item 4, UI/UX across surfaces

Updated 2026-09-21 (late). The presentation layer was rewritten from the
ground up (HISTORY.md, "Presentation rewrite"). This file records how to run
it, what exists, and what is open.

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

Daemon: `bun run webgui:build && bun run webgui` (serves `dist/` on
`127.0.0.1:8081`, the port `tailscale serve` fronts). Dev with the Bun HTML
bundler: `bun --cwd=packages/webgui run dev`. `HOST`/`PORT` env override;
use a different port for local testing so the phone endpoint is undisturbed.
The build uses `--splitting`; katex is a separate chunk fetched on the first
math token.

Tests: `bun --cwd=packages/webgui test` (185 across 21 files) and
`bun --cwd=packages/coding-agent test test/rpc-registry.test.ts
test/rpc-socket.test.ts`. Lint/types: `bun --cwd=packages/webgui run check`.

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
  expand), dividers and markers. A submitted prompt renders immediately as
  a pending row until the session echoes it (`pendingUser` in
  `transcript-model.ts`).
- Composer: auto-grow textarea, Send at rest; while busy the input-row
  button reads Steer or Queue (segmented control) and a separate Stop
  button appears. Enter submits only with a fine pointer. Slash
  autocomplete from `get_available_commands`. Image attach and paste,
  sent as `images` on prompt/steer/follow_up.
- Status strip (TUI status-line parity): model, thinking, cost, tokens,
  streaming state, expand-all toggle. Model/thinking open pickers.
- Store snapshot carries `stats` (`get_session_stats`, debounced refresh
  after turn_end/agent_end) and `commands`. Resync swaps state
  atomically and re-fetches subagents instead of blanking.
- Errors from commands and fetches go to `notify()` and render as toasts;
  reconnecting/closed shows a banner.

## Open

- Verified on a real iPhone in home-screen (standalone) mode: composer
  clears the home indicator at rest and sits on the keyboard when focused.
  Not yet observed: scroll performance on long transcripts, steer/abort
  mid-turn by touch, the cwd input on the New Session page under the
  keyboard (`.sh-panel-overlay` is `position: fixed; inset: 0` without the
  viewport offset).
- iOS standalone facts learned the hard way (see HISTORY.md): do not use
  `viewport-fit=cover`; `display-mode: standalone` did not match; the
  daemon must send `Cache-Control: no-cache` on `index.html` or the
  home-screen app keeps a stale bundle indefinitely.
- Entry bundle is ~590KB after splitting katex out. No analysis yet of
  what remains (likely lucide-react, tool views, pi-utils).
- The TUI's `※ recap` developer message did not appear in the transcript
  in one observed session; developer rows render when present in
  `get_messages`, so the frame may not be included by the RPC. Unverified.
- No test covers the dev-mode routing fix in `src/server/index.ts`.
- Git branch is not in RPC state; the status strip omits it.
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
