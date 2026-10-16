/**
 * Implicit `actual-local` discovery against an in-process server emulating the
 * Actual runner, plus the llama.cpp default-port collision guard.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { FetchImpl } from "@oh-my-pi/pi-ai/types";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";

const modelRequests: Array<{ path: string; auth: string | null }> = [];
/** Every URL any discovery probe asked the injected fetch for. */
const probedUrls: string[] = [];

/** `model.runtime.context_length` the fake `/v1/status` reports; 0 answers 404. */
let statusContextLength = 0;

const server = Bun.serve({
	port: 0,
	hostname: "127.0.0.1",
	fetch(req) {
		const url = new URL(req.url);
		if (url.pathname === "/v1/models") {
			modelRequests.push({ path: url.pathname, auth: req.headers.get("authorization") });
			return Response.json({
				object: "list",
				data: [
					{ id: "mdl_7d87df3c920a1b4f", display_name: "Qwen3.6 35B A3B", verified: true },
					{ id: "mdl_unloaded", display_name: "Gemma 4", verified: true },
				],
				discovery_paths: [],
			});
		}
		if (url.pathname === "/v1/status") {
			if (!statusContextLength) return new Response(null, { status: 404 });
			return Response.json({
				object: "local.status",
				schema_version: 4,
				model: { active: "mdl_7d87df3c920a1b4f", runtime: { context_length: statusContextLength } },
			});
		}
		return new Response(null, { status: 404 });
	},
});
const serverOrigin = `http://127.0.0.1:${server.port}`;

/** Routes the emulated runner to the real server; every other probe is answered 404 locally. */
const hermeticFetch: FetchImpl = (input, init) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	probedUrls.push(url);
	if (url.startsWith(`${serverOrigin}/`)) return fetch(url, init);
	return Promise.resolve(new Response(null, { status: 404 }));
};

const MANAGED_ENV_KEYS = [
	"ACTUAL_LOCAL_BASE_URL",
	"LLAMA_CPP_BASE_URL",
	"OLLAMA_BASE_URL",
	"OLLAMA_HOST",
	"LM_STUDIO_BASE_URL",
] as const;
const savedEnv = new Map<string, string | undefined>();

beforeAll(() => {
	for (const key of MANAGED_ENV_KEYS) savedEnv.set(key, Bun.env[key]);
	Bun.env.OLLAMA_BASE_URL = "http://127.0.0.1:1";
	Bun.env.LM_STUDIO_BASE_URL = "http://127.0.0.1:1/v1";
	delete Bun.env.OLLAMA_HOST;
});

afterAll(() => {
	for (const [key, value] of savedEnv) {
		if (value === undefined) delete Bun.env[key];
		else Bun.env[key] = value;
	}
	server.stop(true);
});

let tempDir = "";
let storage: AuthStorage | undefined;

beforeEach(async () => {
	modelRequests.length = 0;
	probedUrls.length = 0;
	delete Bun.env.ACTUAL_LOCAL_BASE_URL;
	delete Bun.env.LLAMA_CPP_BASE_URL;
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-actual-local-"));
	storage = await AuthStorage.create(path.join(tempDir, "auth.db"));
});

afterEach(() => {
	storage?.close();
	storage = undefined;
	fs.rmSync(tempDir, { recursive: true, force: true });
});

/** A pid that existed and has exited, so signal 0 reports it gone. */
function exitedPid(): number {
	return Bun.spawnSync(["true"]).pid;
}

function writeRuntimeFile(apiUrl: string, pid: number = process.pid): string {
	const file = path.join(tempDir, "actual-runtime.json");
	fs.writeFileSync(file, JSON.stringify({ schema_version: 1, pid, api_url: apiUrl }));
	return file;
}

function bootRegistry(actualRuntimeFile?: string | null): ModelRegistry {
	if (!storage) throw new Error("auth storage not booted");
	return new ModelRegistry(storage, path.join(tempDir, "models.yml"), {
		cacheDbPath: path.join(tempDir, "models.db"),
		fetch: hermeticFetch,
		...(actualRuntimeFile !== undefined && { actualRuntimeFile }),
	});
}

const actualProbes = () => probedUrls.filter(url => url.endsWith("/v1/models") && !url.includes(":1/"));

