# GUI Tmux Integration Research & Notes

## Initial Scope and Codebase Map

### Key Files
- `packages/webgui/src/server/tmux.ts`: defines `TmuxRunner`, `runTmux`, `buildNewWindowArgv`, `newWindow`.
- `packages/webgui/src/server/launch.ts`: handles `POST /api/launch` and `POST /api/past/:id/resume`. Calls `newWindow(opts.tmux, cwd, [...])`.
- `packages/webgui/src/server/live.ts`: handles `GET /api/live`, calls `listLiveSessions(opts)`.
- `packages/webgui/src/server/options.ts`: `DaemonOptions` includes `tmux?: TmuxRunner`.
- `packages/webgui/src/lib/sessions-api.ts`: frontend client types (`LiveSessionEntry`) and api methods (`listLive`).
- `packages/webgui/src/components/sessions/`: UI rendering sessions list and session rows (`SessionRow.tsx`, `SessionList.tsx`, etc.).
- `packages/webgui/test/`: `tmux.test.ts`, `launch.test.ts`, `live.test.ts`, `endpoints.test.ts`, `sessions-api.test.ts`.

### Requirements Breakdown
1. **Close on exit**:
   - `buildNewWindowArgv` runs `fish -C '<omp …>; exit'`.
   - Preserve `fishEscape` quoting.
2. **Hidden session `ompgui`**:
   - Before `new-window`, ensure session `ompgui` exists:
     `tmux has-session -t =ompgui` -> if fails, `tmux new-session -d -s ompgui`.
   - Handle race where two launches create it at once (treat "duplicate session" error as success).
   - Target `ompgui:` instead of `0:`.
   - New-session initial window handling: ensure it doesn't stay around as a stray shell (either launch omp as new-session's first command, or kill initial window only if it is the one this code just created (by window id)).
3. **Tag `@ompgui`**:
   - Set window option `@ompgui` on created window: `tmux set-option -w -t <window_id> @ompgui 1` (check if tmux accepts no value, otherwise use `1`; detection is by presence).
   - Detection: map each live omp (registry pid) to pane via one `tmux list-panes -a -F '#{pane_pid} #{window_id} #{@ompgui}'`.
   - Match omp pid or parent chain up to pane pid.
   - Expose `origin: "gui" | "cli" | "unknown"` on live session entries; the sessions row shows a small `GUI` badge for gui.
4. **Tests**:
   - Argv builders: `; exit`, `ompgui:` target.
   - Ensure-session paths: exists, create, duplicate race.
   - Tag detection parsing: tagged, untagged, no tmux.
   - Endpoints/UI tests.

## Findings & Tmux Verification
1. `tmux set-option -w -t <window_id> @ompgui`:
   - Setting without value fails with exit code 1 (`empty value`).
   - Setting with value `1` (`tmux set-option -w -t <id> @ompgui 1`) succeeds.
   - In `tmux list-panes -a -F '#{pane_pid} #{window_id} #{@ompgui}'`:
     - Tagged window pane prints: `<pane_pid> <window_id> 1`
     - Untagged window pane prints: `<pane_pid> <window_id> ` (trailing space or blank field)
2. `ensureSession`:
   - `tmux has-session -t =ompgui`: exit 0 if exists.
   - If not, `tmux new-session -d -s ompgui -P -F '#{window_id}'`:
     - Returns initial window id (e.g. `@69`).
     - If concurrent launch already created it, returns non-zero with "duplicate session", which is treated as success.
   - When new session is created, we keep the initial window ID, then create the real omp window with `new-window -t ompgui:`, tag it with `@ompgui 1`, and then kill the initial window ID by ID (`kill-window -t <initialWindowId>`). Tested and verified this cleans up the initial dummy shell cleanly while keeping the session and the new window alive.
3. Process Tree Mapping:
   - Live omp pid is recorded in `~/.omp/run/rpc-hosts/*.json`.
   - In tmux, the pane pid is the shell (e.g. `fish`).
   - `fish` spawns `omp` (bun process).
   - Using `ps -o pid=,ppid= -A` (takes <10ms), we build a PID -> PPID map.
   - Walking up the parent chain of `ompPid`:
     - If we reach a `pane_pid`:
       - If that pane's window has `@ompgui`: `origin = "gui"`.
       - If not: `origin = "cli"`.
     - If we never reach any tmux `pane_pid`, or if tmux runner fails: `origin = "unknown"`.

## Verification & Live Evidence
- Daemon restarted on port 8081 via `webgui-daemon` service with updated production build.
- `POST /api/launch { "cwd": "/private/tmp" }` returned `{ windowId: "@82", instanceId: "13540e7ad3b99529" }`.
- Window `@82` created in `ompgui:` session: `ompgui @82 fish`.
- Session 0 preserved with 6 original windows: `@0, @2, @1, @5, @6, @38`. Session 0 got NO new windows.
- Pane tagged with `@ompgui 1`: `97169 @82 1`.
- `GET /api/live` returned `"origin":"gui"` for `13540e7ad3b99529` and `"origin":"cli"` for existing CLI sessions.
- UI renders `<span className="ses-badge ses-badge--gui">GUI</span>` for `"gui"` entries and omits it for `"cli"`/`"unknown"`.
- RPC shutdown returned 204.
- All test suites pass: 404 tests across 30 files, 0 fails.
- Linter and typecheck pass clean (`bun --cwd=packages/webgui run check`).
