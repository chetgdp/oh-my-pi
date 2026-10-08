import type { RpcAvailableSlashCommand } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-types";
import { browserWindow } from "./dom";

const STORAGE_KEY = "webgui.commandsCatalog";
// Catalogs are content-addressed and instances in one checkout share one, so a few cover every open session.
const MAX_CATALOGS = 4;
const MAX_INSTANCES = 50;

interface CatalogStore {
	/** Insertion order doubles as recency: the last key is the newest. */
	catalogs: Record<string, RpcAvailableSlashCommand[]>;
	byInstance: Record<string, string>;
}

function emptyStore(): CatalogStore {
	return { catalogs: {}, byInstance: {} };
}

function readStore(): CatalogStore {
	try {
		const raw = browserWindow.localStorage?.getItem(STORAGE_KEY);
		if (!raw) return emptyStore();
		const parsed = JSON.parse(raw) as Partial<CatalogStore>;
		const catalogs: CatalogStore["catalogs"] = {};
		if (parsed.catalogs && typeof parsed.catalogs === "object") {
			for (const [hash, commands] of Object.entries(parsed.catalogs)) {
				if (Array.isArray(commands)) catalogs[hash] = commands;
			}
		}
		const byInstance: CatalogStore["byInstance"] = {};
		if (parsed.byInstance && typeof parsed.byInstance === "object") {
			for (const [id, hash] of Object.entries(parsed.byInstance)) {
				if (typeof hash === "string" && hash in catalogs) byInstance[id] = hash;
			}
		}
		return { catalogs, byInstance };
	} catch {
		return emptyStore();
	}
}

/**
 * The slash-command catalog an instance last pushed, with the host's hash for it.
 * The hash goes on the socket URL so the host can skip re-sending an unchanged catalog.
 */
export function readCachedCommands(
	instanceId: string,
): { hash: string; commands: readonly RpcAvailableSlashCommand[] } | null {
	const store = readStore();
	const hash = store.byInstance[instanceId];
	if (hash === undefined) return null;
	const commands = store.catalogs[hash];
	return commands ? { hash, commands } : null;
}

export function writeCachedCommands(
	instanceId: string,
	hash: string,
	commands: readonly RpcAvailableSlashCommand[],
): void {
	const store = readStore();
	delete store.catalogs[hash];
	store.catalogs[hash] = [...commands];
	delete store.byInstance[instanceId];
	store.byInstance[instanceId] = hash;

	const instanceIds = Object.keys(store.byInstance);
	for (const id of instanceIds.slice(0, Math.max(0, instanceIds.length - MAX_INSTANCES))) {
		delete store.byInstance[id];
	}
	const hashes = Object.keys(store.catalogs);
	for (const old of hashes.slice(0, Math.max(0, hashes.length - MAX_CATALOGS))) {
		delete store.catalogs[old];
	}
	for (const [id, h] of Object.entries(store.byInstance)) {
		if (!(h in store.catalogs)) delete store.byInstance[id];
	}
	try {
		browserWindow.localStorage?.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// Quota or private browsing: the host just pushes the catalog again next connect.
	}
}
