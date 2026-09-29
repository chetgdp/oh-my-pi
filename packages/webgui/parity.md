# OMP TUI vs Web GUI Feature Parity

**Audited**: 2026-09-27, every row re-verified against current code (one
read-only scout per group). Supersedes the 2026-09-24 inventory.

**Goal**: full parity. The gap list below is every item between the
current GUI and 100%. Priority is picked from it by the user.

## Scoreboard

| Rows | Done | Partial | Missing | N/A |
| ---: | ---: | ---: | ---: | ---: |
| 116 | 58 | 35 | 23 | 10 |

Plus 25 uninventoried Missing items at the end of the gap list, for 83
gap items in total. N/A rows are listed in their groups and in "Left out
of the count", excluded from all totals.

## Legend

- **Done**: dedicated GUI control or view works.
- **Partial**: reachable only by typing a slash command in the composer,
  or a subset of the TUI behaviour.
- **Missing**: not reachable from the GUI.
- **N/A**: excluded by a fixed decision or a non-goal (see bottom).
- **RPC**: `ready` = command/frame exists in `modes/rpc/rpc-types.ts`;
  `gap` = coding-agent work needed; `—` = client-only.

Paths are relative to `packages/webgui/src/` unless they start with a
package name. Line numbers are from the 2026-09-27 audit.

---

## Group 1: Prompting & Interaction

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Text prompt submission | Done | `Composer.tsx:84`, `session-actions.ts:45` | ready |
| Mid-turn steer | Done | `Composer.tsx:327`, `session-actions.ts:54` | ready |
| Queue follow-up | Done | `Composer.tsx:337`, `session-actions.ts:62` | ready |
| Abort turn | Done | `Composer.tsx:348`, `session-actions.ts:70` | ready |
| Image attach (upload, paste) | Done | `Composer.tsx:174,187,311` | ready |
| Slash command autocomplete | Done | `SlashAutocomplete.tsx` | ready |
| Prompt history Up/Down | Done | `Composer.tsx:265-288`, `useComposerKeyboard.ts:37`, `prompt-history.ts:67` | — |
| `@file` / `@git` mention completion | Missing | `Composer.tsx:109` only handles `/` | gap |
| Prompt history search (Ctrl+R) | Missing | no handler in `useComposerKeyboard.ts` | — |
| Prompt actions (`#<action>`) | Missing | no `#` parsing in `Composer.tsx` | gap |
| Follow-up chord (Ctrl+Enter / Ctrl+Q) | Partial | Queue button only; `useComposerKeyboard.ts:8` | — |
| External editor (Ctrl+G) | N/A | no `$EDITOR` in a browser | — |

## Group 2: Model, Thinking & Roles

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Session-only model pick (`/switch`, alt+p) | Done | `useModelsHub.tsx:95-103`, `ModelPickerSheet.tsx:180-285` | ready |
| Persistent default model (`/model`) | Done | `useModelsHub.tsx:269-296`, `ModelPickerSheet.tsx:187,274` | ready |
| Cycle roles (Ctrl+P / Shift+Ctrl+P) | Done | `App.tsx:260-269`, `ActiveSection.tsx:55-79` | ready |
| Model provenance (`modelSource`) | Done | `ActiveSection.tsx:25-33` | ready |
| Model browser (providers, TPS/TTFT, roles, kinds) | Done | `ModelPickerSheet.tsx:182-410` | ready |
| Locked provider + OAuth login | Done | `LoginSheet.tsx`, `ProvidersSection.tsx:90-160` | ready |
| Provider refresh | Done | `ProvidersSection.tsx:78-95` | ready |
| Role management (assign, scope, custom, cycle order) | Done | `RolesSection.tsx`, `RoleRow.tsx`, `CycleOrderEditor.tsx` | ready |
| Agent config (enable, model, tier, prewalk, advisor) | Done | `AgentsSection.tsx`, `models/AgentRow.tsx` | ready |
| Thinking level select + cycle (Shift+Tab) | Partial | picker `ModelPickerSheet.tsx:645-660`; no Shift+Tab, `cycle_thinking_level` unused | ready |

