# Todo Observability + Control Research Notes

## 1. Read Path: How Webgui Gets Current Todo Phases

### State in `get_state`
- `get_state` RPC returns `RpcSessionState` which includes `todoPhases: TodoPhase[]`.
- Each `TodoPhase` has `{ name: string, tasks: TodoItem[] }`.
- Each `TodoItem` has `{ content: string, status: TodoStatus, blocker?: string, details?: string, notes?: string[] }`.
- `TodoStatus` in the codebase is `"pending" | "in_progress" | "completed" | "abandoned" | "blocked"`.
  - In user-facing terms, "done" = "completed", "dropped" = "abandoned".
- `session-store.ts` already fetches `get_state` (`fetchSessionState()`) on attach (`ready`), and on:
  - `turn_end`
  - `agent_end`
  - `model_changed`
  - `thinking_level_changed`
  - `session_info_update`
  - `config_update`
- Therefore, `sessionState.todoPhases` is updated automatically at the end of every agent turn.

### Wire Frames Pushing Todo Updates
1. `entry` frames (over RPC v3):
   - When the agent executes a `todo` tool call, the tool result message is appended to the session branch.
   - SessionManager emits `onEntry`, and `RpcV3Translator` emits `{ type: "entry", entry: SessionEntry }`.
   - For a `todo` tool result: `entry.type === "message"` and `entry.message.role === "toolResult"` and `entry.message.toolName === "todo"`.
   - The tool details contain `{ op, phases: TodoPhase[], storage }`.
   - Also, if custom entries are appended with `customType: "user_todo_edit"`, `entry.type === "custom"` with `entry.data.phases`.
2. `tool_execution_end` event frames:
   - When a tool finishes execution, `agent-session.ts` emits `tool_execution_end`.
   - `RpcV3Translator.handleEvent` returns `false` for `tool_execution_end`, so `rpc-server.ts` emits it to subscribers.
   - If `event.toolName === "todo"`, `event.result.details.phases` contains the updated `TodoPhase[]`.
3. `turn_end` / `agent_end` event frames:
   - Always emitted when an agent completes a turn.
   - `session-store.ts` calls `fetchSessionState()` upon receiving `turn_end` or `agent_end`.

### Immediate Derivation vs Push
- Deriving todo updates directly from:
  1. `entry` events (`toolResult` for `todo` or `user_todo_edit`),
  2. `tool_execution_end` events for `todo`,
  3. `fetchSessionState()` on `turn_end` / `agent_end` / after `set_todos`.
- This ensures updates are reflected in the UI immediately without waiting for `turn_end`, and re-synced at turn boundaries.
- No new push frames are required from coding-agent.

## 2. Server-side `set_todos` Persistence & Synchronization
- In `rpc-server.ts:1357`:
  `case "set_todos": { session.setTodoPhases(command.phases); return success(id, "set_todos", { todoPhases: session.getTodoPhases() }); }`
- Calling `session.sessionManager.appendCustomEntry(USER_TODO_EDIT_CUSTOM_TYPE, { phases: command.phases })` ensures the edit is recorded on the branch (matching TUI interactive mode and slash commands) and survives reloads/compaction.
- Unit tested in `packages/coding-agent/test/rpc-todos.test.ts`.

## 3. UI Implementation
- Module `src/lib/todo-model.ts` provides:
  - `countTodoProgress`: Calculates closed/total/completed/in-progress/pending/abandoned/blocked counts and percent.
  - `cycleTaskStatus`: Canonical cycle sequence `pending` -> `in_progress` -> `completed` -> `abandoned` -> `pending` (and `blocked` -> `in_progress`).
  - `updateTaskStatus`: Immutable updates for task status in phases.
  - `extractTodoPhasesFromEvent`: Derives fresh `TodoPhase[]` from `entry` or `tool_execution_end` events.
- Component `src/components/todos/TodoPanel.tsx` and styles in `todos.css`:
  - 44px min touch targets on all interactive elements.
  - Phased task list with Roman numeral headers.
  - Status indicators and tap-to-cycle or tap-to-set with direct feedback.
  - Summary bar with closed count and progress bar.
  - Concurrency safety with `submitting` latch.
- Component `src/components/shell/StatusStrip.tsx`:
  - Compact `ss-todos` button showing checkmark and `${closed}/${total}` (e.g. `3/7`).
  - Clicking triggers `onOpenTodos` which navigates to `#/s/<id>/todos`.
