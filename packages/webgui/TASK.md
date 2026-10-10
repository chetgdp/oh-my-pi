# Tasks
Finished work lives in HISTORY.md (latest: 2026-10-07, streaming render cost).

## Current List

## Open
- session host system design: cloud (AWS) hosts next

- cloud based?

- shell mode follow-ups (initial shell mode shipped 2026-10-10, see HISTORY.md):
  - red/green diff rendering for edit tool results
  - verify the picker and dialogs on a real terminal
  - face-and-dots spinner fallback without a tty (giverny DUMB mode under nvim `:!`)
  - a TUI with `rpc.serve` off takes no session lock, so `? /r` (and web resume) can open a second writer on a session the TUI holds

- actual UX designed for agentic harness, all new synthesis of existing harnesses and human-ai-computer interfaces.

- [wip] maska UX 
- protocol revisions (HTTP vs QUIC?)
- rich `ask` dialog in webgui: hosts use the select/editor fallback because nothing sends `set_ask_dialog`; render `method: "ask"` (multi-question, multi-select, custom input) and enable it per connection

## Deferred
- notifs popping up all the time 
- transcript cache: entries rewritten in place on load, fork, and rewrite paths (`session-manager.ts:3652`, `:3708`, migrations) can leave a stale cached copy until the next branch change; the cache handles only the general append case
- css skin: dark (graphite), fonts and desktop layout done 2026-10-02; light theme still the old brand palette
- achieve parity with TUI (depends on the feature, maybe prio /tree and /fork?)
