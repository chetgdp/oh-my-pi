export interface SecurityCheckResult {
	valid: boolean;
	status?: number;
	reason?: string;
}

// Tailscale serve proxies the tailnet name to 127.0.0.1 and keeps that name
// in Host. Rebinding a *.ts.net name requires control of the tailnet, so it
// is as trusted as loopback here.
const TAILNET_SUFFIX = ".ts.net";

function isTrustedHostname(hostname: string, allowedHosts: string[]): boolean {
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]" ||
		hostname.endsWith(TAILNET_SUFFIX) ||
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

	const isNonGet = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";

	if (isWsUpgrade || isNonGet) {
		const originHeader = req.headers.get("origin");
		if (originHeader) {
			let originUrl: URL;
			try {
				originUrl = new URL(originHeader);
			} catch {
				return { valid: false, status: 403, reason: "invalid origin header" };
			}

			const originHostMatch = isTrustedHostname(originUrl.hostname.toLowerCase(), allowedHosts);

			if (!originHostMatch) {
				return { valid: false, status: 403, reason: "cross-origin request rejected" };
			}
		}
	}

	return { valid: true };
}
