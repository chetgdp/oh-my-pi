import { computeDefaultSessionDir } from "@oh-my-pi/pi-coding-agent/session/session-paths";
import {
	isEmptySession,
	listAllSessions,
	listSessionsReadOnly,
	type SessionInfo,
} from "@oh-my-pi/pi-coding-agent/session/session-listing";
import { FileSessionStorage } from "@oh-my-pi/pi-coding-agent/session/session-storage";
import type { HostRow } from "./tty-ui";

/** `? /r` shows the newest sessions only; older ones are a job for the TUI or web picker. */
const PAST_SESSION_ROWS = 10;

/**
 * Resumable sessions, newest first: those started in `cwd`, or every project
 * with `all`. 0-turn stubs are skipped, as in the TUI resume picker.
 */
export async function listPastSessions(cwd: string, all: boolean, sessionsRoot?: string): Promise<SessionInfo[]> {
	const storage = new FileSessionStorage();
	const sessions = all
		? await listAllSessions(storage, sessionsRoot)
		: await listSessionsReadOnly(computeDefaultSessionDir(cwd, storage, sessionsRoot), storage);
	return sessions
		.filter(session => !isEmptySession(session))
		.sort((a, b) => b.modified.getTime() - a.modified.getTime())
		.slice(0, PAST_SESSION_ROWS);
}

export type PastSessionMatch = { ok: true; session: SessionInfo } | { ok: false; error: string };

/**
 * `? /r --id`: the past session (any project) whose id equals or uniquely
 * starts with `query`; 0-turn stubs are skipped. Errors list candidates.
 */
export async function resolvePastSession(query: string, sessionsRoot?: string): Promise<PastSessionMatch> {
	const sessions = (await listAllSessions(new FileSessionStorage(), sessionsRoot)).filter(
		session => !isEmptySession(session),
	);
	const exact = sessions.filter(session => session.id === query);
	const matches = exact.length > 0 ? exact : sessions.filter(session => session.id.startsWith(query));
	if (matches.length === 1) return { ok: true, session: matches[0]! };
	if (matches.length === 0) return { ok: false, error: `no session id starts with "${query}"` };
	const listed = matches.map(session => `  ${session.id}  ${session.cwd}`).join("\n");
	return { ok: false, error: `session id "${query}" is ambiguous:\n${listed}` };
}

/** Picker row for a past session; `instanceId` carries the session file path as the row key. */
export function sessionRow(session: SessionInfo): HostRow {
	const name = session.title ?? session.firstMessage.replace(/\s+/g, " ").trim();
	return {
		instanceId: session.path,
		sessionId: session.id,
		...(name ? { sessionName: name.slice(0, 80) } : {}),
		cwd: session.cwd,
		startedAt: session.modified.getTime(),
	};
}
