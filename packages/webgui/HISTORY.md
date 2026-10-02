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

## 2026-09-21 (late): subagent tree rendering, new session button, shutdown error handling

- **Subagents panel empty on active runs:**
  1. `AgentsPanel.tsx` filtered root agents strictly with `if (!node.snapshot.parentId)`. Top-level subagents spawned from the main session carry `parentToolCallId` (`call_...`), which caused them to be excluded as roots. Fixed to classify an agent as a root when its `parentId` is not present in the agent tree.
  2. `SessionStore` (`src/lib/session-store.ts`) omitted `fetchSubagents()` on initial attach and turn completion (`turn_end`/`agent_end`). Added initial and turn-end queries to sync active and completed subagents.
- **Sessions screen header:** Replaced text "New" button with a 44×44px `+` button in `SessionsScreen.tsx` (and styled in `sessions.css`), which flips to `×` when the creation form is active.
- **Graceful shutdown error handling:** Wrapped `shutdownLiveSession` in `src/server/shutdown.ts` with try/catch to return a clean 500 Response instead of crashing Bun with an unhandled rejection when stopping an older omp process.

## 2026-09-22: slash command support in webgui

- **`command_output` frame handling:** `transcript-model.ts` now handles
  `command_output` frames from the RPC server, rendering them as developer
  (system) rows in the transcript. Previously these were silently dropped.
- **`prompt_result` frame handling:** `transcript-model.ts` clears the
  optimistic `pendingUser` bubble on `prompt_result { agentInvoked: false }`,
  preventing stuck user messages when a slash command executes locally.
- **App.tsx prompt cleanup:** `handleSend` clears `pendingUser` when the
  prompt response indicates non-agent work or on send failure.
- **`session_info_update` frame:** `session-store.ts` re-fetches session
  state on `session_info_update` (title changes from `/rename`, `/new`).
- **`/new` and `/clear` text-mode handlers:** Added headless `handle`
  implementations in `builtin-lifecycle.ts` so these commands execute over
  RPC instead of falling through to the LLM as prompt text.
  `/new` calls `session.newSession()`, `/clear` calls
  `session.resetSessionContext()`.
- **RPC frame types:** Added `RpcCommandOutputFrame`,
  `RpcSessionInfoUpdateFrame`, `RpcConfigUpdateFrame` to `rpc-types.ts`
  and included them in `RpcSessionEventFrame`.
- Tests: 194 across 21 files (webgui), 88 across 1 file (acp-builtins).

## 2026-09-22: model roles and agent model assignment

- **RPC (`packages/coding-agent`):** `get_model_roles`, `set_model_role
  { role, selector | null }`, `get_agents`, `set_agent_model { agent,
  selector | null }`; `set_model` accepts `persist` and `thinkingLevel`.
  Builders in `src/modes/rpc/rpc-model-config.ts` reuse `getKnownRoleIds`,
  `resolveRoleModelFull`, `roleCandidatePool`, `discoverAgents`,
  `resolveAgentModelSelection`. Writes go through `Settings.setModelRole` /
  `settings.set("task.agentModelOverrides")` + `flush()`, so they get the
  same per-key merge against external edits as the TUI. `config_update`
  carries `modelRoles: true` / `agents: true` after mutations. Tests:
  `test/rpc-model-config.test.ts`.
- **Webgui:** route `#/s/<id>/models`; `components/models/` with
  `ModelsScreen` (roles with source badges global/project/fallback/active,
  agents with declared/override/effective model), and `ModelPickerSheet`,
  the single picker for active model (This session / Set as default),
  roles, and agent overrides. Replaces `composer/ModelPicker.tsx` and
  `ThinkingPicker.tsx`. Store carries `roles`/`agents`, refetched on
  `config_update`. Models button in the top bar.
- **Composer:** textarea height recomputed from a `text` effect, so it
  shrinks back after send (was stuck at the grown height).
- Verified against a fresh omp launched via `/api/launch`: role set/clear
  and agent override set/clear round-trip to `config.yml` and back into
  the UI via `config_update`; bad selector rejected with an error toast.
- Tests: 221 across 23 files (webgui), 16 across 2 files (rpc-model-config,
  rpc-socket).

## 2026-09-23: model-config parity (item 5, W0-W3)

- **Design (W0):** contracts I..N in PLAN.md. Per-capability commands, no
  generic settings write; no single `get_model_config` frame, instead
  `get_model_roles` / `get_agents` grew fields and `get_model_browser` was
  added. Active-model explanation is `RpcSessionState.modelSource`
  (`role | temporary | ephemeral | fallback`); context promotion has no
  public session state and is not reported. Login, fallback-chain editor,
  cross-client `config_update` push, and selector preview moved to
  TASK.md "Deferred" as separate features.
- **RPC (`packages/coding-agent/src/modes/rpc/`):** `success`/`errorResponse`
  moved to `rpc-response.ts`; handlers split into `rpc-model-config.ts`
  (`set_model_role {persist, storage}`, `delete_model_role`,
  `set_cycle_order`, `set_model_tag`, `cycle_role_model`, `buildModelRoles`
  with `provenance`/`custom`/`autoSelected`/`tag`/`cycleOrder`/`modelTags`),
  `rpc-model-browser.ts` (`get_model_browser`, `refresh_models`),
  `rpc-agents.ts` (`buildAgents` with `serviceTier`/`prewalk`/`advisor`/
  `isDefaultTaskAgent`/`precedence`; `set_agent_enabled`,
  `set_agent_service_tier`, `set_agent_prewalk`, `set_agent_advisor`).
  `AgentSession.modelSource` getter plus `SessionManager.
  getLastModelChangeEntry()`. Default-role writes mirror the TUI hub's
  shadowing rules (`selector-controller.ts` `onAssign`/`onUnassign`).
  `resolveRoleAssignments` is imported read-only from
  `@oh-my-pi/pi-tui/overlays/model-browser`; nothing moved out of the TUI.
  Tests: `rpc-model-roles`, `rpc-model-browser`, `rpc-model-source`,
  `rpc-agents` (64 across 7 RPC files).
