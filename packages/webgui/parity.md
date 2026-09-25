# OMP TUI vs Web GUI Feature Parity Inventory & ~90% Proposal

**Date**: 2026-09-24  
**Scope**: Comprehensive feature parity audit between the `omp` Terminal User Interface (TUI) and the phone-first Web GUI client (`packages/webgui`), grounded in source code evidence.

**Status**: proposal, not started. Awaiting user review. The inventory
below was produced by an agent; its "RPC ready" claims were spot-checked
against `rpc-types.ts` only for the items in "Proposed next step".

## Proposed next step (packages 1 and 2)

RPC status verified against `packages/coding-agent/src/modes/rpc/rpc-types.ts`:

| Item | RPC | Status |
| :--- | :--- | :--- |
| Rename (tap title) | `set_session_name` | exists |
| Rewind to a message | `branch {entryId}`; v3 `branch` frame refreshes the view | exists |
| Delete a past session | new daemon `DELETE /api/past/:id` | gap |
| Retry a failed turn | only `set_auto_retry` / `abort_retry`; whether `/retry` works over RPC is unknown | gap |
| Todo panel, read | `get_state.todoPhases`; push on change unknown | partial |
| Todo panel, tap to set | `set_todos` | exists |
| Subagent transcript | `get_subagent_messages` | exists |
| Cancel a subagent | new `cancel_subagent {id}` via the TUI agent-hub path | gap |

Execution: two parallel agents. A = session controls (owns `TopBar`,
transcript row actions, sessions list, daemon routes, `App.tsx` routing).
B = observability (owns `AgentsPanel`, new todo component, new RPC
commands; sends route additions to A).

Constraints: delete, rewind and cancel ask for confirmation. Delete
refuses live sessions and resolves the path from the session id on the
daemon, never from a client path. Every new RPC command and endpoint gets
a test. Each slice is verified live on a fresh omp in headless Chromium at
390px. coding-agent edits stay minimal.

Packages 3 (touch ergonomics) and 4 (plan mode, rate-limit resets) follow.
Plan mode is deferred until decided: it needs new coding-agent RPC.

---

## 1. Overview & Architectural Grounding

The `omp` Web GUI is designed as a phone-first client attaching to interactive `omp` sessions running inside `tmux` windows on the host (M5 Pro).

### Fixed Architectural Decisions (PLAN.md)
1. **Sessions are owned by omp processes in tmux**: The GUI never owns a session; it attaches, drives, and detaches like a tmux client.
2. **RPC is the protocol**: Interactive `omp` serves full coding-agent RPC over a per-process Unix socket (`~/.omp/run/rpc-hosts/*.json`) when `rpc.serve: true`.
3. **The daemon is a relay, not a translator**: Passes bytes between WebSocket and Unix socket verbatim.
4. **The browser speaks RPC**: Directly consumes `packages/coding-agent/src/modes/rpc/rpc-types.ts` frames via Protocol v3 (`PIPELINE.md`).
5. **No UI-request handling**: `ask.enabled=false`; extension dialogs/prompts stay on the TUI.
6. **Concurrency handled by AgentSession**: TUI and web client both submit commands; session orders them.
7. **Kill means RPC shutdown**, never `tmux kill-window`.

### State Legend
- **Done**: Fully implemented in Web GUI with dedicated UI and RPC integration.
- **Partial**: Partially implemented (e.g., text-only slash command output via `command_output`, but lacking dedicated mobile UI, or missing subcommands).
- **Missing**: Not present in the Web GUI.
- **RPC Status**:
  - `RPC ready`: RPC command or frame already exists in `rpc-types.ts` / `rpc-server.ts`.
  - `RPC gap`: RPC backend support or message types must be added or extended in `packages/coding-agent`.
  - `N/A`: Out of scope by fixed architectural decisions or local client-only feature.

---

## 2. TUI vs Web GUI Feature Parity Checklist

