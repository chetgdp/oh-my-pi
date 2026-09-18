> Research note, 2026-09-24, written by a subagent for the v3 design in
> `../PIPELINE.md`. Line numbers are as of that date. PIPELINE.md wins
> where they differ. Implication 2 (index assigned at `message_start`) is
> rejected: messages finish out of order, so v3 uses a stream id until
> the message is committed.

# Browser (Output) End Research: RPC Protocol Analysis

**Target**: `packages/webgui/src`
**Scope**: Document what the browser holds and consumes to render a session transcript for RPC Protocol v3.
**Date**: 2026-09-24

---

## 1. Every RPC Frame Type the Webgui Consumes

The browser receives frames via WebSocket in `packages/webgui/src/lib/rpc-client.ts`. Lines arrive as NDJSON, are buffered, split by newline (`rpc-client.ts:274-278`), and parsed as JSON (`rpc-client.ts:284`).

### 1.1 Connection & Framing Frames

| Frame Type | Code Location | Fields Read | Fields Ignored | State Updated / Action Taken |
|---|---|---|---|---|
| `ready` (initial) | `rpc-client.ts:290-305` | `type` (matched === `"ready"`) | `protocolVersion`, `supportedProtocolVersions`, `maxFrameBytes` (`rpc-types.ts:379-382`) | Sets `readyReceived = true`, initiates `#runAttachSequence(isReconnect)`. |
| `ready` (subsequent) | `rpc-client.ts:465` | `type` | All other fields | Ignored as informational. |
| `rpc_chunk` | `rpc-client.ts:120-181` | `chunkId`, `index`, `count`, `byteLength`, `data` | None (all metadata strictly validated against declared limits) | Decodes base64 payload (`atob`), verifies chunk sequence and lengths, reassembles bytes, decodes UTF-8 (`TextDecoder`), and parses the inner JSON frame (`rpc-client.ts:178-179`). |
| `response` (success) | `rpc-client.ts:445-460` | `id`, `command`, `data`, `success` | None | Locates pending request in `#pending` Map by string `id`, cancels timeout timer, resolves Promise with `resp` (`rpc-client.ts:456`). |
| `response` (error) | `rpc-client.ts:445-455` | `id`, `command`, `error`, `code`, `success` | None | Locates pending request by `id`, cancels timeout timer, rejects Promise with `RpcCommandError(command, error, code)` (`rpc-client.ts:454`). |

### 1.2 Event Frames (`RpcSessionEventFrame`)

Dispatched to event listeners via `rpc-client.ts:468`. Consumed in `session-store.ts`, `transcript-model.ts`, and `subagent-model.ts`.

