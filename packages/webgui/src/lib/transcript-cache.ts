import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { SessionEntry } from "@oh-my-pi/pi-coding-agent/session/session-entries";
import { browserWindow } from "./dom";

const DB_NAME = "webgui-transcripts";
const STORE_NAME = "transcripts";
const INDEX_KEY = "webgui.transcriptIndex";
const MAX_SESSIONS = 10;
const MAX_ENTRIES_PER_SESSION = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WRITE_THROTTLE_MS = 2000;
const MAX_SESSION_BYTES = 2 * 1024 * 1024; // 2MB serialized size limit
const MAX_NO_CACHE_SESSIONS = 500;
export interface CachedTranscript {
	leafId: string | null;
	entries: readonly SessionEntry[];
	hasMore: boolean;
	savedAt: number;
}

export interface TranscriptIndexPayload {
	byInstance: Record<string, { sessionId: string; leafId: string | null }>;
	bySession: Record<string, string | null>;
	// Session ids whose transcripts carried restored secrets; only ids, never content.
	noCache: string[];
}

export interface TranscriptCacheOptions {
	dbName?: string;
	now?: () => number;
	listenLifecycle?: boolean;
}

export interface TranscriptCache {
	readIndex(key: { instanceId?: string; sessionId?: string }): { sessionId?: string; leafId: string | null } | null;
	setIndex(mapping: { instanceId?: string; sessionId: string; leafId: string | null }): void;
	deleteIndex(key: { instanceId?: string; sessionId?: string }): void;
	loadSession(sessionId: string): Promise<CachedTranscript | null>;
	saveSessionThrottled(
		sessionId: string,
		data: { leafId: string | null; entries: readonly SessionEntry[]; hasMore: boolean },
		instanceId?: string,
	): void;
	dropSession(sessionId: string, instanceId?: string): Promise<void>;
	markNoCache(sessionId: string, instanceId?: string): Promise<void>;
	flush(): Promise<void>;
}

function parseIndex(raw: string | null): TranscriptIndexPayload {
	if (!raw) {
		return { byInstance: {}, bySession: {}, noCache: [] };
	}
	try {
		const parsed = JSON.parse(raw) as Partial<TranscriptIndexPayload>;
		return {
			byInstance: parsed.byInstance && typeof parsed.byInstance === "object" ? parsed.byInstance : {},
			bySession: parsed.bySession && typeof parsed.bySession === "object" ? parsed.bySession : {},
			noCache: Array.isArray(parsed.noCache) ? parsed.noCache.filter(id => typeof id === "string") : [],
		};
	} catch {
		return { byInstance: {}, bySession: {}, noCache: [] };
	}
}

function writeIndex(payload: TranscriptIndexPayload): void {
	try {
		browserWindow.localStorage?.setItem(INDEX_KEY, JSON.stringify(payload));
	} catch {
		// localStorage writes may fail under private browsing or storage quota.
	}
}

function getIndex(): TranscriptIndexPayload {
	try {
		return parseIndex(browserWindow.localStorage?.getItem(INDEX_KEY) ?? null);
	} catch {
		return { byInstance: {}, bySession: {}, noCache: [] };
	}
}

