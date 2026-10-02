import { createStore, del, entries, set, type UseStore } from "idb-keyval";
import { browserDocument, browserWindow } from "./dom";

const SAVE_DELAY_MS = 300;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_DRAFTS = 20;

export interface Draft {
	text: string;
	/** Data URLs, the format the composer attaches and sends. */
	images: readonly string[];
}

/** Images are stored as Blobs: base64 data URLs are a third larger. */
interface StoredDraft {
	text: string;
	images: Blob[];
	updatedAt: number;
}

interface Entry {
	draft: Draft;
	updatedAt: number;
}

export interface DraftStore {
	readDraft(key: string): Draft;
	writeDraft(key: string, draft: Draft): void;
	/** Fires once stored drafts are in memory, for composers that mounted before they arrived. */
	onDraftsHydrated(listener: () => void): () => void;
	/** Loads stored drafts in the background; never await it before first render. */
	hydrateDrafts(): Promise<void>;
	flushDrafts(): void;
}

export interface DraftStoreOptions {
	dbName?: string;
	now?: () => number;
	/** Page lifecycle flush hooks; tests run without a page. */
	listenLifecycle?: boolean;
}

const EMPTY: Draft = { text: "", images: [] };

export function draftKey(instanceId: string, agentId?: string): string {
	return `${instanceId}:${agentId ?? "Main"}`;
}

export function createDraftStore(options: DraftStoreOptions = {}): DraftStore {
	const { dbName = "webgui-drafts", now = Date.now, listenLifecycle = true } = options;
	const drafts = new Map<string, Entry>();
	const dirty = new Set<string>();
	const hydratedListeners = new Set<() => void>();
	let store: UseStore | null = null;
	let saveTimer: Timer | undefined;

	function evictOverflow(): void {
		if (drafts.size <= MAX_DRAFTS) return;
		const oldest = [...drafts].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
		for (const [key] of oldest.slice(0, drafts.size - MAX_DRAFTS)) {
			drafts.delete(key);
			dirty.add(key);
		}
	}

	function flushDrafts(): void {
		clearTimeout(saveTimer);
		saveTimer = undefined;
		const target = store;
		if (!target) return;
		for (const key of dirty) {
			const entry = drafts.get(key);
			// Drafts are best effort; a failed write must never surface to the user.
			if (!entry) {
				del(key, target).catch(() => {});
				continue;
			}
			const { draft, updatedAt } = entry;
			if (draft.images.length === 0) {
				set(key, { text: draft.text, images: [], updatedAt } satisfies StoredDraft, target).catch(() => {});
				continue;
			}
			Promise.all(draft.images.map(dataUrlToBlob))
				.then(images => {
					// A newer edit may have replaced or removed this draft while the images converted.
					if (drafts.get(key) !== entry) return;
					return set(key, { text: draft.text, images, updatedAt } satisfies StoredDraft, target);
				})
				.catch(() => {});
		}
		dirty.clear();
	}

	return {
		readDraft(key) {
			return drafts.get(key)?.draft ?? EMPTY;
		},
		writeDraft(key, draft) {
			const prev = drafts.get(key)?.draft ?? EMPTY;
			if (draft.text === prev.text && draft.images === prev.images) return;
			if (draft.text.trim() === "" && draft.images.length === 0) {
				if (!drafts.has(key)) return;
				drafts.delete(key);
			} else {
				drafts.set(key, { draft, updatedAt: now() });
				evictOverflow();
			}
			dirty.add(key);
			if (!store) return;
			clearTimeout(saveTimer);
			saveTimer = setTimeout(flushDrafts, SAVE_DELAY_MS);
		},
		onDraftsHydrated(listener) {
			hydratedListeners.add(listener);
			return () => hydratedListeners.delete(listener);
		},
		flushDrafts,
		async hydrateDrafts() {
			if (store) return;
			const at = now();
			try {
				store = createStore(dbName, "drafts");
				const stored = await entries<string, unknown>(store);
				const decoded = await Promise.all(
					stored.map(async ([key, value]) => ({
						key,
						entry: await decodeStored(value, at).catch(() => null),
						legacy: !(value && typeof value === "object" && "updatedAt" in value),
					})),
				);
				for (const { key, entry, legacy } of decoded) {
					if (typeof key !== "string") continue;
					// A draft typed before hydration finished is newer than the stored one.
					if (dirty.has(key)) continue;
					if (!entry) {
						dirty.add(key);
						continue;
					}
					drafts.set(key, entry);
					// Rewrite undated values so they carry a timestamp and can expire.
					if (legacy) dirty.add(key);
				}
				evictOverflow();
			} catch {
				store = null;
				return;
			}
			if (listenLifecycle) {
				browserWindow.addEventListener("pagehide", flushDrafts);
				browserDocument.addEventListener("visibilitychange", () => {
					if (browserDocument.visibilityState === "hidden") flushDrafts();
				});
			}
			if (dirty.size > 0) flushDrafts();
			for (const listener of hydratedListeners) listener();
		},
	};
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
	return (await fetch(dataUrl)).blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	const reader = new FileReader();
	reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("not text")));
	reader.onerror = () => reject(new Error("read failed"));
	reader.readAsDataURL(blob);
	return promise;
}

/** Returns null for unreadable or expired values; the caller deletes them. */
async function decodeStored(value: unknown, now: number): Promise<Entry | null> {
	// Plain strings came from a build without images or timestamps.
	if (typeof value === "string")
		return value.trim() === "" ? null : { draft: { text: value, images: [] }, updatedAt: now };
	if (!value || typeof value !== "object" || !("text" in value) || !("images" in value)) return null;
	const { text, images } = value;
	if (typeof text !== "string" || !Array.isArray(images)) return null;
	const updatedAt = "updatedAt" in value && typeof value.updatedAt === "number" ? value.updatedAt : now;
	if (now - updatedAt > MAX_AGE_MS) return null;
	const blobs = images.filter((b): b is Blob => b instanceof Blob);
	return { draft: { text, images: await Promise.all(blobs.map(blobToDataUrl)) }, updatedAt };
}

const defaultStore = createDraftStore();
export const { readDraft, writeDraft, onDraftsHydrated, hydrateDrafts } = defaultStore;
