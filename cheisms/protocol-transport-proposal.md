# Proposal: host protocol and transport (QUIC candidate)

Status: proposal, not approved. Written 2026-10-16.

## Current layers

```mermaid
flowchart LR
  B[Browser PWA] -- "HTTPS/WSS (HTTP/1.1)" --> TS[tailscale serve]
  TS -- "HTTP/1.1 + WS, loopback" --> D[webgui daemon :42049]
  D -- "Unix socket, NDJSON, token line" --> H[omp host / TUI with rpc.serve]
  S[shell client] -- "Unix socket, NDJSON, token line" --> H
  D -. "omp host start (spawn)" .-> H
  D -. "reads registry dir + lock files" .-> R[(run/rpc-hosts)]
  S -. "reads" .-> R
```

## Known

- Browser to daemon: HTTP/1.1 from `Bun.serve`. TLS ends at `tailscale serve`. JSON REST routes do list, launch, resume, shutdown, export, complete and dirs. Each attached session gets one WebSocket at `/ws/:instanceId`. There is no SSE, no service worker, no heartbeat and no online/offline listener. The page suspends after 60s hidden and resyncs on return (`packages/webgui/src/lib/rpc-client.ts`, `session-store.ts`).
- Daemon to host: `packages/webgui/src/server/relay.ts` copies bytes between the WebSocket and a host Unix socket as NDJSON. The daemon injects the auth line, forcing `surface=web` and adding a per-browser `clientId`. It also batches output every 50ms, compresses it with raw deflate, and has 1MiB of backpressure. Each WebSocket maps to exactly one host connection.
- Host (`packages/coding-agent/src/modes/rpc/`):
  - Unix socket with mode 0600, first-line bearer token, one lock file per session.
  - Frames are capped at 1MiB; protocol v2 splits larger ones into chunks up to 64MiB (`rpc-frame.ts`).
  - When clients read slowly, output spools to disk with no size limit (`rpc-output.ts`). Incoming data has no flow control.
  - The last client to send a driver command receives the dialogs (`rpc-host-driver.ts`, `rpc-host-requests.ts`).
  - Detach state lives only in host memory (`rpc-host.ts`).
- Shell (`packages/shell`): same socket and token, but one connection per `?` call and still on protocol v1. If the connection drops mid-turn the shell exits with status 1, the turn keeps running on the host, and only `/last` gets the output back.
- Resume: protocol v3 resumes with `history {after: leafId}`, a cursor into the entry tree, not into the transport (`rpc-v3.ts`). Wire frames have no sequence ids and nothing is replayed.
- Same-machine coupling: discovery (a polled registry dir with pid and connect probes), session locks, launch (spawning `omp host start`), and recap, count, complete and export all read local files.
- Trust: on the browser side, the only gate is loopback bind plus the Host/Origin allowlist (`security.ts`). On the host side it is file permissions plus the token. `clientId` and `surface` are unauthenticated claims.

## Unknown

- Whether Bun can serve QUIC, HTTP/3 or WebTransport.
- Whether iOS Safari supports WebTransport.
- Whether `tailscale serve` proxies HTTP/3 or UDP.

## Hypotheses

- Head-of-line blocking: events, responses and chunked large frames share one ordered stream. A 64MiB chunked frame blocks dialogs and aborts behind it. QUIC streams would remove that; priority lanes inside the current protocol would also fix it.
- Network changes: QUIC connection migration could keep a session alive across Wi-Fi to cellular switches. The leafId resync already makes reconnecting cheap, so the gain may be small.
- Cloud hosts need these whatever the transport:
  - a remote endpoint in the registry and remote discovery
  - mTLS or per-client tokens
  - a resume cursor for shell turns
  - a cap on the disk spool
  - remote versions of the file-reading routes

## Plan

1. Check the three unknowns. If iOS Safari has no WebTransport, the browser stays on WSS.
2. Define a transport-agnostic host protocol: per-frame sequence ids, resume-from-seq, heartbeat, and separate priority lanes for control and bulk data.
3. Add remote host auth (mTLS through Tailscale identity or the AWS equivalent), remote discovery and a spool cap.
4. Pick QUIC or HTTP/2/WSS for the daemon-to-cloud link only, based on measured latency and reconnect behavior over cellular.
