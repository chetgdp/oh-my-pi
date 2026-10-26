# Tasks
Finished work lives in HISTORY.md

## Current List

## Open
- protocol revisions (HTTP vs QUIC?)
- security design: webgui has no login; Tailscale is the only gate, and anyone who loads the page can drive agents. Blocks the parked ptyZZZ terminal (`cheisms/webgui-terminal-ptyzzz.md`).

- [wip] maska UX 
- cloud based?
- session host system design: cloud (AWS) hosts next

- new desktop transcrkpt design, intelligent columns, text and tools
- shell mode: status, next steps and follow-ups live in `packages/shell/README.md` (## Status)
- actual UX designed for agentic harness, all new synthesis of existing harnesses and human-ai-computer interfaces. 
- https://webdev.teknium.io/ idk but make it nice
- splash screen https://x.com/mitchellh/status/2113346052090925406

- is this upstream? https://github.com/stencil-hq/dquickts
- what is this https://exe.dev/docs/what-is-exe

## Deferred
- notifs popping up all the time 
- transcript cache: entries rewritten in place on load, fork, and rewrite paths (`session-manager.ts:3652`, `:3708`, migrations) can leave a stale cached copy until the next branch change; the cache handles only the general append case
- css skin: dark (graphite), fonts and desktop layout done 2026-10-02; light theme still the old brand palette
- achieve parity with TUI (depends on the feature, maybe prio /tree and /fork?)
- Pele math labels (`math` resolver with KaTeX): `$$` labels show raw TeX; none of 2385 sessions with mermaid fences had math in a fence. Plan and risks (sync measure, iOS `foreignObject`) in the 2026-10-24 session