export function createTranscriptCache(options: TranscriptCacheOptions = {}): TranscriptCache {
	const { dbName = DB_NAME, now = Date.now, listenLifecycle = true } = options;
	let store: UseStore | null = null;
	const pendingSaves = new Map<
		string,
		{
			data: { leafId: string | null; entries: readonly SessionEntry[]; hasMore: boolean };
			instanceId?: string;
		}
	>();
	const dropGenerations = new Map<string, number>();
	let throttleTimer: Timer | undefined;
	function getDbStore(): UseStore {
		store ??= createStore(dbName, STORE_NAME);
		return store;
	}

	function pruneIndexKeys(index: TranscriptIndexPayload, validSessionIds: Set<string>): boolean {
		let changed = false;
		for (const sid of Object.keys(index.bySession)) {
			if (!validSessionIds.has(sid)) {
				delete index.bySession[sid];
				changed = true;
			}
		}
		for (const [inst, mapping] of Object.entries(index.byInstance)) {
			if (!validSessionIds.has(mapping.sessionId)) {
				delete index.byInstance[inst];
				changed = true;
			}
		}
		return changed;
	}

	async function evictOverflow(targetStore: UseStore, currentTime: number): Promise<void> {
		try {
			const all = await entries<string, unknown>(targetStore);
			const valid: { sessionId: string; savedAt: number }[] = [];
			for (const [key, value] of all) {
				if (typeof key !== "string") continue;
				if (!value || typeof value !== "object") {
					await del(key, targetStore).catch(() => {});
					continue;
				}
				const item = value as Partial<CachedTranscript>;
				const savedAt = typeof item.savedAt === "number" ? item.savedAt : 0;
				if (currentTime - savedAt > MAX_AGE_MS) {
					await del(key, targetStore).catch(() => {});
				} else {
					valid.push({ sessionId: key, savedAt });
				}
			}

			if (valid.length > MAX_SESSIONS) {
				valid.sort((a, b) => a.savedAt - b.savedAt);
				const toRemove = valid.slice(0, valid.length - MAX_SESSIONS);
				for (const item of toRemove) {
					await del(item.sessionId, targetStore).catch(() => {});
				}
				const remainingIds = new Set(valid.slice(valid.length - MAX_SESSIONS).map(v => v.sessionId));
				const index = getIndex();
				if (pruneIndexKeys(index, remainingIds)) {
					writeIndex(index);
				}
			} else {
				const remainingIds = new Set(valid.map(v => v.sessionId));
				const index = getIndex();
				if (pruneIndexKeys(index, remainingIds)) {
					writeIndex(index);
				}
			}
		} catch {
			// Best-effort cleanup.
		}
	}

	async function flush(): Promise<void> {
		if (throttleTimer !== undefined) {
			clearTimeout(throttleTimer);
			throttleTimer = undefined;
		}
		if (pendingSaves.size === 0) return;

		const target = getDbStore();
		const saves = Array.from(pendingSaves.entries());
		pendingSaves.clear();

		const currentTime = now();
		for (const [sessionId, { data, instanceId }] of saves) {
			if (getIndex().noCache.includes(sessionId)) continue;
			const dropGenBefore = dropGenerations.get(sessionId) ?? 0;

			const totalEntries = data.entries.length;
			let trimmedEntries = data.entries;
			let trimmedHasMore = data.hasMore;
			if (totalEntries > MAX_ENTRIES_PER_SESSION) {
				trimmedEntries = data.entries.slice(totalEntries - MAX_ENTRIES_PER_SESSION);
				trimmedHasMore = true;
			}

			const record: CachedTranscript = {
				leafId: data.leafId,
				entries: trimmedEntries,
				hasMore: trimmedHasMore,
				savedAt: currentTime,
			};

			try {
				const serialized = JSON.stringify(record);
				if (serialized.length > MAX_SESSION_BYTES) {
					// Cap per-session size: do not persist transcripts exceeding ~2MB serialized
					continue;
				}

				await set(sessionId, record, target);

				// If dropSession was invoked for this session while awaiting set, do not record index
				const dropGenAfter = dropGenerations.get(sessionId) ?? 0;
				if (dropGenAfter !== dropGenBefore) {
					await del(sessionId, target).catch(() => {});
					continue;
				}

				// Write the localStorage index only after the IDB record commits
				const index = getIndex();
				index.bySession[sessionId] = data.leafId;
				if (instanceId) {
					index.byInstance[instanceId] = { sessionId, leafId: data.leafId };
				}
				writeIndex(index);
			} catch {
				// Best-effort cache.
			}
		}

		await evictOverflow(target, currentTime);
	}

	if (listenLifecycle) {
		browserWindow.addEventListener?.("pagehide", () => void flush());
		browserWindow.document?.addEventListener?.("visibilitychange", () => {
			if (browserWindow.document?.visibilityState === "hidden") {
				void flush();
			}
		});
	}

	const api: TranscriptCache = {
		readIndex(key: { instanceId?: string; sessionId?: string }): {
			sessionId?: string;
			leafId: string | null;
		} | null {
			const index = getIndex();
			if (key.instanceId && index.byInstance[key.instanceId]) {
				const info = index.byInstance[key.instanceId];
				if (index.noCache.includes(info.sessionId)) return null;
				return { sessionId: info.sessionId, leafId: info.leafId };
			}
			if (key.sessionId && index.noCache.includes(key.sessionId)) return null;
			if (key.sessionId && Object.prototype.hasOwnProperty.call(index.bySession, key.sessionId)) {
				return { sessionId: key.sessionId, leafId: index.bySession[key.sessionId] ?? null };
			}
			return null;
		},

		setIndex(mapping: { instanceId?: string; sessionId: string; leafId: string | null }): void {
			const index = getIndex();
			if (index.noCache.includes(mapping.sessionId)) return;
			index.bySession[mapping.sessionId] = mapping.leafId;
			if (mapping.instanceId) {
				index.byInstance[mapping.instanceId] = {
					sessionId: mapping.sessionId,
					leafId: mapping.leafId,
				};
			}
			writeIndex(index);
		},

		deleteIndex(key: { instanceId?: string; sessionId?: string }): void {
			const index = getIndex();
			let changed = false;
			if (key.instanceId && index.byInstance[key.instanceId]) {
				delete index.byInstance[key.instanceId];
				changed = true;
			}
			if (key.sessionId && Object.prototype.hasOwnProperty.call(index.bySession, key.sessionId)) {
				delete index.bySession[key.sessionId];
				for (const [inst, val] of Object.entries(index.byInstance)) {
					if (val.sessionId === key.sessionId) {
						delete index.byInstance[inst];
					}
				}
				changed = true;
			}
			if (changed) {
				writeIndex(index);
			}
		},

		async loadSession(sessionId: string): Promise<CachedTranscript | null> {
			try {
				const target = getDbStore();
				const raw = await get<unknown>(sessionId, target);
				if (!raw || typeof raw !== "object") {
					// Prune missing session from localStorage index
					const index = getIndex();
					let changed = false;
					if (Object.prototype.hasOwnProperty.call(index.bySession, sessionId)) {
						delete index.bySession[sessionId];
						changed = true;
					}
					for (const [inst, val] of Object.entries(index.byInstance)) {
						if (val.sessionId === sessionId) {
							delete index.byInstance[inst];
							changed = true;
						}
					}
					if (changed) writeIndex(index);
					return null;
				}
				const item = raw as Partial<CachedTranscript>;
				const savedAt = typeof item.savedAt === "number" ? item.savedAt : 0;
				if (now() - savedAt > MAX_AGE_MS) {
					await del(sessionId, target).catch(() => {});
					const index = getIndex();
					let changed = false;
					if (Object.prototype.hasOwnProperty.call(index.bySession, sessionId)) {
						delete index.bySession[sessionId];
						changed = true;
					}
					for (const [inst, val] of Object.entries(index.byInstance)) {
						if (val.sessionId === sessionId) {
							delete index.byInstance[inst];
							changed = true;
						}
					}
					if (changed) writeIndex(index);
					return null;
				}
				if (!Array.isArray(item.entries)) return null;
				return {
					leafId: typeof item.leafId === "string" || item.leafId === null ? item.leafId : null,
					entries: item.entries,
					hasMore: Boolean(item.hasMore),
					savedAt,
				};
			} catch {
				return null;
			}
		},

		saveSessionThrottled(
			sessionId: string,
			data: { leafId: string | null; entries: readonly SessionEntry[]; hasMore: boolean },
			instanceId?: string,
		): void {
			if (getIndex().noCache.includes(sessionId)) return;
			pendingSaves.set(sessionId, { data, instanceId });
			if (throttleTimer === undefined) {
				throttleTimer = setTimeout(() => {
					throttleTimer = undefined;
					void flush();
				}, WRITE_THROTTLE_MS);
			}
		},

		async markNoCache(sessionId: string, instanceId?: string): Promise<void> {
			const index = getIndex();
			if (!index.noCache.includes(sessionId)) {
				index.noCache.push(sessionId);
				// Ids only, but bound the list so localStorage cannot grow without limit.
				if (index.noCache.length > MAX_NO_CACHE_SESSIONS) {
					index.noCache.splice(0, index.noCache.length - MAX_NO_CACHE_SESSIONS);
				}
				writeIndex(index);
			}
			await api.dropSession(sessionId, instanceId);
		},

		async dropSession(sessionId: string, instanceId?: string): Promise<void> {
			dropGenerations.set(sessionId, (dropGenerations.get(sessionId) ?? 0) + 1);
			pendingSaves.delete(sessionId);
			const index = getIndex();
			delete index.bySession[sessionId];
			if (instanceId) {
				delete index.byInstance[instanceId];
			}
			for (const [inst, val] of Object.entries(index.byInstance)) {
				if (val.sessionId === sessionId) {
					delete index.byInstance[inst];
				}
			}
			writeIndex(index);

			try {
				const target = getDbStore();
				await del(sessionId, target);
			} catch {
				// Best-effort
			}
		},

		flush,
	};
	return api;
}

export const defaultTranscriptCache = createTranscriptCache();