| Event Type | Handler Location | Fields Read | Fields Ignored | State Updated / Action Taken |
|---|---|---|---|---|
| `agent_start` | `session-store.ts:285-287`<br>`transcript-model.ts:216-217` | `type` | None | `sessionState.isStreaming = true` (`session-store.ts:286`).<br>`transcript.working = true` (`transcript-model.ts:217`). |
| `agent_end` | `session-store.ts:288-290, 361-365`<br>`transcript-model.ts:219-220` | `type` | `messages`, `telemetry`, `coverage` (`agent/src/types.ts:1153-1156`) | `sessionState.isStreaming = false` (`session-store.ts:289`).<br>`transcript.working = false` (`transcript-model.ts:220`).<br>Triggers `scheduleStatsRefresh()` (debounced 500ms -> `get_session_stats`), `fetchSessionState()` (`get_state`), `fetchSubagents()` (`get_subagents`) (`session-store.ts:362-364`). |
| `turn_start` | `transcript-model.ts:262-267` | `type` | None | `transcript.stream = null`, `transcript.streamDone = false` (`transcript-model.ts:265-266`). |
| `turn_end` | `session-store.ts:361-365`<br>`transcript-model.ts:269-270` | `type` | `message`, `toolResults` (`agent/src/types.ts:1160`) | `transcript.stream = null`, `transcript.streamDone = false` (`transcript-model.ts:270`).<br>Triggers debounced stats refresh, `get_state`, `get_subagents` (`session-store.ts:362-364`). |
| `message_start` | `transcript-model.ts:222-232` | `event.message.role`, `event.message` (`toWireAssistant`) | All fields if `role !== "assistant"` | If `role === "assistant"`: `transcript.stream = toWireAssistant(msg)`, `transcript.streamDone = false` (`transcript-model.ts:227-228`). |
| `message_update` | `transcript-model.ts:234-240` | `event.message.role`, `event.message` (`toWireAssistant`) | **CRITICAL: `event.assistantMessageEvent` (the streaming token delta!) is COMPLETELY IGNORED.** | If `role === "assistant"`: replaces entire `transcript.stream` object with re-converted `toWireAssistant(msg)` (`transcript-model.ts:237`). |
| `message_end` | `transcript-model.ts:242-260` | `event.message.role`, `event.message` | Any custom fields not in `SessionEntry` | If role is `"assistant"`, `"user"`, or `"toolResult"`: commits entry via `messageToEntry(msg, entries.length)` to `transcript.entries` (`transcript-model.ts:247`). If `"assistant"`: clears `stream = null`, sets `streamDone = true` (`transcript-model.ts:251`). If `"user"`: pops one `pendingUser` item (`transcript-model.ts:254`). |
| `tool_execution_start` | `transcript-model.ts:272-288` | `toolCallId`, `toolName`, `args`, `intent` | None | Inserts into `transcript.activeTools` Map: `{ toolCallId, toolName, args, intent, startedAt: Date.now() }` (`transcript-model.ts:280-286`). |
| `tool_execution_update` | `transcript-model.ts:290-305` | `toolCallId`, `partialResult` | `toolName`, `args` (`agent/src/types.ts:1168`) | Updates `partialResult` of existing tool in `transcript.activeTools` (`transcript-model.ts:302`). |
| `tool_execution_end` | `transcript-model.ts:307-313` | `toolCallId` | `toolName`, `result`, `isError` (**The result payload is ignored here; webgui waits for `message_end` with role `"toolResult"` to record the result**) | Deletes `toolCallId` from `transcript.activeTools` (`transcript-model.ts:311`). |
| `command_output` | `transcript-model.ts:314-333` | `text` | None | Creates synthetic developer `SessionEntry` with `id: cmd-out-${entries.length}-${Date.now()}` and appends to `transcript.entries` (`transcript-model.ts:316-330`). Consumes one `pendingUser` item if present (`transcript-model.ts:331`). |
| `prompt_result` | `transcript-model.ts:335-341` | `agentInvoked` | `id` | If `!agentInvoked` and `pendingUser.length > 0`: removes oldest prompt via `pendingUser.slice(1)` (`transcript-model.ts:337-339`). |
| `auto_compaction_start` | `session-store.ts:291-293` | `type` | `reason`, `action` (`agent-session-events.ts:20-23`) | `sessionState.isCompacting = true` (`session-store.ts:292`). |
| `auto_compaction_end` | `session-store.ts:294-296` | `type` | `action`, `result`, `aborted`, `willRetry`, `errorMessage`, `skipped` (`agent-session-events.ts:25-33`) | `sessionState.isCompacting = false` (`session-store.ts:295`). |
| `available_commands_update` | `session-store.ts:281-283` | `commands` | None | Updates `commands = frame.commands` (`session-store.ts:282`). |
| `session_info_update` | `session-store.ts:366-371` | `type` | `title`, `sessionId` (`rpc-types.ts:314-315`) (**Payload completely ignored**) | Triggers `fetchSessionState()` (`get_state`) (`session-store.ts:371`). |
| `model_changed` | `session-store.ts:366-375` | `type` | None | Triggers `fetchSessionState()` (`get_state`) and `fetchRoles()` (`get_model_roles`) (`session-store.ts:371-374`). |
| `thinking_level_changed` | `session-store.ts:366-371` | `type` | `thinkingLevel`, `configured`, `resolved` (`agent-session-events.ts:61-67`) (**Payload completely ignored**) | Triggers `fetchSessionState()` (`get_state`) (`session-store.ts:371`). |
| `config_update` | `session-store.ts:376-383` | `models`, `modelRoles`, `model`, `agents` | `thinkingLevel` (`rpc-types.ts:321`) | Triggers `fetchSessionState()`; conditionally calls `fetchRoles()`, `fetchBrowser()`, `fetchAgentsConfig()`, `fetchLoginStatus()` (`session-store.ts:377-382`). |
| `login_event` | `session-store.ts:298-354` | `loginId`, `event.kind`, `event.url`, `event.instructions`, `event.message`, `event.requestId`, `event.placeholder`, `event.secret`, `event.allowEmpty`, `event.identity`, `event.error`, `event.cancelled` | None | Updates `login` flow state (`session-store.ts:303-352`). |
| `subagent_lifecycle` | `subagent-model.ts:61-90` | `payload.id`, `payload.status`, `payload.description`, `payload.agent`, `payload.parentToolCallId`, `payload.sessionFile` | None | Updates/inserts `SubagentNode` in `subagents.agents` Map with mapped status (`running`, `parked`, `aborted`) (`subagent-model.ts:83-89`). |
| `subagent_progress` | `subagent-model.ts:92-128` | `payload.progress.id`, `payload.progress.status`, `payload.agent`, `payload.parentToolCallId`, `payload.sessionFile`, `payload.task`, `payload.assignment` | None | Updates/inserts `SubagentNode` in `subagents.agents` Map with progress payload (`subagent-model.ts:121-127`). |
| `subagent_event` | `subagent-model.ts:130-138` | None | Entire frame | **Ignored** (falls to `default: return state;`). |
| `tool_stream_update` | `transcript-model.ts:343` | None | Entire frame (`toolCallId`, `toolName`, `update`) | **Ignored** (falls to `default: return state;`). |
| `extension_ui_request` | N/A | None | Entire frame | **Unimplemented in webgui** (no handler exists). |
| `notice`, `irc_message`, `todo_reminder`, `todo_auto_clear`, `goal_updated`, `auto_retry_start`, `auto_retry_end`, `retry_fallback_applied`, `retry_fallback_succeeded` | `session-store.ts:357-358`<br>`transcript-model.ts:343` | None | All fields | **Ignored** by webgui reducers. |

### 1.3 Command Request/Response Frames (`RpcCommand` and `RpcResponse`)

Initiated by the webgui either automatically or via user actions (`packages/webgui/src/lib/rpc-client.ts`, `session-store.ts`, `session-actions.ts`).

