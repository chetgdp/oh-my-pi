# Item 5: full omp model-config parity in the GUI

Task list. Definition of done is PLAN.md "Model parity"; tick boxes there
when a capability lands. This file tracks the work that gets there, in
dependency order. Facts cited by file:line were gathered 2026-09-22 and
may drift.

## W0. Design decisions (before code)

- [ ] 1. RPC shape: per-capability commands (typed, validated server-side
      like `set_model_role`), not a generic settings write over the socket.
- [ ] 2. Define `get_model_config`: one frame carrying everything the hub
      shows (roles with provenance and auto-selection, cycleOrder,
      modelTags, fallbackChains, storage mode, provider auth/discovery
      status, MRU, perf) instead of N round-trips.
- [ ] 3. Define the active-model explanation shape:
      `{ source: "default-role" | "scoped-switch" | "retry-fallback" |
      "context-promotion", role?, fallbackFrom? }` and locate where
      AgentSession exposes that state (`session/model-controls.ts`,
      `session/turn-recovery.ts`). Verify what is readable today.
- [ ] 4. Record new contracts in PLAN.md as letters I..N.
- [ ] Open: `login` over RPC in scope now (needs device-code UI) or deferred.
- [ ] Open: TPS/TTFT columns and modelTags in or out.

## W1. coding-agent RPC

Files: `src/modes/rpc/rpc-types.ts`, `rpc-server.ts`, `rpc-model-config.ts`,
tests in `test/rpc-model-config.test.ts`.

- [ ] 5. `set_model_role { role, selector, persist?, storage? }`.
      `persist:false` -> `session.setModel(model, role)` runtime override.
      `storage: "global" | "project"` -> `Settings.setModelRole` with
      scope, mirroring `ModelHubCallbacks.onAssign(..., scope)`
      (`packages/tui/src/overlays/model-hub.ts:114-131`).
- [ ] 6. `get_model_roles` additions: `provenance`
      (`settings.getModelRoleProvenance`, `config/settings.ts:1373-1381`),
      `autoSelected` model for unset roles (move `resolveRoleAssignments`
      logic from `model-browser.ts:154-205` into coding-agent so TUI and
      RPC share it), `storageMode`.
- [ ] 7. `delete_model_role { role }` for custom roles only (refuse ids in
      `MODEL_ROLES`). Create = `set_model_role` with a new id (already
      accepted, `rpc-server.ts:1410-1414`); add id grammar validation.
- [ ] 8. `set_cycle_order { order: string[] }` -> `cycleOrder`
      (`config/settings-schema.ts:519-522`).
- [ ] 9. `set_model_tag { model, tag | null }` -> `modelTags`
      (`settings-schema.ts:517`).
- [ ] 10. `get_fallback_chains` / `set_fallback_chain { key, chain }` ->
      `retry.fallbackChains` (`settings-schema.ts:1823-1827`). Validate
      with `validateRetryFallbackChains`
      (`session/retry-fallback-chains.ts:194-228`), return warnings,
      trigger the session's chain revalidation.
- [ ] 11. Model browser data: extend `get_available_models` or add
      `get_model_browser` with MRU order, per-model perf
      `{samples, tps, ttftMs}`, kind, role chips, provider auth state and
      discovery status (`ModelHubRegistry`, `model-hub.ts:94-108`). Locate
      where the TUI sources `mruOrder` and `modelPerf`; expose from
      AgentSession.
- [ ] 12. `refresh_models { provider? }` -> `modelRegistry.refresh("online")`
      / `refreshProvider` (`config/model-registry.ts:214-222`); emit
      `config_update { models: true }` on completion.
- [ ] 13. Verify `login` over a Unix socket: device-code flow must return
      URL/code as data, not open a TUI dialog. Add a `login_progress`
      frame if needed.
- [ ] 14. Active-model explanation in `RpcSessionState` (per W0.3),
      including live `/switch` scoped override and retry fallback in
      effect.
- [ ] 15. `get_agents` additions: `disabled`, `serviceTier`, `prewalk`
      (effective + source), `advisor` (effective + source),
      `isDefaultTaskAgent` (`task/spawn-policy.ts:19-55`), model
      precedence chain with the winner marked (resolvers imported at
      `task/executor.ts:19-23`).
