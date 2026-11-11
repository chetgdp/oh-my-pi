# Tasks
Finished work lives in HISTORY.md

## Current List

## Open

### arch
- protocol revisions (HTTP vs QUIC?)
- security design: webgui has no login; Tailscale is the only gate, and anyone who loads the page can drive agents. Blocks the parked ptyZZZ terminal (`cheisms/webgui-terminal-ptyzzz.md`).
- session host system design: cloud (AWS) hosts next
- change default shell, add REPLs?
- omem mode more stuff
- attach from anywhere with shell

### ux
- shell mode: small stuff left, more kaomoji, current config print (like shell specific settings)
- https://webdev.teknium.io/ idk but make it nice
- new desktop transcrkpt design, intelligent columns, text and tools
- actual UX designed for agentic harness, all new synthesis of existing harnesses and human-ai-computer interfaces. 
- advanced gui ideas (web3d, clear design)
    - immediate mode raylib gui
    - rune? https://github.com/anomalyco/rune
    - 3d gui?
    - html components as responses rather than markdown
- shader in bg tab still mode
- refine the shader used as the bg maybe rremove the gate?
- fix the awful ui style decisions for the clear mode
- takes forever to load on windows?
- really slow spinners in TUI idk why

### fork
- lotus design

## Deferred
- notifs popping up all the time 
- transcript cache: entries rewritten in place on load, fork, and rewrite paths (`session-manager.ts:3652`, `:3708`, migrations) can leave a stale cached copy until the next branch change; the cache handles only the general append case
- css skin: dark (graphite), fonts and desktop layout done 2026-10-02; light theme still the old brand palette
- achieve parity with TUI (depends on the feature, maybe prio /tree and /fork?)
- Pele math labels (`math` resolver with KaTeX): `$$` labels show raw TeX; none of 2385 sessions with mermaid fences had math in a fence. Plan and risks (sync measure, iOS `foreignObject`) in the 2026-10-24 session
- bug: input sent to a tmux TUI omp with `send-keys` (from the omem session) was missing from both TUI and GUI, though stored and acted on. Seen once at f8fb1051ab (2026-11-06, session 01a1ae29); the log has `serveRpc run loop failed: RPC output closed` around it. Not reproduced at 6503945362 in 3 variants (idle with bash job, 430-char text, subagents running). Part 2 RPC control avoids this path.
