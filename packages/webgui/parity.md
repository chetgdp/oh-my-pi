# OMP TUI vs Web GUI Feature Parity

**Audited**: 2026-10-06 re-audit, every row re-verified against current
code (one read-only scout per group, no runtime check). Previous audit
2026-09-27, rescored 2026-09-30 (Agent Hub and focused-agent rows added
to Group 7) and 2026-10-02. Supersedes the 2026-09-24 inventory.

**Goal**: full parity. The gap list below is every item between the
current GUI and 100%. Priority is picked from it by the user.

## Scoreboard

| Rows | Done | Partial | Missing | N/A |
| ---: | ---: | ---: | ---: | ---: |
| 130 | 73 | 34 | 23 | 9 |

Done is 73 of 130 counted rows (56.2%; 57.4% on 2026-10-02, 50.0% on
2026-09-27). Plus 52 uninventoried items at the end of the gap list, for
109 gap items in total. N/A rows are listed in their groups and in "Left
out of the count", excluded from all totals.

### Core tier

Core is the rows a normal phone session depends on. It is the target for
PLAN.md item 6.

- In: every row of groups 1 (Prompting), 2 (Models), 3 (Transcript),
  4 (Sessions), 6 (Usage), 7 (Subagents) and 8 (Todos); plus Manual
  compact, Handoff, Context breakdown, Auto-compaction toggle (group 5),
  Plan mode toggle, Plan review sheet, Retry failed turn (group 9) and
  Export HTML (group 12).
- Out (Extended): slash-only power commands `/pin`, `/fresh`, `/move`,
  `/wt`, workspace dirs, `/restart`, `/jobs`, stats/trace links; prompt
  actions (`#<action>`); swarm navigation; every other row of groups 5,
  9 to 13. Uninventoried gap items are not scored.

| Core rows | Done | Partial | Missing | Score |
| ---: | ---: | ---: | ---: | ---: |
| 83 | 68 | 9 | 6 | 81.9% |

Scored 2026-10-06. Core rows not Done: `@file`/`@git` mentions, Ctrl+R
history search, transcript search, `/tree` browser, `/fork`, `/btw` while
focused (Missing); follow-up chord, Shift+Tab thinking cycle, delete
current session, context breakdown, auto-compaction toggle, live
TPS/TTFT, todo append/remove, todo import/export, Export HTML (Partial).

## Legend

- **Done**: dedicated GUI control or view works.
- **Partial**: reachable only by typing a slash command in the composer,
  or a subset of the TUI behaviour.
- **Missing**: not reachable from the GUI.
- **N/A**: excluded by a fixed decision or a non-goal (see bottom).
- **RPC**: `ready` = command/frame exists in `modes/rpc/rpc-types.ts` or
  `rpc-fork-types.ts`; `gap` = coding-agent work needed; `—` = client-only.

Paths are relative to `packages/webgui/src/` unless they start with a
package name. Line numbers are from the 2026-10-06 audit.

---

## Group 1: Prompting & Interaction

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Text prompt submission | Done | `composer/Composer.tsx:97-111`, `App.tsx:423,510`, `session-actions.ts:40` | ready |
| Mid-turn steer | Done | `Composer.tsx:392`, `App.tsx:503-504`, `session-actions.ts:53` | ready |
| Queue follow-up | Done | `Composer.tsx:402`, `App.tsx:505-506`, `session-actions.ts:62` | ready |
| Abort turn | Done | `Composer.tsx:411`, `App.tsx:531,542`, `session-actions.ts:71,75` | ready |
| Image attach (upload, paste) | Done | `Composer.tsx:246,259,264,358` | ready |
| Slash command autocomplete | Done | `SlashAutocomplete.tsx:12-46`, `Composer.tsx:140,291-294` | ready |
| Prompt history Up/Down | Done | `Composer.tsx:154-197`, `useComposerKeyboard.ts:31-47`, `prompt-history.ts:92-144` | — |
| `@file` / `@git` mention completion | Missing | `Composer.tsx:140` only handles `/`; no file listing RPC | gap |
| Prompt history search (Ctrl+R) | Missing | no handler; `useComposerKeyboard.ts:33` ignores ctrl | — |
| Prompt actions (`#<action>`) | Missing | no `#` parsing in `components/composer/`; TUI actions are editor-local | — |
| Follow-up chord (Ctrl+Enter / Ctrl+Q) | Partial | Queue radio `Composer.tsx:402` only; `useComposerKeyboard.ts:7-12` | — |
| External editor (Ctrl+G) | N/A | no `$EDITOR` in a browser | — |

