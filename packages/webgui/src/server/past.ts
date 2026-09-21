import { FileSessionStorage } from "../../../coding-agent/src/session/session-storage";
import {
	listSessionsReadOnly,
	listAllSessions,
	type SessionInfo,
} from "../../../coding-agent/src/session/session-listing";
import { loadSessionFile } from "../../../coding-agent/src/session/session-loader";
import type { SessionStorage } from "../../../coding-agent/src/session/session-storage";
import type { FileEntry, SessionHeader } from "../../../coding-agent/src/session/session-entries";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PastSessionSummary {
	id: string;
	path: string;
	cwd: string;
	name: string | null;
	createdAt: number;
	modifiedAt: number;
	messageCount: number;
	firstUserMessage: string | null;
}

export interface PastSessionPreviewMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	timestamp: string;
}

export interface PastSessionPreview extends PastSessionSummary {
	messages: PastSessionPreviewMessage[];
}

// ---------------------------------------------------------------------------
// Options shared by the exported functions
// ---------------------------------------------------------------------------

export interface PastSessionOptions {
	sessionsDir?: string;
	storage?: SessionStorage;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSummary(s: SessionInfo): PastSessionSummary {
	return {
		id: s.id,
		path: s.path,
		cwd: s.cwd,
		name: s.title ?? null,
		createdAt: s.created.getTime(),
		modifiedAt: s.modified.getTime(),
		messageCount: s.messageCount,
		firstUserMessage: s.firstMessage || null,
	};
}

function extractTextFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (
			typeof block === "object" &&
			block !== null &&
			"type" in block &&
			block.type === "text" &&
			"text" in block &&
			typeof block.text === "string"
		) {
			parts.push(block.text);
		}
	}
	return parts.join(" ");
}

function isSessionHeader(entry: FileEntry): entry is SessionHeader {
	return entry.type === "session";
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/** List past sessions, sorted newest-first by modification time. */
export async function listPastSessions(opts: {
	cwd?: string;
	all?: boolean;
	sessionsDir?: string;
	storage?: SessionStorage;
}): Promise<PastSessionSummary[]> {
	const storage = opts.storage ?? new FileSessionStorage();
	let sessions: SessionInfo[];
	if (opts.all || !opts.cwd) {
		sessions = await listAllSessions(storage, opts.sessionsDir);
	} else {
		sessions = await listSessionsReadOnly(opts.sessionsDir ?? opts.cwd, storage);
	}
	return sessions.map(toSummary);
}

/**
 * Accept either a session file path or a session id (as listed by
 * {@link listPastSessions}); ids are looked up across all projects because the
 * browser does not know which project directory a past session belongs to.
 */
export async function resolvePastSessionPath(idOrPath: string, opts: PastSessionOptions = {}): Promise<string | null> {
	if (idOrPath.includes("/") || idOrPath.endsWith(".jsonl")) return idOrPath;
	const storage = opts.storage ?? new FileSessionStorage();
	const sessions = await listAllSessions(storage, opts.sessionsDir);
	return sessions.find(s => s.id === idOrPath)?.path ?? null;
}

/** Load a full preview of a past session by id or file path. */
export async function loadPastSessionPreview(
	id: string,
	opts: PastSessionOptions = {},
): Promise<PastSessionPreview | null> {
	const storage = opts.storage ?? new FileSessionStorage();
	const sessionPath = await resolvePastSessionPath(id, { ...opts, storage });
	if (sessionPath === null) return null;
	let result;
	try {
		result = await loadSessionFile(sessionPath, storage);
	} catch {
		return null;
	}
	if (result.sourceSize === null) return null;

	const header = result.entries.find(isSessionHeader);
	const messages: PastSessionPreviewMessage[] = [];
	let firstUserMessage: string | null = null;

	for (const entry of result.entries) {
		if (entry.type !== "message") continue;
		const msg = entry.message;
		if (msg.role !== "user" && msg.role !== "assistant") continue;
		const text = extractTextFromContent(msg.content);
		if (msg.role === "user" && firstUserMessage === null) {
			firstUserMessage = text || null;
		}
		messages.push({
			id: entry.id,
			role: msg.role,
			text,
			timestamp: entry.timestamp,
		});
	}

	return {
		id: header?.id ?? "",
		path: sessionPath,
		cwd: header?.cwd ?? "",
		name: header?.title ?? null,
		createdAt: header ? new Date(header.timestamp).getTime() : 0,
		modifiedAt: header ? new Date(header.timestamp).getTime() : 0,
		messageCount: messages.length,
		firstUserMessage,
		messages,
	};
}

// ---------------------------------------------------------------------------
// HTTP route handler
// ---------------------------------------------------------------------------

export interface HandlePastRequestOptions extends PastSessionOptions {
	cwd?: string;
}

/**
 * Handle GET /api/past and GET /api/past/:id.
 * Returns null when the URL path does not match so the caller can fall through.
 */
export async function handlePastRequest(
	req: Request,
	url: URL,
	opts: HandlePastRequestOptions = {},
): Promise<Response | null> {
	if (req.method !== "GET") return null;

	const pathname = url.pathname;

	// GET /api/past -- list sessions
	if (pathname === "/api/past") {
		const all = url.searchParams.get("all") === "true";
		const cwd = url.searchParams.get("cwd") ?? opts.cwd;
		const summaries = await listPastSessions({
			cwd: cwd ?? undefined,
			all,
			sessionsDir: opts.sessionsDir,
			storage: opts.storage,
		});
		return Response.json(summaries);
	}

	// GET /api/past/:id -- preview a session (id is URL-encoded file path)
	const match = pathname.match(/^\/api\/past\/(.+)$/);
	if (match) {
		const sessionPath = decodeURIComponent(match[1]);
		const preview = await loadPastSessionPreview(sessionPath, opts);
		if (!preview) {
			return Response.json({ error: "not found" }, { status: 404 });
		}
		return Response.json(preview);
	}

	return null;
}
