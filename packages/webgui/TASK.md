# D1: provider login from the phone

Task list, dependency order. Facts cited by file:line gathered 2026-09-23.
Definition of done: a locked provider in the Models hub can be logged into
from the phone, the picker unlocks its models, and the TUI sees the
credential; the flow can be cancelled; nothing about it blocks the rest of
the session UI while it runs.

## Facts that shape the design

- Upstream already has `get_login_providers` and `login {providerId}`
  (`modes/rpc/rpc-server.ts:1649-1713`). Not usable as is:
  1. It runs on the per-connection serial command queue
     (`rpc-server.ts:492-522`; only `bash` is backgrounded), so a pending
     login blocks every other command on the socket for up to 10 min.
  2. No cancel: no `signal` is passed to `oauth.login`.
  3. Progress/URL/prompts go out as `extension_ui_request` frames
     (`open_url`, `notify`, `input`) that the webgui ignores and PLAN
     "Fixed decisions" says not to carry.
  4. `secret` prompts and pre-URL prompts are rejected.
  5. No `onManualCodeInput`, so a loopback-callback provider can only
     complete if the browser that opened the URL can reach
     `localhost:<port>` on the host. From the phone it never can.
- Loopback-callback providers (`OAuthCallbackFlow`,
  `packages/ai/src/registry/oauth/callback-server.ts`) race the HTTP
  callback against `onManualCodeInput` when the controller supplies it
  (`callback-server.ts:630-647`), for any provider. `parseCallbackInput`
  accepts the full redirect URL, `code=...`, or a bare code. On the phone
  the redirect lands on an unreachable `localhost` page whose address bar
  still carries `?code=&state=`; copy-paste of that address is the
  completion path. Device-code providers (GitHub Copilot, `openai-codex-device`)
  complete without paste.
- `launchUrl` is a loopback shortcut on the host; the phone must use the
  full `url` (`oauth-terminal.ts:163-175`).
- TUI reference: `selector-controller.ts:2083-2171` (`#handleOAuthLogin`:
  `signal`, `onAuth`, `onPrompt`, `onProgress`, `onManualCodeInput`, then
  `refreshProvider(id, "online")`), `:2173-2210` (`#handleCredentialLogout`
  via `authStorage.credentials.removeById`).
- Extension-contributed OAuth providers are already in `getOAuthProviders()`
  for the live session.

## W0. Design decisions

- [x] 1. Do not reuse upstream `login`. Leave it untouched (upstream diff
      stays minimal) and add our own commands in a new
      `modes/rpc/rpc-login.ts`, handled off the serial queue like `bash`.
- [x] 2. Contract O (types in `rpc-types.ts`; PLAN.md entry pending W4):
      - `login_start { providerId }` -> `{ loginId }`; immediately.
        One active login per connection; a second `login_start` is an
        error. Unknown/unavailable provider is an error.
      - `login_event { loginId, event }` frames, `event` one of
        `{ kind: "auth", url, instructions? }` (never `launchUrl`),
        `{ kind: "progress", message }`,
        `{ kind: "prompt", requestId, message, placeholder?, secret?, allowEmpty? }`,
        `{ kind: "manual_input", requestId }` (paste the redirect URL or code),
        `{ kind: "done", providerId, identity? }` (`formatLoginIdentity` label),
        `{ kind: "failed", error, cancelled }`.
      - `login_input { loginId, requestId, value }` -> `{}`; answers a
        `prompt` or `manual_input`. Unknown ids are errors.
      - `login_cancel { loginId }` -> `{}`; aborts the flow's signal.
        Socket close aborts too.
      - On `done`: `refreshProvider(storeCredentialsAs ?? id, "online")`,
        then `config_update { models: true }` on the connection.
      - `get_login_status` (new; upstream `get_login_providers` untouched)
        returns per provider `authenticated`, `source`, `storeCredentialsAs`,
        and `accounts [{ credentialId, label }]` for stored credentials.
      - `logout { providerId, credentialId }` -> `{ remainingSource? }`;
        refreshes the provider online, emits `config_update { models: true }`.
- [x] 3. Secret prompts are allowed (the socket is bearer-gated and the
      phone reaches it over Tailscale TLS); the browser masks the field.
      Prompt values and pasted codes are never logged.
- [x] 4. Cross-connection visibility is D3's problem; the TUI sees the
      credential on its next auth-storage read (same `agent.db`).

## W1. coding-agent RPC