## Group 2: Model, Thinking & Roles

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Session-only model pick (`/switch`, alt+p) | Done | `useModelsHub.tsx:100-109,253-320`, `StatusStrip.tsx:75`; alt+p not bound | ready |
| Persistent default model (`/model`) | Done | `useModelsHub.tsx:260-285`, `ModelPickerSheet.tsx:241` | ready |
| Cycle roles (Ctrl+P / Shift+Ctrl+P) | Done | `App.tsx:388-406`, `useModelsHub.tsx:376-385`, `ActiveSection.tsx:74-96` | ready |
| Model provenance (`modelSource`) | Done | `ActiveSection.tsx:14-44` | ready |
| Model browser (providers, TPS/TTFT, roles, kinds) | Done | `ModelPickerSheet.tsx:151,378-430` | ready |
| Locked provider + OAuth login | Done | `ProvidersSection.tsx:119,145-151,188-195`, `useModelsHub.tsx:197-235`, `LoginSheet.tsx:233-241` | ready |
| Provider refresh | Done | `ProvidersSection.tsx:95-102,170-173`, `useModelsHub.tsx:357-372` | ready |
| Role management (assign, scope, custom, cycle order) | Done | `RolesSection.tsx:34-150`, `RoleRow.tsx:15-55`, `CycleOrderEditor.tsx:15-90` | ready |
| Agent config (enable, model, tier, prewalk, advisor) | Done | `AgentsSection.tsx`, `models/AgentRow.tsx:9-12,102,124-155`, `useModelsHub.tsx:448-530` | ready |
| Thinking level select + cycle (Shift+Tab) | Partial | picker `ModelPickerSheet.tsx:645-660`; no Shift+Tab, `cycle_thinking_level` unused | ready |

## Group 3: Transcript & Rendering

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Streaming Markdown | Done | `Transcript.tsx:84-96`, `Markdown.tsx`, `transcript-model.ts:436` | ready |
| Thinking display + toggle | Done | `ThinkingRow.tsx:14-22`, `Transcript.tsx:97-98` | ready |
| Tool output expand toggle | Done | `StatusStrip.tsx:138-141,215-218`, `ToolCard.tsx:37` | ready |
| Diff rendering | Done | `tool-views/tools/edit.tsx:182`, `parts.tsx:244-290` | ready |
| Inline images | Done | `Transcript.tsx:84-96`, `UserRow.tsx:14-20`, `parts.tsx:199-217` | ready |
| Specialized tool views (29) | Done | `tool-views/tools/`, `registry.ts:37-83` | ready |
| Jump to bottom + unread badge | Done | `Transcript.tsx:343-347,391-395` | — |
| Virtualized scroll + history paging | Done | `Transcript.tsx:233-345`, `session-store.ts:1068-1070`, v3 `history` | ready |
| v3 incremental deltas | Done | `coding-agent/src/modes/rpc/rpc-v3.ts:350-373`, `transcript-model.ts:366-623` | ready |
| Copy buttons (fences, output, diff) | Done | `CopyButton.tsx:12`, `Markdown.tsx:247-249,301-328`, `parts.tsx:122,264` | — |
| Live activity shimmer | Done | `Transcript.tsx:155-158`, `transcript-model.ts:1291-1292` | ready |
| Search within transcript | Missing | no search UI | — |

