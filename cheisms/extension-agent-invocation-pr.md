# Upstream PR proposal: extension agent invocation API

Fork-only note. Plan for upstreaming the change that lets the `dialectic`
extension (`~/.omp/extensions/dialectic`) run. Status: proposal, not started.

## What it adds

- `ctx.invokeAgent(request)` on `ExtensionContext`: run a task agent (`task`,
  `scout`, or a custom agent) through the session's task runtime, await it, and
  get structured output (`outputSchema`, `schemaMode`).
- `pi.setForcedToolChoice(toolName)` on `ExtensionAPI`: force the next model
  call to invoke one named tool, so a slash command can hand off to a tool.
- Code mode keeps essential (`loadMode: "essential"`) extension tools direct.

Proposed title: `feat(extensions): let extensions invoke task agents and force
tool choice`.

## Why it is small

Upstream already has every building block: `AgentSession.setForcedToolChoice`
(used by builtin slash commands), `task/structured-subagent.ts`
(`runStructuredSubagent`), and `loadMode` on extension tools. The patch is
wiring: API types, runner and loader stubs, and one line per host (TUI
extension controller, `runtime-init.ts`, ACP agent, executor subprocess,
session context). Upstream has no `invokeAgent` and does not expose
`setForcedToolChoice` to extensions (checked 2026-09-29).

## Source

Fork commit `feat: expose agent invocation and tool controls to extension
runtime`. Current diff against `upstream/main` for the touched source files is
+192/-10, but it mixes in fork-only code.

Remove before the PR:

- `packages/webgui/research/*.md` (about 1,100 lines of unrelated notes in the
  same commit).
- `ModelSource` type and `AgentSession.modelSource` getter (webgui/RPC model
  parity work).
- `LABEL_MAX` in `task/types.ts`.
- Anything fork-specific in the `invokeAgent` body in `agent-session.ts` (not
  yet read in full).

Expected result: about 150 source lines plus about 195 test lines.

## Steps

1. Branch from `upstream/main`; cherry-pick the commit; drop the items above.
2. Decide the `code-mode.ts` change: keep with a stated reason (an extension
   tool marked essential must stay directly callable in code mode), or split
   into its own PR. It affects every extension, not only dialectic.
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
