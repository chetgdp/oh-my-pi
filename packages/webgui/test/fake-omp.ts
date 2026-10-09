import * as fs from "node:fs";
import * as path from "node:path";

export interface FakeOmp {
	bin: string;
	/** Argv (after the binary) of every invocation so far, oldest first. */
	calls(): string[][];
}

/**
 * Writes an executable stand-in for `omp` into `dir`. Each run records its
 * argv as NUL-separated fields, then prints `stdout` / `stderr` and exits.
 */
export function writeFakeOmp(
	dir: string,
	behavior: { stdout?: string; stderr?: string; exitCode?: number },
	name = "omp",
): FakeOmp {
	fs.mkdirSync(dir, { recursive: true });
	const bin = path.join(dir, name);
	const log = path.join(dir, `${name}.calls`);
	fs.writeFileSync(
		bin,
		[
			"#!/bin/sh",
			`printf '%s\\0' "$@" >> '${log}'`,
			`printf '\\n' >> '${log}'`,
			`printf '%s' '${Buffer.from(behavior.stdout ?? "").toString("base64")}' | base64 -d`,
			`printf '%s' '${Buffer.from(behavior.stderr ?? "").toString("base64")}' | base64 -d >&2`,
			`exit ${behavior.exitCode ?? 0}`,
			"",
		].join("\n"),
		{ mode: 0o755 },
	);
	return {
		bin,
		calls() {
			if (!fs.existsSync(log)) return [];
			return fs
				.readFileSync(log, "utf8")
				.split("\0\n")
				.filter(rec => rec.length > 0)
				.map(rec => rec.split("\0"));
		},
	};
}
