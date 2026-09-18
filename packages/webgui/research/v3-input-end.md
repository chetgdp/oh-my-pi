> Research note, 2026-09-24, written by a subagent for the v3 design in
> `../PIPELINE.md`. Line numbers are as of that date. Corrections found
> later (PIPELINE.md wins where they differ):
> - `replaceMessages` is not the only rewrite. `Agent` also rewrites in
>   `popMessage`, `clearMessages` and reset (`agent.ts:1109, 1246, 1289`).
> - Many appends go through `agent.appendMessage` with no
>   `message_start`/`message_end` event (reminders, custom messages, bash
>   output, irc). Section 2 lists only the event-driven ones.
> - The byte figures in section 3 ("~12 MB") are estimates, not
>   measurements.

# omp RPC Protocol v3: Input End Research

## 1. Session Data Model

### Session Entries (Types)
Defined in `packages/coding-agent/src/session/session-entries.ts:66-313`:
All entries extend `SessionEntryBase`:
- `SessionEntryBase` (`session-entries.ts:66-71`): `{ type: string; id: string; parentId: string | null; timestamp: string }`

The complete set of entry types in `SessionEntry` (`session-entries.ts:296-312`) is:
1. `SessionMessageEntry` (`type: "message"`, `session-entries.ts:73-76`): contains `message: AgentMessage` (user, assistant, toolResult, fileMention).
2. `ModelUsageEntry` (`type: "model_usage"`, `session-entries.ts:79-90`): non-transcript model usage (purpose, role, api, provider, model, usage, stopReason, errorMessage).
3. `ThinkingLevelChangeEntry` (`type: "thinking_level_change"`, `session-entries.ts:92-101`): thinking level changes (`thinkingLevel`, `configured`).
4. `ModelChangeEntry` (`type: "model_change"`, `session-entries.ts:103-111`): model changes (`model`, `role`, `resolvedModelIsFallback`).
5. `ServiceTierChangeEntry` (`type: "service_tier_change"`, `session-entries.ts:113-116`): provider service tier changes (`serviceTier`).
6. `CompactionEntry` (`type: "compaction"`, `session-entries.ts:118-142`): compaction record (`summary`, `shortSummary`, `firstKeptEntryId`, `tokensBefore`, `tokensAfter`, `method`, `providerReplayThroughEntryId`, `details`, `preserveData`, `fromExtension`, `warning`).
7. `BranchSummaryEntry` (`type: "branch_summary"`, `session-entries.ts:144-152`): summary of an abandoned branch (`fromId`, `summary`, `details`, `fromExtension`).
8. `ResetBoundaryEntry` (`type: "reset_boundary"`, `session-entries.ts:162-164`): pure marker recorded by `/clear` to delimit live transcript rebuilds.
9. `CustomEntry` (`type: "custom"`, `session-entries.ts:176-180`): extension data (`customType`, `data`); does NOT participate in LLM context.
10. `CustomMessageEntry` (`type: "custom_message"`, `session-entries.ts:285-293`): extension message participating in LLM context (`customType`, `content`, `details`, `display`, `attribution`).
11. `LabelEntry` (`type: "label"`, `session-entries.ts:182-187`): bookmark/marker on an entry (`targetId`, `label`).
12. `TitleChangeEntry` (`type: "title_change"`, `session-entries.ts:189-196`): title audit entry (`title`, `previousTitle`, `source`, `trigger`).
13. `TtsrInjectionEntry` (`type: "ttsr_injection"`, `session-entries.ts:206-211`): records time-traveling rules injected (`injectedRules`).
14. `SessionInitEntry` (`type: "session_init"`, `session-entries.ts:231-262`): initial context for subagent sessions (`systemPrompt`, `task`, `tools`, `agent`, etc.).
15. `ModeChangeEntry` (`type: "mode_change"`, `session-entries.ts:265-271`): agent mode transitions (`mode`, `data`).
16. `CredentialPinEntry` (`type: "credential_pin"`, `session-entries.ts:223-229`): records OAuth account serving provider (`provider`, `hash`).

