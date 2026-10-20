/**
 * Multi-server operator: the client talks to one webgui daemon per machine.
 *
 * The page's own origin is the implicit `local` server and uses relative
 * URLs; added servers live in localStorage under `webgui.servers`.
 * Sessions are identified by `{serverId, instanceId}`; routes and caches
 * use the string form from `sessionKey`.
 */

import type { LiveSessionEntry } from "../server/live";
import type { FetchLike, SessionListApi } from "./sessions-api";
import { createSessionsApi } from "./sessions-api";

export const LOCAL_SERVER_ID = "local";
export const SERVERS_STORAGE_KEY = "webgui.servers";

export interface ServerEntry {
	id: string;
	name: string;
	/** Origin without trailing slash; empty for `local` (relative URLs). */
	url: string;
}

export interface SessionRef {
	serverId: string;
	instanceId: string;
}

export type ServerStatus = "loading" | "up" | "down";

export interface ServerLiveState {
	server: ServerEntry;
	status: ServerStatus;
	error: string | null;
	live: LiveSessionEntry[];
}

export interface KeyedLiveEntry extends LiveSessionEntry {
	serverId: string;
	/** `sessionKey` of this entry; unique across servers. */
	key: string;
}

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

/** Instance ids match `[a-zA-Z0-9_-]+` (relay route), so `~` cannot collide. */
const KEY_SEP = "~";
const SERVER_ID_RE = /^[a-z0-9]{1,32}$/;

export function sessionKey(ref: SessionRef): string {
	return ref.serverId === LOCAL_SERVER_ID ? ref.instanceId : `${ref.serverId}${KEY_SEP}${ref.instanceId}`;
}

/** Keys without a server prefix are `local`, so pre-multi-server links keep working. */
export function parseSessionKey(key: string): SessionRef {
	const sep = key.indexOf(KEY_SEP);
	if (sep <= 0) return { serverId: LOCAL_SERVER_ID, instanceId: key };
	return { serverId: key.slice(0, sep), instanceId: key.slice(sep + 1) };
}

function isServerEntry(v: unknown): v is ServerEntry {
	if (!v || typeof v !== "object") return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.id === "string" &&
		SERVER_ID_RE.test(o.id) &&
		o.id !== LOCAL_SERVER_ID &&
		typeof o.name === "string" &&
		typeof o.url === "string" &&
		normalizeServerUrl(o.url) === o.url
	);
}

export function loadServers(storage: StorageLike | null): ServerEntry[] {
	if (!storage) return [];
	let raw: string | null;
	try {
		raw = storage.getItem(SERVERS_STORAGE_KEY);
	} catch {
		return [];
	}
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const seen = new Set<string>();
		return parsed
			.filter((e): e is ServerEntry => {
				if (!isServerEntry(e) || seen.has(e.id) || seen.has(e.url)) return false;
				seen.add(e.id);
				seen.add(e.url);
				return true;
			})
			.map(e => ({ id: e.id, name: e.name, url: e.url }));
	} catch {
		return [];
	}
}

export function saveServers(storage: StorageLike | null, servers: readonly ServerEntry[]): void {
	if (!storage) return;
	try {
		storage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(servers.map(s => ({ id: s.id, name: s.name, url: s.url }))));
	} catch {
		// Quota or private mode: the list stays in memory for this page.
	}
}

