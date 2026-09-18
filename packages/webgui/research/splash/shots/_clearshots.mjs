import puppeteer from "puppeteer-core";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { publishRpcHost } from "@oh-my-pi/pi-coding-agent/modes/rpc/rpc-registry";
import { createServer } from "../../../src/server/index.ts";
// Clear-design screenshots + per-text-run contrast for every webgui view (run from packages/webgui).
//   bun research/splash/shots/_bench.mjs build <label>      build the current tree to /tmp/splash-bench/<label>
//   VIEWS=a,b HOURS=12.5,23 SIZES=1440,390 UI=clear|off BG=<mode> bun research/splash/shots/_clearshots.mjs <label>
// Serves the built dist with the real createServer and a scripted RPC host (registry-published,
// unix socket; the bench fake host has no hooks for plan review, dialogs or /btw). Date is shimmed to the
// hour; UI=clear sets localStorage webgui.ui=clear and adds ?hour=<h>, BG adds ?bg=<mode>. 1440 = desktop Live, 390 = phone Still.
// Output /tmp/splash-bench/<label>/clear/<ui>-<view>-<w>-h<hour>.png and contrast-<ui>.json:
// per text run (Range rects of each text node) the contrast of its colour (alpha x ancestor opacity)
// against the pixels behind it, from a second shot with glyphs near-transparent (halo, glass kept);
// min = worst pixel, p5 = 5th percentile; need = 3 for large text (>=24px, or >=18.66px bold) else 4.5.
const ROOT = "/tmp/splash-bench";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];
const label = process.argv[2];
if (!label || !fs.existsSync(path.join(ROOT, label, "index.html"))) {
	console.error(`usage: VIEWS= HOURS= SIZES= UI=clear|off bun research/splash/shots/_clearshots.mjs <label>  (build first: _bench.mjs build <label>)`);
	process.exit(2);
}
const ALL_VIEWS = ["sessions", "transcript", "hub", "usage", "todos", "info", "models", "settings", "cc", "composer", "slash", "plan", "ext", "btw"];
const list = (v, d) => (v ? v.split(",").map(s => s.trim()).filter(Boolean) : d);
const VIEWS = list(process.env.VIEWS, ALL_VIEWS);
const HOURS = list(process.env.HOURS, ["12.5", "23"]).map(Number);
const SIZES = list(process.env.SIZES, ["1440", "390"]).map(Number);
const UI = process.env.UI === "off" ? "off" : "clear";
const BG = process.env.BG ?? "";
// THEMES=light,dark emulates prefers-color-scheme (the app has no stored theme; it follows the system). Unset: browser default (light), no theme in file names.
const THEMES = list(process.env.THEMES, [""]);
// /api/live recaps come from the user's global recap DB; inject them into the response instead (sessions 0, 2, 4)
const RECAPS = { "refactor auth": "Moved checkToken into lib/token.ts and fixed the sign import.\nAll three auth tests pass; /api/past now needs a bearer token.\nNext: hourly key rotation with a one-hour overlap.", "webgui tests": "Ran the webgui suite after the routing change.\nTwo snapshot tests updated for the new back button.\nNo failures left; lint and format clean.", "ocean shader": "Tuned the water glint for low sun angles.\nNight sky stars now fade in from 19:30.\nPerf unchanged at 2.1 ms per frame on M2." };
for (const v of VIEWS) if (!ALL_VIEWS.includes(v)) throw new Error(`unknown view ${v}; known: ${ALL_VIEWS.join(",")}`);
const outDir = path.join(ROOT, label, "clear");
fs.mkdirSync(outDir, { recursive: true });

