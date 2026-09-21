import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { serveStatic } from "../src/server/static";

let distDir: string;

beforeAll(async () => {
	distDir = await mkdtemp(join(tmpdir(), "webgui-static-"));
	await writeFile(join(distDir, "index.html"), "<html>index</html>");
	await writeFile(join(distDir, "app.js"), "console.log('app')");
	await mkdir(join(distDir, "assets"), { recursive: true });
	await writeFile(join(distDir, "assets", "style.css"), "body{}");
});

afterAll(async () => {
	await rm(distDir, { recursive: true, force: true });
});

function url(path: string): URL {
	return new URL(path, "http://localhost");
}

/**
 * Build a URL whose pathname is set verbatim, bypassing URL normalization
 * that collapses `..` segments. This simulates a malicious raw request line.
 */
function rawUrl(rawPath: string): URL {
	const u = new URL("http://localhost/placeholder");
	// Directly assign to bypass normalization for simple cases.
	// For encoded dots, the path stays as-is.
	Object.defineProperty(u, "pathname", { value: rawPath, writable: false });
	return u;
}

describe("serveStatic", () => {
	test("/ returns index.html", async () => {
		const res = await serveStatic(url("/"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<html>index</html>");
	});

	test("/app.js returns the file", async () => {
		const res = await serveStatic(url("/app.js"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("console.log('app')");
	});

	test("/assets/style.css returns nested file", async () => {
		const res = await serveStatic(url("/assets/style.css"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("body{}");
	});

	test("/nope/deep returns index.html (SPA fallback)", async () => {
		const res = await serveStatic(url("/nope/deep"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<html>index</html>");
	});

	test("raw traversal /../../etc/passwd returns 404", async () => {
		// Bypasses URL normalization to simulate a malicious request.
		const res = await serveStatic(rawUrl("/../../etc/passwd"), distDir);
		expect(res.status).toBe(404);
	});

	test("percent-encoded traversal returns 404", async () => {
		// %2e = "." -- after decodeURIComponent this becomes /../.. traversal
		const res = await serveStatic(rawUrl("/%2e%2e/%2e%2e/etc/passwd"), distDir);
		expect(res.status).toBe(404);
	});

	test("URL-normalized traversal gets SPA fallback (URL already strips ..)", async () => {
		// Through the normal URL constructor, /../../etc/passwd becomes /etc/passwd
		// which resolves inside distDir and triggers SPA fallback (file not found).
		const res = await serveStatic(url("/../../etc/passwd"), distDir);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("<html>index</html>");
	});
});
