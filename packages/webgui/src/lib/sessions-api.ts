import type { LiveSessionEntry } from "../server/live";
import type { PastSessionSummary } from "../server/past";

export interface SessionListApi {
	listLive(signal?: AbortSignal): Promise<LiveSessionEntry[]>;
	listPast(opts: { cwd?: string; all?: boolean; signal?: AbortSignal }): Promise<PastSessionSummary[]>;
	launch(cwd: string, signal?: AbortSignal): Promise<{ windowId: string; instanceId?: string }>;
	resume(id: string, signal?: AbortSignal): Promise<{ windowId: string; instanceId?: string }>;
	shutdown(instanceId: string, signal?: AbortSignal): Promise<void>;
	deletePast(id: string, signal?: AbortSignal): Promise<void>;
}

async function checkedJson<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`${res.status}: ${body}`);
	}
	return res.json() as Promise<T>;
}

async function checkedVoid(res: Response): Promise<void> {
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`${res.status}: ${body}`);
	}
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 10_000;

function combineSignal(signal?: AbortSignal): AbortSignal {
	const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	if (!signal) return timeoutSignal;
	return AbortSignal.any ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;
}

export function createSessionsApi(baseUrl: string, fetchImpl: FetchLike = fetch): SessionListApi {
	const request = async (url: string, init?: RequestInit): Promise<Response> => {
		const signal = combineSignal(init?.signal ?? undefined);
		try {
			return await fetchImpl(url, { ...init, signal });
		} catch (err: unknown) {
			if (err instanceof Error) {
				// Caller intentional abort stays an abort, not "unreachable"
				if (init?.signal?.aborted && (err.name === "AbortError" || init.signal.reason?.name === "AbortError")) {
					throw err;
				}
				if (err.name === "TimeoutError" || signal.reason?.name === "TimeoutError") {
					throw new Error("Request timed out", { cause: err });
				}
				if (signal.aborted) {
					throw err;
				}
				throw new Error(`Network error: ${err.message}`, { cause: err });
			}
			throw new Error(`Network error: ${String(err)}`);
		}
	};

	return {
		async listLive(signal) {
			const res = await request(`${baseUrl}/api/live`, { signal });
			return checkedJson<LiveSessionEntry[]>(res);
		},
		async listPast(opts) {
			const params = new URLSearchParams();
			if (opts.cwd != null) params.set("cwd", opts.cwd);
			if (opts.all != null) params.set("all", String(opts.all));
			const qs = params.toString();
			const url = `${baseUrl}/api/past${qs ? `?${qs}` : ""}`;
			const res = await request(url, { signal: opts.signal });
			return checkedJson<PastSessionSummary[]>(res);
		},

		async launch(cwd, signal) {
			const res = await request(`${baseUrl}/api/launch`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cwd }),
				signal,
			});
			return checkedJson(res);
		},

		async resume(id, signal) {
			const res = await request(`${baseUrl}/api/past/${encodeURIComponent(id)}/resume`, {
				method: "POST",
				signal,
			});
			return checkedJson(res);
		},

		async shutdown(instanceId, signal) {
			const res = await request(`${baseUrl}/api/live/${encodeURIComponent(instanceId)}/shutdown`, {
				method: "POST",
				signal,
			});
			return checkedVoid(res);
		},

		async deletePast(id, signal) {
			const res = await request(`${baseUrl}/api/past/${encodeURIComponent(id)}`, {
				method: "DELETE",
				signal,
			});
			return checkedVoid(res);
		},
	};
}