### Group 1: Active Session Prompting & Interaction
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Text prompt submission | `interactive-mode.ts:1680`, `custom-editor.ts:1200` | `Composer.tsx:54`, `session-actions.ts:32` (`prompt`) | **Done** | RPC ready |
| Mid-turn steering (`steer`) | `input-controller.ts:323`, `interactive-mode.ts:4012` | `Composer.tsx:56` (Steer button), `session-actions.ts:45` | **Done** | RPC ready |
| Turn queuing (`follow_up` / `/queue`) | `builtin-modes.ts:315`, `ui-helpers.ts:1102` | `Composer.tsx:56` (Queue button), `session-actions.ts:54` | **Done** | RPC ready |
| Abort / stop turn (`abort` / Esc) | `app-keybindings.ts:88`, `interactive-mode.ts:4010` | `Composer.tsx:230` (Stop button), `session-actions.ts:63` | **Done** | RPC ready |
| Image attachment (file upload & paste) | `app-keybindings.ts:164`, `input-controller.ts:364` | `Composer.tsx:107` (+ button & paste), data URL to `ImageContent` | **Done** | RPC ready |
| Slash command autocomplete | `builtin-registry.ts:59`, `available-commands.ts:25` | `SlashAutocomplete.tsx:21` (matches against `get_available_commands`) | **Done** | RPC ready |
| Prompt history navigation (Up/Down) | `hotkeys-markdown.ts:51`, `custom-editor.ts:980` | None in `Composer.tsx` (textarea handles arrows natively) | **Missing** | RPC gap |
| Prompt history search (Ctrl+R) | `app-keybindings.ts:236`, `history-search.ts:1-120` | None in Web GUI | **Missing** | RPC gap |
| File / symbol mention completion (`@file`, `@git`) | `input-controller.ts:420`, `file-completions.ts` | None in `Composer.tsx` (only `/` slash autocomplete) | **Missing** | RPC gap |
| Prompt actions / stash / undo (`#<action>`) | `hotkeys-markdown.ts:93`, `prompt-actions.ts` | None in Web GUI | **Missing** | RPC gap |
| Follow-up message chord (Ctrl+Enter / Ctrl+Q) | `app-keybindings.ts:144` | `useComposerKeyboard.ts:1` (Enter submits on fine pointer) | **Partial** | RPC ready |
| External editor invocation (Ctrl+G) | `app-keybindings.ts:140`, `input-controller.ts:386` | None (irrelevant on mobile touch; out of scope for browser) | **Missing** | N/A |

### Group 2: Model, Thinking & Roles Parity (PLAN.md Item 5)
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Pick model + thinking level (session-only /switch, alt+p) | `builtin-modes.ts:369`, `model-picker.ts:1-250` | `useModelsHub.tsx:85`, `StatusStrip.tsx:47` | **Done** | RPC ready |
| Pick model + thinking level persistent default (/model) | `builtin-modes.ts:325`, `model-hub.ts:1-300` | `useModelsHub.tsx:95`, `ModelPickerSheet.tsx:1` | **Done** | RPC ready |
| Cycle through `cycleOrder` roles (Ctrl+P / Shift+Ctrl+P) | `app-keybindings.ts:116`, `builtin-modes.ts:401` | `ActiveSection.tsx:52`, `cycle_role_model` RPC | **Done** | RPC ready |
| Active model provenance & explanation (`modelSource`) | `model-hub.ts:140`, `interactive-mode.ts:67` | `ActiveSection.tsx:35` (role / switch / fallback badges) | **Done** | RPC ready |
| Model list with providers, TPS/TTFT, role chips, kinds | `model-browser.ts:1-280` | `ModelPickerSheet.tsx`, `get_model_browser` RPC | **Done** | RPC ready |
| Locked provider handling & OAuth login sheet | `oauth-selector.ts`, `login-dialog.ts` | `LoginSheet.tsx:1-180`, contract O RPC (`login_start`, etc.) | **Done** | RPC ready |
| Provider live refresh (`refresh_models`) | `builtin-session.ts:44` | `ProvidersSection.tsx`, `refresh_models` RPC | **Done** | RPC ready |
| Model Roles management (list, assign, scope, custom) | `model-hub.ts`, `settings.ts:modelRoles` | `RolesSection.tsx`, `CycleOrderEditor.tsx` | **Done** | RPC ready |
| Agent config (enable, model override, tier, prewalk, advisor) | `agents-hub.ts:1-220`, `/agents` builtin | `AgentsSection.tsx`, `AgentRow.tsx`, `set_agent_*` RPC | **Done** | RPC ready |
| Thinking level selector & cycle (Shift+Tab) | `app-keybindings.ts:108`, `thinking-selector.ts` | `StatusStrip.tsx:54`, `set_thinking_level` RPC | **Done** | RPC ready |

