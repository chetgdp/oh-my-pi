# Web GUI history

Dated, append-only record of what shipped.

## 2026-09-21

Waves A-C landed: the full stack from RPC-beside-TUI in the coding-agent
through the daemon relay to the browser client, with 120 tests across 19
files (unit + integration).

### omp RPC beside the TUI (`packages/coding-agent`)

- `src/modes/rpc/rpc-server.ts`: `serveRpc` -- the protocol body extracted
  from `runRpcMode`. Per-connection `RpcFrameEncoder`, `RpcOutputWriter`,
  dispatcher, pending-request map, `RpcSubagentRegistry`,
  `session.subscribe` listener; unsubscribes on input EOF. Options:
  `onReady`, `onShutdown`, `onWriteFailure`. Returns `RpcServerHandle`
  (`{ closed, close }`).
- `src/modes/rpc/rpc-mode.ts`: `runRpcMode` is now a thin stdio wrapper
  that calls `serveRpc` with `claimRpcInput()` / `process.stdout`. It
  uses `onReady` to install extension UI context and call
  `initializeExtensions`.
- `src/modes/rpc/rpc-registry.ts`: `publishRpcHost`, `listRpcHosts`,
  `readRpcHost`. Registry dir `~/.omp/run/rpc-hosts/`, one JSON file per
  process (mode 0600, temp+rename), 32-byte hex bearer token,
  `sun_path` overflow fallback.
- `src/modes/rpc/rpc-socket.ts`: `startRpcSocketServer` -- `net.Server`
  on the registry endpoint. Auth line contract (C), then `serveRpc` per
  connection. `RpcServeFn` type alias for the injected `serveRpc`.
- `src/modes/rpc/rpc-serve-controller.ts`: `RpcServeController` -- the
  interactive-mode hook. Starts/stops the socket server, calls registry
  `update` on session change.
- `src/config/settings-schema.ts`: `rpc.serve` (boolean, default false,
  Interaction tab, Collab group).
- `src/main.ts`: lazily imports `serveRpc` only when `rpc.serve` is on;
  passes it to `InteractiveMode.init({ rpcServe })`.
- Tests: `test/rpc-registry.test.ts`, `test/rpc-socket.test.ts`.

### Daemon (`packages/webgui/src/server/`)

- `index.ts`: `createServer`, route dispatch.
- `live.ts`: `GET /api/live` -- registry walk, strips `token`/`endpoint`.
- `past.ts`: `GET /api/past`, `GET /api/past/:id` -- list and preview.
  Accepts a session id or a file path; ids resolved across all projects.
- `launch.ts`: `POST /api/launch`, `POST /api/past/:id/resume` -- tmux
  new-window per contract H (`fish -C 'omp ...'`).
- `tmux.ts`: argv builder for tmux commands.
- `shutdown.ts`: `POST /api/live/:instanceId/shutdown` -- connects to the
  RPC socket, sends `shutdown`, waits for close.
- `relay.ts`: `GET /ws/:instanceId` -- WebSocket-to-Unix-socket relay,
  auth line (C), bytes copied verbatim both ways.
- `static.ts`: serves `dist/`, SPA fallback, path-traversal guard.
- `options.ts`: `HOST`/`PORT` env binding.
- Scripts: `serve`, `dev` (`WEBGUI_DEV=1`), `build`,
  `attach` (`scripts/attach.ts`).
- Root scripts: `webgui` (`bun --cwd=packages/webgui run serve`),
  `webgui:build`.

### Browser (`packages/webgui/src/`)

- `App.tsx`: hash route `#/s/<instanceId>`.
- `main.tsx`: entry point.
- `lib/rpc-client.ts`: WebSocket transport, reconnect with backoff,
  `onResync` callback for state replacement after reconnect.
- `lib/session-store.ts`, `lib/transcript-model.ts`,
  `lib/subagent-model.ts`, `lib/session-actions.ts`,
  `lib/sessions-api.ts`: client-side state and API wrappers.
- `lib/dom.ts`: browser global accessors (`document`, `window`) for
  type-safe use without the DOM lib.
- `browser-globals.d.ts`: ambient declarations for browser APIs not
  covered by bun-types.