File-level header records:
- `SessionHeader` (`type: "session"`, `session-entries.ts:35-54`): JSONL header line.
- `SessionTitleSlotEntry` (`type: "title"`, `session-entries.ts:24-31`): fixed-width (256-byte) first-line slot for mutable title.

### Tree / Branch / Leaf (`leafId`)
Managed by `SessionEntryIndex` in `packages/coding-agent/src/session/session-manager.ts:431-592`:
- `#entriesById`: `Map<string, SessionEntry>` (`session-manager.ts:432`)
- `#children`: `Map<string | null, SessionEntry[]>` (`session-manager.ts:433`)
- `#leaf`: `string | null` (`session-manager.ts:435`)
- Each entry records `parentId`, pointing to the previous entry on that branch or `null` for root (`session-entries.ts:69`).
- `SessionManager.getBranch(fromId?: string)` (`session-manager.ts:3116`): calls `this.#index.pathTo(fromId ?? this.#index.leafId())`.
- `SessionEntryIndex.pathTo(id)` (`session-manager.ts:525-560`): walks backwards from `leaf` via `parentId` to root, detects cycles via a `Set<string>`, and reverses the collected entries into chronological root-to-leaf order. Memoized by `(leaf, generation)`.

### How `session.messages` is Derived
- In `AgentSession` (`packages/coding-agent/src/session/agent-session.ts:5767-5769`):
  ```ts
  get messages(): AgentMessage[] {
      return this.agent.state.messages;
  }
  ```
- In `Agent` (`packages/agent/src/agent.ts:766-768`):
  ```ts
  get state(): AgentState {
      return this.#state;
  }
  ```
- **Is `session.messages` a fresh array each time or stable?**
  It is a **stable reference** to `this.agent.state.messages` (the exact in-memory array on `this.#state`). Accessing `session.messages` repeatedly returns the identical array instance (until `agent.replaceMessages()` replaces it with a new slice).
- **Is indexing into it stable across appends?**
  **YES, across normal appends**. `agent.appendMessage(m)` (`packages/agent/src/agent.ts:1101`) executes `this.#state.messages.push(m)`. Existing elements `0..n-1` keep their identical index, and the new message receives index `n`.
- **When is `session.messages` derived from session entries?**
  On session open/resume, branch switches, compaction, `/shake`, and `/clear`:
  `buildSessionContext()` in `packages/coding-agent/src/session/session-context.ts:218-450` traverses the branch path from `leafId` to root:
  - If `options.transcript` is set without `collapseCompactedHistory`: every entry on the branch is traversed in order. Message entries (`entry.type === "message"`), custom message entries (`custom_message`), and branch summaries (`branch_summary`) are converted to `AgentMessage`s. Compaction entries are emitted inline as `CompactionSummaryMessage` dividers (`session-context.ts:429`).
  - If building LLM context (or `collapseCompactedHistory: true`): the compaction summary is emitted first, followed only by kept messages from `firstKeptEntryId` to the compaction, followed by messages after the compaction (`session-context.ts:340-343`). Discarded pre-compaction messages are omitted.
  Then `this.agent.replaceMessages(displayContext.messages)` (`agent-session.ts:10687`, `agent.ts:1086-1089`) sets `this.#state.messages = ms.slice()`.
- Note: Non-message entries (`model_usage`, `thinking_level_change`, `model_change`, `service_tier_change`, `label`, `title_change`, `ttsr_injection`, `session_init`, `credential_pin`, `reset_boundary`, `custom`) exist in `SessionManager.getBranch()` but are NOT in `session.messages`.

---

## 2. Message List Mutation Events and Their Impact

### 1. Append User Message
- **Where**: `Agent.prompt()` (`packages/agent/src/agent.ts:1396`) -> `agent.appendMessage()` (`agent.ts:1101`) pushes to `this.#state.messages`. `AgentSession.prompt()` (`packages/coding-agent/src/session/agent-session.ts:8878`) persists it to disk via `SessionManager.appendMessage()` (`agent-session.ts:2904`).
- **Effect on earlier message indices**: NONE. New message pushed to index `messages.length - 1`.
- **Does `leafId` change?**: YES. `SessionManager.appendMessage()` (`session-manager.ts:2783`) calls `#recordEntry()`, which calls `#index.insert()`, updating `#leaf = entry.id` (`session-manager.ts:462`).

