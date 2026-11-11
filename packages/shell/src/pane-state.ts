import * as fs from "node:fs";
import * as path from "node:path";
import { getBaseConfigRoot } from "@oh-my-pi/pi-utils";

export const PANE_STATE_VERSION = 1;

export interface PaneState {
	version: number;
	instanceId: string;
	clientId: string;
	/**
	 * Session leaf id when Ctrl-C detached this pane; the next `?` replays the entries after it.
	 * Optional within version 1: older files stay valid and older shells ignore the field.
	 */
	bookmark?: string;
	/**
	 * Session id of the bound instance, so a pane whose instance died re-attaches to whatever
	 * live process now serves that session. Optional within version 1: older files lack it.
	 */
	sessionId?: string;
}

export function paneStateDir(root: string = getBaseConfigRoot()): string {
	return path.join(root, "run", "shell-panes");
}

export function paneClientId(paneKey: string): string {
	return `shell-${paneKey}`;
}

function statePath(dir: string, paneKey: string): string {
	if (paneKey.includes("/") || paneKey.length === 0) throw new Error(`invalid pane key: ${paneKey}`);
	return path.join(dir, `${paneKey}.json`);
}

export function readPaneState(paneKey: string, dir: string = paneStateDir()): PaneState | null {
	let text: string;
	try {
		text = fs.readFileSync(statePath(dir, paneKey), "utf8");
	} catch {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const o = parsed as Record<string, unknown>;
	if (o.version !== PANE_STATE_VERSION) return null;
	if (typeof o.instanceId !== "string" || o.instanceId.length === 0) return null;
	if (typeof o.clientId !== "string" || o.clientId.length === 0) return null;
	const state: PaneState = { version: PANE_STATE_VERSION, instanceId: o.instanceId, clientId: o.clientId };
	if (typeof o.bookmark === "string" && o.bookmark.length > 0) state.bookmark = o.bookmark;
	if (typeof o.sessionId === "string" && o.sessionId.length > 0) state.sessionId = o.sessionId;
	return state;
}

/**
 * Attaches the pane to `instanceId` serving `sessionId`; written atomically, 0600 in a 0700 dir.
 * The bookmark carries over to the same instance, or to another instance serving the same
 * session: the bookmark is a leaf id of that session file, valid whichever process serves it.
 */
export function writePaneState(
	paneKey: string,
	instanceId: string,
	dir: string = paneStateDir(),
	sessionId?: string | null,
): PaneState {
	const previous = readPaneState(paneKey, dir);
	const state: PaneState = { version: PANE_STATE_VERSION, instanceId, clientId: paneClientId(paneKey) };
	if (sessionId) state.sessionId = sessionId;
	const sameTarget =
		previous?.instanceId === instanceId ||
		(sessionId !== undefined && sessionId !== null && previous?.sessionId === sessionId);
	if (sameTarget && previous?.bookmark !== undefined) state.bookmark = previous.bookmark;
	persist(paneKey, state, dir);
	return state;
}

/** Sets (or with null clears) the replay bookmark; ignored unless the pane is attached to `instanceId`. */
export function setPaneBookmark(
	paneKey: string,
	instanceId: string,
	bookmark: string | null,
	dir: string = paneStateDir(),
): void {
	const state = readPaneState(paneKey, dir);
	if (state?.instanceId !== instanceId) return;
	if (bookmark === null) {
		if (state.bookmark === undefined) return;
		delete state.bookmark;
	} else {
		state.bookmark = bookmark;
	}
	persist(paneKey, state, dir);
}

function persist(paneKey: string, state: PaneState, dir: string): void {
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	fs.chmodSync(dir, 0o700);
	const target = statePath(dir, paneKey);
	const tmp = `${target}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(state)}\n`, { mode: 0o600 });
	fs.renameSync(tmp, target);
}

export function clearPaneState(paneKey: string, dir: string = paneStateDir()): void {
	fs.rmSync(statePath(dir, paneKey), { force: true });
}