| Command Sent | Initiator & Location | Response Fields Read | Response Fields Ignored | State Updated / Action Taken |
|---|---|---|---|---|
| `negotiate_protocol` (`{ protocolVersion: 2 }`) | `rpc-client.ts:417-420` | `success`, `data.protocolVersion` | None | Completes handshake with server. |
| `get_state` | `rpc-client.ts:422-426`<br>`session-store.ts:191-196` | `data` (`RpcSessionState`) | None | Updates `client.#sessionState` (`rpc-client.ts:425`), `sessionStore.sessionState` (`session-store.ts:194`). |
| `get_messages` | `rpc-client.ts:427-430` | `data.messages` (`AgentMessage[]`) | None | Stores `client.#messages` (`rpc-client.ts:430`), initializes `transcript = transcriptFromMessages(messages)` (`session-store.ts:101, 393`). |
| `set_subagent_subscription` (`{ level: "progress" }`) | `rpc-client.ts:433` | None (`.catch(() => {})`) | Entire response payload | Starts subagent event push from server. |
| `get_session_stats` | `session-store.ts:150-155` | `data` (`SessionStats`) | None | Updates `sessionStore.stats` (`session-store.ts:153`). |
| `get_available_commands` | `session-store.ts:164-169` | `data.commands` (`RpcAvailableSlashCommand[]`) | None | Updates `sessionStore.commands` (`session-store.ts:167`). |
| `get_subagents` | `session-store.ts:178-183` | `data.subagents` (`RpcSubagentSnapshot[]`) | None | Rebuilds `sessionStore.subagents` via `subagentTreeFromSnapshots` (`session-store.ts:181`). |
| `get_model_roles` | `session-store.ts:205-210` | `data` (`RpcModelRolesResult`) | None | Updates `sessionStore.roles` (`session-store.ts:208`). |
| `get_agents` | `session-store.ts:219-224` | `data` (`RpcAgentsResult`) | None | Updates `sessionStore.agents` (`session-store.ts:222`). |
| `get_model_browser` | `session-store.ts:233-238` | `data` (`RpcModelBrowserResult`) | None | Updates `sessionStore.browser` (`session-store.ts:236`). |
| `get_login_status` | `session-store.ts:247-252` | `data` (`RpcLoginStatusResult`) | None | Updates `sessionStore.loginStatus` (`session-store.ts:250`). |
| `prompt` | `session-actions.ts:32-43`<br>`App.tsx:260-264` | `data.agentInvoked` | None | If `data.agentInvoked === false`: clears pending prompt (`App.tsx:261-263`). |
| `steer` | `session-actions.ts:45-52` | `success` | None | Dispatches steering prompt. |
| `follow_up` | `session-actions.ts:54-61` | `success` | None | Dispatches follow-up prompt. |
| `abort` | `session-actions.ts:63-65` | `success` | None | Aborts running turn. |
| `set_model` | `session-actions.ts:71-78` | `success`, `data` | None | Changes active model. |
| `set_thinking_level` | `session-actions.ts:83-88` | `success` | None | Changes thinking level. |
| `set_model_role` | `session-actions.ts:118-125` | `data` (`RpcModelRole`) | None | Updates model role mapping. |
| `delete_model_role` | `session-actions.ts:127-129` | `data` (`RpcModelRolesResult`) | None | Deletes custom role. |
| `set_cycle_order` | `session-actions.ts:131-133` | `data` (`RpcModelRolesResult`) | None | Reorders model cycling sequence. |
| `set_model_tag` | `session-actions.ts:135-141` | `data` (`RpcModelRolesResult`) | None | Sets tag on model. |
| `refresh_models` | `session-actions.ts:147-149` | `data` (`RpcModelBrowserResult`) | None | Refreshes provider models. |
| `cycle_role_model` | `session-actions.ts:151-158` | `data` (`RpcRoleCycleResult`) | None | Cycles model for active role. |
| `set_agent_model` | `session-actions.ts:164-170` | `data` (`RpcAgentInfo`) | None | Sets agent model override. |
| `set_agent_enabled` | `session-actions.ts:172-178` | `data` (`RpcAgentInfo`) | None | Enables/disables agent. |
| `set_agent_service_tier` | `session-actions.ts:180-186` | `data` (`RpcAgentInfo`) | None | Sets agent service tier. |
| `set_agent_prewalk` | `session-actions.ts:188-194` | `data` (`RpcAgentInfo`) | None | Sets agent prewalk configuration. |
| `set_agent_advisor` | `session-actions.ts:196-202` | `data` (`RpcAgentInfo`) | None | Sets agent advisor configuration. |
| `login_start` | `session-actions.ts:208-210` | `data.loginId` | None | Starts interactive login flow. |
| `login_input` | `session-actions.ts:212-219` | `success` | None | Sends input (passcode/credential) for login. |
| `login_cancel` | `session-actions.ts:221-223` | `success` | None | Cancels active login flow. |
| `logout` | `session-actions.ts:225-231` | `data.providerId` | None | Logs out of provider. |
| `get_messages_page` | `session-actions.ts:98-108` | (Wrapped only) | N/A | **NO CALLERS anywhere in webgui application code.** |

---

## 2. Transcript State Shape

### 2.1 State Structure
Defined in `packages/webgui/src/lib/transcript-model.ts:34-47`:
```ts
export interface TranscriptState {
	entries: readonly SessionEntry[];
	stream: WireAssistantMessage | null;
	streamDone: boolean;
	activeTools: ReadonlyMap<string, ActiveTool>;
	working: boolean;
	pendingUser: readonly string[];
}
```

### 2.2 Row / Entry Kinds
The transcript is rendered by projecting `TranscriptState` into flattened `RowItem`s in `packages/webgui/src/components/transcript/Transcript.tsx:92-102`:

1. `UserItem` (`Transcript.tsx:20-26`): `kind: "user"`. Renders `UserRow` with `content: string | unknown[]`, `timestamp`, and `pending?: boolean`.
2. `AssistantTextItem` (`Transcript.tsx:28-32`): `kind: "assistant-text"`. Renders markdown text in an assistant bubble via `Markdown.tsx`.
3. `AssistantImageItem` (`Transcript.tsx:34-38`): `kind: "assistant-image"`. Renders inline base64 image (`Transcript.tsx:298-310`).
4. `ThinkingItem` (`Transcript.tsx:40-45`): `kind: "thinking"`. Renders collapsible thinking block via `ThinkingRow.tsx` (`text`, `redacted`).
5. `ToolCallItem` (`Transcript.tsx:47-58`): `kind: "tool-call"`. Renders `ToolCard.tsx` (`toolCallId`, `name`, `args`, `intent`, `result`, `running`, `partialResult`, `startedAt`).
6. `DeveloperItem` (`Transcript.tsx:60-65`): `kind: "developer"`. Renders system/developer outputs via `DeveloperRow.tsx` (`content`, `timestamp`).
7. `DividerItem` (`Transcript.tsx:67-72`): `kind: "divider"`. Compaction notices (`context compacted -- N tokens`) and branch summaries (`Transcript.tsx:147-162`).
8. `MarkerItem` (`Transcript.tsx:74-78`): `kind: "marker"`. Model changes (`model: <model>`) and thinking level changes (`thinking: <level>`) (`Transcript.tsx:163-176`).
9. `StopItem` (`Transcript.tsx:80-85`): `kind: "stop"`. Rendered when an assistant message ends with `stopReason === "error"` or `"aborted"` (`Transcript.tsx:271-279`).
10. `ShimmerItem` (`Transcript.tsx:87-90`): `kind: "shimmer"`. Animated "thinking..." placeholder when `(working || pendingUser.length > 0) && stream === null && activeTools.size === 0` (`Transcript.tsx:212-214`).