- [ ] 16. Agent mutations: `set_agent_enabled { agent, enabled }`
      (`task.disabledAgents`, reuse `modes/agents-hub-deps.ts:107-112`),
      `set_agent_service_tier { agent, tier | null }`,
      `set_agent_prewalk { agent, pattern | null }`,
      `set_agent_advisor { agent, value | null }`. Each emits
      `config_update { agents: true }`.
- [ ] 17. `config_update` on TUI-side mutations too (hub callbacks), so the
      browser follows terminal edits. Check whether the RPC serve
      controller can subscribe to Settings changes; otherwise hook the
      hub callbacks.
- [ ] 18. `resolve_selector { selector, role? }` ->
      `{ model, thinkingLevel, upstream?, warning? }` so the GUI validates
      `@role`, fuzzy, `:level`, `@upstream` before submit
      (`parseModelPattern`, `config/model-resolver.ts`).
- [ ] 19. Tests: one contract test per new command (validation failure,
      success shape, `config_update` emission). `persist:false` must not
      touch disk; `storage:"project"` must write project config.

## W2. webgui data layer

Files: `src/lib/session-actions.ts`, `session-store.ts`, `rpc-client.ts`,
tests.

- [ ] 20. Action wrappers for every W1 command.
- [ ] 21. Store `modelConfig` slice (roles, cycleOrder, tags, chains,
      providers, browser data); refetch on `config_update` flags;
      optimistic updates for toggles; `explanation` from session state.
- [ ] 22. Selector input model: free-text selector beside the picker;
      call `resolve_selector` on debounce, show resolved model and warning.

## W3. webgui UI

Files: `src/components/models/*`, `src/App.tsx`, `src/lib/route.ts`, CSS.

- [ ] 23. Models hub restructure: sections Active / Roles / Agents /
      Providers / Fallbacks. Full-page under 1100px; inspector column at
      >= 1100px.
- [ ] 24. Active: cycle button through `cycleOrder`; explanation line
      ("default role -> provider/id", "/switch override", "fallback from
      X", "promoted for context"); usable while streaming.
- [ ] 25. Browser sheet parity: provider grouping, recent-first section,
      role chips (filled = configured, hollow = auto), TPS/TTFT columns,
      kind tabs, locked providers dimmed and tappable to start login
      (show URL/code), refresh per provider and global.
- [ ] 26. Roles: tappable scope badge (global/project), "This session only"
      toggle in the picker, "+ New role" with id input, delete for custom
      roles, auto-selected model shown for unset roles, tag editor.
- [ ] 27. cycleOrder editor: checklist plus up/down reorder (no drag on iOS).
- [ ] 28. Fallback chain editor per role and per `provider/model` /
      `provider/*` key: ordered list, per-entry `:level` and `@upstream`
      preserved, warnings inline.
- [ ] 29. Agents: enable toggle, service-tier picker, prewalk/advisor with
      source shown, precedence chain expander with winner marked,
      default-task-agent badge.
- [ ] 30. Warnings: toast plus inline text for resolver warnings, "no API
      key" on pick, model missing from catalog after discovery.
- [ ] 31. Desktop keyboard: type-to-search in the browser sheet, arrows,
      Enter, Esc; focus trap in sheets.
- [ ] 32. Component tests: browser sheet grouping/chips/filters, role scope
      badge and session-only flow, cycleOrder ordering, fallback editor
      round-trip, agent toggles, explanation rendering per source.

## W4. Verification and docs

- [ ] 33. E2E against a launched omp: each mutation round-trips to
      `config.yml` / project config and back via `config_update`; TUI
      reflects it on next `reloadFromDisk`; a TUI hub edit appears in the
      browser.
- [ ] 34. Mid-stream: change model during a streaming turn; confirm it
      applies at the next request.
- [ ] 35. Real iPhone pass on the new sheets (keyboard, 44px targets).
- [ ] 36. PLAN.md checklist ticks and contracts I..N; NOTES.md rewrite;
      HISTORY.md entry.
