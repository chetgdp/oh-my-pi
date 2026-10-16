import { afterEach, describe, expect, test, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	ACTUAL_LOCAL_DEFAULT_BASE_URL,
	actualRuntimeFilePath,
	isProcessAlive,
	readActualRuntimeApiUrl,
	resolveActualLocalBaseUrl,
} from "@oh-my-pi/pi-catalog/provider-models/actual";
import {
	actualLocalModelManagerOptions,
	actualRelayModelManagerOptions,
} from "@oh-my-pi/pi-catalog/provider-models/openai-compat";
import { resolveProviderModels } from "@oh-my-pi/pi-catalog/model-manager";
import type { FetchImpl } from "@oh-my-pi/pi-catalog/types";

interface SeenRequest {
	url: string;
	headers: Headers;
}

function jsonFetch(payload: unknown, seen: SeenRequest[]): FetchImpl {
	return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		seen.push({ url: String(input), headers: new Headers(init?.headers) });
		return Response.json(payload);
	}) as unknown as FetchImpl;
}

const tempDirs: string[] = [];
function runtimeFile(contents: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-catalog-actual-"));
	tempDirs.push(dir);
	const file = path.join(dir, "actual-runtime.json");
	fs.writeFileSync(file, contents);
	return file;
}

afterEach(() => {
	vi.restoreAllMocks();
	for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A pid that existed and has exited, so signal 0 reports it gone. */
function exitedPid(): number {
	return Bun.spawnSync(["true"]).pid;
}

describe("Actual runtime file", () => {
	test("reads api_url from a runtime file whose runner pid is alive", () => {
		const file = runtimeFile(
			JSON.stringify({ schema_version: 1, pid: process.pid, api_url: "http://127.0.0.1:51234/", api_port: 51234 }),
		);
		expect(readActualRuntimeApiUrl({ path: file })).toBe("http://127.0.0.1:51234");
		expect(resolveActualLocalBaseUrl({ path: file, env: {} })).toBe("http://127.0.0.1:51234/v1");
	});

	test("a stale, malformed, or missing file at a known location means no runner and no fallback probe", () => {
		const cases = [
			runtimeFile(JSON.stringify({ pid: exitedPid(), api_url: "http://127.0.0.1:51234" })),
			runtimeFile(JSON.stringify({ api_url: "http://127.0.0.1:51234" })),
			runtimeFile("{not json"),
			runtimeFile(JSON.stringify({ pid: process.pid, api_port: 9000 })),
			runtimeFile(JSON.stringify({ pid: process.pid, api_url: 9000 })),
			runtimeFile(JSON.stringify({ pid: process.pid, api_url: "file:///etc/passwd" })),
			runtimeFile(JSON.stringify({ pid: -1, api_url: "http://127.0.0.1:51234" })),
			runtimeFile("null"),
			path.join(os.tmpdir(), "pi-catalog-actual-missing", "actual-runtime.json"),
		];
		for (const file of cases) {
			expect(readActualRuntimeApiUrl({ path: file })).toBeUndefined();
			expect(resolveActualLocalBaseUrl({ path: file, env: {} })).toBeUndefined();
		}
	});

	test("platforms with no known runtime file location probe the default port", () => {
		expect(resolveActualLocalBaseUrl({ path: null, env: {} })).toBe(ACTUAL_LOCAL_DEFAULT_BASE_URL);
		expect(ACTUAL_LOCAL_DEFAULT_BASE_URL).toBe("http://127.0.0.1:8080/v1");
	});

	test("liveness uses the injected probe; EPERM counts as alive", () => {
		const file = runtimeFile(JSON.stringify({ pid: 4242, api_url: "http://127.0.0.1:51234" }));
		const probe = vi.fn((pid: number) => pid === 4242);
		expect(readActualRuntimeApiUrl({ path: file, isProcessAlive: probe })).toBe("http://127.0.0.1:51234");
		expect(probe).toHaveBeenCalledWith(4242);
		expect(readActualRuntimeApiUrl({ path: file, isProcessAlive: () => false })).toBeUndefined();

		vi.spyOn(process, "kill").mockImplementation(() => {
			throw Object.assign(new Error("operation not permitted"), { code: "EPERM" });
		});
		expect(isProcessAlive(1)).toBe(true);
		vi.spyOn(process, "kill").mockImplementation(() => {
			throw Object.assign(new Error("no such process"), { code: "ESRCH" });
		});
		expect(isProcessAlive(1)).toBe(false);
	});

	test("ACTUAL_LOCAL_BASE_URL wins over the runtime file", () => {
		const file = runtimeFile(JSON.stringify({ pid: process.pid, api_url: "http://127.0.0.1:51234" }));
		expect(
			resolveActualLocalBaseUrl({ path: file, env: { ACTUAL_LOCAL_BASE_URL: " http://10.0.0.5:9000/v1 " } }),
		).toBe("http://10.0.0.5:9000/v1");
		const missing = path.join(os.tmpdir(), "pi-catalog-actual-missing", "actual-runtime.json");
		expect(
			resolveActualLocalBaseUrl({ path: missing, env: { ACTUAL_LOCAL_BASE_URL: "http://10.0.0.5:9000/v1" } }),
		).toBe("http://10.0.0.5:9000/v1");
		expect(resolveActualLocalBaseUrl({ path: file, env: { ACTUAL_LOCAL_BASE_URL: "  " } })).toBe(
			"http://127.0.0.1:51234/v1",
		);
	});

	test("only macOS has a known runtime file location", () => {
		expect(actualRuntimeFilePath("darwin", "/Users/x")).toBe(
			"/Users/x/Library/Application Support/actual/actual-runtime.json",
		);
		expect(actualRuntimeFilePath("linux", "/home/x")).toBeUndefined();
		expect(actualRuntimeFilePath("win32", "C:\\Users\\x")).toBeUndefined();
	});
});

describe("Actual local discovery", () => {
	test("never probes without an explicit base URL", () => {
		expect(actualLocalModelManagerOptions({}).fetchDynamicModels).toBeUndefined();
	});

	test("maps mdl_ selectors and display names without sending a key", async () => {
		const seen: SeenRequest[] = [];
		const fetch = jsonFetch(
			{
				object: "list",
				data: [
					{ id: "mdl_7d87df3c920a1b4f", display_name: "Qwen3.6 35B A3B", canonical_name: "qwen3.6-35b-a3b" },
					{ id: "mdl_0000000000000001" },
				],
			},
			seen,
		);
		const options = actualLocalModelManagerOptions({
			apiKey: "ac_should_not_leak",
			baseUrl: "http://127.0.0.1:51234/v1",
			fetch,
		});
		const models = await options.fetchDynamicModels?.();
		expect(models?.map(model => [model.id, model.name, model.provider, model.api, model.baseUrl])).toEqual([
			[
				"mdl_0000000000000001",
				"mdl_0000000000000001",
				"actual-local",
				"openai-completions",
				"http://127.0.0.1:51234/v1",
			],
			["mdl_7d87df3c920a1b4f", "Qwen3.6 35B A3B", "actual-local", "openai-completions", "http://127.0.0.1:51234/v1"],
		]);
		expect(seen).toHaveLength(1);
		expect(seen[0].url).toBe("http://127.0.0.1:51234/v1/models");
		expect(seen[0].headers.get("authorization")).toBeNull();
	});
});

describe("Actual relay discovery", () => {
	const relayRoster = {
		data: [
			{ id: "Qwen3.6 35B", selector: "mdl_aaa", display_name: "Qwen3.6 35B", loaded: true, clusters: ["c1"] },
			{ id: "Gemma 4", selector: "mdl_bbb", loaded: false, clusters: ["c1"] },
			{ id: "mdl_ccc", loaded: true },
			{ id: "mdl_ddd" },
		],
	};

	test("keeps loaded rows, addresses the selector, and sends the key and cluster header", async () => {
		const saved = Bun.env.ACTUAL_CLUSTER_ID;
		Bun.env.ACTUAL_CLUSTER_ID = "cl_123";
		try {
			const seen: SeenRequest[] = [];
			const options = actualRelayModelManagerOptions({
				apiKey: "ac_live",
				fetch: jsonFetch(relayRoster, seen),
				localBaseUrl: null,
			});
			expect(options.dynamicModelsAuthoritative).toBe(true);
			const models = await options.fetchDynamicModels?.();
			expect(models?.map(model => [model.id, model.name, model.baseUrl])).toEqual([
				["mdl_aaa", "Qwen3.6 35B", "https://api.actual.inc/v1"],
				["mdl_ccc", "mdl_ccc", "https://api.actual.inc/v1"],
			]);
			expect(seen.map(request => request.url)).toEqual(["https://api.actual.inc/v1/models"]);
			expect(seen[0].headers.get("authorization")).toBe("Bearer ac_live");
			expect(seen[0].headers.get("x-cluster-id")).toBe("cl_123");
		} finally {
			if (saved === undefined) delete Bun.env.ACTUAL_CLUSTER_ID;
			else Bun.env.ACTUAL_CLUSTER_ID = saved;
		}
	});

	test("omits the cluster header when ACTUAL_CLUSTER_ID is unset", async () => {
		const saved = Bun.env.ACTUAL_CLUSTER_ID;
		delete Bun.env.ACTUAL_CLUSTER_ID;
		try {
			const seen: SeenRequest[] = [];
			const options = actualRelayModelManagerOptions({
				apiKey: "ac_live",
				fetch: jsonFetch(relayRoster, seen),
				localBaseUrl: null,
			});
			await options.fetchDynamicModels?.();
			expect(seen[0].headers.has("x-cluster-id")).toBe(false);
		} finally {
			if (saved !== undefined) Bun.env.ACTUAL_CLUSTER_ID = saved;
		}
	});

	test("never fetches without a key", () => {
		expect(actualRelayModelManagerOptions({}).fetchDynamicModels).toBeUndefined();
	});

	function serveRelay(rosters: unknown[]): { url: string; requests: () => number; stop: () => void } {
		let count = 0;
		const server = Bun.serve({
			port: 0,
			fetch: () => {
				const roster = rosters[Math.min(count, rosters.length - 1)];
				count++;
				return roster === null ? new Response("down", { status: 503 }) : Response.json(roster);
			},
		});
		return { url: `http://127.0.0.1:${server.port}/v1`, requests: () => count, stop: () => server.stop(true) };
	}

	function serveStatus(active: string, contextLength: number): { url: string; stop: () => void } {
		const server = Bun.serve({
			port: 0,
			fetch: request =>
				new URL(request.url).pathname === "/v1/status"
					? Response.json({ model: { active, runtime: { context_length: contextLength } } })
					: new Response("not found", { status: 404 }),
		});
		return { url: `http://127.0.0.1:${server.port}/v1`, stop: () => server.stop(true) };
	}

	test("refetches the roster despite a fresh cache and falls back to it when the relay is down", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-catalog-actual-cache-"));
		tempDirs.push(dir);
		const relay = serveRelay([
			{ data: [{ id: "A", selector: "mdl_aaa", loaded: true }] },
			{ data: [{ id: "B", selector: "mdl_bbb", loaded: true }] },
			null,
		]);
		try {
			const options = {
				...actualRelayModelManagerOptions({ apiKey: "ac_live", baseUrl: relay.url, localBaseUrl: null }),
				cacheDbPath: path.join(dir, "models.db"),
			};
			const first = await resolveProviderModels(options, "online-if-uncached");
			expect(first.models.map(model => model.id)).toEqual(["mdl_aaa"]);
			const second = await resolveProviderModels(options, "online-if-uncached");
			expect(relay.requests()).toBe(2);
			expect(second.models.map(model => model.id)).toEqual(["mdl_bbb"]);
			const offline = await resolveProviderModels(options, "online-if-uncached");
			expect(relay.requests()).toBe(3);
			expect(offline.models.map(model => model.id)).toEqual(["mdl_bbb"]);
		} finally {
			relay.stop();
		}
	});

	test("a row matching the local runner's active model takes its runtime window; others stay unchanged", async () => {
		const relay = serveRelay([
			{
				data: [
					{ id: "Qwen", selector: "mdl_6eb5d146720a8793", loaded: true },
					{ id: "Other", selector: "mdl_other", loaded: true },
					{ id: "engine-row", loaded: true },
				],
			},
		]);
		const local = serveStatus("mdl_6eb5d146720a8793", 131072);
		try {
			const baseline = await actualRelayModelManagerOptions({
				apiKey: "ac_live",
				baseUrl: relay.url,
				localBaseUrl: null,
			}).fetchDynamicModels?.();
			const models = await actualRelayModelManagerOptions({
				apiKey: "ac_live",
				baseUrl: relay.url,
				localBaseUrl: local.url,
			}).fetchDynamicModels?.();
			const matched = models?.find(model => model.id === "mdl_6eb5d146720a8793");
			expect(matched?.contextWindow).toBe(131072);
			expect(matched?.maxTokens).toBe(
				Math.min(baseline?.find(model => model.id === "mdl_6eb5d146720a8793")?.maxTokens ?? 131072, 131072),
			);
			for (const id of ["mdl_other", "engine-row"]) {
				const row = models?.find(model => model.id === id);
				const before = baseline?.find(model => model.id === id);
				expect([row?.contextWindow, row?.maxTokens]).toEqual([before?.contextWindow, before?.maxTokens]);
				expect(row?.contextWindow).not.toBe(131072);
			}
		} finally {
			relay.stop();
			local.stop();
		}
	});

	test("an unreachable local runner leaves relay rows unchanged", async () => {
		const relay = serveRelay([{ data: [{ id: "Qwen", selector: "mdl_aaa", loaded: true }] }]);
		const local = serveStatus("mdl_aaa", 131072);
		const deadUrl = local.url;
		local.stop();
		try {
			const models = await actualRelayModelManagerOptions({
				apiKey: "ac_live",
				baseUrl: relay.url,
				localBaseUrl: deadUrl,
			}).fetchDynamicModels?.();
			expect(models?.map(model => model.id)).toEqual(["mdl_aaa"]);
			expect(models?.[0].contextWindow).not.toBe(131072);
		} finally {
			relay.stop();
		}
	});
});