### 2.3 Row Identity & Keys (Virtualization Keys)
In `Transcript.tsx:498`, the TanStack virtualizer keys each row with `key={item.id}`:
- **Committed user/developer/marker/divider entries**: `item.id = entry.id` (`Transcript.tsx:126, 140, 152, 160, 167, 174`).
  In `transcript-model.ts:113` (`messageToEntry`):
  `const id = String("id" in msg ? msg.id : index);`
  Standard `AgentMessage` objects do NOT carry an `id` property. Thus `entry.id` is the stringification of the index: `"0"`, `"1"`, `"2"`...
  Newly committed entries during streaming (`message_end`, `transcript-model.ts:245`) receive `id: String(state.entries.length)`.
  Developer entries created from `command_output` (`transcript-model.ts:316`) receive `id: "cmd-out-${state.entries.length}-${Date.now()}"`.
- **Assistant blocks**: `baseId` is `entry.id` (e.g. `"42"`) for committed messages, but `"stream"` for the active streaming message (`Transcript.tsx:182`).
  - Thinking blocks: `${baseId}-t${i}` or `${baseId}-rt${i}` (`Transcript.tsx:231, 234`)
  - Text blocks: `${baseId}-txt${i}` (`Transcript.tsx:237`)
  - Tool calls: `${baseId}-tc-${block.id}` (`Transcript.tsx:252`)
  - Image blocks: `${baseId}-img${i}` (`Transcript.tsx:263`)
  - Stop block: `${baseId}-stop` (`Transcript.tsx:277`)
- **Tail tools** (tools in `activeTools` not yet present in assistant content):
  `id: "tail-${tool.toolCallId}"` (`Transcript.tsx:202`).
- **Pending user prompts**:
  `id: "pending-${i}"` (`Transcript.tsx:208`), where `i` is the array index in `pendingUser`.
- **Shimmer**:
  `id: "shimmer"` (`Transcript.tsx:213`).

### 2.4 Ordering
`flattenEntries` (`Transcript.tsx:113-216`) concatenates rows in strict sequence:
1. Committed entries (`entries[0]` through `entries[N-1]`) in array order (`Transcript.tsx:116`).
   - If `entry.message.role === "assistant"`: unpacked into thinking blocks, text blocks, tool call blocks in the exact order of `msg.content`, followed by an optional stop block (`Transcript.tsx:130, 219-280`).
   - `toolResult` entries are **filtered out** from the main sequence (`Transcript.tsx:143`) and merged into their corresponding `tool-call` item via the `results` lookup Map (`Transcript.tsx:378-386`).
2. Streaming assistant message (`stream`), if not null (`Transcript.tsx:181-183`), unpacked using `baseId = "stream"`.
3. Tail active tools not yet rendered in `entries` or `stream`, in `activeTools.values()` iteration order (`Transcript.tsx:191-205`).
4. Pending user messages (`pendingUser[0]` through `pendingUser[M-1]`) in submission order (`Transcript.tsx:207-209`).
5. Shimmer item (if active and nothing else visible) (`Transcript.tsx:212-214`).

### 2.5 How the Streaming Row is Tracked
- Tracked exclusively via `state.stream: WireAssistantMessage | null` and `state.streamDone: boolean` (`transcript-model.ts:38-40`).
- `turn_start`: Resets `stream = null`, `streamDone = false` (`transcript-model.ts:262-267`).
- `message_start`: If role is `"assistant"`, sets `stream = toWireAssistant(msg)`, `streamDone = false` (`transcript-model.ts:222-231`).
- `message_update`: Replaces `stream` with `toWireAssistant(msg)` (`transcript-model.ts:234-239`).
- `message_end`: If role is `"assistant"`, pushes the completed entry into `entries`, clears `stream = null`, and sets `streamDone = true` (`transcript-model.ts:248-252`). The stream is set to `null` specifically so tool calls and text are not rendered twice (once in `entries` and once in `stream`).
- `turn_end`: Resets `stream = null`, `streamDone = false` (`transcript-model.ts:269-270`).

### 2.6 How Thinking / Text / Tool Blocks Grow
- In protocol v1 and v2, the server sends a complete snapshot of `msg: AgentMessage` on every token update (`message_update`).
- The browser reducer does NOT perform incremental text appending. On every single token, `toWireAssistant(msg)` (`transcript-model.ts:98-108`) re-maps every block in `msg.content`:
  - `text`: `{ type: "text", text: block.text }` (`transcript-model.ts:56-57`)
  - `thinking`: `{ type: "thinking", thinking: block.thinking }` (`transcript-model.ts:58-59`)
  - `toolCall`: `{ type: "toolCall", id, name, arguments, intent }` (`transcript-model.ts:65-72`)
- This allocates brand new object wrappers for every block in the message on every token, producing a new `stream` object reference on every event (`transcript-model.ts:237`).

