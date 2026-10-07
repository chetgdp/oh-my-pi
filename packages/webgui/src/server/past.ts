import * as path from "node:path";
import { FileSessionStorage } from "../../../coding-agent/src/session/session-storage";
import {
	findSessionFiles,
	listSessionsReadOnly,
	listAllSessions,
	readSessionInfo,
	type SessionInfo,
} from "../../../coding-agent/src/session/session-listing";
import { loadSessionFile } from "../../../coding-agent/src/session/session-loader";
import type { SessionStorage } from "../../../coding-agent/src/session/session-storage";
import type { FileEntry, SessionHeader } from "../../../coding-agent/src/session/session-entries";
import { listRpcHosts } from "../../../coding-agent/src/modes/rpc/rpc-registry";

export class PastSessionError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "PastSessionError";
	}
}

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

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

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
	return (await findPastSessionInfo(idOrPath, opts))?.path ?? null;
}

/**
 * Session info for a bare id. Files are named `<timestamp>_<id>.jsonl`, so a
 * filename glob finds the candidate without stat-ing or reading every session;
 * the header id is still checked. Files not following the convention (or a
 * custom storage) fall back to the full scan, so a miss stays authoritative.
 */
export async function findPastSessionInfo(id: string, opts: PastSessionOptions = {}): Promise<SessionInfo | null> {
	if (!opts.storage && SESSION_ID_PATTERN.test(id)) {
		for (const file of await findSessionFiles(id, opts.sessionsDir)) {
			if (!path.basename(file).endsWith(`_${id}.jsonl`)) continue;
			const info = await readSessionInfo(file);
			if (info?.id === id) return info;
		}
	}
	const sessions = await listAllSessions(opts.storage ?? new FileSessionStorage(), opts.sessionsDir);
	return sessions.find(s => s.id === id) ?? null;
}

/** Load a full preview of a past session by id or file path. */
export async function loadPastSessionPreview(
	id: string,
	opts: PastSessionOptions = {},
): Promise<PastSessionPreview | null> {
	const storage = opts.storage ?? new FileSessionStorage();
	const sessionPath = await resolvePastSessionPath(id, opts);
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

/** Delete a past session and its artifacts directory. */
export async function deletePastSession(
	id: string,
	opts: PastSessionOptions & { registryDir?: string } = {},
): Promise<{ success: true }> {
	if (!SESSION_ID_PATTERN.test(id)) {
		throw new PastSessionError("Invalid session id", 400);
	}

	const hosts = listRpcHosts(opts.registryDir ? { dir: opts.registryDir } : undefined);
	if (hosts.some(h => h.sessionId === id)) {
		throw new PastSessionError("Cannot delete active session", 409);
	}

	const storage = opts.storage ?? new FileSessionStorage();
	const target = await findPastSessionInfo(id, { sessionsDir: opts.sessionsDir, storage: opts.storage });
	if (!target) {
		throw new PastSessionError("Session not found", 404);
	}

	await storage.deleteSessionWithArtifacts(target.path);
	return { success: true };
}

// ---------------------------------------------------------------------------
// HTTP route handler
// ---------------------------------------------------------------------------

export interface HandlePastRequestOptions extends PastSessionOptions {
	cwd?: string;
	registryDir?: string;
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
	if (req.method !== "GET" && req.method !== "DELETE") return null;

	const pathname = url.pathname;

	if (req.method === "DELETE") {
		const match = pathname.match(/^\/api\/past\/(.+)$/);
		if (!match) return null;
		let id: string;
		try {
			id = decodeURIComponent(match[1]);
		} catch {
			return Response.json({ error: "Invalid session id" }, { status: 400 });
		}
		try {
			const result = await deletePastSession(id, opts);
			return Response.json(result, { status: 200 });
		} catch (err) {
			if (err instanceof PastSessionError) {
				return Response.json({ error: err.message }, { status: err.status });
			}
			throw err;
		}
	}

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