### Group 3: Transcript Features, Inspection & Rendering
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Streaming assistant markdown rendering | `transcript-view.ts`, `markdown-stream.ts` | `Transcript.tsx:31`, `Markdown.tsx` (katex split chunk) | **Done** | RPC ready |
| Thinking display & toggle (Ctrl+T) | `app-keybindings.ts:112`, `input-controller.ts:374` | `ThinkingRow.tsx:5` (collapsed chip, click/expandAll expands) | **Done** | RPC ready |
| Tool output expansion toggle (Ctrl+O) | `app-keybindings.ts:132`, `input-controller.ts:434` | `StatusStrip.tsx:84` ("▶/▼ tools" toggle), `ToolCard.tsx` | **Done** | RPC ready |
| Inline code patch & diff rendering | `packages/tui/src/tools/edit.ts` | `tool-views/tools/edit.tsx`, `parts.tsx:240` (`DiffBlock`) | **Done** | RPC ready |
| Inline assistant & user image rendering | `packages/tui/src/render/image.ts` | `Transcript.tsx:397` (`AssistantImageItem`), `UserRow.tsx:14` | **Done** | RPC ready |
| Specialized tool views (29 tools) | `packages/tui/src/overlays/` & tool cards | `packages/webgui/src/components/transcript/tool-views/tools/` | **Done** | RPC ready |
| Jump to bottom indicator & unread badge | `packages/tui/src/transcript-view.ts` | `Transcript.tsx:638` (`ArrowDown` button with `unreadCount`) | **Done** | RPC ready |
| Virtualized scrolling & continuous historical paging | `packages/tui/src/virtual-list.ts` | `Transcript.tsx:4`, `@tanstack/react-virtual`, Protocol v3 `history` | **Done** | RPC ready |
| Protocol v3 incremental delta updates | `packages/coding-agent/src/modes/rpc/rpc-v3.ts` | `transcript-model.ts:210`, `PIPELINE.md` | **Done** | RPC ready |
| Search within transcript text | Terminal search / `/` pager | None in Web GUI | **Missing** | RPC gap |
| Code block copy action / button | `copy-selector.ts:1-120`, `copy-targets.ts` | `Markdown.tsx` / `parts.tsx` (text selection only, no tap-to-copy button) | **Partial** | RPC ready |
| Shimmer / live activity indicator | `running-subagent-badge.ts`, spinner | `Transcript.tsx:454` (`ShimmerItem`), `StatusStrip.tsx:77` (pulsing dot) | **Done** | RPC ready |

### Group 4: Session Operations, Lifecycle & Branching
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| List live sessions vs past sessions | `session-selector.ts:1-240` | `SessionsScreen.tsx:20-35`, `api.listLive` / `api.listPast` | **Done** | RPC ready |
| New session with working directory choice | `app-keybindings.ts:180`, `builtin-lifecycle.ts:195` | `NewSession.tsx:1-80`, `POST /api/launch` (tmux window 0) | **Done** | RPC ready |
| Resume past session in tmux window | `builtin-lifecycle.ts:434`, `session-selector.ts` | `SessionRow.tsx:50`, `POST /api/past/:id/resume` | **Done** | RPC ready |
| Live session shutdown | `builtin-lifecycle.ts:890` (`/exit`), `builtin-control.ts:85` | `SessionRow.tsx:35`, `POST /api/live/:id/shutdown` (`shutdown`) | **Done** | RPC ready |
| Session rename | `builtin-lifecycle.ts:677` (`/rename`), `app-keybindings.ts:212` | None in GUI (read-only title in `TopBar.tsx:82` & `SessionInfo`) | **Missing** | RPC ready |
| Rewind / branch to past message | `builtin-session.ts:530` (`/branch`), `rewind-selector.ts` | Handles v3 `branch` frame (`session-store.ts:223`), but has no rewind UI | **Partial** | RPC ready |
| Session branch tree browser | `builtin-session.ts:549` (`/tree`), `tree-selector.ts` | None in Web GUI (`get_tree` RPC ready in `rpc-types.ts:46`) | **Missing** | RPC ready |
| Fork session from message | `builtin-session.ts:540` (`/fork`), `app-keybindings.ts:188` | None in Web GUI | **Missing** | RPC ready |
| Delete current or past session | `builtin-lifecycle.ts:263` (`/delete`), `builtin-session.ts:223` | Can run `/session delete` via slash command; no button in GUI list | **Partial** | RPC ready |
| Pin session to top of list | `builtin-lifecycle.ts:465` (`/pin`) | Can run `/pin` via slash command; no pin badge/toggle in GUI list | **Partial** | RPC ready |
| Fresh provider state (`/fresh`) | `builtin-lifecycle.ts:218` | Can run `/fresh` via slash command; no dedicated button/action | **Partial** | RPC ready |
| Clear context in place (`/clear`) | `builtin-lifecycle.ts:240` | Can run `/clear` via slash command; no dedicated button/action | **Partial** | RPC ready |
| Relocate session to directory (`/move`) | `builtin-lifecycle.ts:755`, `move-overlay.ts` | Can run `/move <dir>` via slash command; no directory picker UI | **Partial** | RPC ready |
| Create and switch to git worktree (`/wt`) | `builtin-lifecycle.ts:785` | Can run `/wt [<branch>]` via slash command; no dedicated UI | **Partial** | RPC ready |
| Workspace directories (`/add-dir`, `/remove-dir`, `/dirs`) | `builtin-lifecycle.ts:820-888` | Can run slash commands; no workspace directories UI | **Partial** | RPC ready |
| Restart omp with launch flags (`/restart`) | `builtin-lifecycle.ts:895` | None (TUI only handler; not executable over RPC) | **Missing** | RPC gap |

