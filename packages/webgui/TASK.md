# Tasks

Finished work lives in HISTORY.md (latest: 2026-09-26, plan
mode). Parity packages 1-4 and item 12 of `parity.md` are done; its
remaining in-cut items (6, 7) are Horizon B.

## Open

1. Desktop home: `#/` repeats the sidebar sessions list in the main pane.
   UX deferred.
2. Horizon B: subagent transcript viewer (`get_subagent_messages` RPC
   exists), subagent cancel, swarm navigation. Design not started.
3. Plan mode leftovers:
   1. Plan-role model switch on enter/approve not verified live (no
      `plan` role configured).
   2. Refine textarea with the real iOS keyboard not verified.
4. iOS zoom: inputs under 16px zoom on focus. Rename, plan refine
   fixed; login, model picker, new-session and role/agent inputs
   unchecked.
5. Entry bundle ~590KB; no analysis of what remains.
6. `※ recap` developer message missing from the transcript in one
   session; cause unverified.
7. Models hub desktop keyboard parity verified headless only; real
   desktop review pending.
8. Security (`parity.md` section 4): anyone on the tailnet can attach to
   any session and read past sessions; decide on a PIN/passphrase
   cookie on the daemon.
9. Performance (`parity.md` section 4): large `tool_output` frames and
   base64 chunking stall mobile Safari; clamp tool output at the RPC
   boundary and downsample images before upload.
