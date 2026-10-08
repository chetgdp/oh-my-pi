import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	deletePastSession,
	listPastSessions,
	loadPastSessionPreview,
	handlePastRequest,
	invalidatePastSessions,
	resolvePastSessionPath,
	type PastSessionSummary,
	type PastSessionPreview,
} from "../src/server/past";

const FIXTURES_DIR = path.resolve(import.meta.dir, "fixtures/sessions");
const PROJECT_A_DIR = path.join(FIXTURES_DIR, "project-a");
const PROJECT_B_DIR = path.join(FIXTURES_DIR, "project-b");

// Fixture file paths (listSessionsReadOnly works on a flat dir of *.jsonl)
const SESSION_1 = path.join(PROJECT_A_DIR, "2026-09-10T10-00-00-000Z_sess-001.jsonl");
const SESSION_3 = path.join(PROJECT_B_DIR, "2026-09-12T08-00-00-000Z_sess-003.jsonl");

describe("listPastSessions", () => {
	it("returns summaries sorted newest-first for a fixture dir", async () => {
		const summaries = await listPastSessions({
			cwd: "ignored",
			sessionsDir: PROJECT_A_DIR,
		});
		expect(summaries.length).toBe(2);
		// newest first: sess-002 (Sep 15) before sess-001 (Sep 10)
		expect(summaries[0].id).toBe("sess-002");
		expect(summaries[1].id).toBe("sess-001");
		expect(summaries[0].cwd).toBe("/proj/a");
		expect(summaries[0].name).toBe("Bug fix session");
		expect(summaries[1].name).toBeNull();
		expect(summaries[0].firstUserMessage).toBe("Fix the login bug");
		expect(summaries[1].firstUserMessage).toBe("Hello world");
	});

	it("all: true lists sessions across all project subdirs", async () => {
		const summaries = await listPastSessions({
			all: true,
			sessionsDir: FIXTURES_DIR,
		});
		expect(summaries.length).toBe(3);
		const ids = summaries.map((s: PastSessionSummary) => s.id);
		expect(ids).toContain("sess-001");
		expect(ids).toContain("sess-002");
		expect(ids).toContain("sess-003");
	});

	it("cwd filter narrows to a single project dir", async () => {
		const summaries = await listPastSessions({
			cwd: "ignored",
			sessionsDir: PROJECT_B_DIR,
		});
		expect(summaries.length).toBe(1);
		expect(summaries[0].id).toBe("sess-003");
		expect(summaries[0].cwd).toBe("/proj/b");
	});
});

describe("loadPastSessionPreview", () => {
	it("returns messages for a valid session file", async () => {
		const preview = await loadPastSessionPreview(SESSION_1, { sessionsDir: FIXTURES_DIR });
		expect(preview).not.toBeNull();
		expect(preview!.id).toBe("sess-001");
		expect(preview!.cwd).toBe("/proj/a");
		expect(preview!.messages.length).toBe(2);
		expect(preview!.messages[0].role).toBe("user");
		expect(preview!.messages[0].text).toBe("Hello world");
		expect(preview!.messages[1].role).toBe("assistant");
		expect(preview!.messages[1].text).toBe("Hi there!");
		expect(preview!.firstUserMessage).toBe("Hello world");
	});

	it("returns null for a nonexistent file", async () => {
		const preview = await loadPastSessionPreview("/nonexistent/path.jsonl");
		expect(preview).toBeNull();
	});

	it("resolves a listed session id to its file across projects", async () => {
		const preview = await loadPastSessionPreview("sess-003", { sessionsDir: FIXTURES_DIR });
		expect(preview).not.toBeNull();
		expect(preview!.path).toBe(SESSION_3);
		expect(preview!.cwd).toBe("/proj/b");
	});

	it("returns null for an unknown session id", async () => {
		expect(await loadPastSessionPreview("sess-999", { sessionsDir: FIXTURES_DIR })).toBeNull();
	});
});

