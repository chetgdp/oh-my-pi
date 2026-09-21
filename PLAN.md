# OMP Web GUI: Architecture & Working Plan

## 1. Overview & Vision

A first-class browser SPA for Oh My Pi (OMP), accessible from any device on a private Tailnet (mobile, laptop, remote workstations).

The GUI turns OMP into a continuously running agent service that survives client disconnects, streams live thinking and tool interactions, and gives full session control without requiring an active terminal or multiplexer.

### Core Principles
- **No Agent Duplication**: OMP remains the sole authority for agent loops, sessions, tools, models, subagents, and compaction.
- **Component Reuse**: Leverage existing production-grade React components in `packages/collab-web` (all 22 tool renderers, Markdown with KaTeX, Agent Drawer, Composer).
- **Transport Neutrality**: Browser communicates with a local Bun daemon over WebSocket; the daemon drives OMP via RPC mode (`--mode rpc-ui`).
- **In-Tree Execution**: Run directly against `packages/coding-agent/src/cli.ts`, staying in sync with active workspace development rather than installed binary builds.

---

## 2. System Architecture

```text
[ Browser SPA / Mobile ]
      │ (Tailscale / HTTP + WS)
      ▼
[ Bun Web Daemon :8081 ]
  ├── Static Asset Server (dist/ bundle)
  ├── WebSocket Gateway (/ws)
  │     ├── Keepalive Ping/Pong (10s interval)
  │     └── Sequenced Ring Buffer (5,000 events)
  └── RpcBridge
        │ (stdin / stdout NDJSON)
        ▼
[ OMP Agent Engine ]
  bun packages/coding-agent/src/cli.ts --mode rpc-ui
  ├── AgentSession & Tool Execution
  ├── Model Providers & Context Management
  └── Subagent Task Tree
```

---

## 3. Protocol Specification

### Client to Server Messages
| Type | Payload | Description |
|---|---|---|
| `attach` | `{ lastSeq?: number }` | Reconnects or joins session. Replays missed events if `lastSeq` is in buffer; otherwise triggers full `sync`. |
| `prompt` | `{ text: string, images?: Image[], streamingBehavior?: "steer" | "followUp" }` | Sends new prompt to active session. |
| `steer` | `{ text: string }` | Steers active turn in-flight. |
| `follow_up` | `{ text: string }` | Queues instruction for next turn. |
| `abort` | `{}` | Interrupts active agent execution. |
| `set_model` | `{ provider: string, modelId: string }` | Switches active model. |
| `set_thinking_level` | `{ level: string }` | Changes reasoning effort (off, low, medium, high, max). |
| `compact` | `{ customInstructions?: string }` | Triggers manual context compaction. |
| `new_session` | `{}` | Starts clean session in current working directory. |
| `switch_session` | `{ sessionPath: string }` | Resumes a stored session. |
| `list_sessions` | `{ cwd?: string, all?: boolean }` | Requests session list for a workspace or all projects. |
| `ui_response` | `{ id: string, response: unknown }` | Answers interactive approval or ask prompt. |
| `ping` | `{}` | Connection keepalive heartbeat. |

### Server to Client Messages
| Type | Payload | Description |
|---|---|---|
| `sync` | `{ seq, state, entries, agents, models, uiRequest }` | Full baseline snapshot for initial connection or reconnect fallback. |
| `event` | `{ seq, event: AgentSessionEvent }` | Live token streams, thinking tokens, tool execution lifecycle. |
| `entry` | `{ seq, entry: SessionEntry }` | Committed turn records (user messages, assistant messages, tool results). |
| `state` | `{ seq, state: RpcSessionState }` | Session state updates (streaming status, token rates, model). |
| `ui_request` | `{ seq, request: RpcExtensionUIRequest }` | Interactive ask, select, or confirmation prompt from tools/extensions. |
| `ui_request_end` | `{ seq, id: string }` | Settled or cancelled UI prompt. |
| `subagent` | `{ seq, kind, payload }` | Subagent progress, lifecycle, or transcript events. |
| `pong` | `{}` | Heartbeat acknowledgement. |

---

## 4. Current Implementation Status

### Completed in Prototype
- **Daemon Server** (`packages/collab-web/src/server/`):
  - Bun HTTP + WebSocket server running on `0.0.0.0:8081`.
  - In-tree OMP launcher targeting `packages/coding-agent/src/cli.ts`.
  - Sequenced ring buffer supporting event deduplication and replay.
  - Heartbeat ping/pong with 255s socket idle timeout.
- **Frontend Client** (`packages/collab-web/src/lib/rpc-web-client.ts`):
  - Direct WebSocket client implementing `useSyncExternalStore` contract.
  - Optimistic user prompt rendering for immediate feedback on submission.
  - Conversion of raw session events into durable `SessionEntry` structures.
- **UI Components & Controls**:
  - Full tool view rendering for all 22 built-in tools (`read`, `bash`, `edit`, `write`, `todo`, `task`, etc.).
  - HeaderBar model switcher and thinking level dropdown.
  - Adaptive thinking block: auto-expands while thinking tokens are in-flight, collapses on turn completion, and remains toggleable via dropdown.
  - Auto-scrolling transcript with tail-following lock.
  - Subagent panel and drawer for multi-agent workflows.