## Group 3: Transcript & Rendering

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Streaming Markdown | Done | `Transcript.tsx`, `Markdown.tsx` | ready |
| Thinking display + toggle | Done | `ThinkingRow.tsx` | ready |
| Tool output expand toggle | Done | `StatusStrip.tsx`, `ToolCard.tsx` | ready |
| Diff rendering | Done | `tool-views/tools/edit.tsx`, `parts.tsx:264` | ready |
| Inline images | Done | `Transcript.tsx:55`, `UserRow.tsx:14` | ready |
| Specialized tool views (29) | Done | `tool-views/tools/`, `registry.ts:37-79` | ready |
| Jump to bottom + unread badge | Done | `Transcript.tsx:352-357` | — |
| Virtualized scroll + history paging | Done | `Transcript.tsx:210-330`, v3 `history` | ready |
| v3 incremental deltas | Done | `coding-agent/src/modes/rpc/rpc-v3.ts`, `transcript-model.ts:210` | ready |
| Copy buttons (fences, output, diff) | Done | `CopyButton.tsx`, `Markdown.tsx:273-301`, `parts.tsx:122,264` | — |
| Live activity shimmer | Done | `Transcript.tsx:141`, `StatusStrip.tsx` | ready |
| Search within transcript | Missing | no search UI | — |

## Group 4: Session Lifecycle & Branching

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Live vs past session list | Done | `SessionsScreen.tsx:288-325` | — |
| New session with cwd | Done | `NewSession.tsx`, `server/launch.ts:32`; in-session `TopBar.tsx:150` | ready |
| Resume past session | Done | `SessionRow.tsx:90-95`, `server/launch.ts:60` | — |
| Shutdown live session | Done | `SessionRow.tsx:30-52`, `server/shutdown.ts:20` | ready |
| Rename | Done | `TopBar.tsx:212-216,418-452`, `session-actions.ts:272` | ready |
| Rewind to message | Done | `UserRow.tsx:30-78`, `session-actions.ts:276` | ready |
| Clear context (`/clear`) | Done | `TopBar.tsx:107-115,368-372`, `session-actions.ts:296` | ready |
| Delete session | Partial | past: `SessionRow.tsx:133-144`, `DELETE /api/past/:id`; current: slash only | ready |
| Branch tree browser (`/tree`) | Missing | no UI; `get_tree` exists | ready |
| Fork from message (`/fork`) | Missing | no UI or RPC command | gap |
| Pin session (`/pin`) | Partial | slash only | ready |
| Fresh provider state (`/fresh`) | Partial | slash only | ready |
| Move session (`/move`) | Partial | slash only | ready |
| Worktree (`/wt`) | Partial | slash only | ready |
| Workspace dirs (`/add-dir`, `/remove-dir`, `/dirs`) | Partial | slash only | ready |
| Restart with flags (`/restart`) | Missing | TUI-only `builtin-lifecycle.ts:895` | gap |

## Group 5: Context, Memory & Compaction

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Manual compact | Done | `TopBar.tsx:91-98,353`, `session-actions.ts:280` | ready |
| Handoff | Done | `TopBar.tsx:99-106,361`, `session-actions.ts:286` | ready |
| Context breakdown (`/context`) | Partial | % in `StatusStrip.tsx:38`, bar in `UsageScreen.tsx:176-274`; categories slash only | ready |
| Auto-compaction toggle | Partial | `set_auto_compaction` unused | ready |
| Shake (`/shake`) | Partial | slash only | ready |
| Extended context (`/extended-context`) | Partial | slash only | gap |
| Memory inspect/sync (`/memory`) | Partial | slash only | ready |
| Mental models (`/memory mm`) | N/A | unsupported over RPC (`builtin-lifecycle.ts:662`) | — |

## Group 6: Usage, Status & Metrics

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Session cost | Done | `StatusStrip.tsx:111`, `App.tsx:680` | ready |
| Context gauge | Done | `StatusStrip.tsx:60-65`, `lib/context-usage.ts` | ready |
| Streaming/compacting indicator | Done | `StatusStrip.tsx:112-118` | ready |
| Usage screen (`/usage`) | Done | `UsageScreen.tsx`, `get_usage_reports` | ready |
| Reset credit redeem | Done | `UsageScreen.tsx:87-95,199-234` | ready |
| Token counts (in/out/cache) | N/A | removed from the GUI on purpose | — |
| Fast tier toggle (`/fast`) | N/A | not wanted in the GUI | ready |
| Live TPS / TTFT | Partial | `tokensPerSecond` in state, not rendered; no TTFT | gap |
| Background jobs (`/jobs`) | Partial | slash only | ready |
| Stats / trace links | Partial | slash only | ready |