### Group 5: Context, Memory & Compaction
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Manual session compaction (`/compact`) | `builtin-lifecycle.ts:272`, `compact-modes.ts` | Indicator in `StatusStrip.tsx:79`; `compact` RPC ready, but no GUI button | **Partial** | RPC ready |
| Drop heavy context blocks (`/shake`) | `builtin-lifecycle.ts:338` (elide/images/thinking) | Can run `/shake` via slash command; no dedicated UI | **Partial** | RPC ready |
| Generate session handoff (`/handoff`) | `builtin-lifecycle.ts:367`, `handoff` RPC | `handoff` RPC ready (`rpc-types.ts:118`); no GUI button | **Partial** | RPC ready |
| Context breakdown inspection (`/context`) | `builtin-session.ts:472`, `context-report.ts` | Percentage in `StatusStrip.tsx:62`; full breakdown missing | **Partial** | RPC ready |
| Long-context toggle (`/extended-context`) | `builtin-modes.ts:544` | Can run `/extended-context` via slash command; no UI toggle | **Partial** | RPC ready |
| Memory backend inspection & sync (`/memory`) | `builtin-lifecycle.ts:588` (view, sync, clear, stats) | Can run `/memory` via slash command; no dedicated UI | **Partial** | RPC ready |
| Mental models bank (`/memory mm`) | `builtin-lifecycle.ts:603` (list, show, refresh, history) | None (ACP/RPC unsupported; HTTP API direct only) | **Missing** | RPC gap |
| Auto-compaction toggle | `settings-schema.ts:context.autoCompact` | `set_auto_compaction` RPC ready (`rpc-types.ts:100`); no UI | **Partial** | RPC ready |

### Group 6: Accounting, Usage, Status & Metrics
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Session cost estimate | `status-line-host.ts`, `SessionStats` | `StatusStrip.tsx:69`, `SessionInfo` in `App.tsx:498` | **Done** | RPC ready |
| Total token counts (in/out/total) | `status-line-host.ts`, `builtin-modes.ts:147` | `StatusStrip.tsx:71`, `SessionInfo` in `App.tsx:499` | **Done** | RPC ready |
| Context window capacity & gauge | `status-line-host.ts:47`, `builtin-session.ts:479` | `StatusStrip.tsx:62` (percentage display) | **Done** | RPC ready |
| Streaming/compacting pulsing status | `status-line-host.ts:19` | `StatusStrip.tsx:77` (`.ss-indicator`, `.ss-dot`) | **Done** | RPC ready |
| Live token rate (TPS) & first-token latency (TTFT) | `status-line-host.ts:45`, `calculateTokensPerSecond` | `ModelPickerSheet.tsx` (historical perf); missing live turn TPS | **Partial** | RPC gap |
| Provider rate limits & token usage (`/usage`) | `builtin-session.ts:338`, `usage-dashboard.ts` | Can run `/usage` via slash command; no GUI usage dashboard | **Partial** | RPC ready |
| Redeem rate limit reset credit (`/usage reset`) | `builtin-session.ts:346`, `reset-usage-selector.ts` | Can run `/usage reset` via slash command; no picker UI | **Partial** | RPC ready |
| Async background jobs snapshot (`/jobs`) | `builtin-session.ts:294` | Can run `/jobs` via slash command; no background jobs panel | **Partial** | RPC ready |
| Stats & trace dashboard (`/stats`, `/trace`) | `builtin-session.ts:385`, `builtin-collaboration.ts:199` | Can run `/stats`, `/trace` via slash; no embedded web link | **Partial** | RPC ready |
| Priority / fast service tier toggle (`/fast`) | `builtin-modes.ts:418` | `set_fast_mode` RPC ready (`rpc-types.ts:43`); can run `/fast` | **Partial** | RPC ready |

