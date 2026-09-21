# Working notes: item 4, UI/UX on the phone

Updated 2026-09-21. Transport is proven end to end (PLAN "Where we are",
proof of concept). The user's verdict on the current interface: horrible.
This file gives the next session enough state to plan the redesign without
rediscovery. No redesign decisions have been made yet.

## Run it

Host config, `~/.omp/agent/config.yml` (nested YAML; `settings.json` in
that dir is a legacy migrate-and-archive source and is not live config):

```yaml
rpc:
  serve: true
```

Only omp processes started after the change publish. Verify with
`bun --cwd=packages/webgui run attach` (lists hosts; `--id <instanceId>
<prompt>` drives one).

Daemon: `bun run webgui:build && bun run webgui` (serves `dist/` on
`127.0.0.1:8081`, the port `tailscale serve` fronts). Dev with the Bun HTML
bundler: `bun --cwd=packages/webgui run dev`. `HOST`/`PORT` env override;
use a different port for local testing so the phone endpoint is undisturbed.

Tests: `bun --cwd=packages/webgui test` (120 across 19 files) and
`bun --cwd=packages/coding-agent test test/rpc-registry.test.ts
test/rpc-socket.test.ts`. Lint/types: `bun --cwd=packages/webgui run check`.

Verified topology: M1 Air thin client over ssh controls tmux on the M5 Pro
host; phone attaches to the same sessions through the daemon over Tailscale.

## Observed state of the current UI

Observed at 390x844 in headless Chromium (not iOS). Screenshots are not
kept in the repo.

Defects (facts, not a plan):

- Header shows the raw `instanceId`, not the session name or cwd.
- Live rows show the raw session UUID; the name is null because omp had
  not generated a title. cwd, model, pid are crammed into one truncated
  line.
