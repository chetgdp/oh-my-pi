import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/** Matches the TUI's file completion cap. */
const MAX_DIRS = 100;

export interface DirCompletion {
	/** Absolute path with a trailing slash, ready to launch from or complete further. */
	path: string;
	name: string;
}

/**
 * Directories completing `prefix`, the way the TUI completes paths on Tab: the
 * text after the last `/` is a case-insensitive name prefix within its parent.
 * Results are absolute because `/api/launch` accepts only absolute paths; `~`
 * and relative prefixes resolve against `home`.
 */
export async function listDirCompletions(prefix: string, home: string): Promise<DirCompletion[]> {
	let expanded = prefix;
	if (expanded === "" || expanded === "~") expanded = `${home}/`;
	else if (expanded.startsWith("~/")) expanded = home + expanded.slice(1);
	if (!path.isAbsolute(expanded)) expanded = path.join(home, expanded);

	const slash = expanded.lastIndexOf("/");
	const dir = expanded.slice(0, slash + 1);
	const needle = expanded.slice(slash + 1).toLowerCase();

	let entries: Dirent[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const matched = entries.filter(e => e.name !== ".git" && e.name.toLowerCase().startsWith(needle));
	const isDir = await Promise.all(
		matched.map(e =>
			e.isSymbolicLink()
				? fs.stat(path.join(dir, e.name)).then(
						s => s.isDirectory(),
						() => false,
					)
				: e.isDirectory(),
		),
	);
	return matched
		.filter((_, i) => isDir[i])
		.map(e => e.name)
		.sort((a, b) => a.localeCompare(b))
		.slice(0, MAX_DIRS)
		.map(name => ({ name, path: `${dir}${name}/` }));
}

export async function handleDirsRequest(req: Request, url: URL): Promise<Response | null> {
	if (req.method !== "GET" || url.pathname !== "/api/dirs") return null;
	return Response.json(await listDirCompletions(url.searchParams.get("prefix") ?? "", os.homedir()));
}