### 2. Append Assistant Message
- **Where**: During streaming, the partial message is held in `this.#state.streamMessage` (`packages/agent/src/agent.ts:1700, 1705`). It is NOT in `this.#state.messages` yet! Only on `message_end` event (`packages/agent/src/agent.ts:1720`) is `this.appendMessage(event.message)` called. `AgentSession.#persistMessageEnd()` (`agent-session.ts:2978-3011`) then calls `SessionManager.appendMessage()` (`agent-session.ts:2904`).
- **Effect on earlier message indices**: NONE. Pushed to end of `messages`.
- **Does `leafId` change?**: YES. `#leaf = entry.id`.

### 3. Append Tool Result Message
- **Where**: Created in `packages/agent/src/agent-loop.ts:3069-3070, 3592-3593`, emitting `message_start` and `message_end`. Received by `Agent` on `message_end` (`agent.ts:1720`), calling `this.appendMessage(toolResultMessage)`. Persisted via `AgentSession.#persistMessageEnd()` -> `SessionManager.appendMessage()`.
- **Effect on earlier message indices**: NONE. Pushed to end of `messages`.
- **Does `leafId` change?**: YES. `#leaf = entry.id`.

### 4. Append Custom / Developer Message
- **Where**: `AgentSession.appendCustomMessage()` (`agent-session.ts:7860, 7910`) calls `this.agent.appendMessage(normalizedAppMessage)` and `this.sessionManager.appendCustomMessageEntry()` (`session-manager.ts:2969-2995`).
- **Effect on earlier message indices**: NONE. Pushed to end.
- **Does `leafId` change?**: YES. `#leaf = entry.id`.

### 5. Branch Navigation (`/branch`, `switchBranch`, `branchWithSummary`)
- **Where**: `SessionManager.branch(branchFromId)` (`session-manager.ts:3167`) moves `#leaf` to `branchFromId`. In `AgentSession.switchBranch()` (`agent-session.ts:10676-10687`):
  `this.sessionManager.branch(newLeafId);`
  `const stateContext = this.sessionManager.buildSessionContext();`
  `this.agent.replaceMessages(displayContext.messages);`
- **Effect on earlier message indices**: **Wholesale replacement**. All messages on the abandoned branch past `newLeafId` are removed. If branching occurred from an earlier point in the conversation, the message list is truncated or reparented.
- **Does `leafId` change?**: YES. It becomes `newLeafId` (or the `branch_summary` entry id).

### 6. Compaction
- **Where**: `packages/coding-agent/src/session/session-maintenance.ts:2339-2341, 3988-3990`:
  `SessionManager.appendCompaction(...)` (`session-manager.ts:2902-2932`) writes a `CompactionEntry` with `firstKeptEntryId`.
  Then `this.#host.agent.replaceMessages(sessionContext.messages)` swaps in the compacted context (`session-maintenance.ts:2340`).
- **Does it replace earlier messages with a summary? What happens to indices?**:
  In `buildDisplaySessionContext()` (`session-context.ts:466-607`):
  - Messages prior to `firstKeptEntryId` are **DISCARDED from `messages`**!
  - A `CompactionSummaryMessage` is emitted.
  - Kept messages from `firstKeptEntryId` to the compaction point follow.
  - Messages after the compaction follow.
  - **Effect on indices**: **Complete disruption**. Messages `0..k` that were summarized away vanish. All retained messages shift to brand-new, lower indices!
- **Does `leafId` change?**: YES. `#leaf = compactionEntry.id`.

### 7. Session Relocation (`/move`)
- **Where**: `SessionManager.moveTo(newPath)` (`session-manager.ts:1970-2080`).
- **Effect on earlier message indices**: NONE. The in-memory entries, branch, leaf, and `session.messages` array are completely unchanged; only the disk file is moved.
- **Does `leafId` change?**: NO.