## Group 4: Session Lifecycle & Branching

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Live vs past session list | Done | `SessionsScreen.tsx:395-465`, `sessions-api.ts:62,66` | — |
| New session with cwd | Done | `NewSession.tsx:29-81`, `server/launch.ts:59,152`; in-session `TopBar.tsx:150-153` | ready |
| Resume past session | Done | `SessionRow.tsx:135`, `SessionsScreen.tsx:178-227`, `server/launch.ts:102-119` | — |
| Shutdown live session | Done | `SessionRow.tsx:24-95`, `server/shutdown.ts:12-98` | ready |
| Rename | Done | `TopBar.tsx:218-222,426-460`, `App.tsx:563-577`, `session-actions.ts:293` | ready |
| Rewind to message | Done | `UserRow.tsx:61-102`, `App.tsx:580-588`, `session-actions.ts:297` | ready |
| Clear context (`/clear`) | Done | `TopBar.tsx:108-116,377`, `session-actions.ts:317` | ready |
| Delete session | Partial | past: `SessionRow.tsx:118-152`, `server/past.ts:181-228`; current: none, `/delete` is `handleTui` only (`builtin-lifecycle.ts:243-250`) | gap |
| Branch tree browser (`/tree`) | Missing | no UI; `get_tree` `rpc-types.ts:65`; `navigateTree` not in RPC | browse ready, navigate gap |
| Fork from message (`/fork`) | Missing | no UI; `fork` `rpc-types.ts:115`, `rpc-server.ts:975-981` (idle only) | ready |
| Pin session (`/pin`) | Partial | slash only, `builtin-lifecycle.ts:450-477` | ready |
| Fresh provider state (`/fresh`) | Partial | slash only, `builtin-lifecycle.ts:198-217` | ready |
| Move session (`/move`) | Partial | slash only, `builtin-lifecycle.ts:740-766` | ready |
| Worktree (`/wt`) | Partial | slash only, `builtin-lifecycle.ts:770-803` | ready |
| Workspace dirs (`/add-dir`, `/remove-dir`, `/dirs`) | Partial | slash only, `builtin-lifecycle.ts:805-873` | ready |
| Restart with flags (`/restart`) | Missing | `handleTui` only, `builtin-lifecycle.ts:880-887` | gap |

## Group 5: Context, Memory & Compaction

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Manual compact | Done | `TopBar.tsx:92-98,138-140,361`, `session-actions.ts:301` | ready |
| Handoff | Done | `TopBar.tsx:100-106,142-144,369`, `session-actions.ts:307` | ready |
| Context breakdown (`/context`) | Partial | % in `StatusStrip.tsx:69-70,87-90`, bar in `UsageScreen.tsx:176-184,243-275`; categories slash only (`builtin-session.ts:533-547`) | ready (structured gap) |
| Auto-compaction toggle | Partial | `set_auto_compaction` unused; `session-store.ts:1119-1124` reads `isCompacting` only | ready |
| Shake (`/shake`) | Partial | slash only, `builtin-lifecycle.ts:318-343` | ready |
| Extended context (`/extended-context`) | Partial | slash only, `builtin-modes.ts:660-684` | gap |
| Memory inspect/sync (`/memory`) | Partial | slash only, `builtin-lifecycle.ts:573-660` | ready |
| Mental models (`/memory mm`) | N/A | unsupported over RPC (`builtin-lifecycle.ts:648-650`) | — |

## Group 6: Usage, Status & Metrics

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Session cost | Done | `shell/StatusStrip.tsx:20,124`, `App.tsx:697` | ready |
| Context gauge | Done | `StatusStrip.tsx:69-70,90,195`, `lib/context-usage.ts:12-31` | ready |
| Streaming/compacting indicator | Done | `StatusStrip.tsx:125-131,205-208` | ready |
| Usage screen (`/usage`) | Done | `usage/UsageScreen.tsx:124-125`, `TopBar.tsx:350`, `focus-model.ts:300` | ready |
| Reset credit redeem | Done | `UsageScreen.tsx:158-173,439-491`, `session-actions.ts:336-341` | ready |
| Token counts (in/out/cache) | Done | `UsageScreen.tsx:287-301`, total in `App.tsx:1016` | ready |
| Fast tier toggle (`/fast`) | N/A | not wanted in the GUI | ready |
| Live TPS / TTFT | Partial | `tokensPerSecond` in state and per-message `ttft`/`duration` on the wire, not rendered | ready |
| Background jobs (`/jobs`) | Partial | slash only, `builtin-session.ts:324-382`; no jobs command | gap |
| Stats / trace links | Partial | slash only, `builtin-session.ts:431-458`, `builtin-collaboration.ts:204-224` | ready |

