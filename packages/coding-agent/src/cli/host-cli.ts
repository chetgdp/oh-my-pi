/**
 * `omp host list` and `omp host stop`: human table and picker on a terminal,
 * JSON lines with `--json` for scripts.
 */
import { selectStandaloneItem } from "@oh-my-pi/pi-tui/apps/standalone-picker";
import { sanitizeDisplayLine } from "@oh-my-pi/pi-tui/overlays/extensions/display-text";
import { shortenPath } from "@oh-my-pi/pi-tui/render/render-utils";
import { truncateToWidth } from "@oh-my-pi/pi-tui/utils";
import { listLiveRpcHosts, type RpcHostEntry } from "../modes/rpc/rpc-registry";
import {
	type LiveSessionRow,
	listLiveSessions,
	resolveLiveSession,
	stopRpcSession,
} from "../modes/rpc/rpc-session-list";

const STOP_TIMEOUT_MS = 15_000;
const MIN_ID_LENGTH = 8;
const NAME_WIDTH = 48;
const TABLE_HEADER = ["STATE", "KIND", "PID", "ID", "NAME", "CWD"];

/** Shortest id prefix (at least {@link MIN_ID_LENGTH}) that tells every listed session apart. */
export function uniqueIdLength(ids: readonly string[]): number {
	let length = MIN_ID_LENGTH;
	const longest = Math.max(MIN_ID_LENGTH, ...ids.map(id => id.length));
	while (length < longest && new Set(ids.map(id => id.slice(0, length))).size < ids.length) length++;
	return length;
}

/** Table lines for `omp host list`; `maxWidth` cuts each line (Infinity when piped). */
export function formatSessionTable(rows: readonly LiveSessionRow[], maxWidth: number): string[] {
	const idLength = uniqueIdLength(rows.map(row => row.sessionId));
	const cells = rows.map(row => [
		row.state,
		row.kind,
		String(row.pid),
		row.sessionId.slice(0, idLength),
		truncateToWidth(sanitizeDisplayLine(row.sessionName ?? ""), NAME_WIDTH),
		shortenPath(row.cwd),
	]);
	const widths = TABLE_HEADER.map((title, column) =>
		Math.max(title.length, ...cells.map(row => Bun.stringWidth(row[column]!))),
	);
	return [TABLE_HEADER, ...cells].map(row => {
		const line = row
			.map((cell, column) => cell + " ".repeat(Math.max(0, widths[column]! - Bun.stringWidth(cell))))
			.join("  ")
			.trimEnd();
		return Number.isFinite(maxWidth) ? truncateToWidth(line, maxWidth) : line;
	});
}

export async function runHostList(registryDir: string | undefined, json: boolean): Promise<void> {
	const sessions = await listLiveSessions({ dir: registryDir }, `host-list-${process.pid}`);
	if (json) {
		for (const { row } of sessions) process.stdout.write(`${JSON.stringify(row)}\n`);
		return;
	}
	if (sessions.length === 0) {
		process.stdout.write("no live sessions\n");
		return;
	}
	const maxWidth = process.stdout.isTTY ? (process.stdout.columns ?? 120) : Number.POSITIVE_INFINITY;
	const lines = formatSessionTable(
		sessions.map(session => session.row),
		maxWidth,
	);
	process.stdout.write(`${lines.join("\n")}\n`);
}

async function pickSession(registryDir: string | undefined): Promise<RpcHostEntry | "none" | "cancelled"> {
	const sessions = await listLiveSessions({ dir: registryDir }, `host-stop-${process.pid}`);
	if (sessions.length === 0) return "none";
	const idLength = uniqueIdLength(sessions.map(session => session.row.sessionId));
	const items = sessions.map(({ entry, row }) => ({
		value: entry.instanceId,
		label: `${row.state.padEnd(7)}  ${row.kind.padEnd(4)}  ${sanitizeDisplayLine(row.sessionName ?? row.sessionId)}`,
		description: `${shortenPath(row.cwd)}  ${row.sessionId.slice(0, idLength)}  pid ${row.pid}`,
	}));
	const picked = await selectStandaloneItem("Stop which session?", items, {
		maxVisible: 12,
		overlay: { fullscreen: true },
	});
	return sessions.find(session => session.entry.instanceId === picked)?.entry ?? "cancelled";
}

/** Exit code: 0 stopped or picker cancelled, 1 failure, 2 usage. */
export async function runHostStop(registryDir: string | undefined, id: string | undefined): Promise<number> {
	let entry: RpcHostEntry;
	if (id) {
		const match = resolveLiveSession(await listLiveRpcHosts({ dir: registryDir }), id);
		if (!match.ok) {
			process.stderr.write(`${match.error}\n`);
			return 1;
		}
		entry = match.entry;
	} else {
		if (!process.stdin.isTTY || !process.stdout.isTTY) {
			process.stderr.write("omp host stop needs a session id when not run in a terminal (see omp host list)\n");
			return 2;
		}
		const picked = await pickSession(registryDir);
		if (picked === "none") {
			process.stderr.write("no live sessions\n");
			return 1;
		}
		if (picked === "cancelled") return 0;
		entry = picked;
	}
	const label = entry.sessionName
		? `${entry.sessionName} (${entry.sessionId})`
		: (entry.sessionId ?? entry.instanceId);
	try {
		if (await stopRpcSession({ dir: registryDir }, entry, `host-stop-${process.pid}`, STOP_TIMEOUT_MS)) {
			process.stdout.write(`stopped ${sanitizeDisplayLine(label)}\n`);
			return 0;
		}
		process.stderr.write(`${sanitizeDisplayLine(label)} still running after ${STOP_TIMEOUT_MS / 1000}s\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	}
	return 1;
}