describe("handlePastRequest", () => {
	function makeReq(urlStr: string, method = "GET"): [Request, URL] {
		const url = new URL(urlStr, "http://localhost");
		return [new Request(url.href, { method }), url];
	}

	it("returns null for non-matching paths", async () => {
		const [req, url] = makeReq("/api/other");
		const resp = await handlePastRequest(req, url);
		expect(resp).toBeNull();
	});

	it("returns null for non-GET methods", async () => {
		const [req, url] = makeReq("/api/past", "POST");
		const resp = await handlePastRequest(req, url);
		expect(resp).toBeNull();
	});

	it("GET /api/past lists sessions from sessionsDir", async () => {
		const [req, url] = makeReq("/api/past");
		const resp = await handlePastRequest(req, url, {
			cwd: "ignored",
			sessionsDir: PROJECT_A_DIR,
		});
		expect(resp).not.toBeNull();
		expect(resp!.status).toBe(200);
		const body = (await resp!.json()) as PastSessionSummary[];
		expect(body.length).toBe(2);
		expect(body[0].id).toBe("sess-002");
	});

	it("GET /api/past/:id returns 404 for unknown session", async () => {
		const fakePath = encodeURIComponent("/nonexistent/session.jsonl");
		const [req, url] = makeReq(`/api/past/${fakePath}`);
		const resp = await handlePastRequest(req, url);
		expect(resp).not.toBeNull();
		expect(resp!.status).toBe(404);
	});

	it("GET /api/past/:id returns preview for a fixture session", async () => {
		const encoded = encodeURIComponent(SESSION_3);
		const [req, url] = makeReq(`/api/past/${encoded}`);
		const resp = await handlePastRequest(req, url, { sessionsDir: FIXTURES_DIR });
		expect(resp).not.toBeNull();
		expect(resp!.status).toBe(200);
		const body = (await resp!.json()) as PastSessionPreview;
		expect(body.id).toBe("sess-003");
		expect(body.messages.length).toBe(3);
		expect(body.messages[0].role).toBe("user");
		expect(body.messages[0].text).toBe("Deploy to production");
		expect(body.messages[2].text).toBe("Thanks");
	});
});

describe("resolvePastSessionPath containment", () => {
	let tmp: string;
	let root: string;
	let outside: string;

	beforeEach(() => {
		tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "past-contain-")));
		root = path.join(tmp, "sessions");
		outside = path.join(tmp, "outside");
		fs.mkdirSync(path.join(root, "proj", "sub"), { recursive: true });
		fs.mkdirSync(outside);
		fs.writeFileSync(path.join(root, "proj", "a.jsonl"), "");
		fs.writeFileSync(path.join(root, "proj", "sub", "b.jsonl"), "");
		fs.writeFileSync(path.join(root, "proj", "notes.txt"), "");
		fs.writeFileSync(path.join(root, "top.jsonl"), "");
		fs.writeFileSync(path.join(outside, "x.jsonl"), "");
		fs.symlinkSync(path.join(outside, "x.jsonl"), path.join(root, "proj", "link.jsonl"));
	});

	afterEach(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("accepts <root>/<proj>/*.jsonl and <root>/<proj>/<session>/*.jsonl", async () => {
		const a = path.join(root, "proj", "a.jsonl");
		const b = path.join(root, "proj", "sub", "b.jsonl");
		expect(await resolvePastSessionPath(a, { sessionsDir: root })).toBe(a);
		expect(await resolvePastSessionPath(b, { sessionsDir: root })).toBe(b);
	});

	it("rejects ../ escapes", async () => {
		const escaped = path.join(root, "proj", "..", "..", "outside", "x.jsonl");
		expect(await resolvePastSessionPath(`${root}/proj/../../outside/x.jsonl`, { sessionsDir: root })).toBeNull();
		expect(await resolvePastSessionPath(escaped, { sessionsDir: root })).toBeNull();
	});

	it("rejects absolute paths outside the root", async () => {
		expect(await resolvePastSessionPath(path.join(outside, "x.jsonl"), { sessionsDir: root })).toBeNull();
	});

	it("rejects symlinks inside the root pointing outside", async () => {
		expect(await resolvePastSessionPath(path.join(root, "proj", "link.jsonl"), { sessionsDir: root })).toBeNull();
	});

	it("rejects non-.jsonl files and wrong depth", async () => {
		expect(await resolvePastSessionPath(path.join(root, "proj", "notes.txt"), { sessionsDir: root })).toBeNull();
		expect(await resolvePastSessionPath(path.join(root, "top.jsonl"), { sessionsDir: root })).toBeNull();
		expect(await resolvePastSessionPath("relative/a.jsonl", { sessionsDir: root })).toBeNull();
	});

	it("GET /api/past/:path returns 404 for a path outside the root", async () => {
		const url = new URL(`/api/past/${encodeURIComponent(path.join(outside, "x.jsonl"))}`, "http://localhost");
		const resp = await handlePastRequest(new Request(url.href), url, { sessionsDir: root });
		expect(resp!.status).toBe(404);
	});
});