## Group 7: Subagents

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Tree list + nesting | Done | `agent-hub/HubTree.tsx:32`, `lib/agent-hub-model.ts` `buildHubRows` | ready |
| Status dot | Done | `HubTree.tsx:36`, `agents/PinnedSubagents.tsx` `pa-dot`, `HubDetail.tsx` | ready |
| Activity / tool / duration | Done | `HubTree.tsx:42`, `HubDetail.tsx` "Now", `PinnedSubagents.tsx` | ready |
| Tokens / cost | Done | `HubTree.tsx:45-49`, `HubDetail.tsx` "Usage", `AgentHubScreen.tsx` totals | ready |
| Task expansion | Done | `HubDetail.tsx` "Task", `tool-views/tools/task.tsx:156-216` | ready |
| TopBar badge | Done | `TopBar.tsx:315-325`, `App.tsx:630` | ready |
| Agent Hub screen (route `#/s/<id>/hub[/<agent>]`, Alt+A, TopBar Bot) | Done | `route.ts:49-54,72`, `App.tsx:379-386`, `TopBar.tsx:178-185` | ready |
| Hub roster incl. parked/aborted, filter, tree/flat toggle, virtualized rows | Done | `HubTree.tsx:8`, `AgentHubScreen.tsx`, `session-store.ts:433-443` | ready |
| Hub detail: status, retry, usage + context gauge, lineage, changes, recent | Done | `agent-hub/HubDetail.tsx` | ready |
| Subagent transcript viewer (1s byte-cursor poll while open) | Done | `agent-hub/HubTranscript.tsx`, `rpc-types.ts:72` | ready |
| Kill / revive / steer agent | Done | `session-actions.ts:364-396`, `HubTranscript.tsx:94-108` | ready |
| Focus agent in main view (route `#/s/<id>/agent/<agentId>`, revive parked, stale request drop, "Viewing agent" toast, Esc clear-then-Main) | Done | `route.ts:55-58,73-75`, `session-store.ts:580-643`, `App.tsx:779` | ready |
| Focused live stream (`subagent_event` ids filter) and history cursor | Done | `session-store.ts:80,487`, `focus-model.ts:151` | ready |
| Focused submit: steer/followUp, empty submit interrupts, command gating, dimmed editor and status strip | Done | `App.tsx:431-440,536-539`, `Composer.tsx:100-102`, `focus-model.ts:295-308`, `StatusStrip.tsx:163` | ready |
| Auto-detach to Main when focused agent is gone/parked/aborted | Done | `session-store.ts:523` `checkFocusWatch`, `App.tsx:346` | ready |
| Pinned subagents list in desktop inspector (all agents newest first, per-card dismiss, "Clear all", click focuses, hub button) | Done | `agents/PinnedSubagents.tsx`, `lib/pinned-subagents-model.ts`, `App.tsx:660,906` | ready |
| Task-card and Hub Enter entry points focus (nested cards clickable) | Done | `App.tsx:330-334`, `parts.tsx:302`, `focus-model.ts:248`, `task.tsx:116,253,318` | ready |
| Focused todos (read-only), running-tool replay (`snapshots`), images (`steer_agent images`) | Done | `focus-model.ts:223`, `session-store.ts:316-317,496-498`, `rpc-agent-roster.ts:30-43` | ready |
| `/export` while focused | Done | `focus-model.ts:283,295-304`, `App.tsx:441-465`, `server/export.ts:82-109` | ready |
| `/btw` while focused (history, follow-ups) | Missing | refused by `focus-model.ts:283-304`; `btw` has no `agentId` (`rpc-types.ts:143-145`) | gap |
| Task card agent link focuses that agent (Hub transcript inside the Hub) | Done | `App.tsx:330-334`, `AgentHubScreen.tsx:78-85` | ready |
| Swarm navigation (Horizon B) | Missing | `PLAN.md:14-16,224`, no design yet | gap |

## Group 8: Todos

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Todo tool card | Done | `tool-views/tools/todo.tsx:82-166`, `transcript-model.ts:1110` | ready |
| Todo panel with tap-to-set | Done | `TodoPanel.tsx:44-130`, `App.tsx:653-656,827-849`, `session-store.ts:1471-1478` | ready |
| Progress in status strip | Done | `StatusStrip.tsx:26-53,93,198`, `todo-model.ts:114` | ready |
| Append / remove todos | Partial | status only in `TodoPanel.tsx`; add/rm slash only (`builtin-session.ts:207-236`) | ready |
| Import / export | Partial | slash only, `helpers/todo.ts:246-270` | ready |
| Edit in `$EDITOR` | N/A | no editor in a browser | — |

