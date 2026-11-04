import { describe, expect, test } from "bun:test";
import { formatReport } from "../src/program-status";

function body(report: string): Record<string, string> {
	expect(report.startsWith("\x1b]7501;")).toBe(true);
	expect(report.endsWith("\x1b\\")).toBe(true);
	return Object.fromEntries(
		report
			.slice(7, -2)
			.split(":")
			.map(pair => pair.split("=", 2) as [string, string]),
	);
}

const decode = (msg: string) => Buffer.from(msg, "base64").toString("utf8");

describe("formatReport", () => {
	test("blocked carries kind and a control-free one-line msg", () => {
		const pairs = body(formatReport({ state: "blocked", kind: "permission", msg: "Run\trm -rf\n\x1b[31mbuild?" }));
		expect(pairs.state).toBe("blocked");
		expect(pairs.kind).toBe("permission");
		expect(pairs.app).toBe("omp");
		expect(decode(pairs.msg!)).toBe("Run rm -rf [31mbuild?");
	});

	test("msg over the 2048-byte limit is cut on a UTF-8 boundary", () => {
		const pairs = body(formatReport({ state: "error", msg: `${"a".repeat(2047)}é tail` }));
		const text = decode(pairs.msg!);
		expect(text).toBe("a".repeat(2047));
		expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(2048);
	});

	test("working ignores msg; blank msg is omitted", () => {
		expect(body(formatReport({ state: "working" }))).toEqual({ state: "working", app: "omp" });
		expect(body(formatReport({ state: "error", msg: " \n\t " }))).toEqual({ state: "error", app: "omp" });
	});
});
