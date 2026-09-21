import type { LiveSessionEntry } from "../server/live";
import type { PastSessionSummary } from "../server/past";

export interface SessionListApi {
	listLive(): Promise<LiveSessionEntry[]>;
	listPast(opts: { cwd?: string; all?: boolean }): Promise<PastSessionSummary[]>;
	launch(cwd: string): Promise<{ windowId: string; instanceId?: string }>;
	resume(id: string): Promise<{ windowId: string; instanceId?: string }>;
	shutdown(instanceId: string): Promise<void>;
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

export function createSessionsApi(baseUrl: string, fetchImpl: FetchLike = fetch): SessionListApi {
	return {
		async listLive() {
			const res = await fetchImpl(`${baseUrl}/api/live`);
			return checkedJson<LiveSessionEntry[]>(res);
		},

		async listPast(opts) {
			const params = new URLSearchParams();
			if (opts.cwd != null) params.set("cwd", opts.cwd);
			if (opts.all != null) params.set("all", String(opts.all));
			const qs = params.toString();
			const url = `${baseUrl}/api/past${qs ? `?${qs}` : ""}`;
			const res = await fetchImpl(url);
			return checkedJson<PastSessionSummary[]>(res);
		},

		async launch(cwd) {
			const res = await fetchImpl(`${baseUrl}/api/launch`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cwd }),
			});
			return checkedJson(res);
		},

		async resume(id) {
			const res = await fetchImpl(`${baseUrl}/api/past/${encodeURIComponent(id)}/resume`, { method: "POST" });
			return checkedJson(res);
		},

		async shutdown(instanceId) {
			const res = await fetchImpl(`${baseUrl}/api/live/${encodeURIComponent(instanceId)}/shutdown`, {
				method: "POST",
			});
			return checkedVoid(res);
		},
	};
}