### Group 7: Subagent & Swarm Views
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Subagent tree list & nesting | `agent-hub.ts:1-240`, `agent-activity.ts` | `AgentsPanel.tsx:24`, `buildChildrenMap` (`parentToolCallId`) | **Done** | RPC ready |
| Subagent running/parked status & dot | `running-subagent-badge.ts` | `AgentRow.tsx:46` (`.ag-dot--running/completed`) | **Done** | RPC ready |
| Subagent active tool / duration / activity | `agent-activity.ts:120` | `AgentRow.tsx:12` (`activityLine`, `fmtDuration`) | **Done** | RPC ready |
| Subagent token usage & cost tracking | `agent-activity.ts:150` | `AgentRow.tsx:52` (`fmtTokens`, `fmtCost`) | **Done** | RPC ready |
| Subagent task & assignment expansion | `agent-activity.ts:80` | `AgentRow.tsx:57` (tap row to toggle details) | **Done** | RPC ready |
| TopBar subagent badge count | `interactive-mode.ts:2454` | `TopBar.tsx:168` (Bot icon + numeric badge) | **Done** | RPC ready |
| Subagent transcript viewer | `agent-transcript-viewer.ts:1-180` | None in GUI (`get_subagent_messages` RPC ready in `rpc-types.ts:52`) | **Missing** | RPC ready |
| Subagent kill / cancel from UI | `agent-hub.ts:190` | None in GUI (no cancel button in `AgentRow.tsx`) | **Missing** | RPC gap |
| Deep swarm navigation (Horizon B) | Horizon B design goal | None (future horizon per `PLAN.md:14`) | **Missing** | RPC gap |

### Group 8: Todo & Task Tracking
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Todo tool call inspection | `packages/tui/src/tools/todo.ts` | `tool-views/tools/todo.tsx` (`todoRenderer`) | **Done** | RPC ready |
| Interactive Todo HUD / checklist panel | `builtin-session.ts:178`, `todo.ts:1-120` | None in GUI (no HUD, sheet, or checklist panel) | **Missing** | RPC ready |
| Modify todos (`/todo append`, `start`, `done`, `drop`, `rm`) | `builtin-session.ts:191-198`, `handleTodoAcp` | Can run `/todo` via slash command; no touch controls | **Partial** | RPC ready |
| Open todos in editor (`/todo edit`) | `builtin-session.ts:184` | None ($EDITOR unavailable on web) | **Missing** | N/A |
| Import / export todos (`/todo import`, `export`) | `builtin-session.ts:188-189` | Can run `/todo export/import` via slash command | **Partial** | RPC ready |
| Todo progress summary in status line | `status-line-host.ts`, `todo.ts` | None in `StatusStrip.tsx` | **Missing** | RPC ready |

### Group 9: Execution Modes & Workflow Tools
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Plan mode toggle (`/plan [prompt]`) | `builtin-modes.ts:201`, `interactive-mode.ts:5490` | None (TUI-only handler `handleTui`; no RPC command) | **Missing** | RPC gap |
| Plan review & execution overlay (`/plan-review`) | `builtin-modes.ts:222`, `plan-review-overlay.ts` | None in Web GUI | **Missing** | RPC gap |
| Goal mode autonomous objective (`/goal`) | `builtin-modes.ts:251`, `interactive-mode.ts:4202` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Guided goal interview (`/guided-goal`) | `builtin-modes.ts:277` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Vibe mode worker sessions (`/vibe`) | `builtin-modes.ts:233` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Loop mode prompt re-execution (`/loop`) | `builtin-modes.ts:289` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Cleanse diagnostic subagent fixer (`/cleanse`) | `builtin-lifecycle.ts:532`, `cleanse-panel.ts` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| OMFG recurring complaint TTSR forge (`/omfg`) | `builtin-lifecycle.ts:520`, `omfg-panel.ts` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| BTW side-question & history (`/btw`) | `builtin-lifecycle.ts:496`, `btw-panel.ts` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Tangential background agent (`/tan`) | `builtin-lifecycle.ts:508` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Native security scanner (`/security`) | `builtin-modes.ts:153`, `handleSecurityCommand` | Can run `/security` via slash command; no scanner UI | **Partial** | RPC ready |
| Retry last failed turn (`/retry` / F5) | `builtin-lifecycle.ts:544`, `app-keybindings.ts:151` | Can run `/retry` via slash; `set_auto_retry` RPC ready | **Partial** | RPC ready |

### Group 10: Extensibility, Plugins & Tools Configuration
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Skills registry search & install (`/skills`) | `builtin-skills.ts:63-146` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Toggle skill listing in prompt (`/skillful`) | `builtin-modes.ts:488` | Can run `/skillful` via slash command; no UI toggle | **Partial** | RPC ready |
| Marketplace plugins management (`/marketplace`) | `builtin-marketplace.ts:44` | Can run `/marketplace` via slash command; no GUI | **Partial** | RPC ready |
| Installed plugins list & toggle (`/plugins`) | `builtin-marketplace.ts:424` | Can run `/plugins` via slash command; no GUI | **Partial** | RPC ready |
| Reload plugins runtime (`/reload-plugins`) | `builtin-marketplace.ts:556` | Can run `/reload-plugins` via slash command | **Partial** | RPC ready |
| Extension Control Center dashboard (`/extensions`) | `builtin-session.ts:491`, `extension-dashboard.ts` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| MCP servers management (`/mcp`) | `builtin-session.ts:634`, `handleMcpAcp` | Can run `/mcp` via slash command; no MCP UI wizard | **Partial** | RPC ready |
| Active tools list inspection (`/tools`) | `builtin-session.ts:443` | Can run `/tools` via slash command | **Partial** | RPC ready |
| Force next turn tool (`/force:<tool>`) | `builtin-control.ts:8` | Can run `/force:<tool>` via slash command | **Partial** | RPC ready |

