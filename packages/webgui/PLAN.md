# OMP Web GUI

What we are building, why, what is fixed, and how far along we are.
Implementation lives in code, tests, and HISTORY.md. Update this when the
vision or a fixed decision changes, not when code changes.

## Why

omp sessions live in tmux windows on the host (the M5 Pro). From a laptop,
ssh + tmux attach is a fine client. From a phone it is not: tmux key chords,
broken scrollback, and flaky ssh make it unusable. The web GUI is the
phone-shaped client to the same sessions.

A second horizon (B) is observability for an agent-swarm product built on omp,
aimed at people who never open a terminal: navigating a deep tree of subagents.
It rides on the same attach channel. No design yet; it comes after A works.

## What it feels like when done (A)

- Open the GUI on the phone. See every omp session running on the host,
  clearly separated from past sessions on disk.
- Tap a live one. See the current turn streaming: thinking, tool calls,
  subagent activity. Same fidelity as the terminal.
- Type a prompt, steer mid-turn, abort. The tmux window shows the same thing
  happening. Both clients are equal.
- Start a new session, choosing the working directory. It appears as a new
  tmux window on the host and in the list within seconds.
- Tap a past session. It resumes in a new tmux window and becomes live.
- Shut a session down from the phone. The omp process exits; the tmux window
  and anything else in it survive.
- Close the browser, lose the network, come back. Nothing was lost, because
  nothing depended on the browser.

## Fixed decisions

- **Sessions are owned by omp processes in tmux.** The GUI never owns a
  session. It attaches, drives, detaches. Same model as a tmux client.
- **RPC is the protocol.** Every interactive omp optionally serves the full
  coding-agent RPC protocol over a per-process Unix socket, alongside its TUI,
  and publishes discovery metadata (pid, socket path, bearer token) under
  `~/.omp/run/`. This is the same pattern collab uses for its local registry.
  Off by default; a setting turns it on.
- **The daemon is a relay, not a translator.** One WebSocket per attached
  session. The daemon connects to that process's socket and copies RPC frames
  both ways unchanged. It adds discovery (walk the registry), launching
  (`tmux new-window -t 0 -c <cwd> omp ...`), past-session browsing (session
  files on disk), and static hosting. It never reshapes frames.
- **The browser speaks RPC.** The client consumes coding-agent RPC types
  directly. No second protocol.
- **No UI-request handling.** `ask.enabled=false` on this host; extension
  dialogs, if any, stay on the TUI. The GUI does not present or answer them.
- **Concurrency is AgentSession's job.** TUI and browser both submit
  prompt/steer/abort; the session's own admission logic orders them. No
  leases, no read-only tier.
- **Kill means RPC shutdown**, never `tmux kill-window`.
- **`packages/webgui` is ours; upstream stays upstream.** Never published.
  It imports renderers, Markdown, transcript, and agent components from
  `packages/collab-web` read-only. Anything we need to change is copied here.
  Edits to `packages/coding-agent` are the minimum needed to serve RPC beside
  the TUI, localized so upstream syncs stay cheap.
- **Reach.** The daemon is already exposed on 8081 via Tailscale serve, which
  provides the secure context the browser needs. The daemon runs in its own
  tmux window for now; a login service can come later.

## Misreadings to avoid

Each of these was made once during planning. Do not make them again.

- This does not replace ssh + tmux. The laptop keeps using them. It adds a
  client for the phone, where tmux is unusable.
- The daemon never owns or spawns the sessions it shows. Spawning a private
  `--mode rpc-ui` child was the prototype's mistake.
- Collab is the pattern for discovery (metadata files, per-process socket,
  bearer token), not the mechanism. Its wire format is a shrunk subset over a
  relay for untrusted guests. We want the full RPC protocol on a trusted host.
- RPC mode and the TUI are mutually exclusive in upstream today
  (`main.ts` mode dispatch). Making them coexist in one process is the work,
  not a detail.
- UI requests (ask/select/editor dialogs) are dead on this host. Do not
  design arbitration for them, do not carry `ui_request` frames.
- Shutdown from the GUI is RPC `shutdown` of the omp process. The tmux window
  and whatever else runs in it survive. Never `tmux kill-window`.
- Sessions started from the phone run in a tmux window on the host, so the
  laptop can pick them up later. Never GUI-only sessions.
- The daemon does not translate frames. If you find yourself defining
  `event`/`entry`/`state` message types or a replay ring buffer, stop.

## Where we are

Dated. Capability level only.

**2026-09-21.** A prototype exists inside `packages/collab-web` (server under
`src/server/`, client `src/lib/rpc-web-client.ts`, session switcher, REST
session browsing). It spawns and owns a single private `--mode rpc-ui` child,
so it cannot see sessions running in tmux; that model is abandoned. What
carries forward: the UI shell work, the tool renderers, past-session listing
and preview, and the tests for those. Nothing in the coding-agent yet serves
RPC beside the TUI; `runRpcMode` is single-stream stdin/stdout and owns the
process. Working notes with file:line references for item 1 below are in
`NOTES.md`.

## What comes next, in order of user value

1. omp serves RPC over a Unix socket beside the TUI, with discovery metadata.
   Verified by attaching a second client to a live tmux session and driving it.
2. Daemon in `packages/webgui`: registry walk, one-WebSocket-per-session
   relay, static SPA. Browser attaches to any live session with full fidelity.
3. Session list: live vs past, clearly delineated. New session with cwd
   choice, resume past, shutdown. All via tmux window 0 on the host.
4. Phone ergonomics on the real surface: switching, scrollback, reconnect
   over a bad link.
5. Horizon B: swarm navigation. Design starts only after 1-4 hold up in daily
   use.

## Companion documents

- `NOTES.md`: working notes for the current item; rewritten as items change.
- `HISTORY.md`: dated, append-only record of what shipped, with file pointers.
- The abandoned prototype is preserved on branch `prototype/webgui-rpc-ui`
  (collab-web `src/server/`, `rpc-web-client.ts`, root `PLAN.md`). Reference
  only.
- `packages/coding-agent/CHANGELOG.md` and `packages/collab-web/CHANGELOG.md`
  are upstream's. Our changes are recorded in HISTORY.md, not there.