### 2.7 How Tool Results Attach to Tool Calls
Tool execution is tracked across two independent data flows:
1. **Ephemeral Execution Lifecycle (`activeTools`)**:
   - `tool_execution_start`: Inserts into `state.activeTools` (`transcript-model.ts:272-288`).
   - `tool_execution_update`: Updates `partialResult` (`transcript-model.ts:290-305`).
   - `tool_execution_end`: Deletes from `state.activeTools` (`transcript-model.ts:307-313`). Result payload on this frame is ignored.
2. **Persistent Tool Result (`entries`)**:
   - The session emits `message_end` with `msg.role === "toolResult"` (`transcript-model.ts:244`).
   - Converted to `SessionEntry` with `message: WireToolResultMessage` (`transcript-model.ts:134-144`) and appended to `state.entries`.
3. **Attachment / Joining in `Transcript.tsx`**:
   - `results` Map is computed via `useMemo` from `entries` (`Transcript.tsx:378-386`):
     ```ts
     const results = useMemo(() => {
         const map = new Map<string, ToolResultMessage>();
         for (const entry of entries) {
             if (entry.type === "message" && entry.message.role === "toolResult") {
                 map.set(entry.message.toolCallId, entry.message);
             }
         }
         return map;
     }, [entries]);
     ```
   - When `flattenAssistant` processes a `toolCall` block (`Transcript.tsx:239-254`), it queries:
     - `act = activeTools.get(block.id)`
     - `result = results.get(block.id)`
   - The resulting `ToolCallItem` combines both:
     - `args`: `act?.args ?? block.arguments`
     - `intent`: `block.intent ?? act?.intent`
     - `result`: `result` (from committed `toolResult` entry)
     - `running`: `!result && (act !== undefined || pending)`
     - `partialResult`: `act?.partialResult`
     - `startedAt`: `act?.startedAt`

### 2.8 PendingUser Handling
- User types prompt in `Composer.tsx` and submits (`App.tsx:250-264`).
- Immediately calls `attached.store.echoUser(text)` (`App.tsx:254`), invoking `addPendingUser` (`transcript-model.ts:204-206`), appending `text` to `state.pendingUser`.
- `Transcript.tsx:207-209` renders pending prompts at the tail with `pending: true` and `id: pending-${i}`.
- Removed from `pendingUser` (FIFO via `pendingUser.slice(1)`) on any of 4 conditions:
  1. Server echoes user prompt: `message_end` with `msg.role === "user"` (`transcript-model.ts:254`).
  2. Local slash command output: `command_output` frame arrives (`transcript-model.ts:331`).
  3. Non-invoking prompt response: `prompt_result` with `agentInvoked === false` (`transcript-model.ts:337-339`).
  4. Immediate prompt failure: `sendPrompt` response has `agentInvoked === false` or Promise rejects (`App.tsx:261-267`).

### 2.9 Subagent Data
- Subagents are **NOT** part of `TranscriptState`. They reside in `SubagentTreeState` (`packages/webgui/src/lib/subagent-model.ts:26-29`).
- State: `agents: ReadonlyMap<string, SubagentNode>`.
- Updated via:
  - Initial snapshot: `fetchSubagents()` -> `get_subagents` -> `subagentTreeFromSnapshots` (`subagent-model.ts:190-225`).
  - Lifecycle events: `subagent_lifecycle` (`subagent-model.ts:61-90`).
  - Progress events: `subagent_progress` (`subagent-model.ts:92-128`).
- Projections:
  - `buildChildrenMap(state)` (`subagent-model.ts:172-184`) constructs parent-to-child agent hierarchy based on `parentToolCallId`.
- UI Presentation:
  - Rendered in `AgentsPanel.tsx` (`App.tsx:329`) in the desktop sidebar inspector or mobile overlay panel (`narrowPanel === "agents"`, `App.tsx:388`).
  - Counter badge rendered in `TopBar.tsx:166-171` (`subagentCount={snap.subagents.agents.size}`).
  - In the transcript itself, `task` tool cards (`packages/webgui/src/components/transcript/tool-views/tools/task.tsx:1-93`) inspect subagent execution from the tool call's own `args.tasks` and `result.agents`, independent of `SubagentTreeState`.

---

## 3. Attach and Reconnect Path

### 3.1 Initial Attach Path
When a user opens or navigates to a session (`instanceId` changes, `App.tsx:138`):
1. Previous client and store are disposed: `attachRef.current.store.dispose()`, `attachRef.current.client.close()` (`App.tsx:140-141`).
2. Client initialized: `new RpcWebClient({ url: wsUrl(instanceId), reconnect: { enabled: true } })` (`App.tsx:150-153`).
3. Connection opened: `client.connect()` (`App.tsx:158`) -> `#openSocket(false)` (`rpc-client.ts:256`).
4. Socket transitions to `"connecting"` (`rpc-client.ts:258`).
5. Wait for WebSocket message with `parsed.type === "ready"` (`rpc-client.ts:290-295`).
6. `#runAttachSequence(false)` executes in strict sequence (`rpc-client.ts:414-434`):
   - Step 1: `this.#setState("ready")` (`rpc-client.ts:415`).
   - Step 2: `request({ type: "negotiate_protocol", protocolVersion: 2 })` (`rpc-client.ts:417-420`).
   - Step 3: `request({ type: "get_state" })` (`rpc-client.ts:422-425`). Saves `client.#sessionState`.
   - Step 4: `request({ type: "get_messages" })` (`rpc-client.ts:427-430`). Saves `client.#messages`.
   - Step 5: `request({ type: "set_subagent_subscription", level: "progress" })` (`rpc-client.ts:433`).