### Completed: Phase 2 — Session & Workspace Management
- **REST API Endpoints** (`packages/collab-web/src/server/index.ts`):
  - `GET /api/sessions` — lists sessions for a workspace (`?cwd=`) or all projects (`?all=true`), returns `SessionListItem[]` with id, path, cwd, title, timestamps, message count, size, first message, status.
  - `GET /api/sessions/preview` — loads a session file and returns user/assistant turns, branch labels, and header metadata.
  - `GET /api/workspaces` — aggregates all sessions into workspace summaries (cwd, name, session count, last modified).
  - `POST /api/sessions/new` — creates a fresh session via RPC and broadcasts `sync` to all WebSocket clients.
  - `POST /api/sessions/switch` — switches to a stored session file, reloads entries and state, broadcasts `sync`.
- **WebSocket Protocol** (`packages/collab-web/src/server/protocol.ts`):
  - Added `list_sessions` client message type and `sessions_list` server response.
  - Defined shared types: `SessionListItem`, `SessionPreviewData`, `SessionPreviewTurn`, `SessionPreviewBranch`, `WorkspaceItem`, `SessionsResponse`.
- **RpcBridge Enhancements** (`packages/collab-web/src/server/rpc-bridge.ts`):
  - `listSessions()`, `previewSession()`, `listWorkspaces()` — server-side session management using `SessionManager` and `loadSessionFile` from `coding-agent`.
  - `newSession()` and `switchSession()` — lifecycle methods that update internal state, reload entries, and `broadcastSync()` to all connected clients.
  - Tracks `#cwd` and updates it from session headers on switch.
- **RpcWebClient** (`packages/collab-web/src/lib/rpc-web-client.ts`):
  - `newSession()`, `switchSession()` — WebSocket commands.
  - `listSessions()`, `previewSession()`, `listWorkspaces()` — HTTP fetch against REST endpoints with proper URL encoding.
- **SessionClient Interface** (`packages/collab-web/src/lib/session-client.ts`):
  - Added optional `newSession()` and `switchSession()` methods.
- **Session Switcher Modal** (`packages/collab-web/src/components/shell/SessionSwitcherModal.tsx`):
  - Two-pane dialog: session list (left) with search, project/all tabs, workspace filter; transcript preview (right) with metadata grid, branch chips, and turn history.
  - Keyboard navigation (↑↓ to select, Enter to switch, Esc to close), double-click to switch.
  - Active session indicator, status badges, workspace tags, loading/error states.
- **HeaderBar Integration** (`packages/collab-web/src/components/shell/HeaderBar.tsx`):
  - Clickable session title trigger (`.sh-session-trigger`) with chevron icon opens the switcher modal.
  - Quick "+ New Session" button directly in the header.
- **Styling** (`packages/collab-web/src/components/shell/shell.css`):
  - Full modal styling using CSS custom property tokens (no raw colors): backdrop, dialog, search, tabs, workspace selector, session list items with selected/current/hover states, preview pane with info grid, branch chips, transcript turns, responsive mobile layout (stacked panes below 768px).
- **Tests** (`packages/collab-web/test/sessions.test.ts`):
  - 7 tests covering: session listing with metadata, preview extraction, workspace aggregation, cwd filtering, and RpcWebClient HTTP method invocation with mocked fetch.


### Completed: Phase 6 — UI Polish & Usability
- Syntax-highlighted code blocks via highlight.js (21 languages, dark+light themes).
- Streaming cursor indicator, tool card auto-expand/collapse.
- Context usage tooltip with token breakdown, session duration display.
- Composer image paste/upload and drag-and-drop with thumbnail previews.
- Session rename and delete (`POST /api/sessions/rename`, `POST /api/sessions/delete`).
- Mobile bottom sheet session switcher with swipe-to-dismiss; agent drawer swipe-to-close.
- Focus trap in modals, ARIA live regions, keyboard shortcuts overlay (`?`, `n`, `k`).
- Toast notifications for session switch and new session events.
- Light theme audit: all CSS uses token vars only.
---


## 5. Remaining Milestones

### Interactive Prompts & Approvals
- Wire `onExtensionUIRequest` and `respondExtensionUI` through `RpcBridge`.
- Render `ask` select menus and text editor modals in `Composer.tsx`.
- Support tool approval dialogs (e.g. bash approval confirmation) directly in the web UI.

### Project Context & Diff Viewer
- File tree drawer for quick file inspection.
- Visual diff viewer for staged git changes and file edits.
- Context file inspector (showing loaded rules, AGENTS.md, system prompt).

### Mobile Optimization & Service Daemon
- Systemd / launchd service definitions for headless boot persistence.
- Audio synthesis playback (browser speech output for spoken responses).

### UI Polish (remaining)
- Session switcher: pin sessions, drag-reorder, archive (soft-delete with restore).
- Composer: slash-command autocomplete.
