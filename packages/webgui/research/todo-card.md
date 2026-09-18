# Webgui Todo Card Tree Rendering & Consecutive Run Grouping Research & Plan

## Overview
- Goal: Render todo tool calls as an omp terminal UI-styled tree.
- Goal: Group consecutive todo calls (even if thinking rows occur between them) into a single row showing the latest state and an update count (e.g., "8 updates").
- Keep error results rendered with error display.
- Row key stability: first call's key must be preserved for virtual list / prepend scroll anchoring.

## Findings & Decisions

### 1. Grouping Rule (Consecutive Runs & Thinking Rows)
- **Decision on thinking rows**: A run consists of consecutive todo tool calls. Any thinking row appearing strictly between todo tool calls within the run is absorbed (suppressed from creating standalone thinking rows), so the entire sequence coalesces into one uninterrupted todo card.
- Any other row type (assistant text, assistant images, non-todo tool calls like bash/read/edit, user messages, developer reminders, dividers, markers, stop, shimmer) immediately breaks the run.
- Thinking rows that precede the first todo call in the turn, or follow the last todo call, are preserved normally.
- The coalesced row item has:
  - `id`: stable ID from the **first** call in the group (preserves virtualizer scroll anchoring across streaming extensions and page prepends).
  - `groupCount`: total number of coalesced todo calls in the run.
  - `toolCallId`, `args`, `result`, `running`, `partialResult`, `intent`, `startedAt`: from the **last** call in the group.
- Coalescing is performed in the row-building layer (`flattenEntries` / transcript-model).

### 2. Tree Rendering Architecture
- Move `formatRoman(n: number)` and `ROMAN_PAIRS` into `src/lib/todo-model.ts` (reused by `TodoPanel.tsx`, `todo.tsx`, tests).
- Add `selectActivePhaseIndex(phases: readonly TodoPhase[]): number` to `src/lib/todo-model.ts`:
  1. Phase with `in_progress` task (`phase.tasks.some(t => t.status === "in_progress")`).
  2. Else first phase with open tasks (`!isClosedTodo(t.status)`).
  3. Else last phase (`phases[phases.length - 1]`).
- In `src/components/transcript/tool-views/tools/todo.tsx`:
  - `Summary`: If `groupCount && groupCount > 1`, show badge `8 updates` (along with first task if present).
  - Default open: card is expanded by default (`defaultOpen: true` on `todoRenderer`).
  - `Body`: If `phases` available and not error:
    - Renders the terminal UI-style tree:
      - Root header: `TODO`
      - Phases before/after active phase: dim one-line summary ` ├─ I. Name · 0/4`
      - Active phase: ` ├─ III. GUI tmux · 0/3`
        - Child tasks: ` │   ├─ ☐ Launch from GUI lands in ompgui session (blocked)`
        - Final task: ` │   └─ ☐ GUI badge shows in sessions list (blocked)`
      - Tree footer: ` └──`
    - Tasks formatted with:
      - Checkbox markers: `☑` for completed, `☐` for pending/in_progress/blocked/abandoned.
      - Suffix: `(blocked)` or `(blocked: reason)` for blocked, `(in progress)` for in_progress.
      - Completed tasks: strikethrough + success styling.
      - In progress: accent styling.
      - Blocked: warning styling.
      - Abandoned: strikethrough + error/muted styling.
      - Pending: dim styling.
    - 390px-safe wrapping: Flex row layout where connector rail ` │   ├─ ` does not wrap, and label wraps cleanly aligned under itself.
    - Monospace font with CSS tree connector styling.
    - Error results continue to render `ResultText` error output.

### 3. File Plan
- `packages/webgui/src/lib/todo-model.ts`: add `formatRoman`, `selectActivePhaseIndex`, `isClosedTodo` export.
- `packages/webgui/src/components/todos/TodoPanel.tsx`: import `formatRoman` from `todo-model.ts`.
- `packages/webgui/src/lib/transcript-model.ts`: move/export `flattenEntries`, `RowItem`, and grouping logic so it can be tested directly and used by `Transcript.tsx`.
- `packages/webgui/src/components/transcript/Transcript.tsx`: import `flattenEntries` from `transcript-model.ts`. Pass `groupCount` to `ToolCard`.
- `packages/webgui/src/components/transcript/ToolCard.tsx`: pass `groupCount` to `ToolView`.
- `packages/webgui/src/components/transcript/tool-views/types.ts`: add `groupCount?: number` to `ToolRenderProps`, `ToolViewProps`, `defaultOpen?: boolean` to `ToolRenderer`.
- `packages/webgui/src/components/transcript/tool-views/ToolView.tsx`: pass `groupCount`, handle `renderer.defaultOpen`.
- `packages/webgui/src/components/transcript/tool-views/tools/todo.tsx`: tree renderer, active phase, Roman numerals, count badges.
- `packages/webgui/src/components/transcript/tool-views/tool-render.css`: styles for `.tv-todo-tree`, `.tv-todo-row`, `.tv-todo-connector`, `.tv-todo-label`, status colors, 390px wrapping.
- Tests:
  - `packages/webgui/test/transcript-model.test.ts`: grouping tests (run of N, broken by assistant text, live extension, page-boundary merge).
  - `packages/webgui/test/todo-model.test.ts`: active-phase selection and roman numerals.
  - `packages/webgui/test/todo-render.test.tsx`: renderer test for tree, active-phase selection, markers, suffixes, and counts.

## Verification & Screenshot Evidence
- Full test suite: `bun --cwd=packages/webgui test` passes (419 tests across 31 files, 0 failures).
- Static check: `bun --cwd=packages/webgui run check` passes with 0 linter/formatter/type errors.
- Live session verification: opened `http://127.0.0.1:8081/#/s/e235bb360b53986a` via headless Chromium:
  - **1280px (`packages/webgui/research/todo-card-1280px.png`)**:
    - Header: `• todo [8 updates] GUI badge shows in sessions list`
    - Body (default open):
      ```
      Blocking badge check
      TODO
       ├─ I. Session controls · 0/4
       ├─ II. Todo panel · 0/2
       ├─ III. GUI tmux · 0/3
       │   ├─ ☐ Launch from GUI lands in ompgui session (blocked: User tests by hand)
       │   ├─ ☐ Shutdown closes the tmux window (blocked: User tests by hand)
       │   └─ ☐ GUI badge shows in sessions list (blocked: User tests by hand)
       └──
      ```
    - 8 consecutive todo block calls render as ONE card showing the final state.
  - **390px (`packages/webgui/research/todo-card-390px.png`)**:
    - Header displays truncated summary cleanly.
    - Monospace tree lines with flex connector rails ` │   ├─ ` / ` │   └─ ` keep rail alignment while long task descriptions and `(blocked: User tests by hand)` suffixes wrap underneath without cutting into margins or tree rails.