7. Once `client.connect()` resolves, `createSessionStore(client)` is instantiated (`App.tsx:165`):
   - Initializes `transcript = transcriptFromMessages(client.messages)` (`session-store.ts:101`).
   - Initializes `sessionState = client.sessionState` (`session-store.ts:104`).
   - Dispatches 7 parallel background fetch calls (`session-store.ts:270-276`):
     - `fetchStats()` (`get_session_stats`)
     - `fetchCommands()` (`get_available_commands`)
     - `fetchSubagents()` (`get_subagents`)
     - `fetchRoles()` (`get_model_roles`)
     - `fetchAgentsConfig()` (`get_agents`)
     - `fetchBrowser()` (`get_model_browser`)
     - `fetchLoginStatus()` (`get_login_status`)

### 3.2 Reconnect Path
When the WebSocket disconnects unexpectedly (`rpc-client.ts:341`):
1. `#handleUnexpectedClose()` cancels all in-flight pending requests with `RpcClientClosedError` (`rpc-client.ts:485-491`).
2. Transitions connection state to `"reconnecting"` (`rpc-client.ts:515`).
3. Schedules reconnect with exponential backoff and 50% jitter (`delay = min(15000, 500 * 2^attempt) * (0.5 + 0.5 * rand)`) (`rpc-client.ts:527`). User can also bypass timer via `reconnectNow()` (`rpc-client.ts:242`).
4. Reconnection opens a new socket via `#openSocket(true)` (`rpc-client.ts:250, 535`).
5. On `ready` frame, executes `#runAttachSequence(true)`:
   - Step 1: `this.#setState("ready")` (`rpc-client.ts:415`).
   - Step 2: `request({ type: "negotiate_protocol", protocolVersion: 2 })` (`rpc-client.ts:417-420`).
   - Step 3: `request({ type: "get_state" })` (`rpc-client.ts:422-425`).
   - Step 4: `request({ type: "get_messages" })` (`rpc-client.ts:427-430`).
   - Step 5: `request({ type: "set_subagent_subscription", level: "progress" })` (`rpc-client.ts:433`).
   - Step 6: Calls `#resyncListeners` with `(this.#messages, this.#sessionState)` (`rpc-client.ts:438`).

### 3.3 What is Thrown Away on Reconnect
Inside `session-store.ts:391-411` (`onResync`):
- **Transcript state completely discarded and rebuilt**:
  `transcript = transcriptFromMessages(messages)` (`session-store.ts:393`).
  - `stream` is thrown away (any mid-flight streaming tokens are dropped; server committed history replaces it).
  - `streamDone` is reset to `false`.
  - `activeTools` Map is wiped to empty (`transcript-model.ts:186`).
  - `working` flag is reset to `false` (`transcript-model.ts:187`).
  - `pendingUser` array is wiped to `[]` (`transcript-model.ts:188`).
- `sessionState` is replaced with newly fetched `state` (`session-store.ts:394`).
- Any unconfirmed login flow is marked as failed: `{ kind: "failed", error: "Connection lost", cancelled: true }` (`session-store.ts:399`).
- Seven background requests are re-issued to rebuild auxiliary state (`session-store.ts:404-410`):
  `fetchSubagents()`, `fetchStats()`, `fetchCommands()`, `fetchRoles()`, `fetchAgentsConfig()`, `fetchBrowser()`, `fetchLoginStatus()`.

### 3.4 How Session Change Frames are Handled
- **Server-driven session change frames**:
  - `session_info_update` (`rpc-types.ts:313`): Received when session title or session ID changes.
    In `session-store.ts:366-371`:
    `session_info_update` only triggers `fetchSessionState()` (`get_state`).
    **It does NOT re-fetch `get_messages` and does NOT reset `transcript`!**
  - `auto_compaction_start` / `auto_compaction_end` (`session-store.ts:291-296`):
    Only flips `sessionState.isCompacting` flag. Does NOT refresh messages.
  - If a session switches branches or loads a different session file on the host without the client disconnecting, **the browser's transcript will retain stale messages until a socket reconnect occurs.**
- **Client-driven route changes**:
  - In `App.tsx:138-143`, switching sessions navigates to a new `instanceId`.
  - Old client and store are destroyed (`attachRef.current.store.dispose(); attachRef.current.client.close()`).
  - A clean new WebSocket connection is established.

---

## 4. Chunk-Frame Decoder (Protocol v2) in `rpc-client.ts`

### 4.1 How Chunk Decoding Works
Implemented in `BrowserFrameDecoder` (`packages/webgui/src/lib/rpc-client.ts:82-183`).

- **Transport limits**:
  - `MAX_RPC_FRAME_BYTES = 1024 * 1024` (1 MiB threshold for chunking, `rpc-client.ts:90`).
  - `MAX_RPC_REASSEMBLED_BYTES = 64 * 1024 * 1024` (64 MiB total payload cap, `rpc-client.ts:91`).
  - `RPC_CHUNK_PAYLOAD_BYTES = 256 * 1024` (256 KiB maximum decoded bytes per chunk, `rpc-client.ts:92`).
- **Detection**:
  `isRpcChunkFrame(value)` checks `typeof value === "object" && value !== null && value.type === "rpc_chunk"` (`rpc-client.ts:94-96`).
- **Validation**:
  - If a non-chunk frame arrives while `#pending` chunk reassembly is in flight, throws `"rpc chunk sequence interrupted"` (`rpc-client.ts:116`).
  - Metadata checked (`rpc-client.ts:121-134`):
    - `chunkId` must be non-empty string.
    - `index`, `count`, `byteLength` must be safe integers.
    - `index >= 0`, `count >= 2`, `count <= ceil(64MB / 256KB) = 256`, `index < count`.
    - `byteLength >= 1MB`, `byteLength <= 64MB`.
