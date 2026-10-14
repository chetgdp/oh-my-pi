import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { handleDirsRequest, listDirCompletions } from "../src/server/dirs";

let home: string;

beforeAll(async () => {
	home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "webgui-dirs-")));
	for (const d of ["Alpha", "alpine", "beta", ".hidden", ".git", "target"]) await fs.mkdir(path.join(home, d));
	await Bun.write(path.join(home, "alfile"), "");
	await fs.symlink(path.join(home, "target"), path.join(home, "alink"));
	await fs.symlink(path.join(home, "alfile"), path.join(home, "alfilelink"));
});

afterAll(async () => {
	await fs.rm(home, { recursive: true, force: true });
});

const names = async (prefix: string): Promise<string[]> => (await listDirCompletions(prefix, home)).map(d => d.path);

describe("listDirCompletions", () => {
	it("matches the last segment case-insensitively, folders and folder symlinks only", async () => {
		expect(await names("~/al")).toEqual([`${home}/alink/`, `${home}/Alpha/`, `${home}/alpine/`]);
	});

	it("lists a directory's contents for a trailing slash, keeping dotfolders but not .git", async () => {
		expect(await names(`${home}/`)).toEqual(
			[".hidden", "alink", "Alpha", "alpine", "beta", "target"].map(n => `${home}/${n}/`),
		);
	});

	it("resolves bare ~, empty, and relative prefixes against home", async () => {
		const all = await names(`${home}/`);
		expect(await names("~")).toEqual(await names("~/"));
		expect(await names("")).toEqual(all);
		expect(await names("be")).toEqual([`${home}/beta/`]);
	});

	it("returns nothing for a missing parent directory", async () => {
		expect(await names(`${home}/nope/x`)).toEqual([]);
	});
});

describe("GET /api/dirs", () => {
	it("returns completions for the prefix query", async () => {
		const url = new URL(`http://localhost/api/dirs?prefix=${encodeURIComponent(`${home}/be`)}`);
		const res = await handleDirsRequest(new Request(url.href), url);
		expect(await res?.json()).toEqual([{ name: "beta", path: `${home}/beta/` }]);
	});

	it("leaves other methods to the router", async () => {
		const url = new URL("http://localhost/api/dirs");
		expect(await handleDirsRequest(new Request(url.href, { method: "POST" }), url)).toBeNull();
	});
});