const actualModels = (registry: ModelRegistry) =>
	registry
		.getAll()
		.filter(model => model.provider === "actual-local")
		.map(model => ({ id: model.id, name: model.name, baseUrl: model.baseUrl }));

describe("actual-local implicit discovery", () => {
	test("discovers the runner from its runtime file without sending Authorization", async () => {
		const registry = bootRegistry(writeRuntimeFile(serverOrigin));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualModels(registry)).toEqual([
			{ id: "mdl_7d87df3c920a1b4f", name: "Qwen3.6 35B A3B", baseUrl: `${serverOrigin}/v1` },
			{ id: "mdl_unloaded", name: "Gemma 4", baseUrl: `${serverOrigin}/v1` },
		]);
		expect(modelRequests).toEqual([{ path: "/v1/models", auth: null }]);
		const model = registry.find("actual-local", "mdl_7d87df3c920a1b4f");
		expect(model?.api).toBe("openai-completions");
		expect(model?.imageInputDecoder).toBe("stb");
	}, 30_000);

	test("the active model's context window comes from /v1/status so output fitting sees the real window", async () => {
		statusContextLength = 32_768;
		try {
			const registry = bootRegistry(writeRuntimeFile(serverOrigin));
			await registry.refreshDiscoverableProviders(["actual-local"], "online");
			const model = registry.find("actual-local", "mdl_7d87df3c920a1b4f");
			expect(model?.contextWindow).toBe(32_768);
			expect(model?.maxTokens).toBeLessThanOrEqual(32_768);
		} finally {
			statusContextLength = 0;
		}
	}, 30_000);

	test("a missing /v1/status leaves the window unknown instead of a 128K default", async () => {
		const registry = bootRegistry(writeRuntimeFile(serverOrigin));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");
		expect(registry.find("actual-local", "mdl_7d87df3c920a1b4f")?.contextWindow).toBeNull();
	}, 30_000);

	test("rows other than the active model report no window rather than 128K", async () => {
		statusContextLength = 32_768;
		try {
			const registry = bootRegistry(writeRuntimeFile(serverOrigin));
			await registry.refreshDiscoverableProviders(["actual-local"], "online");
			expect(registry.find("actual-local", "mdl_7d87df3c920a1b4f")?.contextWindow).toBe(32_768);
			const unloaded = registry.find("actual-local", "mdl_unloaded");
			expect(unloaded).toBeDefined();
			expect(unloaded?.contextWindow).toBeNull();
		} finally {
			statusContextLength = 0;
		}
	}, 30_000);

	test("selecting a model whose cached row has a stale window re-reads /v1/status before the first request", async () => {
		// Startup reuses cached discovery rows; `-p` then sent max_tokens sized
		// for the 128K default against a runner started with 32K (422).
		const registry = bootRegistry(writeRuntimeFile(serverOrigin));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");
		const cached = registry.find("actual-local", "mdl_7d87df3c920a1b4f");
		if (!cached) throw new Error("model not discovered");
		expect(cached.contextWindow).not.toBe(32_768);
		expect(registry.hasLazyRuntimeMetadata("actual-local")).toBe(true);

		statusContextLength = 32_768;
		try {
			const refreshed = await registry.refreshSelectedModelMetadata(cached);
			expect(refreshed.contextWindow).toBe(32_768);
			expect(refreshed.maxTokens).toBeLessThanOrEqual(32_768);
		} finally {
			statusContextLength = 0;
		}
	}, 30_000);

	test("background refresh re-probes a TTL-fresh cache so a restarted runner's window wins", async () => {
		// Live failure: a cache written before /v1/status was read kept the
		// 128K default; `online-if-uncached` served it, and the post-discovery
		// rebind replaced the corrected 32K session model with it.
		const runtimeFile = writeRuntimeFile(serverOrigin);
		await bootRegistry(runtimeFile).refreshDiscoverableProviders(["actual-local"], "online");

		statusContextLength = 32_768;
		try {
			const restarted = bootRegistry(runtimeFile);
			expect(restarted.find("actual-local", "mdl_7d87df3c920a1b4f")?.contextWindow).not.toBe(32_768);
			await restarted.refresh("online-if-uncached");
			expect(restarted.find("actual-local", "mdl_7d87df3c920a1b4f")?.contextWindow).toBe(32_768);
		} finally {
			statusContextLength = 0;
		}
	}, 30_000);

	test("an empty-paste login placeholder never reaches the runner", async () => {
		await storage?.oauth.login("actual-local", { onAuth: () => {}, onPrompt: async () => "" });
		const registry = bootRegistry(writeRuntimeFile(serverOrigin));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualModels(registry).map(model => model.id)).toEqual(["mdl_7d87df3c920a1b4f", "mdl_unloaded"]);
		expect(modelRequests.every(request => request.auth === null)).toBe(true);
	}, 30_000);

	test("ACTUAL_LOCAL_BASE_URL overrides the runtime file", async () => {
		Bun.env.ACTUAL_LOCAL_BASE_URL = `${serverOrigin}/v1`;
		const registry = bootRegistry(writeRuntimeFile("http://127.0.0.1:1"));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualModels(registry).map(model => model.id)).toEqual(["mdl_7d87df3c920a1b4f", "mdl_unloaded"]);
	}, 30_000);

	test("a live runner whose server is gone leaves the provider silently empty", async () => {
		const registry = bootRegistry(writeRuntimeFile("http://127.0.0.1:1"));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualModels(registry)).toEqual([]);
		expect(modelRequests).toEqual([]);
	}, 30_000);

	test("a stale runtime file (dead pid) registers no probe at all", async () => {
		const registry = bootRegistry(writeRuntimeFile(serverOrigin, exitedPid()));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualModels(registry)).toEqual([]);
		expect(modelRequests).toEqual([]);
		expect(actualProbes()).toEqual([]);
	}, 30_000);

	test("a window learned from a rejection replaces an unknown one in the registry", async () => {
		const registry = bootRegistry(writeRuntimeFile(serverOrigin));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");
		const unloaded = registry.find("actual-local", "mdl_unloaded");
		if (!unloaded) throw new Error("model not discovered");
		registry.learnContextWindow(unloaded, 32_768);
		const learned = registry.find("actual-local", "mdl_unloaded");
		expect(learned?.contextWindow).toBe(32_768);
		expect(learned?.maxTokens).toBeLessThanOrEqual(32_768);
	}, 30_000);

	test("a missing runtime file at a known location registers no probe", async () => {
		const registry = bootRegistry(path.join(tempDir, "absent", "actual-runtime.json"));
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualProbes()).toEqual([]);
		expect(actualModels(registry)).toEqual([]);
	}, 30_000);

	test("with no known runtime file location, the default port is probed", async () => {
		const registry = bootRegistry(null);
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualProbes()).toEqual(["http://127.0.0.1:8080/v1/models"]);
	}, 30_000);

	test("the bun test default has no Actual runner", async () => {
		const registry = bootRegistry();
		await registry.refreshDiscoverableProviders(["actual-local"], "online");

		expect(actualProbes()).toEqual([]);
		expect(actualModels(registry)).toEqual([]);
	}, 30_000);
});

