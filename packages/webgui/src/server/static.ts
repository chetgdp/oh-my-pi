import { resolve, join } from "node:path";
import { realpath, stat } from "node:fs/promises";

/**
 * Serve a file from distDir, with SPA fallback to index.html.
 * Paths resolving outside distDir return 404.
 */
export async function serveStatic(url: URL, distDir: string): Promise<Response> {
	const resolvedDistDir = await realpath(distDir);
	const pathname = decodeURIComponent(url.pathname);
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
		return spaFallback(resolvedDistDir);
	}

	// After symlink resolution, re-check containment.
	if (!real.startsWith(resolvedDistDir + "/") && real !== resolvedDistDir) {
		return new Response("not found", { status: 404 });
	}

	// If it is a directory, serve its index.html or SPA fallback.
	const info = await stat(real);
	if (info.isDirectory()) {
		const dirIndex = Bun.file(join(real, "index.html"));
		if (await dirIndex.exists()) return new Response(dirIndex);
		return spaFallback(resolvedDistDir);
	}

	return new Response(Bun.file(real));
}

async function spaFallback(resolvedDistDir: string): Promise<Response> {
	const index = Bun.file(join(resolvedDistDir, "index.html"));
	if (await index.exists()) return new Response(index);
	return new Response("not found", { status: 404 });
}
