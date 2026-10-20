import { describe, expect, test } from "bun:test";
import {
	createServerOperator,
	LOCAL_SERVER_ID,
	loadServers,
	mergeLive,
	normalizeServerUrl,
	parseSessionKey,
	saveServers,
	SERVERS_STORAGE_KEY,
	sessionKey,
	wsUrlFor,
} from "../src/lib/servers";
import type { StorageLike } from "../src/lib/servers";
import type { SessionListApi } from "../src/lib/sessions-api";
import type { LiveSessionEntry } from "../src/server/live";
import { parseRoute } from "../src/lib/route";

function memStorage(): StorageLike & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function entry(instanceId: string, name: string): LiveSessionEntry {
	return {
		instanceId,
		sessionId: `sid-${name}`,
		sessionName: name,
		cwd: "/w",
		pid: 1,
		startedAt: 0,
		lastActivityAt: 0,
		assistantCount: 0,
	} as unknown as LiveSessionEntry;
}

function api(listLive: () => Promise<LiveSessionEntry[]>): SessionListApi {
	return {
		listLive,
		listPast: async () => [],
		launch: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
		resume: async () => ({ instanceId: "i", sessionId: "s", reused: false }),
		shutdown: async () => {},
		deletePast: async () => {},
		listDirs: async () => [],
		complete: async () => null,
	};
}

describe("session keys", () => {
	test("local keys stay bare so old links resolve to local", () => {
		expect(sessionKey({ serverId: LOCAL_SERVER_ID, instanceId: "abc" })).toBe("abc");
		expect(parseSessionKey("abc")).toEqual({ serverId: LOCAL_SERVER_ID, instanceId: "abc" });
		const key = sessionKey({ serverId: "srv1", instanceId: "abc" });
		expect(parseSessionKey(key)).toEqual({ serverId: "srv1", instanceId: "abc" });
		const route = parseRoute(`#/s/${key}/hub`);
		expect(route).toEqual({ kind: "session", id: key, panel: "hub" });
	});

	test("ws url follows the server scheme", () => {
		expect(wsUrlFor({ id: "a", name: "a", url: "https://mac.t.ts.net" }, "x", "http://localhost:1")).toBe(
			"wss://mac.t.ts.net/ws/x",
		);
		expect(wsUrlFor({ id: LOCAL_SERVER_ID, name: "l", url: "" }, "x", "http://localhost:1")).toBe(
			"ws://localhost:1/ws/x",
		);
	});

	test("normalizes server URLs to origins", () => {
		expect(normalizeServerUrl("mac.t.ts.net")).toBe("https://mac.t.ts.net");
		expect(normalizeServerUrl("http://box:8080/x/")).toBe("http://box:8080");
		expect(normalizeServerUrl("ftp://box")).toBeNull();
		expect(normalizeServerUrl("")).toBeNull();
	});
});

describe("server operator", () => {
	test("persistence round-trip of the list", () => {
		const storage = memStorage();
		const op = createServerOperator({ storage, origin: "https://here.t.ts.net" });
		const a = op.add("https://mac.t.ts.net/", "Mac");
		const b = op.add("linux.t.ts.net");
		op.rename(b.id, "Linux");
		expect(JSON.parse(storage.data.get(SERVERS_STORAGE_KEY)!)).toEqual([
			{ id: a.id, name: "Mac", url: "https://mac.t.ts.net" },
			{ id: b.id, name: "Linux", url: "https://linux.t.ts.net" },
		]);
		const reloaded = createServerOperator({ storage, origin: "https://here.t.ts.net" });
		expect(reloaded.list().map(s => [s.id, s.name, s.url])).toEqual([
			[LOCAL_SERVER_ID, "here.t.ts.net", ""],
			[a.id, "Mac", "https://mac.t.ts.net"],
			[b.id, "Linux", "https://linux.t.ts.net"],
		]);
		reloaded.remove(a.id);
		reloaded.remove(LOCAL_SERVER_ID);
		expect(loadServers(storage).map(s => s.id)).toEqual([b.id]);
		expect(() => reloaded.add("https://linux.t.ts.net")).toThrow();
		expect(() => reloaded.add("https://here.t.ts.net")).toThrow();
	});

	test("ignores malformed stored entries", () => {
		const storage = memStorage();
		storage.setItem(SERVERS_STORAGE_KEY, JSON.stringify([{ id: "local", name: "x", url: "https://a" }, { id: 3 }]));
		expect(loadServers(storage)).toEqual([]);
		storage.setItem(SERVERS_STORAGE_KEY, "not json");
		expect(loadServers(storage)).toEqual([]);
		saveServers(storage, [{ id: "ab", name: "n", url: "https://a.b" }]);
		expect(loadServers(storage)).toEqual([{ id: "ab", name: "n", url: "https://a.b" }]);
	});

	test("merges two servers with colliding instanceIds into distinct identities", async () => {
		const storage = memStorage();
		const apis: Record<string, SessionListApi> = {
			"": api(async () => [entry("same", "local-one")]),
			"https://mac.t.ts.net": api(async () => [entry("same", "mac-one")]),
		};
		const op = createServerOperator({ storage, origin: "https://here.t.ts.net", createApi: url => apis[url]! });
		const mac = op.add("https://mac.t.ts.net");
		const merged = mergeLive(await op.poll());
		expect(merged.map(e => [e.serverId, e.instanceId, e.key, e.sessionName])).toEqual([
			[LOCAL_SERVER_ID, "same", "same", "local-one"],
			[mac.id, "same", `${mac.id}~same`, "mac-one"],
		]);
		expect(new Set(merged.map(e => e.key)).size).toBe(2);
	});

	test("a down server shows down without hiding others", async () => {
		const apis: Record<string, SessionListApi> = {
			"": api(async () => [entry("a", "local-a")]),
			"https://down.t.ts.net": api(async () => {
				throw new Error("Network error: refused");
			}),
		};
		const op = createServerOperator({
			storage: memStorage(),
			origin: "https://here.t.ts.net",
			createApi: url => apis[url]!,
		});
		op.add("https://down.t.ts.net");
		const states = await op.poll();
		expect(states.map(s => [s.server.name, s.status, s.error, s.live.length])).toEqual([
			["here.t.ts.net", "up", null, 1],
			["down.t.ts.net", "down", "Network error: refused", 0],
		]);
		expect(mergeLive(states).map(e => e.sessionName)).toEqual(["local-a"]);
	});

	test("launch targets the chosen server URL; local stays relative", async () => {
		const urls: string[] = [];
		const fetchImpl = async (url: string) => {
			urls.push(url);
			return Response.json({ instanceId: "new", sessionId: "s", reused: false });
		};
		const op = createServerOperator({ storage: memStorage(), origin: "https://here.t.ts.net", fetchImpl });
		const mac = op.add("https://mac.t.ts.net");
		await op.apiFor(mac.id).launch("/w");
		await op.apiFor(LOCAL_SERVER_ID).launch("/w");
		expect(urls).toEqual(["https://mac.t.ts.net/api/launch", "/api/launch"]);
		expect(op.wsUrl({ serverId: mac.id, instanceId: "new" })).toBe("wss://mac.t.ts.net/ws/new");
		expect(op.wsUrl({ serverId: "gone", instanceId: "new" })).toBeNull();
	});
});