## Group 9: Execution Modes

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Plan mode toggle | Done | `StatusStrip.tsx:94-119`, `App.tsx:709-716`, `coding-agent/.../rpc-plan.ts:139` | ready |
| Plan review sheet | Done | `PlanReviewSheet.tsx:18,66,185-189`, `session-actions.ts:351-362`, `rpc-plan.ts:193` | ready |
| Retry failed turn | Done | `Transcript.tsx:142-151`, `App.tsx:592-600`, `session-actions.ts:321-323` | ready |
| Goal mode (`/goal`) | Missing | `handleTui` only `builtin-modes.ts:376-400`; `goal` RPC `rpc-types.ts:56-61` unused | ready (budget adjust gap) |
| Guided goal (`/guided-goal`) | Missing | `handleTui` only `builtin-modes.ts:401-411` | gap |
| Vibe (`/vibe`) | Missing | `handleTui` only `builtin-modes.ts:357-374` | gap |
| Loop (`/loop`) | Missing | `handleTui` only `builtin-modes.ts:413-438` | gap |
| Cleanse (`/cleanse`) | Missing | `handleTui` only `builtin-lifecycle.ts:517-527` | gap |
| OMFG (`/omfg`) | Missing | `handleTui` only `builtin-lifecycle.ts:505-515` | gap |
| BTW (`/btw`) | Partial | typed `/btw <q>` only, `App.tsx:478-499`, `BtwSheet.tsx:20-252`; RPC `btw`, `btw_cancel`, `get_btw_history`; no bare-`/btw` history, no branch | ready (branch gap) |
| Tangent agent (`/tan`) | Missing | `handleTui` only `builtin-lifecycle.ts:493-503` | gap |
| Security scan (`/security`) | Partial | slash only, `builtin-modes.ts:277-297` | ready |

## Group 10: Extensibility

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Skills registry (`/skills`) | Missing | `handleTui` only, `builtin-skills.ts:80` | gap |
| Extensions dashboard (`/extensions`) | Missing | `handleTui` only, `builtin-session.ts:553-560` | gap |
| `/skillful` | Partial | slash only, `builtin-modes.ts:605,618` | ready |
| `/marketplace` | Partial | slash only, `builtin-marketplace.ts:45,67` | ready |
| `/plugins` | Partial | slash only, `builtin-marketplace.ts:425,437` | ready |
| `/reload-plugins` | Partial | slash only, `builtin-marketplace.ts:557,561` | ready |
| `/mcp` | Partial | slash only, `builtin-session.ts:696,729`; reauth/unauth/smithery login/reconnect/notifications TUI only (`helpers/mcp.ts:486`) | ready |
| `/tools` | Partial | slash only, `builtin-session.ts:505,514` | ready |
| `/force:<tool>` | Partial | slash only, `builtin-control.ts:9,19` | ready |

## Group 11: Direct Execution & Dev Tools

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Host bash (`!`, `!!`) | Missing | no `!` composer mode, `bash` RPC never sent (`rpc-server.ts:2536-2538`); `!!` options not passed | ready |
| Python eval (`$`, `$$`) | Missing | tool card only (`registry.ts:48-49`); no python/eval RPC command | gap |
| `/computer` | Partial | slash only, `builtin-modes.ts:688,700` | ready |
| `/browser` | Partial | slash only, `builtin-collaboration.ts:497` | ready |
| `/ssh` | Partial | slash only, `builtin-lifecycle.ts:153,170` | ready |
| `/debug` | Missing | `handleTui` only, `builtin-lifecycle.ts:565` | gap |
| `/pause` | Missing | `handleTui` only, `builtin-control.ts:77` | gap |

