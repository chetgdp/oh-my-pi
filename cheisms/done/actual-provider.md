# Actual providers (`actual-local`, `actual-relay`)

Status: implemented (verified against code 2026-10-20).

Fork-only note. Point an agent at this file when an `omp-update` rebase
conflicts in one of the files below, or Actual models disappear after one.

## What it is

Actual (actual.inc) is a local LLM runner with an optional public relay.

- `actual-local`: keyless, implicit discovery like `lm-studio`. Base URL:
  `ACTUAL_LOCAL_BASE_URL` > on macOS `api_url` + `/v1` from
  `~/Library/Application Support/actual/actual-runtime.json`, only if the
  file parses and its `pid` is alive > on non-macOS only,
  `http://127.0.0.1:8080/v1`. On macOS a missing, malformed, or stale file
  means no probe and no provider. Never sends a key. Never spawns the
  `actual` CLI.
- `actual-relay`: `https://api.actual.inc/v1`, Bearer `ac_` key via `/login`
  or `ACTUAL_API_KEY`; optional `ACTUAL_CLUSTER_ID` -> `X-Cluster-ID` on
  discovery and inference. Discovery keeps only `loaded: true` rows, cached
  per credential; model id = `selector` else `id`.
- Both use `openai-completions`.
- llama.cpp guard: implicit llama.cpp is skipped only when a live Actual
  runner's `api_url` is exactly `http://127.0.0.1:8080` and
  `LLAMA_CPP_BASE_URL` is unset. A stale file does not suppress it.
- Generic change: `openai-models-list` discovery names models from the
  bundled reference, else `display_name`, else id
  (`packages/coding-agent/src/config/model-discovery.ts`).

## Shared files touched

New files do not conflict: `actual-local.kdl` and `actual-relay.kdl` under
`packages/catalog/src/compat/rules/providers/` and `.../rules/auth/`,
`packages/catalog/src/provider-models/actual.ts`,
`packages/ai/src/registry/actual-relay.ts`, and tests
`packages/catalog/test/actual-provider.test.ts`,
`packages/ai/test/actual-relay.test.ts`,
`packages/coding-agent/test/actual-local-discovery.test.ts`,
`packages/coding-agent/src/session/actual-output-budget.ts` (422
`invalid_max_tokens` retry), `packages/coding-agent/test/actual-output-budget.test.ts`.

Conflict surface (shared files with Actual entries):

- `packages/catalog/src/compat/rules/auth/_order.kdl`
- `packages/catalog/src/provider-models/descriptors.ts` (factory entries)
- `packages/catalog/src/provider-models/openai-compat.ts`
- `packages/catalog/src/provider-models/index.ts` (export)
- `packages/catalog/src/compat/resolve.ts` (`LOCAL_OPENAI_COMPAT_PROVIDERS`)
- `packages/catalog/scripts/generate-models.ts` `DISCOVERY_ONLY_PROVIDERS`
- `packages/ai/src/registry/registry.ts` (relay registration)
- `packages/coding-agent/src/config/model-registry.ts` (implicit
  `actual-local`, llama.cpp 8080 guard, `learnContextWindow`)
- `packages/coding-agent/src/config/model-discovery.ts` (name fallback,
  unknown window for non-active `actual-local` rows)
- `packages/coding-agent/src/session/settings-stream-fn.ts` and `sdk.ts`
  (Actual retry wrapper, `onContextWindowLearned` hook)
- keyless placeholder: no longer a hand list. `actual-local`'s
  `empty-fallback` in `rules/auth/actual-local.kdl` feeds
  `LOCAL_PROVIDER_PLACEHOLDERS`
  (`packages/coding-agent/src/config/model-provider-discovery.ts:31`), so
  `model-provider-discovery.ts` no longer conflicts.
- `packages/coding-agent/src/config/append-only-context-mode.ts` (local-id set)
- `packages/tui/src/chat/image-loading.ts` (local-id set, stb decoder)
- test: `packages/ai/test/models-json-no-local-endpoints.test.ts`
- generated: `packages/catalog/src/compat/rules.json`, `auth-ids.ts`,
  `provider-ids.ts`

## Rebase resolution

1. Take upstream's side of every conflict in the files above.
2. Re-add the Actual entries (ids, set members, registry block, guard) on top
   of upstream's code. Fix our code around upstream, never the reverse.
3. Never hand-edit generated files. Rerun `bun run gen:compat` to regenerate
   `rules.json`, `auth-ids.ts`, `provider-ids.ts`.
4. Run the three Actual tests above plus
   `models-json-no-local-endpoints.test.ts`.

## Verified

Local API probed 2026-10-15. Relay probed 2026-10-16 with a real key:
`loaded`/`selector`/`clusters` fields, `model_mismatch` for display ids, and
end-to-end `omp -p` through both providers (Qwen3.5 9B, 131K context).
Plain-text 401/503 bodies are still from Actual docs only. Runner-side
quirks (memory gate, relay re-registration, `--ctx-size`) are listed in
`docs/provider-quirks.md` under Actual.