describe("llama.cpp default-port collision", () => {
	const llamaDiscovered = async (registry: ModelRegistry): Promise<boolean> => {
		await registry.refreshDiscoverableProviders(["llama.cpp"], "online");
		return registry.getProviderDiscoveryState("llama.cpp") !== undefined;
	};

	test("skips implicit llama.cpp when a live Actual runner claims llama.cpp's default URL", async () => {
		expect(await llamaDiscovered(bootRegistry(writeRuntimeFile("http://127.0.0.1:8080/")))).toBe(false);
	}, 30_000);

	test("keeps implicit llama.cpp when Actual's file is stale, Actual runs elsewhere, there is no file, or LLAMA_CPP_BASE_URL is set", async () => {
		expect(await llamaDiscovered(bootRegistry(writeRuntimeFile("http://127.0.0.1:8080", exitedPid())))).toBe(true);
		expect(await llamaDiscovered(bootRegistry(writeRuntimeFile("http://127.0.0.1:51234")))).toBe(true);
		expect(await llamaDiscovered(bootRegistry(null))).toBe(true);
		expect(await llamaDiscovered(bootRegistry())).toBe(true);
		Bun.env.LLAMA_CPP_BASE_URL = "http://127.0.0.1:8080";
		expect(await llamaDiscovered(bootRegistry(writeRuntimeFile("http://127.0.0.1:8080")))).toBe(true);
	}, 30_000);
});
