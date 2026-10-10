import * as fs from "node:fs";
import * as path from "node:path";
import { getBaseConfigRoot } from "@oh-my-pi/pi-utils";

export const PANE_STATE_VERSION = 1;

export interface PaneState {
	version: number;
	instanceId: string;
	clientId: string;
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
	return { version: PANE_STATE_VERSION, instanceId: o.instanceId, clientId: o.clientId };
}

/** Attaches the pane to `instanceId`; written atomically, 0600 in a 0700 dir. */
export function writePaneState(paneKey: string, instanceId: string, dir: string = paneStateDir()): PaneState {
	const state: PaneState = { version: PANE_STATE_VERSION, instanceId, clientId: paneClientId(paneKey) };
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	fs.chmodSync(dir, 0o700);
	const target = statePath(dir, paneKey);
	const tmp = `${target}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(state)}\n`, { mode: 0o600 });
	fs.renameSync(tmp, target);
	return state;
}

export function clearPaneState(paneKey: string, dir: string = paneStateDir()): void {
	fs.rmSync(statePath(dir, paneKey), { force: true });
}