// ---------- session history ----------
const T0 = Date.now() - 20 * 60000;
function buildHistory() {
	const entries = [];
	let parentId = null;
	const push = message => {
		const id = `e${entries.length}`;
		entries.push({ id, parentId, timestamp: new Date(T0 + entries.length * 20000).toISOString(), type: "message", message: { timestamp: T0 + entries.length * 20000, ...message } });
		parentId = id;
	};
	const asst = (content, stopReason = "stop") => push({ role: "assistant", content, api: "anthropic-messages", provider: "anthropic", model: "claude-sonnet", usage: { input: 1200, output: 420, cacheRead: 0, cacheWrite: 0, totalTokens: 1620, cost: { input: 0.004, output: 0.006, cacheRead: 0, cacheWrite: 0, total: 0.01 } }, stopReason });
	push({ role: "user", content: "Summarise the auth refactor and show the token check." });
	asst([
		{ type: "thinking", thinking: "The user wants a summary of the refactor. I should list the moved modules, then show the token check with its tests, and a table of the endpoints that changed." },
		{ type: "text", text: "## Auth refactor\n\nThe token check moved from `server/auth.ts` into **`lib/token.ts`**, so both the relay and the daemon share one implementation. Expired tokens now fail closed.\n\n```ts\nexport function checkToken(token: string, now = Date.now()): boolean {\n\tconst claims = decode(token);\n\tif (!claims || claims.exp * 1000 < now) return false;\n\treturn timingSafeEqual(claims.sig, sign(claims.body));\n}\n```\n\n| Endpoint | Before | After |\n| --- | --- | --- |\n| `/api/live` | cookie | bearer token |\n| `/api/past` | none | bearer token |\n| `/ws` | query token | first-frame auth |\n\n> Rotation keeps the previous key valid for one hour.\n\n- relay and daemon share `checkToken`\n- tests cover expiry and bad signatures" },
	]);
	push({ role: "user", content: "Run the tests and fix the import." });
	asst([
		{ type: "text", text: "Running the auth tests." },
		{ type: "toolCall", id: "call-bash", name: "bash", arguments: { command: "bun test ./test/token.test.ts" } },
	], "toolUse");
	push({ role: "toolResult", toolCallId: "call-bash", toolName: "bash", content: [{ type: "text", text: "bun test v1.3.0\n\ntest/token.test.ts:\n✓ accepts a fresh token [0.41ms]\n✓ rejects an expired token [0.12ms]\n✗ rejects a bad signature [0.30ms]\n  error: Cannot find module './sign' from 'lib/token.ts'\n\n 2 pass\n 1 fail" }], isError: false });
	asst([
		{ type: "text", text: "The signing helper moved; fixing the import." },
		{ type: "toolCall", id: "call-edit", name: "edit", arguments: { input: "[lib/token.ts#1A2B]\nreplace 2:\n+import { sign } from \"./crypto/sign\";" } },
	], "toolUse");
	push({ role: "toolResult", toolCallId: "call-edit", toolName: "edit", content: [{ type: "text", text: "Updated lib/token.ts" }], details: { path: "lib/token.ts", diff: " 1|import { decode } from \"./decode\";\n-2|import { sign } from \"./sign\";\n+2|import { sign } from \"./crypto/sign\";\n 3|import { timingSafeEqual } from \"node:crypto\";\n 4|", firstChangedLine: 2 }, isError: false });
	asst([{ type: "text", text: "Fixed. The flow now looks like this:\n\n```mermaid\nflowchart LR\n  Client -->|bearer| Relay\n  Relay -->|checkToken| Daemon\n  Daemon --> Session\n```\n\nAll three tests pass after the import fix." }]);
	return entries;
}
const HISTORY = buildHistory();
const TODOS = [
	{ name: "Refactor", tasks: [{ content: "Move token check to lib/token.ts", status: "completed" }, { content: "Fix sign import", status: "completed" }, { content: "Rotate keys hourly", status: "in_progress" }] },
	{ name: "Verify", tasks: [{ content: "Run auth tests", status: "pending" }, { content: "Update docs", status: "pending" }] },
];
const MODEL = { provider: "anthropic", id: "claude-sonnet", name: "Claude Sonnet" };
const BROWSER_MODELS = [
	["anthropic", "claude-sonnet", "Claude Sonnet", "chat"], ["anthropic", "claude-opus", "Claude Opus", "chat"], ["anthropic", "claude-haiku", "Claude Haiku", "chat"],
	["openai", "gpt-5", "GPT-5", "chat"], ["openai", "gpt-5-mini", "GPT-5 mini", "chat"], ["google", "gemini-2.5-pro", "Gemini 2.5 Pro", "chat"],
].map(([provider, id, name, kind], i) => ({ provider, id, name, selector: `${provider}/${id}`, kind, locked: provider === "google", perf: { samples: 12, tps: 80 + i * 10, ttftMs: 400 + i * 50 }, roles: i === 0 ? [{ role: "default", auto: false }] : i === 2 ? [{ role: "smol", auto: false }] : [], contextWindow: 200000 }));

