/**
 * Wire definitions for non-command frames: unsolicited server notifications,
 * the extension UI sub-protocol, and the host tool/URI sub-protocols.
 */
import { absentAs, doc, type WireDefs } from "./dsl";

const JSON_OBJECT = "Record<string, unknown>";
const UI = "'extension_ui_request'";

export const frameDefs = {
	ReadyEvent: doc(
		{
			type: "'ready'",
			"protocolVersion?": "number.integer",
			"supportedProtocolVersions?": "number.integer[]",
			"maxFrameBytes?": "number.integer",
			"maxReassembledFrameBytes?": "number.integer",
			"supportsBashExcludeFromContext?": doc(
				"boolean",
				"`bash` accepts `excludeFromContext`; require exactly true before sending excluded commands.",
			),
		},
		"First frame after startup; transport fields are absent on servers without protocol v2.",
	),
	PromptStatus: "'completed' | 'aborted' | 'error'",
	PromptError: doc(
		{
			message: "string",
			"provider?": "string",
			"model?": "string",
			"httpStatus?": "number.integer",
			retryable: doc("boolean", "Transient: resubmitting later may succeed (omp's own retries are exhausted)."),
			"code?": doc(
				"'cost_cap'",
				"`cost_cap`: the session reached `session.maxCost` (`--max-cost`) and omp did not send the next request.",
			),
		},
		'Failure detail of a `prompt_result` with `status: "error"`.',
	),
	PromptResultEvent: doc(
		{
			type: "'prompt_result'",
			"id?": "string",
			agentInvoked: "boolean",
			status: "PromptStatus",
			"error?": "PromptError",
			sessionSettled: doc(
				"boolean",
				"Nothing will wake the session again; when false a `session_settled` follows once background work drains.",
			),
		},
		"Terminal outcome of one accepted `prompt` / `abort_and_prompt`, keyed by request `id`.",
	),
	SessionSettledEvent: doc(
		{ type: "'session_settled'" },
		"The session went quiet: the last run yielded and no background work can wake it.",
	),
	ExtensionError: { type: "'extension_error'", extensionPath: "string", event: "string", error: "string" },
	AvailableCommandsUpdateEvent: doc(
		{ type: "'available_commands_update'", commands: "AvailableSlashCommand[]" },
		"Slash-command catalog, pushed at startup and whenever command metadata changes.",
	),
	SubagentLifecycleStatus: "'started' | 'completed' | 'failed' | 'aborted'",
	SubagentLifecyclePayload: {
		id: "string",
		agent: "string",
		agentSource: "AgentSource",
		"description?": "string",
		status: "SubagentLifecycleStatus",
		"sessionFile?": "string",
		"parentToolCallId?": "string",
		index: "number.integer",
		"detached?": doc("boolean", "The subagent runs as a detached background job."),
	},
	SubagentProgressPayload: {
		index: "number.integer",
		agent: "string",
		agentSource: "AgentSource",
		task: "string",
		"parentToolCallId?": "string",
		"assignment?": "string",
		progress: doc(JSON_OBJECT, "Raw `AgentProgress` record."),
		"sessionFile?": "string",
		"detached?": "boolean",
	},
	SubagentEventPayload: { id: "string", event: "RpcAgentEvent" },
	SubagentLifecycleEvent: doc(
		{ type: "'subagent_lifecycle'", payload: "SubagentLifecyclePayload" },
		'A subagent started or ended; sent at subscription level "progress" or "events".',
	),
	SubagentProgressEvent: doc(
		{ type: "'subagent_progress'", payload: "SubagentProgressPayload" },
		'Aggregated subagent progress; sent at subscription level "progress" or "events".',
	),
	SubagentEvent: doc(
		{ type: "'subagent_event'", payload: "SubagentEventPayload" },
		'A subagent\'s own session event; sent only at subscription level "events".',
	),
	LivePhase: "'connecting' | 'listening' | 'working' | 'speaking' | 'muted' | 'error'",
	LiveRole: "'user' | 'assistant'",
	LivePhaseEvent: { type: "'live_phase'", phase: "LivePhase" },
	LiveLevelsEvent: doc(
		{ type: "'live_levels'", input: "number", output: "number" },
		"Microphone (`input`) and speaker (`output`) RMS in [0, 1], at most every 100 ms.",
	),
	LiveTranscriptEvent: doc(
		{ type: "'live_transcript'", role: "LiveRole", turn: "number.integer", text: "string", final: "boolean" },
		"Accumulated text of one realtime turn; replaces earlier frames with the same `role` and `turn`.",
	),
	LiveEndEvent: doc(
		{ type: "'live_end'", "error?": "string" },
		"Sent exactly once when a live session ends; `error` carries the failure cause.",
	),
	DictationStateEvent: doc(
		{ type: "'dictation_state'", captureId: "string", state: "'starting' | 'recording' | 'transcribing'" },
		"State of one draft-only microphone capture.",
	),
	DictationTranscriptEvent: doc(
		{ type: "'dictation_transcript'", captureId: "string", text: "string" },
		"Full accumulated draft preview; replaces the previous preview for this capture.",
	),
	DictationEndEvent: doc(
		{ type: "'dictation_end'", captureId: "string", text: "string", "error?": "string" },
		"Exactly one terminal frame per capture; text is the accumulated result.",
	),
	BtwDeltaEvent: doc(
		{ type: "'btw_delta'", recordId: "string", delta: "string" },
		"Text appended to the running side question's latest answer.",
	),
	BtwRecordEvent: doc(
		{ type: "'btw_record'", record: "BtwHistoryRecord" },
		"Full side-question record on every lifecycle change (started, complete, cancelled, error); the last one per id wins.",
	),
	CommandOutputEvent: doc({ type: "'command_output'", text: "string" }, "Output of a builtin slash command."),
	SessionInfoUpdateEvent: doc(
		{ type: "'session_info_update'", "title?": "string", sessionId: "string" },
		"A builtin slash command changed the session title.",
	),
	ConfigUpdateEvent: doc(
		{ type: "'config_update'", "model?": "ModelInfo", "thinkingLevel?": "ThinkingLevel" },
		"A builtin slash command changed the model configuration.",
	),
	ClientSurface: doc(
		"'tui' | 'web' | 'shell' | 'unknown'",
		"Client kind declared in the socket auth line; `unknown` when absent or invalid.",
	),
	DriverInfo: doc(
		{ surface: "ClientSurface", clientId: "string" },
		"Client that most recently sent a driver-setting command (prompt, steer, abort, session commands).",
	),
	DriverChangedEvent: doc(
		{ type: "'driver_changed'", driver: "DriverInfo | null" },
		"Session host only: a different client now drives the session.",
	),
	RpcFrameErrorEvent: doc(
		{ type: "'rpc_frame_error'", "originalType?": "string", error: "string" },
		"An event could not fit within the transport limits and was dropped.",
	),

	WidgetPlacement: "'aboveEditor' | 'belowEditor'",
	SelectOptionDetail: doc({ "description?": "string" }, "Presentation metadata aligned positionally with `options`."),
	AskOption: { label: "string", "description?": "string", "preview?": "string" },
	AskQuestion: doc(
		{
			id: "string",
			question: "string",
			"header?": "string",
			options: "AskOption[]",
			multi: absentAs("boolean", false),
			"recommended?": doc("number.integer", "Index into `options` of the recommended choice."),
		},
		"One question of an `ask` request; hosts always offer free text besides `options`.",
	),
	SelectUiRequest: {
		type: UI,
		id: "string",
		method: "'select'",
		title: "string",
		options: "string[]",
		"optionDetails?": "SelectOptionDetail[]",
		"timeout?": "number.integer",
	},
	ConfirmUiRequest: {
		type: UI,
		id: "string",
		method: "'confirm'",
		title: "string",
		message: "string",
		"timeout?": "number.integer",
	},
	InputUiRequest: {
		type: UI,
		id: "string",
		method: "'input'",
		title: "string",
		"placeholder?": "string",
		"timeout?": "number.integer",
		"secret?": "boolean",
	},
	EditorUiRequest: {
		type: UI,
		id: "string",
		method: "'editor'",
		title: "string",
		"prefill?": "string",
		"promptStyle?": "boolean",
	},
	AskUiRequest: doc(
		{ type: UI, id: "string", method: "'ask'", questions: "AskQuestion[]", "timeout?": "number.integer" },
		"Every question of one `ask` tool call; sent only after `set_ask_dialog` enables it.",
	),
	FormSpan: doc(
		{ text: "string", "style?": "'code' | 'strong' | 'em'" },
		'A run of inline text; `"\\n"` inside `text` is a hard line break.',
	),
	FormChoiceOption: { value: "string", label: "FormSpan[]", checked: "boolean", disabled: "boolean" },
	FormChoiceField: doc(
		{
			kind: "'choice'",
			name: "string",
			multi: "boolean",
			select: doc("boolean", "From a `<select>`: a single select draws as a dropdown."),
			other: doc("boolean", "Offer a free-text `Other` answer whose text stands in for (or joins) the value."),
			label: "FormSpan[]",
			options: "FormChoiceOption[]",
			required: "boolean",
		},
		"A radio group (`multi: false`), checkbox group (`multi: true`) or `<select>`.",
	),
	FormTextField: doc(
		{
			kind: "'text'",
			name: "string",
			type: doc("string", "The `<input type>` (`text`, `number`, `url`, …); `textarea` for textareas."),
			multiline: "boolean",
			label: "FormSpan[]",
			value: "string",
			placeholder: "string",
			required: "boolean",
			"min?": "number",
			"max?": "number",
			"pattern?": "string",
			"minLength?": "number.integer",
			"maxLength?": "number.integer",
			rows: "number.integer",
		},
		"A single-line `<input>` or a `<textarea>`.",
	),
	FormField: "FormChoiceField | FormTextField",
	FormTextBlock: { kind: "'text'", spans: "FormSpan[]", heading: "boolean" },
	FormListBlock: { kind: "'list'", items: "FormSpan[][]", ordered: "boolean" },
	FormPreBlock: { kind: "'pre'", text: "string" },
	FormTableBlock: { kind: "'table'", rows: "FormSpan[][][]", headerRows: "number.integer" },
	FormImageBlock: doc(
		{ kind: "'image'", src: "string", alt: "string" },
		"An `<img>`: `src` is an http(s), `data:` or `file:` URL, or a local path.",
	),
	FormSvgBlock: doc({ kind: "'svg'", markup: "string", alt: "string" }, "An inline `<svg>`, serialized whole."),
	FormFieldBlock: doc(
		{ kind: "'field'", field: "FormField", "optionsEnd?": "number.integer" },
		"A field; `optionsEnd` is the block index just past a group's last option when text sits between options.",
	),
	FormBlock:
		"FormTextBlock | FormListBlock | FormPreBlock | FormTableBlock | FormImageBlock | FormSvgBlock | FormFieldBlock",
	FormSection: doc(
		{ title: "FormSpan[]", blocks: "FormBlock[]", fieldset: "boolean" },
		"A `<fieldset>` (titled by its legend) or loose content between fieldsets.",
	),
	HtmlForm: doc(
		{
			sections: "FormSection[]",
			fields: "FormField[]",
			hidden: doc("string[][]", "`[name, value]` pairs of hidden inputs; the server always submits these itself."),
		},
		"A parsed HTML form: what to draw, the fields in document order, and hidden inputs. Never raw HTML.",
	),
	FormUiRequest: doc(
		{ type: UI, id: "string", method: "'form'", form: "HtmlForm", "timeout?": "number.integer" },
		"One parsed `ask` form; sent only after `set_form_dialog` enables it.",
	),
	CancelUiRequest: doc(
		{ type: UI, id: "string", method: "'cancel'", targetId: "string" },
		"Close the dialog opened by request `targetId`; a later answer to it is ignored.",
	),
	NotifyUiRequest: {
		type: UI,
		id: "string",
		method: "'notify'",
		message: "string",
		"notifyType?": "NotifyType",
	},
	SetStatusUiRequest: {
		type: UI,
		id: "string",
		method: "'setStatus'",
		statusKey: "string",
		"statusText?": "string",
	},
	SetWidgetUiRequest: {
		type: UI,
		id: "string",
		method: "'setWidget'",
		widgetKey: "string",
		"widgetLines?": "string[]",
		"widgetPlacement?": "WidgetPlacement",
	},
	SetTitleUiRequest: { type: UI, id: "string", method: "'setTitle'", title: "string" },
	SetEditorTextUiRequest: { type: UI, id: "string", method: "'set_editor_text'", text: "string" },
	OpenUrlUiRequest: {
		type: UI,
		id: "string",
		method: "'open_url'",
		url: "string",
		"launchUrl?": doc("string", "Short loopback redirect to `url`; the truncation-safe copy target."),
		"instructions?": "string",
	},
	ExtensionUiRequest: doc(
		"SelectUiRequest | ConfirmUiRequest | InputUiRequest | EditorUiRequest | AskUiRequest | FormUiRequest | CancelUiRequest | NotifyUiRequest | SetStatusUiRequest | SetWidgetUiRequest | SetTitleUiRequest | SetEditorTextUiRequest | OpenUrlUiRequest",
		"Extension UI request, discriminated by `method`.",
	),
	AskAnswer: doc(
		{ id: "string", selectedOptions: "string[]", "customInput?": "string" },
		"Answer to one `ask` question: exact option labels, plus optional free text.",
	),
	ValueUiResponse: doc(
		{ type: "'extension_ui_response'", id: "string", value: "string" },
		"Answers a `select`, `input`, or `editor` request.",
	),
	ConfirmUiResponse: doc(
		{ type: "'extension_ui_response'", id: "string", confirmed: "boolean" },
		"Answers a `confirm` request.",
	),
	CancelUiResponse: doc(
		{ type: "'extension_ui_response'", id: "string", cancelled: "true", "timedOut?": "boolean" },
		"Dismisses a dialog; `timedOut` reports the host's own deadline (an `ask` then takes its recommended answers).",
	),
	AnswersUiResponse: doc(
		{ type: "'extension_ui_response'", id: "string", answers: "AskAnswer[]" },
		"Answers an `ask` request: one `AskAnswer` per question, in question order.",
	),
	FormValue: doc(
		"string | number | string[]",
		"Text, a number for `number`/`range` inputs, or a group's checked values.",
	),
	FormOptionNote: doc(
		{ name: "string", question: "string", option: "string", value: "string", text: "string" },
		"A note attached to one checked choice option, separate from submitted values.",
	),
	FormDataUiResponse: doc(
		{
			type: "'extension_ui_response'",
			id: "string",
			formData: doc(
				"Record<string, FormValue>",
				"Values by field `name`; checkbox groups and multi-selects give arrays.",
			),
			"notes?": "FormOptionNote[]",
		},
		"Answers a `form` request; every field must pass the form's own validation or the answer counts as cancel.",
	),
	ExtensionUiResponse: doc(
		"ValueUiResponse | ConfirmUiResponse | CancelUiResponse | AnswersUiResponse | FormDataUiResponse",
		"Host reply to an extension UI request; variants share `type` and differ by their payload key.",
	),

	HostToolCallRequest: {
		type: "'host_tool_call'",
		id: "string",
		toolCallId: "string",
		toolName: "string",
		arguments: JSON_OBJECT,
	},
	HostToolCancelRequest: { type: "'host_tool_cancel'", id: "string", targetId: "string" },
	HostToolResultPayload: doc(
		{
			content: "UserContent[]",
			"details?": "unknown",
			"isError?": "boolean",
			"useless?": "boolean",
			"providerMetadata?": JSON_OBJECT,
		},
		"Tool output: content blocks plus optional details.",
	),
	HostToolUpdate: doc(
		{ type: "'host_tool_update'", id: "string", partialResult: "HostToolResultPayload" },
		"Streams partial output of a pending host tool call.",
	),
	HostToolResult: doc(
		{ type: "'host_tool_result'", id: "string", result: "HostToolResultPayload", "isError?": "boolean" },
		"Completes a pending host tool call; `isError` surfaces the content as a tool error.",
	),
	HostUriOperation: "'read' | 'write'",
	HostUriRequest: {
		type: "'host_uri_request'",
		id: "string",
		operation: "HostUriOperation",
		url: "string",
		"content?": doc("string", "Present for write operations."),
	},
	HostUriCancelRequest: { type: "'host_uri_cancel'", id: "string", targetId: "string" },
	HostUriResult: doc(
		{
			type: "'host_uri_result'",
			id: "string",
			"content?": doc("string", "Required for a successful read."),
			"contentType?": "'text/markdown' | 'application/json' | 'text/plain'",
			"notes?": "string[]",
			"immutable?": "boolean",
			"isError?": "boolean",
			"error?": "string",
		},
		"Completes a pending host URI request.",
	),
	RpcHostRequest: doc(
		"HostToolCallRequest | HostToolCancelRequest | HostUriRequest | HostUriCancelRequest",
		"Server request for host-owned tools and URI schemes, discriminated by `type`.",
	),
	RpcInbound: doc(
		"ExtensionUiResponse | HostToolUpdate | HostToolResult | HostUriResult",
		"Non-command frame the host sends, discriminated by `type`.",
	),
	RpcResponse: doc(
		{
			type: "'response'",
			"id?": doc("string", "The command's `id`; absent for failures the server could not correlate."),
			command: "string",
			success: "boolean",
			"data?": doc("unknown", "Command result on success; its shape is the command's `result`."),
			"error?": doc("string", "Failure message when `success` is false."),
			"code?": doc("string", "Machine-readable failure reason, when one applies."),
		},
		"Response to a command, correlated by `id`.",
	),
	ToolLoadMode: "'essential' | 'discoverable'",
	HostToolDefinition: {
		name: "string",
		"label?": "string",
		description: "string",
		parameters: JSON_OBJECT,
		"hidden?": "boolean",
		"loadMode?": "ToolLoadMode",
		"readsSkillUris?": "boolean",
	},
	HostUriSchemeDefinition: {
		scheme: "string",
		"description?": "string",
		"writable?": "boolean",
		"immutable?": "boolean",
	},
} satisfies WireDefs;
