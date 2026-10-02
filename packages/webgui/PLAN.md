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
  It owns its renderers, Markdown, transcript, and tool views; nothing is
  imported from `packages/collab-web`. Edits to `packages/coding-agent` are
  the minimum needed to serve RPC beside the TUI, localized so upstream
  syncs stay cheap.
- **Protocol v3 is built in omp, not the daemon.** A per-connection
  translator in the RPC server turns session events into v3 frames
  (history pages, deltas, branch changes). The daemon still copies bytes. v1, v2
  and `get_messages_page` do not change; webgui requires v3. Design:
  PIPELINE.md.
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
- G. Daemon binds `127.0.0.1:42049` (8081 until 2026-09-26). Env `HOST`, `PORT` override.
- H. Launch: `tmux new-window -t 0: -c <cwd> -P -F '#{window_id}' -- fish -C 'omp'`. Resume: `… fish -C 'omp --resume <id>'`. `omp` is the autoloaded function in `~/.config/fish/functions/omp.fish` (runs `bun <repo>/packages/coding-agent/src/cli.ts --allow-home`). The `-C` (init-command) flag runs the command and then drops into an interactive shell in the same window, so the tmux window survives when omp exits.
- I. `set_model_role { role, selector: string | null, persist?: boolean, storage?: "global" | "project" }`. `persist` defaults true; `false` applies a runtime-only value (`session.setModel(..., {persist:false})` for `default`, `Settings.override("modelRoles")` for others) and never touches disk. `storage` defaults to `modelRoleStorage`; `"project"` when `modelRoleStorage` is `global` is an error. Default-role writes follow the TUI hub's shadowing rules (`selector-controller.ts` `onAssign`). Raw selector stored verbatim (`@role`, fuzzy, `:level`, `@upstream` preserved). Role ids: known or `/^[a-zA-Z][\w-]*$/`.
- J. `get_model_roles` carries, per role, `provenance` (`runtime|overlay|project|global|default`), `custom`, `autoSelected` (auto-selection result for unconfigured roles, via `resolveRoleAssignments`), `tag`; and on the result `cycleOrder` and `modelTags`. Mutations `delete_model_role {role}` (custom only; clears both scopes and removes from `cycleOrder`), `set_cycle_order {order}` (known roles, no duplicates), `set_model_tag {model, tag|null}` return the full roles result and emit `config_update {modelRoles:true}`.
- K. `cycle_role_model {direction?}` cycles `cycleOrder` roles through `session.cycleRoleModels`; returns `{ role, model, cycle: { roles, currentIndex } } | null`. Session-only, like alt+p.
- L. `get_model_browser` returns `{ models, mruOrder, providers, kinds }`: model rows for every authenticated provider plus any locked model a role or the MRU list references (the full `getAll("all")` catalog exceeds the 1 MiB RPC frame cap), each with `locked`, `perf {samples,tps,ttftMs}`, `roles [{role, auto}]`, `tag`, `kind`; every provider (including locked ones) appears in `providers` with auth, discovery status, and `modelCount`. `refresh_models {provider?}` awaits `modelRegistry.refresh("online")` / `refreshProvider`, emits `config_update {models:true}`, returns the browser result. Data sourced through `createModelBrowserSource(settings)` and `@oh-my-pi/pi-tui/overlays/model-browser` read-only; nothing moves out of `packages/tui`.
- M. `RpcSessionState.modelSource?: { kind: "role" | "temporary" | "ephemeral" | "fallback", role?, fallbackFrom? }`. `role` = latest model-change session entry's role (`default` for the default role); `temporary`/`ephemeral` = `/switch`-style session change; `fallback` = retry fallback chain serving in place of `fallbackFrom` (`session.servingModel`). Context promotion has no public state and is not reported.
- N. `get_agents` carries, per agent, `serviceTier`, `prewalk {effective?, source: override|frontmatter|default|none}`, `advisor {effective?, source: override|frontmatter|none}`, `isDefaultTaskAgent`, `precedence { entries [{source, selector}], winner }` (override > frontmatter > parentActive > parentFallback > defaultRole). Mutations `set_agent_enabled {agent, enabled}` (`task.disabledAgents`), `set_agent_service_tier {agent, tier|null}` (`task.agentServiceTierOverrides`, validated by `config/service-tier.ts`), `set_agent_prewalk {agent, value|null}` (`task.agentPrewalk`), `set_agent_advisor {agent, value|null}` (`task.agentAdvisor`) return the updated agent and emit `config_update {agents:true}`.
- O. Provider login over the socket, off the serial command queue (dispatched like `bash`). `get_login_status` → per OAuth provider `{ id, name, available, storeCredentialsAs?, authenticated, source?, accounts [{ credentialId, label }] }`. `login_start { providerId }` → `{ loginId }` immediately; one active login per connection; the flow's callbacks become `login_event { loginId, providerId, event }` frames with `event.kind` ∈ `auth { url, instructions? }` (full URL, never the host-loopback `launchUrl`), `progress { message }`, `prompt { requestId, message, placeholder?, secret?, allowEmpty? }`, `manual_input { requestId }` (pasted redirect URL or code; always offered, since a phone cannot reach the host's loopback callback), `done { providerId, identity? }`, `failed { error, cancelled }`. `login_input { loginId, requestId, value }` answers a prompt; `login_cancel { loginId }` aborts; socket close aborts. `done` follows `refreshProvider(storeCredentialsAs ?? id, "online")` and `config_update { models: true }`. `logout { providerId, credentialId }` removes one stored credential, refreshes the provider online, emits `config_update { models: true }`, returns `{ providerId, remainingSource? }`. Upstream `get_login_providers` / `login` are left untouched and unused.
- `config_update { modelRoles?, agents? }` goes to every connection of the omp process whenever a matching setting changes, from the TUI or any connection (`rpc-config-feed.ts`, one frame per burst). `models`/`model` frames still go to the issuing connection only.


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