### Group 11: Developer & Direct Execution Tools
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Host bash command (`!` / `!!`) | `hotkeys-markdown.ts:95`, `interactive-mode.ts` | `bash` tool renders in transcript; `bash` RPC ready | **Partial** | RPC ready |
| Python eval shared kernel (`$` / `$$`) | `hotkeys-markdown.ts:97`, `eval` tool | `eval` tool renders in transcript; no direct repl | **Partial** | RPC ready |
| Computer use prelude toggle (`/computer`) | `builtin-modes.ts:571` | Can run `/computer` via slash command; no UI toggle | **Partial** | RPC ready |
| Browser headless / visible toggle (`/browser`) | `builtin-collaboration.ts:471` | Can run `/browser` via slash command; no UI toggle | **Partial** | RPC ready |
| SSH hosts management (`/ssh`) | `builtin-lifecycle.ts:172`, `handleSshAcp` | Can run `/ssh` via slash command; no GUI | **Partial** | RPC ready |
| Interactive debug selector (`/debug`) | `builtin-lifecycle.ts:579` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |
| Pause screen / freeze agents (`/pause`) | `builtin-control.ts:76`, `pause-screen.ts` | None (TUI-only handler `handleTui`) | **Missing** | RPC gap |

### Group 12: Collaboration, Sharing & Audio
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Export session to HTML file (`/export`) | `builtin-collaboration.ts:175`, `export_html` RPC | `export_html` RPC ready (`rpc-types.ts:112`); no GUI button | **Partial** | RPC ready |
| Dump transcript to clipboard (`/dump`) | `builtin-collaboration.ts:226` | Can run `/dump` via slash command; no GUI button | **Partial** | RPC ready |
| Share session via encrypted link (`/share`) | `builtin-collaboration.ts:259` | Can run `/share` via slash command; no GUI button | **Partial** | RPC ready |
| Live collab relay hosting (`/collab`) | `builtin-collaboration.ts:285`, `CollabHost` | None in GUI (separate relay architecture) | **Missing** | RPC gap |
| Join collab session (`/join`, `/leave`) | `builtin-collaboration.ts:414, 446` | None in GUI | **Missing** | RPC gap |
| Push-to-talk speech-to-text (Hold Space) | `app-keybindings.ts:241`, `hotkeys-markdown.ts:89` | None in Web GUI | **Missing** | RPC gap |
| Realtime voice mode (`/live`) | `builtin-control.ts:58`, `live-command-controller.ts`| None in Web GUI | **Missing** | RPC gap |
| Screen session recording (`/record`) | `builtin-control.ts:67` | None in Web GUI | **Missing** | RPC gap |

### Group 13: Layout, Navigation & Touch Controls
| Capability | TUI Location | Web GUI Location / RPC | State | RPC Status |
| :--- | :--- | :--- | :--- | :--- |
| Mobile touch targets (≥44px) | Terminal cell-based | `NOTES.md:55`, `sessions.css`, `composer.css` | **Done** | N/A |
| iOS visualViewport & keyboard clearance | N/A (terminal emulators handle) | `App.tsx:87`, `useViewportHeight` | **Done** | N/A |
| Auto-grow prompt textarea (up to 8 rows) | `custom-editor.ts` | `Composer.tsx:78` (`autoGrow`, `MAX_ROWS`) | **Done** | N/A |
| Responsive breakpoints (sidebar 720, inspector 1100) | Full terminal width | `layout.ts`, `AppShell.tsx`, `base.css` | **Done** | N/A |
| Subagent badge & navigation | `agent-hub.ts` | `TopBar.tsx:168`, `AgentsPanel.tsx` | **Done** | N/A |
| Full-screen settings hub (`/settings`) | `settings-selector.ts:1-250`, 10 tabs | None in Web GUI (only Models hub at `#/s/:id/models`) | **Missing** | RPC gap |

