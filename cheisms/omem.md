# omem (optimized memory)

Status: partial (part 1 built, its Open list remains; part 2 not implemented)

[references]
- ~/nousbase/main/MACHINE_LEARNING
- https://gist.github.com/VictorTaelin/91837951a5ce5b38f341ec1ba1df6449

*show us the context and we will show you the world*

>Think of a giant pool of text that fills up and eventually overflows the context length.
>LLMs are just text. Their world is only text, so they must learn to interact as text. 
>What if instead of slowly filling up the pool. You prefill the pool, the text becomes the world. The LLM changes the text to act out the world.

You leave a lot of blank space in this context world. The rest of the world is the tree view. 

Tree 
Zoom
Scratch Zone (Rest of context)
Logs (zoom in on memory bank)

There should be some degree of immutability to the context world, this helps with prompt caching, the world should be put into context in order of how much it changes from least to most.




---



## Part 1 (built)

Based on the UniiChat gist, revision 3c190e0 (2026-10-08), and Taelin's repo `~/TPP/UniiChat` (commit 0500bf6). Where the repo and the gist differ, the choice is noted. Section numbers (§) refer to the gist.

Commits: `a579557580` (mode), `15fc64168c` (compactor hang, cache, role), `6dca6ed83f` (UniiChat alignment).

### Scope

- omem is a session memory mode in `packages/coding-agent`, not a client feature. TUI, print mode and `omp host` RPC (webgui, omp-shell) all work.
- One global chat. It never ends. Parallel work happens through subagents and other sessions (part 2).
- Start: `omp --omem` (or setting `omem.enabled`). Store dir: setting `omem.dir`, env `OMP_OMEM_DIR`, default `~/.omp/omem/`. Use a scratch dir for experiments.
- webgui: "omem memory" checkbox on the new session form; `POST /api/launch` takes an optional boolean `omem`.
- Subagents never run in omem mode.

### Store (§1)

```
~/.omp/omem/
  main/YYYY-MM-DD.jsonl   {i, kind, text, size, date}   day = local date
  tree/YYYY-MM-DD.jsonl   {l, i, text, size}
  view.json               {view, cview, draining}       old [[l,i],...] format still loads
  lock                    unix socket, one writer
  holder.json             pid, session, mode of the writer (for the lock error)
  turn-ledger.json        user messages of the latest turn, so a restart does not log them twice
```

- Kinds: `user`, `agent`, `tool`, `echo`, `note`. `work` returns with part 2.
- Append only, fsync each line. Torn last line truncated. A corrupt line mid-file is skipped with a warning; messages are placed by id, so open fails only if an id is really missing.
- Thoughts never logged.
- Tool output clipped to head and tail, 30,000 chars. Other long text split over several messages.
- Outcomes are logged: failed tool `error: ...`, empty result `(no output)`, cut reply `[cut off: reason]`, unanswered tool calls at turn stop, failed turn `note` "No reply: ... Send a message to try again." A user abort adds no note.
- One writer: a second `omp --omem` fails with a message naming the holder. omp has no TUI attach to another process; use omp-shell or webgui against an omem host.
- The normal session JSONL keeps recording too.

### Tree (§2)

- `node(0,i)` = message i in at most 512 bytes; `node(l,i)` = merge of `(l-1,2i)` and `(l-1,2i+1)`. Name `id+n`.
- A source that fits in 512 bytes is its own node, no model call.
- Each node built once, logged, never rebuilt.

### View (§3)

- List of nodes covering `[0,T)`, oldest first, rendered `id+n|text` inside `<chat>`. Summaries only.
- Which pair merges: largest `due = (T - last) / 2^l` whose parent is built, oldest on ties. Test: matches Taelin's `push` for t = 0..20,000.
- When: each message appends one line. Past 128,000 bytes, one batch merges down to 64,000 bytes. The batch flag is saved.
- Saved to `view.json`, never rebuilt from the log (only if the file is missing).

### Context layout

```
[tools] [system prompt] [view] [per-turn state] ["Turn: the user's new message:" + message] [tool loop]
```

- Scratch zone = rest of context. Per-turn only; what the agent writes is logged and returns as tree lines.
- No volatile bytes in tools or system prompt. Date, cwd, repo context move to per-turn state. The workspace tree is dropped in omem mode.

### Turn (§6)

- Each user message is a fresh request, built in the main agent loop's `context` transform (`src/session/omem-mode.ts`). Side requests (title, /btw, handoff, dumps) bypass omem.
- Render the view before logging the new message.
- Wait (`settle`) until every earlier message is summarized; abort ends the turn without logging. After 15 s a notice names the compactor model and pending node count.
- Large message (repo `Memory.whole`): over 128,000 bytes, the early pieces become view lines for that turn and only the last 128 KB goes whole. Not applied to mid-run steers (omp cannot hold a steer for the next turn).
- Mid-run user messages are delivered between tool calls, logged as `user`, no turn head.
- Built-in compaction, `context_notes` and `new_context` off in omem mode.
- Tools: `zoom(id, n)` (rejects ranges past the end, lists the tree roots), `date(id)` (local time).

### Compactor (§4)