**2026-09-23 (model parity, W0-W3 landed; review pending).** Contracts
I..N implemented: role scope/session-only/create/delete, `cycleOrder`,
`modelTags`, `get_model_browser` + `refresh_models`, `cycle_role_model`,
`modelSource` explanation, agent enable/tier/prewalk/advisor/precedence.
Webgui Models hub rebuilt as Active / Roles / Agents / Providers with one
picker sheet (recent-first, role chips, TPS/TTFT, kind tabs, keyboard).
E2E-verified over the socket against a fresh omp; rendered once in
headless Chromium at 390px. Human review (phone, desktop inspector,
mid-stream switch) is deferred to the next instance; unticked boxes below
are exactly those. Fallback-chain editor, cross-client push, and
selector preview are deferred as separate features (TASK.md Deferred).

**2026-09-23 (login, D1).** Contract O: `login_start` / `login_event` /
`login_input` / `login_cancel` / `logout` / `get_login_status` in
`modes/rpc/rpc-login.ts`, dispatched off the serial queue. Webgui:
`LoginSheet` opened from locked provider and model rows, paste-back of the
dead redirect page's address for loopback providers, per-account Log out
with confirm. Verified over the socket against a fresh omp (prompt, auth,
manual_input, cancel, duplicate refused, `get_state` answered mid-login);
then logout and re-login of anthropic from the browser client. D1 done.

**2026-09-24 (protocol v3, design).** One data path for history and
streaming: the browser's log is the saved session entries of the current
branch; `history` pages newest-first; text deltas instead of full-message
resends; one `branch` frame when the branch changes (compaction, switch,
dropped failed turn). Written into PIPELINE.md. Design implemented and
verified.

## What comes next, in order of user value

1. Done. omp serves RPC over a Unix socket beside the TUI, with discovery
   metadata. Verified by attaching a second client to a live tmux session.
2. Done. Daemon in `packages/webgui`: registry walk, one-WebSocket-per-
   session relay, static SPA. Browser attaches to any live session.
3. Done. Session list: live vs past. New session with cwd choice, resume
   past, shutdown. All via tmux window 0 on the host.
4. **Workable.** UI/UX across surfaces: phone-first, usable at
   any width with touch or mouse+keyboard. Remaining: real-device pass,
   bundle weight, transcript fidelity gaps listed in NOTES.md. Protocol v3
   (PIPELINE.md) addresses the slow reopen, per-token full resends, and
   stale transcript after compaction or branch switch.
5. Done. Full omp model-picking parity. "Full" means: every model
   decision a user can make in the TUI (`/model`, `/switch`, alt+p, the
   `/models` hub, `/agents`) can be made from the phone, with the same
   persistence semantics and the same view of what is in effect. The
   checklist that defines done is the "Model parity" section below.
6. TUI/GUI feature parity: 80% of the Core tier in parity.md at Done,
   beyond model picking. Met: 82.9% on 2026-10-02 (Core defined in
   parity.md "Core tier"; the 2026-09-27 figure of 80.6% had no written
   definition).
7. Horizon B: swarm navigation.
8. Shell mode: omp as a plain shell command (`git diff | @ review this`),
   attached to a running session picked per terminal window. Idea taken
   from Giverny's shell mode.