### 8. Session Switch / New / Resume
- **New session (`/new`, `newSession()`)**: `agent-session.ts:8520-8640`. `agent.replaceMessages([])` or starts with empty `messages`. Old messages gone, indices reset to 0. `leafId` is `null`.
- **Resume (`/resume`, `switchSession()`)**: `agent-session.ts:9770-9970`. Reads target file, builds session context from the branch, calls `agent.replaceMessages(displayContext.messages)`. Old messages replaced.
- **Effect on earlier message indices**: All earlier indices from the previous session are discarded.
- **Does `leafId` change?**: YES, set to the leaf of the loaded session or `null`.

### 9. Message Edit / Delete / Retry
- **Retry (`/retry`, `TurnRecovery.retry()`)**: `packages/coding-agent/src/session/turn-recovery.ts:2767-2843`.
  - Drops the failed assistant turn and synthetic results: `this.#host.agent.replaceMessages(messages.slice(0, activeTurnEnd - 1))` (`turn-recovery.ts:2779`).
  - Or for tool replay: `this.#host.sessionManager.branch(anchorEntry.id)` and `this.#host.agent.replaceMessages(messages.slice(0, replayStart))` (`turn-recovery.ts:2842`).
  - **Effect on earlier message indices**: Suffix of `messages` is truncated. Indices before the cut point are unchanged.
  - **Does `leafId` change?**: YES, moves back to `anchorEntry.id`.
- **Durable Discard / Delete (`discardEntryDurably`)**: `SessionManager.discardEntryDurably(entryId)` (`session-manager.ts:3187-3205`). Reparents children or cuts branch and appends a branch marker. Rebuilds `#index` and updates leaf.

### 10. Fork (`/fork`, `agentSession.fork()`)
- **Where**: `agent-session.ts:8651-8719` and `session-manager.ts:1913-1960`.
- **Effect on earlier message indices**: NONE. Clones session file and assigns new session ID; in-memory messages array and indices remain identical.
- **Does `leafId` change?**: NO.

### Summary: Does `leafId` change on every append?
- On all standard linear appends (`appendMessage`, `appendThinkingLevelChange`, `appendServiceTierChange`, `appendModeChange`, `appendModelChange`, `appendSessionInit`, `appendCompaction`, `appendResetBoundary`, `appendCustomEntry`, `appendCustomMessageEntry`, `appendTtsrInjection`, `appendCredentialPin`, `appendLabelChange`): **YES**, `SessionEntryIndex.insert()` sets `this.#leaf = entry.id`.
- Exceptions where `leafId` does NOT change on append:
  1. `SessionManager.appendModelUsage()` (`session-manager.ts:2816-2837`): records entry on owner's branch and explicitly restores `activeLeafId` (`if (activeLeafId !== owner.parentId) this.#index.setLeaf(activeLeafId)`).
  2. `SessionManager.appendMessageToBranch()` (`session-manager.ts:2791-2813`): records entry on specified branch and explicitly restores `this.#index.setLeaf(activeLeafId)`.

---

## 3. Streaming Events Emitted Over RPC & Serialization Cost

### Event Types and Fields Carried
Defined in `packages/agent/src/types.ts:1148-1170` and `packages/coding-agent/src/session/agent-session-events.ts:13-68`:

1. **`message_start`** (`types.ts:1162`):
   - Fields: `{ type: "message_start", message: AgentMessage }`
   - Emitted for user messages, assistant messages (when provider stream begins), and tool results.
   - Frequency: Once per message.
