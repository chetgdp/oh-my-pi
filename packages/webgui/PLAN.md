# OMP Web GUI

What we are building, why, what is fixed, and how far along we are.
Implementation lives in code, tests, and HISTORY.md. Update this when the
vision or a fixed decision changes, not when code changes.

## Why

omp sessions live in tmux windows on the host (the M5 Pro). From a laptop,
ssh + tmux attach is a fine client. From a phone it is not: tmux key chords,
broken scrollback, and flaky ssh make it unusable. The web GUI is the
phone-shaped client to the same sessions.

A second horizon (B) is observability for an agent-swarm product built on omp,
aimed at people who never open a terminal: navigating a deep tree of subagents.
It rides on the same attach channel. No design yet; it comes after A works.

## What it feels like when done (A)

- Open the GUI on the phone. See every omp session running on the host,
  clearly separated from past sessions on disk.
- Tap a live one. See the current turn streaming: thinking, tool calls,
  subagent activity. Same fidelity as the terminal.
- Type a prompt, steer mid-turn, abort. The tmux window shows the same thing
  happening. Both clients are equal.
- Start a new session, choosing the working directory. It appears as a new
  tmux window on the host and in the list within seconds.
- Tap a past session. It resumes in a new tmux window and becomes live.
- Shut a session down from the phone. The omp process exits; the tmux window
  and anything else in it survive.
- Close the browser, lose the network, come back. Nothing was lost, because
  nothing depended on the browser.

## Fixed decisions

- **Sessions are owned by omp processes in tmux.** The GUI never owns a
  session. It attaches, drives, detaches. Same model as a tmux client.
- **RPC is the protocol.** Every interactive omp optionally serves the full
  coding-agent RPC protocol over a per-process Unix socket, alongside its TUI,
  and publishes discovery metadata (pid, socket path, bearer token) under
  `~/.omp/run/`. This is the same pattern collab uses for its local registry.
  Off by default; a setting turns it on.
- **The daemon is a relay, not a translator.** One WebSocket per attached
  session. The daemon connects to that process's socket and copies RPC frames
  both ways unchanged. It adds discovery (walk the registry), launching
  (`tmux new-window -t 0 -c <cwd> omp ...`), past-session browsing (session
  files on disk), and static hosting. It never reshapes frames.
- **The browser speaks RPC.** The client consumes coding-agent RPC types
  directly. No second protocol.
- **No UI-request handling.** `ask.enabled=false` on this host; extension
  dialogs, if any, stay on the TUI. The GUI does not present or answer them.
- **Concurrency is AgentSession's job.** TUI and browser both submit
  prompt/steer/abort; the session's own admission logic orders them. No
  leases, no read-only tier.
- **Kill means RPC shutdown**, never `tmux kill-window`.
- **`packages/webgui` is ours; upstream stays upstream.** Never published.
  It imports renderers, Markdown, transcript, and agent components from
  `packages/collab-web` read-only. Anything we need to change is copied here.
  Edits to `packages/coding-agent` are the minimum needed to serve RPC beside
  the TUI, localized so upstream syncs stay cheap.
- **Reach.** The daemon is already exposed on 8081 via Tailscale serve, which
  provides the secure context the browser needs. The daemon runs in its own
  tmux window for now; a login service can come later.

## Contracts

Wire and file-format contracts the implementation holds. Cited by letter in
NOTES.md and HISTORY.md.

- A. Setting `rpc.serve`: boolean, default false, `config/settings-schema.ts` beside `collab.*`. No CLI flag.
- B. Registry dir `<configRoot>/run/rpc-hosts/`. One `<entryId>.json` per process, mode 0600, temp+rename. Fields: `version, instanceId, pid, endpoint, token, createdAt, sessionId, sessionName, cwd, model, startedAt`. Rewritten on session change. List = read files, drop entries whose pid is dead. Processes addressed by `instanceId`.
- C. Socket: client sends `{"type":"auth","token":"<hex>"}\n` first. Server replies with the existing `ready` frame, or an error frame and closes. After that: plain RPC NDJSON.
- D. Over the socket, `shutdown` exits omp through `InteractiveMode` teardown. Socket EOF or write failure closes that connection only. All other commands identical to stdio.
- E. Session change: connections stay open, get the existing session-change frames (`handleRpcSessionChange`), metadata file rewritten.
- F. Daemon HTTP:
  - `GET /api/live` → B entries minus `token`, `endpoint`.
  - `GET /api/past?cwd=&all=` → `SessionManager.list/listAll`.
  - `GET /api/past/:id` → `loadSessionFile` preview.
  - `POST /api/launch {cwd}` → `{windowId, instanceId?}`.
  - `POST /api/past/:id/resume` → `{windowId, instanceId?}`.
  - `POST /api/live/:instanceId/shutdown` → 204.
  - `GET /ws/:instanceId` → WebSocket. Daemon does C; browser sees `ready` onward; bytes copied verbatim both ways.
