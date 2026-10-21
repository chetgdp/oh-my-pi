# Tasks
Finished work lives in HISTORY.md (latest: 2026-10-18, L. Synthesis shell: live-line top bar, control center, alert and now strips).

## Current List

## Open
- protocol revisions (HTTP vs QUIC?)
- actual UX designed for agentic harness, all new synthesis of existing harnesses and human-ai-computer interfaces.
- shell mode: status, next steps and follow-ups live in `packages/shell/README.md` (## Status)

- tool call word wrap, better diff view

- [wip] maska UX 
- cloud based?
- session host system design: cloud (AWS) hosts next

## Deferred
- notifs popping up all the time 
- transcript cache: entries rewritten in place on load, fork, and rewrite paths (`session-manager.ts:3652`, `:3708`, migrations) can leave a stale cached copy until the next branch change; the cache handles only the general append case
- css skin: dark (graphite), fonts and desktop layout done 2026-10-02; light theme still the old brand palette
- achieve parity with TUI (depends on the feature, maybe prio /tree and /fork?)