Files: `src/modes/rpc/rpc-types.ts`, `rpc-server.ts` (dispatch only),
`rpc-login.ts` (new), tests `test/rpc-login.test.ts`.

- [x] 5. Types for contract O commands, responses, and the `login_event`
      frame; include it in `RpcSessionEventFrame`.
- [x] 6. `LoginSessionController` per connection: `AbortController`,
      pending prompt map keyed by `requestId`, `loginId` from `Snowflake`.
      `oauth.login(provider, { signal, onAuth, onProgress, onPrompt,
      onManualCodeInput })`; every callback becomes one `login_event`.
      `onManualCodeInput` always supplied (loopback providers race it
      against the callback). Abort on `login_cancel` and on connection
      close (hook the same teardown that clears `pendingExtensionRequests`).
- [x] 7. Dispatch: `login_start`, `login_input`, `login_cancel` join `bash`
      in the background path (`rpc-server.ts:492-495`) so the serial queue
      keeps flowing.
- [x] 8. `done` path: provider-scoped online refresh, `config_update
      { models: true }`, event carries `identity` label.
- [x] 9. `get_login_status` (not `get_login_providers`) and `logout` per contract O,
      reusing `authStorage.credentials.removeById` and
      `authStorage.keys.describe` (`selector-controller.ts:2176-2200`).
- [x] 10. Tests with a fake OAuth provider registered for the test:
      start returns before the flow completes; `auth`/`progress` events
      arrive; `manual_input` answered with a redirect URL completes and
      emits `done` + `config_update`; `login_cancel` yields `failed
      { cancelled: true }` and no credential; second `login_start` while
      active is an error; `login_input` with unknown ids is an error;
      a `get_state` sent mid-login is answered before the login finishes;
      `logout` removes the credential and reports `remainingSource`.

## W2. webgui data layer

Files: `src/lib/session-actions.ts`, `session-store.ts`, tests.

- [x] 11. Actions: `getLoginStatus`, `loginStart`, `loginInput`,
      `loginCancel`, `logout`.
- [x] 12. Store `login` slice: `{ loginId, providerId, url?, instructions?,
      progress: string[], pending?: { requestId, kind: "prompt" |
      "manual_input", message?, secret? }, result?: done | failed }`,
      driven by `login_event`; cleared on `done`/`failed` after the sheet
      closes. `applyBrowser` on the post-login `config_update { models }`
      already refetches; verify the locked flag flips.
- [x] 13. Reconnect: a `login_start` outlives the socket only on the host
      side; on reconnect the store marks any in-flight login `failed
      { cancelled: true }` (the host aborted it on close).

## W3. webgui UI

Files: `src/components/models/LoginSheet.tsx` (new), `ProvidersSection.tsx`,
`ModelPickerSheet.tsx`, `useModelsHub.tsx`, `contract.ts`, CSS.

- [x] 14. Tappable locked provider rows (Providers section) and locked model
      rows (picker) open `LoginSheet` for that provider; replaces the
      "No API key" toast on a locked pick.
- [x] 15. `LoginSheet`: provider name; "Open sign-in page" (`target=_blank`,
      `rel=noopener`) and a Copy-URL button; instructions; progress list;
      when `manual_input` is pending, a paste field with the hint "After
      signing in, the browser shows a page that cannot load. Copy its
      address and paste it here"; when `prompt` is pending, a text field
      (masked when `secret`); Cancel; done/failed state with identity or
      error. 44px targets, focus trap, Esc cancels.
- [x] 16. Providers section: per-provider accounts with Log out; confirm
      step before `logout`.
- [x] 17. Toasts: `done` -> "Logged in to X as Y"; `failed` -> error unless
      cancelled.
- [x] 18. Component tests: sheet renders each event kind, paste submits
      `login_input` with the right `requestId`, Cancel sends `login_cancel`,
      locked row opens the sheet, logout confirm flow.

## W4. Verification and docs

