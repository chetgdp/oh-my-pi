import { afterEach, describe, expect, test, vi } from "bun:test";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { isProviderRetryableError } from "../src/error/retryable";
import { getProviderDefinition } from "../src/registry/registry";
import type { FetchImpl } from "../src/types";

const relay = getProviderDefinition("actual-relay");
if (!relay?.login || !relay.prepareRequest) throw new Error("Actual relay provider is not registered");
const loginRelay = relay.login;
const prepareRelayRequest = relay.prepareRequest;

const relayModel = buildModel({
	id: "mdl_aaa",
	name: "Qwen3.6 35B",
	api: "openai-completions",
	provider: "actual-relay",
	baseUrl: "https://api.actual.inc/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 131072,
	maxTokens: 8192,
});

function withStatus(message: string, status: number): Error {
	return Object.assign(new Error(message), { status });
}

const savedClusterId = Bun.env.ACTUAL_CLUSTER_ID;
afterEach(() => {
	vi.restoreAllMocks();
	if (savedClusterId === undefined) delete Bun.env.ACTUAL_CLUSTER_ID;
	else Bun.env.ACTUAL_CLUSTER_ID = savedClusterId;
});

describe("Actual relay login", () => {
	test("validates the pasted key against the relay /v1/models endpoint", async () => {
		const requests: Array<{ url: string; authorization: string | null }> = [];
		const fetchMock: FetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			requests.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
			return Response.json({ object: "list", data: [] });
		});

		const apiKey = await loginRelay({ onPrompt: async () => "  ac_test_key  ", fetch: fetchMock });

		expect(apiKey).toBe("ac_test_key");
		expect(requests).toEqual([{ url: "https://api.actual.inc/v1/models", authorization: "Bearer ac_test_key" }]);
	});

	test("rejects a key the relay answers with a plain-text 401", async () => {
		const fetchMock: FetchImpl = vi.fn(
			async () => new Response("unauthorized", { status: 401, headers: { "Content-Type": "text/plain" } }),
		);

		await expect(loginRelay({ onPrompt: async () => "ac_bad", fetch: fetchMock })).rejects.toThrow(
			"Actual (relay) API key validation failed (401)",
		);
	});
});

describe("Actual relay transport", () => {
	test("adds X-Cluster-ID from ACTUAL_CLUSTER_ID without dropping caller headers", () => {
		Bun.env.ACTUAL_CLUSTER_ID = "cl_123";
		const prepared = prepareRelayRequest(relayModel, { apiKey: "ac_live", headers: { "X-Trace": "1" } });
		expect(prepared.options.headers).toEqual({ "X-Cluster-ID": "cl_123", "X-Trace": "1" });
		expect(prepared.options.apiKey).toBe("ac_live");
	});

	test("leaves the request untouched when ACTUAL_CLUSTER_ID is unset", () => {
		delete Bun.env.ACTUAL_CLUSTER_ID;
		const options = { apiKey: "ac_live" };
		expect(prepareRelayRequest(relayModel, options).options).toBe(options);
	});
});

describe("Actual relay error retry classification", () => {
	test("node saturation and 429/503 are retryable", () => {
		const saturated = '{"error":{"code":"node_saturated","type":"server_overloaded","retryable":true}}';
		expect(isProviderRetryableError(withStatus(`503 ${saturated}`, 503))).toBe(true);
		expect(isProviderRetryableError(new Error(saturated))).toBe(true);
		expect(isProviderRetryableError(withStatus("503 no node for user", 503))).toBe(true);
		expect(isProviderRetryableError(withStatus("429 Too Many Requests", 429))).toBe(true);
	});

	test("auth failures are not retried", () => {
		expect(isProviderRetryableError(withStatus("401 unauthorized", 401))).toBe(false);
		expect(isProviderRetryableError(withStatus("403 forbidden", 403))).toBe(false);
	});
});
