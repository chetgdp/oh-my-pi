# Proposal: move the RPC socket server onto native `IpcServer`

Status: implemented (2026-10-19, natives 18.12.3).

## Why

`packages/coding-agent/src/modes/rpc/rpc-socket.ts` runs a hand-written `net.Server`. pi-natives (`crates/pi-natives/src/ipc/`) ships `IpcServer` / `IpcConnection`, already used by the LSP mux, launch broker, collab registry, streamer and subprocess workers (`subprocess/jsonl-server.ts` is the closest pattern).

Each host binds a fresh random path: `publishRpcHost` (`rpc-registry.ts:199`) draws a random `entryId` per start, and the endpoint is `<dir>/<entryId>.sock`. Two hosts never share a socket path. The registry dir (`~/.omp/run/rpc-hosts`, or the hashed `/tmp` fallback) is created and repaired to 0700 by `ensurePrivateDirSync` before the socket exists.

| Concern | Native `IpcServer` | `rpc-socket.ts` today | Real gain for RPC |
|---|---|---|---|
| Stale socket / live-server takeover | flock + probe, `EADDRINUSE` on live server | `rmSync` before bind | none: paths are never reused |
| Socket mode | 0600 before `listen()` | `chmodSync(0o600)` after `listen()` | none: parent dir is already 0700 |
| Peer check | other-euid peers dropped silently | none | small: excludes root (`sudo`) clients that the dir mode lets in |
| Close | unlinks only our own inode; leaves `<endpoint>.bind.lock` behind | `rmSync` on stop | none: path is ours alone, and `publication.close()` / exit hook / registry prune `rmSync` the path and its `.bind.lock` |
| Writes | per-task coalescing, `send()` false past 1 MiB, `drained()` | Node socket writes | yes: real output backpressure, fewer syscalls on event bursts |
| Reads | no pause API | `on("data")` enqueue, no pause | none: neither applies read backpressure |
| Windows | named pipe | unsupported | non-goal |

The benefit is write-path backpressure plus one IPC stack across the codebase. The safety gains the earlier draft claimed do not apply to this endpoint.

## Scope

Server side only. Clients keep `net.connect`; the wire format (newline JSON, contract C auth line first) does not change:

- `packages/webgui/src/server/relay.ts`, `export.ts`, `shutdown.ts`
- `packages/shell/src/host-socket.ts`
- `rpc-registry.ts` probes (`probeRpcHostDetail`, `probeConnector`)

Non-goals: client migration to `IpcConnection`, registry or endpoint naming changes, Windows hosts. Registry socket cleanup (`removeSync`, `listRpcHosts` prune, `pruneEntryFiles`) stays: it is the only cleanup after a crash. In scope: those three paths in `rpc-registry.ts` also remove `<endpoint>.bind.lock`, which the native listener creates and never unlinks (same pattern as `endpointFiles()` in `collab/registry.ts`).

## Design

Use `raw` framing. `serveRpc` takes `{ input: ReadableStream<Uint8Array>, output: Writable }` and splits frames itself, so `rpc-server.ts` stays untouched and the auth parser keeps working on bytes.

Changes in `rpc-socket.ts`:

1. `startRpcSocketServer`: replace `rmSync` + `net.createServer` + `listen` + `chmodSync` with `IpcServer.listen(endpoint, { framing: "raw" }, onConnection)`. On rejection, `publication.close()` and rethrow (as the `error` handler does today).
2. `onConnection(conn)`: `conn.startRaw(onChunk, onClose)` immediately; frames before start are buffered natively. Chunks feed the auth parser until the auth line completes (4 KiB cap and 5 s timeout stay in JS), then the input `ReadableStream`; leftover bytes are enqueued first.
3. Output adapter: a `Writable` whose `write` calls `conn.send(chunk)`; when `send` returns false, call back after `conn.drained()`. `onWriteFailure` maps to `conn.destroy()`.
4. `writeErrorAndClose`: `conn.send(json + "\n")` then `conn.end()`. `end()` writes queued frames first, so the refusal frame precedes the close. If the peer has not closed after the 500 ms grace, `conn.destroy()`.
5. `stopAccepting`: `server.close()`. Native close leaves accepted connections open; `stop()` closes them. Its only external caller (`rpc-host.ts:111`, teardown step 1) does not await it, and step 2 ends sockets itself, so waiting for connections is not needed.
6. `stop`: every accepted connection is tracked from `onConnection`, including ones still authenticating or refused but not yet closed. `stop` cancels pending auth timers, then per connection `conn.end()`, wait for `onClose` up to the 500 ms grace, then `conn.destroy()`. Keep the `setImmediate` tick before `handle.close()`. Drop the final `rmSync` (native close unlinks; `publication.close()` also does). An auth line that completes after `stop` began gets a `host_stopping` refusal instead of `serve`.
7. `onClose(reason)`: close the input stream for any reason (a non-null reason, such as ECONNRESET from a client `destroy()` with unread data, is logged at debug). Erroring it would skip `serveRpc`'s EOF cleanup: pending extension requests, host tool bridge, live bridge, drains. Then `handle.close()`, drop the connection from tracking, `rights?.closed()`. Input stream `cancel()` calls `conn.destroy()`.

Session locks (`acquireSessionLock`) stay unchanged.

## Risks

Root and other-uid clients (`sudo omp-shell` against a user host) get a silent close instead of the auth flow. This is a security decision, not an accepted risk: only the host's own uid may connect.


- The webgui, `omp-shell` and `omp host` share this path; a stream-glue bug breaks all three.
- The native addon must be current (`omp-install` handles it); a stale `.node` fails at first use.

## Verification

- `bun test ./test/rpc-socket.test.ts ./test/rpc-registry.test.ts ./test/rpc-host*.test.ts` in `packages/coding-agent`.
- `bun --cwd=packages/webgui test` (relay, shutdown, endpoints, apps use real sockets).
- New `rpc-socket.test.ts` cases: refused auth delivers the `{type:"error", code}` frame before close; a client that stops reading does not grow host memory past the 1 MiB send window (output backpressure); `stop()` flushes the shutdown notice to a connected client.
- Smoke with the installed binary: `omp host start`, attach webgui and `omp-shell`, prompt, stop; `kill -9` a host and resume the same session; refused auth shows the error frame in the client.
