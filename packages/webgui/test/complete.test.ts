import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { clearCompletionProviders, handleCompleteRequest, type CompletionResult } from "../src/server/complete";
import type { DaemonOptions } from "../src/server/options";
import { publishListeningHost, type ListeningHost } from "./listening-host";

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "complete-test-"));
const registryDir = path.join(tmpBase, "registry");
const project = path.join(tmpBase, "project");
const opts: DaemonOptions = { registryDir };
let host: ListeningHost;

beforeAll(async () => {
	fs.mkdirSync(registryDir, { recursive: true });
	fs.mkdirSync(path.join(project, "src"), { recursive: true });
	fs.writeFileSync(path.join(project, "src", "zebrafish-module.ts"), "export {};\n");
	fs.writeFileSync(path.join(project, "src", "other.ts"), "export {};\n");
	fs.writeFileSync(path.join(project, "zebrafish-secret.ts"), "export {};\n");
	fs.writeFileSync(path.join(project, ".gitignore"), "zebrafish-secret.ts\n");
	// Gitignore only applies inside a repository.
	Bun.spawnSync(["git", "init", "-q"], { cwd: project });
	host = await publishListeningHost(
		{ sessionId: "s", sessionName: null, sessionFile: null, cwd: project, model: null, startedAt: Date.now() },
		{ dir: registryDir },
	);
});

afterAll(() => {
	host.close();
	clearCompletionProviders();
	fs.rmSync(tmpBase, { recursive: true, force: true });
});

function request(instanceId: string, params: Record<string, string>): Promise<Response | null> {
	const url = new URL(`http://localhost/api/live/${instanceId}/complete`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return handleCompleteRequest(new Request(url.href), url, opts);
}

describe("GET /api/live/:id/complete", () => {
	it("ignores other paths and methods", async () => {
		const url = new URL("http://localhost/api/live/x/export");
		expect(await handleCompleteRequest(new Request(url.href), url, opts)).toBeNull();
	});

	it("returns 404 for an unknown instance", async () => {
		const res = await request("no-such-instance", { text: "@a", cursor: "2" });
		expect(res?.status).toBe(404);
	});

	it("returns 400 for missing text or a bad cursor", async () => {
		expect((await request(host.entry.instanceId, { cursor: "0" }))?.status).toBe(400);
		expect((await request(host.entry.instanceId, { text: "abc", cursor: "4" }))?.status).toBe(400);
		expect((await request(host.entry.instanceId, { text: "abc", cursor: "1.5" }))?.status).toBe(400);
		expect((await request(host.entry.instanceId, { text: "abc", cursor: "-1" }))?.status).toBe(400);
		expect((await request(host.entry.instanceId, { text: "abc" }))?.status).toBe(400);
	});

	it("fuzzy-finds files for an @ token", async () => {
		const text = "look at @zebramod please";
		const cursor = "look at @zebramod".length;
		const res = await request(host.entry.instanceId, { text, cursor: String(cursor) });
		expect(res?.status).toBe(200);
		const body = (await res!.json()) as CompletionResult;
		expect(body.prefix).toBe("@zebramod");
		const hit = body.items.find(i => i.value.includes("zebrafish-module.ts"));
		expect(hit).toBeDefined();
		expect(hit!.value.startsWith("@")).toBe(true);
	});

	it("excludes gitignored files from @ fuzzy search", async () => {
		const res = await request(host.entry.instanceId, { text: "@zebrafish", cursor: "10" });
		const body = (await res!.json()) as CompletionResult | null;
		const values = body?.items.map(i => i.value) ?? [];
		expect(values.some(v => v.includes("zebrafish-module.ts"))).toBe(true);
		expect(values.some(v => v.includes("zebrafish-secret"))).toBe(false);
	});

	it("lists directory entries on force", async () => {
		const res = await request(host.entry.instanceId, { text: "first line\nsee src/", cursor: "19", force: "1" });
		const body = (await res!.json()) as CompletionResult;
		expect(body.prefix).toBe("src/");
		const values = body.items.map(i => i.value);
		expect(values).toContain("src/other.ts");
		expect(values).toContain("src/zebrafish-module.ts");
	});
});
