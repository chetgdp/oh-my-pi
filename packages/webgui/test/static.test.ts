import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { serveStatic } from "../src/server/static";

let distDir: string;

beforeAll(async () => {
	distDir = await mkdtemp(join(tmpdir(), "webgui-static-"));

	// index.html and precompressed siblings
	await writeFile(join(distDir, "index.html"), "<html>index</html>");
	await writeFile(join(distDir, "index.html.br"), "br-index");
	await writeFile(join(distDir, "index.html.gz"), "gz-index");

	// app.js and precompressed siblings
	await writeFile(join(distDir, "app.js"), "console.log('app')");
	await writeFile(join(distDir, "app.js.br"), "br-app-content");
	await writeFile(join(distDir, "app.js.gz"), "gz-app-content");

	// File with only gzip sibling
	await writeFile(join(distDir, "only-gz.js"), "console.log('only-gz')");
	await writeFile(join(distDir, "only-gz.js.gz"), "gz-only-content");

	// File with only br sibling
	await writeFile(join(distDir, "only-br.js"), "console.log('only-br')");
	await writeFile(join(distDir, "only-br.js.br"), "br-only-content");

	// Raw only file
	await writeFile(join(distDir, "raw-only.txt"), "raw text content");

	// Nested assets
	await mkdir(join(distDir, "assets"), { recursive: true });
	await writeFile(join(distDir, "assets", "style.css"), "body{}");
	await writeFile(join(distDir, "assets", "style.css.br"), "br-style");
	await writeFile(join(distDir, "assets", "style.css.gz"), "gz-style");
});

afterAll(async () => {
	await rm(distDir, { recursive: true, force: true });
});

function req(path: string, init?: RequestInit): Request {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	return new Request(`http://localhost${normalized}`, init);
}

/**
 * Build a Request whose url is set verbatim, bypassing URL normalization
 * that collapses `..` segments. This simulates a malicious raw request line.
 */
function rawReq(rawPath: string, init?: RequestInit): Request {
	const r = new Request("http://localhost/placeholder", init);
	Object.defineProperty(r, "url", {
		value: `http://localhost${rawPath}`,
		writable: false,
	});
	return r;
}

