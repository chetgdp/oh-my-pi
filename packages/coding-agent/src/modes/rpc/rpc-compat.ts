import type { SessionEntry } from "../../session/session-entries";

/**
 * Slice canonical append-history for the Pi-compatible `get_entries` command.
 *
 * Delegates to the canonical `SessionManager` entry list (append order) and
 * applies only the `since` cursor — never a second history/indexing layer.
 *
 * - no `since` → all entries in append order;
 * - `since` → entries strictly after the matching durable entry;
 * - unknown `since` → throws; the caller maps it to an explicit RPC failure;
 * - `limit` → after `since`, keep only the last `limit` entries;
 * - always passes through the current `leafId` unchanged.
 */
export function selectRpcEntries(
	entries: readonly SessionEntry[],
	leafId: string | null,
	since?: string,
	limit?: number,
): { entries: SessionEntry[]; leafId: string | null } {
	if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
		throw new RangeError(`Invalid entries limit: ${limit}`);
	}
	let start = 0;
	if (since !== undefined) {
		const index = entries.findIndex(entry => entry.id === since);
		if (index === -1) throw new Error(`Unknown entries cursor: ${since}`);
		start = index + 1;
	}
	if (limit !== undefined) start = Math.max(start, entries.length - limit);
	return { entries: entries.slice(start), leafId };
}