- **Webgui data (W2):** action wrappers for every command; store gains
  `browser`, `applyRoles`/`applyAgent`/`applyBrowser`, refetch on
  `config_update {models}` and on `model_changed`.
- **Webgui UI (W3):** `components/models/` rebuilt: `useModelsHub` hook
  (state + RPC), `ModelsScreen` with Active / Roles / Agents / Providers,
  `ActiveSection` (cycle Prev/Next, explanation line, streaming hint),
  `RolesSection` + `RoleRow` + `CycleOrderEditor` (scope badge, session-only
  provenance, auto badge, tags, new/delete custom roles), `AgentsSection` +
  `AgentRow` (enable switch, tier select, prewalk/advisor segments,
  precedence expander), `ProvidersSection` (auth/discovery, refresh),
  `ModelPickerSheet` rewritten on `RpcModelBrowserResult` (recent-first,
  role chips, TPS/TTFT, kind tabs, locked rows, scope row, keyboard + focus
  trap). Props contracts in `contract.ts`. `Composer` takes its own
  `ComposerModel` type. Tests: 284 across 27 files.
- **E2E:** fresh omp launched through the daemon; every new command driven
  over the socket. Caught and fixed: session-only clear wiped the persisted
  role; `:level` selectors double-suffixed; full catalog exceeded the 1 MiB
  frame cap (browser now lists authenticated providers' models plus
  referenced locked models). Hub rendered once headless at 390px.
- **Verification & Polish (W4):** human review pass completed.
  Desktop model hub capped at 900px with horizontal single-line role rows
  at >= 720px; fine-pointer 28px delete button on desktop. Added `auto`
  mode option to the model picker sheet thinking level options.
  Added official collab-web gradient favicon SVG to `index.html`.
  Fixed transcript auto-scroll snapping to bottom on newly submitted
  user messages. Enabled global `Ctrl+P` / `Shift+Ctrl+P` (and Cmd+P on macOS)
  shortcuts to cycle role models forward and backward over RPC.

## 2026-09-23: provider login from the phone (D1)

- **RPC (`packages/coding-agent/src/modes/rpc/rpc-login.ts`):**
  `get_login_status`, `login_start`, `login_input`, `login_cancel`,
  `logout` (contract O). `RpcLoginController` holds one flow per
  connection, maps `oauth.login` callbacks to `login_event` frames
  (`auth`/`progress`/`prompt`/`manual_input`/`done`/`failed`), always
  offers `onManualCodeInput`, aborts on `login_cancel` and on socket
  close. `BACKGROUND_COMMANDS` in `rpc-server.ts` adds the three login
  commands to the `bash` background path so the serial queue keeps
  flowing. Upstream `login` / `get_login_providers` untouched. Tests:
  `test/rpc-login.test.ts` (fake provider via `registerOAuthProvider`).
  `test/rpc-model-browser.test.ts` fake registry gained
  `hasConfiguredAuth`/`hasConcreteAuth` (was failing after the last
  upstream sync).
- **Webgui:** actions and `loginStatus`/`login` store slices driven by
  `login_event`; reconnect marks an in-flight login cancelled.
  `LoginSheet` (open sign-in page, copy link, progress, paste field for
  the dead redirect page's address, masked prompt input, cancel/done/
  failed states, focus trap). Locked provider rows and locked picker rows
  open it, replacing the "No API key" toast. Providers section lists
  stored accounts with a confirm-then-Log-out control. `lib/dom.ts` gained
  a clipboard typing.
- **E2E over the socket against a fresh omp:** status, pre-URL prompt
  answered, unknown requestId refused, `auth` with device code, duplicate
  start refused, cancel -> `failed {cancelled:true}`, loopback provider
  emits `manual_input`, `get_state` answered mid-login. Completed login
  and iPhone pass pending.
- Tests: 312 across 28 files (webgui); 17 across rpc-login + rpc-model-browser.

## 2026-09-24: settings changes reach every tab (D3)

- **RPC (`packages/coding-agent/src/modes/rpc/rpc-config-feed.ts`):**
  `subscribeConfigUpdates(settings, output)` listens to
  `Settings.onEffectiveChange`, maps the changed path to `modelRoles` /
  `agents` flags, gathers a burst in one microtask, sends one
  `config_update`. `serveRpc` subscribes per connection and unsubscribes
  in `cleanup()`. The TUI and every tab share one Settings object, so a
  change from any of them reaches all tabs.
- Command handlers in `rpc-model-config.ts` and `rpc-agents.ts` no
  longer send `config_update` and lost their `output` parameter.
  `models: true` (login, refresh) unchanged.
- Tests: `test/rpc-config-feed.test.ts` (direct `setModelRole`, agents
  path, burst, unrelated path, two subscribers, unsubscribe, one frame
  per handler call). Handler tests dropped their `config_update`
  asserts. `test/rpc-socket.test.ts` stub session gained
  `onEffectiveChange`.
- Live: fresh omp, two socket connections; `set_model_role` on A gave
  one `config_update` on both A and B.
- Real check: model changed in the TUI of a fresh omp showed up on the
  phone without reattach.