- **Reassembly Steps**:
  1. Base64 decoded via browser `atob(data)` into a `Uint8Array` (`rpc-client.ts:136-140`).
  2. Verifies decoded `bytes.byteLength <= RPC_CHUNK_PAYLOAD_BYTES` (`rpc-client.ts:142`).
  3. First chunk (`index === 0`) initializes `PendingChunks` tracker (`rpc-client.ts:145-154`).
  4. Subsequent chunks must match `chunkId`, `count`, `byteLength`, and have `index === pending.nextIndex` (`rpc-client.ts:156-162`).
  5. Pushes `bytes` into `pending.chunks: Uint8Array[]` and increments `pending.receivedBytes` (`rpc-client.ts:164-166`).
  6. While `pending.nextIndex < pending.count`, returns `undefined` (`rpc-client.ts:168`).
  7. When final chunk arrives (`nextIndex === count`):
     - Validates `pending.receivedBytes === pending.byteLength` (`rpc-client.ts:169`).
     - Allocates single target buffer: `merged = new Uint8Array(pending.receivedBytes)` (`rpc-client.ts:172`).
     - Copies chunks in order: `merged.set(chunk, offset)` (`rpc-client.ts:175`).
     - Decodes UTF-8 with fatal error checking: `new TextDecoder("utf-8", { fatal: true }).decode(merged)` (`rpc-client.ts:178`).
     - Parses JSON: `JSON.parse(decoded)` (`rpc-client.ts:179`).
     - Returns parsed object to `#dispatchFrame`.

### 4.2 Version Negotiation from the Client Side
- Handshake location: `rpc-client.ts:417-420` in `#runAttachSequence`:
  ```ts
  await this.request({
      type: "negotiate_protocol",
      protocolVersion: 2,
  } as Extract<RpcCommand, { type: "negotiate_protocol" }>);
  ```
- **Blind Negotiation**: The client does NOT inspect `supportedProtocolVersions: [1, 2]` from the `ready` frame (`rpc-types.ts:381`). It unconditionally sends `negotiate_protocol` with `protocolVersion: 2` immediately after socket connection.
- If the server accepts, it responds with `{ type: "response", command: "negotiate_protocol", success: true, data: { protocolVersion: 2 } }` (`rpc-types.ts:434-437`).

---

## 5. Callers of `getMessagesPage` and `prependEntries`

### 5.1 Verification of `getMessagesPage`
- **Definition**: `packages/webgui/src/lib/session-actions.ts:98-108`:
  ```ts
  export function getMessagesPage(
      sink: SessionCommandSink,
      cursor?: string,
      limit?: number,
  ): Promise<RpcResponseFor<"get_messages_page">> {
      return sink.request(
          cursor !== undefined || limit !== undefined
              ? { type: "get_messages_page", cursor, limit }
              : { type: "get_messages_page" },
      );
  }
  ```
- **Tests**: Tested only in unit tests (`packages/webgui/test/session-actions.test.ts:12, 108, 114`).
- **Application Callers**: **ZERO**. There are no calls to `getMessagesPage` anywhere in `packages/webgui/src`.

### 5.2 Verification of `prependEntries`
- **Definition**: `packages/webgui/src/lib/transcript-model.ts:193-201`:
  ```ts
  export function prependEntries(state: TranscriptState, older: AgentMessage[]): TranscriptState {
      const olderEntries: SessionEntry[] = [];
      for (let i = 0; i < older.length; i++) {
          const entry = messageToEntry(older[i], i);
          if (entry) olderEntries.push(entry);
      }
      if (olderEntries.length === 0) return state;
      return { ...state, entries: [...olderEntries, ...state.entries] };
  }
  ```
- **Tests**: Tested only in unit tests (`packages/webgui/test/transcript-model.test.ts:6, 121, 124`).
- **Application Callers**: **ZERO**. No store, action, or component calls `prependEntries`.
- **Known Flaw in Implementation**: `older[i]` is converted via `messageToEntry(older[i], i)`. Because `AgentMessage` lacks an `id` field, `olderEntries` receive synthetic IDs `"0"`, `"1"`, `"2"`, which **collide with the IDs of existing entries** already in `state.entries`.

### 5.3 Verification of UI Top-Scroll Pager (`onLoadOlder`)
- `TranscriptViewProps` declares `onLoadOlder?: () => Promise<void>` (`Transcript.tsx:372`).
- `TranscriptView` attaches a scroll event listener to trigger `onLoadOlder()` when scrolled to top (`Transcript.tsx:446-470`).
- In `App.tsx:383`:
  `<TranscriptView state={snap.transcript} streaming={snap.streaming} expandAll={expandAll} />`
  **`onLoadOlder` is NOT passed to `TranscriptView`.**
- The paging listener is disabled in production. History is loaded strictly monolithically via `get_messages` (`rpc-client.ts:428`).

---

## 6. Costs Visible in Code

### 6.1 Per-Token Reducer Overhead
When streaming assistant tokens, the webgui incurs high CPU and allocation costs on every single token:

1. **Full Message Transport & Parsing**:
   - `message_update` frame contains the entire `msg: AgentMessage` containing all historical text, thinking, and tool call blocks.
   - For a 4,000-token response, the server serializes and the browser JSON-parses (`rpc-client.ts:284`) the full message on every token event: $\sum_{k=1}^N k \approx \frac{N^2}{2}$ tokens transferred and parsed.
2. **Object Allocations in Reducer (`transcript-model.ts:234-240`)**:
   - `toWireAssistant(msg)` (`transcript-model.ts:98-108`) runs on every token.
   - Allocates new wrapper objects for every block in `msg.content`:
     - Text blocks: `{ type: "text", text: block.text }` (`transcript-model.ts:57`).
     - Thinking blocks: `{ type: "thinking", thinking: block.thinking }` (`transcript-model.ts:59`).
     - Tool call blocks: `{ type: "toolCall", id, name, arguments, intent }` (`transcript-model.ts:66-72`).
   - Allocates a new `WireUsage` object (`transcript-model.ts:78-87`).
   - Allocates a new `WireAssistantMessage` object (`transcript-model.ts:98-107`).
   - `applyTranscriptEvent` returns `{ ...state, stream: toWireAssistant(msg) }`.
   - `session-store.ts:120-137`: `emit()` creates a new `SessionSnapshot` object and triggers all store listeners.