- Model role `omem` (`/model` Roles, or `modelRoles.omem` in config.yml with `:level`). Unset falls back to `smol`. Current setting: `anthropic/claude-haiku-5-5:high`. `max` thinks ~35k tokens per node (133 s); do not use it.
- Request: system = omem prompt only, no tools (repo choice; the gist said share the turn's tools). View blocks with a cache mark on the last whole block, then the task, then on retry one unmarked note.
- Own view of 16-32 KB, same sawtooth, ends at the node, only built lines. Saved in `view.json`.
- Task prompts with the 512-dash ruler. Over-limit retry: same blocks plus one note about the latest line only, never earlier attempts (repo `Memory.over`; the gist said continue the conversation). Max 5 tries, keep shortest.
- Refusal or all-empty tries: node = source cut to 512 bytes. Transient failure: retried every 60 s and at the next message or settle.
- Up to 8 calls at once. Message node starts when fewer than 8 earlier lines are unbuilt. Merge starts when both halves built. Ready nodes in queues.
- Single flight: a call over a prefix another call is writing waits until that call starts streaming.
- Failures show as warnings (stderr in print mode, notice in the TUI). Cost recorded as `model_usage` with purpose `omem-compaction`.

### Cache (§3.3)

- Turn: view in 4-line blocks; marks on tools/system, the last whole view block and the request end. Set in `before_provider_request`.
- 5 minute entries only. Overrides any configured 1 hour retention for omem requests.

### System prompt (§5)

- Repo prompt adapted: name omp, kind `agent`, no computers paragraph, no `zoom("Name")`, no images, no `work`. Ends with the repo's "small, mechanical job ... be fast" paragraph. omp's default prompt follows it.

### Code layout

- Core `packages/coding-agent/src/omem/`: `omem.ts` (view, compactor, settle, zoom), `store.ts` (files, lock), `view.ts` (fold), `prompt.ts`, `sizes.ts`, `index.ts` (exports). No agent imports.
- Adapter `src/session/omem-mode.ts` (transform, logging, marks, tools, compactor call) and wiring in `src/sdk.ts`.
- Tests (in `src/omem/`): `omem-fold.test.ts`, `omem-store.test.ts`, `omem-session.test.ts`, `omem-fixes.test.ts`.

### Checking it works

- `tail ~/.omp/omem/main/*.jsonl`: every message logged.
- `tail ~/.omp/omem/tree/*.jsonl`: summaries built.
- `~/.omp/omem/view.json`: what the next turn sees.
- `/dump` does not show the omem request (it uses the side path).

### Open

- Import of past omp sessions as `note` messages (repo: separate import side with its own queue, never blocks turns).
- Images (repo stores them by hash; `zoom(id,1)` returns them).
- Paging long messages as one logical message with `zoom(id,1,at)` (repo `more` flag).
- Disk work: fsync batching off the hot path, save `view.json` only on shape change, heap-based fold (now O(n^2) per batch), index files instead of loading the whole log.
- Compactor order by age instead of messages first (repo `ctx` order).
- Cache and failure tests like the repo's `cache.test.ts` (>=95% reads) and `failsafe.test.ts`.
- `/dump` and a status line for omem (messages, view KB, pending nodes).

## Part 2: managing other sessions (after part 1 works)

### What exists

- In-process only: `task`, `write agent://`, `read agent://`, `proc://` kill, `wait`. Scoped to one process.
- Cross-process: every `omp host` and TUI publishes a registry entry in `<configRoot>/run/rpc-hosts` (endpoint, 0600 token, kind `tui`|`host`). `modes/rpc/rpc-registry.ts`, `rpc-socket.ts`.
- RPC protocol (`modes/rpc/rpc-types.ts`): `prompt`, `steer`, `follow_up`, `abort`, `get_messages`, `get_state`, `get_subagents`; frames `prompt_result`, `session_settled`, `agent_end`.
- Socket clients today: `packages/shell`, webgui server.

### Gaps

- No agent-callable tool that connects to another session's socket.
- No `omp host list|attach|stop` (`src/commands/host.ts:41-45` handles only `run` and `start`).
- No cross-process push of a finished session's result into a running session.
- No tmux integration for agent-driven sessions. A tmux terminal-launch backend exists (`src/subprocess/terminal-launch/tmux.ts`), but no agent tool uses it to spawn sessions.

### Design

- tmux for placement and visibility: sessions run as TUI windows in the user's tmux, so the user can watch or take over any of them.
- RPC for control: find the session in the registry, drive it over its socket. No `send-keys`/`capture-pane` scraping (fragile, no completion signal).
- Completion: wait for `session_settled`, then log the result into the omem chat as a `work` message, delivered between tool calls or as a new turn.

### Tools

- `sessions_list`: live registry entries (name, cwd, kind, settled).
- `session_spawn(cwd, prompt, name?)`: `tmux new-window` running `omp`, returns its id once registered.
- `session_send(id, text, mode)`: `prompt` | `steer` | `follow_up`.
- `session_read(id)`: last assistant text or message page.
- `session_stop(id)`: abort, then close.

### Risks

- Tokens: the tool reads 0600 registry files as the same user; never echo tokens into the log.
- A TUI the user is typing in also accepts RPC prompts; driver handoff rules in `rpc-host-driver.ts` apply.
- tmux absent: fall back to `omp host start` (headless) with the same RPC control.

## Bug: images lost after summarization

Observed 2026-10-21. User sent an image (Sanders Associates logo). Two turns later the agent was asked to identify the font and could not see it. `zoom(595, 1)` returned only `user: i like this image design [image]`: the raw message does not keep image content, so zoom cannot recover it. The user had to resend the image.

- Expected: `zoom(id, 1)` on a message with an image returns the image (or a readable reference to it, e.g. a stored file path or artifact id).
- Actual: summaries and zoom both reduce the image to a `[image]` placeholder. Storage format (b64 inline, file, dropped) unknown.
- Fix direction: keep image attachments with the raw message (stored as artifact files, not inline b64 in the summary tree), and have zoom re-attach them. Summaries can keep a short caption plus the artifact ref.