- G. Daemon binds `127.0.0.1:8081`. Env `HOST`, `PORT` override.
- H. Launch: `tmux new-window -t 0: -c <cwd> -P -F '#{window_id}' -- fish -C 'omp'`. Resume: `… fish -C 'omp --resume <id>'`. `omp` is the autoloaded function in `~/.config/fish/functions/omp.fish` (runs `bun <repo>/packages/coding-agent/src/cli.ts --allow-home`). The `-C` (init-command) flag runs the command and then drops into an interactive shell in the same window, so the tmux window survives when omp exits.
- I. `set_model_role { role, selector: string | null, persist?: boolean, storage?: "global" | "project" }`. `persist` defaults true; `false` applies a runtime-only value (`session.setModel(..., {persist:false})` for `default`, `Settings.override("modelRoles")` for others) and never touches disk. `storage` defaults to `modelRoleStorage`; `"project"` when `modelRoleStorage` is `global` is an error. Default-role writes follow the TUI hub's shadowing rules (`selector-controller.ts` `onAssign`). Raw selector stored verbatim (`@role`, fuzzy, `:level`, `@upstream` preserved). Role ids: known or `/^[a-zA-Z][\w-]*$/`.
- J. `get_model_roles` carries, per role, `provenance` (`runtime|overlay|project|global|default`), `custom`, `autoSelected` (auto-selection result for unconfigured roles, via `resolveRoleAssignments`), `tag`; and on the result `cycleOrder` and `modelTags`. Mutations `delete_model_role {role}` (custom only; clears both scopes and removes from `cycleOrder`), `set_cycle_order {order}` (known roles, no duplicates), `set_model_tag {model, tag|null}` return the full roles result and emit `config_update {modelRoles:true}`.
- K. `cycle_role_model {direction?}` cycles `cycleOrder` roles through `session.cycleRoleModels`; returns `{ role, model, cycle: { roles, currentIndex } } | null`. Session-only, like alt+p.
- L. `get_model_browser` returns `{ models, mruOrder, providers, kinds }`: every catalog model (`registry.getAll("all")`) with `locked` (no credentials), `perf {samples,tps,ttftMs}`, `roles [{role, auto}]`, `tag`, `kind`; provider auth and discovery status. `refresh_models {provider?}` awaits `modelRegistry.refresh("online")` / `refreshProvider`, emits `config_update {models:true}`, returns the browser result. Data sourced through `createModelBrowserSource(settings)` and `@oh-my-pi/pi-tui/overlays/model-browser` read-only; nothing moves out of `packages/tui`.
- M. `RpcSessionState.modelSource?: { kind: "role" | "temporary" | "ephemeral" | "fallback", role?, fallbackFrom? }`. `role` = latest model-change session entry's role (`default` for the default role); `temporary`/`ephemeral` = `/switch`-style session change; `fallback` = retry fallback chain serving in place of `fallbackFrom` (`session.servingModel`). Context promotion has no public state and is not reported.
- N. `get_agents` carries, per agent, `serviceTier`, `prewalk {effective?, source: override|frontmatter|default|none}`, `advisor {effective?, source: override|frontmatter|none}`, `isDefaultTaskAgent`, `precedence { entries [{source, selector}], winner }` (override > frontmatter > parentActive > parentFallback > defaultRole). Mutations `set_agent_enabled {agent, enabled}` (`task.disabledAgents`), `set_agent_service_tier {agent, tier|null}` (`task.agentServiceTierOverrides`, validated by `config/service-tier.ts`), `set_agent_prewalk {agent, value|null}` (`task.agentPrewalk`), `set_agent_advisor {agent, value|null}` (`task.agentAdvisor`) return the updated agent and emit `config_update {agents:true}`.
- `config_update` frames reach only the connection that issued the mutation (per-connection output). Cross-client push is deferred (TASK.md D3).


## Misreadings to avoid

Each of these was made once during planning. Do not make them again.

- This does not replace ssh + tmux. The laptop keeps using them. It adds a
  client for the phone, where tmux is unusable.
- The daemon never owns or spawns the sessions it shows. Spawning a private
  `--mode rpc-ui` child was the prototype's mistake.
- Collab is the pattern for discovery (metadata files, per-process socket,
  bearer token), not the mechanism. Its wire format is a shrunk subset over a
  relay for untrusted guests. We want the full RPC protocol on a trusted host.
- RPC mode and the TUI are mutually exclusive in upstream today
  (`main.ts` mode dispatch). Making them coexist in one process is the work,
  not a detail.
