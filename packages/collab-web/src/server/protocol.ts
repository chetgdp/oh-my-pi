// WebSocket protocol types for the OMP web GUI bridge.

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export interface AttachMessage {
	type: "attach";
	lastSeq?: number;
}

export interface PromptMessage {
	type: "prompt";
	text: string;
	images?: unknown[];
	streamingBehavior?: "steer" | "followUp";
}

export interface SteerMessage {
	type: "steer";
	text: string;
}

export interface FollowUpMessage {
	type: "follow_up";
	text: string;
}

export interface AbortMessage {
	type: "abort";
}

export interface UIResponseMessage {
	type: "ui_response";
	id: string;
	response: unknown;
}

export interface SetModelMessage {
	type: "set_model";
	provider: string;
	modelId: string;
}

export interface SetThinkingLevelMessage {
	type: "set_thinking_level";
	level: string;
}

export interface CompactMessage {
	type: "compact";
	customInstructions?: string;
}

export interface NewSessionMessage {
	type: "new_session";
}

export interface SwitchSessionMessage {
	type: "switch_session";
	sessionPath: string;
}

export interface RenameSessionMessage {
	type: "rename_session";
	sessionPath: string;
	newTitle: string;
}

export interface DeleteSessionMessage {
	type: "delete_session";
	sessionPath: string;
}

export interface PingMessage {
	type: "ping";
}

export interface ListSessionsMessage {
	type: "list_sessions";
	cwd?: string;
	all?: boolean;
}

export type ClientMessage =
	| AttachMessage
	| PromptMessage
	| SteerMessage
	| FollowUpMessage
	| AbortMessage
	| UIResponseMessage
	| SetModelMessage
	| SetThinkingLevelMessage
	| CompactMessage
	| NewSessionMessage
	| SwitchSessionMessage
	| ListSessionsMessage
	| RenameSessionMessage
	| DeleteSessionMessage
	| PingMessage;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export interface SyncMessage {
	type: "sync";
	seq: number;
	state: unknown;
	entries: unknown[];
	agents: unknown[];
	models?: unknown[];
	uiRequest?: unknown;
}

export interface EventMessage {
	type: "event";
	seq: number;
	event: unknown;
}

export interface EntryMessage {
	type: "entry";
	seq: number;
	entry: unknown;
}

export interface UIRequestMessage {
	type: "ui_request";
	seq: number;
	request: unknown;
}

export interface UIRequestEndMessage {
	type: "ui_request_end";
	seq: number;
	id: string;
}

export interface SubagentMessage {
	type: "subagent";
	seq: number;
	kind: "lifecycle" | "progress" | "event";
	payload: unknown;
}

export interface StateMessage {
	type: "state";
	seq: number;
	state: unknown;
}

export type ServerMessage =
	| SyncMessage
	| EventMessage
	| EntryMessage
	| UIRequestMessage
	| UIRequestEndMessage
	| SubagentMessage
	| StateMessage;

// ---------------------------------------------------------------------------
// Session Management API Types
// ---------------------------------------------------------------------------

export interface SessionListItem {
	id: string;
	path: string;
	cwd: string;
	title?: string;
	created: string;
	modified: string;
	messageCount: number;
	size: number;
	firstMessage?: string;
	status?: string;
}

export interface SessionPreviewTurn {
	id: string;
	role: string;
	text?: string;
	timestamp?: string;
}

export interface SessionPreviewBranch {
	id: string;
	label?: string;
	messageCount: number;
}

export interface SessionPreviewData {
	id: string;
	path: string;
	cwd: string;
	title?: string;
	messageCount: number;
	messages: SessionPreviewTurn[];
	branches?: SessionPreviewBranch[];
}

export interface WorkspaceItem {
	cwd: string;
	name: string;
	sessionCount: number;
	lastModified: string;
}

export interface SessionsResponse {
	currentCwd: string;
	currentSessionFile?: string;
	currentSessionId?: string;
	sessions: SessionListItem[];
}
