# Web GUI tasks

24 tasks, 4 waves. Anchors are symbol names in the 2026-09-21 tree.

## Contracts

- A. Setting `rpc.serve`: boolean, default false, `config/settings-schema.ts` beside `collab.*`. No CLI flag.
- B. Registry dir `<configRoot>/run/rpc-hosts/`. One `<entryId>.json` per process, mode 0600, temp+rename. Fields: `version, instanceId, pid, endpoint, token, createdAt, sessionId, sessionName, cwd, model, startedAt`. Rewritten on session change. List = read files, drop entries whose pid is dead. Processes addressed by `instanceId`.
- C. Socket: client sends `{"type":"auth","token":"<hex>"}\n` first. Server replies with the existing `ready` frame, or an error frame and closes. After that: plain RPC NDJSON.
- D. Over the socket, `shutdown` exits omp through `InteractiveMode` teardown. Socket EOF or write failure closes that connection only. All other commands identical to stdio.
- E. Session change: connections stay open, get the existing session-change frames (`handleRpcSessionChange`), metadata file rewritten.
- F. Daemon HTTP:
  - `GET /api/live` → B entries minus `token`, `endpoint`.
  - `GET /api/past?cwd=&all=` → `SessionManager.list/listAll`.
  - `GET /api/past/:id` → `loadSessionFile` preview.
  - `POST /api/launch {cwd}` → `{windowId, instanceId?}`.
  - `POST /api/past/:id/resume` → `{windowId, instanceId?}`.
  - `POST /api/live/:instanceId/shutdown` → 204.
  - `GET /ws/:instanceId` → WebSocket. Daemon does C; browser sees `ready` onward; bytes copied verbatim both ways.
- G. Daemon binds `127.0.0.1:8081`. Env `HOST`, `PORT` override.
- H. Launch: `tmux new-window -t 0 -c <cwd> -P -F '#{window_id}' -- fish -c 'omp'`. Resume: `… fish -c 'omp --resume <id>'`. `omp` is the autoloaded function in `~/.config/fish/functions/omp.fish` (runs `bun <repo>/packages/coding-agent/src/cli.ts --allow-home`).

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