### Group 14: Out of Scope & Excluded Features (Fixed Decisions)
| Feature | Reason for Exclusion | Reference |
| :--- | :--- | :--- |
| UI requests & dialogs (`ui_request` / `ask.enabled=false`) | Fixed decision: extension dialogs stay on the TUI; host runs `ask.enabled=false`. The GUI never presents or arbitrates them. | `PLAN.md:50`, `NOTES.md:147` |
| GUI owning or spawning private sessions | Fixed decision: sessions are owned by omp in tmux. GUI attaches, drives, detaches like a tmux client. | `PLAN.md:36`, `NOTES.md:106` |
| Daemon frame translation or replay ring buffer | Fixed decision: daemon relays bytes between WebSocket and Unix socket verbatim. Protocol v3 handled in omp. | `PLAN.md:43`, `PIPELINE.md:15` |
| External editor invocation ($EDITOR / vim) | Irrelevant on mobile touch; browser sandboxing prevents local editor spawns. | `PLAN.md:9` |
| Terminal-specific raw key chords (Ctrl+C, Ctrl+Z, Alt+L) | Terminal lifecycle actions; phone uses touch buttons (Stop, Shutdown, Reconnect). | `PLAN.md:10` |
| Terminal screen recording (`/record` / `omp play`) | TUI terminal frame capture; irrelevant for web DOM rendering. | `builtin-control.ts:67` |

---

## 3. Ranked Proposal for ~90% Feature Parity

### Assessment Methodology: Phone Value vs. Cost
To achieve ~90% parity without bloating the mobile client or reinventing desktop paradigms on touchscreens, we evaluate candidate capabilities along two dimensions:
- **Phone-User Value**: High frequency and high impact while away from the laptop (e.g., monitoring a run, nudging an agent, fixing errors, checking task checklists, inspecting subagents, or rescuing stuck loops).
- **Implementation Cost**: Engineering effort in `packages/webgui` and `packages/coding-agent` (low = RPC ready, medium = minor RPC command additions, high = complex protocol or architectural changes).

```
High Phone Value
   ▲
   │ [P1] Session Rename & Delete      [P3] Subagent Transcript
   │ [P2] Rewind / Branch Sheet        [P4] Interactive Todo HUD
   │ [P5] Copy Code & Tap Actions      [P7] Plan Mode Review
   │ [P6] Prompt History Navigation
   │
   │ [P8] Rate Limit Resets (/usage)   [P9] Transcript Text Search
   │ [P10] Compaction / Retry Buttons
   │────────────────────────────────────────────────────────►
   │ [Excl] Git Split Diff UI          [Excl] Voice & Push-to-Talk
   │ [Excl] Settings Menu (10 tabs)    [Excl] Direct Bash/REPL
   │ [Excl] Collab Host Relay          [Excl] Extension Dialogs
Low Phone Value                                         High Cost
```

---

### Proposed 90% Cut: What to Build

We recommend four focused, high-leverage implementation packages that bridge the gap to ~90% parity:

#### Package 1: Session Controls & Branching (High Value, Low-to-Medium Cost)
1. **Session Rename in Header**: Tap session title in `TopBar.tsx` to edit or trigger auto-generation (`set_session_name` RPC ready; `builtin-lifecycle.ts:705`).
2. **Session Delete**: Add "Delete" swipe action or icon in `PastSessionRow.tsx` and `SessionInfo` (`sessionManager.dropSession` via REST or RPC).
3. **Rewind / Branch Picker**: Message-level action button on assistant rows or a drawer to rewind the session to a prior message (`branch { entryId }` RPC ready; `rpc-types.ts:114`).
4. **Retry Button**: Visible Retry button on error banner or composer when turn fails (`/retry` RPC ready; `builtin-lifecycle.ts:547`).

#### Package 2: Mobile Task & Subagent Observability (High Value, Low Cost)
5. **Interactive Todo HUD / Drawer**: A collapsible checklist header or panel driven by `todoPhases` (`set_todos` RPC ready; `rpc-types.ts:47`, `builtin-session.ts:178`). Tap to mark done/in_progress from the phone.
6. **Subagent Transcript Viewer**: Tap on any subagent row in `AgentsPanel.tsx` to open a full transcript viewer for that subagent (`get_subagent_messages` RPC ready; `rpc-types.ts:52`).
7. **Subagent Cancellation**: Cancel button on running subagent rows to kill stuck background agents.

#### Package 3: Touch & Composer Ergonomics (High Value, Low Cost)
8. **Code Block Copy Button**: 1-tap copy button in `parts.tsx` (`CodeBlock` / `Output` / `DiffBlock`) to copy code without mobile text selection hurdles.
9. **Prompt History Navigation**: Up/Down history buttons or a prompt history sheet in `Composer.tsx` (using local storage or session prompt history).
10. **Quick Context Actions in StatusStrip / Sheet**: Add a 3-dots action menu in TopBar or StatusStrip for 1-tap `Compact context`, `Handoff`, and `Clear context`.

