import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";
import { listLiveSessions } from "../src/server/live";

const asst = (id: string): string => `${JSON.stringify({ type: "message", id, message: { role: "assistant" } })}\n`;
const user = (id: string): string => `${JSON.stringify({ type: "message", id, message: { role: "user" } })}\n`;

describe("live session activity", () => {
	let root: string;
	let registryDir: string;
	const closers: Array<{ close(): void }> = [];

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "live-activity-"));
		registryDir = path.join(root, "hosts");
		fs.mkdirSync(registryDir);
	});

	afterEach(() => {
		for (const c of closers) c.close();
		closers.length = 0;
		removeSyncWithRetries(root);
	});

	function publish(id: string, file: string | null, startedAt = 0): void {
		closers.push(
			publishRpcHost(
				{ sessionId: id, sessionName: id, sessionFile: file, cwd: "/tmp", model: null, startedAt },
				{ dir: registryDir },
			),
		);
	}

	function sessionFile(name: string, body: string, mtimeSec: number): string {
		const file = path.join(root, `${name}.jsonl`);
		fs.writeFileSync(file, body);
		fs.utimesSync(file, mtimeSec, mtimeSec);
		return file;
	}

	it("counts assistant message entries only", async () => {
		const file = sessionFile(
			"a",
			`{"type":"session"}\n${user("1")}${asst("2")}${asst("3")}not json "assistant"\n`,
			1000,
		);
		publish("a", file);
		const [entry] = await listLiveSessions({ registryDir });
		expect(entry.assistantCount).toBe(2);
		expect(entry.lastActivityAt).toBe(1_000_000);
	});

	it("serves unchanged (mtime, size) from cache and recounts after append", async () => {
		const original = user("1") + asst("2");
		const file = sessionFile("b", original, 2000);
		publish("b", file);
		expect((await listLiveSessions({ registryDir }))[0].assistantCount).toBe(1);

		// Same size and mtime, different content: only a cache hit keeps the old count.
		fs.writeFileSync(file, original.replaceAll("assistant", "assistanx"));
		fs.utimesSync(file, 2000, 2000);
		expect((await listLiveSessions({ registryDir }))[0].assistantCount).toBe(1);

		fs.writeFileSync(file, original + asst("3") + asst("4"));
		fs.utimesSync(file, 2001, 2001);
		expect((await listLiveSessions({ registryDir }))[0].assistantCount).toBe(3);
	});

	it("rescans fully after the file shrinks and ignores a partial trailing line", async () => {
		const file = sessionFile("c", asst("1") + asst("2") + asst("3"), 3000);
		publish("c", file);
		expect((await listLiveSessions({ registryDir }))[0].assistantCount).toBe(3);

		fs.writeFileSync(file, asst("1") + asst("2").slice(0, 20));
		fs.utimesSync(file, 3001, 3001);
		expect((await listLiveSessions({ registryDir }))[0].assistantCount).toBe(1);

		fs.writeFileSync(file, asst("1") + asst("2"));
		fs.utimesSync(file, 3002, 3002);
		expect((await listLiveSessions({ registryDir }))[0].assistantCount).toBe(2);
	});

	it("orders by lastActivityAt descending and falls back to startedAt without a file", async () => {
		publish("old", sessionFile("old", asst("1"), 1000));
		publish("new", sessionFile("new", asst("1"), 5000));
		publish("nofile", null, 3_000_000);
		const list = await listLiveSessions({ registryDir });
		expect(list.map(e => e.sessionId)).toEqual(["new", "nofile", "old"]);
		const nofile = list.find(e => e.sessionId === "nofile");
		expect(nofile?.lastActivityAt).toBe(3_000_000);
		expect(nofile?.assistantCount).toBeNull();
	});

	it("uses startedAt and null count when the session file is missing", async () => {
		publish("gone", path.join(root, "missing.jsonl"), 42);
		const [entry] = await listLiveSessions({ registryDir });
		expect(entry.lastActivityAt).toBe(42);
		expect(entry.assistantCount).toBeNull();
	});
});