- UI requests (ask/select/editor dialogs) are dead on this host. Do not
  design arbitration for them, do not carry `ui_request` frames.
- Shutdown from the GUI is RPC `shutdown` of the omp process. The tmux window
  and whatever else runs in it survive. Never `tmux kill-window`.
- Sessions started from the phone run in a tmux window on the host, so the
  laptop can pick them up later. Never GUI-only sessions.
- The daemon does not translate frames. If you find yourself defining
  `event`/`entry`/`state` message types or a replay ring buffer, stop.

## Where we are

Dated. Capability level only.

**2026-09-21.** A prototype exists inside `packages/collab-web` (server under
`src/server/`, client `src/lib/rpc-web-client.ts`, session switcher, REST
session browsing). It spawns and owns a single private `--mode rpc-ui` child,
so it cannot see sessions running in tmux; that model is abandoned. What
carries forward: the UI shell work, the tool renderers, past-session listing
and preview, and the tests for those. Nothing in the coding-agent yet serves
RPC beside the TUI; `runRpcMode` is single-stream stdin/stdout and owns the
process. Working notes with file:line references for item 1 below are in
`NOTES.md`.

**2026-09-21 (late).** Waves A-C (T1-T22) landed. omp serves full RPC over
a per-process Unix socket beside the TUI when `rpc.serve` is on, with
discovery metadata under `~/.omp/run/rpc-hosts/`. The daemon in
`packages/webgui` relays WebSocket-to-socket, serves live/past/launch/
resume/shutdown endpoints, and hosts the SPA. The browser client attaches,
streams transcript and subagent events, reconnects after drops, and provides
prompt/steer/abort/model controls. 120 tests across 19 files.

**2026-09-21 (proof of concept).** Minimum E2E state reached. Verified
topology: M1 Air thin client over ssh controls tmux sessions on the M5 Pro
host and opens new ones; the phone attaches to the same sessions through
the Tailscale-served daemon. Data transfer works end to end. Items 1-3 below
are done. The work now is the UI/UX itself (item 4), on the real surface.

**2026-09-21 (presentation rewrite).** The browser UI layer was rebuilt
without collab-web: route-driven shell responsive from 320 px to desktop
(sidebar at 720, inspector at 1100), virtualized transcript with owned
Markdown and tool views, composer with steer/queue/stop and pickers,
grouped sessions screen, status strip, toasts and reconnect banner.
Verified in headless Chromium at three widths against a live tmux
session. 185 tests across 21 files. Item 4 is in a workable state; real
iPhone verification is outstanding (NOTES.md "Open").

**2026-09-22 (model roles, first cut).** RPC gained `get_model_roles`,
`set_model_role`, `get_agents`, `set_agent_model`, and `set_model
{persist}`. The webgui has a Models panel (roles + agents) and one picker
sheet for active model, roles, and agent overrides. Persisted writes go
through `Settings.setModelRole` / `task.agentModelOverrides`, so they merge
against concurrent TUI edits the same way. This is a subset of what the TUI
`/models` hub does; item 5 below defines the rest.

## What comes next, in order of user value

1. Done. omp serves RPC over a Unix socket beside the TUI, with discovery
   metadata. Verified by attaching a second client to a live tmux session.
2. Done. Daemon in `packages/webgui`: registry walk, one-WebSocket-per-
   session relay, static SPA. Browser attaches to any live session.
3. Done. Session list: live vs past. New session with cwd choice, resume
   past, shutdown. All via tmux window 0 on the host.
4. **Workable.** UI/UX across surfaces: phone-first, usable at
   any width with touch or mouse+keyboard. Remaining: real-device pass,
   bundle weight, transcript fidelity gaps listed in NOTES.md.
5. **Current.** Full omp model-picking parity. "Full" means: every model
   decision a user can make in the TUI (`/model`, `/switch`, alt+p, the
   `/models` hub, `/agents`) can be made from the phone, with the same
   persistence semantics and the same view of what is in effect. The
   checklist that defines done is the "Model parity" section below.
6. Horizon B: swarm navigation. Design starts only after 1-5 hold up in daily
   use.

## Model parity (what "full" means for item 5)

Source of truth for TUI behaviour: `packages/tui/src/overlays/model-hub.ts`
(fullscreen `/models`), `model-picker.ts` (alt+p session picker),
`model-browser.ts` (shared list), `coding-agent/src/slash-commands/
builtin-modes.ts` (`/model`, `/switch`), `coding-agent/src/config/
model-roles.ts`, `model-resolver.ts`, `settings.ts` (model-role getters,
`setModelRole`, storage mode, runtime overrides), `task/structured-subagent.ts`
(agent model precedence), `/agents` builtin (enable/disable, service tier).

