# Working notes: item 1, RPC beside the TUI

Facts gathered 2026-09-21 by reading `packages/coding-agent/src`. Line numbers
drift; symbol names are the anchor. Re-verify before editing.

## Mode dispatch today

- `main.ts` ~1684: `claimRpcInput()` runs only for `mode === "rpc" | "rpc-ui"`;
  it claims the Bun stdin singleton.
- `main.ts` ~2288-2293: `if (mode === "rpc" || mode === "rpc-ui") runRpcMode(...)
  else if (isInteractive) runInteractiveMode(...)`. Mutually exclusive. The
  interactive branch has `session`, `setToolUIContext`, `eventBus`,
  `subagentEventBus` in scope.
- `main.ts` ~2066: `sessionOptions.hasUI = isInteractive || mode === "rpc-ui"`.
- `cli/args.ts`: modes are text/json/rpc/acp/rpc-ui. No attach mode.

## `runRpcMode` (`modes/rpc/rpc-mode.ts`)

Signature: `runRpcMode(session, setToolUIContext?, subagentEventBus?,
input: ReadableStream<Uint8Array> = claimRpcInput()): Promise<never>`.

Already transport-shaped:
- Input is the injected stream; `readRpcInputFrames(input, ...)`
  (`rpc-input.ts`) parses NDJSON from any `ReadableStream`.
- Output goes through `RpcOutputWriter` (`rpc-output.ts`), which accepts any
  Node `Writable` (backpressure, spooling). `runRpcMode` hardcodes
  `process.stdout` at construction (~835). Every response/event goes through a
  local `output()` closure over that writer and one `RpcFrameEncoder`.
- Events: `session.subscribe(event => output(event))` (~1089).
  `AgentSession.subscribe` (`session/agent-session.ts`, ~4450) is
  multi-listener, returns per-listener unsubscribe. Safe beside the TUI.
- Subagent frames: `new RpcSubagentRegistry(subagentEventBus, output)`
  (`rpc-subagents.ts`) subscribes to the process-local EventBus channels.
  Also multi-listener.

Process ownership baked into the same closure; each must NOT run when
embedded beside a TUI:
- `process.env.PI_NOTIFICATIONS = "off"` (~832), process-global.
- `new RpcExtensionUIContext(...)` then `setToolUIContext?.(ctx, true)`
  (~1068). Single-slot setter; calling it steals the UI from the TUI.
- `await initializeExtensions(session, { mode: "rpc", ... })` (~1072).
  Interactive mode already initialized extensions; a second call is unsafe.
- `RpcOutputWriter` failure callback: `session.dispose().finally(() =>
  process.exit(1))` (~837).
- EOF on input: reject pending extension requests, close host tool/URI
  bridges, dispose subagent registry, `disposeAndExit()` (~1710-1723).
  `pi.shutdown` path also exits the process.
- One dispatcher, one pending-request map, one encoder: exactly one client.
  Two sockets sharing them would interleave frames.

`rpc-ui` vs `rpc`: the only difference is whether `setToolUIContext` is
passed (`main.ts` ~2292). We do not want either behavior; UI requests are out
of scope and the TUI keeps its context.

## Proposed split (design owned by the human; this is the map)

- New `modes/rpc/rpc-server.ts`: `serveRpc(session, transport, options)`
  holding the protocol body with per-connection writer/encoder/dispatcher/
  pending map. Options: `subagentEventBus`, `ownsProcess: false`. No
  extension init, no UI context install, no `process.exit`, unsubscribe
  session listener on disconnect.
- `runRpcMode` becomes the thin stdin/stdout wrapper: `claimRpcInput()`,
  `process.stdout`, ownership true, existing exit semantics.
- New `modes/rpc/rpc-socket.ts`: `node:net` server on a per-process Unix
  socket; one `serveRpc` per accepted connection; publishes discovery
  metadata; stops with the TUI.
- `interactive-mode.ts`: start the socket server after `InteractiveMode`
  init (after `ExtensionUiController` exists), tie stop to the existing
  teardown (`createSessionTeardown`, `InteractiveMode.init` ~1408-1434).
  Gate on a new setting (e.g. `rpc.serve`, default false).
- Concurrency: none added. Multiple connections each get their own
  dispatcher; `AgentSession`'s admission (`prompt`/`steer`/`followUp`/
  `abort`) orders competing submissions. Session switch/new from any client
  already clears RPC subagent state via `handleRpcSessionChange`; confirm
  each connection's copy gets it.

## Discovery pattern to mirror: `collab/registry.ts`

- Dir: `collabHostsRuntimeDir()` = `<configRoot>/run/collab-hosts`. Ours:
  `<configRoot>/run/rpc-hosts` or similar.
- `publishCollabHost(source, options)`: random entry id + 32-byte hex bearer
  token; `net.createServer`; listen on socket path (falls back to a short dir
  under `/tmp` when the path would overflow `sun_path`, ~104 bytes on macOS);
  `chmod 0600` the socket; write metadata atomically (temp + rename),
  owner-only. Metadata: protocol version, instanceId, pid, endpoint,
  createdAt, token. Returns `{ endpoint, close() }`.
- Request handling: one NDJSON request per connection, bounded
  (`MAX_REQUEST_BYTES` 4 KiB), version + token checked before dispatch,
  `crypto.timingSafeEqual` on equal-length buffers (`tokenMatches`).
- `listCollabHosts()`: reads every metadata file, queries live sockets
  concurrently (`LIST_CONCURRENCY` 8, `DEFAULT_QUERY_TIMEOUT_MS` 1500),
  prunes stale/malformed/version-mismatched entries best-effort, sorts by
  startedAt, pid, instanceId.
- Snapshot fields worth copying for the session list: pid, sessionId,
  sessionName, cwd, model, startedAt.
- Difference for us: after the auth handshake the connection stays open and
  carries RPC frames, rather than closing after one response.

## Client side

- `modes/rpc/rpc-client.ts` `RpcClient`: spawns a child and speaks NDJSON over
  its stdin/stdout (`RpcAgentProcess` interface ~51-55; frame write ~1229).
  For the daemon, a Unix-socket transport implementing the same interface, or
  a bypass since the daemon only relays bytes.

## tmux facts (this host)

- Daemon target: `tmux new-window -t 0 -c <cwd> <omp cmd>`; capture
  `#{window_id}` from `-P -F '#{window_id}'` for later reference.
- No omp-side pid to session mapping exists; the registry metadata (pid +
  snapshot sessionId) provides it once item 1 lands.
- Shutdown from GUI: RPC `shutdown` command to that process. Never
  `kill-window`.

## Prototype reference

Branch `prototype/webgui-rpc-ui`. Useful pieces:
`packages/collab-web/src/server/rpc-bridge.ts` (how `RpcClient` was driven,
`getMessages`/`getState`/`getAvailableModels` on attach), session
list/preview code using `SessionManager.list/listAll` and `loadSessionFile`,
`SessionSwitcherModal.tsx`, shell CSS.