- Not covered: another omp process changing settings (file stays
  correct, this process shows the old value until it reloads); login
  done in the TUI (auth storage, not Settings).

## 2026-09-24: protocol v3 (history paging and streaming deltas)

Design in PIPELINE.md. The browser log is the saved session entries of the
current branch.

### omp (`packages/coding-agent`)

- `src/modes/rpc/rpc-v3-types.ts`: wire contract. Events `msg_start`,
  `block_start`, `delta`, `block_end`, `msg_end` (assistant streams only),
  `entry`, `branch {leafId}`, `tool_output {text, replace?}`; `history`
  command and result.
- `src/modes/rpc/rpc-v3.ts`: per-connection translator and `history`
  handler. Newest page first, limit 50 (max 200), `live` streams on the
  newest page, `branch_changed` only when `before`/`leafId` is off the
  current branch. Secrets restored at the boundary. `agent_end`/`turn_end`
  payloads stripped on v3.
- `src/modes/rpc/rpc-server.ts`, `rpc-frame.ts`, `rpc-types.ts`: `ready`
  lists `[1, 2, 3]`; `negotiate_protocol` accepts 3; the `history` answer
  is written in the snapshot tick. v1/v2 output unchanged.
- `src/session/session-manager.ts`: synchronous `onEntry` and
  `onLeafChange` listeners, notified on every leaf move.
- `test/rpc-v3.test.ts`.

### webgui

- `rpc-client.ts`: negotiates v3; `incompatible` state and the banner
  "This omp is too old, restart it" for older omp; `history()`.
- `transcript-model.ts`: v3 reducer; rows keyed by entry id, rows born live
  keep `live:<sid>`; frozen error/aborted rows survive `agent_end`.
- `session-store.ts`: newest page on attach, resync and branch; older pages
  on demand (`loadOlder`); halving retry on transport-limit errors.
- `Transcript.tsx`: scroll anchoring on prepend; memoized finished rows;
  virtualizer measures on the next animation frame (fixes the
  ResizeObserver loop error on expand/collapse all tools).
- Removed the `get_messages`/`message_update` transcript path and
  `getMessagesPage`.

Verified: webgui 337 tests, coding-agent `rpc-*`/`session-manager*` tests;
E2E against a fresh omp in headless Chromium at 390px (history load,
streaming, mid-stream attach in a second tab, incompatible banner on a
pre-v3 omp).

## 2026-09-24 (late): bug fixes from real use

Found by the user driving this session from the phone and desktop.

- **First word stutter** (`f36d1468aa`). pi-ai buffers the provider `start`
  event by reference during auth-retry (`packages/ai/src/stream.ts`
  ~1566), so it arrives already holding later deltas. `rpc-v3.ts`
  `#handleMessageStart` now sends `msg_start` with empty content; block
  frames carry all text. Upstream buffering left as is.
- **Queue** (`3813d41451`). RPC `abort {clearQueue?}` clears the queue
  before aborting (TUI Esc order) and returns the cleared messages; webgui
  Stop restores them into the composer. Pending rows hold `{text, images}`
  and match arriving user entries by text (oldest as fallback), which
  fixed a duplicated row after an out-of-order prompt and the missing
  image-only pending row. Relay decodes socket chunks as a UTF-8 stream
  but stays verbatim: an attempted line-splitting relay broke the
  handshake, because `rpc-client` splits on `\n` itself.
- **Scroll jump on history paging** (`d3a223191d`). Virtualizer had no
  `getItemKey`, plus a hand-rolled rAF scroll correction and first-measure
  corrections above the fold: 1500-1700px jumps per page and up to 14
  reverse kicks. Now `getItemKey`, `anchorTo: "end"` (tanstack handles iOS
  momentum), no first-measure correction above the viewport, prefetch at
  1500px. Verified on iPhone.
- **iOS one-tap send** (`d5c30a5c19`). Composer buttons cancel `mousedown`
  so the textarea keeps focus; the keyboard no longer closes and eats the
  first tap.
- **Busy state, lost prompts, revived subagents** (`7db19c5986`). A busy
  plain prompt got success and then an error the client dropped; now one
  immediate error, prompts carry `streamingBehavior: "steer"` (TUI
  parity), failed sends restore the draft (`rpc-client` `onLateError`).
  First attach never fetched `get_state`, so a reload mid-tool-call showed
  an idle composer; `turn_end` no longer clears `working`. Subagent
  snapshot state moved to one `RpcSubagentTracker` per process bus, so a
  reconnect sees running and revived agents; the turn-end refetch merges
  instead of replacing.

Verified: webgui 357 tests, coding-agent `rpc-*` 222; live repros on fresh
omps (session-only non-Antigravity models) in headless Chromium; phone
checks by the user for scroll, one-tap send, steer, queue, stop.

## 2026-09-24 (night): session controls, todos, GUI tmux

- Back arrow (`.tb-back`) shows at all widths.
- Session controls: rename by tapping the title (`session_info_update`
  frame on name change), rewind on user rows (`branch`), delete past
  sessions (`DELETE /api/past/:id`: 400 bad id, 404, 409 live), Retry
  button (`/retry` works over RPC).
- Todos: status strip progress, `#/s/<id>/todos` panel with tap to set
  (`set_todos` now persists a user-edit entry), transcript tree card;
  consecutive todo calls merge into one card keyed by the first call;
  tree rails continue through wrapped lines; completed tasks strike
  through.
- GUI launches go to tmux session `ompgui`, tagged `@ompgui`, and run
  `fish -C 'omp …; exit'` so the window closes with omp; `/api/live`
  reports `origin` and rows show a GUI badge.