## Group 7: Subagents

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Tree list + nesting | Done | `AgentsPanel.tsx:28-66` | ready |
| Status dot | Done | `agents/AgentRow.tsx:48` | ready |
| Activity / tool / duration | Done | `agents/AgentRow.tsx:11-23,51` | ready |
| Tokens / cost | Done | `agents/AgentRow.tsx:53-54` | ready |
| Task expansion | Done | `agents/AgentRow.tsx:58-66` | ready |
| TopBar badge | Done | `TopBar.tsx:306-318` | ready |
| Agent Hub screen (route `#/s/<id>/hub[/<agent>]`, Alt+A, TopBar Bot) | Done | `agent-hub/AgentHubScreen.tsx`, `lib/agent-hub-model.ts` | ready |
| Hub roster incl. parked/aborted, filter, tree/flat toggle, virtualized rows | Done | `agent-hub/HubTree.tsx`, `get_agent_roster` | ready |
| Hub detail: status, retry, usage + context gauge, lineage, changes, recent | Done | `agent-hub/HubDetail.tsx` | ready |
| Subagent transcript viewer (1s byte-cursor poll while open) | Done | `agent-hub/HubTranscript.tsx`, `get_subagent_messages` | ready |
| Kill / revive / steer agent | Done | `session-actions.ts` `killAgent`/`reviveAgent`/`steerAgent` | ready |
| Task card agent link opens Hub at that agent | Done | `App.tsx` `toolHost.openAgent` | ready |
| Swarm navigation (Horizon B) | Missing | PLAN.md horizon B | gap |

## Group 8: Todos

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Todo tool card | Done | `tool-views/tools/todo.tsx` | ready |
| Todo panel with tap-to-set | Done | `TodoPanel.tsx`, route `#/s/<id>/todos` | ready |
| Progress in status strip | Done | `StatusStrip.tsx:62-78` | ready |
| Append / remove todos | Partial | status only in `TodoPanel.tsx`; add/rm slash only | ready |
| Import / export | Partial | slash only | ready |
| Edit in `$EDITOR` | N/A | no editor in a browser | — |

## Group 9: Execution Modes

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Plan mode toggle | Done | `StatusStrip.tsx:81-106`, `coding-agent/.../rpc-plan.ts:104-126` | ready |
| Plan review sheet | Done | `PlanReviewSheet.tsx`, `session-actions.ts:330-341` | ready |
| Retry failed turn | Done | `Transcript.tsx:130-137`, `session-actions.ts:300` | ready |
| Goal mode (`/goal`) | Missing | TUI-only `builtin-modes.ts:251` | gap |
| Guided goal (`/guided-goal`) | Missing | TUI-only | gap |
| Vibe (`/vibe`) | Missing | TUI-only | gap |
| Loop (`/loop`) | Missing | TUI-only | gap |
| Cleanse (`/cleanse`) | Missing | TUI-only | gap |
| OMFG (`/omfg`) | Missing | TUI-only | gap |
| BTW (`/btw`) | Missing | TUI-only | gap |
| Tangent agent (`/tan`) | Missing | TUI-only | gap |
| Security scan (`/security`) | Partial | slash only | ready |

## Group 10: Extensibility

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Skills registry (`/skills`) | Missing | `handleTui` only, `builtin-skills.ts:79` | gap |
| Extensions dashboard (`/extensions`) | Missing | `handleTui` only, `builtin-session.ts:491` | gap |
| `/skillful` | Partial | slash only | ready |
| `/marketplace` | Partial | slash only | ready |
| `/plugins` | Partial | slash only | ready |
| `/reload-plugins` | Partial | slash only | ready |
| `/mcp` | Partial | slash only | ready |
| `/tools` | Partial | slash only | ready |
| `/force:<tool>` | Partial | slash only | ready |

## Group 11: Direct Execution & Dev Tools

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Host bash (`!`, `!!`) | Partial | `bash` RPC exists, no composer mode | ready |
| Python eval (`$`, `$$`) | Partial | tool card only | ready |
| `/computer` | Partial | slash only | ready |
| `/browser` | Partial | slash only | ready |
| `/ssh` | Partial | slash only | ready |
| `/debug` | Missing | `handleTui` only | gap |
| `/pause` | Missing | `handleTui` only | gap |