2. **`message_update`** (`types.ts:1164`):
   - Fields: `{ type: "message_update", message: AgentMessage, assistantMessageEvent: AssistantMessageEvent }`
   - Only emitted for assistant messages during streaming.
   - **Crucial observation**: `message` carries the **FULL accumulated snapshot** of the assistant message up to this token (`snapshotAssistantMessage(partialMessage)` in `agent-loop.ts:2153`). Furthermore, `assistantMessageEvent` also embeds another copy: `{ ...event, partial: messageSnapshot }` (`agent-loop.ts:477-487`).
   - The delta is in `assistantMessageEvent`: e.g. `{ type: "text_delta", contentIndex: number, delta: string }`, `{ type: "thinking_delta", contentIndex: number, thinking: string }`, or `{ type: "toolcall_delta", contentIndex: number, delta: string }`.
   - Frequency: **Fired on every single token / SSE chunk** from the LLM provider (often 20–100+ times/second).
3. **`message_end`** (`types.ts:1165`):
   - Fields: `{ type: "message_end", message: AgentMessage }`
   - Emitted once when message stream finishes.
   - Frequency: Once per message.
4. **Tool execution events** (`types.ts:1167-1170`):
   - `tool_execution_start`: `{ type: "tool_execution_start", toolCallId: string, toolName: string, args: any, intent?: string }` (once per tool call).
   - `tool_execution_update`: `{ type: "tool_execution_update", toolCallId: string, toolName: string, args: any, partialResult: any }` (streamed chunks from tools like bash).
   - `tool_stream_update`: `{ type: "tool_stream_update", toolCallId: string, toolName: string, update: unknown }`.
   - `tool_execution_end`: `{ type: "tool_execution_end", toolCallId: string, toolName: string, result: any, isError?: boolean }` (once per tool call).
5. **Turn lifecycle events** (`types.ts:1159-1160`):
   - `turn_start`: `{ type: "turn_start" }` (once per turn).
   - `turn_end`: `{ type: "turn_end", message: AgentMessage, toolResults: ToolResultMessage[] }` (once per turn).
6. **Agent lifecycle events** (`types.ts:1150-1157`):
   - `agent_start`: `{ type: "agent_start" }` (once per prompt run).
   - `agent_end`: `{ type: "agent_end", messages: AgentMessage[], telemetry?: AgentRunSummary, coverage?: AgentRunCoverage, isTerminal?: boolean }` (once per prompt run). Carries the complete messages array.

### Serialization Pipeline and Per-Frame Cost
- Pipeline:
  1. `session.subscribe(event => output(event))` (`packages/coding-agent/src/modes/rpc/rpc-server.ts:1083-1085`).
  2. `output` calls `outputWriter.write(frameEncoder.encodeFrames(obj))` (`rpc-server.ts:1063`).
  3. `RpcFrameEncoder.encodeFrames(frame: object)` (`packages/coding-agent/src/modes/rpc/rpc-frame.ts:288-318`):
     - Line 290: `const json = JSON.stringify(frame);` -> **Every frame is stringified unconditionally!**
     - Line 304: Calls `encodeRpcFrameFromJson(frame, json, ...)`:
       - If `serializedFrameBytes(json) <= MAX_RPC_FRAME_BYTES` (1 MiB), returns `${json}\n`.
       - If > 1 MiB and v1: tries `compactTerminalFrame`, then up to 7 passes of lossy shrinking (`SHRINK_PASSES` in `rpc-frame.ts:29-37`), then `overflowFrame`.
       - If > 1 MiB and v2: calls `encodeChunkedRpcFrames` (`rpc-frame.ts:94-118`), breaking payload into 256 KiB base64 chunks (`type: "rpc_chunk"`).
  4. `compactTerminalFrame` (`rpc-frame.ts:192-216`):
     - Only applies to `frame.type === "agent_end"`.
     - Compares messages with `streamedMessages` recorded during `message_end` events, and strips already-streamed messages from the terminal frame: `messages: frame.messages.slice(streamed)`.
  5. `encodedMessageSnapshot` (`rpc-frame.ts:81-86`):
     - On `frame.type === "message_end"`, parses the frame and caches the message in `#streamedMessages` to support subsequent `compactTerminalFrame` on `agent_end`.
  6. `RpcOutputWriter` (`packages/coding-agent/src/modes/rpc/rpc-output.ts:17-161`):
     - Writes newline-delimited JSON lines to stdout / Unix socket.
     - If consumer is slow and the writable stream applies backpressure (`#blocked = true`), spools unwritten lines to a temporary disk file (`TempDir.createSync("@omp-rpc-output-")`, `rpc-output.ts:72`) and pumps from disk on `"drain"`.