- Stop restoring queued messages verified by the user.
- Fix: the rename hook threw on stub sessions without
  `onSessionNameChanged`, before `ready`; 4 `rpc-socket` tests timed out.
  Guarded in `rpc-server.ts`.
- `research/` untracked and git-ignored.

Verified: webgui 419 tests, coding-agent `rpc-*` 226; each feature live
in headless Chromium at 390px and 1280px; the user checked every item by
hand. Commits `2a13df5616`, `37ce60849b`.

## 2026-09-25: mermaid diagrams

- ` ```mermaid ` fences render as SVG (`Markdown.tsx`). mermaid loads on
  the first closed fence, like katex; results cache by source (max 100)
  and rows re-render when a diagram settles. Unclosed (streaming) and
  invalid fences show their source. `securityLevel: "strict"`;
  `suppressErrorRendering` stops mermaid appending its error SVG to
  `<body>`.
- Tap a diagram: `MermaidViewer.tsx`, full screen, `@panzoom/panzoom`
  loaded on open; pinch or wheel zoom, drag pan, close button or Esc.
  Pinch focal drift (148px) fixed by making the transformed stage fill the
  viewport; measured 2px after with CDP two-finger touch events.
- Entry bundle unchanged at 0.69MB; mermaid is ~1.5MB of lazy chunks.

Verified: webgui 419 tests; throwaway harness (valid, invalid, unclosed
fences) and live session at 390px in headless Chromium; the user checked
tap, zoom and pinch on the phone. Commit `dcf3a75793`.

## 2026-09-25: parity package 3 (touch and composer ergonomics)

- Copy button (`CopyButton.tsx`) on Markdown fences and on `CodeBlock`,
  `Output`, `DiffBlock`; diffs copy new-side text. Not on inline code.
- Prompt history (`lib/prompt-history.ts`): up/down buttons and
  ArrowUp/ArrowDown on the first/last caret line; unsent draft restored
  past the newest entry.
- Top bar session actions menu: Compact, Handoff, Clear context, New
  session, each behind a confirm. Clear sends prompt `/clear`, which RPC
  runs via the builtin `handle` (`resetSessionContext`).

Verified: webgui 455 tests; live omp at 390px in headless Chromium: copy
to clipboard, history recall and draft restore, clear context (3
messages dropped), new session, compact error toast. Handoff checked by
unit test only.

## 2026-09-25: top bar fixes

- Rename input 15px to 16px: iOS zoomed on focus and stayed zoomed.
- Connection popover anchors to the top bar's right edge (was the dot,
  so it ran off the left edge at 390px); capped at viewport width.

Verified: webgui 455 tests; popover on screen at 390px in headless
Chromium; the user confirmed both on the iPhone.

## 2026-09-25: iOS resume reload

- Cause of the visible hard reload on reopen: the daemon on 8081 ran in
  dev mode (`bun --hot`). Bun's HMR client reloads the page when its
  `/_bun/hmr` socket drops, which iOS does on every suspend. Dev mode
  also serves unbundled modules (the "many files"). Production
  (`webgui:build` + `webgui`) has no HMR socket.
- Reconnect no longer rebuilds the transcript: `resetTranscriptForResync`
  keeps saved row keys; live keys carry a connection epoch
  (`live:<epoch>:<sid>`) because sids restart per connection;
  `applyHistoryPage` reuses entry objects by id, keeps loaded older
  pages on the same branch, replaces only on branch change; the store
  emits once after the history settles.
- `ConnectionBanner` overlays the transcript (no layout shift) and shows
  connecting/reconnecting only after 1s; closed/incompatible at once.

Verified: webgui 472 tests; headless Chromium at 390px: closing the
session socket kept 21 of 22 row DOM nodes, no banner, same page;
closing `/_bun/hmr` navigated the page (the reported reload).

## 2026-09-26: usage screen and context indicator

- Status strip: context shown as `N% / window` (e.g. `1% / 1M`), was
  never rendered (read `{used,total}`, real shape `{tokens,
  contextWindow, percent}`); colours at 10/25/50% (user's thresholds,
  `lib/context-usage.ts`). Cumulative token total removed.
- RPC (coding-agent, `modes/rpc/rpc-usage.ts`): `get_usage_reports`
  (`raw` stripped, shared quotas collapsed, `active` computed
  server-side, `refresh` invalidates the UsageService cache, empty on
  failure), `get_reset_credits`, `redeem_reset_credit`; all off the
  serial command queue.
- Usage screen `#/s/<id>/usage` from the ⋮ menu: context bar, session
  tokens and cost, provider limits per account with percent and reset
  countdown, reset credits with a confirmed Redeem.

Verified: webgui 488 tests, coding-agent `rpc-*` 236; fresh omp at
390px in headless Chromium: strip `1% / 1M`, menu to usage screen,
Codex, Antigravity and Anthropic limits with reset times, Refresh, reset
credits listed; the user confirmed the screen after restarting omp.
Redeem not exercised live (spends a real credit).

## 2026-09-26: plan mode

- RPC (coding-agent, `modes/rpc/rpc-plan.ts`, `RpcPlanCoordinator`):
  `get_plan_state`, `set_plan_mode`, `approve_plan {reviewId, action:
  execute|compact|refine, feedback?}`; pushes `plan_state` on every
  change (TUI, phone or agent) and `plan_review` when a plan awaits
  approval, re-sent on attach, `null` once answered. Types in
  `rpc-types.ts`. Refused when `plan.enabled` is false; stale
  `reviewId` is an error.
