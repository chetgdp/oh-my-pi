# Tasks
Finished work lives in HISTORY.md (latest: 2026-09-27, status bar
color).

## Current List

## Open

2. Horizon B: subagent transcript viewer (`get_subagent_messages` RPC
   exists), subagent cancel, swarm navigation. Design not started.
3. Plan mode leftovers:
   1. Plan-role model switch on enter/approve not verified live (no
      `plan` role configured).
   2. Refine textarea with the real iOS keyboard not verified.
4. iOS zoom: inputs under 16px zoom on focus. Audited and fixed across
   all form controls (rename, plan refine, login, model picker,
   new-session, role/agent, composer, info panel, and base defaults >= 16px).
5. Entry bundle ~590KB; no analysis of what remains.
6. `※ recap` is a TUI status line journaled to history.db
   `session_recaps`, never a transcript entry, so it cannot appear in
   `get_messages`. Now shown on live session cards (2026-09-26).
