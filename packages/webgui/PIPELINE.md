# Data pipeline refactor

How data gets from omp to the phone, what is wasteful about it, and what
we change. One fix at a time.

## How it works today

```
omp session -> JSON line -> Unix socket -> daemon -> WebSocket -> browser -> screen
```

- Every message is one line of JSON.
- RPC is just the pattern on top: the browser asks with an `id`, omp
  answers with the same `id`. omp also sends events nobody asked for
  (new text, tool started, turn ended). Those have no `id`.
- The daemon passes bytes through. It does not read them.
- Base64 is only used when one message is over 1 MiB. omp cuts it into
  pieces, the browser glues them back.

## The three kinds of line

```
ask     { id: "c7", type: "get_state" }
answer  { id: "c7", type: "response", success: true, data: {...} }
event   { type: "message_update", ... }
```

## Problem 1: reopening a session is slow

The browser asks for the whole history in one go and waits for all of it
before showing anything.

A pager exists, but it sends the oldest messages first and breaks
whenever a new message arrives. Nothing uses it.

### Fix

Load newest first, show it right away, keep loading older pages in the
background and add them to the top until the whole history is there.

- Ask: "give me up to N messages before number X". No X means "the
  newest ones".
- Answer: the messages, and the number of the first one.
- Message numbers never change, because new messages only go on the end.
  So new messages arriving mid-load break nothing.
- If the session switches branch, the numbers do change. The browser
  throws its copy away and starts over.

In the browser: a list of messages, plus the number of the first one.
When that number is 0, we have everything.

### Decided

- Upstream's pager is not good enough. We redesign it in upstream code,
  aiming to contribute it back.

## Problem 2 (later): streaming resends the whole message

Every new token sends the full message so far, twice. The new text is
already in the line; nobody uses it.

It feels fine on the phone today, because one message is small. It is
still waste.

### Fix

- As a new protocol version (v3), so other clients keep working.
- Start of a message: full message, once.
- Each token: just the new text and which block it belongs to.
- End of a message: full message, once. This also repairs anything that
  went wrong mid-stream.
- The browser adds each new piece of text to the end of its block.

## Decisions
- Protocol versions are upstream's (v1, v2). We add v3 the same way, so
  the rest of the code base keeps working.
- We write this to be merged upstream. Changes go where they belong,
  not into webgui.

## Where the protocol lives

- Framing, chunking, versions: `coding-agent/src/modes/rpc/rpc-frame.ts`.
- Message shapes: `coding-agent/src/modes/rpc/rpc-types.ts`.
- Version handshake: `rpc-server.ts`, `rpc-mode.ts`.
- Browser copy of the decoder: `webgui/src/lib/rpc-client.ts`.
- `packages/wire` is upstream's shared protocol types package. The
  protocol should probably move there, so server and browser share one
  copy instead of two.

## Later: package split

- wire: the protocol.
- a shared UI package: transcript, markdown, tool views, used by
  collab-web and webgui.
- webgui: just the daemon.
