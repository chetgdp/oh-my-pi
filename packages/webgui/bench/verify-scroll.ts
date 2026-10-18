/**
 * End-to-End Behavior Verification for WebGUI Transcript Scrolling & Composer.
 *
 * Exercises real UI in headless Chrome against fake RPC host. Positions are read
 * through convention-agnostic helpers, so HEAD-era (top-anchored) and current
 * (column-reverse, negative scrollTop) builds run the same cases:
 * (1) Pinned at bottom: stream markdown assistant in >=300 small deltas, assert pinned every ~20 frames.
 * (2) Grow tool card with tool_output chunks while streaming: assert pinned.
 * (2b) Touch drag up 30px mid-stream: no scroll write under the finger, stays released after.
 * (3) User scrolls up 500px mid-stream -> the top visible row stays put (<=2px).
 * (4) New entry appended while pinned -> stays pinned.
 * (5) Short history page triggers load-older; (5b) a prepended page does not move the view.
 * (6) Composer: type text, prompt-history arrow-up recalls last user prompt, send works,
 *     rewind/retry buttons invoke correct RPC with current entry.
 * (7) Scroll up 40x150px through a tool-heavy history on a phone touch viewport with
 *     `overflow-anchor: none` (iOS Safari has no scroll anchoring): rows must not shift.
 *
 * VERIFY_DIST selects the build to serve (default ../dist, which may be stale).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as net from "node:net";
import puppeteer, { type Browser } from "puppeteer-core";
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

interface PageHelpers {
	root(): HTMLElement | null;
	gap(el: HTMLElement): number;
	toBottom(el: HTMLElement): void;
	markAnchor(): number;
	anchorTop(): number;
}

declare global {
	var __vs: PageHelpers;
}

// Runs in the page. Works on both the column-reverse scroller (scrollTop 0 at
// the bottom, negative above) and the earlier top-anchored one, so old and new
// builds share cases.
function installPageHelpers(): void {
	let anchor: Element | null = null;
	const reversed = (el: HTMLElement) => getComputedStyle(el).flexDirection === "column-reverse";
	globalThis.__vs = {
		root: () => document.querySelector<HTMLElement>(".tr-root"),
		gap: el => (reversed(el) ? -el.scrollTop : el.scrollHeight - el.scrollTop - el.clientHeight),
		toBottom(el) {
			el.scrollTo({ top: reversed(el) ? 0 : Number.MAX_SAFE_INTEGER });
			el.dispatchEvent(new Event("scroll"));
		},
		markAnchor() {
			const el = document.querySelector<HTMLElement>(".tr-root")!;
			const top = el.getBoundingClientRect().top;
			for (const row of el.querySelectorAll(".tr-item, .tr-virtual-row")) {
				const box = row.getBoundingClientRect();
				if (box.bottom > top + 5) {
					anchor = row;
					return box.top;
				}
			}
			anchor = null;
			return NaN;
		},
		anchorTop: () => (anchor?.isConnected ? anchor.getBoundingClientRect().top : NaN),
	};
}

const IPHONE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** Deterministic tool-heavy history: rows of very different heights, mostly far from any size estimate. */
function buildToolHeavyHistory(turns: number): unknown[] {
	let seed = 7;
	const rand = (n: number) => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed % n;
	};
	const entries: unknown[] = [];
	let parentId: string | null = null;
	const push = (message: Record<string, unknown>) => {
		const id = `hist-${entries.length}`;
		entries.push({ id, parentId, timestamp: new Date().toISOString(), type: "message", message });
		parentId = id;
	};
	for (let t = 0; t < turns; t++) {
		push({ role: "user", content: `Turn ${t}: check the build and fix what fails.`, timestamp: Date.now() });
		const paragraphs = Array.from(
			{ length: 1 + rand(6) },
			(_, p) =>
				`Paragraph ${p} of turn ${t}. ${"The quick brown fox jumps over the lazy dog. ".repeat(2 + rand(12))}`,
		);
		const calls = Array.from({ length: 1 + rand(3) }, (_, c) => ({
			type: "toolCall",
			id: `call-${t}-${c}`,
			name: c % 2 === 0 ? "bash" : "read",
			arguments: c % 2 === 0 ? { command: `bun test ./test/case-${t}-${c}.test.ts` } : { path: `src/file-${t}.ts` },
		}));
		push({
			role: "assistant",
			content: [{ type: "text", text: paragraphs.join("\n\n") }, ...calls],
			stopReason: "toolUse",
			timestamp: Date.now(),
		});
		for (const call of calls) {
			const lines = Array.from({ length: 3 + rand(60) }, (_, l) => `${call.id} output line ${l}: ok`);
			push({
				role: "toolResult",
				toolCallId: call.id,
				toolName: call.name,
				content: [{ type: "text", text: lines.join("\n") }],
				isError: false,
				timestamp: Date.now(),
			});
		}
	}
	return entries;
}

