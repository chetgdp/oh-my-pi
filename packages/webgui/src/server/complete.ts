import { readLiveRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { CombinedAutocompleteProvider } from "@oh-my-pi/pi-tui/autocomplete";
import { logger } from "@oh-my-pi/pi-utils";
import type { DaemonOptions } from "./options";

export interface CompletionItem {
	value: string;
	label: string;
	description?: string;
}

export interface CompletionResult {
	/** Exact text immediately before the caret that `value` replaces. */
	prefix: string;
	items: CompletionItem[];
}

const ROUTE = /^\/api\/live\/([^/]+)\/complete$/;
/** Keystroke bursts reuse one liveness probe per instance within this window. */
const LIVENESS_TTL_MS = 2_000;
const LIVENESS_PROBE_TIMEOUT_MS = 500;
const MAX_PROVIDERS = 32;

interface ProviderEntry {
	cwd: string;
	provider: CombinedAutocompleteProvider;
	checkedAt: number;
}

/** Insertion order doubles as recency: hits are re-inserted, the first key is the oldest. */
const providers = new Map<string, ProviderEntry>();

async function providerFor(instanceId: string, opts: DaemonOptions): Promise<CombinedAutocompleteProvider | null> {
	const now = Date.now();
	const cached = providers.get(instanceId);
	if (cached && now - cached.checkedAt < LIVENESS_TTL_MS) {
		providers.delete(instanceId);
		providers.set(instanceId, cached);
		return cached.provider;
	}
	const entry = await readLiveRpcHost(instanceId, { dir: opts.registryDir }, LIVENESS_PROBE_TIMEOUT_MS);
	providers.delete(instanceId);
	if (!entry) return null;
	const provider =
		cached && cached.cwd === entry.cwd ? cached.provider : new CombinedAutocompleteProvider([], entry.cwd);
	providers.set(instanceId, { cwd: entry.cwd, provider, checkedAt: now });
	if (providers.size > MAX_PROVIDERS) {
		const oldest = providers.keys().next().value;
		if (oldest !== undefined) providers.delete(oldest);
	}
	return provider;
}

/** Test hook: drops every cached provider. */
export function clearCompletionProviders(): void {
	providers.clear();
}

export async function handleCompleteRequest(req: Request, url: URL, opts: DaemonOptions): Promise<Response | null> {
	if (req.method !== "GET") return null;
	const match = ROUTE.exec(url.pathname);
	if (!match) return null;
	const instanceId = decodeURIComponent(match[1]);

	const text = url.searchParams.get("text");
	if (text === null) return new Response("missing text", { status: 400 });
	const cursorRaw = url.searchParams.get("cursor");
	const cursor = cursorRaw !== null && /^\d+$/.test(cursorRaw) ? Number(cursorRaw) : Number.NaN;
	if (!Number.isSafeInteger(cursor) || cursor > text.length) {
		return new Response("invalid cursor", { status: 400 });
	}
	const force = url.searchParams.get("force") === "1";

	const provider = await providerFor(instanceId, opts);
	if (!provider) return new Response("not found", { status: 404 });

	const before = text.slice(0, cursor);
	const cursorLine = before.split("\n").length - 1;
	const cursorCol = cursor - (before.lastIndexOf("\n") + 1);
	const lines = text.split("\n");

	try {
		const result = force
			? await provider.getForceFileSuggestions(lines, cursorLine, cursorCol, req.signal)
			: await provider.getSuggestions(lines, cursorLine, cursorCol, req.signal);
		if (!result) return Response.json(null);
		const body: CompletionResult = {
			prefix: result.prefix,
			items: result.items.map(item =>
				item.description === undefined
					? { value: item.value, label: item.label }
					: { value: item.value, label: item.label, description: item.description },
			),
		};
		return Response.json(body);
	} catch (err) {
		logger.debug("webgui completion failed", { instanceId, error: String(err) });
		return Response.json(null);
	}
}