// ---------- scripted RPC host ----------
const host = { mode: "" }; // per-view behaviour: "plan" | "ext" | ""
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clearshots-"));
const registryDir = path.join(tmp, "registry"), sessionsDir = path.join(tmp, "sessions");
fs.mkdirSync(registryDir, { recursive: true });
fs.mkdirSync(sessionsDir, { recursive: true });
const NAMES = ["refactor auth", "splash bench", "webgui tests", "docs pass", "ocean shader", "release notes"];
const hosts = NAMES.map((name, i) => startHost(`sess-${i}`, name, i));
function respond(req, send, sessionId) {
	const ok = data => send({ id: req.id, type: "response", command: req.type, success: true, data });
	switch (req.type) {
		case "negotiate_protocol": return ok({ protocolVersion: 3 });
		case "get_state": return ok({ sessionId, sessionName: "refactor auth", model: MODEL, isStreaming: false, isCompacting: false, steeringMode: "all", followUpMode: "all", interruptMode: "immediate", autoCompactionEnabled: true, fastModeEnabled: false, fastModeActive: false, tokensPerSecond: 120, messageCount: HISTORY.length, queuedMessageCount: 0, todoPhases: TODOS, thinkingLevel: "medium", contextUsage: { tokens: 48000, contextWindow: 200000, percent: 24 }, serverNow: Date.now() });
		case "history": return ok(req.before ? { leafId: HISTORY.at(-1).id, entries: [], hasMore: false, live: [] } : { leafId: HISTORY.at(-1).id, entries: HISTORY, hasMore: false, live: [] });
		case "get_session_stats": return ok({ sessionFile: undefined, sessionId, userMessages: 2, assistantMessages: 4, toolCalls: 2, toolResults: 2, totalMessages: HISTORY.length, tokens: { input: 48210, output: 9120, reasoning: 2100, cacheRead: 31000, cacheWrite: 4000, total: 94430 }, premiumRequests: 0, cost: 0.42, routedModels: { "anthropic/claude-sonnet": 4 }, contextUsage: { tokens: 48000, contextWindow: 200000, percent: 24 } });
		case "get_plan_state": return ok({ state: { available: true, enabled: host.mode === "plan", paused: false, planFilePath: "/tmp/project/PLAN.md" }, review: host.mode === "plan" ? { reviewId: "r1", title: "Auth refactor plan", planFilePath: "/tmp/project/PLAN.md", markdown: "# Auth refactor plan\n\n1. Move `checkToken` into `lib/token.ts`.\n2. Switch `/api/past` to bearer tokens.\n3. Rotate signing keys hourly; keep the previous key valid for one hour.\n\n```ts\nexport function rotate(now: number): Key[] { return keys.filter(k => k.exp > now); }\n```\n\n## Risks\n\n- Clients with cached cookies get one 401 and re-auth.", requestedAt: Date.now() - 30000 } : null });
		case "get_model_roles": return ok({ storage: "global", cycleOrder: ["default", "smol", "slow"], modelTags: {}, roles: [
			{ id: "default", name: "Default", section: "chat", configured: "anthropic/claude-sonnet", source: "global", provenance: "global", resolved: MODEL, custom: false, eligible: BROWSER_MODELS.map(m => m.selector) },
			{ id: "smol", name: "Fast", section: "chat", configured: "anthropic/claude-haiku", source: "global", provenance: "global", resolved: { provider: "anthropic", id: "claude-haiku", name: "Claude Haiku" }, custom: false, eligible: BROWSER_MODELS.map(m => m.selector) },
			{ id: "slow", name: "Thinking", section: "chat", source: "fallback", provenance: "default", fallbackFrom: "default", resolved: MODEL, custom: false, eligible: BROWSER_MODELS.map(m => m.selector) },
		] });
		case "get_model_browser": return ok({ models: BROWSER_MODELS, mruOrder: ["anthropic/claude-sonnet", "openai/gpt-5"], kinds: ["chat"], providers: [{ id: "anthropic", authenticated: true, discoverable: false, modelCount: 3 }, { id: "openai", authenticated: true, discoverable: false, modelCount: 2 }, { id: "google", authenticated: false, discoverable: false, modelCount: 1 }] });
		case "get_available_models": return ok({ models: BROWSER_MODELS.map(m => ({ provider: m.provider, id: m.id, name: m.name, contextWindow: 200000 })) });
		case "get_agents": return ok({ defaultAgent: "task", agents: [] });
		case "get_login_status": return ok({ providers: [] });
		case "get_available_commands": return ok({ commands: [{ name: "btw", description: "Ask a side question", source: "builtin" }, { name: "compact", description: "Compact the context", source: "builtin" }, { name: "model", description: "Switch model", source: "builtin" }, { name: "plan", description: "Toggle plan mode", source: "builtin" }] });
		case "get_subagents": return ok({ subagents: [] });
		case "get_agent_roster": return ok({ agents: [
			{ id: "Main", displayName: "Main", kind: "main", status: "running", createdAt: T0, lastActivity: Date.now() - 5000, activity: "Reviewing the token check" },
			{ id: "TokenTests", displayName: "TokenTests", kind: "sub", parentId: "Main", status: "running", agent: "task", description: "Write expiry tests", task: "Add tests for expired and malformed tokens", activity: "Running bun test", createdAt: T0 + 60000, lastActivity: Date.now() - 8000, resolvedModel: "anthropic/claude-haiku" },
			{ id: "DocsScout", displayName: "DocsScout", kind: "sub", parentId: "Main", status: "idle", agent: "scout", description: "Find auth docs", task: "List docs that mention cookie auth", activity: "Found 3 files", createdAt: T0 + 90000, lastActivity: Date.now() - 120000 },
		] });
		case "get_usage_reports": return ok({ reports: [{ provider: "anthropic", fetchedAt: Date.now(), active: true, limits: [
			{ id: "5h", label: "5 Hour", scope: { provider: "anthropic" }, window: { id: "5h", label: "5 Hour", durationMs: 18000000, resetsAt: Date.now() + 7200000 }, amount: { usedFraction: 0.42, unit: "percent" }, status: "ok" },
			{ id: "7d", label: "7 Day", scope: { provider: "anthropic" }, window: { id: "7d", label: "7 Day", durationMs: 604800000, resetsAt: Date.now() + 259200000 }, amount: { usedFraction: 0.81, unit: "percent" }, status: "warning" },
		] }] });
		case "btw": return ok({ record: { id: "btw1", question: req.question ?? "why fail closed?", answer: "Failing closed means an unreadable or expired token is **rejected** rather than trusted. A decode error never grants access, so a corrupted cookie cannot open a session.", status: "complete" } });
		default: return ok({});
	}
}
function startHost(sessionId, sessionName, i) {
	const sessionFile = path.join(registryDir, `${sessionId}.jsonl`);
	fs.writeFileSync(sessionFile, '{"type":"session_init"}\n');
	const pub = publishRpcHost({ sessionId, sessionName, sessionFile, cwd: "/tmp/project", model: "claude-sonnet", startedAt: Date.now() - i * 600000 }, { dir: registryDir });
	fs.rmSync(pub.endpoint, { force: true });
	const server = net.createServer(socket => {
		let authed = false, buf = "";
		const send = o => { if (!socket.destroyed && socket.writable) socket.write(JSON.stringify(o) + "\n"); };
		socket.on("error", () => {});
		socket.on("data", chunk => {
			buf += chunk.toString("utf8");
			for (let k; (k = buf.indexOf("\n")) !== -1; ) {
				const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
				if (!line) continue;
				let req; try { req = JSON.parse(line); } catch { continue; }
				if (!authed) {
					if (req.type === "auth" && req.token === pub.token) { authed = true; send({ type: "ready", protocolVersion: 3, supportedProtocolVersions: [1, 2, 3] }); } else socket.destroy();
					continue;
				}
				if (process.env.DEBUG) console.log("[host]", req.type);
				respond(req, send, sessionId);
				if (req.type === "history" && !req.before && host.mode === "ext") setTimeout(() => send({ type: "extension_ui_request", id: "dlg1", method: "select", title: "Which signing key should stay valid during rotation?", options: ["Previous key for one hour", "Previous key for one day", "No overlap"] }), 300);
			}
		});
	});
	server.listen(pub.endpoint);
	return { instanceId: pub.entry.instanceId, close: () => { server.close(); pub.close(); } };
}
const sid = hosts[0].instanceId;
const web = createServer({ registryDir, sessionsDir, distDir: path.join(ROOT, label), host: "127.0.0.1", port: 0 });
const base = `http://127.0.0.1:${web.port}`;
// SERVERS=n starts n-1 more servers on the same registry; the client drops entries at its own origin
const extraBases = Array.from({ length: Math.max(0, Number(process.env.SERVERS ?? 1) - 1) }, () => `http://127.0.0.1:${createServer({ registryDir, sessionsDir, distDir: path.join(ROOT, label), host: "127.0.0.1", port: 0 }).port}`);

