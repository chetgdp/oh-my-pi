/**
 * End-to-End Behavior Verification for WebGUI Transcript Scrolling & Composer.
 *
 * Exercises real UI in headless Chrome against fake RPC host:
 * (1) Pinned at bottom: stream markdown assistant in >=300 small deltas, assert pinned every ~20 frames.
 * (2) Grow tool card with tool_output chunks while streaming: assert pinned.
 * (3) User scrolls up 500px mid-stream -> stays put (scrollTop stable within 2px) for remaining frames.
 * (4) New entry appended while pinned -> stays pinned.
 * (5) Short history page triggers load-older.
 * (6) Composer: type text, prompt-history arrow-up recalls last user prompt, send works,
 *     rewind/retry buttons invoke correct RPC with current entry.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as net from "node:net";
import puppeteer from "puppeteer-core";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { createServer } from "../src/server/index";

function findChromiumPath(): string {
	const candidates = [
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
		process.env.CHROME_BIN,
		process.env.PUPPETEER_EXECUTABLE_PATH,
	].filter(Boolean) as string[];

	for (const c of candidates) {
		if (fs.existsSync(c)) return c;
	}
	throw new Error("Chromium executable not found");
}

interface TestHostState {
	receivedCommands: Array<{ id?: string; type: string; [k: string]: unknown }>;
	historyResult: {
		leafId: string | null;
		entries: unknown[];
		hasMore: boolean;
		live: unknown[];
	};
	olderHistoryResult?: {
		leafId: string | null;
		entries: unknown[];
		hasMore: boolean;
		live: unknown[];
	};
}

function startTestRpcHost(options: {
	registryDir: string;
	sessionId: string;
	initialEntries: unknown[];
	hasMore?: boolean;
	olderEntries?: unknown[];
}) {
	const { registryDir, sessionId, initialEntries, hasMore = false, olderEntries = [] } = options;
	const sessionFile = path.join(registryDir, `${sessionId}.jsonl`);
	fs.writeFileSync(sessionFile, '{"type":"session_init"}\n');

	const publication = publishRpcHost(
		{
			sessionId,
			sessionName: "Verify Scroll Session",
			sessionFile,
			cwd: process.cwd(),
			model: "mock-model",
			startedAt: Date.now(),
		},
		{ dir: registryDir },
	);

	const { endpoint, token, entry } = publication;
	try {
		fs.rmSync(endpoint, { force: true });
	} catch {}

	const hostState: TestHostState = {
		receivedCommands: [],
		historyResult: {
			leafId: initialEntries.length > 0 ? (initialEntries[initialEntries.length - 1] as { id: string }).id : null,
			entries: [...initialEntries],
			hasMore,
			live: [],
		},
		olderHistoryResult: {
			leafId: initialEntries.length > 0 ? (initialEntries[initialEntries.length - 1] as { id: string }).id : null,
			entries: [...olderEntries],
			hasMore: false,
			live: [],
		},
	};

	const activeSockets = new Set<net.Socket>();
	const server = net.createServer(socket => {
		activeSockets.add(socket);
		let authenticated = false;
		let lineBuffer = "";

		const sendFrame = (obj: unknown) => {
			if (!socket.destroyed && socket.writable) {
				socket.write(JSON.stringify(obj) + "\n");
			}
		};

		socket.on("data", chunk => {
			lineBuffer += chunk.toString("utf8");
			let idx: number;
			while ((idx = lineBuffer.indexOf("\n")) !== -1) {
				const line = lineBuffer.slice(0, idx).trim();
				lineBuffer = lineBuffer.slice(idx + 1);
				if (!line) continue;

				if (!authenticated) {
					try {
						const auth = JSON.parse(line);
						if (auth.type === "auth" && auth.token === token) {
							authenticated = true;
							sendFrame({ type: "ready", protocolVersion: 3, supportedProtocolVersions: [1, 2, 3] });
						} else {
							socket.destroy();
						}
					} catch {
						socket.destroy();
					}
					continue;
				}

				try {
					const req = JSON.parse(line);
					hostState.receivedCommands.push(req);
					const id = req.id;

					switch (req.type) {
						case "negotiate_protocol":
							sendFrame({
								id,
								type: "response",
								command: "negotiate_protocol",
								success: true,
								data: { protocolVersion: 3 },
							});
							break;
						case "get_state":
							sendFrame({
								id,
								type: "response",
								command: "get_state",
								success: true,
								data: {
									sessionId,
									isStreaming: false,
									isCompacting: false,
									steeringMode: "all",
									followUpMode: "all",
									interruptMode: "immediate",
									autoCompactionEnabled: false,
									fastModeEnabled: false,
									fastModeActive: false,
									tokensPerSecond: 120,
									messageCount: hostState.historyResult.entries.length,
									queuedMessageCount: 0,
									todoPhases: [],
									thinkingLevel: "low",
								},
							});
							break;
						case "history":
							if (req.before) {
								sendFrame({
									id,
									type: "response",
									command: "history",
									success: true,
									data: hostState.olderHistoryResult,
								});
							} else {
								sendFrame({
									id,
									type: "response",
									command: "history",
									success: true,
									data: hostState.historyResult,
								});
							}
							break;
						case "get_agent_roster":
							sendFrame({
								id,
								type: "response",
								command: "get_agent_roster",
								success: true,
								data: { agents: [] },
							});
							break;
						case "get_available_commands":
							sendFrame({
								id,
								type: "response",
								command: "get_available_commands",
								success: true,
								data: { commands: [] },
							});
							break;
						case "get_session_stats":
							sendFrame({
								id,
								type: "response",
								command: "get_session_stats",
								success: true,
								data: { tokens: 0, cost: 0 },
							});
							break;
						case "get_subagents":
							sendFrame({
								id,
								type: "response",
								command: "get_subagents",
								success: true,
								data: { subagents: [] },
							});
							break;
						case "get_plan_state":
							sendFrame({
								id,
								type: "response",
								command: "get_plan_state",
								success: true,
								data: { state: null, review: null },
							});
							break;
						case "prompt":
							sendFrame({
								id,
								type: "response",
								command: "prompt",
								success: true,
								data: { agentInvoked: true },
							});
							break;
						case "branch":
							sendFrame({ id, type: "response", command: "branch", success: true, data: { cancelled: false } });
							break;
						default:
							sendFrame({ id, type: "response", command: req.type, success: true, data: {} });
							break;
					}
				} catch {}
			}
		});

		socket.on("close", () => activeSockets.delete(socket));
		socket.on("error", () => activeSockets.delete(socket));
	});

	server.listen(endpoint);

	return {
		instanceId: entry.instanceId,
		hostState,
		broadcast(frame: unknown) {
			const line = JSON.stringify(frame) + "\n";
			for (const sock of activeSockets) {
				if (!sock.destroyed && sock.writable) {
					sock.write(line);
				}
			}
		},
		async close() {
			for (const s of activeSockets) s.destroy();
			activeSockets.clear();
			await new Promise<void>(res => server.close(() => res()));
			publication.close();
			try {
				fs.rmSync(endpoint, { force: true });
			} catch {}
		},
	};
}

async function runTests() {
	console.log("=== BEHAVIOR-E2E SCROLL & COMPOSER VERIFICATION START ===");
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-verify-scroll-"));
	const registryDir = path.join(tmpDir, "registry");
	fs.mkdirSync(registryDir, { recursive: true });

	const initialEntries = [
		{
			id: "entry-0",
			parentId: null,
			timestamp: new Date().toISOString(),
			type: "message",
			message: {
				role: "user",
				content: "Hello assistant, tell me a story.",
				timestamp: Date.now() - 10000,
			},
		},
		{
			id: "entry-1",
			parentId: "entry-0",
			timestamp: new Date().toISOString(),
			type: "message",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Once upon a time in a virtualized DOM..." }],
				stopReason: "stop",
				timestamp: Date.now() - 9000,
			},
		},
	];

	const host = startTestRpcHost({
		registryDir,
		sessionId: "verify-scroll-session",
		initialEntries,
		hasMore: false,
	});

	const distDir = process.env.VERIFY_DIST ?? path.resolve(import.meta.dir, "../dist");
	const server = createServer({
		host: "127.0.0.1",
		port: 0,
		distDir,
		registryDir,
	});

	const chromePath = findChromiumPath();
	const browser = await puppeteer.launch({
		executablePath: chromePath,
		headless: true,
		args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
	});

	const results: Record<string, { pass: boolean; evidence: string }> = {};

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1200, height: 700 });

		const url = `http://127.0.0.1:${server.port}/#/s/${host.instanceId}`;
		await page.goto(url, { waitUntil: "domcontentloaded" });
		await page.waitForSelector(".tr-root", { timeout: 10000 });
		await new Promise(r => setTimeout(r, 1000));

		// Helpers
		const getScrollInfo = async () => {
			return page.evaluate(async () => {
				await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
				const el = document.querySelector(".tr-root");
				if (!el) return { scrollTop: 0, clientHeight: 0, scrollHeight: 0, gap: 9999 };
				const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
				return { scrollTop: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, gap };
			});
		};

		// =========================================================================
		// Case 1: Pinned at bottom, stream long assistant markdown in >=300 small deltas
		// =========================================================================
		console.log("\n--- Testing Case 1: Stream markdown with >=300 deltas while pinned ---");
		const sid1 = 101;
		host.broadcast({ type: "turn_start" });
		host.broadcast({
			type: "msg_start",
			sid: sid1,
			message: { role: "assistant", content: [], timestamp: Date.now() },
		});
		host.broadcast({
			type: "block_start",
			sid: sid1,
			block: 0,
			start: { type: "text" },
		});

		let case1PinnedFailures = 0;
		let case1MaxGap = 0;
		const totalDeltas = 320;

		for (let i = 0; i < totalDeltas; i++) {
			host.broadcast({
				type: "delta",
				sid: sid1,
				block: 0,
				text: `Word_${i} markdown stream item ${i % 10 === 0 ? "\n\nParagraph break line\n\n" : " "}`,
			});

			if (i % 20 === 0) {
				await new Promise(r => setTimeout(r, 16));
				const s = await getScrollInfo();
				if (s.scrollHeight > s.clientHeight) {
					if (s.gap > 2) case1PinnedFailures++;
					if (s.gap > case1MaxGap) case1MaxGap = s.gap;
				}
			}
		}

		await new Promise(r => setTimeout(r, 50));
		const s1Final = await getScrollInfo();
		if (s1Final.gap > 2) case1PinnedFailures++;

		results["case1_stream_markdown_pinned"] = {
			pass: case1PinnedFailures === 0,
			evidence: `320 text frames sent. Samples gap max=${case1MaxGap.toFixed(1)}px, finalGap=${s1Final.gap.toFixed(1)}px, failures=${case1PinnedFailures}`,
		};

		// =========================================================================
		// Case 2: Tool output chunks grow a tool card while streaming
		// =========================================================================
		console.log("\n--- Testing Case 2: tool_output chunks grow tool card while streaming ---");
		const toolCallId = "call_test_tool_1";
		host.broadcast({
			type: "block_start",
			sid: sid1,
			block: 1,
			start: { type: "toolCall", id: toolCallId, name: "test_runner" },
		});
		host.broadcast({
			type: "tool_execution_start",
			toolCallId,
			toolName: "test_runner",
			args: { verbose: true },
		});

		let case2PinnedFailures = 0;
		let case2MaxGap = 0;
		const toolChunks = 60;

		for (let c = 0; c < toolChunks; c++) {
			host.broadcast({
				type: "tool_output",
				toolCallId,
				text: `[test runner stdout log row ${c}]: executing step verification batch\n`,
				details: { progress: ((c + 1) / toolChunks) * 100 },
			});

			if (c % 10 === 0) {
				await new Promise(r => setTimeout(r, 16));
				const s = await getScrollInfo();
				if (s.gap > 2) case2PinnedFailures++;
				if (s.gap > case2MaxGap) case2MaxGap = s.gap;
			}
		}

		await new Promise(r => setTimeout(r, 50));
		const s2Final = await getScrollInfo();
		if (s2Final.gap > 2) case2PinnedFailures++;

		results["case2_tool_output_pinned"] = {
			pass: case2PinnedFailures === 0,
			evidence: `60 tool_output chunks. Samples gap max=${case2MaxGap.toFixed(1)}px, finalGap=${s2Final.gap.toFixed(1)}px, failures=${case2PinnedFailures}`,
		};

		// =========================================================================
		// Case 3: User scrolls up 500px mid-stream -> stays put (scrollTop stable <=2px)
		// =========================================================================
		console.log("\n--- Testing Case 3: User scrolls up 500px mid-stream -> scrollTop stays put ---");
		await page.evaluate(() => {
			const el = document.querySelector(".tr-root")!;
			el.scrollTop = Math.max(0, el.scrollTop - 500);
			el.dispatchEvent(new Event("scroll"));
		});
		await new Promise(r => setTimeout(r, 50));

		const scrollAfterUserAction = await getScrollInfo();
		const pinnedTargetScrollTop = scrollAfterUserAction.scrollTop;

		let maxScrollTopDrift = 0;
		for (let i = 0; i < 40; i++) {
			host.broadcast({
				type: "delta",
				sid: sid1,
				block: 0,
				text: ` [additional mid-stream text while unpinned ${i}]`,
			});
			if (i % 5 === 0) {
				await new Promise(r => setTimeout(r, 16));
				const cur = await getScrollInfo();
				const drift = Math.abs(cur.scrollTop - pinnedTargetScrollTop);
				if (drift > maxScrollTopDrift) maxScrollTopDrift = drift;
			}
		}

		results["case3_unpinned_scroll_stability"] = {
			pass: maxScrollTopDrift <= 2,
			evidence: `Scrolled up to scrollTop=${pinnedTargetScrollTop.toFixed(1)}px. Max drift during 40 delta frames = ${maxScrollTopDrift.toFixed(1)}px`,
		};

		// Clean up stream sid1
		host.broadcast({
			type: "tool_execution_end",
			toolCallId,
			toolName: "test_runner",
			result: "done",
			isError: false,
		});
		host.broadcast({
			type: "block_end",
			sid: sid1,
			block: 0,
			content: { type: "text", text: "Finished full text." },
		});
		host.broadcast({
			type: "block_end",
			sid: sid1,
			block: 1,
			content: { type: "toolCall", id: toolCallId, name: "test_runner", arguments: {} },
		});
		host.broadcast({
			type: "msg_end",
			sid: sid1,
			message: { role: "assistant", content: [{ type: "text", text: "Done" }], stopReason: "stop" },
		});
		host.broadcast({
			type: "agent_end",
		});

		// Scroll back to bottom before Case 4
		await page.evaluate(() => {
			const el = document.querySelector(".tr-root")!;
			el.scrollTop = el.scrollHeight;
			el.dispatchEvent(new Event("scroll"));
		});
		await new Promise(r => setTimeout(r, 50));

		// =========================================================================
		// Case 4: New entry appended while pinned -> still pinned
		// =========================================================================
		console.log("\n--- Testing Case 4: New entry appended while pinned -> still pinned ---");
		const sBefore4 = await getScrollInfo();
		const appendedEntry = {
			id: "entry-case4-new",
			parentId: "entry-1",
			timestamp: new Date().toISOString(),
			type: "message",
			message: {
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Here is a newly appended standalone entry card.\n\nWith multiple lines of markdown text to change height substantially.",
					},
				],
				stopReason: "stop",
				timestamp: Date.now(),
			},
		};

		host.broadcast({
			type: "entry",
			entry: appendedEntry,
		});
		await new Promise(r => setTimeout(r, 100));
		// Second append once overflow is guaranteed: must stay pinned at the bottom.
		const appended2 = {
			id: "entry-case4-new2",
			parentId: "entry-case4-new",
			timestamp: new Date().toISOString(),
			type: "message",
			message: {
				role: "assistant",
				content: [
					{
						type: "text",
						text: Array.from({ length: 40 }, (_, k) => `Line ${k} of appended entry.`).join("\n\n"),
					},
				],
				stopReason: "stop",
				timestamp: Date.now(),
			},
		};
		host.broadcast({ type: "entry", entry: appended2 });
		await new Promise(r => setTimeout(r, 100));

		const sAfter4 = await getScrollInfo();
		results["case4_new_entry_pinned"] = {
			pass: sAfter4.gap <= 2,
			evidence: `Before append gap=${sBefore4.gap.toFixed(1)}px; after append gap=${sAfter4.gap.toFixed(1)}px (scrollTop=${sAfter4.scrollTop}, scrollHeight=${sAfter4.scrollHeight})`,
		};

		// =========================================================================
		// Case 6: Composer type text, arrow-up recalls last prompt, send works, rewind/retry RPCs
		// =========================================================================
		console.log("\n--- Testing Case 6: Composer prompt history, send, rewind, retry ---");
		await page.waitForSelector(".cmp-textarea");
		await page.click(".cmp-textarea");

		// 6a: Prompt-history recall with ArrowUp
		// Initial entries has a user prompt: "Hello assistant, tell me a story."
		await page.keyboard.press("ArrowUp");
		await new Promise(r => setTimeout(r, 50));
		const recalledText = await page.$eval(".cmp-textarea", (el: HTMLTextAreaElement) => el.value);

		const recallsPrompt = recalledText === "Hello assistant, tell me a story.";

		// 6b: Type text and Send
		await page.evaluate(() => {
			const el = document.querySelector(".cmp-textarea") as HTMLTextAreaElement;
			el.value = "";
		});
		await page.type(".cmp-textarea", "Verification test prompt submit");
		const hostCmdCountBeforeSend = host.hostState.receivedCommands.length;
		await page.click(".cmp-btn-primary");
		await new Promise(r => setTimeout(r, 100));

		const promptCmd = host.hostState.receivedCommands
			.slice(hostCmdCountBeforeSend)
			.find(c => c.type === "prompt" || c.type === "steer");
		const sendSucceeded = promptCmd !== undefined && promptCmd.message === "Verification test prompt submit";

		// 6c: Rewind button invokes branch RPC
		// UserRow has .tr-rewind-btn. First click arms (Confirm rewind?), second click calls branch(client, entryId).
		const rewindBtn = await page.$(".tr-rewind-btn");
		let rewindSucceeded = false;
		if (rewindBtn) {
			const countBeforeRewind = host.hostState.receivedCommands.length;
			await rewindBtn.click(); // arm
			await new Promise(r => setTimeout(r, 50));
			await rewindBtn.click(); // confirm
			await new Promise(r => setTimeout(r, 100));
			const branchCmd = host.hostState.receivedCommands.slice(countBeforeRewind).find(c => c.type === "branch");
			rewindSucceeded = branchCmd !== undefined && branchCmd.entryId === "entry-0";
		}

		// 6d: Retry button invokes retry RPC (type: "prompt", message: "/retry")
		// Emit an entry with stopReason: "error" to show .tr-retry-btn
		const errorEntry = {
			id: "entry-err-turn",
			parentId: "entry-case4-new",
			timestamp: new Date().toISOString(),
			type: "message",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Something went wrong" }],
				stopReason: "error",
				errorMessage: "Synthetic failure for retry test",
				timestamp: Date.now(),
			},
		};
		host.broadcast({ type: "entry", entry: errorEntry });
		await new Promise(r => setTimeout(r, 100));

		await page.waitForSelector(".tr-retry-btn", { timeout: 3000 });
		const countBeforeRetry = host.hostState.receivedCommands.length;
		await page.click(".tr-retry-btn");
		await new Promise(r => setTimeout(r, 100));
		const retryCmd = host.hostState.receivedCommands
			.slice(countBeforeRetry)
			.find(c => c.type === "prompt" && c.message === "/retry");
		const retrySucceeded = retryCmd !== undefined;

		results["case6_composer_and_actions"] = {
			pass: recallsPrompt && sendSucceeded && rewindSucceeded && retrySucceeded,
			evidence: `ArrowUp recalled: "${recalledText}" (match=${recallsPrompt}), send RPC prompt=${sendSucceeded}, rewind branch RPC=${rewindSucceeded}, retry /retry RPC=${retrySucceeded}`,
		};

		// =========================================================================
		// Case 5: Short history page triggers load-older
		// =========================================================================
		console.log("\n--- Testing Case 5: Short history page triggers load-older ---");
		// Create a separate clean session where history has 1 entry and hasMore: true
		const shortSessionId = "short-history-session";
		const olderEntryId = "entry-older-root";
		const shortHost = startTestRpcHost({
			registryDir,
			sessionId: shortSessionId,
			initialEntries: [
				{
					id: "entry-short-1",
					parentId: olderEntryId,
					timestamp: new Date().toISOString(),
					type: "message",
					message: {
						role: "user",
						content: "Short message",
						timestamp: Date.now(),
					},
				},
			],
			hasMore: true,
			olderEntries: [
				{
					id: olderEntryId,
					parentId: null,
					timestamp: new Date().toISOString(),
					type: "message",
					message: {
						role: "user",
						content: "Older loaded message from page 2",
						timestamp: Date.now() - 50000,
					},
				},
			],
		});

		try {
			const page2 = await browser.newPage();
			await page2.setViewport({ width: 1200, height: 700 });
			const shortUrl = `http://127.0.0.1:${server.port}/#/s/${shortHost.instanceId}`;
			await page2.goto(shortUrl, { waitUntil: "domcontentloaded" });
			await page2.waitForSelector(".tr-root", { timeout: 10000 });
			// Short page auto-triggers loadOlder via scrollHeight <= clientHeight effect
			await new Promise(r => setTimeout(r, 800));

			const olderHistoryCall = shortHost.hostState.receivedCommands.find(
				c => c.type === "history" && Boolean(c.before),
			);
			const loadedOlderRowText = await page2.evaluate(() => {
				return document.body.innerText.includes("Older loaded message from page 2");
			});

			results["case5_short_page_load_older"] = {
				pass: Boolean(olderHistoryCall) && loadedOlderRowText,
				evidence: `Short page triggered history RPC with before=${olderHistoryCall ? (olderHistoryCall as { before: string }).before : "none"}, rendered older text=${loadedOlderRowText}`,
			};
		} finally {
			await shortHost.close();
		}
	} finally {
		await browser.close();
		server.stop(true);
		await host.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}

	console.log("\n=== TEST RESULTS SUMMARY ===");
	let allPass = true;
	for (const [k, v] of Object.entries(results)) {
		console.log(`[${v.pass ? "PASS" : "FAIL"}] ${k}: ${v.evidence}`);
		if (!v.pass) allPass = false;
	}

	if (!allPass) {
		console.error("\nSome test cases failed!");
		process.exit(1);
	}
	console.log("\nAll behavior-e2e test cases passed successfully.");
}

void runTests();