/** Accepts `host`, `host:port` or a full URL; returns its http(s) origin, or null. */
export function normalizeServerUrl(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	let parsed: URL;
	try {
		parsed = new URL(withScheme);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
	if (parsed.username || parsed.password) return null;
	return parsed.origin;
}

export function wsUrlFor(server: ServerEntry, instanceId: string, pageOrigin: string): string {
	const base = server.url || pageOrigin;
	const url = new URL(base);
	const proto = url.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${url.host}/ws/${instanceId}`;
}

/** Poll every server's live list; a failing server is `down` and never hides the others. */
export async function pollServers(
	servers: readonly ServerEntry[],
	apiFor: (id: string) => SessionListApi,
	signal?: AbortSignal,
): Promise<ServerLiveState[]> {
	const results = await Promise.allSettled(servers.map(s => apiFor(s.id).listLive(signal)));
	return servers.map((server, i) => {
		const r = results[i]!;
		if (r.status === "fulfilled") return { server, status: "up", error: null, live: r.value };
		const reason: unknown = r.reason;
		return { server, status: "down", error: reason instanceof Error ? reason.message : String(reason), live: [] };
	});
}

export function mergeLive(states: readonly ServerLiveState[]): KeyedLiveEntry[] {
	const out: KeyedLiveEntry[] = [];
	for (const st of states) {
		for (const e of st.live) {
			out.push({
				...e,
				serverId: st.server.id,
				key: sessionKey({ serverId: st.server.id, instanceId: e.instanceId }),
			});
		}
	}
	return out;
}

export interface ServerOperatorOptions {
	storage: StorageLike | null;
	/** Page origin; names the implicit `local` entry. */
	origin: string;
	fetchImpl?: FetchLike;
	/** Test seam; defaults to `createSessionsApi`. */
	createApi?: (baseUrl: string) => SessionListApi;
}

export interface ServerOperator {
	/** `local` first, then stored entries. Stable reference until a mutation. */
	list(): readonly ServerEntry[];
	get(id: string): ServerEntry | undefined;
	subscribe(listener: () => void): () => void;
	add(url: string, name?: string): ServerEntry;
	rename(id: string, name: string): void;
	remove(id: string): void;
	apiFor(id: string): SessionListApi;
	/** `""` for `local`, else the server origin. */
	baseUrl(id: string): string | null;
	wsUrl(ref: SessionRef): string | null;
	poll(signal?: AbortSignal): Promise<ServerLiveState[]>;
}

function randomId(): string {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	let s = "";
	for (const b of bytes) s += b.toString(36).padStart(2, "0");
	return s.slice(0, 10);
}

export function createServerOperator(opts: ServerOperatorOptions): ServerOperator {
	const { storage, origin } = opts;
	const createApi = opts.createApi ?? ((base: string) => createSessionsApi(base, opts.fetchImpl));
	let localName: string;
	try {
		localName = new URL(origin).hostname || "local";
	} catch {
		localName = "local";
	}
	const local: ServerEntry = { id: LOCAL_SERVER_ID, name: localName, url: "" };
	let remotes = loadServers(storage).filter(s => s.url !== origin);
	let all: readonly ServerEntry[] = [local, ...remotes];
	const apis = new Map<string, { url: string; api: SessionListApi }>();
	const listeners = new Set<() => void>();

	function commit(next: ServerEntry[]): void {
		remotes = next;
		all = [local, ...remotes];
		saveServers(storage, remotes);
		for (const l of listeners) l();
	}

	const op: ServerOperator = {
		list: () => all,
		get: id => all.find(s => s.id === id),
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		add(input, name) {
			const url = normalizeServerUrl(input);
			if (!url) throw new Error("Enter an http(s) URL or host name");
			if (url === origin) throw new Error("That is this page's own server");
			if (remotes.some(s => s.url === url)) throw new Error("Server already added");
			let id = randomId();
			while (all.some(s => s.id === id)) id = randomId();
			const entry: ServerEntry = { id, name: name?.trim() || new URL(url).hostname, url };
			commit([...remotes, entry]);
			return entry;
		},
		rename(id, name) {
			const trimmed = name.trim();
			if (!trimmed || id === LOCAL_SERVER_ID) return;
			commit(remotes.map(s => (s.id === id ? { ...s, name: trimmed } : s)));
		},
		remove(id) {
			if (id === LOCAL_SERVER_ID) return;
			apis.delete(id);
			commit(remotes.filter(s => s.id !== id));
		},
		apiFor(id) {
			const server = op.get(id);
			if (!server) throw new Error(`Unknown server ${id}`);
			const cached = apis.get(id);
			if (cached && cached.url === server.url) return cached.api;
			const api = createApi(server.url);
			apis.set(id, { url: server.url, api });
			return api;
		},
		baseUrl: id => op.get(id)?.url ?? null,
		wsUrl(ref) {
			const server = op.get(ref.serverId);
			return server ? wsUrlFor(server, ref.instanceId, origin) : null;
		},
		poll: signal => pollServers(all, op.apiFor, signal),
	};
	return op;
}
