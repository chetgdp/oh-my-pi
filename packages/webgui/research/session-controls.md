# Research & Working Notes: Session Controls

Date: 2026-09-24

## Scope
1. Rename: Tap session title (TopBar or Info panel) -> RPC `set_session_name`. Check frame push vs refresh after success.
2. Rewind: Per-message action on user rows (and/or assistant rows) to branch: RPC `branch {entryId}`. Confirm first. Refuse/disable while streaming.
3. Delete past session: Daemon `DELETE /api/past/:id`. Resolve file on daemon side via lookup matching `/api/past/:id/resume`. Validate ID format, refuse 409 if live omp holds session, use session deletion API if one exists. Confirm first in UI. Tests for success, 404, 409, path traversal.
4. Retry: Retry button shown when last turn ended in error. Determine if `/retry` works over RPC (prompt text or existing command) or add minimal RPC `retry`.

## Findings & Implementation

### 1. Rename
- Coding-agent RPC already has `set_session_name` (`rpc-types.ts:119`, `rpc-server.ts:1631`). It calls `await session.setSessionName(name, "user")`.
- `session.sessionManager.setSessionName` triggers `this.#notifySessionNameListeners()` and `this.#sessionNameChangedCallbacks`.
- We added `session.sessionManager.onSessionNameChanged` subscription in `packages/coding-agent/src/modes/rpc/rpc-server.ts` to broadcast `{ type: "session_info_update", title: session.sessionName ?? "", sessionId: session.sessionId }` across all active connections.
- In `packages/webgui/src/lib/session-actions.ts`, added `setSessionName(sink, name)`.
- In `packages/webgui/src/lib/session-store.ts`, added `refreshSessionState()` on `SessionStore` (invoking `fetchSessionState()`).
- In `TopBar.tsx` and `SessionInfo` (`App.tsx`), implemented tap-to-edit rename modal/form.
- Verified live:
  - Tapped `.tb-title-btn` at 390px -> rename dialog opened with pre-filled title.
  - Entered new name -> saved -> title updated in Tab 1 immediately.
  - Opened Tab 2 to same session -> Tab 2 received `session_info_update` frame and updated title live without refresh.

### 2. Rewind
- Coding-agent RPC already has `branch` (`rpc-types.ts:116`, `rpc-server.ts:620` -> `session.branch(entryId)`).
- `agent-session.ts:10147` enforces `selectedEntry?.type === 'message' && selectedEntry.message.role === 'user'`.
- In `Transcript.tsx`, finished entries have `entry.id`. Passed `entryId: entry.id` to user row items in `UserItem`.
- In `UserRow.tsx`, added a Rewind button with 2-tap armed confirmation (`armed` state, 4s timeout).
- Disabled while `working` or `streaming`.
- In `session-actions.ts`, added `branch(sink, entryId)`.
- Verified live:
  - Sent prompt "Say hello in 3 words" in test session.
  - User row rendered with `[Rewind]` button.
  - Tapped Rewind -> entered armed state (`"Confirm rewind?"`).
  - Tapped again -> RPC `branch` executed, v3 `branch` frame received, view reloaded to branched state.

### 3. Delete Past Session
- Daemon endpoint `DELETE /api/past/:id` in `src/server/past.ts`:
  - Validates `id` against `/^[a-zA-Z0-9_-]+$/` to strictly reject path traversal and raw client file paths (returns 400).
  - Checks live sessions using `listRpcHosts({ dir: opts.registryDir })`. If any live host matches `h.sessionId === id`, refuses with 409 Conflict.
  - Looks up session across all projects using `listAllSessions(storage, opts.sessionsDir)`. If not found, returns 404.
  - Uses `storage.deleteSessionWithArtifacts(target.path)` (`FileSessionStorage.prototype.deleteSessionWithArtifacts`) to delete `.jsonl`, artifact directories, and stale backups.
- In `server/index.ts`: restricted `serveStatic` fallback to `GET` and `HEAD` requests only, ensuring non-GET/HEAD calls do not accidentally return 200 HTML.
- In `sessions-api.ts`: added `deletePast(id, signal)`.
- In `SessionRow.tsx`: `PastSessionRow` now renders a `Delete` button with 2-tap armed confirmation (`armed` state, 4s timeout).
- In `SessionsScreen.tsx`: wired `handleDeletePast` to call `api.deletePast(id)` and remove the session row from state.
- Verified in tests and live:
  - 400 for path traversal / client paths.
  - 404 for unknown session id.
  - 409 for active live session.
  - 200 for deleting session and its artifacts directory.

### 4. Retry
- Proven that `/retry` works over RPC via `sendPrompt(sink, "/retry")`:
  - `rpc-server.ts:1169-1200` routes `prompt` messages through `executeAcpBuiltinSlashCommand`.
  - Slash command `/retry` runs `runtime.session.retry()`, emits `command_output` "Retrying the last failed turn.", and returns `{ agentInvoked: true }`, scheduling the continuation turn.
- In `session-actions.ts`: added `retry(sink)`.
- In `Transcript.tsx`: when a `stop` row has `reason === "error"` or `reason === "aborted"`, renders a visible `[Retry]` button.
- Disabled when `working` / `streaming`.
- Verified live:
  - Sent prompt and aborted it -> `tr-stop` row rendered with `[Retry]` button.
  - Tapped `[Retry]` -> called `/retry` over RPC, restart turn scheduled.

### 5. Layout & Peer Integration
- Verified 390px mobile layout and 1280px desktop layout (sidebar, inspector, topbar all visible and functional).
- Integrated `TodoPanel` route in `route.ts`, inspector and panel overlay in `App.tsx`, and `onOpenTodos` in `StatusStrip.tsx`.
- All tests passing:
  - `bun --cwd=packages/webgui test`: 386 pass, 0 fail.
  - `bun --cwd=packages/webgui run check`: oxlint, oxfmt, tsgo pass with 0 errors.
  - `bun --cwd=packages/coding-agent test ./test/rpc-session-controls.test.ts ./test/rpc-compatible-primitives.test.ts`: 11 pass, 0 fail.