- TUI-hosted sessions (every webgui session): the phone answer picks the
  matching choice in the TUI's own review overlay
  (`answerPlanReview`), so `InteractiveMode.#approvePlan` runs
  unchanged. First answer wins; the other side closes. Headless hosts
  compact with `internalGuidance`; compaction failure still executes,
  only cancellation skips. Agent-facing text in
  `prompts/system/plan-mode-{approved,refine}-result.md`.
- Webgui: plan chip in the status strip (hidden when unavailable or on
  hosts without the RPC), `components/plan/PlanReviewSheet.tsx` with
  rendered plan, Approve and execute / Approve and compact / Refine
  (16px textarea), 42px home-indicator clearance when standalone.
- Fix: silent aborts (plan approval, TTSR) rendered as "ABORTED
  `__omp.silent_abort__`" with Retry; `transcript-model.ts` now skips
  them via `@oh-my-pi/pi-ai/error/flags` (new export, ~2.5KB).
- Fix: older omp hosts raised "get_plan_state: Unknown command" on
  attach; now ignored.

Verified: webgui 514 tests, coding-agent `rpc-*` 325; live QA on fresh
sessions at 390px (4 parallel agents): execute, compact (32K to 24K then
executed), refine with and without text, TUI/phone toggle sync both
ways, answer in TUI closes phone sheet, reload and navigate-back restore
the sheet, mid-stream toggle, Esc during review; user confirmed execute
and compact on iPhone. Not exercised: plan model role switch (no `plan`
role configured), real iOS keyboard with the refine box.

## 2026-09-26: iOS zoom, connection banner, live session titles

- Every input, textarea and select computes >= 16px (base rule in
  `styles/base.css`; cwd input, model picker search, InfoPanel rename
  raised from 13-15px). User confirmed no focus zoom on iPhone.
- Fix: sessions list showed "WebSocket disconnected from host" with no
  session attached (`EMPTY_SNAPSHOT` is `closed`); `App.tsx` renders
  `ConnectionBanner` only when a store exists.
- Fix: live rows on the sessions list kept the title and model from omp
  startup. `RpcServeController` now rewrites the registry entry on
  rename, auto-title, model change and session switch; `startedAt` is
  fixed at controller start (it drifted on every rewrite). Registry
  write failures are logged, not thrown into those callbacks.
  `rpc-registry.ts` shares one temp+rename writer for publish and
  update. Regression test `test/rpc-serve-session.test.ts`.
- Fix: the sidebar kept the old title after a rename until the next
  session switch. `SessionsScreen` takes `currentSessionName` and shows
  it on the attached row at once (the registry poll runs every 10s), and
  reloads the list when it changes. Test `test/sessions-screen.test.tsx`.

Verified: webgui 515 tests, coding-agent `rpc-*` 250; user confirmed
the renamed title on the live list.

## 2026-09-26: sessions menu, live recaps

- `#/` shows only the sessions menu: no sidebar or inspector at any
  width. `AppShell` adds `sh-app--solo` (one grid column) when both side
  slots are absent.
- Registry entries carry `sessionFile`; older entries parse as `null`.
  Recaps are read with upstream `listSessionRecaps` from `session-index.ts`.
- `/api/live` adds `recap {text, createdAt} | null`: the latest recap,
  dropped once the session file mtime passes it (recaps never write the
  JSONL). `sessionFile` is stripped from the response. Test
  `test/live-recap.test.ts`.
- Live sessions: green label with count, green-tinted cards with a left
  strip, recap in an inset box; on desktop an equal-height card grid
  (min 320px columns) with a small Stop button. Past rows are flat,
  muted list lines.
- `※ recap` is a TUI status line, never a transcript entry (TASK item 6).

Verified: webgui 520 tests, coding-agent `rpc-*` 253; headless Chromium
at 1500px and 390px with a mocked `/api/live`. Not verified end to end
with a real recap on a live card.

## 2026-09-27: home-screen icon

- iOS showed a generic home-screen icon: `apple-touch-icon` pointed at
  `favicon.svg`, which iOS ignores. Added `apple-touch-icon.png` (180px,
  rendered from `favicon.svg` with square corners; iOS rounds them).

Verified: production build emits the PNG and the dev daemon serves it.
Not verified on an iPhone.

## 2026-09-27: status bar color, keyboard after re-add

- iOS status bar matches the top bar: `theme-color` metas in
  `index.html` per `prefers-color-scheme` (`#16111c` dark, `#ffffff`
  light), hex copies of `--bg-raised`; comment in `tokens.css`.
- Re-adding the home-screen app for the new icon left text fields
  focusable but the keyboard never appeared, home-screen app only. Not
  our code (keyboard path unchanged, bundle hashes identical across
  builds): WebKit bug 279904. Restarting the iPhone fixed it. Recorded in
  NOTES.md.

Verified by the user on iPhone: status bar color, typing after restart.

## 2026-09-27: parity re-audit, production build

- `parity.md` rewritten from a per-group re-verification against current
  code: 58 of 116 in-scope rows Done, 35 Partial, 23 Missing; a numbered
  83-item gap list to 100% (including 25 uninventoried items); 10 N/A
  rows listed separately and excluded from totals. PLAN item 6 points at it.
- Production build was broken: `bun build ./index.html` put a mermaid
  chunk in the script tag, so `dist` rendered a blank page. Replaced by
  `scripts/build.ts` (entry `src/main.tsx`, production React, katex
  dedupe plugin, generated `index.html` with `modulepreload`, build-time
  brotli/gzip, size log).