Each line is a capability; the state column is what the webgui has today.

**Active session model**
- [x] Pick model + thinking level, session only (`/switch`, alt+p).
- [x] Pick model + thinking level and persist as `default` (`/model` picker).
- [ ] Cycle through `cycleOrder` roles (alt+p wheel; RPC `cycle_model` exists,
      no UI).
- [ ] Show why the active model is what it is: default role, `/switch`
      override, retry fallback in effect, context promotion.
- [ ] Model list parity with the browser: provider grouping, recently used
      first, role chips on rows (`● default`, hollow = auto-selected),
      measured TPS/TTFT columns, model kind tabs (chat/tiny/image/...).
- [ ] Locked providers listed dimmed; tapping starts the login flow
      (RPC `get_login_providers`/`login` exist).
- [ ] Provider live refresh (hub F5 → `modelRegistry.refresh`).

**Roles**
- [x] List every known role (built-in + custom) with configured selector,
      resolved model + thinking, and source (global/project/fallback/active/
      unset).
- [x] Assign a role persistently; clear back to fallback.
- [x] Eligibility filtering per role (`accepts`).
- [ ] Session-only role override (hub assigns without persist; settings
      `#updateRuntimeModelRoleOverride`). Needs `set_model_role { persist:
      false }` → `session.setModel(model, role)`.
- [ ] Storage scope per assignment: project vs global (hub "scope" strip,
      `modelRoleStorage`). Needs `set_model_role { storage }` and the badge to
      be tappable.
- [ ] Create a custom role ("+ New role…"); delete one.
- [ ] Edit `cycleOrder` (which roles alt+p cycles through, and their order).
- [ ] Model tags (`modelTags`) shown and editable.
- [ ] Role fallback chains (`retry.fallbackChains`): view and edit per role,
      per `provider/model-id`, per `provider/*`; per-entry thinking level and
      `@upstream` routing preserved.
- [ ] Show the auto-selection result for unconfigured roles
      (`resolveRoleAssignments` with `pi/<role>` candidates) rather than only
      "unset".

**Agents**
- [x] List discovered agents with source, declared model/thinking, override,
      effective patterns, resolved model.
- [x] Set/clear `task.agentModelOverrides[agent]` persistently.
- [ ] Enable/disable an agent (`task.disabledAgents`, `/agents`).
- [ ] Service tier override per agent (`task.agentServiceTierOverrides`).
- [ ] Show the full precedence chain for the effective model (request >
      override > frontmatter list > parent active > parent fallback) with
      which entry won.
- [ ] Default agent for `task` (`spawns` policy) shown; changeable if the TUI
      allows it.
- [ ] Advisor model per agent (`advisor: true | pattern`) and the `advisor`
      role relationship.
- [ ] Prewalk target (`prewalk`) shown.

**Cross-cutting**
- [x] Other clients see changes: `config_update {modelRoles|agents}` after
      every mutation; TUI picks up persisted values on its next
      `reloadFromDisk` (subagent spawn, `/move`, resume). No push into a
      running TUI's status line yet; document or add a settings-changed
      broadcast in the RPC serve controller.
- [ ] Same selector grammar everywhere: `provider/id`, fuzzy id, `@role`,
      `:level`, `@upstream` routing. Webgui builds `provider/id[:level]` only;
      it cannot yet store `@role` or fuzzy selectors from the picker.
- [ ] Warnings surfaced: resolver `warning` strings, "no API key" on pick,
      model not in catalog after discovery.
- [ ] Works while the session is streaming (picker must not block; the TUI
      allows switching mid-turn and the switch applies at the next request).
- [ ] Keyboard parity on desktop: type-to-search, arrows, Enter, Esc.

Not part of "full": anything the TUI itself cannot do (per-turn model
overrides, editing agent Markdown files, provider credentials beyond the
existing login flow). Those are new features, not parity, and go through
PLAN "Fixed decisions" first.

## Companion documents

- `NOTES.md`: working notes for the current item; rewritten as items change.
  Currently: run/test instructions, the design as built, and the open
  list for item 4.
- The completed task list (waves A-D, T1-T24) is in HISTORY.md; contracts
  A-H live above.
- `HISTORY.md`: dated, append-only record of what shipped, with file pointers.
- The abandoned prototype is preserved on branch `prototype/webgui-rpc-ui`
  (collab-web `src/server/`, `rpc-web-client.ts`, root `PLAN.md`). Reference
  only.
- `packages/coding-agent/CHANGELOG.md` and `packages/collab-web/CHANGELOG.md`
  are upstream's. Our changes are recorded in HISTORY.md, not there.