### Per-Frame Cost: The $O(N^2)$ Resend Problem
- In `message_update`, **the FULL accumulated message is re-sent on every token delta**:
  - `frame.message` contains the entire message object so far.
  - `frame.assistantMessageEvent.partial` contains a second copy of the entire message object so far.
  - `JSON.stringify(frame)` stringifies the entire growing message on **every single token**.
- **Quantification**:
  For an assistant response of 2,000 tokens (~8 KB text, ~12 KB JSON):
  - 2,000 `message_update` frames are generated and stringified.
  - Frame 1: ~300 bytes.
  - Frame 1,000: ~6 KB.
  - Frame 2,000: ~12 KB.
  - Average frame size: ~6 KB.
  - Total data stringified and transmitted over the wire: $2,000 \times 6\text{ KB} \approx \mathbf{12\text{ MB}}$ of JSON frames across Unix socket, daemon relay, and browser WebSocket — all to deliver an 8 KB text response!

---

## 4. Protocol Version Handshake

### How Client and Server Select Protocol Version
- **Default server version**: Server starts with `frameEncoder.setProtocolVersion(1)` (default in `RpcFrameEncoder` `#protocolVersion: RpcProtocolVersion = 1`, `packages/coding-agent/src/modes/rpc/rpc-frame.ts:274`).
- **Server `ready` frame** (`rpc-server.ts:1053-1060`):
  Emitted immediately when RPC server starts up on stdout / socket:
  ```json
  {
    "type": "ready",
    "protocolVersion": 1,
    "supportedProtocolVersions": [1, 2],
    "maxFrameBytes": 1048576,
    "maxReassembledFrameBytes": 67108864
  }
  ```
- **Client negotiation** (`rpc-client.ts:372-375, 448-460`):
  1. Client reads `ready` frame; checks `supportsRpcProtocolV2(line)` (`supportedProtocolVersions.includes(2)`).
  2. Client sends:
     ```json
     { "type": "negotiate_protocol", "protocolVersion": 2 }
     ```
  3. Server command handler (`rpc-server.ts:1125-1133`):
     ```ts
     case "negotiate_protocol": {
         if (command.protocolVersion !== 2)
             return errorResponse(id, "negotiate_protocol", `Unsupported RPC protocol version: ${command.protocolVersion}`);
         return success(id, "negotiate_protocol", { protocolVersion: 2 });
     }
     ```
  4. Server output hook (`rpc-server.ts:1064-1065`):
     ```ts
     if (isRecord(obj) && obj.type === "response" && obj.command === "negotiate_protocol" && obj.success === true)
         frameEncoder.setProtocolVersion(2);
     ```
  5. Client sets its own `this.#protocolVersion = 2` (`rpc-client.ts:459`).

### What Protocol v2 Changes
- **v1 frame limit behavior**: Single frames cannot exceed `MAX_RPC_FRAME_BYTES = 1024 * 1024` (1 MiB). If an un-compacted frame exceeds 1 MiB, v1 runs 7 passes of lossy truncation (`SHRINK_PASSES`), eliding string characters and array/object entries, and falls back to an `overflowFrame` (`type: "rpc_frame_error"`).
- **v2 chunking behavior**: When a frame exceeds 1 MiB, v2 encodes the payload as binary chunks (`RPC_CHUNK_PAYLOAD_BYTES = 256 * 1024` = 256 KiB) base64-encoded in `RpcChunkFrame`s (`rpc-frame.ts:103-112`):
  `{ type: "rpc_chunk", chunkId, index, count, byteLength, data }`.
  The receiver (`RpcFrameDecoder`, `rpc-frame.ts:137-189`) reassembles the chunks in memory up to `MAX_RPC_REASSEMBLED_BYTES = 64 * 1024 * 1024` (64 MiB).

