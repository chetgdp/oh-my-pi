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
