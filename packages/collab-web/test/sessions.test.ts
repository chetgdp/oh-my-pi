import { describe, expect, it } from "bun:test";
import { RpcBridge } from "../src/server/rpc-bridge";
import { RpcWebClient } from "../src/lib/rpc-web-client";

describe("Session & Workspace Management", () => {
	it("lists sessions with formatted metadata", async () => {
		const bridge = new RpcBridge();
		const sessions = await bridge.listSessions({ all: true });

		expect(Array.isArray(sessions)).toBe(true);
		if (sessions.length > 0) {
			const s = sessions[0];
			expect(typeof s.id).toBe("string");
			expect(typeof s.path).toBe("string");
			expect(typeof s.cwd).toBe("string");
			expect(typeof s.created).toBe("string");
			expect(typeof s.modified).toBe("string");
			expect(typeof s.messageCount).toBe("number");
		}
	});

	it("previews a session file with turns and header", async () => {
		const bridge = new RpcBridge();
		const sessions = await bridge.listSessions({ all: true });
		if (sessions.length === 0) return;

		const target = sessions[0];
		const preview = await bridge.previewSession(target.path);

		expect(preview.path).toBe(target.path);
		expect(Array.isArray(preview.messages)).toBe(true);
		expect(typeof preview.messageCount).toBe("number");
		if (preview.messages.length > 0) {
			const m = preview.messages[0];
			expect(typeof m.id).toBe("string");
			expect(m.role === "user" || m.role === "assistant").toBe(true);
		}
	});

	it("aggregates workspaces from sessions", async () => {
		const bridge = new RpcBridge();
		const workspaces = await bridge.listWorkspaces();

		expect(Array.isArray(workspaces)).toBe(true);
		if (workspaces.length > 0) {
			const ws = workspaces[0];
			expect(typeof ws.cwd).toBe("string");
			expect(typeof ws.name).toBe("string");
			expect(typeof ws.sessionCount).toBe("number");
			expect(ws.sessionCount).toBeGreaterThan(0);
			expect(typeof ws.lastModified).toBe("string");
		}
	});

	it("filters sessions by project cwd", async () => {
		const bridge = new RpcBridge();
		const currentCwd = process.cwd();
		const projectSessions = await bridge.listSessions({ cwd: currentCwd, all: false });

		expect(Array.isArray(projectSessions)).toBe(true);
		for (const s of projectSessions) {
			expect(s.cwd).toBe(currentCwd);
		}
	});

	it("RpcWebClient invokes listSessions and formats params", async () => {
		const client = new RpcWebClient("ws://127.0.0.1:8081/ws");
		// Mock global fetch for the test
		const originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = (async (url: string | URL) => {
				const u = new URL(String(url));
				expect(u.pathname).toBe("/api/sessions");
				expect(u.searchParams.get("all")).toBe("true");
				return new Response(
					JSON.stringify({
						currentCwd: "/test/dir",
						currentSessionFile: "/test/file.jsonl",
						sessions: [
							{
								id: "test-id",
								path: "/test/file.jsonl",
								cwd: "/test/dir",
								title: "Test Session",
								created: "2026-09-20T00:00:00.000Z",
								modified: "2026-09-20T01:00:00.000Z",
								messageCount: 5,
								size: 1024,
							},
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}) as unknown as typeof fetch;

			const resp = await client.listSessions({ all: true });
			expect(resp.currentCwd).toBe("/test/dir");
			expect(resp.sessions.length).toBe(1);
			expect(resp.sessions[0].title).toBe("Test Session");
		} finally {
			globalThis.fetch = originalFetch;
			client.close();
		}
	});

	it("RpcWebClient invokes previewSession with encoded path", async () => {
		const client = new RpcWebClient("ws://127.0.0.1:8081/ws");
		const originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = (async (url: string | URL) => {
				const u = new URL(String(url));
				expect(u.pathname).toBe("/api/sessions/preview");
				expect(u.searchParams.get("path")).toBe("/path with spaces/file.jsonl");
				return new Response(
					JSON.stringify({
						id: "s1",
						path: "/path with spaces/file.jsonl",
						cwd: "/cwd",
						messageCount: 2,
						messages: [
							{ id: "m1", role: "user", text: "hello" },
							{ id: "m2", role: "assistant", text: "world" },
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}) as unknown as typeof fetch;

			const preview = await client.previewSession("/path with spaces/file.jsonl");
			expect(preview.id).toBe("s1");
			expect(preview.messages.length).toBe(2);
			expect(preview.messages[1].text).toBe("world");
		} finally {
			globalThis.fetch = originalFetch;
			client.close();
		}
	});

	it("RpcWebClient invokes listWorkspaces", async () => {
		const client = new RpcWebClient("ws://127.0.0.1:8081/ws");
		const originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = (async (url: string | URL) => {
				const u = new URL(String(url));
				expect(u.pathname).toBe("/api/workspaces");
				return new Response(
					JSON.stringify({
						currentCwd: "/work",
						workspaces: [{ cwd: "/work", name: "work", sessionCount: 10, lastModified: "2026-09-20T00:00:00Z" }],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}) as unknown as typeof fetch;

			const res = await client.listWorkspaces();
			expect(res.currentCwd).toBe("/work");
			expect(res.workspaces.length).toBe(1);
			expect(res.workspaces[0].name).toBe("work");
		} finally {
			globalThis.fetch = originalFetch;
			client.close();
		}
	});
});