### Where Protocol v3 Would Plug In
1. `RpcProtocolVersion` union: `1 | 2 | 3` in `packages/coding-agent/src/modes/rpc/rpc-frame.ts:12`.
2. `ready` frame: `supportedProtocolVersions: [1, 2, 3]` in `packages/coding-agent/src/modes/rpc/rpc-server.ts:1057`.
3. `negotiate_protocol` command: accept `command.protocolVersion === 2 || command.protocolVersion === 3` in `rpc-server.ts:1126`.
4. Output tap: `frameEncoder.setProtocolVersion(command.protocolVersion)` in `rpc-server.ts:1065`.
5. `RpcFrameEncoder`: implement v3 framing in `rpc-frame.ts:288` (emitting streaming token deltas without re-sending full message snapshots).
6. Client negotiation: `packages/coding-agent/src/modes/rpc/rpc-client.ts:451` and browser `packages/webgui/src/lib/rpc-client.ts`.

---

## 5. Existing Pager (`rpc-messages.ts`) and `get_messages`

### Limits Constants
Defined in `packages/coding-agent/src/modes/rpc/rpc-messages.ts:4-7`:
- `DEFAULT_RPC_MESSAGE_PAGE_LIMIT = 100` messages
- `MAX_RPC_MESSAGE_PAGE_LIMIT = 256` messages
- `MAX_RPC_MESSAGE_PAGE_BYTES = 768 * 1024` (768 KiB wire budget per page)
- `MAX_RPC_MESSAGE_CURSOR_CHARS = 2048` characters

### Cursor Structure & Encoding
- `RpcMessageSnapshot` (`rpc-messages.ts:26-30`): `{ sessionId: string; leafId: string | null; messageCount: number }`
- `RpcMessageCursorPayload` (`rpc-messages.ts:38-41`): `{ version: 1; sessionId: string; leafId: string | null; messageCount: number; offset: number }`
- Cursor is serialized to JSON and encoded as `base64url` (`rpc-messages.ts:48-51`).

### Paging Behavior & Direction
- `pageRpcMessages` (`rpc-messages.ts:93-127`) pages **OLDEST-FIRST** (offset starts at 0, increments by page length).
- Byte budget enforcement (`rpc-messages.ts:112-119`):
  Starts with `pageBytes = 2` (accounting for JSON array brackets `[]`).
  For each message: `messageBytes = Buffer.byteLength(JSON.stringify(message), "utf8") + (page.length === 0 ? 0 : 1)`.
  If `page.length > 0 && pageBytes + messageBytes > MAX_RPC_MESSAGE_PAGE_BYTES`, paging halts for this page and returns `nextCursor`.
  If an individual message alone exceeds 768 KiB, it is emitted solo (since `page.length === 0`).

### Busy Refusal & Stale Cursor
- In `rpc-server.ts:1621-1645`:
  `get_messages_page`:
  ```ts
  if (session.isStreaming || session.isCompacting)
      return errorResponse(id, "get_messages_page", RPC_MESSAGES_PAGE_BUSY_ERROR, "session_busy");
  ```
  Refuses immediately with code `"session_busy"` if `session.isStreaming` or `session.isCompacting`.
  If `sessionId`, `leafId`, or `messageCount` differs from the cursor snapshot when the next page arrives, `decodeCursor`/`sameSnapshot` throws `RpcMessagesPageError("RPC message cursor is stale", "stale_cursor")` (`rpc-messages.ts:84-90, 106-107`).
- In `rpc-client.ts:260-265, 925-928`:
  When a client receives `"session_busy"` or `"stale_cursor"`, it discards partial pages and falls back to `get_messages`.
- `get_messages` (`rpc-server.ts:1617-1619`):
  `return success(id, "get_messages", { messages: session.messages });`
  **Does NOT check busy flags**; returns the entire array in one unpaged frame regardless of size or session state.

---

## 6. Session-Change Frames (`handleRpcSessionChange`) and What They Carry

### Commands Handled
In `packages/coding-agent/src/modes/rpc/rpc-server.ts:595-621, 1228-1232`:
Commands: `new_session`, `switch_session`, `branch`.