## Group 12: Sharing & Audio

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Export HTML (`/export`) | Partial | download from focused view only: `App.tsx:441-466`, `server/export.ts:82,106-170` via `export_html`; no button; Main `/export` prints a server path | ready |
| Dump transcript (`/dump`) | Partial | slash only, `builtin-collaboration.ts:230-283` | ready |
| Share link (`/share`) | Partial | slash only, `builtin-collaboration.ts:284-309` | ready |
| Join collab (`/join`, `/leave`) | Missing | `handleTui` only, `builtin-collaboration.ts:439,471` | gap |
| Collab hosting (`/collab`) | N/A | non-goal | — |
| Push-to-talk | N/A | non-goal | — |
| Voice mode (`/live`) | N/A | non-goal | — |
| Recording (`/record`) | N/A | terminal frame capture | — |

## Group 13: Layout & Touch

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Touch targets >= 44px | Done | `styles/tokens.css:64` | — |
| iOS visualViewport / keyboard | Done | `App.tsx:123-160` | — |
| Auto-grow textarea | Done | `composer/Composer.tsx:215-225` | — |
| Responsive breakpoints | Done | `lib/layout.ts:9-13`, `AppShell.tsx:48-105` | — |
| Subagent badge + navigation | Done | `TopBar.tsx:177-185,315-325` | — |
| Idle recap | Partial | sessions page (phone list + desktop main-menu cards), `server/live.ts:9-17,82-110`, `SessionRow.tsx:70-75`; hidden in the desktop sidebar (`sessions.css:151`); not in session view | — |
| Settings hub (`/settings`) | N/A | non-goal | — |

## Gap list to 100%

Every Partial and Missing row above, then the uninventoried items.
Partial usually means reachable only by typing a slash command.