describe("serveStatic", () => {
	test("/ returns index.html with no-cache and ETag", async () => {
		const res = await serveStatic(req("/"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<html>index</html>");
		expect(res.headers.get("content-type")).toBe("text/html;charset=utf-8");
		expect(res.headers.get("cache-control")).toBe("no-cache");
		expect(res.headers.get("vary")).toBe("Accept-Encoding");
		expect(res.headers.get("etag")).toBeTruthy();
	});

	test("direct /index.html is never served immutable", async () => {
		const res = await serveStatic(req("/index.html"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<html>index</html>");
		expect(res.headers.get("cache-control")).toBe("no-cache");
		expect(res.headers.get("cache-control")).not.toContain("immutable");
		expect(res.headers.get("etag")).toBeTruthy();
	});

	test("/app.js returns the file with immutable cache", async () => {
		const res = await serveStatic(req("/app.js"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("console.log('app')");
		expect(res.headers.get("content-type")).toBe("text/javascript;charset=utf-8");
		expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
		expect(res.headers.get("vary")).toBe("Accept-Encoding");
	});

	test("/assets/style.css returns nested file with immutable cache", async () => {
		const res = await serveStatic(req("/assets/style.css"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("body{}");
		expect(res.headers.get("content-type")).toBe("text/css;charset=utf-8");
		expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
	});

	test("/nope/deep returns index.html (SPA fallback) with no-cache", async () => {
		const res = await serveStatic(req("/nope/deep"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<html>index</html>");
		expect(res.headers.get("cache-control")).toBe("no-cache");
		expect(res.headers.get("etag")).toBeTruthy();
	});

	describe("precompressed content negotiation", () => {
		test("prefers br over gzip when both are accepted", async () => {
			const res = await serveStatic(
				req("/app.js", { headers: { "accept-encoding": "gzip, deflate, br" } }),
				distDir,
			);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBe("br");
			expect(res.headers.get("content-type")).toBe("text/javascript;charset=utf-8");
			expect(res.headers.get("vary")).toBe("Accept-Encoding");
			expect(await res.text()).toBe("br-app-content");
		});

		test("serves gzip when only gzip is accepted", async () => {
			const res = await serveStatic(req("/app.js", { headers: { "accept-encoding": "gzip" } }), distDir);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBe("gzip");
			expect(res.headers.get("content-type")).toBe("text/javascript;charset=utf-8");
			expect(res.headers.get("vary")).toBe("Accept-Encoding");
			expect(await res.text()).toBe("gz-app-content");
		});

		test("serves raw when no Accept-Encoding header is present", async () => {
			const res = await serveStatic(req("/app.js"), distDir);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBeNull();
			expect(res.headers.get("content-type")).toBe("text/javascript;charset=utf-8");
			expect(res.headers.get("vary")).toBe("Accept-Encoding");
			expect(await res.text()).toBe("console.log('app')");
		});

		test("respects q=0 to exclude br and use gzip", async () => {
			const res = await serveStatic(req("/app.js", { headers: { "accept-encoding": "br;q=0, gzip" } }), distDir);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBe("gzip");
			expect(await res.text()).toBe("gz-app-content");
		});

		test("falls back to gzip when br is accepted but .br sibling does not exist", async () => {
			const res = await serveStatic(req("/only-gz.js", { headers: { "accept-encoding": "gzip, br" } }), distDir);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBe("gzip");
			expect(await res.text()).toBe("gz-only-content");
		});

		test("falls back to raw when gzip is accepted but only .br exists", async () => {
			const res = await serveStatic(req("/only-br.js", { headers: { "accept-encoding": "gzip" } }), distDir);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBeNull();
			expect(await res.text()).toBe("console.log('only-br')");
		});

		test("serves raw when all encodings have q=0", async () => {
			const res = await serveStatic(req("/app.js", { headers: { "accept-encoding": "br;q=0, gzip;q=0" } }), distDir);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBeNull();
			expect(await res.text()).toBe("console.log('app')");
		});

		test("serves precompressed index.html with correct headers", async () => {
			const res = await serveStatic(req("/", { headers: { "accept-encoding": "br" } }), distDir);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-encoding")).toBe("br");
			expect(res.headers.get("content-type")).toBe("text/html;charset=utf-8");
			expect(res.headers.get("cache-control")).toBe("no-cache");
			expect(res.headers.get("etag")).toBeTruthy();
			expect(await res.text()).toBe("br-index");
		});
	});

	describe("ETag and conditional requests", () => {
		test("answers If-None-Match with 304 on matching ETag", async () => {
			const initial = await serveStatic(req("/index.html"), distDir);
			const etag = initial.headers.get("etag");
			expect(etag).toBeTruthy();

			const res = await serveStatic(req("/index.html", { headers: { "if-none-match": etag! } }), distDir);
			expect(res.status).toBe(304);
			expect(res.body).toBeNull();
			expect(res.headers.get("cache-control")).toBe("no-cache");
			expect(res.headers.get("vary")).toBe("Accept-Encoding");
			expect(res.headers.get("etag")).toBe(etag);
		});

		test("answers If-None-Match with 304 on weak-tagged or wildcard match", async () => {
			const initial = await serveStatic(req("/"), distDir);
			const etag = initial.headers.get("etag")!;

			const weakRes = await serveStatic(req("/", { headers: { "if-none-match": `W/${etag}` } }), distDir);
			expect(weakRes.status).toBe(304);

			const starRes = await serveStatic(req("/", { headers: { "if-none-match": "*" } }), distDir);
			expect(starRes.status).toBe(304);
		});

		test("answers If-None-Match with 200 on mismatched ETag", async () => {
			const res = await serveStatic(
				req("/index.html", { headers: { "if-none-match": '"nonexistent-hash"' } }),
				distDir,
			);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("<html>index</html>");
		});
	});

	describe("HEAD requests", () => {
		test("HEAD / returns 200 with null body, content-length, and same headers as GET", async () => {
			const res = await serveStatic(req("/", { method: "HEAD" }), distDir);
			expect(res.status).toBe(200);
			expect(res.body).toBeNull();
			expect(res.headers.get("content-type")).toBe("text/html;charset=utf-8");
			expect(res.headers.get("content-length")).toBe("18");
			expect(res.headers.get("cache-control")).toBe("no-cache");
			expect(res.headers.get("etag")).toBeTruthy();
		});

		test("HEAD /app.js with br returns content-length of compressed sibling", async () => {
			const res = await serveStatic(
				req("/app.js", {
					method: "HEAD",
					headers: { "accept-encoding": "br" },
				}),
				distDir,
			);
			expect(res.status).toBe(200);
			expect(res.body).toBeNull();
			expect(res.headers.get("content-encoding")).toBe("br");
			expect(res.headers.get("content-type")).toBe("text/javascript;charset=utf-8");
			expect(res.headers.get("content-length")).toBe("14"); // "br-app-content".length
		});

		test("HEAD with matching If-None-Match returns 304 with null body", async () => {
			const initial = await serveStatic(req("/index.html"), distDir);
			const etag = initial.headers.get("etag")!;

			const res = await serveStatic(
				req("/index.html", {
					method: "HEAD",
					headers: { "if-none-match": etag },
				}),
				distDir,
			);
			expect(res.status).toBe(304);
			expect(res.body).toBeNull();
		});
	});

	describe("direct requests to precompressed artifacts", () => {
		test("direct request to .br file returns 404", async () => {
			const res = await serveStatic(req("/app.js.br"), distDir);
			expect(res.status).toBe(404);
		});

		test("direct request to .gz file returns 404", async () => {
			const res = await serveStatic(req("/index.html.gz"), distDir);
			expect(res.status).toBe(404);
		});

		test("direct request to non-existent .br does not trigger SPA fallback", async () => {
			const res = await serveStatic(req("/missing-file.js.br"), distDir);
			expect(res.status).toBe(404);
		});
	});

	describe("path traversal protections", () => {
		test("raw traversal /../../etc/passwd returns 404", async () => {
			const res = await serveStatic(rawReq("/../../etc/passwd"), distDir);
			expect(res.status).toBe(404);
		});

		test("percent-encoded traversal returns 404", async () => {
			// %2e = "." -- after decodeURIComponent this becomes /../.. traversal
			const res = await serveStatic(rawReq("/%2e%2e/%2e%2e/etc/passwd"), distDir);
			expect(res.status).toBe(404);
		});

		test("URL-normalized traversal gets SPA fallback (URL already strips ..)", async () => {
			// Through the normal URL constructor, /../../etc/passwd becomes /etc/passwd
			// which resolves inside distDir and triggers SPA fallback (file not found).
			const res = await serveStatic(req("/../../etc/passwd"), distDir);
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("<html>index</html>");
		});
	});
});
