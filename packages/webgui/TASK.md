# Tasks
Finished work lives in HISTORY.md

## Current List

## Open

### arch
- protocol revisions (HTTP vs QUIC?)
- security design: webgui has no login; Tailscale is the only gate, and anyone who loads the page can drive agents. Blocks the parked ptyZZZ terminal (`cheisms/webgui-terminal-ptyzzz.md`).
- session host system design: cloud (AWS) hosts next
- change default shell, add REPLs?

### ux
- shell mode: small stuff left
- https://webdev.teknium.io/ idk but make it nice
- new desktop transcrkpt design, intelligent columns, text and tools
- actual UX designed for agentic harness, all new synthesis of existing harnesses and human-ai-computer interfaces. 
- advanced gui ideas 
    - immediate mode raylib gui
    - 3d gui?
    - html components as responses rather than markdown

### fork
- lotus design

## Deferred
- notifs popping up all the time 
- transcript cache: entries rewritten in place on load, fork, and rewrite paths (`session-manager.ts:3652`, `:3708`, migrations) can leave a stale cached copy until the next branch change; the cache handles only the general append case
- css skin: dark (graphite), fonts and desktop layout done 2026-10-02; light theme still the old brand palette
- achieve parity with TUI (depends on the feature, maybe prio /tree and /fork?)
- Pele math labels (`math` resolver with KaTeX): `$$` labels show raw TeX; none of 2385 sessions with mermaid fences had math in a fence. Plan and risks (sync measure, iOS `foreignObject`) in the 2026-10-24 session
