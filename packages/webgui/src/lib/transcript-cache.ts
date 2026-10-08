import { createStore, del, get, keys, set, type UseStore } from "idb-keyval";
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
	// Last successful save per cached session; drives eviction without loading records.
	savedAt: Record<string, number>;
}

export interface TranscriptCacheOptions {
	dbName?: string;
	now?: () => number;
	listenLifecycle?: boolean;
	/** Bench seam: receives the duration of each post-flush eviction pass. */
	onEvictTiming?: (durationMs: number) => void;
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

function emptyIndex(): TranscriptIndexPayload {
	return { byInstance: {}, bySession: {}, noCache: [], savedAt: {} };
}

function parseIndex(raw: string | null): TranscriptIndexPayload {
	if (!raw) return emptyIndex();
	try {
		const parsed = JSON.parse(raw) as Partial<TranscriptIndexPayload>;
		const savedAt: Record<string, number> = {};
		if (parsed.savedAt && typeof parsed.savedAt === "object") {
			for (const [sid, at] of Object.entries(parsed.savedAt)) {
				if (typeof at === "number") savedAt[sid] = at;
			}
		}
		return {
			byInstance: parsed.byInstance && typeof parsed.byInstance === "object" ? parsed.byInstance : {},
			bySession: parsed.bySession && typeof parsed.bySession === "object" ? parsed.bySession : {},
			noCache: Array.isArray(parsed.noCache) ? parsed.noCache.filter(id => typeof id === "string") : [],
			savedAt,
		};
	} catch {
		return emptyIndex();
	}
}

/** Serialized JSON length per entry; entries are immutable once stored in the transcript. */
const entrySizeCache = new WeakMap<SessionEntry, number>();

function entrySize(entry: SessionEntry): number {
	let size = entrySizeCache.get(entry);
	if (size === undefined) {
		size = JSON.stringify(entry).length;
		entrySizeCache.set(entry, size);
	}
	return size;
}

/** Exact `JSON.stringify(record).length` computed from cached per-entry sizes. */
function serializedRecordSize(record: CachedTranscript): number {
	let size = JSON.stringify({ ...record, entries: [] }).length;
	for (const entry of record.entries) size += entrySize(entry);
	if (record.entries.length > 1) size += record.entries.length - 1;
	return size;
}

export function createTranscriptCache(options: TranscriptCacheOptions = {}): TranscriptCache {
	const { dbName = DB_NAME, now = Date.now, listenLifecycle = true, onEvictTiming } = options;
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
	// In-memory copy of the localStorage index: parsed lazily once, written through,
	// invalidated when another tab changes it.
	let index: TranscriptIndexPayload | null = null;
	// First flush sweeps IDB once to delete orphans left by older builds or other tabs.
	let sweptStore = false;

	function getIndex(): TranscriptIndexPayload {
		if (index === null) {
			try {
				index = parseIndex(browserWindow.localStorage?.getItem(INDEX_KEY) ?? null);
			} catch {
				index = emptyIndex();
			}
		}
		return index;
	}

	function writeIndex(payload: TranscriptIndexPayload): void {
		index = payload;
		try {
			browserWindow.localStorage?.setItem(INDEX_KEY, JSON.stringify(payload));
		} catch {
			// localStorage writes may fail under private browsing or storage quota.
		}
	}

	browserWindow.addEventListener?.("storage", event => {
		const key = event && typeof event === "object" && "key" in event ? event.key : null;
		if (key === null || key === INDEX_KEY) index = null;
	});

	function getDbStore(): UseStore {
		store ??= createStore(dbName, STORE_NAME);
		return store;
	}

	/** Remove every index reference to `sessionId`; returns whether anything changed. */
	function forgetSession(payload: TranscriptIndexPayload, sessionId: string): boolean {
		let changed = false;
		if (Object.hasOwn(payload.bySession, sessionId)) {
			delete payload.bySession[sessionId];
			changed = true;
		}
		if (Object.hasOwn(payload.savedAt, sessionId)) {
			delete payload.savedAt[sessionId];
			changed = true;
		}
		for (const [inst, val] of Object.entries(payload.byInstance)) {
			if (val.sessionId === sessionId) {
				delete payload.byInstance[inst];
				changed = true;
			}
		}
		return changed;
	}

	function needsEviction(payload: TranscriptIndexPayload, currentTime: number): boolean {
		const times = Object.values(payload.savedAt);
		if (times.length > MAX_SESSIONS) return true;
		for (const at of times) {
			if (currentTime - at > MAX_AGE_MS) return true;
		}
		return false;
	}

	async function evictOverflow(targetStore: UseStore, currentTime: number): Promise<void> {
		try {
			const payload = getIndex();
			if (sweptStore && !needsEviction(payload, currentTime)) return;
			const storedKeys = await keys(targetStore);
			sweptStore = true;
			const live = getIndex();
			let changed = false;
			const valid: { sessionId: string; savedAt: number }[] = [];
			const stored = new Set<string>();
			for (const key of storedKeys) {
				if (typeof key !== "string") {
					await del(key, targetStore).catch(() => {});
					continue;
				}
				stored.add(key);
				let savedAt = live.savedAt[key];
				if (savedAt === undefined) {
					if (!Object.hasOwn(live.bySession, key)) {
						// Orphan: no index entry references this record.
						await del(key, targetStore).catch(() => {});
						continue;
					}
					// Index written by a build without savedAt: adopt the record as fresh.
					savedAt = currentTime;
					live.savedAt[key] = savedAt;
					changed = true;
				}
				if (currentTime - savedAt > MAX_AGE_MS) {
					await del(key, targetStore).catch(() => {});
					changed = forgetSession(live, key) || changed;
				} else {
					valid.push({ sessionId: key, savedAt });
				}
			}
			if (valid.length > MAX_SESSIONS) {
				valid.sort((x, y) => x.savedAt - y.savedAt);
				for (const item of valid.slice(0, valid.length - MAX_SESSIONS)) {
					await del(item.sessionId, targetStore).catch(() => {});
					changed = forgetSession(live, item.sessionId) || changed;
					stored.delete(item.sessionId);
				}
			}
			// Index entries whose record is gone.
			for (const sid of new Set([...Object.keys(live.bySession), ...Object.keys(live.savedAt)])) {
				if (!stored.has(sid)) changed = forgetSession(live, sid) || changed;
			}
			for (const [inst, mapping] of Object.entries(live.byInstance)) {
				if (!stored.has(mapping.sessionId)) {
					delete live.byInstance[inst];
					changed = true;
				}
			}
			if (changed) writeIndex(live);
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
				// Cap per-session size: do not persist transcripts exceeding ~2MB serialized.
				if (serializedRecordSize(record) > MAX_SESSION_BYTES) continue;

				await set(sessionId, record, target);

				// If dropSession was invoked for this session while awaiting set, do not record index
				const dropGenAfter = dropGenerations.get(sessionId) ?? 0;
				if (dropGenAfter !== dropGenBefore) {
					await del(sessionId, target).catch(() => {});
					continue;
				}

				// Write the localStorage index only after the IDB record commits
				const payload = getIndex();
				payload.bySession[sessionId] = data.leafId;
				payload.savedAt[sessionId] = currentTime;
				if (instanceId) {
					payload.byInstance[instanceId] = { sessionId, leafId: data.leafId };
				}
				writeIndex(payload);
			} catch {
				// Best-effort cache.
			}
		}

		const evictStart = performance.now();
		await evictOverflow(target, currentTime);
		onEvictTiming?.(performance.now() - evictStart);
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
					if (forgetSession(index, sessionId)) writeIndex(index);
					return null;
				}
				const item = raw as Partial<CachedTranscript>;
				const savedAt = typeof item.savedAt === "number" ? item.savedAt : 0;
				if (now() - savedAt > MAX_AGE_MS) {
					await del(sessionId, target).catch(() => {});
					const index = getIndex();
					if (forgetSession(index, sessionId)) writeIndex(index);
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
			if (instanceId) {
				delete index.byInstance[instanceId];
			}
			forgetSession(index, sessionId);
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