## Group 12: Sharing & Audio

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Export HTML (`/export`) | Partial | `export_html` unused | ready |
| Dump transcript (`/dump`) | Partial | slash only | ready |
| Share link (`/share`) | Partial | slash only | ready |
| Join collab (`/join`, `/leave`) | Missing | `handleTui` only | gap |
| Collab hosting (`/collab`) | N/A | non-goal | — |
| Push-to-talk | N/A | non-goal | — |
| Voice mode (`/live`) | N/A | non-goal | — |
| Recording (`/record`) | N/A | terminal frame capture | — |

## Group 13: Layout & Touch

| Capability | State | Evidence | RPC |
| :--- | :-: | :--- | :-: |
| Touch targets >= 44px | Done | `styles/tokens.css:57` | — |
| iOS visualViewport / keyboard | Done | `App.tsx:100-146` | — |
| Auto-grow textarea | Done | `Composer.tsx:53,162-168` | — |
| Responsive breakpoints | Done | `lib/layout.ts:10,13`, `AppShell.tsx:14` | — |
| Subagent badge + navigation | Done | `TopBar.tsx:306-318` | — |
| Idle recap | Partial | live cards only (`server/live.ts:30-42`); not in session view | — |
| Settings hub (`/settings`) | N/A | non-goal | — |

## Gap list to 100%

Every Partial and Missing row above, then the uninventoried items.
Partial usually means reachable only by typing a slash command.

