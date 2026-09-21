import { describe, expect, it } from "bun:test";
import { createSessionsApi, type FetchLike } from "../src/lib/sessions-api";

interface RecordedCall {
	url: string;
	method: string;
	body: string | null;
}

function fakeFetch(status: number, body: unknown): { fetch: FetchLike; calls: RecordedCall[] } {
	const calls: RecordedCall[] = [];
	const impl: FetchLike = async (input, init) => {
		const url = input;
		const method = init?.method ?? "GET";
		const reqBody = typeof init?.body === "string" ? init.body : null;
		calls.push({ url, method, body: reqBody });
		return new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	};
	return { fetch: impl, calls };
}

describe("createSessionsApi", () => {
	it("listLive hits GET /api/live", async () => {
		const data = [
			{
				version: 1,
				instanceId: "a",
				pid: 1,
				cwd: "/x",
				sessionId: "s",
				sessionName: null,
				model: null,
				startedAt: 1,
				createdAt: 1,
			},
		];
		const { fetch: f, calls } = fakeFetch(200, data);
		const api = createSessionsApi("http://localhost:8081", f);
		const result = await api.listLive();
		expect(result).toEqual(data);
		expect(calls[0].url).toBe("http://localhost:8081/api/live");
		expect(calls[0].method).toBe("GET");
	});

	it("listPast hits GET /api/past with query params", async () => {
		const data = [{ id: "s1" }];
		const { fetch: f, calls } = fakeFetch(200, data);
		const api = createSessionsApi("http://localhost:8081", f);
		await api.listPast({ cwd: "/foo", all: true });
		expect(calls[0].url).toBe("http://localhost:8081/api/past?cwd=%2Ffoo&all=true");
		expect(calls[0].method).toBe("GET");
	});

	it("listPast omits absent params", async () => {
		const { fetch: f, calls } = fakeFetch(200, []);
		const api = createSessionsApi("http://localhost:8081", f);
		await api.listPast({});
		expect(calls[0].url).toBe("http://localhost:8081/api/past");
	});

	it("launch hits POST /api/launch with JSON body", async () => {
		const { fetch: f, calls } = fakeFetch(200, { windowId: "w1" });
		const api = createSessionsApi("http://localhost:8081", f);
		const result = await api.launch("/home/user/project");
		expect(result).toEqual({ windowId: "w1" });
		expect(calls[0].url).toBe("http://localhost:8081/api/launch");
		expect(calls[0].method).toBe("POST");
		expect(JSON.parse(calls[0].body!)).toEqual({ cwd: "/home/user/project" });
	});

	it("resume hits POST /api/past/:id/resume", async () => {
		const { fetch: f, calls } = fakeFetch(200, { windowId: "w2", instanceId: "i2" });
		const api = createSessionsApi("http://localhost:8081", f);
		const result = await api.resume("sess-42");
		expect(result).toEqual({ windowId: "w2", instanceId: "i2" });
		expect(calls[0].url).toBe("http://localhost:8081/api/past/sess-42/resume");
		expect(calls[0].method).toBe("POST");
	});

	it("shutdown hits POST /api/live/:instanceId/shutdown", async () => {
		const { fetch: f, calls } = fakeFetch(204, "");
		const api = createSessionsApi("http://localhost:8081", f);
		await api.shutdown("inst-1");
		expect(calls[0].url).toBe("http://localhost:8081/api/live/inst-1/shutdown");
		expect(calls[0].method).toBe("POST");
	});

	it("throws on non-2xx response", async () => {
		const impl = async (): Promise<Response> => {
			return new Response("not found", { status: 404 });
		};
		const api = createSessionsApi("http://localhost:8081", impl);
		await expect(api.listLive()).rejects.toThrow("404: not found");
	});

	it("shutdown throws on non-2xx", async () => {
		const impl = async (): Promise<Response> => {
			return new Response("gone", { status: 410 });
		};
		const api = createSessionsApi("http://localhost:8081", impl);
		await expect(api.shutdown("x")).rejects.toThrow("410: gone");
	});
});