- `components/shell/AppShell.tsx`, `components/shell/HeaderBar.tsx`,
  `components/shell/Composer.tsx`, `components/shell/SessionList.tsx`.
- `components/transcript/Transcript.tsx`.
- `components/agents/AgentDrawer.tsx`.

### Tests

120 tests across 19 files: `test/live.test.ts`, `test/past.test.ts`,
`test/launch.test.ts`, `test/tmux.test.ts`, `test/shutdown.test.ts`,
`test/relay.test.ts`, `test/static.test.ts`, `test/endpoints.test.ts`,
`test/rpc-client.test.ts`, `test/session-store.test.ts`,
`test/transcript-model.test.ts`, `test/subagent-model.test.ts`,
`test/session-actions.test.ts`, `test/sessions-api.test.ts`.
Coding-agent side: `test/rpc-registry.test.ts`,
`test/rpc-socket.test.ts`.

### Decisions made during implementation

a. `serveRpc` takes an `onReady` callback (`RpcServeOptions.onReady`)
   that receives the connection's internal `RpcExtensionUIContext` and
   pending-request plumbing. The stdio wrapper (`runRpcMode`) uses it to
   install extension UI context and call `initializeExtensions`. Socket
   connections omit `onReady`, so extension UI requests are never emitted
   to browser clients.

b. `serveRpc` is injected into `startRpcSocketServer` via
   `RpcSocketServerOptions.serve` (typed as `RpcServeFn = typeof serveRpc`)
   and lazily imported in `main.ts` only when `rpc.serve` is on. A static
   value edge from `interactive-mode.ts` to `rpc-server.ts` would create
   an import cycle: `interactive-mode.ts` -> `rpc-server.ts` ->
   `slash-commands/acp-builtins.ts` -> `builtin-registry.ts`
   (`BUILTIN_SLASH_COMMANDS_INTERNAL` evaluated at module scope, TDZ if
   the cycle has not finished). The injection via `rpc-socket.ts`
   type-only import (`import type { serveRpc }`) plus runtime parameter
   breaks the cycle.

c. The webgui package type-checks without the DOM lib because the
   coding-agent RPC type graph is only valid against bun-types (the
   tab-worker global `document` stub conflicts, `BodyInit` strictness
   differs). Browser globals are accessed through `src/lib/dom.ts`
   (runtime accessors) and `src/browser-globals.d.ts` (ambient type
   declarations for APIs not in bun-types).

d. `GET /api/past/:id` and `POST /api/past/:id/resume` accept either a
   session id or a file path. Ids are resolved across all projects
   (`resolvePastSessionPath` in `src/server/past.ts`).

e. `rpc.serve` lives in the Interaction tab, Collab group
   (`src/config/settings-schema.ts`). No `TAB_GROUPS` change was needed.

### E2E on the host (T23), local surface only

Daemon on `127.0.0.1:18081`, managed Chromium at 390x844, omp started via
`POST /api/launch` into tmux session 0.

Verified: live/past listing separated in the switcher; attach shows the
transcript identical to `tmux capture-pane`; prompts from the browser stream
in both clients; launch returns `{windowId, instanceId}` in under 1 s and the
entry appears in `/api/live`; resume of a past session by id opens a new
window and shows history via `get_messages`; shutdown returns 204, the omp
process exits, the tmux window survives with a fish prompt; daemon restart
with the tab open reconnects in about 8 s with the transcript intact; no
horizontal overflow at 390 px.

Not verified here: phone over Tailscale, iOS keyboard inset, steer/abort
mid-turn (short answers finished before intervention), network-level drops.

Defects found by the run and fixed:

- `serveRpc().close()` called `cancel()` on the still-locked input stream;
  the unhandled rejection took the whole omp process down whenever a socket
  client disconnected (contract D). `rpc-server.ts`, regression test in
  `test/rpc-socket.test.ts`.
- Launch used `fish -c 'omp'`, so the window closed with omp (contract H).
  Now `fish -C`, which drops into an interactive shell afterwards
  (`packages/webgui/src/server/tmux.ts`).
- `tmux new-window -t 0` fails when window 0 exists; target is now `0:`.
- Composer imported the `ThinkingLevel` value from the pi-agent-core barrel,
  which pulled bun-only modules into the browser bundle; it now imports the
  leaf module `@oh-my-pi/pi-agent-core/thinking`.
