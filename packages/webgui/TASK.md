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

Each of these adds a capability the TUI does not have today. They stay out
of item 5 so "full parity" has a fixed finish line.

- [ ] D1. `login` over a Unix socket: device-code flow must return
      URL/code as data, not open a TUI dialog; `login_progress` frame;
      tappable locked providers in the browser sheet.
- [ ] D2. `get_fallback_chains` / `set_fallback_chain { key, chain }` ->
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
- [ ] D4. `resolve_selector { selector, role? }` ->
      `{ model, thinkingLevel, upstream?, warning? }` plus a free-text
      selector input with debounced preview. The TUI resolves on apply,
      never pre-validates.