- `static.ts`: `serveStatic(req, distDir)`; serves `.br`/`.gz` by
  `Accept-Encoding` with `Vary`; direct `/index.html` no longer
  `immutable`; ETag/304 on `index.html`; direct `.br`/`.gz` URLs 404.
- Initial load 549KB raw / 136KB brotli (was 459KB of mermaid code with
  the app never loading; a correct old entry would have been ~800KB
  uncompressed).
- Tests: `test/build.test.ts` (runs the build in a subprocess; in-process
  `Bun.build` broke later dev-mode HTML bundling in the same process),
  `test/static.test.ts` extended.

Verified: webgui 543 tests serial and `--parallel`, `bun run check`;
production daemon on a spare port mounted the app in headless Chromium
with live sessions, entry served `br` + immutable, `/index.html`
`no-cache` + ETag. Not verified on an iPhone.

## 2026-09-27: plan mode leftovers verified

User confirmed live: the plan (Architect) role model switches on enter
and approve, and the refine textarea works with the real iOS keyboard.

## 2026-09-27: live recaps verified

User confirmed a real `※ recap` shows on a live session card end to end.

## 2026-09-27: mermaid ELK only on request

- Mermaid 12 defaults every diagram to the ELK layout, so the first
  diagram in a session fetched the 1.5MB (344KB brotli) elkjs chunk.
  `Markdown.tsx` now initializes mermaid with `layout: "dagre"` (12KB
  brotli chunk); diagrams with `layout: elk` or `flowchart-elk` still
  load ELK on demand. No agent-written diagram in 2,586 local session
  files asked for ELK.

Verified: webgui 543 tests, `bun run check`; production daemon in headless
Chromium: plain flowchart fetched the dagre chunk and not ELK, a
`layout: elk` diagram fetched ELK; rendered flowchart screenshot at 390px.
Not verified on an iPhone.

## 2026-09-28

Two upstream rebases (592, then 473 upstream commits), resolved
upstream-first. Our Opus 5.5 tool_choice rule, the Bun 1.3.14 legacy-pi
loader workaround, and the `<notation>` prompt tag rename were dropped
because upstream fixed the same problems. Adapted to upstream: `rpc.serve`
and the model/task settings moved to the new settings registry; upstream
prompt results, `session_settled`, `open_session`, event filter and
`messageId` ported into `rpc-server.ts`; `rpc-plan.ts` moved to the
registry (`cfgPlanEnabled`).

Fixed: queued messages cleared by Stop came back from omp but not into
the composer. `App.tsx` had lost `restoredDraft={snap.restoredDraft}` on
`Composer` in the prompt-history change.

Verified: webgui 543 tests and `check`; coding-agent `bun check`; RPC plus
session-manager tests 298; fingerprint test. E2E on a throwaway omp:
attach, streaming, steer, stop, `/retry`, plan approve, session-only role
change pushed to a second connection, rename, launch, shutdown. The
composer restore fix is not verified live.

## 2026-09-28: agent reactions and iMessage user bubble

- Agent reactions (TUI parity): an assistant reply that opens with an
  emoji lifts it onto the preceding user bubble as a tapback badge.
  Derived from persisted text via `splitReaction` from
  `@oh-my-pi/pi-tui/chat/reaction`; nothing stored. A partial emoji is
  withheld while streaming. Always on: the GUI cannot read
  `tui.reactions`. Code: `transcript-model.ts` (`UserItem.reaction`),
  `UserRow.tsx`, `test/reactions.test.ts`.
- User bubble restyled as an iMessage sent bubble (`transcript.css`,
  `tokens.css`). Wrap fix: `overflow-wrap: break-word` instead of
  `anywhere`, one 75% width cap, `min-width: 0` on the wrapper, no
  `pre-wrap` on user prose (doubled breaks with Marked `breaks: true`).

Verified: webgui 564 tests and `check`, production build, coding-agent
`bun check`; live session at 390px, confirmed by the user.
- Magic words (`ultrathink`, `orchestrate`, `workflowz`, `jevify`) glow
  with the TUI's hue sweeps in user bubbles: `src/lib/magic-words.ts`
  rewrites rendered HTML, skipping code, pre, links, and attributes, with
  the TUI's word boundaries. The word list is a copy; all words glow
  because the GUI cannot see which are enabled. See PLAN.md "Shared UX
  package". Test: `test/magic-words.test.ts`.

## 2026-09-28: loading and unreachable states

- `index.html`: inline HTML/CSS spinner in `#root` ("Loading ompgui…"),
  shown before any JS; after 8s a "Slow network or server down?" line
  with Reload. React replaces it on mount.
- `rpc-client.ts`: a failed first connect now retries with the same
  backoff (state `connecting`); `incompatible` and `close()` stay
  terminal. Attempt count exposed.
- `sessions-api.ts`: 10s `AbortSignal.timeout` on every request; timeouts
  and network errors throw instead of reading as empty lists.
- `SessionsScreen`: "Loading sessions…" spinner; on failure a "Server
  unreachable" card with reason and Retry, no duplicate toast.
- Transcript: "Loading history…"/"Connecting…" spinner until the first
  history page (`historyLoaded` in the store snapshot); spinner row while
  older pages load. TopBar shows the connection label on touch when not
  connected.

Verified: webgui 574 tests, `check`, production build. Headless 390px:
JS blocked shows the shell (hint hidden at 0.3s); `/api` blocked shows the
unreachable card only; a never-opening WebSocket shows "Connecting…"
instead of "no activity yet". Not verified: auto-recovery after a real
daemon restart. Confirmed working by the user on 2026-09-29.

## 2026-09-29: faster session open