- `import.meta.main` in `src/server/index.ts` did not pass the tmux runner,
  so `/api/launch` returned 500.
- JSX text used `\u` escapes literally in `SessionList.tsx`.

### Phone E2E over Tailscale (T23), verified

User-confirmed on the phone via the Tailscale-served daemon on 8081 after
enabling `rpc: serve: true` in `~/.omp/agent/config.yml`. Setup pitfall
recorded in NOTES.md: `~/.omp/agent/settings.json` is a legacy source and
is not read as live config.

### Task list as executed (waves A-D)

Moved here from TASKS.md when all 24 tasks landed. Anchors are symbol names
and line numbers in the 2026-09-21 tree at planning time; they may have
drifted. Contract letters refer to PLAN.md "Contracts".

## omp (`packages/coding-agent`)

### T1 serveRpc
- Files: `src/modes/rpc/rpc-mode.ts` → new `src/modes/rpc/rpc-server.ts`.
- Depends: none.
- Move the body of `runRpcMode` (~821-1725) into `serveRpc(session, transport, options)`. `transport = { input: ReadableStream<Uint8Array>; output: Writable }`. Per call: own `RpcFrameEncoder`, `RpcOutputWriter`, dispatcher, pending-request map, `RpcSubagentRegistry`, `session.subscribe` listener; unsubscribe on input EOF. Pull out of the body: `PI_NOTIFICATIONS` (~832), writer-failure `process.exit` (~835), `setToolUIContext` install (~1068), `initializeExtensions` (~1072), EOF `disposeAndExit` (~1724), `pi.shutdown` exit. Options carry `onShutdown`, `onWriteFailure`, `uiContext?`. Returns `{ closed: Promise<void>; close(): void }`.
- Check: `rpc-mode.ts` has no dispatch code left. Tests run in T2.

### T2 runRpcMode wrapper
- Files: `src/modes/rpc/rpc-mode.ts`.
- Depends: T1.
- `runRpcMode` keeps its signature. Sets `PI_NOTIFICATIONS`, builds `RpcExtensionUIContext`, calls `initializeExtensions`, calls `serveRpc` with `claimRpcInput()` / `process.stdout`, exits on `closed` as before.
- Check: `test/rpc*.test.ts`, `test/modes/rpc-shutdown-persistence.test.ts`, `test/session/rpc-*.test.ts` pass unchanged. `omp --mode rpc`: `ready`, `get_state`, `prompt`, EOF → exit 0.

### T3 registry
- Files: new `src/modes/rpc/rpc-registry.ts`, `test/rpc-registry.test.ts`.
- Depends: B.
- `publishRpcHost(snapshot, opts) → { endpoint, token, update(snapshot), close() }`. `listRpcHosts(opts) → entry[]`. Copy from `collab/registry.ts` `publishCollabHost` (~419-510): entryId, 32-byte token, `resolveSocketEndpoint` + `sun_path` fallback, chmod, temp+rename, `process.once("exit")` cleanup. `update` rewrites the file atomically. Returns the endpoint path; does not open the `net.Server` (T4 does).
- Check: with `dir` override: file mode 0600; list returns it; `update` changes fields; dead pid pruned; long config root uses fallback dir.

### T4 socket server
- Files: new `src/modes/rpc/rpc-socket.ts`, `test/rpc-socket.test.ts`.
- Depends: T1, T3, C, D.
- `startRpcSocketServer(session, subagentEventBus, { onShutdown }) → { stop() }`. `net.createServer` on the registry endpoint, chmod 0600. Per connection: read one line, C, then `serveRpc(session, { input: Readable.toWeb(socket), output: socket }, { onShutdown, onWriteFailure: destroy socket })`. Track sockets. `stop()`: close server, destroy sockets, registry `close()`.
- Check: two clients get their own `ready` and responses; bad token → error frame + close; one client dropping leaves the other; `stop()` closes all.