describe("GET /api/past?all=true caching", () => {
	let root: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "past-cache-"));
		fs.cpSync(FIXTURES_DIR, root, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	function get(opts: object, headers: Record<string, string> = {}) {
		const url = new URL("/api/past?all=true", "http://localhost");
		return handlePastRequest(new Request(url.href, { headers }), url, opts);
	}

	it("sends a weak ETag and answers 304 on If-None-Match", async () => {
		const opts = { sessionsDir: root };
		const first = (await get(opts))!;
		expect(first.status).toBe(200);
		expect(first.headers.get("cache-control")).toBe("no-cache");
		expect(first.headers.get("vary")).toBe("Accept-Encoding");
		const etag = first.headers.get("etag")!;
		expect(etag).toMatch(/^W\/"[0-9a-f]+"$/);
		const second = (await get(opts, { "if-none-match": etag }))!;
		expect(second.status).toBe(304);
		expect(second.headers.get("etag")).toBe(etag);
		expect(await second.text()).toBe("");
	});

	it("invalidation rescans and changes the body and ETag", async () => {
		const opts = { sessionsDir: root };
		const first = (await get(opts))!;
		const before = (await first.json()) as PastSessionSummary[];
		const victim = before[0];
		fs.rmSync(victim.path);
		const cached = (await get(opts))!;
		expect(cached.headers.get("etag")).toBe(first.headers.get("etag"));
		invalidatePastSessions();
		const fresh = (await get(opts))!;
		expect(fresh.headers.get("etag")).not.toBe(first.headers.get("etag"));
		const after = (await fresh.json()) as PastSessionSummary[];
		expect(after.length).toBe(before.length - 1);
		expect(after.some(s => s.id === victim.id)).toBe(false);
	});

	it("gzips when accepted and decodes to the same JSON", async () => {
		const opts = { sessionsDir: root };
		const plain = await (await get(opts))!.text();
		const gz = (await get(opts, { "accept-encoding": "gzip, deflate" }))!;
		expect(gz.headers.get("content-encoding")).toBe("gzip");
		const decoded = new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(await gz.arrayBuffer())));
		expect(decoded).toBe(plain);
		expect(JSON.parse(decoded)).toEqual(JSON.parse(plain));
	});
});

describe("bare id resolution", () => {
	const dirs: string[] = [];
	afterEach(() => {
		for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
	});

	function makeRoot(): string {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "past-resolve-"));
		dirs.push(root);
		fs.mkdirSync(path.join(root, "proj"));
		return root;
	}

	function writeSession(root: string, fileName: string, id: string): string {
		const file = path.join(root, "proj", fileName);
		const header = { type: "session", id, timestamp: "2026-09-12T08:00:00.000Z", cwd: "/proj/x" };
		const msg = {
			type: "message",
			id: "m1",
			parentId: null,
			timestamp: "2026-09-12T08:00:01.000Z",
			message: { role: "user", content: "hi" },
		};
		fs.writeFileSync(file, `${JSON.stringify(header)}\n${JSON.stringify(msg)}\n`);
		return file;
	}

	async function get(root: string, id: string): Promise<Response> {
		const url = new URL(`/api/past/${encodeURIComponent(id)}`, "http://localhost");
		const resp = await handlePastRequest(new Request(url.href), url, { sessionsDir: root });
		if (!resp) throw new Error("route not handled");
		return resp;
	}

	it("resolves ids created and deleted between calls", async () => {
		const root = makeRoot();
		const a = writeSession(root, "2026-09-12T08-00-00-000Z_aaa.jsonl", "aaa");
		expect((await get(root, "aaa")).status).toBe(200);
		expect((await get(root, "bbb")).status).toBe(404);

		const b = writeSession(root, "2026-09-12T09-00-00-000Z_bbb.jsonl", "bbb");
		const resp = await get(root, "bbb");
		expect(resp.status).toBe(200);
		expect(((await resp.json()) as PastSessionPreview).path).toBe(b);

		await deletePastSession("aaa", { sessionsDir: root, registryDir: root });
		expect(fs.existsSync(a)).toBe(false);
		expect((await get(root, "aaa")).status).toBe(404);
		await expect(deletePastSession("aaa", { sessionsDir: root, registryDir: root })).rejects.toThrow(
			"Session not found",
		);
	});

	it("does not match an id that is only a filename prefix or underscore suffix", async () => {
		const root = makeRoot();
		writeSession(root, "2026-09-12T08-00-00-000Z_x_abcdef.jsonl", "x_abcdef");
		expect((await get(root, "abc")).status).toBe(404);
		expect((await get(root, "abcdef")).status).toBe(404);
		expect((await get(root, "x_abcdef")).status).toBe(200);
	});

	it("trusts the header id over the filename and falls back for unconventional names", async () => {
		const root = makeRoot();
		writeSession(root, "2026-09-12T08-00-00-000Z_ccc.jsonl", "real-id");
		writeSession(root, "legacy.jsonl", "legacy-id");
		expect((await get(root, "ccc")).status).toBe(404);
		expect((await get(root, "real-id")).status).toBe(200);
		expect((await get(root, "legacy-id")).status).toBe(200);
	});

	it("rejects traversal ids on delete", async () => {
		const root = makeRoot();
		await expect(deletePastSession("../proj", { sessionsDir: root, registryDir: root })).rejects.toThrow(
			"Invalid session id",
		);
	});
});
