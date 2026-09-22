#!/usr/bin/env bun
/**
 * Live probe for Cloud Code Assist (google-antigravity) system-prompt
 * fingerprint blocks. See cheisms/antigravity-system-prompt-fingerprint.md.
 *
 * Usage (from repo root):
 *   bun cheisms/cca-probe.ts --text 'You are a helpful assistant'
 *   bun cheisms/cca-probe.ts --file prompt.txt
 *   bun cheisms/cca-probe.ts --lines prompt.txt 0 40      # line range [start, end)
 *   CCA_MODEL=gemini-3.1-pro-low bun cheisms/cca-probe.ts --file prompt.txt
 *
 * Reads the stored OAuth credential from ~/.omp/agent/agent.db (the omp auth
 * store) and POSTs one minimal request with the given systemInstruction.
 * Prints the HTTP status and the first 300 bytes of the body. 429 with
 * RESOURCE_EXHAUSTED on a prompt that passes without one substring is the
 * fingerprint signature. Keep probe counts low; bisect by halves.
 */
import { Database } from "bun:sqlite";
import * as os from "node:os";
import * as path from "node:path";
import { getAntigravityUserAgent } from "@oh-my-pi/pi-catalog/wire/gemini-headers";

const ENDPOINT = process.env.CCA_ENDPOINT ?? "https://daily-cloudcode-pa.googleapis.com";
const MODEL = process.env.CCA_MODEL ?? "gemini-3.1-pro-low";
const DB_PATH = process.env.OMP_AGENT_DB ?? path.join(os.homedir(), ".omp", "agent", "agent.db");

interface StoredCredential {
	access: string;
	expires: number;
	projectId: string;
}

function loadCredential(): StoredCredential {
	const db = new Database(DB_PATH, { readonly: true });
	const row = db
		.query<{ data: string }, []>("SELECT data FROM auth_credentials WHERE provider = 'google-antigravity' LIMIT 1")
		.get();
	db.close();
	if (!row) throw new Error(`no google-antigravity credential in ${DB_PATH}; run omp /login first`);
	const cred = JSON.parse(row.data) as StoredCredential;
	if (cred.expires && cred.expires < Date.now()) {
		throw new Error("stored access token expired; start omp once so it refreshes, then retry");
	}
	return cred;
}

async function readPrompt(argv: string[]): Promise<string> {
	const mode = argv[0];
	if (mode === "--text") return argv.slice(1).join(" ");
	if (mode === "--file") return await Bun.file(argv[1]).text();
	if (mode === "--lines") {
		const lines = (await Bun.file(argv[1]).text()).split("\n");
		return lines.slice(Number(argv[2]), Number(argv[3])).join("\n");
	}
	throw new Error("usage: --text <prompt> | --file <path> | --lines <path> <start> <end>");
}

const systemText = await readPrompt(process.argv.slice(2));
const { access, projectId } = loadCredential();
const now = Date.now();
const body = {
	project: projectId,
	requestId: `agent/probe/${now}/probe/2`,
	request: {
		contents: [{ role: "user", parts: [{ text: "hi" }] }],
		systemInstruction: { parts: [{ text: systemText }] },
		generationConfig: { maxOutputTokens: 16 },
		sessionId: `probe-${now}`,
		labels: { last_step_index: "1" },
	},
	model: MODEL,
	userAgent: "antigravity",
	requestType: "agent",
};

const response = await fetch(`${ENDPOINT}/v1internal:streamGenerateContent?alt=sse`, {
	method: "POST",
	headers: {
		Authorization: `Bearer ${access}`,
		"Content-Type": "application/json",
		Accept: "text/event-stream",
		"User-Agent": getAntigravityUserAgent(),
	},
	body: JSON.stringify(body),
});
const text = await response.text();
console.log(`model=${MODEL} prompt_len=${systemText.length} status=${response.status}`);
console.log(text.slice(0, 300));