Measured before: the browser sent 11 requests at once; omp answers them
in order, so history arrived at about 350ms behind about 790KB of model
data (roles 306KB, browser 273KB, 3 settings reloads from disk).

- `session-store.ts`: history is the first request; `get_state` once;
  `get_available_commands` only if the host did not push it. Model roles,
  browser, agents and login status are deferred to `ensure*` calls
  (models screen, picker) and an idle prefetch. Listener calls coalesce
  per animation frame. An older page that overlaps loaded entries is
  rejected.
- `rpc-client.ts`: in-flight dedupe for read-only request types.
- `settings.ts` (coding-agent): `reloadFromDisk` skips unchanged files;
  `force` option.
- `rpc-v3.ts` (coding-agent): history `limit` outside 1 to 200 is an
  error instead of a clamp.

Verified: webgui 583 tests and `check`; coding-agent `bun check`, rpc,
session-manager and settings tests (464). Live, 3 runs, this session:
history at 50 to 58ms after the click, 88KB inbound before it; model
requests sent after idle (about 280ms); models screen shows data. Host
changes need an omp restart. Confirmed faster by the user on 2026-09-29.

## 2026-09-29: injected rule rows in the transcript

- `transcript-model.ts`: `custom_message` entries with
  `customType: "ttsr-injection"` (rule interrupts) render as a developer
  toggle row labelled "rule interrupt: <names>" that expands to the rule
  text. `ttsr_injection` entries render as a "rules: <names>" marker,
  except directly after an interrupt, which already names them. Other
  `custom_message` types stay hidden. Live and history use the same
  entries (v3 `entry` frames), so no protocol change.
- `DeveloperRow`: optional `label`; labelled rows hide the preview.

Verified: webgui 584 tests and `check`. Live, this session: "rule
interrupt: doe" and "rule interrupt: pair" rows expand to wrapped rule
text; the reminder marker shows; no duplicate marker after interrupts.
Confirmed working by the user on 2026-09-29.

## 2026-09-29: live sessions ordered by activity, unread badges

- `server/live.ts`: each live entry carries `lastActivityAt` (session
  file mtime, fallback `startedAt`) and `assistantCount` (assistant
  message entries in the JSONL, null without a file). One stat per entry
  per poll; counts cached per file by (mtimeMs, size), appended bytes
  read from the last newline, shrink forces a rescan. Sorted newest
  activity first.
- `lib/unread.ts`: per-device seen counts in localStorage `webgui.seen`
  keyed by sessionId. First sighting sets a baseline (no badge); opening
  or viewing a session marks it seen; entries for gone sessions pruned.
- Live cards: red iOS-style badge top-right (`99+` cap), Stop pill
  bottom-right at every width, meta reads "active X ago".

Verified: webgui 597 tests and `check`; `/api/live` against real hosts
returned sorted entries with counts. Confirmed working by the user on
2026-09-29.

## 2026-09-29: Agent Hub

Agent Hub screen at parity with the TUI hub.

- New lazy-loaded `components/agent-hub/*` full screen (`#/s/<id>/hub[/<agent>]`,
  Alt+A, TopBar Bot button): tree/list roster with filter, detail panel,
  transcript tab (1s byte-cursor poll while open), steer, kill (confirm), revive.
- `lib/agent-hub-model.ts`: pure roster state (`get_agent_roster`,
  `agent_registry` frames, progress merge), tree building with orphan/cycle
  roots, totals, transcript cursor with reset handling.
- `session-store`: `setHubOpen` toggles `set_agent_roster_subscription` and
  re-subscribes after reconnect.
- `subagent-model`: nesting fixed. Parent now derives from the dot-nested agent
  id (it used `parentToolCallId`, so nothing nested); new agents take their
  status from progress instead of always "running".
- Task card agent links open the Hub at that agent.
- Task cards update live while running: v3 `tool_output` frames carry
  `details` for `task` (250ms throttle, 256KB cap), and nested
  `extractedToolData.task` / `inflightTaskDetails` render recursively
  (depth 8, cycle guard, 4 rows + `… N more`).
- Hub rows label agents by id (`A>B>C`); the definition name is a chip.
- Transcript cursor fixes: the client rewinds to byte 0 when the session
  file changes instead of freezing; the host returns `fileId` and a 64-byte
  `sentinel` and restarts from 0 when either no longer matches, so atomic
  rewrites no longer yield mid-line reads.
- coding-agent RPC: `get_agent_roster`, `set_agent_roster_subscription`,
  `kill_agent`, `revive_agent`, `steer_agent` (`rpc-agent-roster.ts`);
  `get_subagent_messages` resolves registry ids.

## 2026-09-29: Focused agent view

TUI focus-agent parity: a subagent's session renders in the main transcript view.

- Route `#/s/<id>/agent/<agentId>`; `lib/focus-model.ts` (history cursor,
  raw `subagent_event` folding, detach rules, command gating, Esc semantics)
  and `session-store` `focusAgent`/`unfocus`/`focus` snapshot.
- Entry points: task-card agent links (also nested cards inside a focused
  view) and Agent Hub Enter focus the agent; advisors and aborted agents still
  open the in-hub transcript.
- Composer: dimmed while focused, Esc clears then returns to Main, refused
  commands keep the draft, empty submit/Stop interrupts the agent, no image
  attach. Status strip shows ghost icon, agent id, its model, context and cost.
- Host RPC (coding-agent): `set_subagent_subscription` `ids`, `interrupt_agent`,
  `steer_agent` `mode`.
- Browser smoke against a live omp: focus from a task card, nested link to
  a deeper agent, live bash output, steer, Esc semantics, Hub Enter, reload
  deep link, auto-detach on kill. Smoke found two bugs fixed here: a deep link
  before the handshake reported "gone", and hub-to-agent navigation left the
  roster subscription off so detach never fired.