### Payload Carried by Session-Change Responses
Defined in `packages/coding-agent/src/modes/rpc/rpc-types.ts:446, 578-579`:
1. `new_session`:
   - Request: `{ id?: string; type: "new_session"; parentSession?: string }`
   - Response: `{ id?: string; type: "response"; command: "new_session"; success: true; data: { cancelled: boolean } }`
2. `switch_session`:
   - Request: `{ id?: string; type: "switch_session"; sessionPath: string }`
   - Response: `{ id?: string; type: "response"; command: "switch_session"; success: true; data: { cancelled: boolean } }`
3. `branch`:
   - Request: `{ id?: string; type: "branch"; entryId: string }`
   - Response: `{ id?: string; type: "response"; command: "branch"; success: true; data: { text: string; cancelled: boolean } }`

### Side Effects and Broadcast Frames
When `!result.data.cancelled`:
1. `subagentRegistry?.clear()` is called (`rpc-server.ts:604, 610, 616`).
2. `emitAvailableCommandsUpdate()` emits an `available_commands_update` frame:
   `{ type: "available_commands_update", commands: SlashCommandInfo[] }` (`rpc-server.ts:1114, 1230`).
3. If the model changed on session switch: `{ type: "model_changed" }` is emitted (`agent-session.ts:9204, 10090`).
4. If advisor costs were restored: `{ type: "advisor_cost_changed" }` is emitted (`agent-session.ts:11679`).
5. **What is NOT carried**:
   The response frames **DO NOT carry the new messages, new `sessionId`, new `leafId`, or new message count**. The client must independently issue follow-up commands (`get_state`, `get_messages`, etc.) to discover the new session identity, leaf ID, and transcript.

---

## 7. Implications for Protocol v3

1. **Eliminate the $O(N^2)$ streaming blowup**: Protocol v3 must change `message_update` to emit *only* incremental token deltas (`delta: string` or new content blocks) instead of serializing the full `message` object and `assistantMessageEvent.partial` per token, slashing streaming RPC payload size by ~99% on long messages.
2. **Stable message indices require an explicit `epoch`**: Because `session.messages` is an array that is completely rewritten during compaction (discarding messages prior to `firstKeptEntryId`) or branch switching, a message index $i$ is only meaningful within a specific `epoch`. The `epoch` must change whenever prior indices are invalidated.
3. **Invert pagination to newest-first**: The existing `pageRpcMessages` traverses oldest-first (offset 0 forward), requiring clients to fetch the entire history just to display the latest messages. v3 must page newest-to-oldest from the active leaf backward.
4. **Relax the busy refusal in paging**: `get_messages_page` currently fails immediately with `"session_busy"` if streaming or compaction is active. Because `session.messages` is append-only during streaming, newest-first paging can safely read committed messages even while a new turn is streaming.
5. **Decouple cursors from volatile message counts**: Current paging cursors invalidate on *any* change to `messageCount` or `leafId`. In v3, a cursor pinned to `(epoch, messageIndex)` or entry UUID remains valid for historical reads even as new messages are appended at the end.
6. **Enrich session-change responses**: `new_session`, `switch_session`, and `branch` responses currently only return `{ cancelled: boolean }`. Protocol v3 should return `{ sessionId, leafId, epoch, totalMessages }` in the response frame so clients can immediately initialize history without racing `get_state`.
7. **Clean handshake extension**: Protocol negotiation already supports multiple versions via the `ready` frame's `supportedProtocolVersions: [1, 2]` and `negotiate_protocol` command. Protocol v3 can be added cleanly as version `3` without breaking backwards compatibility with v1 and v2 clients.
8. **Bridge SessionEntry vs AgentMessage distinction**: Session storage tracks 16 `SessionEntry` types in a tree with `leafId`, whereas `session.messages` only contains active transcript `AgentMessage`s. Protocol v3 transcript models must remain clear on whether indices address `SessionEntry`s on disk or `AgentMessage`s in memory.
