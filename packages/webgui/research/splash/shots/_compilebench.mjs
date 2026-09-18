// bun research/splash/shots/_compilebench.mjs <label> [v] [firefox]: opens /shader?bench=compile on a built label headless, prints the table
import puppeteer from "puppeteer-core";
import * as path from "node:path";

const dir = path.join("/tmp/splash-bench", process.argv[2]);
const v = process.argv[3];
const server = Bun.serve({
	port: 0,
	fetch(req) {
		const u = new URL(req.url);
		const f = u.pathname === "/shader" ? "index.html" : u.pathname;
		return new Response(Bun.file(path.join(dir, f)));
	},
});
const firefox = process.argv[4] === "firefox";
const b = await puppeteer.launch(
	firefox
		? { browser: "firefox", executablePath: "/Applications/Firefox.app/Contents/MacOS/firefox", headless: true }
		: {
				executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
				headless: true,
				args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
			},
);
const page = await b.newPage();
page.on("console", m => console.log("console", m.type(), m.text()));
page.on("pageerror", e => console.log("pageerror", e.message));
await page.goto(`http://localhost:${server.port}/shader?bench=compile${v ? `&v=${v}` : ""}`);
try {
	await page.waitForFunction(() => document.querySelector("pre")?.textContent.endsWith("done"), { timeout: 60000 });
} catch {
	console.log("timeout; body:", await page.evaluate(() => document.body.innerHTML.slice(0, 400)));
}
console.log(await page.$eval("pre", e => e.textContent));
await b.close();
server.stop();
