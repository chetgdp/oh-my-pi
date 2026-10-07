# Tasks
Finished work lives in HISTORY.md (latest: 2026-10-07, streaming render cost).

## Current List

## Open

- reduce phone data / protocol revisions (HTTP vs QUIC?); past list is 360KB per open, unpaged
- inner loop slowness (steps 1-5 done 2026-10-07, see HISTORY.md; benches in NOTES.md "Run it"). Remaining, measured costs in brackets:
  - security, pre-existing: `resolvePastSessionPath` (`src/server/past.ts`) accepts any `idOrPath` containing `/` or ending `.jsonl` with no containment check in the sessions dir, so preview and resume read arbitrary paths
  - Markdown still lexes the whole message every text frame [~0.75s per 60k-char stream]
  - `/api/live` recaps: one query for all live sessions but no per-session limit; returns every recap row (unmeasured)
  - `/api/past?all=true`: ETag or cache by max mtime, or paginate [6ms at 788, 124ms / 419ms CPU at 5000]; overlaps the phone-data item above
  - reducers: id Set for the `entry` dedupe and `tool_output` result check, stop copying `entryKeys` [quadratic, 85ms + 49ms total at 4000 entries]
  - transcript cache flush: in-memory index, evict via keys plus savedAt instead of loading all records, skip the size stringify [4-29ms every 2s while entries arrive]
  - unmeasured: focused-subagent `message_update` carries the whole message per frame; subagent progress copies two Maps per frame; `turn_end` fires 4 RPCs per round
  - low, from code reading: AgentHubScreen 1s tick re-renders the tree; HubTranscript 1s poll ignores hidden tab and idle agents; Wren rebuilds state on unchanged notify; Wren disable+enable race can run two poll loops
  - bench/ is committed; `bench/browser-render-results.json` and `dist-bench/` are gitignored
- tmux + fish thing is quite fragile outside of my workflows

- actual UX designed for agentic harness, all new synthesis of existing harnesses and human-ai-computer interfaces.


- [wip] maska UX 

## Deferred
- notifs popping up all the time 
- transcript cache: entries rewritten in place on load, fork, and rewrite paths (`session-manager.ts:3652`, `:3708`, migrations) can leave a stale cached copy until the next branch change; the cache handles only the general append case
- css skin: dark (graphite), fonts and desktop layout done 2026-10-02; light theme still the old brand palette
- achieve parity with TUI (depends on the feature, maybe prio /tree and /fork?)
