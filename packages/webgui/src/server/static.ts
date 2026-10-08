import { resolve, join } from "node:path";
import { realpath, stat } from "node:fs/promises";

interface EncodingPreference {
	br: number;
	gzip: number;
}

export function parseAcceptEncoding(header: string | null): EncodingPreference {
	if (!header) return { br: 0, gzip: 0 };
	let brQ: number | undefined;
	let gzipQ: number | undefined;
	let starQ: number | undefined;

	for (const part of header.split(",")) {
		const [token, ...params] = part.trim().split(";");
		const name = token.trim().toLowerCase();
		let q = 1.0;
		for (const param of params) {
			const [k, v] = param.trim().split("=");
			if (k?.trim().toLowerCase() === "q") {
				const parsed = Number.parseFloat(v?.trim() ?? "");
				if (!Number.isNaN(parsed)) {
					q = Math.max(0, Math.min(1, parsed));
				}
			}
		}
		if (name === "br") brQ = q;
		else if (name === "gzip") gzipQ = q;
		else if (name === "*") starQ = q;
	}

	const effectiveBr = brQ !== undefined ? brQ : (starQ ?? 0);
	const effectiveGzip = gzipQ !== undefined ? gzipQ : (starQ ?? 0);

	return {
		br: effectiveBr > 0 ? effectiveBr : 0,
		gzip: effectiveGzip > 0 ? effectiveGzip : 0,
	};
}

export function matchesIfNoneMatch(ifNoneMatch: string | null, etag: string): boolean {
	if (!ifNoneMatch) return false;
	const trimmed = ifNoneMatch.trim();
	if (trimmed === "*") return true;

	const clean = (tag: string) => {
		const t = tag.trim().replace(/^W\//, "");
		return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
	};

	const target = clean(etag);
	for (const part of trimmed.split(",")) {
		if (clean(part) === target) return true;
	}
	return false;
}

function extractRawPath(reqUrl: string): string {
	const withoutOrigin = reqUrl.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*/, "");
	const rawPath = withoutOrigin.split(/[?#]/)[0] || "/";
	return rawPath.startsWith("/") ? rawPath : "/" + rawPath;
}

async function serveFile(req: Request, targetPath: string, resolvedDistDir: string): Promise<Response> {
	const isIndexHtml = targetPath === join(resolvedDistDir, "index.html");
	const rawFile = Bun.file(targetPath);
	const rawType = rawFile.type || "application/octet-stream";

	// For index.html: generate ETag and handle conditional requests
	let etag: string | undefined;
	if (isIndexHtml) {
		const content = await rawFile.arrayBuffer();
		const hash = Bun.hash(content);
		etag = `"${hash.toString(16)}"`;

		if (matchesIfNoneMatch(req.headers.get("if-none-match"), etag)) {
			return new Response(null, {
				status: 304,
				headers: {
					"cache-control": "no-cache",
					etag,
					vary: "Accept-Encoding",
				},
			});
		}
	}

	// Content negotiation for precompressed siblings
	const accept = parseAcceptEncoding(req.headers.get("accept-encoding"));
	let chosenFile = rawFile;
	let contentEncoding: string | undefined;

	const brFile = Bun.file(targetPath + ".br");
	const gzFile = Bun.file(targetPath + ".gz");

	if (accept.br > 0 && accept.br >= accept.gzip) {
		if (await brFile.exists()) {
			chosenFile = brFile;
			contentEncoding = "br";
		} else if (accept.gzip > 0 && (await gzFile.exists())) {
			chosenFile = gzFile;
			contentEncoding = "gzip";
		}
	} else if (accept.gzip > 0 && accept.gzip > accept.br) {
		if (await gzFile.exists()) {
			chosenFile = gzFile;
			contentEncoding = "gzip";
		} else if (accept.br > 0 && (await brFile.exists())) {
			chosenFile = brFile;
			contentEncoding = "br";
		}
	}

	const headers = new Headers();
	headers.set("content-type", rawType);
	headers.set("vary", "Accept-Encoding");
	headers.set("cache-control", isIndexHtml ? "no-cache" : "public, max-age=31536000, immutable");
	if (etag) {
		headers.set("etag", etag);
	}
	if (contentEncoding) {
		headers.set("content-encoding", contentEncoding);
	}

	if (req.method === "HEAD") {
		headers.set("content-length", String(chosenFile.size));
		return new Response(null, { status: 200, headers });
	}

	return new Response(chosenFile, { status: 200, headers });
}

/**
 * Serve a file from distDir, with SPA fallback to index.html.
 * Precompressed siblings (.br and .gz) are selected per Accept-Encoding.
 * Paths resolving outside distDir return 404.
 */
export async function serveStatic(req: Request, distDir: string): Promise<Response> {
	if (req.method !== "GET" && req.method !== "HEAD") {
		return new Response("method not allowed", {
			status: 405,
			headers: { allow: "GET, HEAD" },
		});
	}

	const resolvedDistDir = await realpath(distDir);
	const rawPath = extractRawPath(req.url);

	let pathname: string;
	try {
		pathname = decodeURIComponent(rawPath);
	} catch {
		return new Response("not found", { status: 404 });
	}

	// Never serve precompressed artifacts directly by their own URL.
	if (pathname.endsWith(".br") || pathname.endsWith(".gz")) {
		return new Response("not found", { status: 404 });
	}

	const candidate = resolve(resolvedDistDir, "." + pathname);

	// Reject anything that escapes distDir before touching the filesystem.
	if (!candidate.startsWith(resolvedDistDir + "/") && candidate !== resolvedDistDir) {
		return new Response("not found", { status: 404 });
	}

	// Check if file exists and resolve symlinks.
	let real: string;
	try {
		real = await realpath(candidate);
	} catch {
		return spaFallback(req, resolvedDistDir);
	}

	// After symlink resolution, re-check containment.
	if (!real.startsWith(resolvedDistDir + "/") && real !== resolvedDistDir) {
		return new Response("not found", { status: 404 });
	}

	// If it is a directory, serve its index.html or SPA fallback.
	const info = await stat(real);
	if (info.isDirectory()) {
		const dirIndex = join(real, "index.html");
		if (await Bun.file(dirIndex).exists()) {
			return serveFile(req, dirIndex, resolvedDistDir);
		}
		return spaFallback(req, resolvedDistDir);
	}

	return serveFile(req, real, resolvedDistDir);
}

async function spaFallback(req: Request, resolvedDistDir: string): Promise<Response> {
	const index = join(resolvedDistDir, "index.html");
	if (await Bun.file(index).exists()) {
		return serveFile(req, index, resolvedDistDir);
	}
	return new Response("not found", { status: 404 });
}