| # | Group | Item | State | RPC |
| -: | :--- | :--- | :-: | :-: |
| 1 | Prompting & Interaction | `@file` / `@git` mention completion | Missing | gap |
| 2 | Prompting & Interaction | Prompt history search (Ctrl+R) | Missing | — |
| 3 | Prompting & Interaction | Prompt actions (`#<action>`) | Missing | — |
| 4 | Prompting & Interaction | Follow-up chord (Ctrl+Enter / Ctrl+Q) | Partial | — |
| 5 | Model, Thinking & Roles | Thinking level select + cycle (Shift+Tab) | Partial | ready |
| 6 | Transcript & Rendering | Search within transcript | Missing | — |
| 7 | Session Lifecycle & Branching | Delete session | Partial | gap |
| 8 | Session Lifecycle & Branching | Branch tree browser (`/tree`) | Missing | browse ready, navigate gap |
| 9 | Session Lifecycle & Branching | Fork from message (`/fork`) | Missing | ready |
| 10 | Session Lifecycle & Branching | Pin session (`/pin`) | Partial | ready |
| 11 | Session Lifecycle & Branching | Fresh provider state (`/fresh`) | Partial | ready |
| 12 | Session Lifecycle & Branching | Move session (`/move`) | Partial | ready |
| 13 | Session Lifecycle & Branching | Worktree (`/wt`) | Partial | ready |
| 14 | Session Lifecycle & Branching | Workspace dirs (`/add-dir`, `/remove-dir`, `/dirs`) | Partial | ready |
| 15 | Session Lifecycle & Branching | Restart with flags (`/restart`) | Missing | gap |
| 16 | Context, Memory & Compaction | Context breakdown (`/context`) | Partial | ready (structured gap) |
| 17 | Context, Memory & Compaction | Auto-compaction toggle | Partial | ready |
| 18 | Context, Memory & Compaction | Shake (`/shake`) | Partial | ready |
| 19 | Context, Memory & Compaction | Extended context (`/extended-context`) | Partial | gap |
| 20 | Context, Memory & Compaction | Memory inspect/sync (`/memory`) | Partial | ready |
| 21 | Usage, Status & Metrics | Live TPS / TTFT | Partial | ready |
| 22 | Usage, Status & Metrics | Background jobs (`/jobs`) | Partial | gap |
| 23 | Usage, Status & Metrics | Stats / trace links | Partial | ready |
| 24 | Subagents | `/btw` while focused (history, follow-ups) | Missing | gap |
| 25 | Subagents | Swarm navigation (Horizon B) | Missing | gap |
| 26 | Todos | Append / remove todos | Partial | ready |
| 27 | Todos | Import / export | Partial | ready |
| 28 | Execution Modes | Goal mode (`/goal`) | Missing | ready (budget adjust gap) |
| 29 | Execution Modes | Guided goal (`/guided-goal`) | Missing | gap |
| 30 | Execution Modes | Vibe (`/vibe`) | Missing | gap |
| 31 | Execution Modes | Loop (`/loop`) | Missing | gap |
| 32 | Execution Modes | Cleanse (`/cleanse`) | Missing | gap |
| 33 | Execution Modes | OMFG (`/omfg`) | Missing | gap |
| 34 | Execution Modes | BTW (`/btw`) | Partial | ready (branch gap) |
| 35 | Execution Modes | Tangent agent (`/tan`) | Missing | gap |
| 36 | Execution Modes | Security scan (`/security`) | Partial | ready |
| 37 | Extensibility | Skills registry (`/skills`) | Missing | gap |
| 38 | Extensibility | Extensions dashboard (`/extensions`) | Missing | gap |
| 39 | Extensibility | `/skillful` | Partial | ready |
| 40 | Extensibility | `/marketplace` | Partial | ready |
| 41 | Extensibility | `/plugins` | Partial | ready |
| 42 | Extensibility | `/reload-plugins` | Partial | ready |
| 43 | Extensibility | `/mcp` | Partial | ready |
| 44 | Extensibility | `/tools` | Partial | ready |
| 45 | Extensibility | `/force:<tool>` | Partial | ready |
| 46 | Direct Execution & Dev Tools | Host bash (`!`, `!!`) | Missing | ready |
| 47 | Direct Execution & Dev Tools | Python eval (`$`, `$$`) | Missing | gap |
| 48 | Direct Execution & Dev Tools | `/computer` | Partial | ready |
| 49 | Direct Execution & Dev Tools | `/browser` | Partial | ready |
| 50 | Direct Execution & Dev Tools | `/ssh` | Partial | ready |
| 51 | Direct Execution & Dev Tools | `/debug` | Missing | gap |
| 52 | Direct Execution & Dev Tools | `/pause` | Missing | gap |
| 53 | Sharing & Audio | Export HTML (`/export`) | Partial | ready |
| 54 | Sharing & Audio | Dump transcript (`/dump`) | Partial | ready |
| 55 | Sharing & Audio | Share link (`/share`) | Partial | ready |
| 56 | Sharing & Audio | Join collab (`/join`, `/leave`) | Missing | gap |
| 57 | Layout & Touch | Idle recap | Partial | — |
| 58 | Prompting | `@model` mentions | Missing | ? |
| 59 | Prompting | Large-paste staging as attachment | Missing | ? |
| 60 | Prompting | Raw paste / copy prompt | Missing | ? |
| 61 | Models | Session `/prewalk [restart]` | Missing | ? |
| 62 | Transcript | `/copy` picker | Missing | ? |
| 63 | Transcript | `/open` last link | Missing | ? |
| 64 | Transcript | Cache-invalidation marker | Missing | ? |
| 65 | Transcript | Grouped read cards | Missing | ? |
| 66 | Transcript | Message reactions | Missing | ? |
| 67 | Sessions | `/session pin <account>` | Missing | ? |
| 68 | Metrics | Cache hit rate (read/write tokens are in the Token counts row) | Missing | ? |
| 69 | Metrics | Session time spent | Missing | ? |
| 70 | Metrics | Inline usage segment | Missing | ? |
| 71 | Subagents | Activity timeline | Missing | ? |
| 72 | Subagents | Persisted subagents across restarts | Missing | ? |
| 73 | Todos | `/todo copy` | Missing | ? |
| 74 | Todos | Todo expand/collapse | Missing | ? |
| 75 | Todos | Highlight todo worked by a subagent | Missing | ? |
| 76 | Todos | Todo auto-clear | Missing | ? |
| 77 | Other | Host tools / URI schemes | Missing | ? |
| 78 | Other | `/advisor dump` | Missing | ? |
| 79 | Prompting | Word-completion ghost text (`predict_word`) | Missing | ready |
| 80 | Prompting | Dequeue last queued message (Alt+Up / Shift+Up) | Partial | ready |
| 81 | Prompting | Promote queued follow-up to steer | Missing | ready |
| 82 | Prompting | Queue shorthand (`parseQueueShorthand`) | Missing | — |
| 83 | Prompting | Emoticon/emoji expansion and autocomplete | Missing | — |
| 84 | Prompting | `#<number>` GitHub-ref / internal-URL completion | Missing | gap |
| 85 | Prompting | Bare slash-command confirm (`input.bareSlashCommands`) | Missing | — |
| 86 | Prompting | Slash argument/subcommand completion, input hints, usage ranking | Partial | ready |
| 87 | Prompting | Double-Esc backtrack chord | Partial | — |
| 88 | Models | Model presets (`/modelpreset`) | Partial | ready |
| 89 | Transcript | Global hide-thinking setting (Ctrl+T, prose-only, expand) | Missing | — |
| 90 | Transcript | Hide tool activity (Ctrl+Shift+O) | Missing | — |
| 91 | Transcript | Auto-retry countdown, cancel, fallback notice | Missing | ready |
| 92 | Sessions | `/resume <id>` and `@claude`/`@codex` import | Missing | gap |
| 93 | Sessions | `/rename` with no title (auto title) | Missing | gap |
| 94 | Sessions | `/session info` | Partial | ready |
| 95 | Context | Compact modes and focus instructions | Partial | ready |
| 96 | Context | Handoff custom instructions | Missing | ready |
| 97 | Metrics | Slow tier (`/slow`) | Partial | ready |
| 98 | Todos | `/todo start\|done\|drop` and phase-level bulk change | Partial | ready |
| 99 | Todos | Todo reminder | Missing | ? |
| 100 | Execution Modes | `/ratchet` | Partial | ready |
| 101 | Extensibility | Dynamic skill/extension/custom/MCP-prompt commands (no source label) | Partial | ready |
| 102 | Direct Execution | Cancel a user-run host shell (`abort_bash`) | Missing | ready |
| 103 | Direct Execution | Cancel a user-run eval (`abortEval`) | Missing | gap |
| 104 | Sharing | `/dump all` zip | Partial | ready |
| 105 | Sharing | `/export --themes [path]` | Missing | gap |
| 106 | Other | `/changelog` | Partial | ready |
| 107 | Other | `/hotkeys` shortcut list | Missing | gap |
| 108 | Other | Queue-mode, retry and cache settings (`set_steering_mode` etc.) | Missing | ready |
| 109 | Other | Extension UI requests and `ask` dialog | Partial: select, confirm, input, editor, and tool approvals; rich `ask` missing | ready |

