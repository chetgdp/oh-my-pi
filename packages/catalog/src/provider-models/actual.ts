import type { FetchImpl } from "@oh-my-pi/pi-utils";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const ACTUAL_LOCAL_DEFAULT_BASE_URL = "http://127.0.0.1:8080/v1";
export const ACTUAL_RELAY_BASE_URL = "https://api.actual.inc/v1";

/**
 * Where the Actual runner publishes its live endpoint. Only the macOS location
 * is known; other platforms return undefined.
 */
export function actualRuntimeFilePath(
	platform: NodeJS.Platform = process.platform,
	home: string = os.homedir(),
): string | undefined {
	if (platform !== "darwin") return undefined;
	return path.join(home, "Library", "Application Support", "actual", "actual-runtime.json");
}

/** Signal-0 probe: EPERM means the pid exists under another user. */
export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error instanceof Error && "code" in error && error.code === "EPERM";
	}
}

export interface ActualRuntimeFileOptions {
	/**
	 * Runtime file path; defaults to {@link actualRuntimeFilePath}. `null`
	 * means the platform has no known runtime file location.
	 */
	path?: string | null;
	readFile?: (filePath: string) => string;
	isProcessAlive?: (pid: number) => boolean;
}

/**
 * The running runner's `api_url` (no trailing slash), or undefined when the
 * file is absent, unreadable, malformed, names a non-http(s) URL, or was left
 * behind by a runner whose `pid` is no longer alive.
 */
export function readActualRuntimeApiUrl(options: ActualRuntimeFileOptions = {}): string | undefined {
	const filePath = options.path === undefined ? actualRuntimeFilePath() : options.path;
	if (!filePath) return undefined;
	const readFile = options.readFile ?? ((p: string) => fs.readFileSync(p, "utf8"));
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFile(filePath));
	} catch {
		return undefined;
	}
	if (typeof parsed !== "object" || parsed === null || !("api_url" in parsed) || !("pid" in parsed)) {
		return undefined;
	}
	const { api_url: apiUrl, pid } = parsed;
	if (typeof apiUrl !== "string" || typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) {
		return undefined;
	}
	let url: URL;
	try {
		url = new URL(apiUrl.trim());
	} catch {
		return undefined;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
	if (!(options.isProcessAlive ?? isProcessAlive)(pid)) return undefined;
	return url.href.replace(/\/+$/, "");
}

export interface ResolveActualLocalBaseUrlOptions extends ActualRuntimeFileOptions {
	env?: Record<string, string | undefined>;
}

/**
 * `ACTUAL_LOCAL_BASE_URL`, else the live runtime file's `api_url` + `/v1`.
 * Where a runtime file location is known, a missing or stale file means
 * Actual is not running: undefined, so nothing probes a port another server
 * (llama-server defaults to 8080 too) may own. Platforms with no known
 * location fall back to {@link ACTUAL_LOCAL_DEFAULT_BASE_URL}.
 */
export function resolveActualLocalBaseUrl(options: ResolveActualLocalBaseUrlOptions = {}): string | undefined {
	const env = options.env ?? Bun.env;
	const override = env.ACTUAL_LOCAL_BASE_URL?.trim();
	if (override) return override;
	const filePath = options.path === undefined ? actualRuntimeFilePath() : options.path;
	if (!filePath) return ACTUAL_LOCAL_DEFAULT_BASE_URL;
	const apiUrl = readActualRuntimeApiUrl({ ...options, path: filePath });
	return apiUrl ? `${apiUrl}/v1` : undefined;
}

/**
 * Like {@link resolveActualLocalBaseUrl} but never falls back to the default
 * port: a relay-side probe must only reach a runner known to be live.
 */
export function actualLocalStatusBaseUrl(options: ResolveActualLocalBaseUrlOptions = {}): string | undefined {
	const override = (options.env ?? Bun.env).ACTUAL_LOCAL_BASE_URL?.trim();
	if (override) return override;
	const apiUrl = readActualRuntimeApiUrl(options);
	return apiUrl ? `${apiUrl}/v1` : undefined;
}

export interface ActualActiveModelContext {
	modelId: string;
	contextWindow: number;
}

/**
 * The loaded model and its runtime context from `GET {base}/status`. The
 * runner sizes context at daemon start (`--ctx-size`, else from free memory),
 * so `/v1/models` cannot carry it. Any failure yields null.
 */
export async function fetchActualActiveModelContext(
	baseUrl: string,
	fetchImpl: FetchImpl,
	init?: { headers?: Record<string, string>; signal?: AbortSignal },
): Promise<ActualActiveModelContext | null> {
	try {
		const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/status`, {
			headers: { Accept: "application/json", ...init?.headers },
			signal: init?.signal,
		});
		if (!response.ok) return null;
		const payload: unknown = await response.json();
		if (typeof payload !== "object" || payload === null || !("model" in payload)) return null;
		const model = payload.model;
		if (typeof model !== "object" || model === null || !("active" in model) || !("runtime" in model)) return null;
		const { active, runtime } = model;
		if (typeof active !== "string" || !active) return null;
		if (typeof runtime !== "object" || runtime === null || !("context_length" in runtime)) return null;
		const contextLength = runtime.context_length;
		if (typeof contextLength !== "number" || !Number.isSafeInteger(contextLength) || contextLength <= 0) return null;
		return { modelId: active, contextWindow: contextLength };
	} catch {
		return null;
	}
}

/** Relay request headers; `ACTUAL_CLUSTER_ID` pins requests to one of the user's clusters. */
export function actualRelayHeaders(env: Record<string, string | undefined> = Bun.env): Record<string, string> {
	const clusterId = env.ACTUAL_CLUSTER_ID?.trim();
	return clusterId ? { "X-Cluster-ID": clusterId } : {};
}
