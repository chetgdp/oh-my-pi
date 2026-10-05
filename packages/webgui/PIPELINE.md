# Data pipeline: protocol v3

How data gets from omp to the phone, what was wasteful about it, and the
v3 protocol that fixes it. v3 is implemented (2026-09-24). Research notes
with file:line: `research/v3-input-end.md` (omp side) and
`research/v3-output-end.md` (browser side). This file wins where they differ.

## How it works today

```
omp session -> JSON line -> Unix socket -> daemon -> WebSocket -> browser -> screen
```

- Every message is one line of JSON (NDJSON).
- The browser asks with an `id`, omp answers with the same `id`. omp also
  sends events nobody asked for (new text, tool started, turn ended).
- The daemon passes bytes through. It does not read them.
- v2 cuts a frame over 1 MiB into base64 chunks; the browser glues them
  back (`rpc-frame.ts:95-117, 293-302`). v1 shrinks or drops such frames.

## What is wrong today

1. Reopening a session is slow. The browser fetches the whole history
   with `get_messages` (`rpc-client.ts:427`) and waits. `get_messages_page` exists
   but pages oldest-first, goes stale on every new message (its cursor pins
   `leafId` and `messageCount`, both change on every append), and refuses
   while streaming (`rpc-server.ts:1622`). Nothing uses it.
2. Every token resends the whole message, twice: `message_update` carries
   `message` and `assistantMessageEvent.partial` (`agent-loop.ts:477-487`).
   The browser ignores the delta and rebuilds from the full message (`transcript-model.ts:234-240`),
   then rebuilds every row and re-parses all Markdown per token.
3. The browser never learns about compaction or branch switches; it shows
   old messages until it reconnects (`session-store.ts:291-296, 366-371`).
4. Rows change key when a message ends (`stream-*` to `<n>-*`), so React
   destroys and redraws them (`Transcript.tsx:182, 498`).

## v3 design

### The session log

The browser log stores the saved session entries of the current branch.
The webgui already renders from these entries (`Transcript.tsx:117-173`).
The entry types are `message`, `compaction`, `branch_summary`, `model_change`, and `thinking_level_change`.
The log is not omp's in-memory `agent.state.messages` list.
Hidden in-memory messages, like prewalk plan nudges or custom role prompts, are never saved (`prewalk.ts:33-35`, `agent-session.ts:2992`).
They never reach the protocol.
Their removal needs no protocol frame.

### Entry identity and row keys

Saved session entries already have IDs (`SessionEntry.id`).
The browser keys rows by entry ID.
A live streaming message is keyed by its stream ID until its entry is saved.
After the entry is saved, the row keeps that same React key.

### Branch changes

A branch change is the only change after the fact.
It means the current branch no longer ends where the browser thinks.
Compaction, branch switching or resuming, and dropping a failed turn on context overflow cause branch changes (`turn-recovery.ts:1141-1168`, `session-maintenance.ts:2822, 2951, 2979, 3008`).
omp sends one frame for this: `branch {leafId}`.
The browser keeps its entries until the newest page of the new branch arrives, then replaces them.

### Retries and error replies

Normal auto-retry removes a failed reply only in memory (`turn-recovery.ts:2532`).
The saved entry stays in the session file.
The browser shows the failed reply, then shows the new attempt.
No frame is needed.
Empty error replies and classifier refusals are never saved (`agent-session.ts:2927-2930`).

### Streaming

Only assistant messages stream as frames.
All other saved entries arrive as one `entry` frame.
Streaming uses five frames:
- `msg_start`: starts a streaming message with a stream ID.
- `block_start`: starts a content block.
- `delta`: carries new text only.
- `block_end`: carries the complete block. Tool-call arguments arrive whole.
- `msg_end`: carries the final message. The row stays frozen until its `entry` arrives.

Error and aborted replies are kept as frozen rows after `agent_end`.
Secrets are restored at the RPC boundary.
Deltas are sent raw. `block_end` carries the restored block.

The `tool_output` frame carries new tool output only.
With `replace` set, the text is the whole output and replaces what is shown.
Protocol v3 does not send `message_update`.
On v3, `agent_end` has no `messages` and `turn_end` has no `message` or `toolResults`.

### Model and thinking changes

Model changes and thinking level changes are saved entries.
The browser displays them as marker rows.
They change no behavior.

### History and paging

The `history` request returns pages of saved entries, newest first.
The default page size is 50 entries. A `limit` outside 1 to 200 is an error, not clamped.
The browser loads the newest page on attach, on a branch change, and on resync.
On attach, history is the first request, so the transcript is not queued behind other commands.
Model roles, the model browser, agents, and login status load only when the models screen or a picker needs them (about 600KB together).
It loads older pages on demand when the user scrolls near the top.
The newest page includes live streaming messages so mid-stream attach loses nothing.
A page request names the leaf ID and the `before` entry it pages from.
omp answers `branch_changed` only when one of these is not on the current branch.
A leaf that only advanced by appends is not a branch change.
On `branch_changed`, the browser starts again from the newest page.
If a page fails on a transport size limit, the browser retries with half the page size.

### Large frames

Frames over 1 MiB use existing v2 chunking.
Delay behind large frames is accepted.

### Unchanged surfaces

The following surfaces are unchanged in v3:
- `command_output`
- `subagent_lifecycle` and `subagent_progress`
- `get_subagent_messages`
- `get_messages_page`
- v1 and v2 clients

### Client compatibility

An omp process started before v3 cannot speak it.
The browser shows an incompatible banner ('This omp is too old, restart it') and does not retry.

### Ordering rule

A history answer and the frames after it must never show the same entry twice.

## Later: package split

- wire: the protocol, one copy for server and browser (`packages/wire`).
- a shared UI package: transcript, markdown, tool views, used by
  collab-web and webgui.
- webgui: just the daemon.
