import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Server } from "bun";
import { createServer } from "../src/server/index";
import { shaderDumpDir } from "../src/server/shader-dump";

describe("/api/shader-dump", () => {
	let server: Server<unknown> | undefined;
	let distDir: string | undefined;
	const written: string[] = [];

	afterEach(() => {
		server?.stop(true);
		server = undefined;
		if (distDir) fs.rmSync(distDir, { recursive: true, force: true });
		for (const f of written) fs.rmSync(f, { force: true });
		written.length = 0;
	});

	function start(): string {
		distDir = fs.mkdtempSync(path.join(os.tmpdir(), "shader-dump-test-"));
		server = createServer({ registryDir: distDir, host: "127.0.0.1", port: 0, distDir });
		return `http://127.0.0.1:${server.port}`;
	}

	it("stores the body under the variant name", async () => {
		const base = start();
		const file = path.join(shaderDumpDir(), "splash-zztest+lod.hlsl.txt");
		written.push(file);
		const res = await fetch(`${base}/api/shader-dump?name=${encodeURIComponent("zztest+lod")}`, {
			method: "POST",
			body: "float4 main() {}",
		});
		expect(res.status).toBe(200);
		expect(await Bun.file(file).text()).toBe("float4 main() {}");
	});

	it("rejects names that could leave the dump directory", async () => {
		const base = start();
		for (const name of ["../x", "a/b", "A", "", "x.txt"]) {
			const res = await fetch(`${base}/api/shader-dump?name=${encodeURIComponent(name)}`, {
				method: "POST",
				body: "x",
			});
			expect(res.status).toBe(400);
		}
	});

	it("rejects bodies over 1 MiB and non-POST methods", async () => {
		const base = start();
		const big = await fetch(`${base}/api/shader-dump?name=zzbig`, {
			method: "POST",
			body: "x".repeat((1 << 20) + 1),
		});
		expect(big.status).toBe(413);
		expect(fs.existsSync(path.join(shaderDumpDir(), "splash-zzbig.hlsl.txt"))).toBe(false);
		const get = await fetch(`${base}/api/shader-dump?name=zzget`);
		expect(get.status).toBe(405);
	});

	it("refuses an untrusted origin", async () => {
		const base = start();
		const res = await fetch(`${base}/api/shader-dump?name=zzorigin`, {
			method: "POST",
			body: "x",
			headers: { Origin: "https://evil.example" },
		});
		expect(res.status).toBe(403);
	});
});
