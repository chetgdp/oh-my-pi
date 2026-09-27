import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { recordSessionRecap, resetSessionIndexForTests } from "@oh-my-pi/pi-coding-agent/session/session-index";
import { getConfigRootDir, removeSyncWithRetries, setAgentDir } from "@oh-my-pi/pi-utils";
import { listLiveSessions } from "../src/server/live";

describe("live session recap", () => {
	let root: string;
	let registryDir: string;
	let sessionFile: string;
	const closers: Array<{ close(): void }> = [];
	const originalAgentDir = process.env.PI_CODING_AGENT_DIR;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "live-recap-"));
		registryDir = path.join(root, "hosts");
		fs.mkdirSync(registryDir);
		sessionFile = path.join(root, "session.jsonl");
		fs.writeFileSync(sessionFile, "{}\n");
		setAgentDir(path.join(root, "agent"));
		resetSessionIndexForTests();
	});

	afterEach(() => {
		for (const c of closers) c.close();
		closers.length = 0;
		resetSessionIndexForTests();
		if (originalAgentDir) {
			setAgentDir(originalAgentDir);
		} else {
			setAgentDir(path.join(getConfigRootDir(), "agent"));
			delete process.env.PI_CODING_AGENT_DIR;
		}
		removeSyncWithRetries(root);
	});

	function publish(file: string | null): void {
		closers.push(
			publishRpcHost(
				{ sessionId: "s1", sessionName: "S", sessionFile: file, cwd: "/tmp", model: null, startedAt: 0 },
				{ dir: registryDir },
			),
		);
	}

	function setMtime(offsetSeconds: number): void {
		const t = Date.now() / 1000 + offsetSeconds;
		fs.utimesSync(sessionFile, t, t);
	}

	it("shows the latest recap while the session file is older than it", async () => {
		recordSessionRecap("s1", "/tmp", "old recap");
		recordSessionRecap("s1", "/tmp", "new recap");
		setMtime(-60);
		publish(sessionFile);

		const [entry] = await listLiveSessions({ registryDir });
		expect(entry.recap?.text).toBe("new recap");
		expect(entry).not.toHaveProperty("sessionFile");
	});

	it("hides the recap once the session file changes after it", async () => {
		recordSessionRecap("s1", "/tmp", "stale recap");
		setMtime(5);
		publish(sessionFile);

		const [entry] = await listLiveSessions({ registryDir });
		expect(entry.recap).toBeNull();
	});

	it("gives no recap when the host does not publish its session file", async () => {
		recordSessionRecap("s1", "/tmp", "unverifiable recap");
		publish(null);

		const [entry] = await listLiveSessions({ registryDir });
		expect(entry.recap).toBeNull();
	});
});