3. **Full Array Flattening (`Transcript.tsx:388-391`)**:
   - `items` is memoized on `[entries, results, activeTools, stream, streamDone, working, streaming, pendingUser]`.
   - Because `stream` reference changes on every token, `flattenEntries()` re-runs on every token.
   - `flattenEntries` iterates over all `entries`, maps assistant blocks, maps tail tools, and allocates a new `RowItem[]` containing new object references for all rows in the transcript.

### 6.2 Per-Token Markdown Re-Parsing ($O(N^2)$)
- In `Markdown.tsx:169-174`:
  ```ts
  export const Markdown = memo(function Markdown({ text }: { text: string }): ReactNode {
      const ready = useSyncExternalStore(subscribeKatex, katexReady, katexReady);
      const html = useMemo(() => renderMarkdown(text), [text, ready]);
      return <div className="tr-md" dangerouslySetInnerHTML={{ __html: html }} />;
  });
  ```
- On every token, `text` is a new string containing all previous text plus the new token.
- `renderMarkdown(text)` calls `md.parse(text)` (`Markdown.tsx:163`), parsing the **entire markdown string from character 0 to end**, executing regex tokenizers for code blocks, lists, links, HTML sanitization (`Markdown.tsx:144-148`), and math delimiters (`Markdown.tsx:120-138`).
- For a response with $L$ characters streaming at 30 tokens/second, `Marked` parses cumulatively $\frac{L^2}{2}$ characters, replacing the entire `innerHTML` of the container DOM element 30 times per second.

### 6.3 Virtualization Key Stability Hazards
TanStack virtualizer indexes rows by `key={item.id}` (`Transcript.tsx:498`). Three severe key stability hazards exist in the code:

1. **Streaming-to-Committed Key Flip**:
   - While streaming, assistant blocks receive keys prefixed with `"stream"`: `stream-txt0`, `stream-t0`, `stream-tc-call_abc` (`Transcript.tsx:182, 231, 237, 252`).
   - When `message_end` arrives, `stream` is cleared to `null` and the message is committed to `entries[N]` (`transcript-model.ts:248-251`).
   - On the very next render, `baseId` changes from `"stream"` to `entry.id` (e.g. `"42"`).
   - Keys flip from `stream-txt0` to `42-txt0`.
   - **React treats this as an unmount of the old element and a mount of a new element.** The DOM node is destroyed and recreated, resetting text selections, user expansion toggles, and any active layout measurements.
2. **Tail Tool Key Flip**:
   - An active tool started before its assistant toolCall block appears receives key `id: "tail-${tool.toolCallId}"` (`Transcript.tsx:202`).
   - Once the tool call block arrives in the assistant message, the row switches to `id: "stream-tc-${block.id}"` or `"${entry.id}-tc-${block.id}"`.
   - Causes another unmount/remount of the `ToolCard` component.
3. **Pending User Message Key Flip**:
   - Submitted prompt is rendered with `id: "pending-${i}"` (`Transcript.tsx:208`).
   - When the session echoes the user message via `message_end`, `pendingUser` is popped (`transcript-model.ts:254`) and the message enters `entries` with key `entry.id` (e.g. `"41"`).
   - Causes the user message row DOM node to be destroyed and recreated.

---

## 7. Implications for RPC Protocol v3

1. **Token deltas must replace full message updates**: v3 must send incremental text deltas (`{ blockIndex, textDelta }`) instead of resending the full `AgentMessage` on every token, cutting per-token bandwidth and JSON parsing from $O(N^2)$ to $O(N)$ (`transcript-model.ts:234-240`, `rpc-client.ts:284`).
2. **Stable message indices at stream start**: The server must assign the final message index (or stable message ID) at `message_start` so the streaming row's key does not change from `stream-txt*` to `${index}-txt*` at `message_end`, eliminating unmount/remount churn (`Transcript.tsx:182, 498`).
3. **Message end serves as an authoritative repair frame**: Retain a complete message snapshot on `message_end` (`transcript-model.ts:242-260`) to correct any dropped or misordered deltas before finalizing the committed entry.
4. **Newest-first history paging with server-assigned indices**: Paging must load newest messages first and provide stable global message indices (`0` to `totalMessages - 1`) so `prependEntries` does not collide with existing index keys (`transcript-model.ts:195-196`).
5. **Epoch-based transcript invalidation**: The protocol must include an `epoch` identifier that increments on compaction, branching, or session reset; the browser must observe epoch changes and reset its transcript accordingly, fixing the current bug where `session_info_update` and compaction frames ignore transcript invalidation (`session-store.ts:291-296, 366-371`).
6. **Decouple reducer updates from full markdown re-parsing**: With incremental deltas, the UI should avoid re-parsing the entire cumulative text through `Marked` on every token (`Markdown.tsx:161-174`), either by throttling/debouncing markdown renders or appending to text nodes during active streaming.
7. **Clean deletion of unused v2 paging artifacts**: `getMessagesPage` (`session-actions.ts:98`) and `prependEntries` (`transcript-model.ts:193`) have zero production callers and can be safely deleted or replaced without migration shims.
8. **Subagent model isolation**: Subagent state (`SubagentTreeState`, `subagent-model.ts:26`) is completely decoupled from transcript entries; v3 transcript changes do not require changes to subagent frame payloads (`subagent_lifecycle`, `subagent_progress`).