- [x] 19. E2E on a fresh omp via `/api/launch` (2026-09-23). Over the
      socket: `get_login_status` lists providers with sources and
      accounts; `login_start` for `github-copilot` returned immediately,
      emitted a pre-URL `prompt` (upstream `login` rejects these), an
      unknown `requestId` was refused, the answered prompt led to `auth`
      (device code in `instructions`); a second `login_start` was refused;
      `login_cancel` produced `failed { cancelled: true }`. `login_start`
      for `anthropic` emitted `auth` (no `launchUrl`) -> `progress` ->
      `manual_input`. From the browser: logged out of anthropic
      (credential #6 removed) and logged back in (#7 stored); the
      provider re-sorted into the locked group and back.
- [x] 20. `get_state` sent while the login waited on a prompt was answered
      before the login finished; the hub stayed usable during the
      browser-driven login.
- [x] 21. Real-device pass: login and logout done from the phone client.
- [x] 22. PLAN.md: contract O, tick the "Locked providers" line, move D1
      out of Deferred; NOTES.md; HISTORY.md entry.

## Out of scope

- Daemon-hosted OAuth redirect (would need provider-registered redirect
  URIs; the loopback ports are baked into the flows).
- `onBrowserSession` cookie-capture providers: cannot run without a
  host-owned browser; report as unsupported in `failed`.
- Auth-broker (`omp auth-broker login --via`) integration.

# Item 5: full omp model-config parity in the GUI

Task list. Definition of done is PLAN.md "Model parity"; tick boxes there
when a capability lands. This file tracks the work that gets there, in
dependency order. Facts cited by file:line were gathered 2026-09-22 and
may drift.

## W0. Design decisions (before code)

- [x] 1. RPC shape: per-capability commands (typed, validated server-side
      like `set_model_role`), not a generic settings write over the socket.
- [x] 2. Decided against one `get_model_config` frame: keep
      `get_model_roles` / `get_agents` and add fields (contracts J, N);
      add `get_model_browser` for catalog data (contract L). Three fetches
      on attach, each refetched independently on its `config_update` flag.
- [x] 3. Explanation shape is contract M: `{ kind: role | temporary |
      ephemeral | fallback, role?, fallbackFrom? }`. Context promotion has
      no public session state and is dropped from the explanation.
- [x] 4. Contracts I..N recorded in PLAN.md.
- [x] Open: `login` over RPC deferred (see Deferred). Locked providers are
      shown dimmed only.
- [x] Open: TPS/TTFT columns and modelTags in (data already in settings).

## W1. coding-agent RPC

Files: `src/modes/rpc/rpc-types.ts`, `rpc-server.ts`, `rpc-model-config.ts`,
tests in `test/rpc-model-config.test.ts`.

- [x] 5. `set_model_role { role, selector, persist?, storage? }`.
      `persist:false` -> `session.setModel(model, role)` runtime override.
      `storage: "global" | "project"` -> `Settings.setModelRole` with
      scope, mirroring `ModelHubCallbacks.onAssign(..., scope)`
      (`packages/tui/src/overlays/model-hub.ts:114-131`).
- [x] 6. `get_model_roles` additions: `provenance`
      (`settings.getModelRoleProvenance`, `config/settings.ts:1373-1381`),
      `autoSelected` model for unset roles (move `resolveRoleAssignments`
      logic from `model-browser.ts:154-205` into coding-agent so TUI and
      RPC share it), `storageMode`.
- [x] 7. `delete_model_role { role }` for custom roles only (refuse ids in
      `MODEL_ROLES`). Create = `set_model_role` with a new id (already
      accepted, `rpc-server.ts:1410-1414`); add id grammar validation.
- [x] 8. `set_cycle_order { order: string[] }` -> `cycleOrder`
      (`config/settings-schema.ts:519-522`).
- [x] 9. `set_model_tag { model, tag | null }` -> `modelTags`
      (`settings-schema.ts:517`).
- [x] 11. Model browser data: extend `get_available_models` or add
      `get_model_browser` with MRU order, per-model perf
      `{samples, tps, ttftMs}`, kind, role chips, provider auth state and
      discovery status (`ModelHubRegistry`, `model-hub.ts:94-108`). Locate
      where the TUI sources `mruOrder` and `modelPerf`; expose from
      AgentSession.
- [x] 12. `refresh_models { provider? }` -> `modelRegistry.refresh("online")`
      / `refreshProvider` (`config/model-registry.ts:214-222`); emit
      `config_update { models: true }` on completion.
- [x] 14. Active-model explanation in `RpcSessionState` (per W0.3),
      including live `/switch` scoped override and retry fallback in
      effect.
- [x] 15. `get_agents` additions: `disabled`, `serviceTier`, `prewalk`
      (effective + source), `advisor` (effective + source),
      `isDefaultTaskAgent` (`task/spawn-policy.ts:19-55`), model
      precedence chain with the winner marked (resolvers imported at
      `task/executor.ts:19-23`).
- [x] 16. Agent mutations: `set_agent_enabled { agent, enabled }`
      (`task.disabledAgents`, reuse `modes/agents-hub-deps.ts:107-112`),
      `set_agent_service_tier { agent, tier | null }`,
      `set_agent_prewalk { agent, pattern | null }`,
      `set_agent_advisor { agent, value | null }`. Each emits
      `config_update { agents: true }`.
- [x] 19. Tests: one contract test per new command (validation failure,
      success shape, `config_update` emission). `persist:false` must not
      touch disk; `storage:"project"` must write project config.

## W2. webgui data layer

Files: `src/lib/session-actions.ts`, `session-store.ts`, `rpc-client.ts`,
tests.

- [x] 20. Action wrappers for every W1 command.
- [x] 21. Store `modelConfig` slice (roles, cycleOrder, tags, providers,
      browser data); refetch on `config_update` flags; optimistic updates
      for toggles; `explanation` from session state.

## W3. webgui UI

Files: `src/components/models/*`, `src/App.tsx`, `src/lib/route.ts`, CSS.

- [x] 23. Models hub restructure: sections Active / Roles / Agents /
      Providers / Fallbacks. Full-page under 1100px; inspector column at
      >= 1100px.
- [x] 24. Active: cycle button through `cycleOrder`; explanation line
      ("default role -> provider/id", "/switch override", "fallback from
      X", "promoted for context"); usable while streaming.
- [x] 25. Browser sheet parity: provider grouping, recent-first section,
      role chips (filled = configured, hollow = auto), TPS/TTFT columns,
      kind tabs, locked providers dimmed, refresh per provider and global.
- [x] 26. Roles: tappable scope badge (global/project), "This session only"
      toggle in the picker, "+ New role" with id input, delete for custom
      roles, auto-selected model shown for unset roles, tag editor.
- [x] 27. cycleOrder editor: checklist plus up/down reorder (no drag on iOS).
- [x] 29. Agents: enable toggle, service-tier picker, prewalk/advisor with
      source shown, precedence chain expander with winner marked,
      default-task-agent badge.
- [x] 30. Warnings: toast plus inline text for resolver warnings, "no API
      key" on pick, model missing from catalog after discovery.
- [x] 31. Desktop keyboard: type-to-search in the browser sheet, arrows,
      Enter, Esc; focus trap in sheets.
- [x] 32. Component tests: browser sheet grouping/chips/filters, role scope
      badge and session-only flow, cycleOrder ordering, agent toggles,
      explanation rendering per source.

## W4. Verification and docs

- [x] 33. E2E against a launched omp: each mutation round-trips to
      `config.yml` / project config and back via `config_update`; TUI
      reflects it on next `reloadFromDisk`.
- [x] 34. Mid-stream: change model during a streaming turn; confirm it
      applies at the next request.
- [x] 35. Real iPhone pass on the new sheets (keyboard, 44px targets).
- [x] 36. PLAN.md checklist ticks and contracts I..N; NOTES.md rewrite;
      HISTORY.md entry.

## Deferred (not parity; separate features, PLAN "Fixed decisions" first)

The target is TUI/GUI parity. Capabilities the TUI lacks (D2, D4) are not
planned; they stay listed only so the reasoning is not redone.

- [x] D1. Login over the socket: done as contract O (section "D1" at the
      top of this file); verified live including logout and re-login.
- [-] D2 (not planned). `get_fallback_chains` / `set_fallback_chain { key, chain }` ->
      `retry.fallbackChains` (`settings-schema.ts:1823-1827`). Validate
      with `validateRetryFallbackChains`
      (`session/retry-fallback-chains.ts:194-228`), return warnings,
      trigger the session's chain revalidation. Plus the editor per role
      and per `provider/model` / `provider/*` key: ordered list, per-entry
      `:level` and `@upstream` preserved, warnings inline. The TUI has no
      editor for this; users edit YAML.
- [ ] D3. `config_update` on TUI-side mutations (hub callbacks), so the
      browser follows terminal edits. No omp client receives pushed
      settings changes today; needs either a Settings change feed or hooks
      in the hub callbacks. Until then the browser refreshes on reattach
      and its own mutations.
- [-] D4 (not planned). `resolve_selector { selector, role? }` ->
      `{ model, thinkingLevel, upstream?, warning? }` plus a free-text
      selector input with debounced preview. The TUI resolves on apply,
      never pre-validates.