- A large empty gray box (the collab-web transcript's empty/tail region)
  takes the top half of the session view above the messages.
- Messages are labeled HOST / AGENT in monospace caps; no bubbles, no
  timestamps, no tool cards visible in this short session.
- Composer is unstyled: one-line textarea at default browser size, a Send
  button below it, then two native `<select>` elements (model, thinking)
  side by side. Nothing indicates busy state at rest.
- Session sheet does not close when a session is chosen via hash change;
  it does close on tap-attach (`App.tsx:186-189` sets state) but the
  navigate-by-URL path leaves it open.
- Past list is a flat chronological dump, many near-duplicate titles
  ("Reply with exactly: pong" x4), no grouping by project or day.

Not yet observed on a real iPhone: keyboard inset behavior, safe-area
insets, scroll performance with long transcripts, steer/abort mid-turn.

## UI inventory (what exists today, file:line as of 2026-09-21)

### Routing and screens
- Only `#/s/<instanceId>` is a route (`src/App.tsx:35-44`); empty or other
  hash means no instance and opens the session list (`App.tsx:88-98`).
- With an instance, App builds `ws(s)://<host>/ws/<instanceId>`, creates a
  reconnecting `RpcWebClient`, subscribes to subagent events, creates the
  `SessionStore`, requests models (`App.tsx:52-57,101-151`).
- Always renders `AppShell(HeaderBar, TranscriptView, Composer)` plus
  `AgentDrawer` and `SessionList` as overlays (`App.tsx:227-274`). React
  state: instanceId, list open, drawer open, model catalog
  (`App.tsx:79-84`). Everything else comes from the store snapshot
  (`App.tsx:157-180`; `src/lib/session-store.ts:20-30`).

### Components
- `AppShell` (`components/shell/AppShell.tsx:3-16`): three-row grid
  `sh-app` / `sh-transcript` / `sh-composer`.
- `HeaderBar` (`components/shell/HeaderBar.tsx:4-25`): title, optional
  subtitle, connection dot (title attr only), Menu button "Open sessions".
- `Composer` (`components/shell/Composer.tsx`): 1-row textarea (`:66-74`);
  when busy a Steer/Follow-up select + Abort (`:76-98`); Send/Steer/
  Follow-up button (`:100-110`); always-present model and thinking
  `<select>`s (`:112-130`). Enter submits (`:48-64`). Commands issued via
  `src/lib/session-actions.ts:12-52`: `prompt`, `steer`, `follow_up`,
  `abort`, `set_model`, `set_thinking_level`.
- `SessionList` (`components/shell/SessionList.tsx`): bottom sheet. Live
  rows: attach button + two-tap Shut down/Confirm (`:55-74`). Past rows:
  resume button with name/first message/id, cwd, relative time (`:76-91`).
  New: cwd text input + Start (`:93-104`). Loads `listLive` and
  `listPast({all:true})` once on open, no refresh interval (`:141-157`).
  Launch/resume poll `listLive` every 2 s up to 20 s when the API returned
  no instanceId (`:174-241`). REST wrappers in `src/lib/sessions-api.ts:29-66`.
- `Transcript` (`components/transcript/Transcript.tsx:7-22`): thin adapter
  to collab-web `Transcript` with phase `live`.
- `AgentDrawer` (`components/agents/AgentDrawer.tsx:12-30`): aside dialog
  wrapping collab-web `AgentsPanel`, `selectedId={null}`, no-op `onSelect`.
  Toggled by a glyph button in App (`App.tsx:236-242`).

### Styling
- Entry CSS: collab-web `tokens.css` + `base.css` imported twice
  (`src/main.tsx:3-5` and `src/styles/app.css:1-6`); `shell.css` and
  `session-list.css` are ours.
- `shell.css:3-10,79-87`: grid rows auto/1fr/auto, height
  `var(--viewport-height, 100dvh)`, `env(safe-area-inset-*)` on header and
  composer (`:16-17,105-106`). Only media query is reduced-motion
  (`:111-115`). No width breakpoints.
- `session-list.css:3-22`: fixed backdrop, bottom-aligned sheet, max-width
  420px, max-height 80vh.
- Tokens (`--bg --fg --border --accent --ok --warn --err`) come from
  collab-web `tokens.css:1-97` (dark default, light via class or
  prefers-color-scheme). Some literal fallbacks in `session-list.css`.

### Reuse from collab-web (read-only)
- `Transcript` (rows, Markdown, collapsed thinking, image thumbnails,
  ToolCard, tail-follow): `collab-web/src/components/transcript/Transcript.tsx`.
- `AgentsPanel`: `collab-web/src/components/agents/AgentsPanel.tsx`.
- `ActiveTool` type from collab-web client types
  (`src/lib/transcript-model.ts:12`).
- Per PLAN fixed decision: anything we need to change gets copied into
  webgui, not edited in collab-web.

### Client state
- `SessionSnapshot`: connection, transcript, subagents, RPC session state,
  streaming (`src/lib/session-store.ts:20-30,42-79`). Resync after
  reconnect replaces transcript and resets subagents to empty (`:72-76`).
- `transcript-model.ts`: initial `get_messages` maps user/assistant/
  toolResult; developer and unknown roles dropped (`:100-137,155-168`).
  Assistant content keeps text/thinking/redactedThinking/toolCall, drops
  the rest (`:40-63`). Event reducer handles agent_start/end, message
  start/update/end, turn start/end, tool execution start/update/end;
  unknown events ignored (`:171-269`).
- `subagent-model.ts`: flat map by id, pending/running -> running,
  completed -> parked (`:17-29,41-125`); projection is flat, no tree
  (`:131-151`).
- `rpc-client.ts`: 30 s request timeout, 1 MiB frame / 64 MiB reassembly
  caps (`:80-82,190-191,356-365`), reconnect backoff (`:505-523`).

### Rough edges in code
- No loading/empty/error screen while attaching; connection and model
  fetch failures are swallowed (`App.tsx:101-157`), so the model select can
  render empty.
- Command promises (send/abort/model/thinking) are not observed; errors
  are invisible to the user (`App.tsx:191-214`).
- Launch/resume poll loops are fire-and-forget, uncancelled, and a failed
  `listLive` inside them is uncaught (`SessionList.tsx:191-241`).
- Accessibility: status dot title-only, no dialog role or focus trap on
  sheet/drawer, no labels on textarea and selects.
- Subagent subscription happens twice (`App.tsx:122-123`;
  `rpc-client.ts:419-420`).

## Known gaps carried over
1. Extension UI requests never reach the browser (socket connections omit
   `onReady`); `ask.enabled=false` on this host. By design.
2. Webgui cannot use the TS DOM lib (RPC type graph is bun-types only).
   Browser globals go through `src/lib/dom.ts` and
   `src/browser-globals.d.ts`.
3. Changing the daemon port requires updating `tailscale serve`.
4. Horizon B (swarm navigation) untouched.

## Discovery and tmux facts
- Registry `~/.omp/run/rpc-hosts/`, one JSON per process; `listRpcHosts`
  prunes dead pids.
- Launch (contract H): `tmux new-window -t 0: -c <cwd> -P -F '#{window_id}'
  -- fish -C 'omp'`; resume adds `--resume <id>`. `omp` is the fish
  function in `~/.config/fish/functions/omp.fish`.
- Shutdown is RPC `shutdown`; never `kill-window`.
