import { describe, expect, test } from "bun:test";
import { formatSessionTable, uniqueIdLength } from "@oh-my-pi/pi-coding-agent/cli/host-cli";
import type { RpcHostEntry } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { type LiveSessionRow, resolveLiveSession } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-session-list";

describe("resolveLiveSession", () => {
	const entry = (sessionId: string, kind?: "tui" | "host"): RpcHostEntry =>
		({
			instanceId: `inst-${sessionId}`,
			pid: 1,
			endpoint: "/sock",
			token: "secret-token",
			sessionId,
			sessionName: null,
			sessionFile: null,
			cwd: "/w",
			model: null,
			startedAt: 0,
			...(kind ? { kind } : {}),
		}) as RpcHostEntry;
	const entries = [entry("abc123", "host"), entry("abc456"), entry("abc")];

	test("exact id wins over a prefix of others", () => {
		const match = resolveLiveSession(entries, "abc");
		expect(match.ok && match.entry.instanceId).toBe("inst-abc");
	});
	test("unique prefix resolves; entries without kind are TUIs", () => {
		const match = resolveLiveSession(entries, "abc4");
		expect(match.ok && match.entry.instanceId).toBe("inst-abc456");
	});
	test("ambiguous prefix lists candidates one per line by kind, never tokens", () => {
		const match = resolveLiveSession(entries, "ab");
		expect(match.ok).toBe(false);
		if (match.ok) return;
		const lines = match.error.split("\n");
		expect(lines[0]).toContain("ambiguous");
		expect(lines.filter(line => line.includes("abc123  [host]"))).toHaveLength(1);
		expect(lines.filter(line => line.includes("abc456  [tui]"))).toHaveLength(1);
		expect(match.error).not.toContain("secret-token");
		expect(match.error).not.toContain("/sock");
	});
	test("no match names the query and the live sessions", () => {
		const match = resolveLiveSession(entries, "zz");
		expect(match.ok).toBe(false);
		if (!match.ok) expect(match.error).toContain('no live session id starts with "zz"');
		const none = resolveLiveSession([], "zz");
		if (!none.ok) expect(none.error).toContain("no live sessions");
	});
});

describe("omp host list table", () => {
	test("ids are cut to 8 chars, longer only when 8 would collide", () => {
		expect(uniqueIdLength(["01a1d0d3-aaaa", "01a1d0dd-bbbb"])).toBe(8);
		expect(uniqueIdLength(["01a1d0dd-aaaa", "01a1d0dd-bbbb"])).toBe(10);
	});

	test("columns line up by display width, including emoji names", () => {
		const row = (sessionId: string, sessionName: string, kind: string): LiveSessionRow => ({
			sessionId,
			sessionName,
			cwd: "/tmp",
			kind,
			pid: 7,
			state: "settled",
		});
		const lines = formatSessionTable(
			[row("01a1d0d3-x", "🖥️ WEBGUI", "tui"), row("01a1d0dd-y", "MAIN", "host")],
			Number.POSITIVE_INFINITY,
		);
		const cwdColumn = lines.map(line => Bun.stringWidth(line.slice(0, line.indexOf("/tmp"))));
		expect(cwdColumn[1]).toBe(cwdColumn[2]);
		expect(lines[1]).toContain("01a1d0d3 ");
	});
});