| # | Group | Item | State | RPC |
| -: | :--- | :--- | :-: | :-: |
| 1 | Prompting & Interaction | `@file` / `@git` mention completion | Missing | gap |
| 2 | Prompting & Interaction | Prompt history search (Ctrl+R) | Missing | — |
| 3 | Prompting & Interaction | Prompt actions (`#<action>`) | Missing | gap |
| 4 | Prompting & Interaction | Follow-up chord (Ctrl+Enter / Ctrl+Q) | Partial | — |
| 5 | Model, Thinking & Roles | Thinking level select + cycle (Shift+Tab) | Partial | ready |
| 6 | Transcript & Rendering | Search within transcript | Missing | — |
| 7 | Session Lifecycle & Branching | Delete session | Partial | ready |
| 8 | Session Lifecycle & Branching | Branch tree browser (`/tree`) | Missing | ready |
| 9 | Session Lifecycle & Branching | Fork from message (`/fork`) | Missing | gap |
| 10 | Session Lifecycle & Branching | Pin session (`/pin`) | Partial | ready |
| 11 | Session Lifecycle & Branching | Fresh provider state (`/fresh`) | Partial | ready |
| 12 | Session Lifecycle & Branching | Move session (`/move`) | Partial | ready |
| 13 | Session Lifecycle & Branching | Worktree (`/wt`) | Partial | ready |
| 14 | Session Lifecycle & Branching | Workspace dirs (`/add-dir`, `/remove-dir`, `/dirs`) | Partial | ready |
| 15 | Session Lifecycle & Branching | Restart with flags (`/restart`) | Missing | gap |
| 16 | Context, Memory & Compaction | Context breakdown (`/context`) | Partial | ready |
| 17 | Context, Memory & Compaction | Auto-compaction toggle | Partial | ready |
| 18 | Context, Memory & Compaction | Shake (`/shake`) | Partial | ready |
| 19 | Context, Memory & Compaction | Extended context (`/extended-context`) | Partial | gap |
| 20 | Context, Memory & Compaction | Memory inspect/sync (`/memory`) | Partial | ready |
| 21 | Usage, Status & Metrics | Live TPS / TTFT | Partial | gap |
| 22 | Usage, Status & Metrics | Background jobs (`/jobs`) | Partial | ready |
| 23 | Usage, Status & Metrics | Stats / trace links | Partial | ready |
| 24 | Subagents | Subagent transcript viewer | Missing | ready |
| 25 | Subagents | Subagent cancel | Missing | gap |
| 26 | Subagents | Swarm navigation (Horizon B) | Missing | gap |
| 27 | Todos | Append / remove todos | Partial | ready |
| 28 | Todos | Import / export | Partial | ready |
| 29 | Execution Modes | Goal mode (`/goal`) | Missing | gap |
| 30 | Execution Modes | Guided goal (`/guided-goal`) | Missing | gap |
| 31 | Execution Modes | Vibe (`/vibe`) | Missing | gap |
| 32 | Execution Modes | Loop (`/loop`) | Missing | gap |
| 33 | Execution Modes | Cleanse (`/cleanse`) | Missing | gap |
| 34 | Execution Modes | OMFG (`/omfg`) | Missing | gap |
| 35 | Execution Modes | BTW (`/btw`) | Missing | gap |
| 36 | Execution Modes | Tangent agent (`/tan`) | Missing | gap |
| 37 | Execution Modes | Security scan (`/security`) | Partial | ready |
| 38 | Extensibility | Skills registry (`/skills`) | Missing | gap |
| 39 | Extensibility | Extensions dashboard (`/extensions`) | Missing | gap |
| 40 | Extensibility | `/skillful` | Partial | ready |
| 41 | Extensibility | `/marketplace` | Partial | ready |
| 42 | Extensibility | `/plugins` | Partial | ready |
| 43 | Extensibility | `/reload-plugins` | Partial | ready |
| 44 | Extensibility | `/mcp` | Partial | ready |
| 45 | Extensibility | `/tools` | Partial | ready |
| 46 | Extensibility | `/force:<tool>` | Partial | ready |
| 47 | Direct Execution & Dev Tools | Host bash (`!`, `!!`) | Partial | ready |
| 48 | Direct Execution & Dev Tools | Python eval (`$`, `$$`) | Partial | ready |
| 49 | Direct Execution & Dev Tools | `/computer` | Partial | ready |
| 50 | Direct Execution & Dev Tools | `/browser` | Partial | ready |
| 51 | Direct Execution & Dev Tools | `/ssh` | Partial | ready |
| 52 | Direct Execution & Dev Tools | `/debug` | Missing | gap |
| 53 | Direct Execution & Dev Tools | `/pause` | Missing | gap |
| 54 | Sharing & Audio | Export HTML (`/export`) | Partial | ready |
| 55 | Sharing & Audio | Dump transcript (`/dump`) | Partial | ready |
| 56 | Sharing & Audio | Share link (`/share`) | Partial | ready |
| 57 | Sharing & Audio | Join collab (`/join`, `/leave`) | Missing | gap |
| 58 | Layout & Touch | Idle recap | Partial | — |
| 59 | Prompting | `@model` mentions | Missing | ? |
| 60 | Prompting | Large-paste staging as attachment | Missing | ? |
| 61 | Prompting | Raw paste / copy prompt | Missing | ? |
| 62 | Models | Model tag editing (`set_model_tag` ready) | Missing | ? |
| 63 | Models | Session `/prewalk [restart]` | Missing | ? |
| 64 | Transcript | `/copy` picker | Missing | ? |
| 65 | Transcript | `/open` last link | Missing | ? |
| 66 | Transcript | Cache-invalidation marker | Missing | ? |
| 67 | Transcript | Grouped read cards | Missing | ? |
| 68 | Transcript | Message reactions | Missing | ? |
| 69 | Sessions | `/session pin <account>` | Missing | ? |
| 70 | Metrics | Cache read/write/hit | Missing | ? |
| 71 | Metrics | Session time spent | Missing | ? |
| 72 | Metrics | Inline usage segment | Missing | ? |
| 73 | Subagents | Revive subagent | Missing | ? |
| 74 | Subagents | Chat into a subagent | Missing | ? |
| 75 | Subagents | Activity timeline | Missing | ? |
| 76 | Subagents | Persisted subagents across restarts | Missing | ? |
| 77 | Todos | `/todo copy` | Missing | ? |
| 78 | Todos | Todo expand/collapse | Missing | ? |
| 79 | Todos | Highlight todo worked by a subagent | Missing | ? |
| 80 | Todos | Todo auto-clear | Missing | ? |
| 81 | Other | Host tools / URI schemes | Missing | ? |
| 82 | Other | `/advisor dump` | Missing | ? |
| 83 | Other | TTS vocalizer | Missing | ? |

## Left out of the count (N/A)

Listed for completeness. Not in the scoreboard totals and not in the gap
list.

| Item | Reason |
| :--- | :--- |
| External editor (Ctrl+G) | no `$EDITOR` in a browser |
| Mental models (`/memory mm`) | unsupported over RPC (`builtin-lifecycle.ts:662`) |
| Token counts (in/out/cache) | removed from the GUI on purpose |
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