### T5 interactive hook
- Files: `src/modes/interactive-mode.ts`, `src/config/settings-schema.ts`.
- Depends: T4, A, E.
- New `RpcServeController` next to `CollabController`: construct ~1349, start ~1645 when `rpc.serve`, `registerSessionChangeCallback` → registry `update`, stop at exit ~5648 and in `createSessionTeardown` ~1430. `onShutdown` → the same exit path `/quit` uses.
- Check: setting on → entry appears; `/new` → file rewritten, connection stays; quit → file and socket gone.

### T6 attach script
- Files: new `packages/webgui/scripts/attach.ts`.
- Depends: T5, B, C.
- Args: instanceId or pid, prompt text. Read registry, connect, C, `negotiate_protocol`, `get_state`, `prompt`; print frames until `agent_end`.
- Check: against omp in tmux: prompt shows in TUI, events print, both show the same answer.

## daemon (`packages/webgui`)

### T7 scaffold
- Files: `package.json`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/server/index.ts`, `test/`.
- Depends: none.
- Scripts from `collab-web/package.json` (`bun build ./index.html`, `oxlint`, `tsgo`). `private: true`. Import `../collab-web/src/*` read-only. Add to root workspace.
- Check: `bun run check`, `bun test`, `bun run build` → `dist/index.html`.

### T8 live endpoint
- Files: `src/server/live.ts`, `test/live.test.ts`.
- Depends: T3, T7, F.
- `GET /api/live` → `listRpcHosts` minus `token`, `endpoint`.
- Check: fixture dir → entries; dead pid omitted.

### T9 relay
- Files: `src/server/relay.ts`, `test/relay.test.ts`.
- Depends: T4, T7, C, F.
- `/ws/:instanceId`: look up endpoint, `net.connect`, send C, then pipe bytes both ways. Either side closes → close the other. Pause socket when `ws.getBufferedAmount()` exceeds a cap.
- Check: fake socket server that does C then echoes: WS gets `ready`, echo round-trips, server close → WS close.

### T10 past endpoints
- Files: `src/server/past.ts`, `test/past.test.ts`.
- Depends: T7, F.
- Port list/preview from `prototype/webgui-rpc-ui:packages/collab-web/src/server/rpc-bridge.ts` and `test/sessions.test.ts`.
- Check: prototype tests pass on fixture session files.

### T11 launch
- Files: `src/server/tmux.ts`, `src/server/launch.ts`, `test/tmux.test.ts`.
- Depends: T7, T8, F, H.
- `cwd` must be an existing dir else 400. Run H with `Bun.$`, return `windowId`. Poll `listRpcHosts` up to N s for a new entry with that cwd; include `instanceId` if found.
- Check: argv builder matches H exactly; bad cwd → 400.

### T12 resume
- Files: `src/server/launch.ts`.
- Depends: T10, T11.
- Same as T11 with `--resume <id>`. Unknown id → 404.
- Check: argv test; 404.

### T13 shutdown
- Files: `src/server/shutdown.ts`, `test/shutdown.test.ts`.
- Depends: T8, C, D, F.
- Connect, C, send `shutdown`, wait for close or timeout, 204. No tmux.
- Check: fake server records the frame; unknown id → 404.

### T14 static + dev
- Files: `src/server/index.ts`, `src/server/dev.ts`.
- Depends: T7, G.
- Serve `dist/`, SPA fallback, reject paths that resolve outside `dist`. Dev mode via Bun HTML bundler. Bind per G. Route `/api/*`, `/ws/*`.
- Check: `/` → index; `/../etc/passwd` → 404; routes reach T8-T13, T9.

### T15 endpoint tests
- Depends: T8-T14.
- One `Bun.serve` test hitting every route with T3/T10 fixtures.
- Check: `bun test` green.

## browser (`packages/webgui`)

### T16 rpc client
- Files: `src/lib/rpc-client.ts`, `test/rpc-client.test.ts`.
- Depends: T7, F.
- WebSocket transport. Frame codec from `coding-agent/src/modes/rpc/rpc-frame.ts`. On open: `negotiate_protocol`, `get_state`, `get_messages`. Request ids, event stream, connection state. Types from `rpc-types.ts`.
- Check: fake WS: attach sequence, response by id, events, close state.

### T17 transcript
- Files: `src/components/transcript/*`.
- Depends: T16.
- Map `get_messages` + streaming events to collab-web `Transcript`, `Markdown`, `tool-render` props.
- Check: fixture renders text, tool card, streaming message.

### T18 subagents
- Files: `src/components/agents/*`.
- Depends: T16.
- Feed RPC subagent frames to collab-web `AgentDrawer`.
- Check: fixture with two subagents renders both.

### T19 composer
- Files: `src/components/shell/Composer.tsx` (from prototype).
- Depends: T16.
- prompt, steer, follow-up, abort; `get_available_models`, `set_model`, `set_thinking_level`.
- Check: each control sends the right command to a fake client.

### T20 session list
- Files: `src/components/shell/SessionList.tsx` (from prototype `SessionSwitcherModal.tsx`).
- Depends: T8, T10-T13, F.
- Live section, past section. Live → attach. Past → resume. New → cwd input → launch. Shutdown with confirm.
- Check: mocked fetch; sections render; actions hit the right routes.

### T21 reconnect
- Files: `src/lib/rpc-client.ts`.
- Depends: T16, T9.
- On close: backoff, reconnect, rerun attach, replace state from `get_messages`.
- Check: fake WS drop mid-stream, reopen → state equals fresh attach.

### T22 phone layout
- Files: `src/styles/*`, `src/components/shell/shell.css` (from prototype).
- Depends: T17, T19, T20.
- Viewport, keyboard inset, scrollback, header with session name and switcher.
- Check: browser at 390x844: no horizontal overflow; composer above keyboard.

## ops

### T23 phone e2e
- Depends: T5, T9, T15, T20, T21.
- Build, run daemon in its tmux window, `rpc.serve` on, open via Tailscale: attach, prompt, steer, abort, new, resume, shutdown.
- Check: every bullet in PLAN "What it feels like when done (A)".

### T24 records
- Depends: T23.
- `HISTORY.md` entries with file pointers. `NOTES.md` rewritten for what is open.

## Waves

- A: T1, T3, T7, T10, T16, T22
- B: T2, T4, T8, T9, T11, T12, T13, T14, T17, T18, T19
- C: T5, T6, T15, T20, T21
- D: T23, T24


## 2026-09-21 (late): presentation rewrite

The browser client's UI layer was rebuilt. Transport (`rpc-client.ts`),
daemon, and the coding-agent RPC side are unchanged except one dev-mode
routing fix.

### Removed
- All imports from `packages/collab-web`. Copied and owned: Markdown
  (`components/transcript/Markdown.tsx`), tool views
  (`components/transcript/tool-views/`), `styles/tokens.css`, `styles/base.css`.
- `components/shell/{Composer,SessionList,HeaderBar}.tsx`,
  `session-list.css`, `components/agents/AgentDrawer.tsx` and their tests.

### Added
- `lib/route.ts` (`parseRoute`/`routeHash`/`navigate`), `lib/notify.ts`
  (toast store), `lib/layout.ts` (breakpoints), `lib/session-groups.ts`
  (past-session grouping by project and day, display-name fallback).
- `components/shell/{AppShell,TopBar,StatusStrip,ConnectionBanner,Toasts}.tsx`;
  responsive grid in `shell.css` (`minmax(0,1fr)` columns; 720/1100 px).
- `components/composer/{Composer,ModelPicker,ThinkingPicker,SlashAutocomplete,useComposerKeyboard}`.
- `components/sessions/{SessionsScreen,SessionRow,NewSession}.tsx` with
  cancellable polling and refresh on visibility.
- `components/transcript/Transcript.tsx` virtualized with
  `@tanstack/react-virtual`; rows under `components/transcript/rows/`.
- `components/agents/{AgentsPanel,AgentRow}.tsx` with tree indentation from
  `parentToolCallId`.
- Store: `stats` and `commands` in `SessionSnapshot`; `echoUser()` for the
  pending prompt row; atomic resync. `transcript-model.ts`: developer rows,
  `prependEntries`, `pendingUser`, stream cleared on assistant
  `message_end`. `session-actions.ts`: stats/commands/messages-page/
  subagents helpers; data-URL to `ImageContent` conversion.
- Build: `--splitting`; katex is loaded with `import()` on the first math
  token (entry 0.60 MB + 0.27 MB katex chunk, was one 0.88 MB file).
- `src/server/index.ts`: dev mode no longer shadows `/api/*`, `/ws/*`,
  `/healthz` with the HTML catch-all.

### Defects found by driving a live session and fixed
- Shell grid used `1fr`, so the top bar's min-content width pushed the
  whole layout to 416 px at a 390 px viewport.
- Title showed the raw instanceId; now session name, else cwd basename
  (from `/api/live`), else instanceId.
- Sessions sheet stayed open after hash navigation; routing now owns it.
- User prompt was invisible until the session echoed it (several seconds);
  now echoed locally.
- Tool card rendered twice between assistant `message_end` and
  `turn_end` because the stream was retained alongside the committed entry.
- Composer images were dropped by `App.handleSend`.
- Expand-all toggle only seeded per-card state; now authoritative until a
  per-card tap overrides it.
- `lazy()` around the whole Markdown component deferred all Markdown, and
  without `--splitting` Bun inlined the import anyway.

### Verification
Headless Chromium at 390, 820, and 1280 px against a live tmux session:
no horizontal overflow at 390 px; pending prompt visible within 0.7 s;
streaming text grows every 250 ms; single tool card while running; model
picker; expand-all; katex chunk fetched only after a math message.
`bun run check` clean; 185 tests across 21 files.

Test approach note: a subagent's first composer test used happy-dom plus
React fiber internals and mutated globals; replaced with pure-function
tests (`enterSubmits`, `resolveSendMode`, `matchingCommands`) and SSR
assertions. `happy-dom` was removed again.

## 2026-09-21 (late): iPhone home-screen mode

Reported: in standalone mode the composer sat under the home indicator and
focusing it scrolled the whole app off the top. Fixed by iteration against
the device; each step below was tried and observed.

- `viewport-fit=cover` (to get `env(safe-area-inset-bottom)`) moved the
  layout viewport origin to the screen top without growing it, leaving a
  status-bar-height hole under the composer regardless of
  `apple-mobile-web-app-status-bar-style`. Removed. Home-indicator
  clearance is a fixed 42px on `.cmp-composer`, gated by
  `html[data-standalone="true"]` set in `main.tsx` from
  `navigator.standalone` / `display-mode: standalone` (the media query
  alone did not apply on the device), and suppressed while
  `data-keyboard="true"`.
- `apple-mobile-web-app-capable` is required: with a non-Safari default
  browser, a home-screen bookmark without it opens in that browser.
- `.sh-app` is `position: fixed; top: 0; bottom: 0`. `useViewportHeight`
  (`App.tsx`) applies `visualViewport` height/offset and sets
  `data-keyboard` only while a textarea/input has focus; iOS misreports
  `visualViewport` at rest in standalone mode.
- `src/server/static.ts`: `Cache-Control: no-cache` on `index.html`,
  `immutable` on hashed assets. The home-screen app had been serving a
  stale bundle across several attempts.

## 2026-09-21 (late): status strip spacing, stuck stream fix, session shutdown, top bar refinement

- **Stuck streaming and thinking state:** `SessionStore` retained initial `sessionState.isStreaming = true` across turn completion because `agent_end` did not update `sessionState`. Fixed by resetting `isStreaming: false` on `agent_end` and re-fetching state on completion/config events.
- **Status strip mobile overflow:** Redesigned into left and right groups with `justify-content: space-between`. Truncated model name with ellipsis, removed redundant `tok` suffix, added pulsing indicator dot, and pinned the tools toggle to the right. Total width fits 375px+ screens without clipping.
- **Live session shutdown:** Added `shutdown` command handling in `rpc-server.ts` and `rpc-types.ts`, triggering graceful interactive mode exit. Updated `shutdown.ts` to handle response frames and reduced socket timeout to 5s. Added `idleTimeout: 30` to `Bun.serve`.
- **Top bar polish:** Tapping title now toggles the Info sheet (which displays the full un-truncated title). Tapping the connection dot opens a popover showing connection details and a manual reconnect button instead of firing toasts. Subagents button moved to the far right using a `Bot` icon with an active count badge.
- **Toast hardening:** Fixed raw `\u2715` escape to Lucide `X`, capped active toasts to 3, deduplicated repeated notices, and auto-dismissed error toasts after 8s.