// ---------- views ----------
const sel = s => () => !!document.querySelector(s);
const hasText = t => `document.body.innerText.includes(${JSON.stringify(t)})`;
const typeInComposer = async (page, text) => {
	const ta = await page.waitForSelector("textarea", { timeout: 20000 });
	await ta.click();
	await page.keyboard.type(text);
};
const VIEW = {
	sessions: { hash: "#/", ready: hasText("ocean shader") },
	transcript: { hash: `#/s/${sid}`, ready: hasText("Auth refactor") },
	hub: { hash: `#/s/${sid}/hub`, ready: hasText("TokenTests") },
	// deep link renders UsageScreen before the client exists (sink from a ref, never refetched); open it from the session
	usage: { hash: `#/s/${sid}`, ready: hasText("Auth refactor"), act: async p => { await p.evaluate(h => { location.hash = h; }, `#/s/${sid}/usage`); await p.waitForFunction(hasText("7 Day"), { timeout: 15000 }); } },
	todos: { hash: `#/s/${sid}/todos`, ready: hasText("Rotate keys hourly") },
	info: { hash: `#/s/${sid}/info`, ready: hasText("Auth refactor") },
	// same deep-link issue as usage: open Control Center, then its Models view
	models: { hash: `#/s/${sid}`, ready: hasText("Auth refactor"), act: async p => { await p.click('[aria-label="Open control center"]'); await p.waitForSelector("button.cc-h-btn", { timeout: 10000 }); await p.evaluate(() => document.querySelector("button.cc-h-btn").click()); await p.waitForFunction(hasText("Claude Haiku"), { timeout: 15000 }); } },
	settings: { hash: `#/settings/${sid}`, ready: "document.body.innerText.length > 20" },
	cc: { hash: `#/s/${sid}`, ready: hasText("Auth refactor"), act: async p => { await p.click('[aria-label="Open control center"]'); } },
	composer: { hash: `#/s/${sid}`, ready: hasText("Auth refactor"), act: p => typeInComposer(p, "Now rotate the signing keys hourly and keep the previous key valid for one hour.") },
	slash: { hash: `#/s/${sid}`, ready: hasText("Auth refactor"), act: p => typeInComposer(p, "/") },
	plan: { hash: `#/s/${sid}`, mode: "plan", ready: hasText("Auth refactor plan") },
	ext: { hash: `#/s/${sid}`, mode: "ext", ready: hasText("Which signing key") },
	btw: { hash: `#/s/${sid}`, ready: hasText("Auth refactor"), act: async p => { await typeInComposer(p, "/btw why fail closed?"); await p.click('button[aria-label="Send"]'); await p.waitForFunction(hasText("Failing closed"), { timeout: 15000 }); } },
};