## Shared UX package (idea)

A browser-safe package (`packages/ux`, no node or native imports) for UX
logic every client needs: TUI, web GUI, and later shell mode. First
candidates: magic-word rows and prose matcher (now copied in
`src/lib/magic-words.ts` from `coding-agent/src/modes/magic-keywords.ts`),
`splitReaction`, `FENCE_RE`. Open question: moving code out of upstream
files adds rebase conflicts on every omp-update; one-line re-exports keep
them small but break the no-shims rule. The web GUI also cannot see which
keywords are enabled (settings, `task`/`eval` tools), so it highlights all
of them until the host sends the active set.

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
- [x] Cycle through `cycleOrder` roles (RPC `cycle_role_model`, Prev/Next
      in the Active section).
- [x] Show why the active model is what it is (`modelSource`: role,
      `/switch` override, retry fallback). Context promotion has no public
      state; not shown.
- [x] Model list parity with the browser: provider grouping, recently used
      first, role chips on rows (filled = configured, hollow = auto),
      measured TPS/TTFT columns, model kind tabs.
- [x] Locked providers listed dimmed and tappable: opens the login sheet
      (contract O). Paste-back completes loopback flows from the phone.
- [x] Provider live refresh (`refresh_models {provider?}`; per-provider and
      Refresh-all buttons in the Providers section and picker header).

**Roles**
- [x] List every known role (built-in + custom) with configured selector,
      resolved model + thinking, and source (global/project/fallback/active/
      unset).
- [x] Assign a role persistently; clear back to fallback.
- [x] Eligibility filtering per role (`accepts`).
- [x] Session-only role override (`set_model_role { persist: false }`;
      "This session" in the picker; provenance badge "session only").
- [x] Storage scope per assignment: project vs global (`set_model_role
      { storage }`; Project/Global toggle in the picker; tappable scope badge
      when `modelRoleStorage` is project).
- [x] Create a custom role ("+ New role"); delete one (`delete_model_role`).
- [x] Edit `cycleOrder` (checklist plus up/down).
- [x] Model tags (`modelTags`) shown and editable (`set_model_tag`).
- Role fallback chains: dropped. The TUI has no editor either; users
  edit YAML.
- [x] Show the auto-selection result for unconfigured roles
      (`autoSelected`, "auto" badge).

**Agents**
- [x] List discovered agents with source, declared model/thinking, override,
      effective patterns, resolved model.
- [x] Set/clear `task.agentModelOverrides[agent]` persistently.
- [x] Enable/disable an agent (`set_agent_enabled`).
- [x] Service tier override per agent (`set_agent_service_tier`).
- [x] Show the full precedence chain for the effective model with the winner
      marked (`precedence`).
- [x] Default agent for `task` shown (`isDefaultTaskAgent` badge). Not
      changeable: the TUI cannot change it either.
- [x] Advisor per agent shown with source; set/clear (`set_agent_advisor`).
- [x] Prewalk target shown with source; set/clear (`set_agent_prewalk`).

**Cross-cutting**
- [x] Other clients see changes: `config_update {modelRoles|agents}` after
      every mutation; TUI picks up persisted values on its next
      `reloadFromDisk` (subagent spawn, `/move`, resume). Every tab of
      the process gets `config_update` for any change (D3).
- [x] Same selector grammar everywhere: `set_model_role` stores the raw
      selector verbatim. The picker still only builds `provider/id[:level]`;
      a free-text selector input is an idea (see Ideas).
- [x] Warnings surfaced: resolver `warning` as info toast, "No API key for
      <provider>" on a locked pick, inline `warning` on role rows.
- [x] Works while the session is streaming: controls stay enabled,
      "applies at next request" hint shown, mid-stream changes apply
      at next turn.
- [x] Keyboard parity on desktop: type-to-search, arrows, Enter, Esc, focus
      trap. Verified headless; desktop review pending.

Not part of "full": anything the TUI itself cannot do (per-turn model
overrides, editing agent Markdown files, provider credentials beyond the
existing login flow). Those are new features, not parity, and go through
PLAN "Fixed decisions" first.

## Ideas

Not planned. Kept so the reasoning is not redone.

- Type a model shorthand (`opus`, `@smol`, `sonnet:high`) and see which
  exact model it becomes before saving. omp already accepts shorthand
  (`/model opus`, config); only the preview is missing. Low value on a
  phone, where tapping from the list covers it. Would need
  `resolve_selector { selector, role? }`.

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