#### Package 4: Core Execution Modes (High Value, Medium Cost)
11. **Plan Mode Execution & Review**: Expose `plan.enabled` toggle and a mobile review sheet for generated plans (`Approve and execute`, `Approve and compact`, `Refine`). Requires adding `get_plan_state` / `set_plan_mode` / `approve_plan` to `rpc-server.ts`.
12. **Provider Rate Limit Resets Sheet**: Mobile sheet for `/usage reset` (`builtin-session.ts:46`), showing saved rate-limit reset credits and a "Redeem" button when throttled by Claude or Codex.

---

### What to Exclude and Why (The 10% Non-Goals)

The following capabilities are deliberately excluded from the ~90% parity target:

1. **Full Settings Configuration Overlay (10 Tabs, 80+ settings)**:
   - *Reason*: Configuring regexes, ANSI terminal colors, fuzzy-finder parameters, and LSP settings on a 390px mobile viewport is poor UX. Model roles and agent overrides (`#/s/:id/models`) already cover all daily configuration needs.
2. **Git Split Diff & Staging UI (`/git`)**:
   - *Reason*: Multi-pane diff review, hunk staging, and commit drafting require wide displays and keyboard precision. The mobile client already renders per-file diffs cleanly inside `edit` tool cards.
3. **Collab Relay Hosting (`/collab`)**:
   - *Reason*: Collab hosting is a separate relay architecture designed for peer terminal sharing; the Web GUI already runs on a dedicated relay daemon over Tailscale.
4. **Interactive REPLs (`!` Bash / `$` Python shared kernel)**:
   - *Reason*: Direct shell typing is hazardous on phones without terminal cursor control. Driving tools through the agent (`run bash command`, `eval python`) provides safer guardrails and full transcript capture.
5. **Realtime Voice & Push-to-Talk (`/live`, Hold Space)**:
   - *Reason*: High mobile complexity, audio device permissions, and WebRTC/WebSocket streaming over erratic cellular links. Horizon B or a dedicated voice app is the appropriate venue.
6. **Terminal Debugger & Pause Screen (`/debug`, `/pause`)**:
   - *Reason*: DAP (Debugger Adapter Protocol) breakpoint stepping and stack navigation are desktop-centric developer workflows.
7. **Mental Models Direct Bank Manipulation (`/memory mm`)**:
   - *Reason*: Mental model editing is an advanced prompt-engineering task suited for desktop HTTP APIs.

---

## 4. Security & Performance Considerations

### 1. Host File & Secret Exposure over Tailscale
- **Tailscale Daemon Exposure**: The daemon binds `127.0.0.1:8081` and is exposed across the Tailscale tailnet via `tailscale serve`. Anyone on the tailnet with access to port 8081 can attach to any live session or browse past sessions.
- **Session File & CWD Access**: `GET /api/past` and `loadSessionFile` can read any `.jsonl` session file on the host. `POST /api/launch` allows specifying an arbitrary `cwd` for new tmux windows.
- **Secret Leaks via `/dump` and Sidecars**: `dumpLlmRequestToTmpDir` writes raw LLM payloads including headers and injected secrets. Mobile users running `/dump` must be aware that sidecar files persist on the host filesystem.
- **Recommendation**: Ensure the Tailscale node uses restricted ACLs, or add a simple shared passphrase/PIN cookie to the daemon before exposing the dashboard outside a private single-user tailnet.

### 2. Large Frames & Network Payload Performance
- **1 MiB RPC Frame Cap & v2 Chunking**: Upstream RPC server caps frames at 1 MiB. Payloads exceeding 1 MiB (e.g., massive bash stdout, huge file reads, or large diffs) are chunked into base64 frames (`rpc-frame.ts:95-117`).
- **Base64 Overhead on Mobile**: Reassembling and decoding multi-megabyte base64 frames on mobile Safari causes severe garbage collection pauses and UI frame drops.
- **Protocol v3 Mitigation**: Protocol v3 (`PIPELINE.md`) solves message streaming token thrashing with raw text deltas and history paging. However, tool call outputs (`tool_output`) can still be large.
- **Recommendation**:
  - Truncate large tool outputs at the RPC server boundary before sending to mobile clients (e.g., clamp tool output previews to 100 KB, with full output remaining on host disk).
  - Enforce image downsampling before uploading base64 data URLs in `Composer.tsx`.

### 3. State Isolation & Concurrent TUI Driving
- **Bidirectional Parity**: TUI and phone both submit commands; `AgentSession` orders them. When a model change occurs in the TUI, `rpc-config-feed.ts` emits `config_update` so the phone updates immediately.
- **Mid-stream Conflicts**: If a user steers or switches models on the phone while a turn is actively streaming in tmux, the session applies the change at the next turn boundary (`NOTES.md:290-292`). This contract works reliably and should be preserved.