Webgui-only, no TUI parity row: Wren TTS speak buttons and voice toggle
(`shell/VoiceToggle.tsx`, `transcript/SpeakButton.tsx`, `lib/wren.ts`);
the TUI counterpart is the vocalizer.

## Left out of the count (N/A)

Listed for completeness. Not in the scoreboard totals and not in the gap
list.

| Item | Reason |
| :--- | :--- |
| External editor (Ctrl+G) | no `$EDITOR` in a browser |
| Mental models (`/memory mm`) | unsupported over RPC (`builtin-lifecycle.ts:648-650`) |
| Fast tier toggle (`/fast`) | not wanted in the GUI |
| Edit in `$EDITOR` | no editor in a browser |
| Collab hosting (`/collab`) | non-goal |
| Push-to-talk | non-goal |
| Voice mode (`/live`) | non-goal |
| Recording (`/record`) | terminal frame capture |
| Settings hub (`/settings`) | non-goal |
| Git split diff / staging (`/git`) | non-goal; not a table row |

Earlier non-goal reasoning:

1. Full settings overlay: 80+ terminal-centric settings on 390px. Models
   hub covers daily configuration.
2. Git split diff / staging UI: needs a wide display; edit cards show
   per-file diffs.
3. Collab relay hosting: separate architecture; the daemon already relays.
4. Voice and push-to-talk: audio permissions and streaming over cellular.
5. Mental model bank: unsupported over RPC by design.
6. `$EDITOR` invocation and terminal recording: no meaning in a browser.

REPLs (`!`, `$`), `/debug` and `/pause` were non-goals in the previous
inventory; they are now tracked as gap rows.

## Concurrent TUI driving

- TUI and phone both submit commands; `AgentSession` orders them. Model
  changes in either client emit `config_update` (`rpc-config-feed.ts`).
- A steer or model switch from the phone during a TUI-streamed turn applies
  at the next turn boundary. Preserve this.
