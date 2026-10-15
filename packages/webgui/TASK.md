# Tasks
Finished work lives in HISTORY.md (latest: 2026-10-15, shell `/last`, aliases, context-aware rendering).

## Current List

## Open
- session host system design: cloud (AWS) hosts next

- cloud based?

- shell mode: status, next steps and follow-ups live in `packages/shell/README.md` (## Status)

- actual UX designed for agentic harness, all new synthesis of existing harnesses and human-ai-computer interfaces.

- [wip] maska UX 
- protocol revisions (HTTP vs QUIC?)

## Deferred
- notifs popping up all the time 
- transcript cache: entries rewritten in place on load, fork, and rewrite paths (`session-manager.ts:3652`, `:3708`, migrations) can leave a stale cached copy until the next branch change; the cache handles only the general append case
- css skin: dark (graphite), fonts and desktop layout done 2026-10-02; light theme still the old brand palette
- achieve parity with TUI (depends on the feature, maybe prio /tree and /fork?)