const shim = hour => `{ const R = Date, t = new R(); t.setHours(${Math.floor(hour)}, ${Math.round((hour % 1) * 60)}, 0, 0); const off = t - R.now();
	window.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }; }`;

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS });
const measurer = await b.newPage();
const contrast = [];
const failures = [];
for (const theme of THEMES) for (const hour of HOURS) for (const w of SIZES) for (const view of VIEWS) {
	const v = VIEW[view];
	const [h, d] = w < 800 ? [844, 3] : [900, 1];
	host.mode = v.mode ?? "";
	// fresh storage per shot: drafts, cache and settings from one view must not leak into the next
	const ctx = await b.createBrowserContext();
	const page = await ctx.newPage();
	try {
		await page.setViewport({ width: w, height: h, deviceScaleFactor: d, isMobile: w < 800, hasTouch: w < 800 });
		await page.emulateMediaFeatures([...(theme ? [{ name: "prefers-color-scheme", value: theme }] : []), ...(BG === "off" ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [])]);
		await page.setRequestInterception(true);
		page.on("request", async r => {
			if (r.isInterceptResolutionHandled()) return;
			if (!r.url().endsWith("/api/live")) return r.continue();
			const res = await fetch(r.url(), { headers: r.headers() }).then(x => x.json()).catch(() => null);
			if (!Array.isArray(res)) return r.continue();
			for (const e of res) if (RECAPS[e.sessionName]) e.recap = { text: RECAPS[e.sessionName], createdAt: Date.now() - 5 * 60000 };
			r.respond({ status: 200, contentType: "application/json", body: JSON.stringify(res) });
		});
		await page.evaluateOnNewDocument(shim(hour));
		if (extraBases.length) await page.evaluateOnNewDocument((list) => localStorage.setItem("webgui.servers", JSON.stringify(list)), extraBases.map((url, i) => ({ id: `s${i + 2}`, name: `Computer ${i + 2}`, url })));
		if (UI === "clear") await page.evaluateOnNewDocument(() => localStorage.setItem("webgui.ui", "clear"));
		const q = [UI === "clear" ? `hour=${hour}` : "", BG ? `bg=${BG}` : ""].filter(Boolean).join("&");
		await page.goto(`${base}/${q ? "?" + q : ""}${v.hash}`);
		await page.waitForFunction(v.ready, { timeout: 30000 });
		if (BG !== "off") await page.waitForFunction(() => document.querySelector(".app-bg-layer canvas") || document.querySelector(".app-bg-layer")?.style.backgroundImage.includes("blob:"), { timeout: 30000 }).catch(() => {});
		if (v.act) await v.act(page);
		// splash gone, mermaid/highlight settled, light after its first update
		await page.waitForFunction(() => !document.documentElement.classList.contains("splash-run"), { timeout: 30000 }).catch(() => {});
		await new Promise(r => setTimeout(r, UI === "clear" ? 2500 : 1200));
		const file = path.join(outDir, `${UI}-${view}-${w}${theme ? "-" + theme : ""}-h${hour}.png`);
		await page.screenshot({ path: file });
		const boxes = await page.evaluate(roots => {
			const out = [];
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
			for (let n; (n = walker.nextNode()); ) {
				if (!n.textContent.trim()) continue;
				const el = n.parentElement;
				if (!el || el.closest("script,style,noscript,.app-bg-layer") || (roots && !el.closest(roots)) || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
				let op = 1;
				for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
				if (op < 0.05) continue;
				const cs = getComputedStyle(el);
				const rg = document.createRange(); rg.selectNodeContents(n);
				for (const r of rg.getClientRects()) {
					if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
					const x = Math.max(0, r.x), y = Math.max(0, r.y);
					// covered by a sheet/overlay: not visible text
					const top = document.elementFromPoint(Math.min(innerWidth - 1, r.x + r.width / 2), Math.min(innerHeight - 1, r.y + r.height / 2));
					if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;
					const svg = el.closest("svg") && cs.fill && cs.fill !== "none" && !cs.fill.startsWith("url");
					const cls = typeof el.className === "string" && el.className ? el.className.split(" ")[0] : el.tagName.toLowerCase();
					out.push({ cls, text: n.textContent.trim().slice(0, 40), x, y, w: Math.min(r.right, innerWidth) - x, h: Math.min(r.bottom, innerHeight) - y, color: svg ? cs.fill : cs.color, op, size: parseFloat(cs.fontSize), weight: +cs.fontWeight });
				}
			}
			// form fields: value (or placeholder) is not a text node; measure the first line of the content box
			for (const el of document.querySelectorAll("textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden])")) {
				if ((roots && !el.closest(roots)) || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
				const ph = !el.value;
				if (ph && !el.placeholder) continue;
				let op = 1;
				for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
				const cs = getComputedStyle(el), pcs = ph ? getComputedStyle(el, "::placeholder") : cs;
				const r = el.getBoundingClientRect();
				const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
				const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
				const x = Math.max(0, r.x + pl), y = Math.max(0, r.y + pt), w = Math.min(r.right - parseFloat(cs.paddingRight), innerWidth) - x, h = Math.min(lh, r.bottom - y);
				if (w < 2 || h < 2 || y >= innerHeight) continue;
				const top = document.elementFromPoint(Math.min(innerWidth - 1, x + w / 2), Math.min(innerHeight - 1, y + h / 2));
				if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;
				out.push({ cls: (el.className.split?.(" ")[0] || el.tagName.toLowerCase()) + (ph ? "::placeholder" : ""), text: (el.value || el.placeholder).slice(0, 40), x, y, w, h, color: pcs.color, op, size: parseFloat(cs.fontSize), weight: +cs.fontWeight });
			}
			const st = document.createElement("style");
			// near-invisible glyph fill, not transparent: Chrome drops the text-shadow of fully transparent text
			st.textContent = "*,*::placeholder{-webkit-text-fill-color:rgb(0 0 0 / 1%)!important;caret-color:transparent!important} svg text,svg tspan{fill-opacity:0.01!important;stroke-opacity:0!important}";
			document.head.append(st);
			return out;
		}, process.env.ROOTS ?? "");
		await new Promise(r => setTimeout(r, 300));
		const bare = await page.screenshot({ encoding: "base64" });
		const res = await measurer.evaluate(async (png, boxes, d) => {
			const img = new Image(); img.src = "data:image/png;base64," + png; await img.decode();
			const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
			const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
			const lum = (r, gg, bb) => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(bb); };
			const one = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
			return boxes.map(bx => {
				one.clearRect(0, 0, 1, 1); one.fillStyle = bx.color; one.fillRect(0, 0, 1, 1);
				const [fr, fg, fb, fa] = one.getImageData(0, 0, 1, 1).data, a = (fa / 255) * bx.op;
				const px = g.getImageData(Math.round(bx.x * d), Math.round(bx.y * d), Math.max(1, Math.round(bx.w * d)), Math.max(1, Math.round(bx.h * d))).data;
				const rs = [];
				for (let i = 0; i < px.length; i += 4) {
					const L1 = lum(px[i], px[i + 1], px[i + 2]);
					const L2 = lum(fr * a + px[i] * (1 - a), fg * a + px[i + 1] * (1 - a), fb * a + px[i + 2] * (1 - a));
					rs.push((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05));
				}
				rs.sort((x, y) => x - y);
				const need = bx.size >= 24 || (bx.size >= 18.66 && bx.weight >= 700) ? 3 : 4.5;
				return { cls: bx.cls, text: bx.text, size: bx.size, need, min: +rs[0].toFixed(2), p5: +rs[Math.floor(rs.length * 0.05)].toFixed(2), x: Math.round(bx.x), y: Math.round(bx.y) };
			});
		}, bare, boxes, d);
		const worst = res.reduce((a, r) => (r.p5 < a.p5 ? r : a), { p5: Infinity });
		const fail = res.filter(r => r.p5 < r.need);
		contrast.push({ view, w, hour, theme, ui: UI, file, n: res.length, fail: fail.length, worstP5: worst.p5, worstCls: worst.cls, worstText: worst.text, boxes: res });
		console.log(`${file}  runs ${res.length}  below-need ${fail.length}  worst p5 ${worst.p5 === Infinity ? "-" : worst.p5} (${worst.cls ?? ""} "${worst.text ?? ""}")`);
	} catch (e) {
		failures.push({ view, w, hour, theme, error: String(e).split("\n")[0] });
		console.log(`FAIL ${view} ${w} h${hour}: ${String(e).split("\n")[0]}`);
		await page.screenshot({ path: path.join(outDir, `${UI}-${view}-${w}${theme ? "-" + theme : ""}-h${hour}-FAILED.png`) }).catch(() => {});
	}
	await ctx.close();
}
fs.writeFileSync(path.join(outDir, `contrast-${UI}.json`), JSON.stringify({ label, ui: UI, bg: BG, failures, shots: contrast }, null, 1));
console.log(`contrast: ${path.join(outDir, `contrast-${UI}.json`)}${failures.length ? `  view failures: ${failures.length}` : ""}`);
await b.close();
web.stop(true);
for (const hst of hosts) hst.close();
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failures.length ? 1 : 0);