/**
 * Scroll up through a long history on a phone viewport with browser scroll
 * anchoring off (iOS Safari has none), finger down for each step. The row at
 * the viewport top must move by exactly the scroll step: any extra movement is
 * content shifting under the reader.
 */
async function runScrollUpCase(
	browser: Browser,
	serverPort: number,
	registryDir: string,
): Promise<{ pass: boolean; evidence: string }> {
	const host = startTestRpcHost({
		registryDir,
		sessionId: "scroll-up-session",
		initialEntries: buildToolHeavyHistory(80),
	});
	const page = await browser.newPage();
	try {
		await page.setUserAgent(IPHONE_UA);
		await page.setViewport({ width: 390, height: 664, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
		await page.goto(`http://127.0.0.1:${serverPort}/#/s/${host.instanceId}`, { waitUntil: "domcontentloaded" });
		await page.waitForSelector(".tr-item, .tr-virtual-row", { timeout: 15000 });
		await page.evaluate(installPageHelpers);
		await Bun.sleep(2000);
		const steps = await page.evaluate(async () => {
			const frame = () => {
				const { promise, resolve } = Promise.withResolvers<number>();
				requestAnimationFrame(resolve);
				return promise;
			};
			const vs = globalThis.__vs;
			const el = vs.root()!;
			el.style.setProperty("overflow-anchor", "none", "important");
			const out: Array<{ maxDev: number; finalDev: number }> = [];
			for (let i = 0; i < 40; i++) {
				const anchorTop = vs.markAnchor();
				if (!Number.isFinite(anchorTop)) break;
				el.dispatchEvent(new Event("touchstart"));
				const before = el.scrollTop;
				el.scrollTop = before - 150;
				const moved = el.scrollTop - before;
				if (moved === 0) {
					el.dispatchEvent(new Event("touchend"));
					break;
				}
				let maxDev = 0;
				for (let f = 0; f < 12; f++) {
					await frame();
					if (f === 2) el.dispatchEvent(new Event("touchend"));
					const dev = vs.anchorTop() - anchorTop + moved;
					if (Number.isFinite(dev) && Math.abs(dev) > Math.abs(maxDev)) maxDev = dev;
				}
				const settled = Promise.withResolvers<void>();
				setTimeout(settled.resolve, 200);
				await settled.promise;
				out.push({ maxDev: Math.round(maxDev), finalDev: Math.round(vs.anchorTop() - anchorTop + moved) });
			}
			return out;
		});
		const glitches = steps.filter(s => Math.abs(s.maxDev) > 20 || Math.abs(s.finalDev) > 20);
		const worst = Math.max(0, ...steps.map(s => Math.max(Math.abs(s.maxDev), Math.abs(s.finalDev))));
		return {
			pass: steps.length >= 30 && glitches.length === 0,
			evidence: `${steps.length} steps of 150px on 390x664 touch viewport, overflow-anchor:none; glitches(>20px)=${glitches.length}, worst shift=${worst}px`,
		};
	} finally {
		await page.close();
		await host.close();
	}
}

/** Scroll toward the top of a paged history; the prepended page must not move the row in view. */
async function runLoadOlderCase(
	browser: Browser,
	serverPort: number,
	registryDir: string,
): Promise<{ pass: boolean; evidence: string }> {
	const history = buildToolHeavyHistory(40);
	const host = startTestRpcHost({
		registryDir,
		sessionId: "load-older-session",
		initialEntries: history.slice(-40),
		hasMore: true,
		olderEntries: history.slice(0, -40),
	});
	const page = await browser.newPage();
	try {
		await page.setViewport({ width: 1200, height: 700 });
		await page.goto(`http://127.0.0.1:${serverPort}/#/s/${host.instanceId}`, { waitUntil: "domcontentloaded" });
		await page.waitForSelector(".tr-item, .tr-virtual-row", { timeout: 15000 });
		await page.evaluate(installPageHelpers);
		await Bun.sleep(1000);
		const olderRequested = () => host.hostState.receivedCommands.some(c => c.type === "history" && Boolean(c.before));
		for (let i = 0; i < 200 && !olderRequested(); i++) {
			await page.evaluate(() => {
				const el = globalThis.__vs.root()!;
				el.scrollTop = el.scrollTop - 300;
				el.dispatchEvent(new Event("scroll"));
			});
			await Bun.sleep(30);
		}
		const anchor = await page.evaluate(() => globalThis.__vs.markAnchor());
		await Bun.sleep(800);
		const after = await page.evaluate(() => ({
			top: globalThis.__vs.anchorTop(),
			// textContent: rows skipped by content-visibility are absent from innerText.
			loaded: document.body.textContent.includes("Turn 0:"),
		}));
		const drift = Math.abs(after.top - anchor);
		return {
			pass: olderRequested() && after.loaded && drift <= 2,
			evidence: `older page requested=${olderRequested()}, oldest turn rendered=${after.loaded}, row in view moved ${drift.toFixed(1)}px across the prepend`,
		};
	} finally {
		await page.close();
		await host.close();
	}
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
		await page.evaluate(installPageHelpers);
		await new Promise(r => setTimeout(r, 1000));

		// Helpers
		const getScrollInfo = async () => {
			return page.evaluate(async () => {
				await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
				const vs = globalThis.__vs;
				const el = vs.root();
				if (!el) return { scrollTop: 0, clientHeight: 0, scrollHeight: 0, gap: 9999, anchorTop: NaN };
				return {
					scrollTop: el.scrollTop,
					clientHeight: el.clientHeight,
					scrollHeight: el.scrollHeight,
					gap: vs.gap(el),
					anchorTop: vs.anchorTop(),
				};
			});
		};
		const markAnchor = () => page.evaluate(() => globalThis.__vs.markAnchor());
		const scrollToBottom = () =>
			page.evaluate(() => {
				const vs = globalThis.__vs;
				vs.toBottom(vs.root()!);
			});

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
		// Case 2b: Touch drag up 30px (inside the 60px at-bottom band) mid-stream.
		// No scroll write may land under the finger (iOS cancels the gesture);
		// after touchend the upward drag must stay released and the reading
		// position must hold while the stream continues.
		// =========================================================================
		console.log("\n--- Testing Case 2b: touch drag up 30px mid-stream -> no pin under finger ---");
		await page.evaluate(() => {
			const el = globalThis.__vs.root()!;
			el.dispatchEvent(new Event("touchstart"));
			el.scrollTop = el.scrollTop - 30;
			el.dispatchEvent(new Event("scroll"));
		});
		await Bun.sleep(30);
		const touchTarget = (await getScrollInfo()).scrollTop;
		let touchDrift = 0;
		for (let i = 0; i < 30; i++) {
			host.broadcast({ type: "delta", sid: sid1, block: 0, text: ` [while touching ${i}]` });
			if (i % 5 === 0) {
				await Bun.sleep(16);
				touchDrift = Math.max(touchDrift, Math.abs((await getScrollInfo()).scrollTop - touchTarget));
			}
		}
		await page.evaluate(() => globalThis.__vs.root()!.dispatchEvent(new Event("touchend")));
		await Bun.sleep(250);
		const releasedAnchor = await markAnchor();
		let releasedDrift = 0;
		for (let i = 0; i < 30; i++) {
			host.broadcast({ type: "delta", sid: sid1, block: 0, text: ` [after release ${i}]` });
			if (i % 5 === 0) {
				await Bun.sleep(16);
				releasedDrift = Math.max(releasedDrift, Math.abs((await getScrollInfo()).anchorTop - releasedAnchor));
			}
		}
		const releasedGap = (await getScrollInfo()).gap;
		results["case2b_touch_drag_not_pinned"] = {
			pass: touchDrift <= 2 && releasedDrift <= 2 && releasedGap > 2,
			evidence: `Dragged to scrollTop=${touchTarget.toFixed(1)}px; scrollTop drift while touching=${touchDrift.toFixed(1)}px; after release row drift=${releasedDrift.toFixed(1)}px, gap=${releasedGap.toFixed(1)}px (not re-pinned)`,
		};
		await scrollToBottom();
		await Bun.sleep(50);

		// =========================================================================
		// Case 3: User scrolls up 500px mid-stream -> the row in view stays put (<=2px)
		// =========================================================================
		console.log("\n--- Testing Case 3: User scrolls up 500px mid-stream -> reading position stays put ---");
		await page.evaluate(() => {
			const el = globalThis.__vs.root()!;
			el.scrollTop = el.scrollTop - 500;
			el.dispatchEvent(new Event("scroll"));
		});
		await Bun.sleep(50);

		const case3Anchor = await markAnchor();
		let maxAnchorDrift = 0;
		for (let i = 0; i < 40; i++) {
			host.broadcast({
				type: "delta",
				sid: sid1,
				block: 0,
				text: ` [additional mid-stream text while unpinned ${i}]`,
			});
			if (i % 5 === 0) {
				await Bun.sleep(16);
				const drift = Math.abs((await getScrollInfo()).anchorTop - case3Anchor);
				if (!(drift <= maxAnchorDrift)) maxAnchorDrift = drift;
			}
		}

		results["case3_unpinned_scroll_stability"] = {
			pass: maxAnchorDrift <= 2,
			evidence: `Scrolled up 500px. Max drift of the top visible row during 40 delta frames = ${maxAnchorDrift.toFixed(1)}px`,
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
		await scrollToBottom();
		await Bun.sleep(50);

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

		console.log("\n--- Testing Case 5b: scrolling near the top loads older rows without moving the view ---");
		results["case5b_load_older_keeps_position"] = await runLoadOlderCase(browser, server.port, registryDir);

		console.log("\n--- Testing Case 7: scroll up through tool-heavy history, no anchoring ---");
		results["case7_scroll_up_no_shift"] = await runScrollUpCase(browser, server.port, registryDir);
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
