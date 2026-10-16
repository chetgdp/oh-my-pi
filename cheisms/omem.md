# omem (optimized memory)

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



## Spec (draft)

Based on the UniiChat gist, revision 3c190e0 (2026-10-08). Section numbers (§) refer to it.

### Scope

- omem is a session memory mode in `packages/coding-agent`, not a client feature. TUI, shell mode, webgui (via `omp host` RPC) all work unchanged because they talk to the same `AgentSession`.
- One global chat. It never ends. Parallel work happens through subagents and normal sessions that the omem agent drives; their reports enter the log as `work` messages.
- Start: `omp --omem` attaches to the global chat from any client. Store path is a setting (default `~/.omp/omem/`) so tests can use a scratch chat.

### Store (§1)

```
~/.omp/omem/
  main/YYYY-MM-DD.jsonl   {i, kind, text, size, date}
  tree/YYYY-MM-DD.jsonl   {l, i, text, size}
  view.json               [[l, i], ...]
  lock                    unix socket, one writer
```

- Kinds: `user`, `agent`, `tool`, `echo`, `work`, `note`.
- Append only, fsync each line. Torn last line skipped at load.
- Thoughts never logged.
- Tool output clipped to head and tail, 30,000 chars. Other long text split over several messages, never cut.
- One writer: a second `omp --omem` attaches to the running host, it never writes the store.
- The normal session JSONL keeps recording too, so transcript, resume and export keep working.

### Tree (§2)

- `node(0,i)` = message i in at most 512 bytes; `node(l,i)` = merge of `(l-1,2i)` and `(l-1,2i+1)`. Name `id+n`.
- A source that fits in 512 bytes is its own node, no model call.
- Each node built once, logged, never rebuilt.

### View (§3)

- List of nodes covering `[0,T)`, oldest first, rendered `id+n|text` inside `<chat>`. Summaries only, never a whole message.
- Which pair merges: largest `due = (T - last) / 2^l` whose parent is built, oldest on ties. Never `first`.
- When: each message appends one line. Past 128,000 bytes, one batch merges down to 64,000 bytes (sawtooth).
- Saved to `view.json`, loaded at start, never rebuilt from the log.

### Context layout

Ordered from least to most change:

```
[tools] [system prompt] [view] [per-turn state] [new message] [tool loop]
```

- Scratch zone = rest of context: window minus everything before the new message. It is per-turn working space; it does not persist. What the agent writes there is logged and returns next turn as tree lines.
- No dates or state in tools or system prompt.

### Turn (§6)

- Each user message is a fresh request. No history carried over. Implemented by replacing messages in the `context` transform (`packages/agent/src/agent-loop.ts` prepareProviderCall).
- Render the view before logging the new message.
- Wait until every earlier message is summarized; user can cancel.
- Mid-run user messages are delivered between tool calls and logged as `user`.
- Built-in compaction off in omem mode.
- Tools added: `zoom(id, n)`, `zoom("Name")`, `date(id)`. Check overlap with built-ins `context_notes`, `new_context`.

### Compactor (§4)

- Same tools and system prompt as turns (tools never called), so it reads the turns' cache.
- Own view of 16-32 KB, same sawtooth, ends at the node, only built lines.
- Task prompts with the 512-dash ruler; over-limit retry with cut marker; max 5 tries, keep shortest.
- Up to 8 calls at once. Message node starts when fewer than 8 earlier lines are unbuilt. Merge starts when both halves built. Ready nodes in queues, never scan the tree.
- Failed node retried at the next message.
- Model: cheap (gist uses Haiku at xhigh). Cost recorded as `model_usage` entries.

### Cache (§3.3)

- View in blocks of 4 lines; one mark on the last whole block, one on the request end. Set in `before_provider_request`.
- 5 minute entries, no 1 hour entries, no keep-alive pings.
- Concurrent compactions on the same prefix wait for the first writer's response to start.

### System prompt (§5)

- Gist prompt adapted: agent name, `agent` kind, zoom-first rule, "say what you learned", compaction rules. User instructions appended after it.

### Code layout

- Core module (`packages/coding-agent/src/omem/` or `packages/omem`): log, tree, fold, compactor queue. No UI, no agent imports.
- Mode adapter in `AgentSession`: context transform, tools, logging hooks, compaction off, cache marks.
- webgui: launch toggle only at first. Later: tree browser (view, zoom to message).

### Tests

- Fold matches Taelin's `push` for t = 0..20,000 with push's budget.
- Sawtooth bounds, `view.json` round trip, torn line recovery, lock exclusion.
- Compactor queue ordering with a fake model.
- Existing RPC and session-manager tests still pass.

### Open

- Kind name for agent replies (`agent` vs a name).
- Import of past omp sessions as `note` messages.

## Part 2: managing other sessions (after part 1 works)

### What exists

- In-process only: `task`, `write agent://`, `read agent://`, `proc://` kill, `wait`. Scoped to one process.
- Cross-process: every `omp host` and TUI publishes a registry entry in `<configRoot>/run/rpc-hosts` (endpoint, 0600 token, kind `tui`|`host`). `modes/rpc/rpc-registry.ts`, `rpc-socket.ts`.
- RPC protocol (`modes/rpc/rpc-types.ts`): `prompt`, `steer`, `follow_up`, `abort`, `get_messages`, `get_state`, `get_subagents`; frames `prompt_result`, `session_settled`, `agent_end`.
- Socket clients today: `packages/shell`, webgui server.

### Gaps

- No agent-callable tool that connects to another session's socket.
- No `omp host list|attach|stop`.
- No cross-process push of a finished session's result into a running session.
- No tmux integration.

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
