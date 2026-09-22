import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildSystemPrompt } from "@oh-my-pi/pi-coding-agent/system-prompt";
import { cleanupTempHome } from "./helpers/temp-home-cleanup";

// Cloud Code Assist (google-antigravity) returns a spurious 429 RESOURCE_EXHAUSTED
// for any systemInstruction containing certain prefixes. The backend fingerprints
// the opening tag + RFC 2119 keyword enumeration. Verified live:
// - 2026-09-12: <system-conventions>\n prefix blocked (gemini-3.8-flash-high)
// - 2026-09-21: <conventions>\n prefix also blocked (gemini-3.1-pro-low)
const BLOCKED_PREFIX_V1 = "<system-conventions>\nRFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL.";
const BLOCKED_PREFIX_V2 = "<conventions>\nRFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL.";

describe("system prompt provider fingerprint", () => {
	let tempDir = "";
	let tempHomeDir = "";
	let originalHome: string | undefined;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-prompt-fp-"));
		tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-prompt-fp-home-"));
		originalHome = process.env.HOME;
		process.env.HOME = tempHomeDir;
	});

	afterEach(cleanupTempHome(() => ({ tempDir, tempHomeDir, originalHome })));

	it("never emits the Cloud Code Assist blocked preamble", async () => {
		const { systemPrompt } = await buildSystemPrompt({
			cwd: tempDir,
			contextFiles: [],
			skills: [],
			rules: [],
			workspaceTree: { rootPath: tempDir, rendered: "", truncated: false, totalLines: 0, agentsMdFiles: [] },
		});
		const joined = systemPrompt.join("\n\n");
		expect(joined).not.toContain(BLOCKED_PREFIX_V1);
		expect(joined).not.toContain(BLOCKED_PREFIX_V2);
	});
});