## 2026-09-29: Pinned subagents list replaces the Agents panel

- Removed `components/agents/AgentsPanel|AgentRow|agents.css`, the narrow
  Agents overlay, `toAgentsPanelData`/`buildChildrenMap`; `#/s/<id>/agents`
  now routes to the hub.
- Desktop inspector shows `PinnedSubagents` (TUI pinned HUD: running agents,
  model badge, id, role chip, description or 40-char task preview, 3 rows
  then expander, click focuses, "Open Agent Hub" header button).
- Bot button no longer hidden at desktop widths.

## 2026-09-29: Hub desktop layout

- On desktop the Hub fills all width right of the sessions sidebar.
  `AppShell` emits `sh-app--no-inspector` (2-track grid, 300px + 1fr) when a
  sidebar has no inspector; the 3-track grid left an empty 360px column.
- Tree/detail split `minmax(360px, 40%)` / `1fr`; header totals one line;
  role chips no longer truncate (the id label shrinks first); Children
  render inline.

## 2026-09-29: coding-agent RPC for the focused view

- `set_subagent_subscription` takes `ids` so level `events` forwards raw
  events for the focused agent only.
- `interrupt_agent { agentId }` aborts the current turn (not kill).
- `steer_agent` takes `mode: "steer" | "followUp"`.
- `test/rpc-agent-roster.test.ts` now drives `serveRpc` handlers.

## 2026-09-29: Pinned subagents list as hub cards

- Each agent is a TUI Agent Hub card: status dot, name, `TYPE · model level`; task; cost, duration, req, tools, tok, age.
- Model uses `resolvedModelIdentity` (no `:level` suffix), as the TUI does.
- No 3-row collapse; finished agents stay until dismissed with X (per session, localStorage `webgui.pinnedDismissed`); a revived agent reappears.
- The store holds the roster subscription while the list is visible (`setPinnedOpen`: the desktop inspector or the subagents page); finished roster entries carry no task or thinking level, and the type falls back to `displayName`.
- Below 1100px the Bot button opens the same card list as a page (`#/s/<id>/subagents`: `← Subagents [Open Agent Hub]`); a card opens the agent in the main view, and ← there returns to Main.
- Top-bar ← returns to the session's main view from every panel (agent view, hub, subagents, info, models, todos, usage); only the main view goes back to the sessions list.

## 2026-09-30: Focused agent gaps (todos, images, in-flight replay)

- Todos: the focused agent's list is derived from its polled entries with the TUI rule (`getLatestTodoPhasesFromEntries`); `FocusStatusStrip` shows the closed/total chip and opens a read-only `TodoPanel` at `#/s/<id>/agent/<agentId>/todos`. Never sends `set_todos` (acts on Main).
- Images: `steer_agent` takes `images?: ImageContent[]`; image-only sends allowed, malformed images rejected. The focused composer sends, echoes, and restores images on error.
- In-flight replay: `set_subagent_subscription {level:"events", ids}` returns `snapshots` (partial `streamMessage`, cached `tool_execution_update`s) for live agents, parked agents not revived. The host subscribes before snapshotting in one synchronous turn; the webgui replays through `applyFocusSnapshot`, guarded by `focusSubscribeToken`.
- Verified live on a fresh omp (390px): focusing mid-bash showed the running card with partial output at once; image-only RPC steer and a composer image send both reached the agent.
- Limit: a tool that never emitted an update is not in the host cache and appears at its first update or result.

## 2026-10-01: Focused agent export parity

- `/export` while focused: `gateFocusedSubmit` permits `/export` (returning `{ kind: "export" }`); `App.tsx` calls `POST /api/live/:instanceId/export { agentId }`, receives HTML attachment, and initiates browser download via `triggerBlobDownload` anchor helper. `/btw` remains refused with updated guidance ("/btw is not available in the web UI yet").
- Daemon endpoint: `POST /api/live/:instanceId/export` authenticates over Unix socket, sends `export_html` with outputPath in `<configRoot>/run/exports/`, streams HTML attachment, and ensures cleanup of exported file.
- Coding-agent RPC: `export_html` gains `agentId?: string` support (live session exports via `session.exportToHtml`, parked agent exports via `exportFromFile` without reviving). Over socket connections, `outputPath` is strictly confined within `<configRoot>/run/exports/` preventing arbitrary file writes.

## 2026-10-02: Focused subagent running tool replay (starts cache)

- Start cache & snapshot: `AgentSession` tracks active `tool_execution_start` events alongside updates (same lifecycle: deleted on end, cleared on session reset). `set_subagent_subscription` returns `activeToolStarts` in snapshots.
- Webgui in-flight replay: `applyFocusSnapshot` replays starts before updates; tools that started before focus but never emitted an update show running cards immediately upon focus. Replay is idempotent with live frames and skips tools whose results are already loaded in transcript entries.

## 2026-10-02: /btw history, follow-ups and branch

- History and prompt-context helpers moved into `session/btw-history.ts`, shared by the TUI `BtwController` and RPC `RpcBtwController`; one history per agent across TUI and web.
- RPC: `btw_start` gains `followUpOf`; new `btw_history` and `btw_branch` (Main only). `BtwSheet` shows the thread, follow-up input, history, copy and Branch.
- Fix: Main btw state used agent id "main", so follow-ups failed with "Unknown agent: main"; now `MAIN_AGENT_ID`. Removed `as any` casts on btw history records (`interrupted` records show as cancelled).
