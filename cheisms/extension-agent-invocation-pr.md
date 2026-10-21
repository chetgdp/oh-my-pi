# Upstream PR proposal: extension agent invocation API

Fork-only note. Plan for upstreaming the change that lets the `dialectic`
extension (`~/.omp/extensions/dialectic`) run.

Status: partial. Implemented in the fork (`invokeAgent` at
`extensibility/extensions/types.ts:690`, `agent-session.ts:8677`;
`setForcedToolChoice` at `types.ts:1916`, `loader.ts:311`). Upstream PR not
started; `upstream/main` still lacks both (checked 2026-10-20).

## What it adds

- `ctx.invokeAgent(request)` on `ExtensionContext`: run a task agent (`task`,
  `scout`, or a custom agent) through the session's task runtime, await it, and
  get structured output (`outputSchema`, `schemaMode`).
- `pi.setForcedToolChoice(toolName)` on `ExtensionAPI`: force the next model
  call to invoke one named tool, so a slash command can hand off to a tool.
- Code mode: there is no `code-mode.ts` in the tree today and the fork commit
  does not touch it; the essential-tools change is not part of this patch.

Proposed title: `feat(extensions): let extensions invoke task agents and force
tool choice`.

## Why it is small

Upstream already has every building block: `AgentSession.setForcedToolChoice`
(used by builtin slash commands), `task/structured-subagent.ts`
(`runStructuredSubagent`), and `loadMode` on extension tools. The patch is
wiring: API types, runner and loader stubs, and one line per host (TUI
extension controller, `runtime-init.ts`, ACP agent, executor subprocess,
session context). Upstream has no `invokeAgent` and does not expose
`setForcedToolChoice` to extensions (rechecked 2026-10-20).

## Source

Fork commit `aaf3e336fe` (`feat: expose agent invocation and tool controls to
extension runtime`). Its source part is about +140/-6 across 11 files under
`packages/coding-agent/src`, plus about 180 test lines.

Remove before the PR:

- `packages/webgui/bench/browser-render-results.json` and
  `packages/webgui/dist-bench/*` (about 350,000 lines of build output committed
  in the same commit).
- `ModelSource` type and `AgentSession.modelSource` getter (webgui/RPC model
  parity work).
- `LABEL_MAX` in `task/types.ts`.
- Anything fork-specific in the `invokeAgent` body
  (`agent-session.ts:8677`).

Expected result: about 150 source lines plus about 195 test lines.

## Steps

1. Branch from `upstream/main`; cherry-pick the commit; drop the items above.
2. Code mode: no change needed; drop this step unless a code-mode file
   returns.
3. Tests: rename the `dialectic` fixture in `extensions-runner.test.ts` to a
   neutral name. Run the extension runner tests, `session-code-mode.test.ts`,
   and `bun check` in `packages/coding-agent`.
4. PR description: the API, dialectic as the motivating example, and the open
   questions below.

## Open questions for upstream

- `invokeAgent` lets any loaded extension start agents with no tool-approval
  step. Upstream may want a permission gate or a concurrency cap shared with
  `task.maxConcurrency`.
- Whether upstream accepts outside PRs for extension API changes; an issue
  first may be the better path.
- Whether to publish the dialectic extension as the example.

## Context

The same API supports turning prompt-steered workflows (the `workflowz` and
`jevify` magic keywords, which only inject a hidden notice) into fixed
programs with enforced stage order and output checks, the way dialectic does.
