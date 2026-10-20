export interface SecurityCheckResult {
	valid: boolean;
	status?: number;
	reason?: string;
}

// Tailscale serve proxies the tailnet name to 127.0.0.1 and keeps that name
// in Host. Rebinding a tailnet name requires control of the tailnet, so it is
// as trusted as loopback here. WEBGUI_TAILNET pins the trust to the user's
// own tailnet; without it any *.ts.net name is accepted (legacy behavior).
const LEGACY_TAILNET_SUFFIX = ".ts.net";

function tailnetSuffix(): string {
	const tailnet = (Bun.env.WEBGUI_TAILNET ?? "").trim().toLowerCase().replace(/^\.+/, "");
	return tailnet ? `.${tailnet}` : LEGACY_TAILNET_SUFFIX;
}

function isTrustedHostname(hostname: string, allowedHosts: string[]): boolean {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]" ||
		hostname.endsWith(tailnetSuffix()) ||
		allowedHosts.includes(hostname)
	);
}

function hostnameOf(hostHeader: string): string | undefined {
	try {
		return new URL(`http://${hostHeader}`).hostname.toLowerCase();
	} catch {
		return undefined;
	}
}

/**
 * CORS headers for an `/api/*` response. Only valid after
 * validateHostAndOrigin passed, which guarantees any Origin is trusted.
 */
export function corsHeaders(req: Request): Record<string, string> {
	const origin = req.headers.get("origin");
	if (!origin) return {};
	return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

export function preflightResponse(req: Request): Response {
	return new Response(null, {
		status: 204,
		headers: {
			...corsHeaders(req),
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "content-type",
			"Access-Control-Max-Age": "600",
		},
	});
}

export function validateHostAndOrigin(
	req: Request,
	options: { allowedHosts?: string[]; defaultPort?: number } = {},
): SecurityCheckResult {
	const hostHeader = req.headers.get("host");
	if (!hostHeader) {
		return { valid: false, status: 400, reason: "missing host header" };
	}

	const allowedHosts = [
		...(options.allowedHosts ?? []),
		...(Bun.env.WEBGUI_ALLOWED_HOSTS ?? "").split(",").map(h => h.trim()),
	]
		.map(h => h.toLowerCase())
		.filter(Boolean);
	const hostname = hostnameOf(hostHeader);
	if (!hostname || !isTrustedHostname(hostname, allowedHosts)) {
		return { valid: false, status: 403, reason: "forbidden host" };
	}

	const isWsUpgrade =
		req.headers.get("upgrade")?.toLowerCase() === "websocket" ||
		req.headers.get("connection")?.toLowerCase().includes("upgrade");

	const isNonGet = req.method !== "GET" && req.method !== "HEAD";
	// API reads get CORS headers, so their Origin must be trusted as well.
	const isApi = new URL(req.url).pathname.startsWith("/api/");

	if (isWsUpgrade || isNonGet || isApi) {
		const originHeader = req.headers.get("origin");
		if (originHeader) {
			let originUrl: URL;
			try {
				originUrl = new URL(originHeader);
			} catch {
				return { valid: false, status: 403, reason: "invalid origin header" };
			}

			if (!isTrustedHostname(originUrl.hostname.toLowerCase(), allowedHosts)) {
				return { valid: false, status: 403, reason: "cross-origin request rejected" };
			}
		}
	}

	return { valid: true };
}
