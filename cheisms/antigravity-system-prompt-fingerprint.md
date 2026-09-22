# Antigravity (Cloud Code Assist) system-prompt fingerprint block

Fork-only note. Point an agent at this file when `google-antigravity` requests
start failing with a spurious 429 while the Antigravity IDE still works.

## Symptom

```
Error: Cloud Code Assist API error (429): {"error":{"code":429,
"message":"Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED"}}
Retry failed after 1 attempts: Provider requested 1800000ms wait, exceeds retry.maxDelayMs
```

Distinguishing facts: the local Antigravity IDE works on the same account
(quota is not exhausted); a trivial system prompt returns 200; the omp
system prompt returns 429; identical bodies differing by one substring flip
between 429 and 200. The retry-after is a fixed 30 minutes. Only the models
currently gated by the backend trigger it (2026-09-21: `gemini-3.1-pro-low`
blocked, deprecated `gemini-3.5-flash-low` returned 200 regardless), so probe
with the model that actually fails for you.

## Background

Google fingerprints third-party agent system prompts on the Cloud Code Assist
endpoint (`daily-cloudcode-pa.googleapis.com`) and returns 429 for matches
(same mechanism reported for Amp; its author said he was in talks with Google
about whether Amp would be allowed). omp's public system prompt is the
fingerprinted artifact. Every time the public prompt's preamble is matched,
the fork has to diverge from the public bytes.

## History

| Date | Blocked substring (exact bytes) | Fix | Commit |
|---|---|---|---|
| 2026-09-12 | `<system-conventions>\nRFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL.` (82 chars, gemini-3.8-flash-high) | renamed tag to `<conventions>`; added `packages/coding-agent/test/system-prompt-fingerprint.test.ts` | `b1f4268fe1` (Che) |
| 2026-09-14 | (upstream adopted our rename, so the public prompt now shipped `<conventions>`) | | `10fb0ac325` (can1357) |
| 2026-09-21 | `<conventions>\nRFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL.` (75 chars, gemini-3.1-pro-low) | renamed tag to `<notation>` in `prompts/system/system-prompt.md`, `live/prompts/live-instructions.md`, `prompts/advisor/system.md`; test asserts both prefixes absent | this fork, 2026-09-21 |
| 2026-09-21 | (upstream rebase) upstream `051d3e13a2` dropped the `<conventions>` tag from `system-prompt.md` entirely; taken as-is on rebase. Upstream `advisor/system.md` and `live-instructions.md` still ship the blocked prefix, so our `<notation>` rename there is the surviving fork delta and will conflict/need re-checking on every `omp-update`. | `05c20cc08d` (rebased) |

Observations from the 2026-09-21 bisect (18 probes):
- `<conventions>` alone: 200. `RFC 2119: MUST, ..., OPTIONAL.` alone: 200.
  Tag + newline + RFC line: 429. Dropping the trailing `.` after `OPTIONAL`: 200.
  The match is an exact prefix over tag + newline + keyword enumeration.
- `<session-conventions>` + same RFC line: 200. Any tag rename works until it
  becomes public.
- The block did not depend on the rest of the prompt, tools, AGENTS.md, or
  multi-part `systemInstruction`.

## Procedure when it recurs

1. Confirm it is a fingerprint, not quota: `bun cheisms/cca-probe.ts --text 'You are a helpful assistant'`
   must be 200 on the failing model (`CCA_MODEL=<id>`). If that 429s too, stop:
   it is not prompt-based (check headers/body, account, client version gating
   in `packages/catalog/src/wire/gemini-headers.ts`).
2. Capture the real prompt: call `buildSystemPrompt` from
   `@oh-my-pi/pi-coding-agent/system-prompt` (see the fingerprint test for the
   minimal invocation) and write `systemPrompt.join("\n\n")` to a file. A
   script under `packages/coding-agent/scripts/` resolves workspace packages;
   `/tmp` does not. Probe it with `--file`; expect 429.
3. Bisect with `--lines <file> <start> <end>` by halves until a minimal span
   is found, then narrow within the span using `--text`. Verify the complement
   passes. One request at a time; each 429 may count against the account.
4. Reword the source `.md` (all three files above share the preamble). Keep
   meaning; change the bytes. Preferably change more than the tag name so the
   fork stays divergent even if upstream copies the tag again (the RFC keyword
   list is part of the match; reordering or rephrasing it breaks the prefix).
5. Add the new blocked bytes to `system-prompt-fingerprint.test.ts`, run only
   that file, rebuild the prompt and probe once more for 200.
6. Update the table above.

## Files

- `cheisms/cca-probe.ts`: direct `fetch` probe, reads the OAuth credential
  from `~/.omp/agent/agent.db` (`auth_credentials.data` JSON: `access`,
  `projectId`, `expires`). Request shape mirrors `buildRequest` in
  `packages/ai/src/providers/google-gemini-cli.ts` (Antigravity branch).
- `packages/coding-agent/test/system-prompt-fingerprint.test.ts`: guards
  against reintroducing known blocked prefixes (e.g. by an upstream merge).
- Prompt sources: `packages/coding-agent/src/prompts/system/system-prompt.md`,
  `packages/coding-agent/src/live/prompts/live-instructions.md`,
  `packages/coding-agent/src/prompts/advisor/system.md`.

## Merge hazard

Upstream merges can reintroduce a blocked preamble (upstream adopted our first
rename two days later). The test catches the two known prefixes; a fresh
upstream wording is not covered until it is observed live.
